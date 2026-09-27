# FFXIV Free Company Portal

A self-hosted portal and Discord bot for a single Final Fantasy XIV Free Company. Each guild deploys its own containers, database, bot application, credentials, branding, and command name.

Before inviting members, open **Officer Area → Legal & Privacy**, verify the public operator/contact details, and place the resulting `/privacy` URL in the Discord Developer Portal. Public installations must use HTTPS; enable HSTS at the reverse proxy or tunnel edge after HTTPS is working. See [SECURITY.md](SECURITY.md) and [LEGAL_NOTICE.md](LEGAL_NOTICE.md).

## Installation

### Officer verification and delayed roster approval

Use `/<configured command> officer verify` (for example, `/fae officer verify`)
to post a single-use verification button in the current channel. Portal administrators
or Discord members with Manage Server permission may post it. Anyone may open it;
the first submitted form consumes and removes the prompt. Opening or cancelling the
form does not consume it. It does not create a new onboarding deadline.

Unmatched character-name submissions offer **Approve pending roster (24h recheck)**
in the configured bot-log channel. Only configured portal administrators can approve.
The submitted name, approver, role change, and 24-hour deadline are saved in PostgreSQL
and included in normal backups. This is provisional Discord access, not a fabricated
FC roster entry or a website-membership bypass.
Approval also cancels any pending onboarding or six-hour guest expiration in the
same database transaction. That cancellation persists across restarts, independently
of the new 24-hour roster recheck. Discord API failures cannot reactivate the old timer.

When due, the bot requests a fresh worker roster scan and runs normal verification
and duplicate-link checks. Access remains active during that scan for at most one
additional hour; successful verification does not interrupt access. Failure or timeout
expires only the role granted by the override, not a preexisting role or a current
linked member's role. Any guest role left behind by an incomplete conversion is also
cleaned up. Success posts the character image in welcome.

Manual character-link corrections supersede delayed verification. Approvals are tied
to the member's specific Discord join time, so leaving and rejoining requires fresh
approval. Failure alerts the primary administrator with **Retry roster check** and
**Close request** buttons. Retry does not extend provisional access; Close frees the
request for a fresh submission. Nobody is automatically kicked by this process.

The bot checks once per minute and resumes overdue work after restart. Discord outages
or missing bot permissions can delay role removal and are logged. Used verification
prompts remain single-use even if deletion fails; persisted cleanup retries removal.

Join greetings and the optional Wave hello/sticker interaction now run on joining,
independently of roster verification. Successful verification does not repeat that greeting.

### Optional additional-character claims

Additional-character claims are disabled by default. Officers can enable them under
**Officer Area → Alt Character Claims & Verification**, choose profile-code-or-officer
approval or officer-only approval, set the code lifetime, and set a global or per-member
cap. The verified FC character remains the membership and access anchor and does not
count against the additional-character cap.

Members use `/<configured command> character` to open a private data-center, world,
and character-name wizard. A pending request appears in the configured officer-log
channel with Approve, Reject, Require Profile Code, and Lodestone controls. Generated
profile codes use the configured command name as their prefix, are case-insensitive,
expire, and are valid for only that request. In profile-code-or-officer mode, expiration
of the optional code does not cancel the pending officer approval. Discord nickname changes
remain an explicit member choice after approval. Character-attributed Discord commands,
sharing, crafting actions, and event RSVPs use the verified character whose name exactly
matches the member's current server nickname (case-insensitive); an unmatched nickname
safely falls back to the FC membership anchor. Event signups retain their original queue
time, notes, and role choices when their displayed character changes. Verified linked
characters can also be selected beside Log out; display and preference settings remain
shared by Discord identity, including the mount-win notification preference.

The worker scans each verified linked profile independently while the FC anchor remains
current. An anchor departure pauses linked profiles and subjects them to the same retention
cycle. Data export, minimization, full opt-out, suppression, and later explicit opt-in cover
the complete linked-character set. Turning the feature off stops new claims without deleting
existing verified links.

Setup's world and data-center selections are shown on the review page and saved as
`DEFAULT_WORLD` and `DEFAULT_DATACENTER` when the launcher seals the configuration.
Run the launcher in the same project folder that Docker uses, then **recreate the
containers**; restarting existing containers does not reload their environment.
These values drive roster matching, character world labels, and market comparisons.
Generated FC information follows the configured world/name, while customized copy
is preserved. Legacy default text is recognized by exact matching; text that was
edited to something else is not rewritten.

