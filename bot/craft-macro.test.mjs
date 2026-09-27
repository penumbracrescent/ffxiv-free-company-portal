import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("/fae craftmacro stays ephemeral and discloses saved stats", async () => {
  const bot = await read("./bot.mjs");
  const commands = await read("./fae-commands.mjs");
  const craft = await read("./craft-macro.mjs");
  assert.match(commands, /setName\("craftmacro"\)/);
  assert.match(commands, /setAutocomplete\(true\)/);
  assert.match(commands, /Generate an ephemeral macro and save the entered crafter stats/);
  assert.match(bot, /isModalSubmit\(\).*fae:craftmacro/);
  assert.match(craft, /showModal\(modal\)/);
  assert.match(craft, /MessageFlags\.Ephemeral/);
  assert.match(craft, /Craftsmanship \(saved\)/);
  assert.doesNotMatch(craft, /channel\.send|followUp/);
});

test("Discord macros reuse stable per-job preferences with safeguards", async () => {
  const craft = await read("./craft-macro.mjs");
  assert.match(craft, /portal_crafter_profiles/);
  assert.match(craft, /on conflict\(discord_user_id,craft_job\)/);
  assert.match(craft, /fc\.item_id=p\.preferred_food_item_id/);
  assert.match(craft, /applyBonuses/);
  assert.match(craft, /async function recommendations/);
  assert.match(craft, /Consumables for this macro/);
  assert.match(craft, /Consumables that can improve quality/);
  assert.match(craft, /Use with this macro/);
  assert.match(craft, /suggested\.map/);
  assert.match(craft, /Woodworking: "Carpenter"/);
  assert.match(craft, /result\.rows\[0\]\.job = normalizeJob/);
  assert.match(craft, /SOLVE_COOLDOWN_MS/);
  assert.match(craft, /Date\.now\(\) < deadlineAt/);
  assert.match(craft, /run\(true, 100, true\)/);
  assert.match(craft, /sim\.quality > best\.sim\.quality/);
  assert.match(craft, /target === 0 \|\| sim\.quality >= target/);
  assert.doesNotMatch(craft, /if \(best\) break;/);
  assert.match(craft, /Date\.now\(\) \+ 15000/);
  assert.match(craft, /depth < 45/);
  assert.match(craft, /slice\(0, 300\)/);
  assert.match(craft, /FocusedTouch/);
  assert.match(craft, /FocusedSynthesis/);
  assert.match(craft, /index \+= 15/);
  for (const risky of ["RapidSynthesis", "HastyTouch", "DaringTouch", "PreciseTouch", "IntensiveSynthesis"]) {
    assert.doesNotMatch(craft.match(/const ACTION_NAMES = \[([^;]+)/s)?.[1] || "", new RegExp("\\\"" + risky + "\\\""));
  }
});
