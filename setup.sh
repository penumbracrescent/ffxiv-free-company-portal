#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT"
ENV_FILE="$ROOT/.env"
TOKEN_FILE="$ROOT/SETUP_TOKEN.txt"
STATE_DIR="$ROOT/data/setup"
STATE_FILE="$STATE_DIR/bootstrap.json"
INSTALLATION_FILE="$STATE_DIR/installation.json"
mkdir -p "$ROOT/backups"
chmod 700 "$ROOT/backups" 2>/dev/null || true

secret() {
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex "${1:-32}"
  else od -An -N"${1:-32}" -tx1 /dev/urandom | tr -d ' \n'
  fi
}

if [ -f "$INSTALLATION_FILE" ]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is needed only for this final sealing step. Copy the folder to its Docker host, then run setup.sh there." >&2
    exit 1
  fi
  docker run --rm --user "$(id -u):$(id -g)" -v "$ROOT:/install" -w /install node:24-alpine node installer/finalize.mjs
  echo "Configuration sealed. Start the complete portal with:"
  echo "  docker compose up -d --build"
  exit 0
fi

if [ -f "$ENV_FILE" ]; then
  if grep -q "^SETUP_COMPLETE='\{0,1\}true'\{0,1\}$" "$ENV_FILE"; then
    echo "Setup is complete. Start or update the portal with:"
    echo "  docker compose up -d --build"
    exit 0
  fi
  if [ ! -f "$STATE_FILE" ]; then
    echo "An unfinished .env exists without setup state. Move it aside before starting a new installation." >&2
    exit 1
  fi
  TOKEN=$(sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$STATE_FILE")
  if [ ! -f "$TOKEN_FILE" ]; then printf '%s' "$TOKEN" > "$TOKEN_FILE"; chmod 600 "$TOKEN_FILE"; fi
else
  umask 077
  mkdir -p "$STATE_DIR" "$ROOT/data/branding" "$ROOT/data/anime" "$ROOT/data/tailscale/config" "$ROOT/data/tailscale/state"
  TOKEN=$(secret 32)
  DB_PASSWORD=$(secret 32)
  AUTH_SECRET_VALUE=$(secret 32)
  PRIVACY_SUPPRESSION_SECRET_VALUE=$(secret 32)
  SERVICE_TOKEN=$(secret 32)
  {
    echo "PORTAL_PORT='9030'"
    echo "PORTAL_NAME='Free Company Portal'"
    echo "PORTAL_SUBTITLE='Free Company Portal'"
    echo "PORTAL_URL='http://localhost:9030/'"
    echo "PORTAL_LOGO_URL='/branding/default-logo.svg'"
    echo "PORTAL_BANNER_URL='/branding/default-banner.svg'"
    echo "PORTAL_BACKGROUND_COLOR='#05000c'"
    echo "PORTAL_ACCENT_COLOR='#9333ea'"
    echo "PORTAL_TILE_COLOR='#120423'"
    echo "PORTAL_OPERATOR_NAME='Free Company Portal'"
    echo "PORTAL_PRIVACY_CONTACT=''"
    echo "PORTAL_OPERATOR_REGION=''"
    echo "PORTAL_FORMER_MEMBER_RETENTION_DAYS='30'"
    echo "PORTAL_ACTIVITY_RETENTION_DAYS='365'"
    echo "PORTAL_BACKUP_RETENTION_DAYS='90'"
    echo "PORTAL_PRIVACY_ADDITIONAL_NOTICE=''"
    echo "POSTGRES_DB='fc_portal'"
    echo "POSTGRES_USER='fc_portal'"
    echo "POSTGRES_PASSWORD='$DB_PASSWORD'"
    echo "DOCKER_NETWORK_SUBNET='172.30.60.0/24'"
    echo "DOCKER_DNS_PRIMARY='8.8.8.8'"
    echo "DOCKER_DNS_SECONDARY='8.8.4.4'"
    echo "AUTH_SECRET='$AUTH_SECRET_VALUE'"
    echo "PRIVACY_SUPPRESSION_SECRET='$PRIVACY_SUPPRESSION_SECRET_VALUE'"
    echo "ANIME_SERVICE_API_TOKEN='$SERVICE_TOKEN'"
    echo "AUTH_URL='http://localhost:9030/'"
    echo "AUTH_TRUST_HOST='true'"
    echo "AUTH_PROVIDER='discord'"
    echo "AUTH_DISCORD_ID=''"
    echo "AUTH_DISCORD_SECRET=''"
    echo "AUTH_AUTHENTIK_ID=''"
    echo "AUTH_AUTHENTIK_SECRET=''"
    echo "AUTH_AUTHENTIK_ISSUER=''"
    echo "PORTAL_ADMIN_DISCORD_IDS=''"
    echo "DISCORD_WELCOME_WAVE_STICKER_IDS='816087792291282944,754108890559283200,749054660769218631,781291131828699156,819128604311027752,751606379340365864,816086581509095424,781323769960202280,819130301702995968,772972089963577354,783787404518883338,831570715471380550,831571726223540294'"
    echo "SETUP_MODE='true'"
    echo "SETUP_COMPLETE='false'"
    echo "SETUP_TOKEN='$TOKEN'"
  } > "$ENV_FILE"
  printf '{"complete":false,"token":"%s","port":"9030","setupUrl":"http://localhost:9030/setup"}\n' "$TOKEN" > "$STATE_FILE"
  printf '%s' "$TOKEN" > "$TOKEN_FILE"
  chmod 600 "$ENV_FILE" "$STATE_FILE" "$TOKEN_FILE"
  chmod 777 "$STATE_DIR" "$ROOT/data/branding" "$ROOT/data/anime"
  echo "Private passwords and the one-time setup code were generated."
fi

echo
echo "On the Docker host, start the setup portal:"
echo "  docker compose up -d --build db portal"
echo
echo "Then open the setup page:"
echo "  http://localhost:9030/setup"
echo "If Docker is on another computer, replace localhost with that computer's address."
echo "Enter the token saved in: $TOKEN_FILE"
echo
echo "After the browser says the configuration was saved, run this setup file once more to seal it."