For an already-sealed installation with incorrect values, correct those two entries
in that project's private `.env` and recreate the containers. Rebuilding application
images alone cannot infer which world the operator originally intended. No database
deletion or restore is needed.

Requirements:

- Docker with Docker Compose
- A modern web browser

You do not need Node.js or development tools on the Docker host. Use the supplied PowerShell launcher on Windows or the shell launcher on Linux to prepare setup; the portal and restore helper run in Docker.

On Windows, open PowerShell in the portal folder and run:

```powershell
.\setup.ps1
```

If Windows blocks local scripts, allow only this PowerShell window and try again:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\setup.ps1
```

On Linux or macOS, open a terminal in the portal folder and run:

```sh
sh setup.sh
```

The launcher generates the database password, login-session secret, internal service token, and a one-time setup token. The token is also written to `SETUP_TOKEN.txt` beside `.env`. The launcher does not require or start Docker. Do not publish either private file.

The Docker Compose project name is intentionally left to the Docker host or management interface. This keeps command-line maintenance aligned with project names chosen by systems such as Synology Container Manager.

Next, on the Docker host, start only the database and setup portal:

```sh
docker compose up -d --build db portal
```

Open the setup page (or simply visit the portal while setup mode is active) and enter the token from `SETUP_TOKEN.txt`. Complete the browser wizard. When the browser confirms that the configuration was saved, run `setup.ps1` or `setup.sh` once more to seal it. Windows may run `setup.ps1` against a local folder or mapped network share without Docker; Linux/macOS should run `setup.sh` on the Docker host. Sealing activates the saved settings and removes the token file. Then start the complete installation:

```sh
docker compose up -d --build
```

The browser setup explains how to create a separate Discord application and bot, displays the exact OAuth redirect URL, and asks for the new application's values only after they exist. For a private guild bot, keep **Guild Install** enabled, disable **User Install**, and set **Installation - Install Link** to **None** before disabling **Public Bot**. Leave **Requires OAuth2 Code Grant** disabled. Under **Bot - Privileged Gateway Intents**, enable both **Server Members Intent** and **Message Content Intent**. In **OAuth2 - URL Generator**, select exactly the **bot** and **applications.commands** scopes. Then select the bot permissions listed by the wizard and use the generated URL from the owner account for the initial guild installation.

The internet-facing containers use configurable public DNS resolvers, defaulting to Google DNS (`8.8.8.8` and `8.8.4.4`) for compatibility with Docker hosts such as Synology. Override `DOCKER_DNS_PRIMARY` and `DOCKER_DNS_SECONDARY` in `.env` if the host network requires different resolvers. Setup reports DNS, timeout, HTTP, and general outbound-connection failures separately instead of returning a generic fetch error.

After the bot is connected, the setup site retrieves the roles and writable channels it can use and presents them as named dropdowns. Raw role and channel IDs are not required. More specialized channel choices remain available later under **Officer Area > Discord Bot Settings**.

Direct Discord OAuth setup accepts one primary administrator and optional additional Discord user IDs. After installation, administrators can add or remove additional Discord OAuth administrators under **Officer Area > Portal Administrators**. Primary sealed-installation administrators remain protected from removal through the web form.

Setup also asks for the Free Company name, access method, portal URL, slash-command name, background and accent colors, and logo and banner uploads. The data-center and World selectors refresh from the official Lodestone when setup opens, with a verified built-in list available when the Lodestone cannot be reached. A live mock portal previews the chosen colors before setup continues. Uploaded branding is retained under `data/branding` across container rebuilds. The hourly marketboard scan uses that selected home data center/world as the separate fourth comparison below the three lowest North American listings.

Running the launcher again before the wizard is complete simply reprints the setup page and token-file location. It never replaces the generated secrets.

The public Discord command can be any valid lowercase command name up to 32 characters. Choosing `leaf`, for example, registers `/leaf` with the existing portal subcommands.

Discord command usage is privacy-minimized. Successful commands and component interactions are recorded without the member's Discord identity, display name, or linked character; anonymous per-command totals support usage review. Failed interactions retain the member and linked-character identity for troubleshooting and are automatically removed with the 30-day diagnostic history. The public installation privacy policy discloses this distinction.

Discord's developer terms require API data to be encrypted at rest. Before admitting members, place the Docker/PostgreSQL volume, `data` folder, and `backups` folder on encrypted host storage. On Synology, use an encrypted volume or encrypted shared folder that actually contains Docker's volume data and both bind-mounted folders; encrypting only the release source directory is not sufficient. Protect exported or copied backups separately as well. The setup wizard records the operator's acknowledgement, but containers cannot reliably detect whether the NAS, filesystem, or backup destination is encrypted.

Officers can create durable single-choice, multiple-choice, ranked, rating, yes/no, and image polls from the **Polls** page and select any writable Discord channel. Ballots require both a current FC character link and current Discord membership. Public, private, and fully anonymous ballot modes have distinct identity visibility, and ties can be extended, resolved by an officer, or randomly resolved among the tied options. Disposable test polls use the shared test channel and delete their exact tracked Discord messages before their database records are removed.

Members can use `/<command> event` to privately schedule a dungeon, trial, raid, treasure-map run, farm party, or custom event. The guided Discord flow writes into the same event, signup, and scheduled-post system as the website. It deliberately posts only to the officer-configured event or raid channel; members cannot redirect an event into an arbitrary server channel. Discord does not provide a native date/time picker, so the private details step accepts `MM-DD` for the current year and 24-hour `HH:MM`. The modal identifies the member's saved portal timezone or clearly labels `America/Chicago` as the portal default when no preference has been saved.

Mount-win congratulations are queued while mount ownership is being scanned. The Discord bot releases only acquisitions covered by the latest completed mount ownership run, preventing partial announcements while the worker is still processing members. Private, missing, zero-mount, or temporarily unavailable member profiles are recorded as individual results and do not hold announcements for everyone else. A scan-wide failure or interruption leaves its pending announcements held for the next completed run.

## Built-in guide library

The built-in guide library is versioned with the public release. Every article displays the game patch and review date it was verified against. Articles support compact reference tables, persistent browser checklists, and links between related built-in guides.

After a Final Fantasy XIV content patch, review current-content guides first: Phantom weapons, Occult Crescent, Cosmic Exploration, Dawntrail allied societies, current scrip exchanges, and Custom Deliveries. Update `GUIDE_LIBRARY_PATCH` and `GUIDE_LIBRARY_VERIFIED_ON` in `app/lib/guide-library.ts` only after that review.

Every installation includes a searchable, mobile-friendly guide library from its first start. Guides are arranged as collections and internal articles, so members can browse from a broad topic into the exact level or activity they need without leaving the portal. The initial library covers:

The unified **Collections** menu keeps Mount Party Tracker as the default Mounts view and groups Mounts, Minions, Titles, and Achievements together. Title and achievement catalogs are public; Owned/Missing progress is visible only to the signed-in member for their Discord-linked, current FC character. The worker imports stable catalog records and performs a conservative daily Lodestone achievement scan. Failed, private, empty, or incomplete responses retain the last known ownership, and these trackers do not post Discord notifications. Long-form Achievement & Title Journey guides turn large collection goals into ordered projects without duplicating the live catalog.

- Combat relic weapons from level 50 Zodiac weapons through level 100 Phantom weapons, plus crafter and gatherer relic tools.
- Allied Society (formerly tribal or beast-tribe) progression for combat, crafting, and gathering jobs.
- Ishgardian Restoration, the Firmament, the Diadem, collectables, scrips, folklore, and custom deliveries.
- Cosmic Exploration, its mission systems, and the released Sinus Ardorum, Phaenna, Oizys, and Auxesia destinations.

Detailed walkthrough pages include browser-saved completion checklists, exact quest and service NPC coordinates, required duties and materials, troubleshooting notes, and original route diagrams where a visual sequence is useful. Collection pages are navigation hubs; they do not masquerade as completed walkthroughs.
- Eureka, Bozja, Delubrum Reginae, Zadnor, and the Occult Crescent.

The articles, navigation, search metadata, and original category artwork are application files and therefore appear on a new empty database without an import step. Official Lodestone links are included at the bottom of relevant articles for patch verification, but the core instructions are written to be usable without opening another site. Officers can add installation-specific notes and external resources below the built-in library; those local additions are stored in PostgreSQL.

Temporary guest access is optional and disabled by default. During setup, an installer can enable it, select the guest role, and choose a duration from 1 to 720 hours. Officers can later enable or disable it, change the role, and change the duration under **Officer Area > Discord Bot Settings**. Disabling it removes the guest choice for new joins; already accepted guest access still expires at its originally scheduled time.

## Authentication

Direct Discord OAuth is the default and does not require Authentik. The initial administrator is the Discord user ID entered during setup. Authentik remains available as an advanced provider by changing the authentication values in `.env`.

## Network access

No router port forwarding is required for a portal used only on the local network. Use the Docker host's LAN address and `PORTAL_PORT` in that case.

The release gives each Compose project its own Docker network on `172.30.60.0/24` by default, making Synology firewall rules predictable. If that subnet is already used, change `DOCKER_NETWORK_SUBNET` in `.env` before the first project start. Do not set the network name to another portal's network (for example, `cotf-portal_default`): sharing it would expose duplicate `db` and `portal` service names across installations and can route an installation to the wrong database.

The browser wizard provides four public-access paths in addition to local-only use:

- **Tailscale Funnel** supplies a public `*.ts.net` HTTPS address. Visitors do not need Tailscale. Before deployment, enable MagicDNS and HTTPS Certificates under Tailscale DNS. Then open **Access controls > Definitions > Node attributes > Add node attribute**, set **Targets** to `autogroup:member` and **Attributes** to `funnel`, leave IP Pools, App, and Capability empty, and save. Do not use the General access rule form; the headless container may not display an interactive approval prompt. Setup asks for the machine name, tailnet DNS name, and a one-time non-ephemeral auth key. The Tailscale helper is a normal member of the Compose project so Synology restarts it with the group; it remains dormant when Tailscale was not selected. Its enrolled identity persists under `data/tailscale/state`. On every start, the helper rebuilds its serve configuration from the sealed settings and proxies to the `portal` service by Docker DNS name, automatically repairing older localhost targets. Public DNS can take several minutes to propagate; if the address has appeared in Tailscale but does not open, flush the viewing device's DNS cache before changing the container.
- **Cloudflare Tunnel** publishes a hostname from a domain already managed through Cloudflare without router forwarding. Cloudflare manages tunnels inside the Zero Trust dashboard; being redirected there is expected. The selected Compose profile starts the official `cloudflared` container.
- **Existing reverse proxy** accepts the final public HTTPS URL for an installation that already has Caddy, Nginx Proxy Manager, Traefik, or another proxy/tunnel.
- **Configure later** finishes with local access. The portal URL and the matching Discord OAuth redirect must both be updated before members use a later public address.

Tunnel credentials are stored in the private `.env` beside the existing bot and OAuth secrets; never publish that file. `COMPOSE_PROFILES` is set automatically during sealing for the optional Cloudflare helper. The Tailscale helper is always included for reliable Synology project restarts, but stays idle unless Tailscale was selected. Tailscale Funnel can require a one-time browser approval after its first start.

### Cloudflare Tunnel sequence

1. Confirm the domain is listed as **Active** in the Cloudflare Websites dashboard. A domain owned through another registrar must have its DNS connected to Cloudflare before it can be selected for a tunnel route.
2. In Cloudflare Zero Trust, open **Networking > Tunnels**, choose **Create tunnel**, select **Cloudflared**, enter a descriptive tunnel name, and save it.
3. Select the **Docker** connector. Copy only the long private value after `--token` from Cloudflare's sample command. Do not run the sample command: this release starts its own `cloudflared` container.
4. Enter the intended public hostname and copied token in the portal setup wizard. If Cloudflare is waiting for a connector, continue portal setup; the connector cannot become healthy until the installation is sealed and the complete Compose stack starts.
5. Run the sealing script and start or rebuild the complete stack. Return to **Networking > Tunnels** and wait for the tunnel to report **Healthy**.
6. Open the tunnel, choose **Routes > Add route > Published application**, select the exact hostname entered during portal setup, leave the path blank, and use `http://portal:3000` as the service URL.
7. Save the route and verify the public HTTPS address. No router port forwarding is required. A separate Cloudflare Access application is optional and is not required for the portal's Discord sign-in.

