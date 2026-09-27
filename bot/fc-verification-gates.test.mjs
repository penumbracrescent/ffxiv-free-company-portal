import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [bot, rosterOverrides, altClaims, portal, setup, worker, eventCommand, polls, giveaways, shareCommands, faeCommands, pollService, giveawayService, giveawayActions, galleryRoute, pollImageRoute, giveawayImageRoute] = await Promise.all([
  readFile(new URL("./bot.mjs", import.meta.url), "utf8"),
  readFile(new URL("./roster-overrides.mjs", import.meta.url), "utf8"),
  readFile(new URL("./alt-character-claims.mjs", import.meta.url), "utf8"),
  readFile(new URL("../app/app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/app/api/setup/complete/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../worker/worker.mjs", import.meta.url), "utf8"),
  readFile(new URL("./event-command.mjs", import.meta.url), "utf8"),
  readFile(new URL("./polls.mjs", import.meta.url), "utf8"),
  readFile(new URL("./giveaways.mjs", import.meta.url), "utf8"),
  readFile(new URL("./share-commands.mjs", import.meta.url), "utf8"),
  readFile(new URL("./fae-commands.mjs", import.meta.url), "utf8"),
  readFile(new URL("../app/lib/polls/service.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/lib/giveaways/service.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/lib/giveaways/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/app/api/community-gallery/[id]/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/app/api/polls/images/[choiceId]/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/app/api/giveaways/images/[id]/route.ts", import.meta.url), "utf8")
]);

test("portal membership and Discord role automation fail closed until FC ownership is verified", () => {
  assert.match(portal, /exists\(select 1 from portal_fc_verification verification where verification\.id=1 and verification\.status='verified'\)/);
  assert.match(bot, /async function isFcOwnershipVerified\(\)[\s\S]*portal_fc_verification where id=1 and status='verified'/);
  assert.match(bot, /async function verifyMemberByCharacterName[\s\S]*if \(!await isFcOwnershipVerified\(\)\)/);
  assert.match(bot, /async function autoMatchMemberByDisplayName[^]*if \(!await isFcOwnershipVerified\(\)\) return false/);
  assert.match(bot, /async function applyVerifiedDiscordState[^]*if \(!await isFcOwnershipVerified\(\)\) throw/);
  assert.match(bot, /bot\.on\("guildMemberAdd"[^]*if \(!await isFcOwnershipVerified\(\)\)/);
});

test("officers can queue an immediate FC ownership verification check", () => {
  assert.match(portal, /async function queueFcVerificationCheck\(\)[\s\S]*Officer access is required/);
  assert.match(portal, /values \('fc_verification_check', 'pending'/);
  assert.match(worker, /async function processPendingFcVerificationRequests\(client\)/);
  assert.match(worker, /request_type = 'fc_verification_check'/);
  assert.match(worker, /requestedVerification \|\| await checkFcVerification/);
});

test("independent member commands and media endpoints inherit the FC ownership gate", () => {
  const directMemberPaths = [eventCommand, polls, giveaways, shareCommands, faeCommands, pollService, giveawayService, giveawayActions, galleryRoute, pollImageRoute, giveawayImageRoute];
  for (const source of directMemberPaths) {
    assert.match(source, /portal_fc_verification verification where verification\.id=1 and verification\.status='verified'/);
  }
  assert.match(bot, /async function handleTemporaryGuestSelection[^]*if \(!await isFcOwnershipVerified\(\)\)/);
  assert.match(bot, /async function getActiveCharacterForDiscordUser[^]*portal_fc_verification verification where verification\.id=1 and verification\.status='verified'/);
  assert.match(portal, /async function getMemberCharacterChoices[^]*portal_fc_verification verification where verification\.id=1 and verification\.status='verified'/);
  assert.match(portal, /async function switchCharacterAction[^]*portal_fc_verification verification where verification\.id=1 and verification\.status='verified'/);
  assert.match(portal, /async function assertFcOwnershipVerified\(client: Client\)[^]*changing Discord character links/);
  assert.match(portal, /async function assignDiscordCharacterLink[^]*await assertFcOwnershipVerified\(client\)/);
  assert.match(portal, /async function queueDiscordRosterAction[^]*await assertFcOwnershipVerified\(client\)/);
  assert.match(portal, /async function manageDiscordQueuedAction[^]*\["retry", "confirm_kick"\][^]*assertFcOwnershipVerified\(client\)/);
});

test("pending FC verification pauses destructive queues and preserves member deadlines", () => {
  assert.match(bot, /const fcVerified = await isFcOwnershipVerified\(\)/);
  assert.match(bot, /if \(fcVerified\) \{[\s\S]*resetStaleDiscordActions\(\)[\s\S]*processOneDiscordAction\(\)/);
  assert.match(bot, /resetStalePrivacyActions\(\)[\s\S]*processOneDiscordAction\(true\)/);
  assert.match(bot, /not \$1::boolean or action_type='privacy_full_opt_out'/);
  assert.match(bot, /returning q\.\*;[\s\S]*`, \[privacyOnly\]\);/);
  assert.match(bot, /portal_discord_guest_access set selection_expires_at=greatest/);
  assert.match(bot, /portal_alt_character_claims set code_expires_at=greatest/);
  assert.match(bot, /portal_discord_roster_overrides set due_at=greatest/);
  assert.match(bot, /async function processGuestAccessExpirations\(\)[\s\S]*if \(!await isFcOwnershipVerified\(\)\) return/);
  assert.match(rosterOverrides, /isFcVerified = async \(\) => true/);
  assert.match(rosterOverrides, /async function process\(\)[\s\S]*if \(!await isFcVerified\(\)\) return/);
  assert.match(altClaims, /Free Company ownership verification is still pending\. Additional-character actions are paused/);
});

test("migrated workers can use the guild ID already saved during setup", () => {
  assert.match(worker, /async function resolveFcVerificationOptions\(client\)/);
  assert.match(worker, /select guild_id from portal_discord_bot_settings where id=1 limit 1/);
  assert.match(worker, /checkFcVerification\(client, await resolveFcVerificationOptions\(client\)\)/);
});

test("restore clears inherited admins and outstanding Discord actions", () => {
  assert.match(setup, /additionalAdminDiscordIds[\s\S]*configuration\.additionalAdminDiscordIds\.join/);
  assert.match(setup, /restore-applied\.json[\s\S]*portal_discord_action_queue set status='cancelled'/);
});

test("verification polling starts before the initial full worker synchronization", () => {
  const poll = worker.indexOf("setInterval(pollVerificationAndRequests");
  const sync = worker.indexOf("await runSync();");
  assert.ok(poll > 0 && sync > poll, "verification poll must be registered before the initial runSync");
});
