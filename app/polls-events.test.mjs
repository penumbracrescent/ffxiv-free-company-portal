import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("./app/page.tsx");
const schema = read("./lib/polls/schema.ts");
const service = read("./lib/polls/service.ts");
const view = read("./app/components/PollsView.tsx");
const privacy = read("./lib/privacy-requests.ts");
const giveawaySchema = read("./lib/giveaways/schema.ts");
const giveawayService = read("./lib/giveaways/service.ts");
const giveawayWizard = read("./app/components/GiveawayWizard.tsx");
const pickerEnhancer = read("./app/components/InteractiveFormEnhancer.tsx");
const styles = read("./app/globals.css");
const pollBot = read("../bot/polls.mjs");

test("Polls is a separate page between announcements and events", () => {
  assert.match(page, /Announcements[\s\S]{0,180}view: "polls"[\s\S]{0,180}Events & Raiding/);
  assert.match(page, /activeView === "polls"/);
});

test("expanding one poll does not stretch neighboring poll cards", () => {
  assert.match(styles, /\.poll-view \.giveaway-list\{align-items:start\}/);
});

test("poll ballots preserve the three distinct privacy modes", () => {
  assert.match(schema, /privacy_mode text not null default 'private'.*'public','private','anonymous'/);
  assert.match(service, /anonymous\?null:actor\.discordUserId/);
  assert.match(view, /Fully anonymous from members and officers/);
});

test("poll ballot labels repair boolean snapshots and display linked character names", () => {
  assert.match(schema, /lower\(coalesce\(b\.voter_label,''\)\) in \('true','false'\)/);
  assert.match(service, /then vc\.character_name/);
  assert.match(service, /left join portal_characters vc on vc\.id=b\.voter_character_id/);
});

test("multiple-choice polls distinguish turnout from required ballot selections", () => {
  assert.match(schema, /min_selections integer/);
  assert.match(service, /unique\.length<Number\(poll\.min_selections\)/);
  assert.match(view, /Minimum voters tallied \(optional\)/);
  assert.match(view, /Minimum selections per ballot \(optional\)/);
  assert.match(view, /Each ballot requires/);
});

test("poll submissions acknowledge accepted updates and actively refresh the ballot", () => {
  assert.match(service, /on conflict\(poll_id,voter_key\) do update/);
  assert.match(service, /delete from portal_poll_ballot_choices where ballot_id=\$1/);
  assert.match(view, /Your updated vote was accepted\./);
  assert.match(view, /✓ Vote Accepted/);
  assert.match(view, /router\.refresh\(\)/);
  assert.match(view, /aria-live="polite"/);
});

test("active Discord ballots refresh on the portal without a manual page reload", () => {
  assert.match(view, /setInterval\(refresh,15000\)/);
  assert.match(view, /Active ballots refresh automatically/);
  assert.match(view, /Refresh Polls/);
  assert.match(view, /visibilitychange/);
});

test("leading-choice graphs honor winner slots, cutoff ties, and poll privacy", () => {
  assert.match(view, /function PollLeaderGraph/);
  assert.ok(view.includes("poll.privacyMode==='public'&&Boolean(actor.characterId)"));
  assert.ok(view.includes("leaders.length>winningSlots"));
  assert.ok(view.includes("metric(choice)>=cutoff"));
  assert.match(view, />Graph<\/button>/);
  assert.match(view, /poll-graph-dialog/);
  assert.match(view, /role="dialog" aria-modal="true"/);
  assert.match(view, /'Top '\+winningSlots/);
  assert.ok(service.includes('record.privacyMode==="public"&&eligibility.eligible'));
  assert.ok(styles.includes(".poll-leader-results"));
});

test("poll totals remain visible and graph standings can expand to every choice", () => {
  assert.match(view, /function PollChoiceResults/);
  assert.match(view, /<progress max=\{maximum\} value=\{value\}/);
  assert.match(view, /<PollChoiceResults poll=\{poll\} actor=\{actor\}\/>/);
  assert.match(view, /visibleChoices=expanded\?sorted:leaders/);
  assert.match(view, /Expand Full List/);
  assert.match(view, /Show Leaders/);
  assert.match(view, /aria-expanded=\{expanded\}/);
});