For a conventional reverse proxy, normally only TCP port 443 is forwarded to the proxy; the portal's raw HTTP port should remain private. The configured `PORTAL_URL`, `AUTH_URL`, and Discord OAuth callback must all use the same public address. Firewall and router changes are not performed automatically.

## Backups and recovery

The PostgreSQL database is stored in the Docker-managed `portal_postgres_data` volume. The visible `data` directory stores branding, setup handoff data, anime credentials, and optional tunnel state; it is not the PostgreSQL database.

### Create one portable backup

The included launcher creates one timestamped `.tar.gz` package containing a logical dump of every PostgreSQL table, the complete installation `.env`, every persistent entry under `data` except the temporary setup handoff, and a reference copy of the installation's `compose.yaml`. This includes branding uploads, anime credentials/tokens, Google service-account JSON, Tailscale configuration/state, and future portal-owned persistent data folders. Because the complete environment is preserved, it also carries the portal-side Cloudflare tunnel token/hostname, Authentik provider route and credentials, Synology reverse-proxy portal URL, Google calendar IDs and options, Discord settings, and hidden values such as welcome-wave sticker IDs. It deliberately does not copy a raw `postgres` directory or recursively include prior backups. See [BACKUP_SCOPE.md](BACKUP_SCOPE.md) for the audited inclusion and exclusion list.

