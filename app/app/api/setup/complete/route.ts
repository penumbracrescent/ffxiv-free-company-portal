import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { Client } from "pg";
import { discoverDiscordSetup } from "../../../../lib/discord-setup";
import { isValidSetupToken } from "../../../../lib/setup-security";
import { lockSetupOperation, restoreState, restoredSetupValues } from "../../../../lib/setup-restore";
import { existsSync } from "node:fs";
import { validateSetupWorld } from "../../../../lib/setup-worlds";
import { ensurePrivacyTables, savePrivacySettings, validatePrivacyContact } from "../../../../lib/privacy";
import { ensureDiscordBotSettingsTable } from "../../../../lib/discord-bot-settings";

export const runtime = "nodejs";

const text = (form: FormData, key: string) => String(form.get(key) || "").trim();
const id = (value: string, label: string) => {
  if (!/^\d{15,22}$/.test(value)) throw new Error(`${label} must be a numeric Discord ID.`);
  return value;
};
const selected = (form: FormData, key: string, allowed: Set<string>) => {
  const value = text(form, key);
  if (value && !allowed.has(value)) throw new Error(`The selected ${key} is not available to the bot.`);
  return value;
};
const lodestoneFreeCompanyUrl = (value: string) => {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !(host === "finalfantasyxiv.com" || host.endsWith(".finalfantasyxiv.com"))
      || !/^\/lodestone\/freecompany\/\d+(?:\/|$)/.test(url.pathname)) {
    throw new Error("Enter an official HTTPS Lodestone Free Company URL containing its numeric ID.");
  }
  return value;
};

async function saveImage(form: FormData, key: string, fileBase: string, fallback: string) {
  const value = form.get(key);
  if (!(value instanceof File) || !value.size) return fallback;
  if (value.size > 8 * 1024 * 1024) throw new Error(`${key} must be 8 MB or smaller.`);
  const extensions: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif" };
  const extension = extensions[value.type];
  if (!extension) throw new Error(`${key} must be PNG, JPG, WEBP, or GIF.`);
  const directory = "/app/public/uploads";
  await mkdir(directory, { recursive: true });
  const filename = `${fileBase}${extension}`;
  await writeFile(join(directory, filename), Buffer.from(await value.arrayBuffer()));
  return `/uploads/${filename}`;
}

