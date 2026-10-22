# October 2026 security maintenance

- Portal: Next.js 16.4.2 and React / React DOM 19.2.9.
- Bot: Sharp 0.35.5, with patched Undici in its lockfile.
- Portal lockfile includes patched source-map-js.
- Node-based Docker services use Node.js 24.22.1 Alpine images.
- CI uses maintained actions, an explicit Ubuntu 24.04 runner, and Node.js
  24.22.1. Login and timed-gathering tests are included.

Build with `docker compose build --pull` before recreating services. Restarting
an old container alone does not update its runtime or application dependencies.
Retain backups, configuration and database volumes during upgrades; do not run
`docker compose down -v` as part of an update.

These versions are a dated maintenance baseline, not a promise that future
vulnerabilities do not exist. Continue checking upstream security advisories.

Sources: [Next.js October security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026)
and [Node.js October security releases](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases).
