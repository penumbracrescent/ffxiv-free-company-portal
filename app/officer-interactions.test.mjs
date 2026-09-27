import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("./app/page.tsx", import.meta.url), "utf8");
const liveActions = readFileSync(new URL("./app/components/LiveBackgroundAction.tsx", import.meta.url), "utf8");
const liveFilters = readFileSync(new URL("./app/components/LiveCharacterFilters.tsx", import.meta.url), "utf8");
const picker = readFileSync(new URL("./app/components/InteractiveFormEnhancer.tsx", import.meta.url), "utf8");
const commandCenter = readFileSync(new URL("./app/components/OfficerControlCenter.tsx", import.meta.url), "utf8");
const characterSwitcher = readFileSync(new URL("./app/components/CharacterSwitcher.tsx", import.meta.url), "utf8");
const clearBackupHistory = readFileSync(new URL("./app/components/ClearBackupHistoryButton.tsx", import.meta.url), "utf8");

test("officer background requests acknowledge queueing and actively refresh their focused view", () => {
  assert.match(page, /LiveBackgroundAction[\s\S]*action=\{queueFcRosterScan\}/);
  assert.match(page, /LiveBackgroundAction[\s\S]*action=\{queueFcVerificationCheck\}/);
  assert.match(page, /LiveBackgroundAction[\s\S]*action=\{createPortableBackup\}/);
  assert.match(liveActions, /router\.refresh\(\)/);
  assert.match(liveActions, /Request queued/);
  assert.match(liveActions, /statusAction\(statusKind\)/);
  assert.match(liveActions, /Watching this tool for its background result/);
  assert.doesNotMatch(liveActions, /setInterval/);
});

test("character management filters its complete loaded list while the officer types", () => {
  assert.match(page, /getCharacters\(\)/);
  assert.match(page, /data-character-filter-card/);
  assert.match(page, /data-character-search=/);
  assert.match(liveFilters, /onChange=\{\(event\) => setQuery\(event\.target\.value\)\}/);
  assert.match(liveFilters, /card\.hidden = !matches/);
  assert.match(liveFilters, /query, role, status, total/);
});

test("calendar and time fields open their native picker from the whole input", () => {
  assert.match(page, /name="scheduledDate"[\s\S]*type="date"/);
  assert.match(page, /name="eventDate"[\s\S]*type="date"/);
  assert.match(page, /name="announcementDate"[\s\S]*type="date"/);
  assert.match(picker, /"date", "time", "datetime-local"/);
  assert.match(picker, /showPicker/);
});

test("officer tools are grouped behind a searchable command center with recent FC changes", () => {
  assert.match(page, /<OfficerControlCenter/);
  assert.match(commandCenter, /Members & FC/);
  assert.match(commandCenter, /Discord/);
  assert.match(commandCenter, /Portal Content/);
  assert.match(commandCenter, /System & Data/);
  assert.match(commandCenter, /Recent joins and departures/);
  assert.match(commandCenter, /Quick actions/);
  assert.match(commandCenter, /System health/);
  assert.match(commandCenter, /Upcoming automation/);
  assert.match(commandCenter, /querySelectorAll<HTMLElement>/);
  assert.match(commandCenter, /window\.location\.hash/);
  assert.match(commandCenter, /hashchange/);
  assert.match(commandCenter, /officer-category-markers/);
  assert.match(commandCenter, /tone:\"danger\"/);
  assert.match(commandCenter, /tone:\"warning\"/);
  assert.match(commandCenter, /tone:\"success\"/);
  assert.match(page, /id="officer-discord-roster-overview"/);
  assert.match(page, /officer-card-notification danger/);
});

test("administrators can clear backup job history without deleting backup archives", () => {
  assert.match(page, /action=\{clearBackupHistory\}/);
  assert.match(page, /Administrator access is required to clear backup history/);
  assert.match(clearBackupHistory, /Existing archive files will not be deleted/);
  assert.match(clearBackupHistory, /window\.confirm/);
});

test("administrators can safely emulate ordinary member visibility from the character switcher", () => {
  assert.match(page, /portal_emulate_member/);
  assert.match(page, /actualIsAdmin && \(await cookies\(\)\)/);
  assert.match(page, /const isAdmin = actualIsAdmin && !isEmulatingMember/);
  assert.match(page, /const isOfficer = !isEmulatingMember/);
  assert.match(page, /httpOnly:true/);
  assert.match(characterSwitcher, /View Site as Member/);
  assert.match(characterSwitcher, /Exit Member View/);
  assert.match(characterSwitcher, /member-emulation-exit-form/);
});
