import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.env.INSTALL_ROOT || "/install";
const envPath = join(root, ".env");
const setupDirectory = join(root, "data", "setup");
const installationPath = join(setupDirectory, "installation.json");
const parseEnv = (source) => Object.fromEntries(source.split(/\r?\n/).filter(Boolean).map((line) => {
  const index = line.indexOf("=");
  const value = line.slice(index + 1).trim().replace(/^'(.*)'$/, "$1");
  return [line.slice(0, index), value];
}));
const quote = (value) => `'${String(value ?? "").replaceAll("'", "")}'`;

const existing = parseEnv(await readFile(envPath, "utf8"));
const importedPath = join(setupDirectory, "restored-env.json");
if (existsSync(importedPath)) Object.assign(existing, JSON.parse(await readFile(importedPath, "utf8")));
const setup = JSON.parse(await readFile(installationPath, "utf8"));
if (!String(setup.dataCenter || "").trim() || !String(setup.world || "").trim()) {
  throw new Error("Setup is missing the data center or world. Complete setup again before sealing.");
}
const values = {
  ...existing,
  SETUP_MODE: "false", SETUP_COMPLETE: "true",
  PORTAL_NAME: setup.portalName, PORTAL_SUBTITLE: setup.portalSubtitle, PORTAL_URL: setup.portalUrl,
  PORTAL_OPERATOR_NAME: setup.operatorName || setup.portalName, PORTAL_PRIVACY_CONTACT: setup.privacyContact || "",
  PORTAL_OPERATOR_REGION: setup.operatorRegion || "", PORTAL_FORMER_MEMBER_RETENTION_DAYS: String(setup.formerMemberRetentionDays || 30),
  PORTAL_ACTIVITY_RETENTION_DAYS: String(setup.activityRetentionDays || 365), PORTAL_BACKUP_RETENTION_DAYS: String(setup.backupRetentionDays || 90),
  PORTAL_PRIVACY_ADDITIONAL_NOTICE: setup.privacyAdditionalNotice || "",
  PORTAL_LOGO_URL: setup.logoUrl, PORTAL_BANNER_URL: setup.bannerUrl,
  PORTAL_BACKGROUND_COLOR: setup.backgroundColor, PORTAL_ACCENT_COLOR: setup.accentColor, PORTAL_TILE_COLOR: setup.tileColor || "#120423",
  ACCESS_MODE: setup.accessMode || "local",
  COMPOSE_PROFILES: setup.accessMode === "cloudflare" ? "cloudflare" : "",
  TAILSCALE_HOSTNAME: setup.tailscaleHostname || "", TAILSCALE_TAILNET: setup.tailscaleTailnet || "",
  TAILSCALE_AUTHKEY: setup.tailscaleAuthKey || "", CLOUDFLARE_HOSTNAME: setup.cloudflareHostname || "",
  CLOUDFLARE_TUNNEL_TOKEN: setup.cloudflareTunnelToken || "",
  DISCORD_COMMAND_NAME: setup.commandName,
  AUTH_URL: setup.portalUrl, AUTH_DISCORD_ID: setup.applicationId, AUTH_DISCORD_SECRET: setup.oauthSecret,
  PORTAL_PRIMARY_ADMIN_DISCORD_ID: setup.adminDiscordId,
  PORTAL_ADMIN_DISCORD_IDS: setup.adminDiscordId,
  FC_LODESTONE_URL: setup.lodestoneUrl, DEFAULT_DATACENTER: setup.dataCenter, DEFAULT_WORLD: setup.world,
  SYNC_INTERVAL_MINUTES: existing.SYNC_INTERVAL_MINUTES || "60", MAX_FC_PAGES: existing.MAX_FC_PAGES || "10", MAX_MOUNT_SYNC_CHARACTERS: existing.MAX_MOUNT_SYNC_CHARACTERS || "100",
  MOUNT_SYNC_REQUEST_DELAY_MS: existing.MOUNT_SYNC_REQUEST_DELAY_MS || "1000", MAX_PORTRAIT_SYNC_CHARACTERS: existing.MAX_PORTRAIT_SYNC_CHARACTERS || "100", PORTRAIT_SYNC_REQUEST_DELAY_MS: existing.PORTRAIT_SYNC_REQUEST_DELAY_MS || "1000",
  DISCORD_BOT_TOKEN: setup.botToken, DISCORD_APPLICATION_ID: setup.applicationId, DISCORD_GUILD_ID: setup.guildId,
  DISCORD_VERIFIED_ROLE_ID: setup.verifiedRoleId, DISCORD_UNVERIFIED_ROLE_ID: setup.unverifiedRoleId,
  DISCORD_TEMP_GUEST_ENABLED: setup.temporaryGuestsEnabled ? "true" : "false",
  DISCORD_TEMP_ACCESS_ROLE_ID: setup.tempAccessRoleId, DISCORD_TEMP_GUEST_HOURS: String(setup.tempGuestHours || 6),
  DISCORD_WELCOME_CHANNEL_ID: setup.welcomeChannelId,
  DISCORD_FREE_COMPANY_CHAT_CHANNEL_ID: setup.freeCompanyChatChannelId,
  DISCORD_WELCOME_ENGAGEMENT_ENABLED: setup.welcomeEngagementEnabled ? "true" : "false",
  DISCORD_OFFICER_LOG_CHANNEL_ID: setup.officerLogChannelId, DISCORD_EVENT_CHANNEL_ID: setup.eventChannelId,
  DISCORD_RAID_CHANNEL_ID: setup.raidChannelId, DISCORD_MOUNT_FARM_CHANNEL_ID: setup.mountFarmChannelId,
  DISCORD_MOUNT_WIN_CHANNEL_ID: setup.mountWinChannelId, DISCORD_TEST_CHANNEL_ID: setup.testChannelId,
  DISCORD_WELCOME_WAVE_STICKER_IDS: typeof setup.welcomeWaveStickerIds === "string" ? setup.welcomeWaveStickerIds : (existing.DISCORD_WELCOME_WAVE_STICKER_IDS || ""), DISCORD_MOUNT_WEBHOOK_URL: existing.DISCORD_MOUNT_WEBHOOK_URL || "", RUN_STARTUP_MEMBER_SYNC: existing.RUN_STARTUP_MEMBER_SYNC || "false",
  ANIME_SCHEDULE_TOKEN: existing.ANIME_SCHEDULE_TOKEN || "", ANIME_OFFICIAL_FEED_URLS: existing.ANIME_OFFICIAL_FEED_URLS || "", ANIME_TIMEZONE: setup.timeZone || existing.ANIME_TIMEZONE || "America/Chicago",
  ANIME_DAILY_SYNC_TIME: existing.ANIME_DAILY_SYNC_TIME || "04:15", ANIME_GOOGLE_ENABLED: existing.ANIME_GOOGLE_ENABLED || "false", ANIME_GOOGLE_DRY_RUN: existing.ANIME_GOOGLE_DRY_RUN || "true",
  ANIME_GOOGLE_LANGUAGES: existing.ANIME_GOOGLE_LANGUAGES || "sub,dub", ANIME_GOOGLE_SUB_CALENDAR_ID: existing.ANIME_GOOGLE_SUB_CALENDAR_ID || "", ANIME_GOOGLE_DUB_CALENDAR_ID: existing.ANIME_GOOGLE_DUB_CALENDAR_ID || "",
  ANIME_GOOGLE_CREDENTIALS_FILE: existing.ANIME_GOOGLE_CREDENTIALS_FILE || "/run/anime-secrets/google-service-account.json", ANIME_DISCORD_ENABLED: existing.ANIME_DISCORD_ENABLED || "false", ANIME_DISCORD_LANGUAGES: existing.ANIME_DISCORD_LANGUAGES || "sub,dub",
  ANIME_DISCORD_HORIZON_DAYS: existing.ANIME_DISCORD_HORIZON_DAYS || "3"
};
const tailscaleConfigDirectory = join(root, "data", "tailscale", "config");
await mkdir(tailscaleConfigDirectory, { recursive: true });
const tailscaleConfigPath = join(tailscaleConfigDirectory, "serve.json");
if (setup.accessMode === "tailscale") {
  const certificateDomain = `${setup.tailscaleHostname}.${setup.tailscaleTailnet}`;
  const serveConfig = {
    TCP: { "443": { HTTPS: true } },
    Web: { [`${certificateDomain}:443`]: { Handlers: { "/": { Proxy: "http://portal:3000" } } } },
    AllowFunnel: { [`${certificateDomain}:443`]: true }
  };
  await writeFile(tailscaleConfigPath, JSON.stringify(serveConfig, null, 2) + "\n", { mode: 0o600 });
} else {
  await rm(tailscaleConfigPath, { force: true });
}
delete values.SETUP_TOKEN;
const temporaryPath = `${envPath}.tmp`;
await writeFile(temporaryPath, Object.entries(values).map(([key, value]) => `${key}=${quote(value)}`).join("\n") + "\n", { mode: 0o600 });
await rename(temporaryPath, envPath);
await chmod(envPath, 0o600);
await writeFile(join(setupDirectory, "setup-sealed.json"), JSON.stringify({ sealedAt: new Date().toISOString() }), { mode: 0o644 });
await rm(importedPath, { force: true });
await rm(join(setupDirectory, "restore-upload.tar.gz"), { force: true });
await rm(installationPath, { force: true });
await rm(join(setupDirectory, "bootstrap.json"), { force: true });
await rm(join(root, "SETUP_TOKEN.txt"), { force: true });
console.log(JSON.stringify({ complete: true, portalUrl: setup.portalUrl }));
