import { existsSync, readFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { Client } from "pg";
import { isValidSetupToken } from "../../../../lib/setup-security";

export const runtime = "nodejs";

const defaultWelcomeWaveStickerIds = "816087792291282944,754108890559283200,749054660769218631,781291131828699156,819128604311027752,751606379340365864,816086581509095424,781323769960202280,819130301702995968,772972089963577354,783787404518883338,831570715471380550,831571726223540294";

async function restoredWelcomeStickerIds() {
  if (!process.env.DATABASE_URL) return null;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query("select welcome_wave_sticker_ids from portal_discord_bot_settings where id = 1");
    return result.rowCount ? String(result.rows[0]?.welcome_wave_sticker_ids ?? "") : null;
  } catch {
    return null;
  } finally {
    await client.end().catch(() => undefined);
  }
}
async function restoredPrivacySettings() {
  if (!process.env.DATABASE_URL) return null;
  const client=new Client({connectionString:process.env.DATABASE_URL});
  try{await client.connect();const result=await client.query("select * from portal_privacy_settings where id=1");return result.rows[0]||null;}catch{return null;}finally{await client.end().catch(()=>undefined)}
}
async function restoredPortalTheme() {
  if (!process.env.DATABASE_URL) return null;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query(
      "select key,value from portal_settings where key = any($1::text[])",
      [["backgroundColor", "accentColor", "tileColor"]]
    );
    return Object.fromEntries(result.rows
      .map((row) => [String(row.key), String(row.value)])
      .filter(([, color]) => /^#[0-9a-f]{6}$/i.test(color))) as Record<string, string>;
  } catch {
    return null;
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!isValidSetupToken(String(body.setupToken || ""))) {
      return NextResponse.json({ error: "The setup session is invalid or expired." }, { status: 403 });
    }
    const restored = existsSync("/setup-output/restore-applied.json");
    const imported: Record<string, string> = restored && existsSync("/setup-output/restored-env.json")
      ? JSON.parse(readFileSync("/setup-output/restored-env.json", "utf8")) : {};
    const value = (name: string, fallback = "") => String((imported[name] ?? process.env[name]) || fallback);
    const bool = (name: string) => value(name).toLowerCase() === "true";
    const databaseWelcomeStickerIds = restored ? await restoredWelcomeStickerIds() : null;
    const privacy = restored ? await restoredPrivacySettings() : null;
    const databasePortalTheme = restored ? await restoredPortalTheme() : null;
    const authProvider = value("AUTH_PROVIDER", "discord").toLowerCase();
    const configuredAccessMode = value("ACCESS_MODE").toLowerCase();
    const portalUrl = value("PORTAL_URL");
    const accessMode = configuredAccessMode || (
      value("CLOUDFLARE_HOSTNAME") && value("CLOUDFLARE_TUNNEL_TOKEN") ? "cloudflare" :
      value("TAILSCALE_TAILNET") || value("TAILSCALE_AUTHKEY") ? "tailscale" :
      portalUrl.startsWith("https://") ? "reverse-proxy" :
      "local"
    );
    return NextResponse.json({
      restored,
      restoredIntegrations: {
        authentik: authProvider === "authentik" && Boolean(value("AUTH_AUTHENTIK_ID") && value("AUTH_AUTHENTIK_SECRET") && value("AUTH_AUTHENTIK_ISSUER")),
        cloudflare: Boolean(value("CLOUDFLARE_HOSTNAME") && value("CLOUDFLARE_TUNNEL_TOKEN")),
        googleCalendar: bool("ANIME_GOOGLE_ENABLED") || Boolean(value("ANIME_GOOGLE_SUB_CALENDAR_ID") || value("ANIME_GOOGLE_DUB_CALENDAR_ID")),
        synologyReverseProxy: accessMode === "reverse-proxy"
      },
      portalName: value("PORTAL_NAME"),
      operatorName: privacy?.operator_name || value("PORTAL_OPERATOR_NAME",value("PORTAL_NAME")),
      privacyContact: privacy?.privacy_contact || value("PORTAL_PRIVACY_CONTACT"),
      operatorRegion: privacy?.operator_region || value("PORTAL_OPERATOR_REGION"),
      formerMemberRetentionDays: Number(privacy?.former_member_retention_days || value("PORTAL_FORMER_MEMBER_RETENTION_DAYS","30")),
      activityRetentionDays: Number(privacy?.activity_retention_days || value("PORTAL_ACTIVITY_RETENTION_DAYS","365")),
      backupRetentionDays: Number(privacy?.backup_retention_days || value("PORTAL_BACKUP_RETENTION_DAYS","90")),
      privacyAdditionalNotice: privacy?.additional_notice || value("PORTAL_PRIVACY_ADDITIONAL_NOTICE"),
      portalSubtitle: value("PORTAL_SUBTITLE", "Free Company Portal"),
      portalUrl,
      logoUrl: value("PORTAL_LOGO_URL", "/branding/default-logo.svg"),
      bannerUrl: value("PORTAL_BANNER_URL", "/branding/default-banner.svg"),
      backgroundColor: databasePortalTheme?.backgroundColor ?? value("PORTAL_BACKGROUND_COLOR", "#05000c"),
      accentColor: databasePortalTheme?.accentColor ?? value("PORTAL_ACCENT_COLOR", "#9333ea"),
      tileColor: databasePortalTheme?.tileColor ?? value("PORTAL_TILE_COLOR", "#120423"),
      accessMode,
      tailscaleHostname: value("TAILSCALE_HOSTNAME", "fc-portal"),
      tailscaleTailnet: value("TAILSCALE_TAILNET"),
      tailscaleAuthKey: value("TAILSCALE_AUTHKEY"),
      cloudflareHostname: value("CLOUDFLARE_HOSTNAME"),
      cloudflareTunnelToken: value("CLOUDFLARE_TUNNEL_TOKEN"),
      commandName: value("DISCORD_COMMAND_NAME", "fc"),
      timeZone: value("ANIME_TIMEZONE", "America/Chicago"),
      dataCenter: value("DEFAULT_DATACENTER", "Aether"),
      world: value("DEFAULT_WORLD", "Faerie"),
      lodestoneUrl: value("FC_LODESTONE_URL"),
      applicationId: value("DISCORD_APPLICATION_ID", value("AUTH_DISCORD_ID")),
      guildId: value("DISCORD_GUILD_ID"),
      adminDiscordIds: value("PORTAL_PRIMARY_ADMIN_DISCORD_ID", value("PORTAL_ADMIN_DISCORD_IDS")),
      oauthSecret: value("AUTH_DISCORD_SECRET"),
      botToken: value("DISCORD_BOT_TOKEN"),
      verifiedRoleId: value("DISCORD_VERIFIED_ROLE_ID"),
      unverifiedRoleId: value("DISCORD_UNVERIFIED_ROLE_ID"),
      temporaryGuestsEnabled: bool("DISCORD_TEMP_GUEST_ENABLED"),
      tempAccessRoleId: value("DISCORD_TEMP_ACCESS_ROLE_ID"),
      tempGuestHours: Number(value("DISCORD_TEMP_GUEST_HOURS", "6")) || 6,
      welcomeChannelId: value("DISCORD_WELCOME_CHANNEL_ID"),
      freeCompanyChatChannelId: value("DISCORD_FREE_COMPANY_CHAT_CHANNEL_ID"),
      welcomeEngagementEnabled: ["1", "true", "yes", "on"].includes(value("DISCORD_WELCOME_ENGAGEMENT_ENABLED").toLowerCase()),
      officerLogChannelId: value("DISCORD_OFFICER_LOG_CHANNEL_ID"),
      eventChannelId: value("DISCORD_RAID_CHANNEL_ID") || value("DISCORD_MOUNT_FARM_CHANNEL_ID") || value("DISCORD_EVENT_CHANNEL_ID"),
      raidChannelId: "",
      mountFarmChannelId: "",
      mountWinChannelId: value("DISCORD_MOUNT_WIN_CHANNEL_ID"),
      testChannelId: value("DISCORD_TEST_CHANNEL_ID"),
      welcomeWaveStickerIds: databaseWelcomeStickerIds ?? value("DISCORD_WELCOME_WAVE_STICKER_IDS", defaultWelcomeWaveStickerIds)
    });
  } catch {
    return NextResponse.json({ error: "The imported configuration could not be read." }, { status: 400 });
  }
}
