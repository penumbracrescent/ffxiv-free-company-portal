import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("portable backup captures logical database, environment, and persistent data", async () => {
  const [powershell, shell] = await Promise.all([readFile(new URL("backup.ps1", root), "utf8"), readFile(new URL("backup.sh", root), "utf8")]);
  for (const source of [powershell, shell]) {
    assert.match(source, /pg_dump -Fc/);
    assert.match(source, /installation\.env/);
    assert.match(source, /installation-compose\.yaml/);
    assert.match(source, /portal\.dump/);
    assert.match(source, /data/);
    assert.match(source, /setup/);
    assert.doesNotMatch(source, /postgres\/data|postgres\\data/);
  }
});

test("restore validates the package and imports before starting setup", async () => {
  const [powershell, shell] = await Promise.all([readFile(new URL("restore.ps1", root), "utf8"), readFile(new URL("restore.sh", root), "utf8")]);
  for (const source of [powershell, shell]) {
    assert.match(source, /cotf-portal-backup/);
    assert.match(source, /pg_restore --clean --if-exists --exit-on-error/);
    assert.match(source, /SETUP_MODE/);
    assert.match(source, /SETUP_TOKEN/);
    assert.match(source, /restore-applied\.json/);
    assert.match(source, /restored-compose\.yaml/);
  }
});

test("setup finalization preserves integrations and exposes restored sticker IDs for review", async () => {
  const [powershell, finalize, prefill, compose] = await Promise.all([
    readFile(new URL("setup.ps1", root), "utf8"),
    readFile(new URL("installer/finalize.mjs", root), "utf8"),
    readFile(new URL("app/app/api/setup/prefill/route.ts", root), "utf8"),
    readFile(new URL("compose.yaml", root), "utf8")
  ]);
  assert.match(powershell, /Get-SetupValue \$setup 'welcomeWaveStickerIds'/);
  assert.match(finalize, /typeof setup\.welcomeWaveStickerIds === "string"/);
  for (const key of ["AUTH_PROVIDER", "AUTH_AUTHENTIK_ID", "AUTH_AUTHENTIK_SECRET", "AUTH_AUTHENTIK_ISSUER", "CLOUDFLARE_HOSTNAME", "CLOUDFLARE_TUNNEL_TOKEN", "ANIME_GOOGLE_SUB_CALENDAR_ID", "ANIME_GOOGLE_DUB_CALENDAR_ID"]) {
    assert.match(compose, new RegExp(key));
  }
  assert.match(prefill, /authentik:/);
  assert.match(prefill, /cloudflare:/);
  assert.match(prefill, /googleCalendar:/);
  assert.match(prefill, /databaseWelcomeStickerIds \?\? value\("DISCORD_WELCOME_WAVE_STICKER_IDS"/);
});

test("site-requested backups use an isolated helper and shared backup folder", async () => {
  const [compose, runner, page, backupLibrary, setupPowerShell, setupShell, restorePowerShell, restoreShell, backupFolderNotice, gitignore] = await Promise.all([
    readFile(new URL("compose.yaml", root), "utf8"),
    readFile(new URL("backup-service/runner.sh", root), "utf8"),
    readFile(new URL("app/app/page.tsx", root), "utf8"),
    readFile(new URL("app/lib/backups.ts", root), "utf8"),
    readFile(new URL("setup.ps1", root), "utf8"),
    readFile(new URL("setup.sh", root), "utf8"),
    readFile(new URL("restore.ps1", root), "utf8"),
    readFile(new URL("restore.sh", root), "utf8"),
    readFile(new URL("backups/README.txt", root), "utf8"),
    readFile(new URL(".gitignore", root), "utf8")
  ]);
  assert.match(compose, /backup:\s+[\s\S]*context: \.\/backup-service/);
  assert.match(compose, /\.\/backups:\/backups/);
  assert.match(compose, /\.\/data:\/source\/data:ro/);
  assert.match(compose, /\.\/compose\.yaml:\/source\/installation-compose\.yaml:ro/);
  assert.doesNotMatch(compose, /docker\.sock/);
  assert.match(runner, /pg_dump -Fc --no-owner --no-privileges/);
  assert.match(runner, /installation\.env/);
  assert.match(runner, /installation-compose\.yaml/);
  assert.match(runner, /rm -rf "\$stage\/data\/setup"/);
  assert.match(runner, /cotf-portal-backup-\*-job-\$orphaned_job_id\.tar\.gz/);
  assert.match(runner, /status\s*=\s*'completed'/);
  assert.match(page, /Create Backup Now/);
  assert.match(page, /Administrator access is required to create a portable backup/);
  assert.match(backupLibrary, /portal_backup_jobs/);
  assert.match(backupLibrary, /delete from portal_backup_jobs where status in \('completed', 'failed'\)/);
  assert.match(setupPowerShell, /New-Item -ItemType Directory -Path \$backupDirectory -Force/);
  assert.match(restorePowerShell, /New-Item -ItemType Directory -Path \$backupDirectory -Force/);
  assert.match(setupShell, /mkdir -p "\$ROOT\/backups"/);
  assert.match(restoreShell, /mkdir -p "\$ROOT\/backups"/);
  assert.match(backupFolderNotice, /private community data/);
  assert.match(gitignore, /!backups\/README\.txt/);
});
