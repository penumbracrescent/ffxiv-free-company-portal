#!/bin/sh
set -eu
ROOT=${1:-$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)}
DESTINATION=${2:-"$ROOT/backups"}
ENV_FILE="$ROOT/.env"
COMPOSE_FILE="$ROOT/compose.yaml"
[ -f "$ENV_FILE" ] || { echo "No .env file was found in $ROOT." >&2; exit 1; }
[ -f "$COMPOSE_FILE" ] || { echo "No compose.yaml file was found in $ROOT." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required." >&2; exit 1; }
command -v tar >/dev/null 2>&1 || { echo "tar is required." >&2; exit 1; }

mkdir -p "$DESTINATION"
STAMP=$(date -u +%Y%m%d-%H%M%S)
STAGE=$(mktemp -d "$DESTINATION/.cotf-backup-$STAMP-XXXXXX")
ARCHIVE="$DESTINATION/cotf-portal-backup-$STAMP.tar.gz"
cleanup() {
  case "$STAGE" in "$DESTINATION"/.cotf-backup-*) rm -rf -- "$STAGE" ;; esac
}
trap cleanup EXIT INT TERM

cp "$ENV_FILE" "$STAGE/installation.env"
cp "$COMPOSE_FILE" "$STAGE/installation-compose.yaml"
docker compose --project-directory "$ROOT" -f "$COMPOSE_FILE" exec -T db sh -c 'rm -f /tmp/cotf-portal.dump && pg_dump -Fc --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tmp/cotf-portal.dump'
docker compose --project-directory "$ROOT" -f "$COMPOSE_FILE" cp db:/tmp/cotf-portal.dump "$STAGE/portal.dump"
docker compose --project-directory "$ROOT" -f "$COMPOSE_FILE" exec -T db rm -f /tmp/cotf-portal.dump >/dev/null

mkdir -p "$STAGE/data"
if [ -d "$ROOT/data" ]; then
  cp -R "$ROOT/data/." "$STAGE/data/"
  rm -rf "$STAGE/data/setup"
fi
cat > "$STAGE/manifest.json" <<EOF
{"format":"cotf-portal-backup","version":1,"createdAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","database":"portal.dump","environment":"installation.env","compose":"installation-compose.yaml","data":["*"],"excluded":["data/setup","backups"],"warning":"Contains private credentials and community data. Store securely."}
EOF
tar -czf "$ARCHIVE" -C "$STAGE" .
[ "$(wc -c < "$ARCHIVE")" -ge 1024 ] || { echo "The backup archive is unexpectedly small." >&2; exit 1; }
echo "Backup created: $ARCHIVE"
echo "WARNING: This archive contains the database, service credentials, member data, and private tokens. Treat it like a password."
