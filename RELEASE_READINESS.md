# Release readiness

This repository is the sanitized public-edition release candidate. Automated tests, production compilation, privacy controls, release packaging, and secret exclusions have been validated. It may be published for public review; complete the clean-host acceptance checks below before marking a version as a stable release.

Completed in the first conversion pass:

- Private `.env`, database contents, credentials, service-account files, cached builds, and dependencies are excluded.
- Database, session, internal-service, and one-time setup secrets are generated once by the Windows or Linux/macOS launcher.
- Guild configuration is completed in a guided browser wizard rather than a platform-specific terminal questionnaire.
- Windows PowerShell and portable Linux/macOS shell launchers generate bootstrap secrets natively, without requiring Docker on that first step.
- Direct Discord OAuth is the default; Authentik remains optional.
- Guild name, portal URL, slash-command root, logo, banner, background color, accent color, world, data center, and Lodestone URL are installation settings.
- Discord application, server, role, channel, and administrator IDs are no longer embedded in Compose.
- Role and channel assignments use names discovered from Discord during setup, limited to assignable roles and writable visible text channels.
- Compose services no longer use globally fixed container or network names.
- Neutral default artwork replaces installation-specific artwork.
- Browser setup includes local-only, Tailscale Funnel, Cloudflare Tunnel, existing reverse-proxy, and configure-later access paths. Cloudflare is activated through a Compose profile only when selected; the Tailscale helper remains in the project for reliable Synology reboot recovery and idles when not selected.
- Data-center and World choices refresh from the official Lodestone during setup, fall back safely when it is unavailable, and theme colors update a responsive portal preview immediately.
- PostgreSQL and portal health checks hold schema-dependent services until the database and portal schema are ready.
- Optional access containers use their own project-network attachment; Tailscale migrates legacy localhost Serve targets and no longer depends on borrowing the portal container's network namespace during a host reboot.
- Release packaging rejects Windows and macOS metadata files in addition to credentials and runtime data.
- Update, backup, restore, and rollback guidance is included in the installation documentation.
- Branding uploads accept raster image formats only; arbitrary SVG uploads are not accepted.
- Docker builds use frozen pnpm lockfiles for repeatable dependency installation.
- A hierarchical, searchable guide library and original redistributable artwork ship with the application and require no database import.
- Detailed guide checklists persist in the member's browser, and the Firmament, Diadem, Cosmic Exploration, and Zodiac stages include self-contained routes and exact requirements.
- Public legal and third-party notices identify FFXIV Collect as the immediate collection-catalog source, describe Lodestone-derived personal achievement processing and last-known retention, distinguish provider/game material from MIT-licensed code, and apply the September 16, 2026 Square Enix Materials Usage Policy across portal pages, bot responses, catalogs, uploads, branding, and the bundled treasure-map references.
- Every installation now publishes operator-specific `/privacy` and `/terms` pages, requires a reachable privacy contact during setup, preserves those settings through restore/sealing, links them from the portal and Discord `/privacy` command, and provides administrator-only preview, JSON export, and confirmed erasure controls.
- Verified members can export their own data, switch to verification-only mode, or fully opt out from Member Settings. Full opt-out queues Discord role/nickname cleanup and creates one-way suppression records that block automated re-import until explicit opt-in and fresh verification, including officer-posted verification prompts.
- The background worker enforces configured former-member and activity/audit retention periods. Completed event and award integrity is preserved only as deidentified or public-roster-linked history, while member-specific links, preferences, collection ownership, signups, submissions, and diagnostics are removed.
- Baseline anti-framing, content-type, referrer, permissions, and CSP response headers are enabled, and `SECURITY.md` documents private reporting and operator responsibilities.

Required before a stable internet release:

- Complete an end-to-end install on a clean Docker host with a disposable Discord server.
- Open a guide table, an internal guide link, and a persistent checklist; confirm the patch-verification label appears.
- Confirm every guide-card image loads, including Allied Society bases, relic routes, and field-operation progression.
- Exercise both tunnel profiles on a clean Docker host and confirm their public HTTPS URL, OAuth callback, restart behavior, and credential rotation.
- Exercise login, verification, officer access, roster sync, event posting, giveaways, galleries, and collection sync.
- Confirm the Collections menu opens Mount Party Tracker first, preserves Mount/Minion marketboard and progress tabs, and exposes Titles and Achievements without revealing another member's ownership.
- Confirm a complete Lodestone achievement baseline is additive, private or incomplete profiles retain last-known data, and no title/achievement sync creates a Discord message.
- Review the generated public privacy, terms, and legal pages from the deployed footer; submit a disposable member export and erasure request; and confirm the operator's contact, retention choices, backup practice, and intended use comply with local requirements and current provider policies.
- Test verification-only mode and full opt-out with disposable non-admin and secondary-admin accounts. Confirm the primary officer is blocked, secondary admin access is removed, `/fae officer verify` requires explicit opt-in, and a later roster scan does not recreate suppressed data.
- Perform a security review of uploads, OAuth configuration, permissions, and external callbacks.
- Have the license, third-party notices, operator responsibilities, and public legal notice reviewed by qualified counsel if the portal will be commercialized or operated in a jurisdiction with additional requirements.
- Replace remaining internal `cotf`/`fae` implementation labels where useful. They are not user-facing and do not alter the configured guild name or slash command.

Automated validation completed for this release candidate:

- Next.js production compilation and TypeScript checking.
- 62 portal tests covering schema ordering, setup, restore, branding, guides, collections, privacy, Discord settings, mount-notification gating, and reboot resilience.
- 20 Discord bot tests covering giveaway rules, roster overrides, provisional verification, and role safety.
- 3 worker tests covering achievement collection classification and parsing.
- Anime schedule service tests.
- JavaScript syntax checks for the Discord bot and background worker.
- Package scans for credentials, runtime databases, backups, uploaded media, build output, and service-account files.
- GitHub Actions repeats the service tests and production application build on pushes and pull requests.
# Browser restore acceptance gate

The setup-only browser restore workflow is implemented. Before calling a build
production-ready, perform a disposable end-to-end restore on each supported
Docker platform: upload and shared-folder selection, empty-database refusal,
interrupted import, Authentik prefill, final sealing, and post-rebuild access.
Verify originals remain intact, no external actions run during setup, and
archives/runtime data are excluded from release packages. See BROWSER_RESTORE.md.

Automated restore validation covers authorization, request locking, confirmation,
upload and extraction limits, traversal and link rejection, empty-database
refusal, interruption handling, and PowerShell/Node sealing with restored
settings. A stable release should still be exercised with a real disposable
archive and PostgreSQL volume on each claimed Docker platform. Backup privacy,
trusted-source, and dependency notices are included. This validation is not a
legal opinion or a guarantee of compliance.
