import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import runner


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.stage = self.root / "stage"
        self.stage.mkdir()

    def archive(self, extra=(), version=1):
        path = self.root / "backup.tar.gz"
        with tarfile.open(path, "w:gz") as output:
            entries = [("./manifest.json", json.dumps({"format": "cotf-portal-backup", "version": version, "createdAt": "2026-09-03"}).encode()),
                       ("./installation.env", b"PORTAL_NAME='Test Portal'\nAUTH_PROVIDER='authentik'\n"),
                       ("./portal.dump", b"PGDMP-test"),
                       ("./data/branding/image.png", b"test")]
            for name, body in entries + list(extra):
                if isinstance(body, tarfile.TarInfo):
                    output.addfile(body)
                else:
                    info = tarfile.TarInfo(name)
                    info.size = len(body)
                    output.addfile(info, io.BytesIO(body))
        return path

    def test_valid_archive_preserves_files_and_preview(self):
        preview, values = runner.validate_archive(self.archive(), self.stage)
        self.assertEqual(preview["siteName"], "Test Portal")
        self.assertEqual(values["AUTH_PROVIDER"], "authentik")
        self.assertEqual((self.stage / "data/branding/image.png").read_bytes(), b"test")

    def test_traversal_rejected(self):
        for name in ("../escape", "/escape", "data/../../escape", "data\\..\\escape"):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                with self.assertRaises(ValueError):
                    runner.validate_archive(self.archive([(name, b"bad")]), Path(directory))

    def test_symlink_rejected(self):
        info = tarfile.TarInfo("data/link")
        info.type = tarfile.SYMTYPE
        info.linkname = "/etc/passwd"
        with self.assertRaises(ValueError):
            runner.validate_archive(self.archive([("data/link", info)]), self.stage)

    def test_hardlink_rejected(self):
        info = tarfile.TarInfo("data/link")
        info.type = tarfile.LNKTYPE
        info.linkname = "installation.env"
        with self.assertRaises(ValueError):
            runner.validate_archive(self.archive([("data/link", info)]), self.stage)

    def test_duplicate_rejected(self):
        with self.assertRaises(ValueError):
            runner.validate_archive(self.archive([("portal.dump", b"PGDMP")]), self.stage)

    def test_setup_state_rejected(self):
        with self.assertRaises(ValueError):
            runner.validate_archive(self.archive([("data/setup/bootstrap.json", b"{}")]), self.stage)

    def test_unknown_root_rejected(self):
        with self.assertRaises(ValueError):
            runner.validate_archive(self.archive([("run.sh", b"malicious")]), self.stage)

    def test_expansion_limit(self):
        with patch.object(runner, "MAX_BYTES", 10), self.assertRaises(ValueError):
            runner.validate_archive(self.archive(), self.stage)

    def test_unsupported_version(self):
        with self.assertRaises(ValueError):
            runner.validate_archive(self.archive(version=2), self.stage)

    def test_disk_space(self):
        usage = type("Usage", (), {"free": 1})()
        with patch.object(runner.shutil, "disk_usage", return_value=usage), self.assertRaises(ValueError):
            runner.validate_archive(self.archive(), self.stage)

    def test_nonempty_database_refused(self):
        with patch.object(runner, "pg", return_value="1"), self.assertRaises(ValueError):
            runner.require_empty_database()
        with patch.object(runner, "pg", return_value="0"):
            runner.require_empty_database()

    def test_only_supported_portable_settings(self):
        values = {"AUTH_PROVIDER": "authentik", "AUTH_AUTHENTIK_SECRET": "secret", "POSTGRES_PASSWORD": "old", "AUTH_SECRET": "old", "PORTAL_PORT": "9999", "DOCKER_NETWORK_SUBNET": "old", "COMPOSE_PROJECT_NAME": "old", "SETUP_MODE": "false", "NODE_OPTIONS": "bad"}
        with patch.object(Path, "read_text", return_value="\n".join(key + "=''" for key in values if key != "NODE_OPTIONS")):
            self.assertEqual(runner.portable_settings(values), {"AUTH_PROVIDER": "authentik", "AUTH_AUTHENTIK_SECRET": "secret"})

    def test_sealed_and_saved_setup_disabled(self):
        with patch.object(runner, "SETUP", self.stage), patch.dict(runner.os.environ, {"SETUP_MODE": "true"}):
            (self.stage / "bootstrap.json").write_text("{}")
            self.assertTrue(runner.enabled())
            (self.stage / "installation.json").write_text("{}")
            self.assertFalse(runner.enabled())
            (self.stage / "installation.json").unlink()
            (self.stage / "setup-sealed.json").write_text("{}")
            self.assertFalse(runner.enabled())

    def run_worker(self, fail_import=False):
        class StopLoop(BaseException):
            pass
        self.archive()
        setup = self.root / "setup"
        data = self.root / "data"
        setup.mkdir()
        data.mkdir()
        (setup / "bootstrap.json").write_text("{}")
        (setup / "restore-request.json").write_text(json.dumps({"action": "inspect", "filename": "backup.tar.gz"}))
        commands = []
        def fake_pg(*args):
            commands.append(args)
            if args[0] == "psql":
                return "0"
            if "--single-transaction" in args and fail_import:
                raise ValueError("Simulated interrupted import")
            return ""
        def advance(_):
            current = json.loads((setup / "restore-status.json").read_text())
            if current["phase"] == "ready":
                (setup / "restore-request.json").write_text(json.dumps({"action": "confirm", "confirmation": current["preview"]["confirmation"]}))
            else:
                raise StopLoop()
        with patch.object(runner, "SETUP", setup), patch.object(runner, "DATA", data), patch.object(runner, "BACKUPS", self.root), patch.object(runner, "pg", side_effect=fake_pg), patch.object(runner.time, "sleep", side_effect=advance), patch.object(runner.os, "chown", create=True), patch.object(runner, "portable_settings", return_value={"AUTH_PROVIDER": "authentik"}), patch.dict(runner.os.environ, {"SETUP_MODE": "true", "PGDATABASE": "test"}):
            with self.assertRaises(StopLoop):
                runner.main()
        return setup, data, commands

    def test_worker_inspect_confirm_and_file_restore(self):
        setup, data, commands = self.run_worker()
        self.assertTrue((setup / "restore-applied.json").exists())
        self.assertEqual(json.loads((setup / "restore-status.json").read_text())["phase"], "complete")
        self.assertEqual((data / "branding/image.png").read_bytes(), b"test")
        self.assertTrue(any("--single-transaction" in command for command in commands))
        self.assertTrue((self.root / "backup.tar.gz").exists(), "source archive must remain intact")
        self.assertFalse((setup / "restore-operation.lock").exists())

    def test_interrupted_import_never_marks_restore_complete(self):
        setup, data, _ = self.run_worker(fail_import=True)
        self.assertFalse((setup / "restore-applied.json").exists())
        self.assertTrue((setup / "restore-import-started.json").exists())
        self.assertFalse((data / "branding/image.png").exists())
        self.assertEqual(json.loads((setup / "restore-status.json").read_text())["phase"], "failed")


if __name__ == "__main__":
    unittest.main()
