#!/bin/sh
set -eu

access_mode="${ACCESS_MODE:-local}"
if [ "$access_mode" != "tailscale" ]; then
  echo "Tailscale access is not selected; keeping the project helper dormant."
  exec sleep 2147483647
fi

serve_config="${TS_SERVE_CONFIG:-/config/serve.json}"
hostname="${TS_HOSTNAME:-fc-portal}"
tailnet="${TAILSCALE_TAILNET:-}"

if [ -n "$tailnet" ]; then
  certificate_domain="${hostname}.${tailnet}"
  temporary_config="${serve_config}.tmp"
  mkdir -p "$(dirname "$serve_config")"
  cat > "$temporary_config" <<EOF
{
  "TCP": {
    "443": {
      "HTTPS": true
    }
  },
  "Web": {
    "${certificate_domain}:443": {
      "Handlers": {
        "/": {
          "Proxy": "http://portal:3000"
        }
      }
    }
  },
  "AllowFunnel": {
    "${certificate_domain}:443": true
  }
}
EOF
  mv "$temporary_config" "$serve_config"
elif [ -f "$serve_config" ]; then
  # Preserve restores made before the tailnet variable existed, while still
  # migrating their former shared-network localhost target.
  temporary_config="${serve_config}.tmp"
  sed -e 's#http://127\.0\.0\.1:3000#http://portal:3000#g' -e 's#http://localhost:3000#http://portal:3000#g' "$serve_config" > "$temporary_config"
  mv "$temporary_config" "$serve_config"
else
  echo "Tailscale Funnel needs TAILSCALE_TAILNET or an existing serve configuration." >&2
  exit 1
fi

exec /usr/local/bin/containerboot