External account configuration is not stored inside the portal and therefore cannot be exported: Synology's reverse-proxy rule, Authentik's server-side provider/application, Cloudflare's account-side tunnel definition, and the Google calendars remain in their respective systems. Keep those external objects in place or recreate them separately; the restored portal retains the credentials and URLs needed to reconnect.

```powershell
.\backup.ps1
```

```sh
chmod +x backup.sh
./backup.sh
```

The archive is written under `backups`. It contains passwords, tokens, member records, personal preferences, galleries, join dates, channel configuration, and other private community data. Store it securely and never publish it.

After the completed stack is running, portal administrators can also open **Officer Area → Backup & Recovery** and select **Create Backup Now**. A dedicated helper creates the same portable archive without granting the website access to the Docker engine. The resulting file is written into the shared `backups` folder beside `compose.yaml`, and its pending, completed, or failed status is recorded on the page. Refresh the panel to see completion. Host-script backups remain supported but are not added retroactively to the on-site history.

### Migrate into a fresh public release

Create the archive from the working old installation while its database is healthy. Copy the untouched archive beside a newly extracted public release. Do not run normal first-time setup or create a replacement `.env` first.

```powershell
.\restore.ps1 -BackupPath '.\cotf-portal-backup-YYYYMMDD-HHMMSS.tar.gz'
```

