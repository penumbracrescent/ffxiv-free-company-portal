import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { localDateKey, isoWeek, addWeeksToIsoWeek } from "../src/time.mjs";
import { seriesKey, releaseKey } from "../src/identity.mjs";
import { shouldReplaceRelease, validateSourceResult } from "../src/policy.mjs";
import { createOfficialFeedSource } from "../src/sources/official-feed.mjs";
import { descriptionText } from "../src/sources/animeschedule.mjs";

test("Central dates remain correct across DST boundaries", () => {
  assert.equal(localDateKey(new Date("2026-03-08T07:30:00Z"), "America/Chicago"), "2026-03-08");
  assert.equal(localDateKey(new Date("2026-11-01T06:30:00Z"), "America/Chicago"), "2026-11-01");
});

test("ISO week navigation crosses a year safely", () => {
  const start = isoWeek(new Date("2026-12-31T12:00:00Z"));
  const next = addWeeksToIsoWeek(start, 1);
  assert.ok(next.year >= 2027 || next.week > start.week);
});

test("release identity is stable across aliases but separates sub and dub", () => {
  const base = { englishTitle: "Example Show Season 2", romajiTitle: "Example Show 2", episodeLabel: "4", language: "sub", releaseKind: "episode" };
  assert.equal(seriesKey(base), seriesKey({ ...base, displayTitle: "ignored display" }));
  assert.notEqual(releaseKey(base), releaseKey({ ...base, language: "dub" }));
});

test("higher priority observations replace lower priority records", () => {
  assert.equal(shouldReplaceRelease({ source_priority: 200, source_observed_at: "2026-08-01T00:00:00Z" }, { sourcePriority: 400, observedAt: "2026-07-01T00:00:00Z" }), true);
  assert.equal(shouldReplaceRelease({ source_priority: 400, source_observed_at: "2026-08-01T00:00:00Z" }, { sourcePriority: 200, observedAt: "2026-08-02T00:00:00Z" }), false);
});

test("source sanity check rejects sudden near-empty responses", () => {
  assert.throws(() => validateSourceResult({ previousCount: 100, observations: Array.from({ length: 10 }, (_, i) => ({ i })) }), /unexpectedly small/i);
});
test("official feed adapter normalizes a confirmed publisher release", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([{ id:"official-1", englishTitle:"Example", language:"dub", startsAt:"2026-08-20T01:00:00Z", episodeNumber:3, status:"confirmed" }]), { status:200, headers:{"content-type":"application/json"} });
  try {
    const result = await createOfficialFeedSource("crunchyroll", "https://approved.example/releases.json").fetchObservations();
    assert.equal(result.observations.length, 1);
    assert.equal(result.observations[0].sourcePriority, 400);
    assert.equal(result.observations[0].platforms[0].displayName, "Crunchyroll");
  } finally { globalThis.fetch = originalFetch; }
});
test("status query binds its Discord horizon parameter", async () => {
  const source = await readFile(new URL("../src/queries.mjs", import.meta.url), "utf8");
  assert.ok(source.includes("from anime.releases;`, [String(discordHorizonDays)])"));
});
test("Google output routes SUB and DUB to separate calendar IDs", async () => {
  const source = await readFile(new URL("../src/google.mjs", import.meta.url), "utf8");
  assert.ok(source.includes('languages: [target.language]'));
  assert.ok(source.includes('externalContainerId: target.calendarId'));
  assert.ok(source.includes('release.external_container_id === target.calendarId'));
});

test("Google calendar configuration exposes independent SUB and DUB IDs", async () => {
  const source = await readFile(new URL("../src/config.mjs", import.meta.url), "utf8");
  assert.ok(source.includes("ANIME_GOOGLE_SUB_CALENDAR_ID"));
  assert.ok(source.includes("ANIME_GOOGLE_DUB_CALENDAR_ID"));
});
test("AnimeSchedule HTML descriptions become safe readable text", () => {
  assert.equal(descriptionText("<p>A hero &amp; friend.</p><p>Second line.<br>More.</p>"), "A hero & friend.\n\nSecond line.\nMore.");
  assert.equal(descriptionText("<script>alert(1)</script><b>Visible</b>"), "Visible");
});

test("calendar outputs include synopsis text with the intended branding rules", async () => {
  const google = await readFile(new URL("../src/google.mjs", import.meta.url), "utf8");
  const discord = await readFile(new URL("../../bot/anime-events.mjs", import.meta.url), "utf8");
  assert.ok(google.includes('release.description || "Synopsis not available yet."'));
  assert.equal(google.includes("PORTAL_URL"), false);
  assert.ok(discord.includes('new URL("?view=anime", PORTAL_URL)'));
  assert.ok(discord.includes("Times shown by Discord match each user's local timezone."));
  assert.ok(discord.includes("release.description"));
});

test("Discord output supports stale cleanup and run reporting", async () => {
  const queries = await readFile(new URL("../src/queries.mjs", import.meta.url), "utf8");
  const server = await readFile(new URL("../src/server.mjs", import.meta.url), "utf8");
  const discord = await readFile(new URL("../../bot/anime-events.mjs", import.meta.url), "utf8");
  assert.ok(queries.includes("staleOutputMappings"));
  assert.ok(queries.includes("m.status='active'"));
  assert.ok(server.includes("/api/outputs/discord/report"));
  assert.ok(discord.includes("GuildScheduledEventStatus.Scheduled"));
  assert.ok(discord.includes('"retired"'));
});
