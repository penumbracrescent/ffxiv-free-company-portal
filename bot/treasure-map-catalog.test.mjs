import assert from "node:assert/strict";
import test from "node:test";
import { readBundledTreasureCatalog, readBundledTreasureTypes, SUPPORTED_PARTY_GRADES, TREASURE_MAP_SOURCE } from "./treasure-map-catalog.mjs";
import { hashTreasureMapImage, treasureHashConfidence } from "./treasure-map-image.mjs";
import { readFile } from "node:fs/promises";

test("bundled treasure catalog includes exact and official generated references", async () => {
  const catalog = await readBundledTreasureCatalog();
  assert.equal(catalog.filter((item) => item.referenceKind === "exact").length, 227);
  assert.ok(catalog.length > 1200);
  assert.equal(new Set(catalog.map((item) => item.sourceKey)).size, catalog.length);
  assert.ok(Object.values(SUPPORTED_PARTY_GRADES).every((grade) => catalog.some((item) => item.mapType === grade.mapType)));
  assert.ok(catalog.some((item) => item.partySize === 1));
  assert.ok(catalog.some((item) => item.partySize === 8));
  assert.ok(catalog.every((item) => [1,4,8].includes(item.partySize) && item.zoneName && Number.isFinite(item.x) && Number.isFinite(item.y)));
  assert.equal(TREASURE_MAP_SOURCE.license, "Apache-2.0");
});

test("correction catalog exposes every bundled map family", async () => {
  const types = await readBundledTreasureTypes();
  assert.ok(types.length >= 27);
  assert.ok(types.some((item) => item.value === "leather" && item.party === 1));
  assert.ok(types.some((item) => item.value === "braaxskin" && item.party === 8));
});

test("reference hashing is stable and uses a high-detail fingerprint", async () => {
  const image = await readFile(new URL("./data/treasure-maps/references/g12_lakeland_01.webp", import.meta.url));
  const first = await hashTreasureMapImage(image, { reference: true });
  const second = await hashTreasureMapImage(image, { reference: true });
  assert.equal(first, second);
  assert.match(first, /^tm2:/);
  assert.equal(treasureHashConfidence(first, second), 1);
});