```sh
chmod +x restore.sh
./restore.sh ./cotf-portal-backup-YYYYMMDD-HHMMSS.tar.gz
```

Restore validates the package, imports the logical database into the new project's PostgreSQL volume, copies all persistent data, generates a new one-time setup token, and starts the setup portal. The wizard identifies the migration and prefills the prior portal, network, Discord, role, channel, world, branding, and administrator settings for review. Finishing setup preserves environment-only settings such as welcome-wave sticker IDs. When present, the old Compose snapshot is retained as `data/setup/restored-compose.yaml` for reviewing custom network or host adjustments; it never replaces the current release's Compose file automatically.

Restore refuses a folder that already has `.env` unless an explicit force flag is supplied. Prefer a genuinely fresh release directory. Keep the old installation and original archive intact until the migrated site has been checked.

After migration, verify several known member join dates, a community-gallery entry, personal notification preferences, configured feature channels, welcome-wave stickers, scheduled events, and administrator access.

## Updates

Create a database backup first. Keep `.env`, the `data` directory, and the Docker-managed PostgreSQL volume when replacing application files. Never overwrite a working `.env` with `.env.example`. Then rebuild:

```powershell
docker compose up -d --build
```

Generated secrets are installation secrets. They must persist across updates and must not be generated during ordinary image builds.

PostgreSQL data is kept in a project-scoped Docker volume. Branding uploads and the temporary setup handoff remain in the local `data` directory. Runtime data is intentionally excluded from Git, and `setup.ps1` or `setup.sh` recreates the required folders on a clean clone.

If a test installation is restarted with a newly generated `.env` but an old project database volume remains, PostgreSQL will reject the new password. For a disposable test installation only, stop the project and remove its project-scoped database volume before starting it again. From the project folder, `docker compose down -v` removes that installation's database volume and all data in it; do not use this command for an installation whose data must be retained.

