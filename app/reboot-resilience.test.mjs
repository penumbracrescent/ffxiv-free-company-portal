import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Tailscale remains in the Synology project and repairs its proxy target at startup", async () => {
  const [compose, wrapper, finalize, powershell] = await Promise.all([
    readFile(new URL("compose.yaml", root), "utf8"),
    readFile(new URL("tailscale/start.sh", root), "utf8"),
    readFile(new URL("installer/finalize.mjs", root), "utf8"),
    readFile(new URL("setup.ps1", root), "utf8")
  ]);
  const tailscaleService = compose.match(/\n  tailscale:\n([\s\S]*?)(?=\n  cloudflare:)/)?.[1] || "";
  assert.match(tailscaleService, /restart: always/);
  assert.match(tailscaleService, /ACCESS_MODE: \$\{ACCESS_MODE:-local\}/);
  assert.match(tailscaleService, /TAILSCALE_TAILNET: \$\{TAILSCALE_TAILNET:-\}/);
  assert.doesNotMatch(tailscaleService, /profiles:/);
  assert.match(wrapper, /access_mode.*ACCESS_MODE/);
  assert.match(wrapper, /http:\/\/portal:3000/);
  assert.match(wrapper, /certificate_domain/);
  assert.match(finalize, /setup\.accessMode === "cloudflare" \? "cloudflare" : ""/);
  assert.match(powershell, /\$accessMode -eq 'cloudflare'/);
  assert.doesNotMatch(powershell, /\$accessMode -eq 'tailscale'\) \{ 'tailscale'/);
});

test("the release uses a predictable project-isolated firewall subnet", async () => {
  const [compose, example] = await Promise.all([
    readFile(new URL("compose.yaml", root), "utf8"),
    readFile(new URL(".env.example", root), "utf8")
  ]);
  assert.match(compose, /subnet: \$\{DOCKER_NETWORK_SUBNET:-172\.30\.60\.0\/24\}/);
  assert.match(example, /DOCKER_NETWORK_SUBNET='172\.30\.60\.0\/24'/);
  assert.doesNotMatch(compose, /name:\s*cotf-portal_default/);
});

