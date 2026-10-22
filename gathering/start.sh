#!/bin/sh
set -eu
# Docker may create a fresh bind directory as root; fix only this service's state.
chown node:node /state
chmod 700 /state
if [ -f /state/vapid.json ]; then
 chown node:node /state/vapid.json
 chmod 600 /state/vapid.json
fi
exec su node -s /bin/sh -c 'exec node /gathering/server.mjs'
