import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeVerificationCode, parseLodestoneWorldDirectory, WORLDS_BY_DATA_CENTER } from "./alt-character-claims.mjs";

test("profile verification codes are intentionally case-insensitive",()=>{
  assert.equal(normalizeVerificationCode("  fae-a1b2-c3d4  "),"FAE-A1B2-C3D4");
});

test("the guided claim picker covers every supported regional data center",()=>{
  assert.ok(WORLDS_BY_DATA_CENTER.Aether.includes("Faerie"));
  assert.ok(WORLDS_BY_DATA_CENTER.Chaos.includes("Moogle"));
  assert.ok(WORLDS_BY_DATA_CENTER.Materia.includes("Ravana"));
  assert.ok(WORLDS_BY_DATA_CENTER.Elemental.includes("Tonberry"));
});

test("the picker can refresh data centers and worlds from official Lodestone markup",()=>{
  const parsed=parseLodestoneWorldDirectory('<li class="world-dcgroup__item"><h2 class="world-dcgroup__header">Test DC</h2><div class="world-list__world_name"><p>World One</p></div><div class="world-list__world_name"><p>World Two</p></div>');
  assert.deepEqual(parsed["Test DC"],["World One","World Two"]);
});

test("claims are capped transactionally and initial FC membership remains the anchor",()=>{
  const source=readFileSync(new URL("./alt-character-claims.mjs",import.meta.url),"utf8");
  assert.match(source,/pg_advisory_xact_lock/);
  assert.match(source,/portal_discord_links dl join portal_characters c on c\.id=dl\.character_id/);
  assert.match(source,/self_service_profile_code/);
  assert.match(source,/officer_approved/);
  assert.match(source,/alt_character_claims_enabled boolean not null default false/);
  assert.match(source,/portal_reject_duplicate_alt_character_link/);
  assert.match(source,/Officer log delivery failed/);
  assert.match(source,/status='expired'/);
  assert.match(source,/unlink-select/);
  assert.match(source,/cannot be officer-approved/);
  assert.match(source,/You already have a pending claim for this character/);
  assert.match(source,/That additional character is already linked to your account/);
  assert.match(source,/else null end\) on conflict\(discord_user_id,lodestone_character_id\)/);
  assert.match(source,/on conflict\(discord_user_id,lodestone_character_id\) where status in\('pending','code_required'\) do nothing returning/);
  assert.match(source,/duplicate_existing_link/);
  assert.match(source,/original verification retained/);
});

test("the bot routes the private wizard, modal, and officer actions",()=>{
  const bot=readFileSync(new URL("./bot.mjs",import.meta.url),"utf8");
  const commands=readFileSync(new URL("./fae-commands.mjs",import.meta.url),"utf8");
  assert.match(commands,/\["character","Find and claim an additional FFXIV character\."\]/);
  assert.match(bot,/interaction\.isModalSubmit\(\).*customId\.startsWith\("altchar:"\)/);
  assert.match(bot,/altCharacterClaims\.command\(interaction\)/);
  assert.match(bot,/recordFaeDiagnostic\(pool,interaction/);
  assert.match(bot,/character > \$\{interaction\.customId/);
});

test("optional profile-code expiry preserves officer approval",()=>{
  const source=readFileSync(new URL("./alt-character-claims.mjs",import.meta.url),"utf8");
  assert.match(source,/Optional profile code expired; officer approval remains available/);
  assert.match(source,/method!=="officer_approved"/);
  assert.match(source,/finishOfficerMessage\(claim,"Claim expired before the required profile-code verification\."\)/);
});

test("nickname choice controls the portal default without a separate preferred-character prompt",()=>{
  const claims=readFileSync(new URL("./alt-character-claims.mjs",import.meta.url),"utf8");
  const portal=readFileSync(new URL("../app/app/page.tsx",import.meta.url),"utf8");
  assert.match(claims,/Yes, Update Nickname/);
  assert.match(claims,/No, Keep Current Nickname/);
  assert.match(claims,/altchar:keep-nickname:/);
  assert.doesNotMatch(claims,/Use as Preferred Character/);
  assert.match(claims,/update portal_discord_links set discord_nickname=\$2,discord_display_name=\$2/);
  assert.match(portal,/coalesce\(dl\.discord_nickname,dl\.discord_display_name,''\) current_nickname/);
});

test("resolved claims clear stale officer buttons instead of failing",()=>{
  const source=readFileSync(new URL("./alt-character-claims.mjs",import.meta.url),"utf8");
  assert.match(source,/for\(let attempt=1;attempt<=3;attempt\+=1\)/);
  assert.match(source,/Could not finalize additional-character officer message/);
  assert.match(source,/if\(!\["pending","code_required"\]\.includes\(claim\.status\)\)/);
  assert.match(source,/content:completedClaimText\(claim\),embeds:interaction\.message\.embeds,components:\[\]/);
  assert.match(source,/\["nickname","cancel","check","approve","reject","require-code"\]\.includes\(action\)\)await interaction\.deferUpdate\(\)/);
  assert.match(source,/const updateInteraction=.*interaction\.editReply/);
});

test("approved additional characters default to the Alt portal role",()=>{
  const source=readFileSync(new URL("./alt-character-claims.mjs",import.meta.url),"utf8");
  assert.match(source,/values\(\$1,\$1,\$2,\$3,\$3,'Alt',true,'linked_external'/);
  assert.match(source,/update portal_characters set role='Alt',active=true/);
});
