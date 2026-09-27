import { createHash } from "node:crypto";
import { GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel, GuildScheduledEventStatus } from "discord.js";
import { PORTAL_URL } from "./installation-config.mjs";

const RELEASE_CALENDAR_URL = new URL("?view=anime", PORTAL_URL).toString();

function hashPayload(payload) { return createHash("sha256").update(JSON.stringify(payload)).digest("hex"); }
function cleanText(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function eventName(release) {
  const episode = release.episode_label ? (String(release.episode_label).includes("-") ? `Episodes ${release.episode_label}` : `Episode ${release.episode_label}`) : "New Release";
  return `${release.english_title} — ${episode} (${String(release.language).toUpperCase()})`.slice(0, 100);
}
export function eventDescription(release) {
  const synopsis = cleanText(release.description) || "Synopsis not available yet.";
  return `Release calendar: ${RELEASE_CALENDAR_URL}\nTimes shown by Discord match each user's local timezone.\n\n${synopsis}`.slice(0, 1000);
}
function eventPayload(release) {
  const start = new Date(release.starts_at);
  const duration = Math.max(15, Number(release.duration_minutes || 30));
  return {
    name: eventName(release),
    description: eventDescription(release),
    scheduledStartTime: start,
    scheduledEndTime: new Date(start.getTime() + duration * 60000),
    privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
    entityType: GuildScheduledEventEntityType.External,
    entityMetadata: { location: release.platforms?.length ? release.platforms.map((platform) => platform.name).join(", ").slice(0, 100) : "Streaming release" }
  };
}
async function requestJson(baseUrl, token, path, options = {}) {
  const response = await fetch(new URL(path, baseUrl), { ...options, headers: { "content-type": "application/json", "x-anime-service-token": token, ...(options.headers || {}) }, signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Anime service returned HTTP ${response.status}.`);
  return data;
}
async function saveMapping(baseUrl, token, release, externalEventId, payloadHash, status = "active") {
  await requestJson(baseUrl, token, "/api/external-mappings", { method: "PUT", body: JSON.stringify({ kind: "discord", releaseId: release.id, externalEventId, payloadHash, status }) });
}
async function reportRun(baseUrl, token, { status, startedAt, summary, error = null }) {
  await requestJson(baseUrl, token, "/api/outputs/discord/report", { method: "POST", body: JSON.stringify({ status, startedAt, summary, error }) });
}

export function startAnimeScheduledEventSync({ bot, guildId, baseUrl, token, enabled, intervalMs = 600000 }) {
  if (!baseUrl || !token) { console.error("[cotf-bot] Anime Scheduled Event sync is unavailable because the service URL/token is missing."); return () => undefined; }
  let running = false;
  let lastEnabled = null;
  async function sync() {
    if (running) return;
    running = true;
    const startedAt = new Date().toISOString();
    const summary = { desired: 0, created: 0, updated: 0, unchanged: 0, retired: 0, skipped: 0, failed: 0 };
    const errors = [];
    try {
      const currentlyEnabled = typeof enabled === "function" ? Boolean(await enabled()) : Boolean(enabled);
      if (!currentlyEnabled) {
        if (lastEnabled !== false) console.log("[cotf-bot] Native anime Scheduled Events are disabled in Officer Bot Settings.");
        lastEnabled = false;
        return;
      }
      if (lastEnabled === false) console.log("[cotf-bot] Native anime Scheduled Events were enabled in Officer Bot Settings.");
      lastEnabled = true;
      const guild = await bot.guilds.fetch(guildId);
      const feed = await requestJson(baseUrl, token, "/api/outputs/discord");
      const scheduledEvents = await guild.scheduledEvents.fetch();
      summary.desired = (feed.releases || []).length;

      for (const release of feed.releases || []) {
        try {
          const payload = eventPayload(release);
          if (new Date(payload.scheduledStartTime).getTime() <= Date.now() + 60000) { summary.skipped += 1; continue; }
          const payloadHash = hashPayload({ ...payload, scheduledStartTime: payload.scheduledStartTime.toISOString(), scheduledEndTime: payload.scheduledEndTime.toISOString() });
          const existing = release.external_event_id ? scheduledEvents.get(release.external_event_id) : null;
          if (existing && release.last_payload_hash === payloadHash) { summary.unchanged += 1; continue; }
          if (existing) {
            await existing.edit(payload, "Anime release schedule reconciliation");
            await saveMapping(baseUrl, token, release, existing.id, payloadHash); summary.updated += 1; continue;
          }
          const createdEvent = await guild.scheduledEvents.create({ ...payload, reason: "Anime release schedule reconciliation" });
          await saveMapping(baseUrl, token, release, createdEvent.id, payloadHash); summary.created += 1;
        } catch (error) {
          summary.failed += 1;
          errors.push(`${release.english_title || release.release_key}: ${String(error.message || error)}`);
        }
      }

      for (const mapping of feed.staleMappings || []) {
        try {
          const existing = scheduledEvents.get(mapping.external_event_id);
          if (existing?.status === GuildScheduledEventStatus.Active) { summary.skipped += 1; continue; }
          if (existing?.status === GuildScheduledEventStatus.Scheduled) await existing.delete("Anime release is no longer in the active schedule window");
          await saveMapping(baseUrl, token, mapping, mapping.external_event_id, mapping.last_payload_hash || "", "retired");
          summary.retired += 1;
        } catch (error) {
          summary.failed += 1;
          errors.push(`${mapping.release_key}: ${String(error.message || error)}`);
        }
      }

      const status = summary.failed ? "failed" : "success";
      const errorText = errors.length ? errors.slice(0, 10).join(" | ") : null;
      await reportRun(baseUrl, token, { status, startedAt, summary, error: errorText });
      console.log(`[cotf-bot] Native anime Scheduled Events: ${summary.created} created, ${summary.updated} updated, ${summary.unchanged} unchanged, ${summary.retired} retired, ${summary.skipped} skipped, ${summary.failed} failed.`);
    } catch (error) {
      summary.failed += 1;
      console.error("[cotf-bot] Native anime Scheduled Event sync failed:", error);
      await reportRun(baseUrl, token, { status: "failed", startedAt, summary, error: String(error.message || error) }).catch((reportError) => console.error("[cotf-bot] Could not report anime Scheduled Event failure:", reportError));
    } finally { running = false; }
  }
  const timer = setInterval(sync, intervalMs); timer.unref(); setTimeout(sync, 10000).unref();
  return () => clearInterval(timer);
}
