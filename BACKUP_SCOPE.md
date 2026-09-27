# Portable backup scope

The portable archive is intended to reproduce all state owned by the portal installation while allowing restoration into a newer release.

## Included

- A transactionally consistent PostgreSQL logical dump of every schema, table, sequence, uploaded database image, preference, audit record, event, member record, Discord identifier, schedule record, and portal setting.
- The complete private `.env`, including generated secrets and configured Discord, Cloudflare, Authentik, reverse-proxy URL, Google Calendar, AnimeSchedule, worker, and portal values.
- Every persistent entry under `data`, including branding uploads, anime tokens and Google service-account JSON, Tailscale configuration and identity state, and future portal-owned persistent folders.
- A snapshot of `compose.yaml` as `installation-compose.yaml`. Restore keeps this under `data/setup/restored-compose.yaml` for comparison; it does not replace the newer release's Compose file automatically.
- A manifest identifying the archive format, creation time, included paths, and exclusions.

## Deliberately excluded

- `data/setup`, `SETUP_TOKEN.txt`, and unfinished setup handoff files. Restore generates a new one-time setup session instead.
- The `backups` folder itself, preventing recursive archives and uncontrolled growth.
- Application source, built images, and dependency caches. Restore is performed into a clean current Public Release so code and bundled guide assets come from that release.
- The raw PostgreSQL volume. The logical dump is portable across hosts and avoids copying database files while PostgreSQL is running.

## External systems

The archive retains the portal-side credentials, IDs, URLs, mappings, and cached records for external integrations. It cannot export account-side configuration or content owned by Synology, Authentik, Discord, Cloudflare, Tailscale control, Google Cloud, Google Calendar, Lodestone, Universalis, or other remote services. Those external objects must still exist and authorize the restored installation.

## Security

Officer-updated logos and banners are stored under
`data/branding/officer-branding`, with their selected URLs in `portal_settings`.
Both are included in the existing backup scope. Replaced files are retained;
changing branding is not a deletion/privacy-erasure operation.

Browser restore is available only during initial setup. It imports supported
portable integration settings but retains the destination's database password,
session secret, Docker project/network configuration, and local portal port.
The full archived environment remains in the original backup. See
`BROWSER_RESTORE.md` for migration, size limits, and final activation steps.

Archives are not encrypted. They contain passwords, OAuth secrets, bot and tunnel tokens, private member data, uploaded images, and service-account credentials. Keep them in access-controlled storage and never commit or publish them.
