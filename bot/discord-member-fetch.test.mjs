import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./bot.mjs", import.meta.url), "utf8");

test("full Discord member scans share one retrying snapshot", () => {
  assert.match(source, /const FULL_GUILD_MEMBER_CACHE_MS = 60_000;/);
  assert.match(source, /function getDiscordGatewayRetryAfterMs\(error\)/);
  assert.match(source, /retryAfterMs \+ 250/);
  assert.match(source, /async function executeDiscordRosterScan\(action, settings, guild, memberSnapshot = null\)/);
  assert.match(source, /const members = memberSnapshot \|\| await fetchAllGuildMembers\(guild\);/);
  assert.match(source, /const rosterRefresh = await executeDiscordRosterScan\(action, settings, guild, members\);/);
  assert.equal((source.match(/guild\.members\.fetch\(\)/g) || []).length, 2);
});
