import { createHash } from "node:crypto";

export function normalizeTitle(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function stableHash(...parts) {
  return createHash("sha256").update(parts.map((part) => String(part ?? "")).join("\u001f")).digest("hex").slice(0, 32);
}

export function seriesKey(observation) {
  const preferred = normalizeTitle(observation.englishTitle || observation.displayTitle || observation.romajiTitle || observation.nativeTitle);
  return `series_${stableHash(preferred)}`;
}

export function releaseKey(observation) {
  const identity = observation.batchKey || observation.episodeNumber || observation.episodeLabel || observation.releaseKind || "release";
  return `release_${stableHash(seriesKey(observation), observation.language, identity)}`;
}

export function allAliases(observation) {
  return [...new Set([
    observation.displayTitle,
    observation.englishTitle,
    observation.romajiTitle,
    observation.nativeTitle,
    ...(observation.aliases || [])
  ].map((item) => String(item || "").trim()).filter(Boolean))];
}