test("multiple-choice polls preserve explicit winner slots across the site and Discord", () => {
  assert.match(schema, /winner_count integer not null default 1/);
  assert.match(schema, /portal_poll_winners/);
  assert.ok(schema.includes("poll_type='multiple' and status in ('draft','scheduled','open','awaiting_tie') then max_selections"));
  assert.match(view, /Number of winning choices/);
  assert.match(view, /Resolve Winning Cutoff/);
  assert.match(service, /tied.length>remaining/);
  assert.match(service, /Winners determined from counted ballots/);
  assert.match(pollBot, /winning choices/);
  assert.match(pollBot, /Awaiting officer resolution at the winning cutoff/);
  assert.match(pollBot, /portal_poll_winners/);
  assert.match(service, /No result — no counted ballots/);
  assert.match(view, /poll-winner-rank/);
  assert.ok(view.includes("{tied?'T':''}{rank}"));
  assert.match(view, /Winning choices<\/span><strong>\{winnerCount\}/);
  assert.match(pollBot, /winner_count\} winners/);
  assert.match(schema, /'tie_alert'/);
  assert.match(pollBot, /function syncOfficerTieAlert/);
  assert.match(pollBot, /A winning-cutoff tie requires officer action/);
  assert.match(schema, /max_selections between 1 and 25/);
  assert.match(schema, /winner_count between 1 and 25/);
  assert.match(service, /between 2 and 25 choices/);
  assert.ok(view.includes("max={image?10:25}"));
});

test("poll review requires an explicit finish click and date fields open their picker", () => {
  assert.match(view, /const publishIntent=useRef\(false\)/);
  assert.match(view, /if\(!publishIntent\.current\)\{event\.preventDefault\(\)/);
  assert.match(view, /Finish and Publish/);
  assert.match(view, /name="newClosesAt" type="datetime-local" required/);
  assert.match(pickerEnhancer, /showPicker\?\.\(\)/);
  assert.doesNotMatch(view, /showPicker\?\.\(\)/);
});

test("poll close revalidates membership and test cleanup tracks Discord artifacts", () => {
  assert.match(service, /revalidateBallots\(client,pollId\)/);
  assert.match(service, /deleteTestPoll/);
  assert.match(schema, /portal_poll_discord_artifacts/);
  assert.match(schema, /delete_artifacts/);
});

test("officers can end an active poll early through the scheduled close path", () => {
  assert.match(view, /End Poll Early/);
  assert.doesNotMatch(view, /Close Now/);
  assert.match(service, /requestPollEarlyEnd/);
  assert.match(service, /set closes_at=now\(\)/);
  assert.match(service, /job_kind='reminder'.*status in \('pending','failed'\)/);
});

test("officers can edit a scheduled poll only before its opening time", () => {
  assert.match(view, /Edit Scheduled Poll/);
  assert.match(view, /editScheduledPollAction/);
  assert.match(service, /current\.status!=="scheduled"/);
  assert.match(service, /new Date\(current\.opens_at\)\.getTime\(\)<=Date\.now\(\)/);
  assert.match(service, /update portal_poll_discord_jobs set status='cancelled'/);
  assert.match(service, /scheduled_poll_edited/);
  assert.match(service, /select image_filename,image_mime_type,image_data from portal_poll_choices/);
});

test("privacy export and erasure cover identifiable and anonymous ballots", () => {
  assert.match(privacy, /subjectPollKeys/);
  assert.match(privacy, /portal_poll_ballots/);
  assert.match(privacy, /deidentifyPollParticipation/);
});

test("contestants stay named while contest ballots default to poll-style privacy", () => {
  assert.match(giveawaySchema, /ballot_privacy_mode text not null default 'private'/);
  assert.match(giveawayWizard, /Contestant visibility/);
  assert.match(giveawayWizard, /Vote privacy/);
  assert.match(giveawayWizard, /Private — officers only/);
  assert.match(giveawayService, /record\.ballotPrivacyMode==="private"&&isOfficer/);
  assert.match(giveawayService, /record\.ballotPrivacyMode==="public"&&eligibility\.eligible/);
  assert.match(giveawayService, /anonymous\?encryptGiveawayDiscordId/);
  assert.match(giveawayService, /case when g\.live_totals_visible[^\n]+else null end as vote_score/);
  assert.match(privacy, /deidentifyGiveawayParticipation/);
});
