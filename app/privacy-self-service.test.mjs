import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("member privacy controls are self-scoped and durable", async () => {
  const [page, route, privacy, auth, bot, commands, worker, achievements, compose] = await Promise.all([
    readFile(new URL("app/app/page.tsx", root), "utf8"),
    readFile(new URL("app/app/api/privacy/me/export/route.ts", root), "utf8"),
    readFile(new URL("app/lib/privacy-requests.ts", root), "utf8"),
    readFile(new URL("app/auth.ts", root), "utf8"),
    readFile(new URL("bot/bot.mjs", root), "utf8"),
    readFile(new URL("bot/fae-commands.mjs", root), "utf8"),
    readFile(new URL("worker/worker.mjs", root), "utf8"),
    readFile(new URL("worker/achievement-collections.mjs", root), "utf8"),
    readFile(new URL("compose.yaml", root), "utf8")
  ]);
  assert.match(page, /Download My Data/);
  assert.match(page, /DELETE MY PORTAL DATA/);
  assert.match(page, /primary portal officer cannot opt out/i);
  assert.match(page, /isPrivacySuppressed\(client, discordUserId\)/);
  assert.match(route, /session\?\.user\?\.discordUserId/);
  assert.match(route, /isPrivacySuppressed/);
  assert.match(privacy, /portal_privacy_suppressions/);
  assert.match(privacy, /privacy_full_opt_out/);
  assert.match(privacy, /PORTAL_PRIMARY_ADMIN_DISCORD_ID/);
  assert.match(privacy, /anonymizeSharedCraftingAttribution/);
  assert.match(privacy, /subjectAnchorCharacterId/);
  assert.match(privacy, /records\.portal_characters/);
  assert.match(privacy, /additionalIds=allCharacterIds\.filter/);
  assert.match(privacy, /created_by_discord_user_id=null/);
  assert.match(privacy, /subject_fingerprint=\$2/);
  assert.match(auth, /privacySuppressed/);
  assert.match(bot, /cotf_privacy_optin/);
  assert.match(bot, /cotf_officer_verify_once/);
  assert.match(bot, /executePrivacyFullOptOut/);
  assert.match(commands, /Manage My Data/);
  assert.match(worker, /suppressedFingerprints/);
  assert.match(worker, /privacy_mode='verification_only'/);
  assert.match(achievements, /privacy_mode='verification_only'/);
  assert.ok((compose.match(/PRIVACY_SUPPRESSION_SECRET/g) || []).length >= 3);
});

test("retention deidentifies former members and successful command logs are anonymous", async () => {
  const [worker, commands, shares, page, privacyPage, security] = await Promise.all([
    readFile(new URL("worker/worker.mjs", root), "utf8"),
    readFile(new URL("bot/fae-commands.mjs", root), "utf8"),
    readFile(new URL("bot/share-commands.mjs", root), "utf8"),
    readFile(new URL("app/app/page.tsx", root), "utf8"),
    readFile(new URL("app/app/privacy/page.tsx", root), "utf8"),
    readFile(new URL("SECURITY.md", root), "utf8")
  ]);
  assert.match(worker, /fc_membership_status='retention_expired'/);
  assert.match(worker, /lodestone_character_id=null/);
  assert.match(worker, /portal_discord_roster_overrides/);
  assert.match(worker, /portal_fc_roster_change_log/);
  assert.match(worker, /former character record\(s\) deidentified/);
  assert.match(worker, /fc_membership_status not in \('retention_expired', 'privacy_opt_out'\)/);
  for (const source of [commands, shares]) {
    assert.match(source, /identified[^\n]*outcome[^\n]*failure/);
    assert.match(source, /alter column discord_user_id drop not null/);
    assert.match(source, /where outcome='success'/);
    assert.match(source, /portal_privacy_suppressions/);
  }
  assert.match(page, /create table if not exists portal_discord_action_queue \([\s\S]*?discord_user_id text not null/);
  assert.match(page, /create table if not exists portal_command_diagnostics \([\s\S]*?discord_user_id text,/);
  assert.match(page, /fc_membership_status not in \('retention_expired', 'privacy_opt_out'\)/);
  assert.match(page, /'Anonymous member'/);
  assert.match(privacyPage, /Successful Discord commands are logged anonymously/);
  assert.match(security, /Report a vulnerability/);
});

test("only the true setup primary is sealed while secondary administrators remain removable", async () => {
  const [auth, page, finalize, compose, polls] = await Promise.all([
    readFile(new URL("app/auth.ts", root), "utf8"),
    readFile(new URL("app/app/page.tsx", root), "utf8"),
    readFile(new URL("installer/finalize.mjs", root), "utf8"),
    readFile(new URL("compose.yaml", root), "utf8"),
    readFile(new URL("bot/polls.mjs", root), "utf8")
  ]);
  assert.match(auth, /primaryInstallationAdminId[\s\S]*configuredInstallationAdminIds\[0\]/);
  assert.match(page, /legacySecondaryAdministratorsMigratedV1/);
  assert.match(page, /Setup-added secondary administrators appear below and can be removed/);
  assert.match(page, /const primaryIds = new Set\(installationPrimaryAdminDiscordId/);
  assert.match(finalize, /PORTAL_ADMIN_DISCORD_IDS: setup\.adminDiscordId/);
  assert.ok((compose.match(/PORTAL_PRIMARY_ADMIN_DISCORD_ID/g) || []).length >= 2);
  assert.match(polls, /PORTAL_PRIMARY_ADMIN_DISCORD_ID/);
});
