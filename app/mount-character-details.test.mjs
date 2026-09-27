import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("mount character links target the detail panel while preserving tracker state", async () => {
  const component = await readFile(
    new URL("./app/components/MountCharacterProgressList.tsx", import.meta.url),
    "utf8"
  );
  const page = await readFile(new URL("./app/page.tsx", import.meta.url), "utf8");

  assert.match(component, /params\.set\("mountTrackerSearch", search\.trim\(\)\)/);
  assert.match(component, /params\.set\("mountTrackerRole", initialRole\)/);
  assert.match(component, /params\.set\("mountTrackerStatus", initialSyncStatus\)/);
  assert.match(component, /params\.append\("partyCharacterId", String\(id\)\)/);
  assert.match(component, /#mount-character-details/);
  assert.match(page, /id="mount-character-details" className="character-mount-detail-panel"/);
  assert.match(page, /buildMountTrackerHref\([\s\S]*?"mount-character-list"[\s\S]*?\)/);
  assert.match(page, /async function getCharacterMountDetails[\s\S]*?id in \(select id from portal_tracked_characters\)/);
});
