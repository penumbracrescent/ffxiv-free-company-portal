import assert from "node:assert/strict";
import test from "node:test";
import { buildFaeCommand } from "./fae-commands.mjs";
import { matchKnownZone } from "./treasure-map-ocr.mjs";

test("treasure-map command requires an image and remains officer-disableable", () => {
  const command = buildFaeCommand().toJSON();
  const map = command.options.find((option) => option.name === "map");
  assert.ok(map);
  assert.equal(map.options[0].name, "image");
  assert.equal(map.options[0].required, true);
});

test("map matcher includes short-lived cache and reviewed training gates", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./treasure-maps.mjs", import.meta.url), "utf8"));
  assert.match(source, /interval '15 minutes'/);
  assert.match(source, /review_status='approved'/);
  assert.match(source, /Only the map uploader or an officer/);
  assert.match(source, /Confirm \/ Choose Location/);
  assert.match(source, /Correct Filters \/ Rescan/);
  assert.match(source, /view=guides&guide=treasure-map-identification#guides/);
  assert.match(source, /FFXIV materials © SQUARE ENIX/);
  assert.match(source, /error\?\.code==="NOT_TREASURE_MAP"\)return false/);
  assert.match(await import("node:fs/promises").then((fs) => fs.readFile(new URL("./treasure-map-image.mjs", import.meta.url), "utf8")), /candidates\.slice\(0, 8\)/);
  assert.match(await import("node:fs/promises").then((fs) => fs.readFile(new URL("./treasure-map-image.mjs", import.meta.url), "utf8")), /parchmentCoverage\(embeddedCard\) >= 0\.3/);
  assert.match(await import("node:fs/promises").then((fs) => fs.readFile(new URL("./treasure-map-image.mjs", import.meta.url), "utf8")), /estimatedHeight \* 0\.03/);
  assert.match(source, /zone_name=\$1 and party_size=\$2/);
  assert.match(source, /setCustomId\(`map:location:/);
  assert.match(source, /Confirm the marked location/);
  assert.doesNotMatch(source, /Enter different coordinates manually/);
  assert.match(source, /map:party:\$\{id\}/);
  assert.match(source, /selected_map_type/);
  assert.match(source, /Other known location/);
  assert.match(source, /officer\?"approved":"pending"/);
  assert.match(source, /administrator confirmation was approved immediately/);
  assert.match(source, /Treasure-map training approved/);
  assert.match(source, /\*\*Treasure map location\*\*/);
  assert.match(source, /readTreasureMapLabels\(image\.buffer,zones\)/);
  assert.match(await import("node:fs/promises").then((fs) => fs.readFile(new URL("./treasure-map-ocr.mjs", import.meta.url), "utf8")), /threshold\(180\)/);
  assert.match(await import("node:fs/promises").then((fs) => fs.readFile(new URL("./treasure-map-ocr.mjs", import.meta.url), "utf8")), /partyCrop\(0\.12, 0\.80, 0\.14/);
  assert.match(await import("node:fs/promises").then((fs) => fs.readFile(new URL("./treasure-map-ocr.mjs", import.meta.url), "utf8")), /PSM\.SINGLE_CHAR/);
  assert.match(await import("node:fs/promises").then((fs) => fs.readFile(new URL("./treasure-map-ocr.mjs", import.meta.url), "utf8")), /\^\[148\]\$/);
  assert.match(await import("node:fs/promises").then((fs) => fs.readFile(new URL("./treasure-map-ocr.mjs", import.meta.url), "utf8")), /confidence >= 25/);
  assert.match(await import("node:fs/promises").then((fs) => fs.readFile(new URL("./treasure-map-ocr.mjs", import.meta.url), "utf8")), /partyCrop\(0\.08, 0\.79/);
  assert.match(await import("node:fs/promises").then((fs) => fs.readFile(new URL("./treasure-map-ocr.mjs", import.meta.url), "utf8")), /partyCrop\(0\.17, 0\.82/);
  assert.match(source, /\*\*Closest known locations\*\*/);
  assert.match(source, /coordinate_x/);
  assert.doesNotMatch(source, /setLabel\("Other Possible Locations"\)/);
  assert.doesNotMatch(source, /action==="alternatives"/);
});

test("zone OCR tolerates small title artifacts but still requires a known zone", () => {
  const zones = ["The Tempest", "Mare Lamentorum", "Western Thanalan", "Mor Dhona", "Elpis"];
  assert.equal(matchKnownZone("The Tempest rT", zones)?.zone, "The Tempest");
  assert.equal(matchKnownZone("are Lamentory no", zones)?.zone, "Mare Lamentorum");
  assert.equal(matchKnownZone("Mor Dhons j", zones)?.zone, "Mor Dhona");
  assert.equal(matchKnownZone("er i Sk", zones), null);
  assert.equal(matchKnownZone("completely unrelated text", zones), null);
});
