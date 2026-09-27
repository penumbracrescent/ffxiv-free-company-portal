# FFXIV Free Company Portal

A self-hosted website and Discord bot for a single Final Fantasy XIV Free Company.

The portal combines member verification, events, polls, collection tracking, community resources, progression guides, officer tools, and Discord integration in one privately operated installation. Each Free Company deploys its own containers, database, Discord application, credentials, and branding.

> This is an unofficial, non-commercial community project. It is not affiliated with, endorsed by, or sponsored by Square Enix.

## Features

### Members and Discord

- Discord OAuth sign-in
- Configurable Discord bot and slash-command name
- Free Company roster verification through the Lodestone
- Optional temporary guest access
- Officer-assisted verification when roster data is delayed
- Optional additional-character claims
- Configurable welcome messages, roles, and channels
- Member privacy, export, opt-out, and retention controls

### Events and polls

- Website and Discord event creation
- Event signups, role selections, notes, reminders, and waitlists
- Dungeon, trial, raid, treasure-map, farm-party, and custom events
- Single-choice, multiple-choice, ranked, rating, yes/no, and image polls
- Public, private, and fully anonymous ballot modes
- Tie handling, officer resolution, and poll result graphs

### Collections and progression

- Mount, minion, title, and achievement catalogs
- Personal owned and missing collection views
- Mount-party tracking and acquisition notifications
- Crafting, gathering, market, and treasure-map tools
- Searchable guide library with browser-saved checklists

The built-in guide library includes walkthroughs for:

- Zodiac, Anima, Eureka, Resistance, Manderville, and Phantom weapons
- Crafter and gatherer relic tools
- Fishing rods and gathering achievement tools
- Allied Society progression
- Ishgardian Restoration and the Diadem
- Collectables, scrips, folklore, and Custom Deliveries
- Cosmic Exploration
- Eureka, Bozja, Zadnor, Delubrum Reginae, and Occult Crescent
- Achievement, title, mount, and collection goals

### Administration

- Guided browser-based setup
- Custom name, logo, banner, background, and colors
- Officer administration and Discord configuration
- Local-network or public HTTPS operation
- Cloudflare Tunnel, Tailscale Funnel, and reverse-proxy support
- Portable PostgreSQL and persistent-data backups
- Browser-based restoration and migration
- Windows, Linux, and macOS setup launchers

## Requirements

- Docker with Docker Compose
- A modern web browser
- A Discord account with permission to create and install an application in the server
- Encrypted storage for the database, credentials, persistent data, and backups

Node.js and development tools are not required on the Docker host.

## Quick start

Clone or download this repository, then open a terminal in the project directory.

### Windows

```powershell
.\setup.ps1
```

