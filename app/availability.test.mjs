import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(new URL("./lib/availability.ts", import.meta.url), "utf8");
const panel = readFileSync(new URL("./app/components/AvailabilityPanel.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("./app/api/availability/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("./app/page.tsx", import.meta.url), "utf8");
const privacy = readFileSync(new URL("./lib/privacy-requests.ts", import.meta.url), "utf8");
const eventPlans = readFileSync(new URL("./lib/event-plans.ts", import.meta.url), "utf8");
const eventPlanRoute = readFileSync(new URL("./app/api/event-plans/route.ts", import.meta.url), "utf8");
const eventPlanBoard = readFileSync(new URL("./app/components/EventPlanningBoard.tsx", import.meta.url), "utf8");
const eventWizard = readFileSync(new URL("./app/components/MemberEventWizard.tsx", import.meta.url), "utf8");
const discordChannelAccess = readFileSync(new URL("./lib/discord-channel-access.ts", import.meta.url), "utf8");

test("availability durations are explicit and ongoing schedules become stale after 90 days", () => {
  assert.match(service, /AVAILABILITY_STALE_DAYS = 90/);
  assert.match(service, /scope==="week"\?7:14/);
  assert.match(panel, /Ongoing · reconfirm after 90 days/);
  assert.match(panel, /Temporary · expires after 1 week/);
  assert.match(panel, /Temporary · expires after 2 weeks/);
  assert.match(panel, /Reconfirm by/);
  assert.match(panel, /Expires/);
});

test("member availability and officer planning use one protected API", () => {
  assert.match(route, /requireAvailabilityMember/);
  assert.match(route, /if\(!officer\(session\)\)return errorResponse/);
  assert.match(route, /buildAvailabilityPlanner/);
  assert.match(panel, /Availability Planner/);
  assert.match(panel, /cotf:plan-event/);
  assert.match(page, /<AvailabilityPanel isOfficer=\{isOfficer\}/);
});

test("availability profiles and daily windows participate in privacy export and deletion", () => {
  assert.match(privacy, /portal_member_availability_profiles/);
  assert.match(privacy, /portal_member_availability_windows/);
});

test("availability queries quote the reserved day alias", () => {
  assert.match(service, /day_of_week::int as "day"/);
  assert.doesNotMatch(service, /day_of_week::int day/);
  assert.match(eventPlans, /day_of_week as "day"/);
  assert.doesNotMatch(eventPlans, /day_of_week as day/);
});

test("tentative event plans count only explicitly interested members", () => {
  assert.match(eventPlans, /portal_event_plan_interest/);
  assert.match(eventPlans, /member\.status!=="interested"\|\|!member\.confirmed/);
  assert.match(eventPlans, /i\.availability_source='plan'/);
  assert.match(eventPlans, /i\.availability_source='saved'/);
  assert.match(eventPlanBoard, /Interested with availability/);
  assert.match(eventPlanBoard, /Interested, availability needed/);
  assert.match(eventPlanBoard, /Withdrawn/);
  assert.match(eventPlanBoard, /Set Event-Specific Hours/);
  assert.match(eventPlanBoard, /Change Event-Specific Hours/);
  assert.match(eventPlans, /availability_source=case when portal_event_plan_interest\.availability_source='plan'/);
});

test("the site reloads event-specific hours saved through Discord", () => {
  assert.match(eventPlans, /current_plan_availability_windows/);
  assert.match(eventPlans, /portal_event_plan_availability_windows w where w\.plan_id=p\.id and w\.discord_user_id=\$1/);
  assert.match(eventPlanBoard, /usesPlanHours\?plan\.current_plan_availability_windows:undefined/);
  assert.match(panel, /Your existing event-specific hours are loaded below/);
  assert.match(panel, /setWindows\(Array\.isArray\(detail\.windows\)\?detail\.windows:\[\]\)/);
});

test("planning destinations use the member's Discord channel permissions and default to Party Planner", () => {
  assert.match(eventPlanRoute, /getAvailableDiscordPostChannels/);
  assert.match(page, /const eventPlanDestinations =/);
  assert.match(page, /preferredChannelId: discordBotSettings\.event_channel_id/);
  assert.match(page, /destinations=\{eventPlanDestinations\}/);
  assert.match(discordChannelAccess, /VIEW_CHANNEL\|SEND_MESSAGES/);
  assert.match(discordChannelAccess, /VIEW_CHANNEL\|SEND_MESSAGES\|EMBED_LINKS/);
  assert.match(discordChannelAccess, /permission_overwrites/);
  assert.doesNotMatch(page, /Raiding channel override/);
  assert.doesNotMatch(eventWizard, /Raiding channel override/);
  assert.doesNotMatch(page, /Mount Farm Channel/);
  assert.match(page, /when raid_channel_id <> '' then raid_channel_id/);
  assert.match(page, /raid_channel_id = ''/);
  assert.match(page, /mount_farm_channel_id = ''/);
  assert.match(eventPlanBoard, /Post Planning Request/);
});

test("event-plan availability participates in privacy export and deletion", () => {
  assert.match(privacy, /portal_event_plan_interest/);
  assert.match(privacy, /portal_event_plan_availability_windows/);
  assert.match(privacy, /portal_event_plan_availability_drafts/);
  assert.match(privacy, /created_by='Deleted member'/);
});

test("planning requests can be edited, cancelled, expired, and synchronized", () => {
  assert.match(eventPlans, /updateEventPlan/);
  assert.match(eventPlans, /cancelEventPlan/);
  assert.match(eventPlans, /status='expired'/);
  assert.match(eventPlans, /sync_requested_at=now\(\)/);
  assert.match(eventPlanRoute, /action==="update"/);
  assert.match(eventPlanRoute, /action==="cancel"/);
  assert.match(eventPlanBoard, /Edit Request/);
  assert.match(eventPlanBoard, /Cancel Request/);
  assert.match(eventPlanBoard, /setInterval\(refresh,15000\)/);
});

test("officer scheduling shows ranked options, participant names, and coverage warnings", () => {
  assert.match(eventPlanBoard, /Best current overlaps/);
  assert.match(eventPlanBoard, /suggestion\.members\.join/);
  assert.match(eventPlanBoard, /needs \$\{plan\.party_size-suggestion\.count\} more/);
  assert.match(eventPlanBoard, /Tank, healer, and DPS roles still need confirmation/);
});

test("officers see plan-specific schedules converted to their own timezone", () => {
  assert.match(eventPlans, /portal_member_preferences where discord_user_id=\$1/);
  assert.match(eventPlans, /memberWindowLabels\(member,plan,viewerTimeZone\)/);
  assert.match(eventPlans, /localDateTimeToUtc\(cursor,window\.start,member\.timeZone\)/);
  assert.match(eventPlans, /timeZone:viewerTimeZone/);
  assert.match(eventPlanBoard, /Times shown in your timezone/);
  assert.match(eventPlanBoard, /Event-specific hours/);
  assert.match(eventPlanBoard, /converted from/);
});
