import { addWeeksToIsoWeek, isoWeek } from "../time.mjs";
import { SOURCE_PRIORITY } from "../policy.mjs";

const PLATFORM_NAMES = Object.freeze({
  crunchyroll: "Crunchyroll",
  hidive: "HIDIVE",
  oceanveil: "OceanVeil",
  netflix: "Netflix",
  hulu: "Hulu",
  disney: "Disney+",
  disneyplus: "Disney+",
  amazon: "Prime Video",
  prime: "Prime Video",
  primevideo: "Prime Video"
});

function platformKey(value) {
  const normalized = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (normalized.includes("crunchyroll")) return "crunchyroll";
  if (normalized.includes("hidive")) return "hidive";
  if (normalized.includes("oceanveil")) return "oceanveil";
  if (normalized.includes("netflix")) return "netflix";
  if (normalized.includes("hulu")) return "hulu";
  if (normalized.includes("disney")) return "disney";
  if (normalized.includes("amazon") || normalized.includes("primevideo")) return "amazon";
  return normalized || "unknown";
}

function streamsFor(row) {
  const values = Array.isArray(row.streams) ? row.streams : row.streams ? [row.streams] : [];
  const deduped = new Map();
  for (const stream of values) {
    const key = platformKey(stream.platform || stream.name);
    if (key === "unknown") continue;
    deduped.set(key, {
      platformKey: key,
      displayName: PLATFORM_NAMES[key] || stream.name || stream.platform || key,
      sourceUrl: /^https?:\/\//i.test(String(stream.url || "")) ? stream.url : null,
      availableAt: row.episodeDate
    });
  }
  return [...deduped.values()];
}

export function descriptionText(value) {
  return String(value || "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, 5000);
}

function rateLimitDelay(response) {
  const remaining = Number(response.headers.get("x-ratelimit-remaining"));
  const reset = Number(response.headers.get("x-ratelimit-reset"));
  if (!Number.isFinite(remaining) || remaining > 2) return 0;
  if (!Number.isFinite(reset)) return 61000;
  return Math.min(65000, Math.max(1000, reset * 1000 - Date.now() + 1000));
}

async function animeDetail(route, config) {
  const url = `${config.animeScheduleBaseUrl.replace(/\/$/, "")}/anime/${encodeURIComponent(route)}`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${config.animeScheduleToken}`, Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
    if (response.status === 404) return null;
    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, rateLimitDelay(response) || 61000));
      continue;
    }
    if (!response.ok) throw new Error(`AnimeSchedule detail returned HTTP ${response.status} for ${route}.`);
    const payload = await response.json();
    const delay = rateLimitDelay(response);
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    return payload;
  }
  throw new Error(`AnimeSchedule detail rate limit persisted for ${route}.`);
}

function toObservation(row, checkedAt, detail = null) {
  const language = String(row.airType || "").toLowerCase();
  if (!new Set(["sub", "dub"]).has(language)) return null;
  if (!row.episodeDate || !Number.isFinite(new Date(row.episodeDate).getTime())) return null;
  const episodeNumber = Number(row.episodeNumber);
  const firstEpisode = Number(row.subtractedEpisodeNumber);
  const isBatch = Number.isFinite(firstEpisode) && firstEpisode > 0 && firstEpisode < episodeNumber;
  const episodeLabel = isBatch ? `${firstEpisode}-${episodeNumber}` : Number.isFinite(episodeNumber) ? String(episodeNumber) : "Special";
  const delayedUntil = row.delayedUntil && !String(row.delayedUntil).startsWith("0001-01-01") ? new Date(row.delayedUntil) : null;
  const delayed = String(row.airingStatus || "").toLowerCase().includes("delay");
  const delayNote = row[`${language}DelayedTimetable`] || row.delayedTimetable || null;
  const released = String(row.airingStatus || "").toLowerCase() === "aired";
  return {
    sourceKey: "animeschedule",
    sourceRecordKey: `${row.route || row.title}:${language}:${episodeLabel}`,
    sourcePriority: SOURCE_PRIORITY.secondary,
    observedAt: checkedAt,
    sourceTimezone: "America/Chicago",
    sourceTimestamp: row.episodeDate,
    displayTitle: row.english || row.title || row.romaji || row.native,
    englishTitle: row.english || row.title || row.romaji || row.native,
    romajiTitle: row.romaji || null,
    nativeTitle: row.native || null,
    aliases: [row.title].filter(Boolean),
    imageUrl: row.imageVersionRoute ? `https://img.animeschedule.net/production/assets/public/img/${row.imageVersionRoute}` : null,
    sourceRoute: row.route || null,
    sourceUrl: row.route ? `https://animeschedule.net/anime/${row.route}` : null,
    description: descriptionText(detail?.description), 
    seriesStatus: row.status || "unknown",
    episodeNumber: Number.isFinite(episodeNumber) ? episodeNumber : null,
    episodeLabel,
    batchKey: isBatch ? episodeLabel : null,
    releaseKind: isBatch ? "batch" : "episode",
    language,
    status: delayed ? "delayed" : released ? "released" : "confirmed",
    delayedUntil: delayed && delayedUntil && Number.isFinite(delayedUntil.getTime()) ? delayedUntil.toISOString() : null,
    delayNote: delayed ? delayNote : null,
    startsAt: new Date(row.episodeDate).toISOString(),
    durationMinutes: Number(row.lengthMin) || null,
    confirmed: true,
    platforms: streamsFor(row),
    raw: row
  };
}

