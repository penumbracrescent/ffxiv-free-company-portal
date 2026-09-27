# Restore through the first setup page

Use a **fresh release folder and fresh database volume**, not an existing live
installation. This workflow is container-based on Windows/Linux Docker,
Synology Container Manager, and supported 64-bit Raspberry Pi Docker hosts.
Platform-specific end-to-end testing is still required; 32-bit Pi images are
not promised by this release.

1. Create and keep a completed portable `.tar.gz` backup from the old site.
2. Stop the old project before the cutover. Keep its files for rollback.
3. Copy clean public-release files into a new folder. Run `setup.ps1` on Windows
   (a mapped NAS share is supported), or `setup.sh` on Linux, to generate the
   fresh configuration and setup token. Do not separately copy old PostgreSQL
   files or an old `.env` into this folder.
   If another Docker project still owns the default subnet, choose an unused
   `DOCKER_NETWORK_SUBNET` in the new `.env` before starting it. Stopping an old
   project does not necessarily remove its network. Do not share its database
   volume with the new installation.
4. Start/build the new project on its Docker host. Starting `db portal` also
   starts the required `restore` helper through Compose dependencies. Full
   project starts are supported: bot, worker, scheduler, and backup processing
   remain paused while `SETUP_MODE=true`.
5. Open `/setup` using the NAS/host address and configured port. Enter the token
   from `SETUP_TOKEN.txt`. On page 1 choose **Restore from backup**.
6. Upload an archive (maximum 2 GiB), or copy it into this new project's
   `backups` folder and choose **Find backups in shared folder**. This second
   method avoids reverse-proxy upload limits. Expanded contents are limited to
   10 GiB and 100,000 archive entries; allow extra free disk space for staging
   and database import. Raw PostgreSQL directories and plain ZIPs are not accepted.
7. Inspect the preview, confirm your authority and the trusted source, and
   choose **Confirm restore**. Keep the project running. Progress is retained
   across browser refreshes; re-enter the setup token if the session expires.
8. Choose **Continue with restored settings**. Review every instruction page,
   test the Discord connection, and confirm the legal acknowledgement.
9. Run the setup file again to seal the configuration, then rebuild/start the
   full project. This is the same final activation step as a new installation;
   no host-side restore command is needed.

## What is preserved

The logical database (including galleries, preferences, join dates, contests,
giveaways, links and settings), persistent `data` files excluding setup state,
and supported integration settings are imported. Authentik, Google Calendar,
Cloudflare and Discord credentials are carried forward when present in the
archive. The new database credentials, session secret, local port, Docker
project identity, and network settings stay local to the new installation.
Existing browser sessions may require a fresh login.

The old Compose file is saved for reference only and is never executed or
installed over the new Compose file. Custom mounts, external networks,
host-specific credential paths and proxy destinations need operator review.
Check that the portal's local port matches the existing reverse-proxy target.
External Authentik providers, reverse-proxy rules, certificates, Discord server
configuration and Google resources are not recreated.

## Safety and recovery

Restore refuses a non-empty destination database, requires the setup token,
serializes setup/restore operations and becomes unavailable once setup is
saved or sealed. The helper has no Docker socket or published network port.
Archives cannot supply links, traversal paths or device files; expansion is
bounded. PostgreSQL import uses a single transaction, but database plus file
restoration is not one atomic operation. If import or file restoration fails,
do not activate the destination. Keep the original archive and start again in
a fresh folder with a fresh database volume. Interrupted staging files may
remain inside the private setup directory for operator cleanup.

Only restore trusted archives: database definitions can execute SQL from the
source database. Validation is not a guarantee of harmless content. Backups are
not encrypted. Keep the backup folder private and review deleted users,
revoked permissions, outstanding queued actions and deletion requests before
reopening a restored site. Never distribute real archives or runtime data with
the public release.
