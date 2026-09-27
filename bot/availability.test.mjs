import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseTime } from "./availability.mjs";
import { planCandidateDays } from "./event-command.mjs";

const availability = readFileSync(new URL("./availability.mjs", import.meta.url), "utf8");
const commands = readFileSync(new URL("./fae-commands.mjs", import.meta.url), "utf8");
const bot = readFileSync(new URL("./bot.mjs", import.meta.url), "utf8");
const eventCommand = readFileSync(new URL("./event-command.mjs", import.meta.url), "utf8");

test("Discord availability explains every lifetime and its exact deadline", () => {
  assert.match(availability, /STALE_DAYS=90/);
  assert.match(availability, /Ongoing · reconfirm after 90 days/);
  assert.match(availability, /Temporary · expires after 1 week/);
  assert.match(availability, /Temporary · expires after 2 weeks/);
  assert.match(availability, /Reconfirm by/);
  assert.match(availability, /Expires/);
  assert.doesNotMatch(availability, /Reconfirm by':'Expires'} \*\*/);
});

test("the member editor stays private while officers can post a public launcher", () => {
  assert.match(availability, /MessageFlags\.Ephemeral/);
  assert.match(availability, /Post Member Setup/);
  assert.match(availability, /Set or Update My Availability/);
  assert.match(availability, /interaction\.user\.id/);
});

test("availability is registered and routed through fae", () => {
  assert.match(commands, /availability/);
  assert.match(bot, /handleAvailabilityCommand/);
  assert.match(bot, /handleAvailabilityInteraction/);
  assert.match(bot, /ensureAvailabilitySchema/);
});

test("availability accepts compact and human-friendly time formats", () => {
  assert.equal(parseTime("6pm"), 18 * 60);
  assert.equal(parseTime("11pm"), 23 * 60);
  assert.equal(parseTime("6:30 p.m."), 18 * 60 + 30);
  assert.equal(parseTime("12am"), 0);
  assert.equal(parseTime("12 PM"), 12 * 60);
  assert.equal(parseTime("not a time"), null);
});

test("availability refresh queries safely quote the day alias and offer retry", () => {
  assert.match(availability, /day_of_week as "day"/);
  assert.doesNotMatch(availability, /day_of_week day/);
  assert.match(availability, /Re-enter Times/);
});

test("saving reusable availability only attaches it to plans the member explicitly joined", () => {
  assert.match(availability, /portal_event_plan_interest i set availability_source='saved'/);
  assert.match(availability, /i\.discord_user_id=\$1 and i\.status='interested'/);
  assert.match(availability, /p\.status='collecting'/);
});

test("plan-only Discord availability supports two periods and refreshes the shared post", () => {
  assert.match(eventCommand, /Second start time \(optional\)/);
  assert.match(eventCommand, /periods\.map\(\(period,slot\)=>/);
  assert.match(eventCommand, /slot_index,start_minute,end_minute,time_zone\) values\(\$1,\$2,\$3,\$4,\$5,\$6,\$7\)/);
  assert.match(eventCommand, /entry\.day,entry\.slot,entry\.start,entry\.end,zone/);
  assert.match(eventCommand, /processEventPlanSyncs/);
  assert.match(eventCommand, /Response buttons have been disabled/);
  assert.match(bot, /processEventPlanSyncs\(pool, bot\)/);
});

test("Discord plan availability uses a staged day-by-day weekly editor", () => {
  assert.match(eventCommand, /portal_event_plan_availability_drafts/);
  assert.match(eventCommand, /Not entered/);
  assert.match(eventCommand, /Not available/);
  assert.match(eventCommand, /Copy These Hours to Days/);
  assert.match(eventCommand, /Mark Day Unavailable/);
  assert.match(eventCommand, /Save Availability/);
  assert.match(eventCommand, /Nothing replaces your current plan availability until/);
  assert.match(eventCommand, /action==='copy-target'/);
  assert.match(eventCommand, /action==='cancel-draft'/);
});

test("plan day modals are acknowledged before database work", () => {
  assert.match(eventCommand, /if\(action==='day-hours'\)await interaction\.deferUpdate\(\);await ensureEventDraftTable/);
  assert.match(eventCommand, /action==='day-hours'[\s\S]*await interaction\.editReply\(planAvailabilityEditorPayload/);
});

test("event-specific availability highlights weekdays in the possible date range", () => {
  const days = planCandidateDays({ possible_start_date: "2026-09-26", possible_end_date: "2026-09-28" });
  assert.deepEqual([...days.keys()], [6, 0, 1]);
  assert.deepEqual(days.get(6), ["Sep 26"]);
  assert.match(eventCommand, /★ marks a weekday included in this event's possible date range/);
  assert.match(eventCommand, /Possible event.*dates/);
  assert.match(eventCommand, /planCandidateDays\(plan\)\.has\(day\)/);
});
