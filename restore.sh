#!/bin/sh
set -eu
[ "$#" -ge 1 ] || { echo "Usage: ./restore.sh /path/to/cotf-portal-backup.tar.gz" >&2; exit 1; }
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BACKUP=$1
FORCE=${2:-}
ENV_FILE="$ROOT/.env"
COMPOSE_FILE="$ROOT/compose.yaml"
SETUP_DIR="$ROOT/data/setup"
mkdir -p "$ROOT/backups"
chmod 700 "$ROOT/backups" 2>/dev/null || true
[ -f "$BACKUP" ] || { echo "Backup archive not found: $BACKUP" >&2; exit 1; }
[ -f "$COMPOSE_FILE" ] || { echo "compose.yaml not found in $ROOT." >&2; exit 1; }
if [ -f "$ENV_FILE" ] && [ "$FORCE" != "--force" ]; then
  echo "This project already has a .env file. Restore into a fresh release folder, or pass --force deliberately." >&2
  exit 1
fi

mkdir -p "$SETUP_DIR"
STAGE=$(mktemp -d "$SETUP_DIR/.restore-XXXXXX")
cleanup() { case "$STAGE" in "$SETUP_DIR"/.restore-*) rm -rf -- "$STAGE" ;; esac; }
trap cleanup EXIT INT TERM
tar -xzf "$BACKUP" -C "$STAGE"
for required in manifest.json installation.env portal.dump; do
  [ -f "$STAGE/$required" ] || { echo "The backup is incomplete: $required is missing." >&2; exit 1; }
done
grep -q '"format"[[:space:]]*:[[:space:]]*"cotf-portal-backup"' "$STAGE/manifest.json" || { echo "Unsupported backup format." >&2; exit 1; }
grep -q '"version"[[:space:]]*:[[:space:]]*1' "$STAGE/manifest.json" || { echo "Unsupported backup version." >&2; exit 1; }

mkdir -p "$ROOT/data"
if [ -d "$STAGE/data" ]; then
  find "$STAGE/data" -mindepth 1 -maxdepth 1 ! -name setup -exec cp -R {} "$ROOT/data/" \;
fi
cp "$STAGE/installation.env" "$ENV_FILE"
if [ -f "$STAGE/installation-compose.yaml" ]; then cp "$STAGE/installation-compose.yaml" "$SETUP_DIR/restored-compose.yaml"; fi
TOKEN=$(if command -v openssl >/dev/null 2>&1; then openssl rand -hex 32; else od -An -N32 -tx1 /dev/urandom | tr -d ' \n'; fi)
set_env() {
  key=$1 value=$2
  escaped=$(printf '%s' "$value" | tr -d "'\r\n")
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}='${escaped}'|" "$ENV_FILE"
  else
    printf "%s='%s'\n" "$key" "$escaped" >> "$ENV_FILE"
  fi
}
set_env SETUP_MODE true
set_env SETUP_COMPLETE false
set_env SETUP_TOKEN "$TOKEN"
for key in POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD; do
  grep -q "^${key}=" "$ENV_FILE" || { echo "The backup environment is missing $key." >&2; exit 1; }
done
PORT=$(sed -n "s/^PORTAL_PORT=['\"]\{0,1\}\([^'\"]*\).*/\1/p" "$ENV_FILE" | head -n1)
PORT=${PORT:-9030}
CREATED=$(sed -n 's/.*"createdAt"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$STAGE/manifest.json")
printf '{"complete":false,"restored":true,"backupCreatedAt":"%s","token":"%s","port":"%s","setupUrl":"http://localhost:%s/setup"}\n' "$CREATED" "$TOKEN" "$PORT" "$PORT" > "$SETUP_DIR/bootstrap.json"
printf '%s' "$TOKEN" > "$ROOT/SETUP_TOKEN.txt"
chmod 600 "$ENV_FILE" "$SETUP_DIR/bootstrap.json" "$ROOT/SETUP_TOKEN.txt"

docker compose --project-directory "$ROOT" -f "$COMPOSE_FILE" up -d db
attempt=0
until docker compose --project-directory "$ROOT" -f "$COMPOSE_FILE" exec -T db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 30 ] || { echo "PostgreSQL did not become ready." >&2; exit 1; }
  sleep 2
done
docker compose --project-directory "$ROOT" -f "$COMPOSE_FILE" cp "$STAGE/portal.dump" db:/tmp/cotf-portal-restore.dump
docker compose --project-directory "$ROOT" -f "$COMPOSE_FILE" exec -T db sh -c 'pg_restore --clean --if-exists --exit-on-error --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/cotf-portal-restore.dump'
docker compose --project-directory "$ROOT" -f "$COMPOSE_FILE" exec -T db rm -f /tmp/cotf-portal-restore.dump >/dev/null
cp "$SETUP_DIR/bootstrap.json" "$SETUP_DIR/restore-applied.json"
docker compose --project-directory "$ROOT" -f "$COMPOSE_FILE" up -d --build portal
echo "Backup restored. Open http://localhost:$PORT/setup and review the imported settings."
echo "One-time token: $TOKEN"
echo "Keep the original backup until member joins, galleries, settings, channels, and wave stickers are verified."
