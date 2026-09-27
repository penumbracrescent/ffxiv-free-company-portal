import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { outputFeed, saveExternalMapping } from "./queries.mjs";

function base64url(value) { return Buffer.from(value).toString("base64url"); }
async function credentials(config) {
  if (!config.googleCredentialsFile) throw new Error("ANIME_GOOGLE_CREDENTIALS_FILE is required when Google sync is enabled.");
  const value = JSON.parse(await readFile(config.googleCredentialsFile, "utf8"));
  if (!value.client_email || !value.private_key) throw new Error("Google service-account credentials are incomplete.");
  return value;
}
async function accessToken(config) {
  const account = await credentials(config); const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({ iss: account.client_email, scope: "https://www.googleapis.com/auth/calendar", aud: account.token_uri || "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const unsigned = `${header}.${claims}`; const signer = createSign("RSA-SHA256"); signer.update(unsigned); signer.end();
  const assertion = `${unsigned}.${signer.sign(account.private_key, "base64url")}`;
  const response = await fetch(account.token_uri || "https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }), signal: AbortSignal.timeout(15000) });
  const payload = await response.json(); if (!response.ok) throw new Error(payload.error_description || "Google token request failed."); return payload.access_token;
}
function eventPayload(release, timezone) {
  const start = new Date(release.starts_at); const end = new Date(start.getTime() + Math.max(15, Number(release.duration_minutes || 30)) * 60000);
  const synopsis = String(release.description || "Synopsis not available yet.").trim();
  const availability = `${String(release.status || "scheduled").replace(/^./, (letter) => letter.toUpperCase())} anime release${release.platforms?.length ? ` on ${release.platforms.map((platform) => platform.name).join(", ")}` : ""}.`;
  return { summary: `${release.english_title} — Episode ${release.episode_label || "TBA"} (${String(release.language).toUpperCase()})`, description: `${synopsis}\n\n${availability}`.slice(0, 8000), start: { dateTime: start.toISOString(), timeZone: timezone }, end: { dateTime: end.toISOString(), timeZone: timezone }, extendedProperties: { private: { cotfReleaseKey: release.release_key, cotfLanguage: release.language } } };
}
async function googleRequest(token, url, options = {}) { const response = await fetch(url, { ...options, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(options.headers || {}) }, signal: AbortSignal.timeout(15000) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error?.message || `Google Calendar returned HTTP ${response.status}.`); return data; }
export function googleCalendarTargets(config) {
  const languages = [...new Set(config.googleLanguages)].filter((language) => ["sub", "dub"].includes(language));
  return languages.map((language) => ({ language, calendarId: String(config.googleCalendarIds?.[language] || "").trim() }));
}
export async function testGoogleCalendarAccess(config) {
  const targets = googleCalendarTargets(config);
  const missing = targets.filter((target) => !target.calendarId).map((target) => target.language.toUpperCase());
  if (missing.length) throw new Error(`Missing Google Calendar ID for: ${missing.join(", ")}.`);
  const token = await accessToken(config);
  const calendars = {};
  for (const target of targets) {
    const data = await googleRequest(token, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(target.calendarId)}`);
    calendars[target.language] = { accessible: true, name: data.summary || `${target.language.toUpperCase()} calendar` };
  }
  return { status: "success", calendars };
}
export async function syncGoogleCalendar(config, { dryRun = config.googleDryRun } = {}) {
  const targets = googleCalendarTargets(config);
  const result = { status: config.googleEnabled ? (dryRun ? "dry-run" : "success") : "disabled", dryRun, created: 0, updated: 0, unchanged: 0, calendars: {} };
  for (const target of targets) result.calendars[target.language] = { configured: Boolean(target.calendarId), created: 0, updated: 0, unchanged: 0 };
  if (!config.googleEnabled) return result;
  const missing = targets.filter((target) => !target.calendarId).map((target) => target.language.toUpperCase());
  if (missing.length) throw new Error(`Missing Google Calendar ID for: ${missing.join(", ")}.`);
  const token = dryRun ? null : await accessToken(config);
  for (const target of targets) {
    const releases = await outputFeed({ kind: "google", languages: [target.language], horizonDays: 90 });
    const calendar = encodeURIComponent(target.calendarId); const calendarResult = result.calendars[target.language];
    for (const release of releases) {
      const event = eventPayload(release, config.timezone); const hash = base64url(JSON.stringify(event));
      const mappingMatchesCalendar = Boolean(release.external_event_id) && (!release.external_container_id || release.external_container_id === target.calendarId);
      if (mappingMatchesCalendar && release.last_payload_hash === hash) { result.unchanged++; calendarResult.unchanged++; continue; }
      if (dryRun) { if (mappingMatchesCalendar) { result.updated++; calendarResult.updated++; } else { result.created++; calendarResult.created++; } continue; }
      let saved;
      if (mappingMatchesCalendar) { saved = await googleRequest(token, `https://www.googleapis.com/calendar/v3/calendars/${calendar}/events/${encodeURIComponent(release.external_event_id)}`, { method: "PUT", body: JSON.stringify(event) }); result.updated++; calendarResult.updated++; }
      else { saved = await googleRequest(token, `https://www.googleapis.com/calendar/v3/calendars/${calendar}/events`, { method: "POST", body: JSON.stringify(event) }); result.created++; calendarResult.created++; }
      await saveExternalMapping({ kind: "google", releaseId: release.id, externalEventId: saved.id, externalContainerId: target.calendarId, payloadHash: hash, status: "active" });
    }
  }
  return result;
}