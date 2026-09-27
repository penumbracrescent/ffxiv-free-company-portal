# Anime Release Calendar service

This directory is an isolated release-schedule service for the self-hosted Free Company portal. It owns the `anime` PostgreSQL schema. The portal and Discord bot consume its HTTP API and do not scrape or write its tables directly.

## Safe activation order

1. Rebuild the `schedule` and `portal` services. Google and Discord publishing are disabled in `.env`, so this only creates the schema and public page.
2. Create an AnimeSchedule application token and save it from the portal Officer Area. It is persisted at `data/anime/anime-schedule-token`; `ANIME_SCHEDULE_TOKEN` in the root `.env` remains a manual alternative. The adapter is a secondary bootstrap source, not an official publisher source.
3. Run a source dry-run: `docker compose run --rm schedule npm run sync -- --source=animeschedule`. Dry-run is the CLI default.
4. Review counts and timestamps. Apply the database reconciliation with the same command plus `--apply`.
5. Open `/?view=anime` and confirm sub/dub times, platform filters, batch labels, delayed releases, and Central-time DST behavior.
6. Only after those checks, configure and test Google Calendar; enable Discord last.

## Official publisher feeds

`ANIME_OFFICIAL_FEED_URLS` accepts a JSON object such as `{"crunchyroll":"https://approved.example/releases.json"}`. Each feed must be an authorized JSON endpoint returning an array (or `{ "releases": [] }`) with `englishTitle`, `language`, `startsAt`, `episodeNumber`/`episodeLabel`, and optional status, image, URL, duration, aliases, and batch fields. Official adapters have higher reconciliation priority than AnimeSchedule. This keeps source-specific access out of the website and bot and avoids embedding unsupported scraping.

## Google Calendar

Use two dedicated Google Calendars and one service account. Share both calendars with the service-account email using **Make changes to events**, place the credentials JSON at `data/anime/google-service-account.json`, and keep `ANIME_GOOGLE_CREDENTIALS_FILE=/run/anime-secrets/google-service-account.json`. Set `ANIME_GOOGLE_SUB_CALENDAR_ID` to the SUB calendar ID and `ANIME_GOOGLE_DUB_CALENDAR_ID` to the DUB calendar ID. The ID is found in each calendar's **Settings and sharing > Integrate calendar** section.

Keep `ANIME_GOOGLE_ENABLED=false` while entering the IDs. Then set `ANIME_GOOGLE_ENABLED=true` with `ANIME_GOOGLE_DRY_RUN=true` for the first test. The manual endpoint is `POST /api/outputs/google/sync` with the internal token and `{ "dryRun": true }`. Review the independent SUB and DUB counts before setting `ANIME_GOOGLE_DRY_RUN=false`. The public anime page shows separate subscription buttons once the corresponding calendar IDs are configured.

Stored mappings include the destination calendar, so schedule corrections update existing events instead of creating duplicates or crossing between SUB and DUB calendars.

## Discord native Scheduled Events

The existing bot creates native external Scheduled Events only; this module never sends channel posts, pings, DMs, reminders, or summaries. It includes both SUB and DUB releases, labels the language in each event title, and is limited to the next 3 days by default. The bot requires Discord's **Manage Events** permission.

Leave `ANIME_DISCORD_ENABLED=false` until the website and source data are verified. Then set it to `true` and rebuild the bot. Stored mappings make subsequent runs idempotent and allow schedule changes to edit the existing Discord event.

## Operations

- Daily source sync: 4:15 AM `America/Chicago`, DST-aware.
- Startup catch-up: enabled when today's successful run is missing.
- Failed source retry: every 3 hours, maximum 3 attempts; successful source data is preserved.
- Release retention: 365 days. Raw observations: 30 days. Run logs: 30 days.
- Manual full dry-run: `docker compose run --rm cotf-anime-schedule npm run sync`
- Manual one-source apply: `docker compose run --rm cotf-anime-schedule npm run sync -- --source=animeschedule --apply`
- Health: `GET http://cotf-anime-schedule:8080/health` from the Compose network.

## Output policy

The website, Discord output, and Google output show SUB and DUB. Google routes each language to its own calendar. Multi-platform releases remain one release with multiple platform associations. Status values are `confirmed`, `expected`, `delayed`, `unknown`, and `released`.