export async function POST(request: Request) {
  let release: (() => Promise<unknown>) | undefined;
  try {
    const form = await request.formData();
    if (!isValidSetupToken(text(form, "setupToken"))) return NextResponse.json({ error: "The setup session is invalid or expired." }, { status: 403 });
    release = await lockSetupOperation();
    const location = validateSetupWorld(text(form, "dataCenter"), text(form, "world"));
    const restoration = await restoreState();
    if (["queued", "validating", "restoring"].includes(restoration.phase)
        || (existsSync("/setup-output/restore-import-started.json") && !existsSync("/setup-output/restore-applied.json"))) {
      throw new Error("Restore must finish successfully before setup can be saved. If import failed, restore into a fresh installation.");
    }
    if (existsSync("/setup-output/installation.json")) throw new Error("Setup has already been saved. Complete the sealing step.");
    if (text(form, "legalAcknowledgement") !== "on") throw new Error("Confirm the operator and content responsibilities before finishing setup.");
    const portalName = text(form, "portalName").slice(0, 100);
    const portalSubtitle = text(form, "portalSubtitle").slice(0, 100) || "Free Company Portal";
    const operatorName = text(form, "operatorName").slice(0, 160);
    const privacyContact = validatePrivacyContact(text(form, "privacyContact").slice(0, 320));
    const operatorRegion = text(form, "operatorRegion").slice(0, 160);
    if (!operatorName) throw new Error("The installation operator is required for the public privacy policy.");
    let portalUrl = text(form, "portalUrl");
    if (!portalName || !portalUrl) throw new Error("Free Company name and portal URL are required.");
    const parsedUrl = new URL(portalUrl);
    if (!/^https?:$/.test(parsedUrl.protocol)) throw new Error("Portal URL must use http or https.");
    if (!portalUrl.endsWith("/")) portalUrl += "/";
    const accessMode = text(form, "accessMode") || "local";
    if (!["local", "tailscale", "cloudflare", "reverse-proxy", "later"].includes(accessMode)) throw new Error("Choose a valid network access method.");
    const tailscaleHostname = text(form, "tailscaleHostname").toLowerCase();
    const tailscaleTailnet = text(form, "tailscaleTailnet").toLowerCase();
    const tailscaleAuthKey = text(form, "tailscaleAuthKey");
    const cloudflareHostname = text(form, "cloudflareHostname").toLowerCase();
    const cloudflareTunnelToken = text(form, "cloudflareTunnelToken");
    if (["tailscale", "cloudflare", "reverse-proxy"].includes(accessMode) && parsedUrl.protocol !== "https:") throw new Error("Public portal addresses must use HTTPS.");
    if (accessMode === "tailscale") {
      if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(tailscaleHostname)) throw new Error("Enter a valid Tailscale machine name.");
      if (!/^[a-z0-9.-]+\.ts\.net$/.test(tailscaleTailnet)) throw new Error("Enter the tailnet DNS name ending in .ts.net.");
      if (!tailscaleAuthKey.startsWith("tskey-")) throw new Error("Enter the Tailscale authentication key generated for this portal.");
    }
    if (accessMode === "cloudflare") {
      if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(cloudflareHostname)) throw new Error("Enter a valid custom hostname, such as portal.example.com.");
      if (cloudflareTunnelToken.length < 40) throw new Error("Enter the Cloudflare tunnel token.");
    }
    const commandName = text(form, "commandName").toLowerCase();
    if (!/^[a-z0-9_-]{1,32}$/.test(commandName)) throw new Error("Discord command name must use 1-32 lowercase letters, numbers, hyphens, or underscores.");
    const backgroundColor = text(form, "backgroundColor");
    const accentColor = text(form, "accentColor");
    const tileColor = text(form, "tileColor");
    if (![backgroundColor, accentColor, tileColor].every((value) => /^#[0-9a-f]{6}$/i.test(value))) throw new Error("Choose valid six-digit site colors.");
    const applicationId = id(text(form, "applicationId"), "Application ID");
    const guildId = id(text(form, "guildId"), "Server ID");
    const adminDiscordId = id(text(form, "adminDiscordId"), "Administrator user ID");
    const requestedAdditionalAdminIds = text(form, "additionalAdminDiscordIds").split(/[\s,]+/).filter(Boolean);
    const additionalAdminDiscordIds = [...new Set(requestedAdditionalAdminIds.map((value) => id(value, "Additional administrator user ID")))].filter((value) => value !== adminDiscordId);
    const adminDiscordIds = [adminDiscordId, ...additionalAdminDiscordIds].join(",");
    const botToken = text(form, "botToken");
    const oauthSecret = text(form, "oauthSecret");
    const imported = restoredSetupValues();
    const preserved = (name: string) => imported[name] ?? process.env[name];
    const authentikRestored = preserved("AUTH_PROVIDER") === "authentik" && preserved("AUTH_AUTHENTIK_ID") && preserved("AUTH_AUTHENTIK_SECRET") && preserved("AUTH_AUTHENTIK_ISSUER");
    if (!botToken || (!oauthSecret && !authentikRestored)) throw new Error("Bot token and OAuth client secret are required unless a complete Authentik configuration was restored.");
    const discovery = await discoverDiscordSetup(botToken, guildId);
    const roleIds = new Set(discovery.roles.map((option) => option.id));
    const channelIds = new Set(discovery.channels.map((option) => option.id));
    const existingLogoUrl = text(form, "existingLogoUrl");
    const existingBannerUrl = text(form, "existingBannerUrl");
    const safeExistingLogoUrl = existingLogoUrl.startsWith("/uploads/") || existingLogoUrl.startsWith("/branding/") ? existingLogoUrl : "/branding/default-logo.svg";
    const safeExistingBannerUrl = existingBannerUrl.startsWith("/uploads/") || existingBannerUrl.startsWith("/branding/") ? existingBannerUrl : "/branding/default-banner.svg";
    const logoUrl = await saveImage(form, "logo", "logo", safeExistingLogoUrl);
    const bannerUrl = await saveImage(form, "banner", "banner", safeExistingBannerUrl);
    const temporaryGuestsEnabled = text(form, "temporaryGuestsEnabled") === "on";
    const welcomeEngagementEnabled = text(form, "welcomeEngagementEnabled") === "on";
    const requestedTempGuestHours = Number(text(form, "tempGuestHours") || 6);
    if (temporaryGuestsEnabled && (!Number.isInteger(requestedTempGuestHours) || requestedTempGuestHours < 1 || requestedTempGuestHours > 720)) {
      throw new Error("Temporary guest duration must be a whole number from 1 to 720 hours.");
    }
    const tempGuestHours = Math.max(1, Math.min(720, requestedTempGuestHours));
    const welcomeWaveStickerIds = [...new Set(text(form, "welcomeWaveStickerIds").split(/[\s,]+/).filter(Boolean))];
    if (welcomeWaveStickerIds.length > 50) throw new Error("A maximum of 50 welcome sticker IDs can be saved.");
    if (welcomeWaveStickerIds.some((stickerId) => !/^\d{15,22}$/.test(stickerId))) throw new Error("Each welcome sticker ID must contain 15 to 22 digits.");
    const tempAccessRoleId = temporaryGuestsEnabled ? selected(form, "tempAccessRoleId", roleIds) : "";
    if (temporaryGuestsEnabled && !tempAccessRoleId) throw new Error("Choose a temporary guest role or disable temporary guest access.");
    const configuration = {
      portalName,
      portalSubtitle,
      operatorName,
      privacyContact,
      operatorRegion,
      formerMemberRetentionDays: Math.max(1, Math.min(3650, Number(text(form,"formerMemberRetentionDays")) || 30)),
      activityRetentionDays: Math.max(1, Math.min(3650, Number(text(form,"activityRetentionDays")) || 365)),
      backupRetentionDays: Math.max(1, Math.min(3650, Number(text(form,"backupRetentionDays")) || 90)),
      privacyAdditionalNotice: text(form,"privacyAdditionalNotice").slice(0,4000),
      portalUrl,
      accessMode,
      tailscaleHostname,
      tailscaleTailnet,
      tailscaleAuthKey,
      cloudflareHostname,
      cloudflareTunnelToken,
      commandName,
      backgroundColor,
      accentColor,
      tileColor,
      logoUrl,
      bannerUrl,
      lodestoneUrl: lodestoneFreeCompanyUrl(text(form, "lodestoneUrl")),
      dataCenter: location.dataCenter,
      world: location.world,
      timeZone: text(form, "timeZone") || "America/Chicago",
      applicationId,
      oauthSecret,
      botToken,
      guildId,
      adminDiscordId,
      additionalAdminDiscordIds,
      adminDiscordIds,
      verifiedRoleId: selected(form, "verifiedRoleId", roleIds),
      unverifiedRoleId: selected(form, "unverifiedRoleId", roleIds),
      temporaryGuestsEnabled,
      welcomeEngagementEnabled,
      welcomeWaveStickerIds: welcomeWaveStickerIds.join(","),
      tempAccessRoleId,
      tempGuestHours,
      welcomeChannelId: selected(form, "welcomeChannelId", channelIds),
      freeCompanyChatChannelId: selected(form, "freeCompanyChatChannelId", channelIds),
      officerLogChannelId: selected(form, "officerLogChannelId", channelIds),
      eventChannelId: selected(form, "eventChannelId", channelIds),
      raidChannelId: "",
      mountFarmChannelId: "",
      mountWinChannelId: selected(form, "mountWinChannelId", channelIds),
      testChannelId: selected(form, "testChannelId", channelIds),
      completedAt: new Date().toISOString()
    };
    if (!process.env.DATABASE_URL) throw new Error("The portal database is not configured.");
    const settingsClient = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await settingsClient.connect();
      await ensurePrivacyTables(settingsClient);
      await ensureDiscordBotSettingsTable(settingsClient);
      await settingsClient.query(`create table if not exists portal_settings (key text primary key,value text not null,updated_at timestamptz not null default now());`);
      await settingsClient.query(`insert into portal_settings(key,value,updated_at) values('additionalAdminDiscordIds',$1,now()) on conflict(key) do update set value=excluded.value,updated_at=now();`, [configuration.additionalAdminDiscordIds.join(",")]);
      if (existsSync("/setup-output/restore-applied.json")) {
        await settingsClient.query(`update portal_discord_action_queue set status='cancelled',completed_at=now(),result_message='Cancelled during backup restoration; an officer must review and request the action again.',updated_at=now() where status in('pending','processing');`).catch(() => undefined);
      }
      await savePrivacySettings(settingsClient, {
        operatorName: configuration.operatorName, privacyContact: configuration.privacyContact,
        operatorRegion: configuration.operatorRegion, formerMemberRetentionDays: configuration.formerMemberRetentionDays,
        activityRetentionDays: configuration.activityRetentionDays, backupRetentionDays: configuration.backupRetentionDays,
        additionalNotice: configuration.privacyAdditionalNotice
      });
      await settingsClient.query(`
        insert into portal_discord_bot_settings (
          id, guild_id, verified_role_id, unverified_role_id, temp_access_role_id,
          temporary_guest_enabled, temp_guest_hours, welcome_channel_id,
          free_company_chat_channel_id, welcome_engagement_enabled,
          welcome_wave_sticker_ids, officer_log_channel_id, event_channel_id,
          raid_channel_id, mount_farm_channel_id, mount_win_channel_id, test_channel_id
        ) values (
          1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        )
        on conflict (id) do update set
          guild_id = excluded.guild_id,
          verified_role_id = excluded.verified_role_id,
          unverified_role_id = excluded.unverified_role_id,
          temp_access_role_id = excluded.temp_access_role_id,
          temporary_guest_enabled = excluded.temporary_guest_enabled,
          temp_guest_hours = excluded.temp_guest_hours,
          welcome_channel_id = excluded.welcome_channel_id,
          free_company_chat_channel_id = excluded.free_company_chat_channel_id,
          welcome_engagement_enabled = excluded.welcome_engagement_enabled,
          welcome_wave_sticker_ids = excluded.welcome_wave_sticker_ids,
          officer_log_channel_id = excluded.officer_log_channel_id,
          event_channel_id = excluded.event_channel_id,
          raid_channel_id = excluded.raid_channel_id,
          mount_farm_channel_id = excluded.mount_farm_channel_id,
          mount_win_channel_id = excluded.mount_win_channel_id,
          test_channel_id = excluded.test_channel_id,
          updated_at = now();
      `, [
        configuration.guildId,
        configuration.verifiedRoleId,
        configuration.unverifiedRoleId,
        configuration.tempAccessRoleId,
        configuration.temporaryGuestsEnabled,
        configuration.tempGuestHours,
        configuration.welcomeChannelId,
        configuration.freeCompanyChatChannelId,
        configuration.welcomeEngagementEnabled,
        configuration.welcomeWaveStickerIds,
        configuration.officerLogChannelId,
        configuration.eventChannelId,
        configuration.raidChannelId,
        configuration.mountFarmChannelId,
        configuration.mountWinChannelId,
        configuration.testChannelId
      ]);
    } finally {
      await settingsClient.end().catch(() => undefined);
    }
    const outputDirectory = "/setup-output";
    await mkdir(outputDirectory, { recursive: true });
    const temporaryPath = join(outputDirectory, `installation-${randomUUID()}.tmp`);
    const finalPath = join(outputDirectory, "installation.json");
    await writeFile(temporaryPath, JSON.stringify(configuration, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, finalPath);
    return NextResponse.json({ ok: true, guildName: discovery.guildName });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Setup could not be completed." }, { status: 400 });
  } finally {
    if (release) await release();
  }
}
