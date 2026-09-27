import sharp from "sharp";

const MAX_ANALYSIS_EDGE = 640;

function isParchment(r, g, b) {
  const brightest = Math.max(r, g, b);
  const darkest = Math.min(r, g, b);
  return r >= 72 && g >= 58 && b <= 218 && r >= b * 0.88 && g >= b * 0.78 && brightest - darkest <= 150;
}

function findParchmentCandidates(data, width, height, channels) {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i += 1) {
    const offset = i * channels;
    mask[i] = isParchment(data[offset], data[offset + 1], data[offset + 2]) ? 1 : 0;
  }

  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  const candidates = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    let count = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      count += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      if (x > 0) {
        const next = index - 1;
        if (mask[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
      }
      if (x + 1 < width) {
        const next = index + 1;
        if (mask[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
      }
      if (y > 0) {
        const next = index - width;
        if (mask[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
      }
      if (y + 1 < height) {
        const next = index + width;
        if (mask[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
      }
    }
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    const area = boxWidth * boxHeight;
    const aspect = boxWidth / boxHeight;
    const fill = count / Math.max(1, area);
    if (area < width * height * 0.025 || aspect < 0.72 || aspect > 1.62 || fill < 0.18) continue;
    const shape = 1 - Math.min(1, Math.abs(aspect - 1.19) / 1.19);
    const score = area * (0.55 + fill) * (0.7 + shape);
    candidates.push({ minX, maxX, minY, maxY, score });
  }
  return candidates.sort((a, b) => b.score - a.score);
}

async function isolateTreasureMapCandidates(buffer) {
  const base = sharp(buffer, { failOn: "warning" }).rotate();
  const metadata = await base.metadata();
  if (!metadata.width || !metadata.height) throw new Error("The image dimensions could not be read.");
  const analysis = await base.clone().resize({ width: MAX_ANALYSIS_EDGE, height: MAX_ANALYSIS_EDGE, fit: "inside", withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const candidates = findParchmentCandidates(analysis.data, analysis.info.width, analysis.info.height, analysis.info.channels);
  const original = await base.toBuffer();
  if (!candidates.length) return { original, buffers: [] };
  const scaleX = metadata.width / analysis.info.width;
  const scaleY = metadata.height / analysis.info.height;
  const buffers = [];
  for (const bounds of candidates.slice(0, 8)) {
    const paddingX = Math.max(2, Math.round((bounds.maxX - bounds.minX + 1) * 0.025));
    const paddingY = Math.max(2, Math.round((bounds.maxY - bounds.minY + 1) * 0.025));
    const left = Math.max(0, Math.floor((bounds.minX - paddingX) * scaleX));
    const top = Math.max(0, Math.floor((bounds.minY - paddingY) * scaleY));
    const right = Math.min(metadata.width, Math.ceil((bounds.maxX + paddingX + 1) * scaleX));
    const bottom = Math.min(metadata.height, Math.ceil((bounds.maxY + paddingY + 1) * scaleY));
    buffers.push(await sharp(original).extract({ left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) }).toBuffer());
  }
  return { original, buffers };
}

async function isolateTreasureMapWithDetection(buffer) {
  const detected = await isolateTreasureMapCandidates(buffer);
  return detected.buffers.length ? { buffer: detected.buffers[0], found: true } : { buffer: detected.original, found: false };
}

export async function isolateTreasureMap(buffer) {
  return (await isolateTreasureMapWithDetection(buffer)).buffer;
}

async function findCenteredRedMarker(buffer, { embedded = false } = {}) {
  const { data, info } = await sharp(buffer).resize({ width: 320, height: 320, fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const mask = new Uint8Array(info.width * info.height);
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * info.channels;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    mask[index] = r > 88 && g < 105 && b < 100 && r - g > 32 ? 1 : 0;
  }
  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    let count = 0;
    let minX = info.width;
    let maxX = 0;
    let minY = info.height;
    let maxY = 0;
    let sumX = 0;
    let sumY = 0;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const index = queue[head++];
      const x = index % info.width;
      const y = Math.floor(index / info.width);
      count += 1;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (const next of [x > 0 ? index - 1 : -1, x + 1 < info.width ? index + 1 : -1, y > 0 ? index - info.width : -1, y + 1 < info.height ? index + info.width : -1]) {
        if (next >= 0 && mask[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
      }
    }
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const centerX = sumX / Math.max(1, count);
    const centerY = sumY / Math.max(1, count);
    const centerTolerance = embedded ? 0.22 : 0.18;
    const nearCenter = Math.abs(centerX / info.width - 0.5) <= centerTolerance && Math.abs(centerY / info.height - 0.5) <= centerTolerance;
    const markerSized = embedded
      ? count >= 25 && width / info.width >= 0.035 && width / info.width <= 0.12 && height / info.height >= 0.02 && height / info.height <= 0.12
      : count >= 45 && width / info.width >= 0.045 && width / info.width <= 0.18 && height / info.height >= 0.045 && height / info.height <= 0.18;
    if (nearCenter && markerSized) return { centerX: centerX / info.width, centerY: centerY / info.height, width: width / info.width, height: height / info.height };
  }
  return null;
}

async function refineCardAroundMarker(buffer, marker) {
  const metadata = await sharp(buffer).metadata();
  const sourceWidth = metadata.width || 1;
  const sourceHeight = metadata.height || 1;
  const centerX = marker.centerX * sourceWidth;
  const centerY = marker.centerY * sourceHeight;
  const estimatedWidth = Math.min(sourceWidth, Math.max(sourceWidth * 0.42, marker.width * sourceWidth * 9.4));
  const estimatedHeight = Math.min(sourceHeight, Math.max(sourceHeight * 0.58, marker.height * sourceHeight * 8.7));
  const left = Math.max(0, Math.min(sourceWidth - Math.round(estimatedWidth), Math.round(centerX - estimatedWidth / 2)));
  const top = Math.max(0, Math.min(sourceHeight - Math.round(estimatedHeight), Math.round(centerY - estimatedHeight / 2)));
  return sharp(buffer).extract({ left, top, width: Math.round(estimatedWidth), height: Math.round(estimatedHeight) }).toBuffer();
}

async function refineEmbeddedCardAroundMarker(buffer, marker) {
  const metadata = await sharp(buffer).metadata();
  const sourceWidth = metadata.width || 1;
  const sourceHeight = metadata.height || 1;
  const centerX = marker.centerX * sourceWidth;
  const centerY = marker.centerY * sourceHeight;
  const estimatedWidth = Math.min(sourceWidth, Math.max(80, marker.width * sourceWidth * 10.8));
  const estimatedHeight = Math.min(sourceHeight, Math.max(64, estimatedWidth / 1.19));
  const left = Math.max(0, Math.min(sourceWidth - Math.round(estimatedWidth), Math.round(centerX - estimatedWidth / 2)));
  const top = Math.max(0, Math.min(sourceHeight - Math.round(estimatedHeight), Math.round(centerY - estimatedHeight / 2 + estimatedHeight * 0.03)));
  return sharp(buffer).extract({ left, top, width: Math.round(estimatedWidth), height: Math.round(estimatedHeight) }).toBuffer();
}

async function parchmentCoverage(buffer) {
  const { data, info } = await sharp(buffer).resize({ width: 180, height: 180, fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let parchment = 0;
  for (let index = 0; index < info.width * info.height; index += 1) {
    const offset = index * info.channels;
    if (isParchment(data[offset], data[offset + 1], data[offset + 2])) parchment += 1;
  }
  return parchment / Math.max(1, info.width * info.height);
}

export async function analyzeTreasureMapImage(buffer) {
  const detected = await isolateTreasureMapCandidates(buffer);
  if (!detected.buffers.length) return { isMap: false, card: detected.original };
  for (const candidate of detected.buffers) {
    const marker = await findCenteredRedMarker(candidate);
    if (marker) return { isMap: true, card: await refineCardAroundMarker(candidate, marker) };
  }
  const embeddedMarker = await findCenteredRedMarker(detected.original, { embedded: true });
  if (embeddedMarker) {
    const embeddedCard = await refineEmbeddedCardAroundMarker(detected.original, embeddedMarker);
    if (await parchmentCoverage(embeddedCard) >= 0.3) return { isMap: true, card: embeddedCard };
  }
  return { isMap: false, card: detected.buffers[0] };
}

async function cropScreenshotFrame(buffer) {
  const metadata = await sharp(buffer).metadata();
  const left = Math.max(1, Math.round(metadata.width * 0.05));
  const top = Math.max(1, Math.round(metadata.height * 0.10));
  const bottom = Math.max(1, Math.round(metadata.height * 0.105));
  return sharp(buffer).extract({ left, top, width: metadata.width - left * 2, height: metadata.height - top - bottom }).toBuffer();
}

export async function hashTreasureMapImage(buffer, { reference = false } = {}) {
  const isolated = reference ? buffer : await analyzeTreasureMapImage(buffer).then((result) => cropScreenshotFrame(result.card));
  const { data } = await sharp(isolated)
    .resize(48, 40, { fit: "fill" })
    .greyscale()
    .normalise()
    .blur(0.4)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return `tm2:${data.toString("base64")}`;
}

export function treasureHashDistance(first, second) {
  const confidence = treasureHashConfidence(first, second);
  return confidence > 0 ? 1 - confidence : Number.POSITIVE_INFINITY;
}

function legacyHashConfidence(first, second) {
  if (!/^[0-9a-f]+$/i.test(first) || !/^[0-9a-f]+$/i.test(second) || first.length !== second.length) return 0;
  let value = BigInt(`0x${first}`) ^ BigInt(`0x${second}`);
  let count = 0;
  while (value) { count += Number(value & 1n); value >>= 1n; }
  return Math.max(0, 1 - count / (first.length * 4));
}

export function treasureHashConfidence(first, second) {
  if (!String(first).startsWith("tm2:") || !String(second).startsWith("tm2:")) return legacyHashConfidence(first, second);
  const a = Buffer.from(first.slice(4), "base64");
  const b = Buffer.from(second.slice(4), "base64");
  if (!a.length || a.length !== b.length) return 0;
  let meanA = 0;
  let meanB = 0;
  for (let index = 0; index < a.length; index += 1) { meanA += a[index]; meanB += b[index]; }
  meanA /= a.length;
  meanB /= b.length;
  let numerator = 0;
  let varianceA = 0;
  let varianceB = 0;
  for (let index = 0; index < a.length; index += 1) {
    const deltaA = a[index] - meanA;
    const deltaB = b[index] - meanB;
    numerator += deltaA * deltaB;
    varianceA += deltaA * deltaA;
    varianceB += deltaB * deltaB;
  }
  if (!varianceA || !varianceB) return 0;
  return Math.max(0, Math.min(1, (numerator / Math.sqrt(varianceA * varianceB) + 1) / 2));
}