If Windows blocks the script, allow it for the current PowerShell window:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\setup.ps1
```

### Linux or macOS

```sh
sh setup.sh
```

The launcher creates:

- A private `.env` file
- Secure installation secrets
- A one-time setup token
- `SETUP_TOKEN.txt`, containing the token needed by the browser wizard

Never publish `.env`, `SETUP_TOKEN.txt`, credentials, runtime data, or backups.

Start the database and setup portal:

```sh
docker compose up -d --build db portal
```

Open the portal in a browser and enter the token from `SETUP_TOKEN.txt`. The setup wizard will guide you through:

1. Free Company and World settings
2. Discord application and bot configuration
3. Administrator access
4. Roles and channels
5. Portal branding
6. Local or public network access
7. Security and privacy acknowledgements

After the browser confirms that setup was saved, run `setup.ps1` or `setup.sh` again to seal the installation.

Start the complete stack:

```sh
docker compose up -d --build
```

## Discord application

Every installation should use its own Discord application.

The setup wizard provides the required redirect URL, scopes, permissions, role choices, and channel choices. For a private Free Company bot:

- Enable **Guild Install**
- Disable **User Install**
- Set the installation link to **None**
- Disable **Public Bot**
- Leave **Requires OAuth2 Code Grant** disabled
- Enable **Server Members Intent**
- Enable **Message Content Intent**
- Select the `bot` and `applications.commands` OAuth scopes

Do not reuse another community’s bot credentials.

## Network access

The portal can operate in several ways:

- **Local network only:** No router port forwarding is required.
- **Cloudflare Tunnel:** Publishes the portal through a domain managed by Cloudflare.
- **Tailscale Funnel:** Provides a public HTTPS address without ordinary port forwarding.
- **Existing reverse proxy:** Supports Caddy, Nginx Proxy Manager, Traefik, Synology Reverse Proxy, and similar systems.
- **Configure later:** Completes setup using local access until a public address is ready.

Public installations must use HTTPS. The configured portal URL, authentication URL, and Discord OAuth callback must use the same public address.

Credentials for tunnels and authentication providers belong in the private `.env` file and must never be committed.

## Authentication

Direct Discord OAuth is the default authentication method and does not require Authentik.

Authentik can be configured as an advanced alternative by changing the authentication settings in `.env` and recreating the affected containers.

## Backups

Create a backup before updates, migrations, or major configuration changes.

### Windows

```powershell
.\backup.ps1
```

### Linux or macOS

```sh
./backup.sh
```

Administrators can also create a portable backup from **Officer Area → Backup & Recovery**.

Backups may contain:

- Passwords and tokens
- Discord and portal configuration
- Member records and preferences
- Uploaded branding
- Galleries and other persistent content
- Anime and calendar credentials
- Database records

Store every backup securely and never publish it.

See [BACKUP_SCOPE.md](BACKUP_SCOPE.md) for the audited inclusion and exclusion list.

## Restoring or migrating

For a fresh installation, use **Restore from backup** on the first browser setup page. Upload a portable backup or select one from the shared backup directory, confirm the preview, and review the restored settings before sealing the installation.

Keep the original installation and backup until the restored portal has been verified.

See [BROWSER_RESTORE.md](BROWSER_RESTORE.md) for the complete restoration workflow.

## Updating

Create a backup first. Preserve:

- `.env`
- The `data` directory
- The `backups` directory
- The Docker-managed PostgreSQL volume

Do not replace a working `.env` with `.env.example`.

After updating the application files:

```sh
docker compose up -d --build
```

Recreating containers loads updated environment values. Merely restarting existing containers does not.

> Do not run `docker compose down -v` on an installation whose database must be retained. The `-v` option removes the project’s Docker volumes and stored database data.

## Security and privacy

Before inviting members:

1. Open **Officer Area → Legal & Privacy**.
2. Enter and verify the public operator and contact information.
3. Place the resulting `/privacy` URL in the Discord Developer Portal.
4. Confirm that the database, `data` directory, and backups reside on encrypted storage.
5. Verify HTTPS and then enable HSTS at the tunnel or reverse-proxy edge.
6. Review Discord roles, channel permissions, administrator access, and retention settings.

Please read:

- [Security policy](SECURITY.md)
- [Legal and content notice](LEGAL_NOTICE.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
- [Backup scope](BACKUP_SCOPE.md)
- [Release readiness](RELEASE_READINESS.md)

## Reporting problems

Use [GitHub Issues](https://github.com/penumbracrescent/ffxiv-free-company-portal/issues) for reproducible bugs and feature requests.

When reporting a problem:

- Describe what you expected to happen.
- Describe what actually happened.
- Include the affected portal feature.
- Include relevant container logs with credentials and personal information removed.
- Never post `.env`, tokens, passwords, backup archives, database exports, or member records.

## Contributing

Constructive bug reports, documentation improvements, and pull requests are welcome.

Before submitting code changes:

- Keep installation-specific data and credentials out of commits.
- Run the relevant tests.
- Confirm that the production application build succeeds.
- Update documentation when behavior or setup requirements change.

## License

Original project code and documentation are available under the [MIT License](LICENSE).

The MIT License does not grant rights to FINAL FANTASY XIV material, third-party packages, external services or API data, installation branding, or member uploads. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [LEGAL_NOTICE.md](LEGAL_NOTICE.md).

FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd. FINAL FANTASY XIV copyrighted materials are © SQUARE ENIX.
