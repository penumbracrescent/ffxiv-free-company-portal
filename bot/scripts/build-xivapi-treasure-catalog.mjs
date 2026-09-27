import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { hashTreasureMapImage } from "../treasure-map-image.mjs";

const API = "https://v2.xivapi.com/api";
const rankFields = "ItemName.Name,MaxPartySize";
const spotFields = "Location.Map.PlaceName.Name,Location.Map.Id,Location.Map.OffsetX,Location.Map.OffsetY,Location.Map.SizeFactor,Location.X,Location.Z";

async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

function slug(name) {
  return String(name).toLowerCase().replace(/^timeworn /, "").replace(/ map$/, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function coordinate(raw, offset, size) {
  return Math.floor((((raw + offset) * size / 100 / 50) + 21.5) * 10) / 10;
}

function pixel(raw, offset, size) {
  return (raw + offset) * size / 100 + 1024;
}

const rankDocument = await json(`${API}/sheet/TreasureHuntRank?limit=100&fields=${encodeURIComponent(rankFields)}`);
const ranks = rankDocument.rows.map((row) => ({
  id: row.row_id,
  name: row.fields.ItemName?.fields?.Name || "",
  partySize: Number(row.fields.MaxPartySize || 0)
})).filter((rank) => rank.name && [1, 4, 8].includes(rank.partySize));

const rows = [];
for (const rank of ranks) {
  const after = Math.max(0, rank.id - 1);
  const document = await json(`${API}/sheet/TreasureSpot?after=${after}&limit=500&fields=${encodeURIComponent(spotFields)}`);
  for (const row of document.rows.filter((entry) => entry.row_id === rank.id)) rows.push({ ...row, rank });
}

const maps = new Map();
for (const row of rows) {
  const id = row.fields.Location?.fields?.Map?.fields?.Id;
  if (!id || maps.has(id)) continue;
  const response = await fetch(`${API}/asset/map/${id}`);
  if (!response.ok) throw new Error(`${response.status} map asset ${id}`);
  maps.set(id, Buffer.from(await response.arrayBuffer()));
}

const references = [];
for (const row of rows) {
  const location = row.fields.Location?.fields;
  const map = location?.Map?.fields;
  if (!map?.Id || !location || !maps.has(map.Id)) continue;
  const source = maps.get(map.Id);
  const metadata = await sharp(source).metadata();
  const cropWidth = 320;
  const cropHeight = Math.round(cropWidth * 174 / 207);
  const centerX = pixel(Number(location.X), Number(map.OffsetX), Number(map.SizeFactor));
  const centerY = pixel(Number(location.Z), Number(map.OffsetY), Number(map.SizeFactor));
  const left = Math.max(0, Math.min((metadata.width || 2048) - cropWidth, Math.round(centerX - cropWidth / 2)));
  const top = Math.max(0, Math.min((metadata.height || 2048) - cropHeight, Math.round(centerY - cropHeight / 2)));
  const crop = await sharp(source).extract({ left, top, width: cropWidth, height: cropHeight }).jpeg({ quality: 88 }).toBuffer();
  references.push({
    sourceKey: `xivapi-r${row.row_id}-s${row.subrow_id}`,
    mapType: slug(row.rank.name),
    mapName: row.rank.name,
    partySize: row.rank.partySize,
    zoneName: map.PlaceName?.fields?.Name || "",
    x: coordinate(Number(location.X), Number(map.OffsetX), Number(map.SizeFactor)),
    y: coordinate(Number(location.Z), Number(map.OffsetY), Number(map.SizeFactor)),
    imageHash: await hashTreasureMapImage(crop, { reference: true }),
    referenceKind: "generated"
  });
}

const output = new URL("../data/treasure-maps/xivapi-generated.json", import.meta.url);
await mkdir(new URL("../data/treasure-maps/", import.meta.url), { recursive: true });
await writeFile(output, `${JSON.stringify({ source: { name: "XIVAPI", url: "https://v2.xivapi.com", version: rankDocument.version }, references }, null, 2)}\n`);
console.log(`Wrote ${references.length} references across ${ranks.length} map families and ${maps.size} zone maps.`);