export function createAnimeScheduleSource(config) {
  return {
    key: "animeschedule",
    enabled: Boolean(config.animeScheduleToken),
    disabledReason: config.animeScheduleToken ? null : "ANIME_SCHEDULE_TOKEN is not configured.",
    async fetchObservations(context = {}) {
      const checkedAt = new Date().toISOString();
      const currentWeek = isoWeek(new Date());
      const observations = [];
      const timetableRows = [];
      const responses = [];
      for (let offset = -config.weeksBehind; offset <= config.weeksAhead; offset += 1) {
        const target = addWeeksToIsoWeek(currentWeek, offset);
        const url = new URL(`${config.animeScheduleBaseUrl.replace(/\/$/, "")}/timetables/all`);
        url.searchParams.set("year", String(target.year));
        url.searchParams.set("week", String(target.week));
        url.searchParams.set("tz", config.timezone);
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${config.animeScheduleToken}`, Accept: "application/json" },
          signal: AbortSignal.timeout(30000)
        });
        if (response.status === 404) {
          responses.push({ year: target.year, week: target.week, count: 0, available: false });
          continue;
        }
        if (!response.ok) throw new Error(`AnimeSchedule returned HTTP ${response.status} for ${target.year}-W${target.week}.`);
        const payload = await response.json();
        if (!Array.isArray(payload)) throw new Error("AnimeSchedule timetable response was not an array.");
        responses.push({ year: target.year, week: target.week, count: payload.length });
        timetableRows.push(...payload);
      }
      const freshRoutes = new Set(context.freshDescriptionRoutes || []);
      const routes = [...new Set(timetableRows.map((row) => String(row.route || "").trim()).filter(Boolean))];
      const details = new Map();
      const detailErrors = [];
      for (const route of routes) {
        if (freshRoutes.has(route)) continue;
        try {
          const detail = await animeDetail(route, config);
          if (detail) details.set(route, detail);
        } catch (error) {
          detailErrors.push({ route, error: String(error.message || error) });
        }
      }
      for (const row of timetableRows) {
        const observation = toObservation(row, checkedAt, details.get(row.route) || null);
        if (observation) observations.push(observation);
      }
      const unique = new Map(observations.map((item) => [item.sourceRecordKey, item]));
      return { observations: [...unique.values()], metadata: { checkedAt, responses, descriptionsFetched: details.size, descriptionErrors: detailErrors } };
    }
  };
}
