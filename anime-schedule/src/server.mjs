import http from "node:http";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { listPlatforms, listReleases, outputFeed, recordOutputRun, saveExternalMapping, sourceHealth, staleOutputMappings, syncStatus } from "./queries.mjs";
import { runSync } from "./sync.mjs";
import { syncGoogleCalendar, testGoogleCalendarAccess } from "./google.mjs";

function json(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body), "cache-control": "no-store" });
  response.end(body);
}

function authorized(request, config) {
  return Boolean(config.apiToken) && request.headers["x-anime-service-token"] === config.apiToken;
}

async function body(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 65536) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function dateRange(url) {
  const from = url.searchParams.get("from") || new Date(Date.now() - 86400000).toISOString();
  const to = url.searchParams.get("to") || new Date(Date.now() + 90 * 86400000).toISOString();
  if (!Number.isFinite(new Date(from).getTime()) || !Number.isFinite(new Date(to).getTime())) throw new Error("Invalid date range.");
  return { from, to };
}

function nextScheduledAt(config, now = new Date()) {
  const [targetHour, targetMinute] = config.dailySyncTime.split(":").map(Number);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const start = Math.floor(now.getTime() / 60000) * 60000 + 60000;
  for (let offset = 0; offset <= 48 * 60; offset += 1) {
    const candidate = new Date(start + offset * 60000);
    const parts = Object.fromEntries(formatter.formatToParts(candidate).map((part) => [part.type, part.value]));
    if (Number(parts.hour) === targetHour && Number(parts.minute) === targetMinute) return candidate.toISOString();
  }
  return null;
}
export function createServer(config) {
  let backgroundSyncPromise = null;
  let backgroundSync = { status: "idle", startedAt: null, completedAt: null, error: null };

  function startBackgroundSync({ sourceKey = null } = {}) {
    if (backgroundSyncPromise) return false;
    backgroundSync = { status: "running", startedAt: new Date().toISOString(), completedAt: null, error: null };
    backgroundSyncPromise = (async () => {
      try {
        const result = await runSync(config, { sourceKey, dryRun: false, kind: "api-background" });
        if (!result.skipped && config.googleEnabled) {
          const googleStartedAt = new Date();
          try {
            result.google = await syncGoogleCalendar(config);
            await recordOutputRun({ outputKey: "google", status: "success", dryRun: config.googleDryRun, summary: result.google, startedAt: googleStartedAt });
          } catch (error) {
            await recordOutputRun({ outputKey: "google", status: "failed", dryRun: config.googleDryRun, summary: {}, error, startedAt: googleStartedAt }).catch(() => undefined);
            throw error;
          }
        }
        backgroundSync = { status: result.skipped ? "skipped" : "success", startedAt: backgroundSync.startedAt, completedAt: new Date().toISOString(), error: result.skipped ? result.reason : null };
      } catch (error) {
        console.error("[anime-schedule] Background manual sync failed:", error);
        backgroundSync = { status: "failed", startedAt: backgroundSync.startedAt, completedAt: new Date().toISOString(), error: String(error.message || error) };
      } finally {
        backgroundSyncPromise = null;
      }
    })();
    return true;
  }

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
      if (request.method === "GET" && url.pathname === "/health") {
        return json(response, 200, { ok: true, service: "anime-schedule", timezone: config.timezone, sources: await sourceHealth() });
      }
      if (request.method === "GET" && url.pathname === "/api/status") {
        if (!authorized(request, config)) return json(response, 401, { error: "Unauthorized" });
        const configuredOfficialFeeds = Object.values(config.officialFeedUrls || {}).filter(Boolean).length;
        return json(response, 200, {
          ok: true,
          timezone: config.timezone,
          dailySyncTime: config.dailySyncTime,
          nextScheduledAt: nextScheduledAt(config),
          backgroundSync,
          discord: { enabled: config.discordEnabled, languages: config.discordLanguages, horizonDays: config.discordHorizonDays },
          sourceConfiguration: {
            animeScheduleTokenConfigured: Boolean(config.animeScheduleToken),
            officialFeedCount: configuredOfficialFeeds,
            ready: Boolean(config.animeScheduleToken) || configuredOfficialFeeds > 0
          },
          google: { enabled: config.googleEnabled, dryRun: config.googleDryRun, credentialsConfigured: Boolean(config.googleCredentialsFile) && existsSync(config.googleCredentialsFile), languages: config.googleLanguages, calendars: { sub: { configured: Boolean(config.googleCalendarIds?.sub) }, dub: { configured: Boolean(config.googleCalendarIds?.dub) } } },
          ...(await syncStatus(config.discordHorizonDays))
        });
      }
      if (request.method === "GET" && url.pathname === "/api/platforms") return json(response, 200, { platforms: await listPlatforms() });
      if (request.method === "GET" && ["/api/releases", "/api/upcoming"].includes(url.pathname)) {
        const range = dateRange(url);
        const platforms = url.searchParams.getAll("platform").flatMap((value) => value.split(",")).map((v) => v.trim().toLowerCase()).filter(Boolean);
        const releases = await listReleases({ ...range, language: url.searchParams.get("language") || "all", platforms }, config.websiteLanguages);
        return json(response, 200, { timezone: config.timezone, ...range, releases });
      }
      if (request.method === "PUT" && url.pathname === "/api/settings/animeschedule-token") {
        if (!authorized(request, config)) return json(response, 401, { error: "Unauthorized" });
        const payload = await body(request);
        const token = String(payload.token || "").trim();
        if (!token || token.length > 2048) return json(response, 400, { error: "Enter a valid AnimeSchedule application token." });
        if (!config.animeScheduleTokenFile) return json(response, 500, { error: "AnimeSchedule token storage is not configured." });
        await mkdir(dirname(config.animeScheduleTokenFile), { recursive: true });
        await writeFile(config.animeScheduleTokenFile, `${token}\n`, { encoding: "utf8", mode: 0o600 });
        config.animeScheduleToken = token;
        return json(response, 200, { ok: true, configured: true });
      }
      if (request.method === "GET" && url.pathname === "/api/outputs/discord") {
        if (!authorized(request, config)) return json(response, 401, { error: "Unauthorized" });
        const options = { kind: "discord", languages: config.discordLanguages, horizonDays: config.discordHorizonDays };
        const [releases, staleMappings] = await Promise.all([outputFeed(options), staleOutputMappings(options)]);
        return json(response, 200, { releases, staleMappings });
      }
      if (request.method === "POST" && url.pathname === "/api/outputs/discord/report") {
        if (!authorized(request, config)) return json(response, 401, { error: "Unauthorized" });
        const payload = await body(request);
        const status = payload.status === "success" ? "success" : "failed";
        const startedAt = payload.startedAt && Number.isFinite(new Date(payload.startedAt).getTime()) ? new Date(payload.startedAt) : new Date();
        const error = payload.error ? new Error(String(payload.error)) : null;
        await recordOutputRun({ outputKey: "discord", status, dryRun: false, summary: payload.summary || {}, error, startedAt });
        return json(response, 200, { ok: true });
      }
      if (request.method === "GET" && url.pathname === "/api/outputs/google") {
        if (!authorized(request, config)) return json(response, 401, { error: "Unauthorized" });
        return json(response, 200, { releases: await outputFeed({ kind: "google", languages: config.googleLanguages, horizonDays: 90 }) });
      }
      if (request.method === "PUT" && url.pathname === "/api/external-mappings") {
        if (!authorized(request, config)) return json(response, 401, { error: "Unauthorized" });
        const payload = await body(request);
        if (!["google", "discord"].includes(payload.kind) || !payload.releaseId || !payload.externalEventId) return json(response, 400, { error: "Invalid mapping." });
        await saveExternalMapping(payload); return json(response, 200, { ok: true });
      }
      if (request.method === "POST" && url.pathname === "/api/outputs/google/test") {
        if (!authorized(request, config)) return json(response, 401, { error: "Unauthorized" });
        const startedAt = new Date();
        try {
          const access = await testGoogleCalendarAccess(config);
          const dryRun = await syncGoogleCalendar(config, { dryRun: true });
          const result = { access, dryRun };
          await recordOutputRun({ outputKey: "google", status: "success", dryRun: true, summary: result, startedAt });
          return json(response, 200, result);
        } catch (error) {
          await recordOutputRun({ outputKey: "google", status: "failed", dryRun: true, summary: {}, error, startedAt }).catch(() => undefined);
          throw error;
        }
      }
      if (request.method === "POST" && url.pathname === "/api/outputs/google/sync") {
        if (!authorized(request, config)) return json(response, 401, { error: "Unauthorized" });
        const payload = await body(request);
        return json(response, 200, await syncGoogleCalendar(config, { dryRun: payload.dryRun !== false }));
      }
      if (request.method === "POST" && url.pathname === "/api/sync/start") {
        if (!authorized(request, config)) return json(response, 401, { error: "Unauthorized" });
        const payload = await body(request);
        const started = startBackgroundSync({ sourceKey: payload.sourceKey || null });
        return json(response, started ? 202 : 200, { started, backgroundSync });
      }
      if (request.method === "POST" && url.pathname === "/api/sync") {
        if (!authorized(request, config)) return json(response, 401, { error: "Unauthorized" });
        const payload = await body(request);
        const dryRun = payload.dryRun !== false;
        const result = await runSync(config, { sourceKey: payload.sourceKey || null, dryRun, kind: "api" });
        if (!dryRun && !result.skipped && config.googleEnabled) result.google = await syncGoogleCalendar(config);
        return json(response, 200, result);
      }
      return json(response, 404, { error: "Not found" });
    } catch (error) {
      console.error("[anime-schedule] API error:", error);
      return json(response, 500, { error: String(error.message || error) });
    }
  });
}
