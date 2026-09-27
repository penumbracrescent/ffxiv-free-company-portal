"""Setup-only, local-file restore worker. No Docker socket or published ports."""
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tarfile
import tempfile
import time

SETUP = Path(os.environ.get("RESTORE_SETUP_DIR", "/setup-output"))
DATA = Path(os.environ.get("RESTORE_DATA_DIR", "/target-data"))
BACKUPS = Path(os.environ.get("RESTORE_BACKUP_DIR", "/backups"))
MAX_BYTES = 10 * 1024**3
OWNER = None


def write_json(name, value):
    target = SETUP / name
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(value), encoding="utf-8")
    temporary.chmod(0o600)
    if OWNER:
        os.chown(temporary, *OWNER)
    temporary.replace(target)


def status(phase, message, **extra):
    write_json("restore-status.json", {"phase": phase, "message": message, **extra})


def enabled():
    return (os.environ.get("SETUP_MODE") == "true"
            and (SETUP / "bootstrap.json").is_file()
            and not (SETUP / "installation.json").exists()
            and not (SETUP / "setup-sealed.json").exists())


def parse_env(source):
    values = {}
    for line in source.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key, separator, value = line.partition("=")
        if not separator or not re.fullmatch(r"[A-Z][A-Z0-9_]*", key):
            raise ValueError("The backup environment has an unsupported entry.")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key] = value
    return values


def portable_settings(values):
    # Never import Docker controls, database destinations, setup state or runtime
    # injection variables. Accept only settings supported by this release.
    allowed = set(parse_env(Path("/supported-env").read_text()))
    protected = {"AUTH_SECRET", "ANIME_SERVICE_API_TOKEN", "PORTAL_PORT",
                 "COMPOSE_PROJECT_NAME", "COMPOSE_PROFILES", "DATABASE_URL"}
    return {key: value for key, value in values.items()
            if key in allowed and key not in protected
            and not key.startswith(("POSTGRES_", "DOCKER_", "SETUP_"))}


def validate_archive(archive, stage):
    """Extract regular files only, with bounded expansion and no path escape."""
    total = 0
    seen = set()
    with tarfile.open(archive, "r:gz") as package:
        for index, member in enumerate(package):
            if index >= 100000:
                raise ValueError("The backup contains too many entries.")
            raw = member.name
            path = PurePosixPath(raw)
            if "\\" in raw or path.is_absolute() or ".." in path.parts:
                raise ValueError("The backup contains an unsafe path.")
            name = str(path)
            if name == "." and member.isdir():
                continue
            if not (member.isfile() or member.isdir()) or member.issparse():
                raise ValueError("Links, devices and sparse files are not supported in backups.")
            if name in seen:
                raise ValueError("The backup contains duplicate paths.")
            seen.add(name)
            if name not in {"manifest.json", "installation.env", "installation-compose.yaml", "portal.dump", "data"} and not name.startswith("data/"):
                raise ValueError("The backup contains an unexpected top-level path.")
            if name == "data/setup" or name.startswith("data/setup/"):
                raise ValueError("Backups must not contain active setup state.")
            total += member.size
            if total > MAX_BYTES or member.size < 0:
                raise ValueError("Expanded backup exceeds the 10 GiB safety limit.")
            if member.isfile() and name in {"manifest.json", "installation.env"} and member.size > 1024**2:
                raise ValueError("Backup metadata is too large.")
            if shutil.disk_usage(stage).free < member.size * 2 + 128 * 1024**2:
                raise ValueError("Not enough free space to stage and restore this backup.")
            destination = stage / name
            if member.isdir():
                destination.mkdir(parents=True, exist_ok=True)
            else:
                destination.parent.mkdir(parents=True, exist_ok=True)
                with package.extractfile(member) as source, destination.open("xb") as output:
                    shutil.copyfileobj(source, output)
                destination.chmod(0o600)
    for required in ("manifest.json", "installation.env", "portal.dump"):
        if not (stage / required).is_file():
            raise ValueError("The backup is missing required files.")
    manifest = json.loads((stage / "manifest.json").read_text())
    if manifest.get("format") != "cotf-portal-backup" or manifest.get("version") != 1:
        raise ValueError("Unsupported backup format or version.")
    with (stage / "portal.dump").open("rb") as dump:
        if dump.read(5) != b"PGDMP":
            raise ValueError("The database backup is not a PostgreSQL custom archive.")
    values = parse_env((stage / "installation.env").read_text(encoding="utf-8-sig"))
    return {"siteName": values.get("PORTAL_NAME", "Unnamed portal")[:100],
            "createdAt": str(manifest.get("createdAt", "Unknown"))[:80],
            "expandedBytes": total, "fileCount": len(seen)}, values


def pg(*args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=3600)
    if result.returncode:
        # SQL and connection errors can include private values; never publish them.
        raise ValueError("Database validation/import failed. Keep the original backup and use a fresh installation before retrying.")
    return result.stdout.strip()


def require_empty_database():
    count = pg("psql", "-At", "-v", "ON_ERROR_STOP=1", "-c",
               "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace "
               "where n.nspname not in ('pg_catalog','information_schema') "
               "and n.nspname not like 'pg_toast%' and c.relkind in ('r','p','v','m','S','f');")
    if count != "0":
        raise ValueError("Restore requires a fresh, empty database. Existing site data will not be overwritten.")


