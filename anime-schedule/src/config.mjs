import { readFileSync } from "node:fs";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function secretFile(path) {
  if (!path) return "";
  try {
    return readFileSync(path, "utf8").trim();
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

function integer(name, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(process.env[name] || String(fallback), 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return parsed;
}

function boolean(name, fallback = false) {
  const value = process.env[name];
  return value == null ? fallback : TRUE_VALUES.has(String(value).trim().toLowerCase());
}

function list(name, fallback = []) {
  const value = process.env[name];
  if (!value) return [...fallback];
  return value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function jsonObject(name) {
  const value = process.env[name];
  if (!value) return {};
  const parsed = JSON.parse(value);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error(`${name} must be a JSON object.`);
  return parsed;
}
function time(name, fallback) {
  const value = String(process.env[name] || fallback).trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error(`${name} must use HH:MM.`);
  return value;
}

const animeScheduleTokenFile = process.env.ANIME_SCHEDULE_TOKEN_FILE || "/run/anime-secrets/anime-schedule-token";

export const config = {
  port: integer("PORT", 8080, { min: 1, max: 65535 }),
  databaseUrl: process.env.ANIME_DATABASE_URL || process.env.DATABASE_URL || "",
  timezone: process.env.ANIME_TIMEZONE || "America/Chicago",
  dailySyncTime: time("ANIME_DAILY_SYNC_TIME", "04:15"),
  retryIntervalHours: integer("ANIME_RETRY_INTERVAL_HOURS", 3, { min: 1, max: 24 }),
  retryCount: integer("ANIME_RETRY_COUNT", 3, { min: 0, max: 12 }),
  retentionDays: integer("ANIME_RETENTION_DAYS", 365, { min: 30, max: 3650 }),
  cacheRetentionDays: integer("ANIME_CACHE_RETENTION_DAYS", 30, { min: 1, max: 365 }),
  descriptionRefreshDays: integer("ANIME_DESCRIPTION_REFRESH_DAYS", 30, { min: 1, max: 365 }),
  apiToken: process.env.ANIME_SERVICE_API_TOKEN || "",
  syncOnStartup: boolean("ANIME_SYNC_ON_STARTUP", true),
  sourceNames: list("ANIME_SOURCES", ["animeschedule"]),
  animeScheduleTokenFile,
  animeScheduleToken: secretFile(animeScheduleTokenFile) || process.env.ANIME_SCHEDULE_TOKEN || "",
  officialFeedUrls: jsonObject("ANIME_OFFICIAL_FEED_URLS"),
  animeScheduleBaseUrl: process.env.ANIME_SCHEDULE_BASE_URL || "https://animeschedule.net/api/v3",
  weeksBehind: integer("ANIME_WEEKS_BEHIND", 1, { min: 0, max: 4 }),
  weeksAhead: integer("ANIME_WEEKS_AHEAD", 8, { min: 1, max: 26 }),
  websiteLanguages: list("ANIME_WEBSITE_LANGUAGES", ["sub", "dub"]),
  googleEnabled: boolean("ANIME_GOOGLE_ENABLED", false),
  googleLanguages: list("ANIME_GOOGLE_LANGUAGES", ["sub", "dub"]),
  googleCalendarIds: Object.freeze({
    sub: process.env.ANIME_GOOGLE_SUB_CALENDAR_ID || "",
    dub: process.env.ANIME_GOOGLE_DUB_CALENDAR_ID || process.env.ANIME_GOOGLE_CALENDAR_ID || ""
  }),
  googleCredentialsFile: process.env.ANIME_GOOGLE_CREDENTIALS_FILE || "",
  googleDryRun: boolean("ANIME_GOOGLE_DRY_RUN", true),
  discordEnabled: boolean("ANIME_DISCORD_ENABLED", false),
  discordLanguages: list("ANIME_DISCORD_LANGUAGES", ["sub", "dub"]),
  discordHorizonDays: integer("ANIME_DISCORD_HORIZON_DAYS", 3, { min: 1, max: 90 })
};

if (!config.databaseUrl) throw new Error("ANIME_DATABASE_URL or DATABASE_URL is required.");