Google Calendar integration for the anime service is disabled by default. Advanced installations can add a private credential mount later when enabling that integration; no empty secrets folder is required for first startup.

The Officer Area Anime Calendar panel includes the complete source and Google setup sequence. Create an AnimeSchedule application token and save it in the officer panel; the private schedule service stores it under `data/anime/anime-schedule-token` so it survives rebuilds. Setting `ANIME_SCHEDULE_TOKEN` in `.env` remains available as a manual alternative. Google synchronization uses `data/anime/google-service-account.json`, separate SUB and DUB calendar IDs, and a dry-run-first workflow. Anime and Google action buttons remain disabled until their required configuration is visible to the schedule service, and action errors return to the panel instead of replacing the page. Discord anime Scheduled Event creation and reconciliation can be enabled or disabled live under Officer Tools → Discord Bot Settings; `ANIME_DISCORD_ENABLED` supplies only the initial fallback for installations that have not saved the officer setting yet. Disabling the live setting leaves existing Discord events in place.

Members can run `/<configured-command> animeschedule` to open a private Discord schedule panel for today and move through the next 30 calendar days. Only the person who ran the command can see and operate the panel; Discord renders each release timestamp in that person's local timezone.

### Calculator issue reports

Every calculator identifies its data source, review date, and whether its result is exact or estimated. The optional report form never sends telemetry or writes to GitHub by itself. When `NEXT_PUBLIC_CALCULATOR_ISSUES_URL` is set to a repository's new-issue page, such as `https://github.com/owner/ffxiv-free-company-portal/issues/new`, the button opens a prefilled issue that the member can review before submitting. Without that setting, the portal copies the same report so it can be sent to an administrator. Reports exclude account tokens, Discord identifiers, and private profile records.

## Maintainer release checks

This repository is the sanitized public distribution. Local credentials, PostgreSQL data, service-account files, uploaded media, dependencies, backups, and build caches are excluded by `.gitignore` and `.dockerignore`. Before publishing a release, review the files staged for commit, run the application, bot, worker, and anime-schedule test suites, and confirm the application production build succeeds. GitHub Actions performs those automated checks for every pull request and push to the default branch.

Review `RELEASE_READINESS.md` for the automated validation record and the clean-host acceptance checks recommended before marking a version stable.

## License and third-party material

Original project code and documentation are available under the [MIT License](LICENSE). That license does not cover FINAL FANTASY XIV materials, third-party packages, external services or API data, installation branding, or member uploads. See [Third-party notices](THIRD_PARTY_NOTICES.md) and the [Legal and content notice](LEGAL_NOTICE.md) before operating or redistributing the portal.

The built-in guide prose and SVG diagrams are original project documentation. Guide pages retain factual verification links, including links to official Square Enix pages and the independently operated Final Fantasy XIV Online Wiki. No wiki article text or wiki-hosted Square Enix images are bundled into the guide library; source and licensing details are recorded in [Third-party notices](THIRD_PARTY_NOTICES.md).

Achievement, title, mount, and minion catalog metadata may come from the independently operated FFXIV Collect public API, while personal achievement ownership comes from information visible on a linked character's public Lodestone profile. API access does not relicense returned game data or images under MIT. Self-hosting operators control the locally stored member records and are responsible for privacy, retention, deletion requests, provider terms, and the current FINAL FANTASY XIV Materials Usage License.

This is an unofficial, non-commercial community project and is not affiliated with, endorsed by, or sponsored by Square Enix. FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd. FINAL FANTASY XIV copyrighted materials are © SQUARE ENIX. The September 16, 2026 Materials Usage Policy applies across the portal and bot—not only to guides—including catalogs, game images and text, Lodestone material, treasure-map references and uploads, Discord posts, and member screenshots. See [Legal notice](LEGAL_NOTICE.md) and [Third-party notices](THIRD_PARTY_NOTICES.md) before enabling monetization or adding audio, video, merchandise, or physical-item workflows.
# Browser-based restoration

For migration into a fresh installation, run setup normally and use **Restore
from backup** on the first browser setup page. Upload a portable archive or
select one from the shared backups folder, confirm the preview, and review the
prefilled wizard. See [BROWSER_RESTORE.md](BROWSER_RESTORE.md) for the complete
workflow, safety requirements, and platform limitations. Standalone restore
scripts remain available as an alternative; do not mix the two workflows.
