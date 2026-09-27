import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page=readFileSync(new URL("./app/page.tsx",import.meta.url),"utf8");
const worker=readFileSync(new URL("../worker/worker.mjs",import.meta.url),"utf8");
const bot=readFileSync(new URL("../bot/bot.mjs",import.meta.url),"utf8");
const commands=readFileSync(new URL("../bot/fae-commands.mjs",import.meta.url),"utf8");
const privacy=readFileSync(new URL("./lib/privacy-requests.ts",import.meta.url),"utf8");

test("Officer Area exposes disabled-by-default global settings and per-member caps",()=>{
  assert.match(page,/Alt Character Claims &amp; Verification/);
  assert.match(page,/alt_character_claims_enabled boolean not null default false/);
  assert.match(page,/portal_alt_character_limits/);
  assert.match(page,/Save \/ Reset Limit/);
  assert.match(page,/linked_character_count/);
  assert.match(page,/View linked characters and verification history/);
  assert.match(page,/Officer override/);
  assert.match(page,/Officer approved/);
  assert.match(page,/Profile code verified/);
  assert.match(page,/verified_by_discord_user_id/);
});

test("worker scans linked characters only while their FC membership anchor is current",()=>{
  assert.match(worker,/portal_alt_character_links acl join portal_discord_links adl/);
  assert.match(worker,/anchor\.fc_membership_status='current'/);
  assert.match(worker,/linked_anchor_departed/);
  assert.match(worker,/and fc_membership_status = 'current'\s+and not \(lodestone_character_id = any/);
  assert.match(worker,/not exists \(select 1 from portal_discord_links dl where dl\.character_id=portal_characters\.id\)/);
});

test("privacy inventory includes claim, limit, and linked-character identity records",()=>{
  assert.match(privacy,/portal_alt_character_claims/);
  assert.match(privacy,/portal_alt_character_limits/);
  assert.match(privacy,/portal_alt_character_links/);
  assert.match(privacy,/subjectAnchorCharacterId/);
  assert.match(privacy,/records\.portal_characters/);
});

test("linked characters share settings and cannot cross Discord ownership boundaries",()=>{
  assert.match(page,/updated\.rowCount \?\? 0\) < 1/);
  assert.match(page,/union all select discord_user_id from portal_discord_links where character_id=\$1/);
  assert.match(page,/portal_reject_duplicate_alt_character_link/);
  assert.match(commands,/all of your linked characters/);
  assert.match(commands,/update portal_characters set mount_win_notifications_enabled=\$2/);
});

test("one Discord member cannot occupy an event roster more than once without losing signup age",()=>{
  assert.match(page,/event-member:\$\{eventId\}:\$\{discordUserId\}/);
  assert.match(page,/update portal_discord_event_signups s set character_id=\$2/);
  assert.match(page,/delete from portal_discord_event_signups s where s\.event_id=\$1 and s\.character_id<>\$2/);
  assert.match(page,/memberCharacterIds\.has\(signup\.character_id\)/);
  assert.match(bot,/event-member:\$\{eventId\}:\$\{discordUserId\}/);
  assert.match(bot,/update portal_discord_event_signups s set character_id=\$2/);
  assert.match(bot,/coalesce\(dl\.discord_user_id,acl\.discord_user_id\) as discord_user_id/);
});

test("Discord actions resolve an exact nickname to its verified linked character",()=>{
  assert.match(commands,/current_nickname/);
  assert.match(commands,/join portal_alt_character_links acl/);
  assert.match(bot,/getActiveCharacterForDiscordUser\(discordUserId,currentNickname=""\)/);
  assert.match(bot,/getDiscordInteractionDisplayName\(interaction\)/);
});
