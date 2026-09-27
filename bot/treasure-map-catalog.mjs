import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { hashTreasureMapImage } from "./treasure-map-image.mjs";

export const TREASURE_MAP_SOURCE = {
  name: "FF14.tw Treasure Map Finder",
  url: "https://github.com/hydai/ff14.tw",
  license: "Apache-2.0",
  revision: "c0028a4ad60fea680ad4f58bec7f4e9a6fa13198"
};

export const XIVAPI_TREASURE_MAP_SOURCE = {
  name: "XIVAPI game data",
  url: "https://v2.xivapi.com",
  license: "Square Enix game data"
};

export const SUPPORTED_PARTY_GRADES = {
  g8: { mapType: "dragonskin", partySize: 8 },
  g10: { mapType: "gazelleskin", partySize: 8 },
  g12: { mapType: "zonureskin", partySize: 8 },
  g14: { mapType: "kumbhiraskin", partySize: 8 },
  g15: { mapType: "ophiotauroskin", partySize: 8 },
  g17: { mapType: "braaxskin", partySize: 8 },
  g18: { mapType: "gargantuaskin", partySize: 8 }
};

const dataRoot = new URL("./data/treasure-maps/", import.meta.url);

export function flattenEnglishZones(zoneDocument) {
  const result = new Map();
  for (const region of Object.values(zoneDocument?.zones || {})) {
    for (const zone of region?.subZones || []) result.set(zone.id, zone?.names?.en || zone.id);
  }
  return result;
}

export async function readBundledTreasureCatalog() {
  const [mapDocument, zoneDocument, generatedDocument, files] = await Promise.all([
    readFile(new URL("treasure-maps.json", dataRoot), "utf8").then(JSON.parse),
    readFile(new URL("zones.json", dataRoot), "utf8").then(JSON.parse),
    readFile(new URL("xivapi-generated.json", dataRoot), "utf8").then(JSON.parse),
    readdir(new URL("references/", dataRoot))
  ]);
  const zones = flattenEnglishZones(zoneDocument);
  const references = [];
  for (const entry of mapDocument.maps || []) {
    const grade = SUPPORTED_PARTY_GRADES[entry.level];
    if (!grade) continue;
    const filename = `${entry.level}_${entry.zoneId}_${String(entry.index).padStart(2, "0")}.webp`;
    if (!files.includes(filename)) throw new Error(`Bundled treasure reference is missing: ${filename}`);
    references.push({
      sourceKey: filename.replace(/\.webp$/i, ""),
      filename,
      mapType: grade.mapType,
      partySize: grade.partySize,
      zoneName: zones.get(entry.zoneId) || entry.zoneId,
      x: Number(entry.coords?.x),
      y: Number(entry.coords?.y),
      referenceKind: "exact",
      sourceName: TREASURE_MAP_SOURCE.name,
      sourceUrl: TREASURE_MAP_SOURCE.url
    });
  }
  for (const entry of generatedDocument.references || []) references.push({
    ...entry,
    sourceName: generatedDocument.source?.name || XIVAPI_TREASURE_MAP_SOURCE.name,
    sourceUrl: generatedDocument.source?.url || XIVAPI_TREASURE_MAP_SOURCE.url
  });
  return references;
}

export async function readBundledTreasureTypes() {
  const references = await readBundledTreasureCatalog();
  const types = new Map();
  for (const reference of references) {
    if (!types.has(reference.mapType)) types.set(reference.mapType, { value: reference.mapType, label: reference.mapName || reference.mapType, party: reference.partySize, zones: [] });
    const item = types.get(reference.mapType);
    if (reference.mapName) item.label = reference.mapName;
    if (!item.zones.includes(reference.zoneName)) item.zones.push(reference.zoneName);
  }
  return [...types.values()].map((item) => ({ ...item, zones: item.zones.sort() })).sort((a, b) => a.party - b.party || a.label.localeCompare(b.label));
}

