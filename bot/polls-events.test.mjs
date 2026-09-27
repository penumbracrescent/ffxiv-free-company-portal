import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEventDateAndTime, parseEventDateRange } from "./event-command.mjs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const bot = read("./bot.mjs");
const commands = read("./fae-commands.mjs");
const events = read("./event-command.mjs");
const polls = read("./polls.mjs");

test("/fae planevent is separate from officer-created polls", () => {
  assert.match(commands, /\["planevent","Schedule an FC duty run or farm party\."\]/);
  assert.match(bot, /handleEventCommand/);
  assert.match(bot, /handlePollInteraction/);
  assert.match(bot, /getSubcommand\(\) === "planevent"/);
  assert.doesNotMatch(commands, /\["event","Schedule/);
  assert.match(commands, /\["character", "find and claim an additional character"\]/);
  assert.match(commands, /\["planevent", "schedule a duty run or farm party"\]/);
  assert.doesNotMatch(commands, /character — privately|planevent — privately|private character command/);
});

test("anime schedule lists every release for the selected day", () => {
  assert.match(commands, /const lines=releases\.map\(release=>/);
  assert.doesNotMatch(commands, /releases\.slice\(0,12\)/);
  assert.doesNotMatch(commands, /more releases on the full calendar/);
});

test("member event drafts are private, durable, and use configured event channels", () => {
  assert.match(events, /portal_discord_event_drafts/);
  assert.match(events, /flags:MessageFlags\.Ephemeral/);
  assert.match(events, /select event_channel_id from portal_discord_bot_settings/);
  assert.doesNotMatch(events, /target_channel_id.*getTextInputValue/);
  assert.match(events, /Date \(MM-DD or MM\/DD\)/);
  assert.match(events, /America\/Chicago/);
  assert.match(events, /timeZoneDefaulted/);
});

test("event planning defaults to Party Planner and keeps hidden channels out of overrides", () => {
  assert.match(events, /Collect Availability/);
  assert.match(events, /availableTargetChannels/);
  assert.match(events, /StringSelectMenuBuilder/);
  assert.doesNotMatch(events, /ChannelSelectMenuBuilder/);
  assert.match(events, /officer_log_channel_id,test_channel_id/);
  assert.match(events, /channel\.id!==settings\.officer_log_channel_id/);
  assert.match(events, /channel\.id!==settings\.test_channel_id\|\|admin/);
  assert.match(events, /PermissionFlagsBits\.Administrator/);
  assert.match(events, /PermissionFlagsBits\.ViewChannel/);
  assert.match(events, /PermissionFlagsBits\.SendMessages/);
  assert.match(events, /PermissionFlagsBits\.EmbedLinks/);
  assert.match(events, /interaction\.guild\?\.members\.fetch\(interaction\.user\.id\)/);
  assert.match(events, /Officer Bot Log cannot be selected/);
  assert.match(events, /Only Discord administrators can post event tests/);
  assert.equal((events.match(/await validateTargetChannel\(pool,interaction,channelId\)/g)||[]).length,2);
  assert.match(events, /portal_event_plan_interest/);
  assert.match(events, /Only members who click \*\*I'm Interested\*\*/);
  assert.match(events, /Set Event-Specific Hours/);
  assert.match(events, /Change Event-Specific Hours/);
  assert.match(events, /const planSpecific=/);
  assert.match(events, /availability_source='plan'/);
  assert.match(events, /availability_source=case when portal_event_plan_interest\.availability_source='plan'/);
  assert.match(events, /day_of_week::int as "day"/);
  assert.doesNotMatch(events, /day_of_week::int day/);
  assert.match(events, /\*\*Default channel:\*\*/);
  assert.match(events, /Change the selector below to override the posted location/);
  assert.match(events, /defaultDiscordChannel\?\.name/);
  assert.match(events, /setPlaceholder\(selectedChannel\)/);
  assert.doesNotMatch(events, /Optional: override Party Planner channel/);
  assert.match(events, /action==='channel'\)\{await interaction\.deferUpdate\(\)/);
  assert.match(events, /targetChannelId:null,targetChannelName:null/);
  assert.match(events, /await interaction\.editReply\(activityPanel\(row\)\)/);
});

test("planning-post refreshes retain mount and duty artwork", () => {
  assert.match(events, /coalesce\(p\.mount_image_url,m\.image_url,m\.icon_url,p\.duty_image_url,d\.image_url\) display_image_url/);
  assert.match(events, /const image=plan\.display_image_url\|\|plan\.mount_image_url\|\|plan\.duty_image_url/);
  assert.match(events, /function preserveEventPlanImage/);
  assert.match(events, /message\.embeds\?\.\[0\]\?\.image\?\.url/);
  assert.match(events, /message\.edit\(preserveEventPlanImage\(message,payload\)\)/);
  assert.match(events, /interaction\.message\.edit\(preserveEventPlanImage\(interaction\.message,payload\)\)/);
});

test("event dates and times accept common compact formats", () => {
  assert.deepEqual(parseEventDateAndTime("09/11","2200"),{month:9,day:11,hour:22,minute:0});
  assert.deepEqual(parseEventDateAndTime("9/11","22:00"),{month:9,day:11,hour:22,minute:0});
  assert.deepEqual(parseEventDateAndTime("9-11","900"),{month:9,day:11,hour:9,minute:0});
  assert.deepEqual(parseEventDateAndTime("09-11","09:00"),{month:9,day:11,hour:9,minute:0});
  assert.throws(()=>parseEventDateAndTime("9.11","10pm"),/Use M-D or M\/D/);
  assert.deepEqual(parseEventDateRange("9/26 9/28"),["9/26","9/28"]);
  assert.deepEqual(parseEventDateRange("9/26 to 9/28"),["9/26","9/28"]);
  assert.deepEqual(parseEventDateRange("9-26 through 9-28"),["9-26","9-28"]);
  assert.deepEqual(parseEventDateRange("9/26 - 9/28"),["9/26","9/28"]);
  assert.throws(()=>parseEventDateRange("9/26"),/Enter two dates/);
});

test("poll delivery is durable and deletes exact test artifacts", () => {
  assert.match(polls, /portal_poll_discord_jobs/);
  assert.match(polls, /portal_poll_discord_artifacts/);
  assert.match(polls, /messages\?\.delete\(artifact\.message_id\)/);
  assert.match(polls, /delete from portal_polls where id=\$1 and is_test=true/);
});

test("multiple-choice polls enforce optional per-ballot minimum selections", () => {
  assert.match(polls, /add column if not exists min_selections integer/);
  assert.match(polls, /setMinValues\(minimum\)/);
  assert.match(polls, /Number\(poll\.min_selections\|\|1\)/);
  assert.match(polls, /Choose at least \$\{poll\.min_selections\} options before submitting/);
  assert.match(polls, /Minimum voters/);
});

test("Discord vote edits preserve and repair voter character labels", () => {
  assert.match(polls, /voter_label=excluded\.voter_label/);
  assert.doesNotMatch(polls, /voter_label=excluded\.voter_is_officer/);
  assert.match(polls, /set voter_label=c\.character_name/);
});

test("Discord vote edits clearly acknowledge the updated ballot", () => {
  assert.match(polls, /const wasUpdate=Boolean/);
  assert.match(polls, /Your updated vote was accepted/);
  assert.match(polls, /\*\*Current ballot\*\*/);
  assert.match(polls, /Change My Vote/);
});

test("scheduled and officer-requested early endings use the same bot finalizer", () => {
  assert.match(polls, /status='open' and closes_at<=now\(\)/);
  assert.match(polls, /for\(const poll of due\)await revalidateAndClose/);
  assert.match(polls, /updated\.status==='closed'&&updated\.post_results/);
});

test("closed image polls identify the winner and edit the original post with its image", () => {
  assert.match(polls, /name:winners\.length===1\?"Winner":"Winning choices"/);
  assert.match(polls, /🏆 \*\*\$\{cut\(winner\.label,850\)\}\*\*/);
  assert.match(polls, /poll\.poll_type==="image"&&winner/);
  assert.match(polls, /embed\.setImage\(`attachment:\/\//);
  assert.match(polls, /message\.edit\(payload\.files\?\.length\?\{\.\.\.payload,attachments:\[\]\}:payload\)/);
  assert.match(polls, /sync_results:winner-image-v1/);
});

test("poll and event components use privacy-minimized diagnostics", () => {
  assert.match(bot, /outcome:error\?"failure":"success"/);
  assert.match(bot, /recordFaeDiagnostic/);
  assert.doesNotMatch(bot, /commandPath=.*interaction\.values/);
});
