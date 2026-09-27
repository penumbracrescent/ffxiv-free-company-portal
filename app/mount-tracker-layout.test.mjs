import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("./app/page.tsx", import.meta.url);

test("party planner sits between most-needed mounts and the clickable filters", async () => {
  const page = await readFile(pageUrl, "utf8");
  const mostNeeded = page.indexOf('<details className="tracker-collapsible most-needed-panel" open>');
  const partyPlanner = page.indexOf('id="party-planner"', mostNeeded);
  const clickableFilters = page.indexOf("mount-set-card mount-set-card-link", partyPlanner);
  const recentWins = page.indexOf('className="tracker-collapsible mount-wins-panel"', clickableFilters);

  assert.ok(mostNeeded >= 0);
  assert.ok(mostNeeded < partyPlanner);
  assert.ok(partyPlanner < clickableFilters);
  assert.ok(clickableFilters < recentWins);
});

test("mount expansion filters show their level caps", async () => {
  const page = await readFile(pageUrl, "utf8");

  for (const [expansion, levelCap] of [
    ["A Realm Reborn", 50],
    ["Heavensward", 60],
    ["Stormblood", 70],
    ["Shadowbringers", 80],
    ["Endwalker", 90],
    ["Dawntrail", 100]
  ]) {
    assert.match(page, new RegExp(`"${expansion}":? ${levelCap}|${expansion}: ${levelCap}`));
  }

  assert.ok((page.match(/getMountExpansionFilterLabel\(mountSet\.expansion\)/g) || []).length >= 2);
});

test("recent mount wins starts collapsed", async () => {
  const page = await readFile(pageUrl, "utf8");
  const recentWinsStart = page.indexOf('className="tracker-collapsible mount-wins-panel"');
  const recentWinsSummary = page.indexOf('<summary className="tracker-collapsible-summary">', recentWinsStart);
  const openingTag = page.slice(recentWinsStart, recentWinsSummary);

  assert.ok(recentWinsStart >= 0);
  assert.doesNotMatch(openingTag, /\bopen(?:=|\s|>)/);
});