async function ensureCatalogSchema(pool) {
  await pool.query(`
    alter table portal_treasure_map_references add column if not exists source_key text;
    alter table portal_treasure_map_references add column if not exists source_name text;
    alter table portal_treasure_map_references add column if not exists source_url text;
    alter table portal_treasure_map_references add column if not exists reference_kind text not null default 'exact';
    create unique index if not exists portal_treasure_map_reference_source_idx on portal_treasure_map_references(source_key) where source_key is not null;
    create table if not exists portal_treasure_map_catalog_state(
      id integer primary key default 1 check(id=1), source_revision text, status text not null,
      imported_locations integer not null default 0, last_error text, updated_at timestamptz not null default now()
    );
  `);
}

let bootstrapPromise;

async function runTreasureMapCatalogBootstrap(pool, { force = false } = {}) {
  await ensureCatalogSchema(pool);
  const references = await readBundledTreasureCatalog();
  const generatedRevision = JSON.parse(await readFile(new URL("xivapi-generated.json", dataRoot), "utf8")).source?.version || "unknown";
  const catalogRevision = `${TREASURE_MAP_SOURCE.revision}+xivapi-${generatedRevision}`;
  const state = (await pool.query("select * from portal_treasure_map_catalog_state where id=1")).rows[0];
  if (!force && state?.status === "ready" && state?.source_revision === catalogRevision && Number(state.imported_locations) === references.length) {
    return { imported: 0, total: references.length, current: true };
  }
  await pool.query(`insert into portal_treasure_map_catalog_state(id,source_revision,status,imported_locations,last_error,updated_at)
    values(1,$1,'importing',0,null,now()) on conflict(id) do update set source_revision=excluded.source_revision,status='importing',last_error=null,updated_at=now()`, [catalogRevision]);
  try {
    let imported = 0;
    for (const reference of references) {
      const imageHash = reference.imageHash || await readFile(new URL(`references/${reference.filename}`, dataRoot)).then((buffer) => hashTreasureMapImage(buffer, { reference: true }));
      await pool.query(`insert into portal_treasure_map_references(map_type,zone_name,coordinate_x,coordinate_y,party_size,image_hash,review_status,reviewed_by,reviewed_at,source_key,source_name,source_url,reference_kind)
        values($1,$2,$3,$4,$5,$6,'approved','bundled-catalog',now(),$7,$8,$9,$10)
        on conflict(source_key) where source_key is not null do update set map_type=excluded.map_type,zone_name=excluded.zone_name,coordinate_x=excluded.coordinate_x,coordinate_y=excluded.coordinate_y,party_size=excluded.party_size,image_hash=excluded.image_hash,review_status='approved',reviewed_by='bundled-catalog',reviewed_at=now(),source_name=excluded.source_name,source_url=excluded.source_url,reference_kind=excluded.reference_kind`,
        [reference.mapType, reference.zoneName, reference.x, reference.y, reference.partySize, imageHash, reference.sourceKey, reference.sourceName, reference.sourceUrl, reference.referenceKind || "exact"]);
      imported += 1;
    }
    await pool.query("update portal_treasure_map_catalog_state set status='ready',imported_locations=$1,last_error=null,updated_at=now() where id=1", [imported]);
    console.log(`[treasure-maps] Bundled catalog ready: ${imported} known solo and party-map locations.`);
    return { imported, total: imported, current: false };
  } catch (error) {
    await pool.query("update portal_treasure_map_catalog_state set status='failed',last_error=$1,updated_at=now() where id=1", [String(error?.message || error).slice(0, 1000)]).catch(() => null);
    throw error;
  }
}

export function bootstrapTreasureMapCatalog(pool, options = {}) {
  if (!options.force && bootstrapPromise) return bootstrapPromise;
  const operation = runTreasureMapCatalogBootstrap(pool, options);
  if (options.force) return operation;
  bootstrapPromise = operation.catch((error) => { bootstrapPromise = null; throw error; });
  return bootstrapPromise;
}

export function bundledReferencePath(filename) {
  return fileURLToPath(new URL(`references/${filename}`, dataRoot));
}