def copy_data(stage):
    def directory(path):
        current = DATA
        for part in path.relative_to(DATA).parts:
            current = current / part
            current.mkdir(exist_ok=True)
            if OWNER:
                os.chown(current, *OWNER)

    source = stage / "data"
    if not source.exists():
        return
    for item in source.rglob("*"):
        target = DATA / item.relative_to(source)
        # Refuse host-side symlinks too, not just archive symlinks.
        if any(p.is_symlink() for p in [target, *target.parents]):
            raise ValueError("A destination data path contains a symbolic link.")
        if item.is_dir():
            directory(target)
        else:
            directory(target.parent)
            shutil.copyfile(item, target)
            target.chmod(0o600 if item.parts[len(stage.parts) + 1] != "branding" else 0o644)
            if OWNER:
                os.chown(target, *OWNER)


def main():
    global OWNER
    SETUP.mkdir(parents=True, exist_ok=True)
    stage = None
    preview = None
    values = None
    request_path = SETUP / "restore-request.json"
    if (SETUP / "restore-status.json").exists():
        old = json.loads((SETUP / "restore-status.json").read_text())
        if old.get("phase") not in ("complete", "failed"):
            stat = (SETUP / "restore-status.json").stat()
            OWNER = (stat.st_uid, stat.st_gid)
            status("failed", "Restore helper restarted. Use a fresh installation if import had begun; otherwise reload and inspect the backup again.")
    while True:
        (SETUP / "restore-heartbeat").touch()
        if not enabled():
            if stage:
                shutil.rmtree(stage, ignore_errors=True)
                stage = None
            time.sleep(2)
            continue
        if not request_path.exists():
            time.sleep(1)
            continue
        try:
            stat = request_path.stat()
            OWNER = (stat.st_uid, stat.st_gid)
            request = json.loads(request_path.read_text())
            request_path.unlink()
            if (SETUP / "restore-applied.json").exists():
                raise ValueError("A backup has already been restored into this installation.")
            if request.get("action") == "list":
                files = sorted(p.name for p in BACKUPS.glob("*.tar.gz") if p.is_file() and not p.is_symlink())[:200]
                status("idle", "Choose a backup archive.", files=files)
            elif request.get("action") == "inspect":
                if stage:
                    shutil.rmtree(stage)
                stage = Path(tempfile.mkdtemp(prefix="restore-", dir=SETUP))
                stage.chmod(0o700)
                status("validating", "Checking archive paths, size, format and database compatibility...")
                require_empty_database()
                if (SETUP / "restore-import-started.json").exists():
                    raise ValueError("An earlier import was interrupted. Use a fresh installation before retrying.")
                name = request.get("filename", "")
                if name == "upload":
                    archive = SETUP / "restore-upload.tar.gz"
                else:
                    if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._ -]{0,180}\.tar\.gz", name):
                        raise ValueError("Invalid backup filename.")
                    archive = BACKUPS / name
                if archive.is_symlink() or not archive.is_file():
                    raise ValueError("Backup not found or is a symbolic link.")
                preview, values = validate_archive(archive, stage)
                if shutil.disk_usage(DATA).free < preview["expandedBytes"] + 128 * 1024**2:
                    raise ValueError("Not enough free space for restored persistent files.")
                pg("pg_restore", "--list", str(stage / "portal.dump"))
                # Confirmation is bound to the immutable, private staged copy.
                confirmation = os.urandom(24).hex()
                preview["confirmation"] = confirmation
                status("ready", "Backup validated. Review the details before restoring.", preview=preview)
            elif request.get("action") == "confirm":
                if not stage or not preview or request.get("confirmation") != preview["confirmation"]:
                    raise ValueError("Inspect the backup again before confirming.")
                require_empty_database()
                status("restoring", "Restoring the database. Do not stop the project.")
                write_json("restore-import-started.json", {"started": True})
                pg("pg_restore", "--single-transaction", "--exit-on-error", "--no-owner", "--no-privileges",
                   "--dbname", os.environ["PGDATABASE"], str(stage / "portal.dump"))
                status("restoring", "Restoring persistent files and integration settings...")
                copy_data(stage)
                write_json("restored-env.json", portable_settings(values))
                if (stage / "installation-compose.yaml").exists():
                    shutil.copyfile(stage / "installation-compose.yaml", SETUP / "restored-compose.yaml")
                    (SETUP / "restored-compose.yaml").chmod(0o600)
                write_json("restore-applied.json", {"restored": True, "backupCreatedAt": preview["createdAt"]})
                status("complete", "Restore complete. Continue setup to review the imported settings.", preview=preview)
                shutil.rmtree(stage)
                stage = None
                (SETUP / "restore-upload.tar.gz").unlink(missing_ok=True)
            else:
                raise ValueError("Unknown restore operation.")
        except Exception as error:
            message = str(error) if isinstance(error, ValueError) else "Restore failed. Keep the original backup. Check disk space and use a fresh installation before retrying an interrupted import."
            status("failed", message)
            if stage:
                shutil.rmtree(stage, ignore_errors=True)
                stage = None
        finally:
            (SETUP / "restore-operation.lock").unlink(missing_ok=True)


if __name__ == "__main__":
    main()