test("scheduler and bot wait through Docker network and PostgreSQL recovery", async () => {
  const [schedule, bot] = await Promise.all([
    readFile(new URL("anime-schedule/src/index.mjs", root), "utf8"),
    readFile(new URL("bot/bot.mjs", root), "utf8")
  ]);
  assert.match(schedule, /57P03/);
  assert.match(schedule, /ensureSchemaWhenDatabaseIsReady/);
  assert.match(schedule, /PostgreSQL is not ready/);
  assert.match(schedule, /Math\.min\(15000/);
  assert.match(bot, /ENOTFOUND/);
  assert.match(bot, /waitForDatabaseAtStartup/);
  assert.match(bot, /PostgreSQL is not reachable yet/);
  assert.match(bot, /clientReady/);
});

test("worker image includes every runtime module imported by its entrypoint", async () => {
  const [dockerfile, worker] = await Promise.all([
    readFile(new URL("worker/Dockerfile", root), "utf8"),
    readFile(new URL("worker/worker.mjs", root), "utf8")
  ]);
  const localModules = [...worker.matchAll(/from\s+["']\.\/(.+?)["']/g)].map((match) => match[1]);
  assert.ok(localModules.length > 0, "worker entrypoint should exercise the local-module packaging check");
  for (const moduleName of localModules) {
    assert.match(dockerfile, new RegExp(`COPY[^\\n]*\\b${moduleName.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`));
  }
});

test("portal welcome engagement is optional in setup and officer settings", async () => {
  const [compose, example, setupWizard, setupRoute, prefillRoute, finalize, portal, bot] = await Promise.all([
    readFile(new URL("compose.yaml", root), "utf8"),
    readFile(new URL(".env.example", root), "utf8"),
    readFile(new URL("app/app/setup/SetupWizard.tsx", root), "utf8"),
    readFile(new URL("app/app/api/setup/complete/route.ts", root), "utf8"),
    readFile(new URL("app/app/api/setup/prefill/route.ts", root), "utf8"),
    readFile(new URL("installer/finalize.mjs", root), "utf8"),
    readFile(new URL("app/app/page.tsx", root), "utf8"),
    readFile(new URL("bot/bot.mjs", root), "utf8")
  ]);

  assert.match(example, /DISCORD_WELCOME_ENGAGEMENT_ENABLED='false'/);
  assert.match(compose, /DISCORD_WELCOME_ENGAGEMENT_ENABLED: \$\{DISCORD_WELCOME_ENGAGEMENT_ENABLED:-false\}/);
  assert.match(setupWizard, /name="welcomeEngagementEnabled"/);
  assert.match(setupWizard, /Discord's built-in welcome engagement/);
  assert.match(setupRoute, /welcomeEngagementEnabled/);
  assert.match(setupRoute, /welcome_engagement_enabled = excluded\.welcome_engagement_enabled/);
  assert.match(setupRoute, /configuration\.welcomeEngagementEnabled/);
  assert.match(prefillRoute, /DISCORD_WELCOME_ENGAGEMENT_ENABLED/);
  assert.match(finalize, /DISCORD_WELCOME_ENGAGEMENT_ENABLED/);
  assert.match(portal, /welcome_engagement_enabled boolean not null default false/);
  assert.match(portal, /name="welcomeEngagementEnabled"/);
  assert.match(portal, /Discord&apos;s built-in welcome engagement/);
  assert.match(bot, /if \(!settings\.welcome_engagement_enabled\)/);
  assert.match(bot, /Portal welcome engagement is disabled/);
});

test("welcome sticker IDs use a restored mobile editor in setup and officer settings", async () => {
  const [editor, setupWizard, setupRoute, prefillRoute, finalize, powershell, portal] = await Promise.all([
    readFile(new URL("app/app/components/StickerIdEditor.tsx", root), "utf8"),
    readFile(new URL("app/app/setup/SetupWizard.tsx", root), "utf8"),
    readFile(new URL("app/app/api/setup/complete/route.ts", root), "utf8"),
    readFile(new URL("app/app/api/setup/prefill/route.ts", root), "utf8"),
    readFile(new URL("installer/finalize.mjs", root), "utf8"),
    readFile(new URL("setup.ps1", root), "utf8"),
    readFile(new URL("app/app/page.tsx", root), "utf8")
  ]);
  assert.match(editor, /Edit Sticker IDs/);
  assert.match(editor, /＋ Add ID/);
  assert.match(editor, /Save Sticker IDs/);
  assert.match(editor, />Exit</);
  assert.match(editor, /role="dialog"/);
  assert.match(editor, /name=\{name\}/);
  assert.match(setupWizard, /values\.welcomeWaveStickerIds/);
  assert.match(setupWizard, /<StickerIdEditor name="welcomeWaveStickerIds"/);
  assert.match(setupRoute, /welcomeWaveStickerIds: welcomeWaveStickerIds\.join/);
  assert.match(prefillRoute, /databaseWelcomeStickerIds \?\? value\("DISCORD_WELCOME_WAVE_STICKER_IDS"/);
  assert.match(finalize, /typeof setup\.welcomeWaveStickerIds === "string"/);
  assert.match(powershell, /Get-SetupValue \$setup 'welcomeWaveStickerIds'/);
  assert.match(portal, /<StickerIdEditor name="welcomeWaveStickerIds"/);
  assert.match(portal, /Each welcome sticker ID must contain 15 to 22 digits/);
});

test("fresh installations include removable Discord welcome sticker defaults", async () => {
  const [example, setupPowerShell, setupShell, prefillRoute, portal, bot] = await Promise.all([
    readFile(new URL(".env.example", root), "utf8"),
    readFile(new URL("setup.ps1", root), "utf8"),
    readFile(new URL("setup.sh", root), "utf8"),
    readFile(new URL("app/app/api/setup/prefill/route.ts", root), "utf8"),
    readFile(new URL("app/app/page.tsx", root), "utf8"),
    readFile(new URL("bot/bot.mjs", root), "utf8")
  ]);
  for (const source of [example, setupPowerShell, setupShell, prefillRoute, portal, bot]) {
    assert.match(source, /816087792291282944/);
    assert.match(source, /831571726223540294/);
  }
  assert.match(bot, /process\.env\.DISCORD_WELCOME_WAVE_STICKER_IDS \?\? DEFAULT_WELCOME_WAVE_STICKER_IDS/);
  assert.match(bot, /row\.welcome_wave_sticker_ids \?\? DEFAULT_BOT_SETTINGS\.welcome_wave_sticker_ids/);
  assert.match(portal, /row\s*\? String\(row\.welcome_wave_sticker_ids \?\? ""\)/);
  assert.match(prefillRoute, /databaseWelcomeStickerIds \?\?/);
});

test("officers can queue a safe Discord name match separately from the roster audit", async () => {
  const [portal, bot, styles] = await Promise.all([
    readFile(new URL("app/app/page.tsx", root), "utf8"),
    readFile(new URL("bot/bot.mjs", root), "utf8"),
    readFile(new URL("app/app/globals.css", root), "utf8")
  ]);

  assert.match(portal, /async function queueDiscordNameMatch/);
  assert.match(portal, /'__guild_name_match__'/);
  assert.match(portal, /'match_discord_names'/);
  assert.match(portal, /Queue Discord Name Match/);
  assert.match(portal, /formAction=\{queueDiscordNameMatch\}/);
  assert.match(portal, /unambiguous exact/);
  assert.match(bot, /async function executeDiscordNameMatch/);
  assert.match(bot, /autoMatchMemberByDisplayName\(member, "queued_name_match"\)/);
  assert.match(bot, /action\.action_type === "match_discord_names"/);
  assert.match(bot, /alreadyLinkedIds\.has\(member\.id\)/);
  assert.match(bot, /executeDiscordRosterScan\(action, settings, guild\)/);
  assert.match(styles, /\.discord-roster-scan-buttons/);
});

test("Discord character link conflicts are blocked, announced, and safely resolvable", async () => {
  const [portal, component, styles, bot] = await Promise.all([
    readFile(new URL("app/app/page.tsx", root), "utf8"),
    readFile(new URL("app/app/components/DiscordLinkAssignmentForm.tsx", root), "utf8"),
    readFile(new URL("app/app/globals.css", root), "utf8"),
    readFile(new URL("bot/bot.mjs", root), "utf8")
  ]);

  assert.match(portal, /async function assignDiscordCharacterLink/);
  assert.match(portal, /expectedConflictDiscordUserId/);
  assert.match(portal, /officer_conflict_clear/);
  assert.match(portal, /clearedConflictingDiscordUserId/);
  assert.match(portal, /delete from portal_discord_links where discord_user_id=\$1 and character_id=\$2/);
  assert.match(component, /role="dialog"/);
  assert.match(component, /This character already belongs to another Discord ID/);
  assert.match(component, /Clear Old Link and Assign/);
  assert.match(component, /Replace Link \+ Transfer Verified Role/);
  assert.match(component, /does not remove either Discord member or change their roles/);
  assert.match(styles, /\.discord-link-conflict-backdrop/);
  assert.match(bot, /portal_reject_duplicate_character_link/);
  assert.match(bot, /portal_discord_links_one_character/);
  assert.match(bot, /Character is already linked to a different Discord account/);
  assert.match(bot, /notifyCharacterLinkConflict/);
  assert.match(bot, /a character verification conflict needs review/);
  assert.match(bot, /Keep Existing Link/);
  assert.match(bot, /Replace Link Only/);
  assert.match(bot, /Replace \+ Transfer Role/);
  assert.match(bot, /cotf_link_conflict:/);
  assert.match(bot, /interaction\.followUp/);
  assert.match(bot, /Please contact <@/);
});

test("roster scans use the shared action path and obsolete roster channel routing stays hidden", async () => {
  const [portal, bot] = await Promise.all([
    readFile(new URL("app/app/page.tsx", root), "utf8"),
    readFile(new URL("bot/bot.mjs", root), "utf8")
  ]);
  assert.match(portal, /roster_review_channel_id text not null default ''/);
  assert.doesNotMatch(portal, /name="rosterReviewChannelId"/);
  assert.doesNotMatch(portal, /value="roster_review"/);
  assert.doesNotMatch(bot, /roster_review: settings\.roster_review_channel_id/);
  assert.match(portal, /'scan_discord_roster'/);
  assert.match(bot, /action\.action_type === "scan_discord_roster"/);
  assert.match(bot, /sendDiscordActionResultNotificationSafe/);
  assert.match(bot, /settings\.officer_log_channel_id/);
});

test("each installation publishes and enforces its own privacy policy", async () => {
  const [wizard, complete, privacy, terms, requests, worker, bot, compose, powershell, shell, security] = await Promise.all([
    readFile(new URL("app/app/setup/SetupWizard.tsx", root), "utf8"), readFile(new URL("app/app/api/setup/complete/route.ts", root), "utf8"),
    readFile(new URL("app/app/privacy/page.tsx", root), "utf8"), readFile(new URL("app/app/terms/page.tsx", root), "utf8"),
    readFile(new URL("app/lib/privacy-requests.ts", root), "utf8"), readFile(new URL("worker/worker.mjs", root), "utf8"),
    readFile(new URL("bot/fae-commands.mjs", root), "utf8"), readFile(new URL("compose.yaml", root), "utf8"),
    readFile(new URL("setup.ps1", root), "utf8"), readFile(new URL("setup.sh", root), "utf8"), readFile(new URL("SECURITY.md", root), "utf8")
  ]);
  assert.match(wizard,/Privacy &amp; legal contact/); assert.match(wizard,/name="privacyContact"/); assert.match(complete,/savePrivacySettings/);
  assert.match(privacy,/Google API Services User Data Policy/); assert.match(privacy,/formerMemberRetentionDays/); assert.match(terms,/Events, contests, and giveaways/);
  assert.match(requests,/inspectPrivacySubject/); assert.match(requests,/minimizePrivacySubject/); assert.match(requests,/erasePrivacySubject/); assert.match(requests,/portal_privacy_suppressions/); assert.match(requests,/privacy_full_opt_out/);
  assert.match(worker,/privacy-retention-cleanup/); assert.match(bot,/link\("Privacy Policy","privacy"\)/);
  for (const source of [compose,powershell,shell]) assert.match(source,/PORTAL_PRIVACY_CONTACT/);
  assert.match(security,/Never attach an unredacted/);
});
