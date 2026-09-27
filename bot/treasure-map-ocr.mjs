import sharp from "sharp";
import { createWorker, OEM, PSM } from "tesseract.js";
import english from "@tesseract.js-data/eng";

let workerPromise;
let recognitionQueue = Promise.resolve();

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function editDistance(first, second) {
  const a = normalize(first);
  const b = normalize(second);
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length];
}

export function matchKnownZone(text, zones) {
  const value = normalize(text);
  if (!value) return null;
  const ranked = [...new Set(zones)].map((zone) => {
    const candidate = normalize(zone);
    const direct = 1 - editDistance(value, candidate) / Math.max(value.length, candidate.length, 1);
    let windowed = 0;
    if (value.length >= candidate.length) {
      for (let start = 0; start <= value.length - candidate.length; start += 1) {
        const portion = value.slice(start, start + candidate.length);
        windowed = Math.max(windowed, 1 - editDistance(portion, candidate) / Math.max(candidate.length, 1));
      }
    }
    const score = Math.max(direct, windowed);
    return { zone, score };
  }).sort((a, b) => b.score - a.score);
  return ranked[0]?.score >= 0.68 ? ranked[0] : null;
}

async function getWorker() {
  if (!workerPromise) workerPromise = createWorker("eng", OEM.LSTM_ONLY, { ...english, cacheMethod: "none" }).catch((error) => { workerPromise = null; throw error; });
  return workerPromise;
}

async function performTreasureMapLabelRead(card, zones) {
  const metadata = await sharp(card).metadata();
  const width = metadata.width || 1;
  const height = metadata.height || 1;
  const zoneBox = { left: Math.max(0, Math.round(width * 0.012)), top: Math.max(0, Math.round(height * 0.015)), width: Math.min(width, Math.round(width * 0.84)), height: Math.min(height, Math.round(height * 0.19)) };
  const zoneBase = sharp(card).extract(zoneBox).resize({ width: 1400, kernel: "nearest" }).removeAlpha();
  const zoneImages = await Promise.all([
    zoneBase.clone().extractChannel(0).normalise().sharpen().threshold(110).png().toBuffer(),
    zoneBase.clone().extractChannel(0).normalise().sharpen().threshold(145).png().toBuffer(),
    zoneBase.clone().extractChannel(0).normalise().sharpen().threshold(165).png().toBuffer(),
    zoneBase.clone().extractChannel(0).normalise().sharpen().threshold(180).png().toBuffer()
  ]);
  const partyCrop = (left, top, cropWidth, cropHeight) => sharp(card)
    .extract({ left: Math.round(width * left), top: Math.round(height * top), width: Math.round(width * cropWidth), height: Math.round(height * cropHeight) })
    .resize({ width: 600, kernel: "nearest" })
    .greyscale().normalise().sharpen();
  const partyBase = partyCrop(0.12, 0.80, 0.14, 0.19);
  const partyImages = await Promise.all([
    partyBase.clone().png().toBuffer(),
    partyBase.clone().threshold(150).png().toBuffer()
  ]);
  const worker = await getWorker();
  const readings = [];
  const readZone = async (zoneImage) => {
    const result = await worker.recognize(zoneImage, { tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '-" });
    const candidate = matchKnownZone(result.data.text, zones);
    readings.push({ candidate, raw: String(result.data.text || "").trim() });
  };
  await readZone(zoneImages[0]);
  await readZone(zoneImages[1]);
  const firstNames = readings.map((reading) => reading.candidate?.zone).filter(Boolean);
  if (firstNames.length < 2 || new Set(firstNames).size !== 1) {
    await readZone(zoneImages[2]);
    await readZone(zoneImages[3]);
  }
  const rankedZones = new Map();
  for (const reading of readings) {
    if (!reading.candidate) continue;
    const current = rankedZones.get(reading.candidate.zone) || { zone: reading.candidate.zone, count: 0, bestScore: 0, raw: "" };
    current.count += 1;
    if (reading.candidate.score > current.bestScore) { current.bestScore = reading.candidate.score; current.raw = reading.raw; }
    rankedZones.set(current.zone, current);
  }
  const selected = [...rankedZones.values()].sort((a, b) => (b.bestScore + (b.count - 1) * 0.08) - (a.bestScore + (a.count - 1) * 0.08))[0] || null;
  const partyReadings = [];
  const readParty = async (images) => {
    for (const partyImage of images) {
      const partyResult = await worker.recognize(partyImage, { tessedit_pageseg_mode: PSM.SINGLE_CHAR, tessedit_char_whitelist: "148" });
      const raw = String(partyResult.data.text || "").trim();
      const value = /^[148]$/.test(raw) ? Number(raw) : null;
      const confidence = Number(partyResult.data.confidence || 0);
      if (value && confidence >= 25) partyReadings.push({ value, confidence });
    }
  };
  await readParty(partyImages);
  if (!partyReadings.length) {
    const iconWide = partyCrop(0.08, 0.79, 0.18, 0.18);
    const numberWide = partyCrop(0.10, 0.79, 0.18, 0.19);
    await readParty(await Promise.all([
      iconWide.threshold(180).png().toBuffer(),
      numberWide.threshold(150).png().toBuffer()
    ]));
  }
  if (!partyReadings.length) {
    const numberRight = partyCrop(0.17, 0.82, 0.12, 0.17);
    await readParty([await numberRight.threshold(180).png().toBuffer()]);
  }
  const partySize = partyReadings.sort((a, b) => b.confidence - a.confidence)[0]?.value || null;
  return { zoneName: selected?.zone || null, zoneConfidence: selected?.bestScore || 0, partySize, rawZone: selected?.raw || "" };
}

export function readTreasureMapLabels(card, zones) {
  const operation = recognitionQueue.then(() => performTreasureMapLabelRead(card, zones));
  recognitionQueue = operation.catch(() => undefined);
  return operation;
}

export async function closeTreasureMapOcr() {
  await recognitionQueue.catch(() => undefined);
  if (!workerPromise) return;
  const worker = await workerPromise.catch(() => null);
  workerPromise = null;
  await worker?.terminate();
}
