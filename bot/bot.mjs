// =========================
// SECTION 01: Imports
// =========================

import { createRosterOverrides } from "./roster-overrides.mjs";
let rosterOverrides;
let altCharacterClaims;
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  EmbedBuilder,
  GatewayIntentBits,
  LabelBuilder,
  ModalBuilder,
  MessageFlags,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";
import pg from "pg";
import { createHmac } from "node:crypto";
import { startAnimeScheduledEventSync } from "./anime-events.mjs";
import { autoEnrollGiveawaySubmission, mirrorAutoEnrolledGiveawaySource, ensureGiveawayBotTables, handleGiveawayInteraction, processGiveawayJobs } from "./giveaways.mjs";
import { ensurePollBotTables, handlePollInteraction, processPollJobs } from "./polls.mjs";
import { buildEventPlanDiscordPayload, ensureEventDraftTable, handleEventCommand, handleEventComponent, handleEventPlanComponent, processEventPlanSyncs } from "./event-command.mjs";
import { ensureAvailabilitySchema, handleAvailabilityCommand, handleAvailabilityInteraction } from "./availability.mjs";
import { ensureFashionReportTables, processFashionReport } from "./fashion-report.mjs";
import { ensureAnimeRankingTables, processAnimeRanking } from "./anime-rankings.mjs";
import { ensureLodestoneNewsTables, processLodestoneNews } from "./lodestone-news.mjs";
import { buildFaeCommand, createFaeDiagnosticReference, disabledFaeCommandReply, handleFaeCommand, handleFaeComponent, isFaeCommandEnabled, recordFaeDiagnostic } from "./fae-commands.mjs";
import { createAltCharacterClaims } from "./alt-character-claims.mjs";
import { handleShareAutocomplete, handleShareCommand, handleShareComponent } from "./share-commands.mjs";
import { handleCraftMacroAutocomplete, handleCraftMacroCommand, handleCraftMacroModal } from "./craft-macro.mjs";
import { handleChocoboAutocomplete, handleChocoboColorCommand } from "./chocobo-color.mjs";
import { ensureTreasureMapSchema, handleTreasureMapChannelMessage, handleTreasureMapCommand, handleTreasureMapComponent, handleTreasureMapContextCommand, startTreasureMapCleanup } from "./treasure-maps.mjs";
import { bootstrapTreasureMapCatalog } from "./treasure-map-catalog.mjs";
import { closeTreasureMapOcr } from "./treasure-map-ocr.mjs";
import { DISCORD_COMMAND_NAME, GUILD_NAME } from "./installation-config.mjs";

const { Pool } = pg;


// =========================
// SECTION 02: Environment Variables
// =========================

// -------------------------
// SUBSECTION 02A: Required Discord values
// -------------------------

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const legacyPortalAdminIds = String(process.env.PORTAL_ADMIN_DISCORD_IDS || "").split(",").map((value) => value.trim()).filter((value) => /^\d{15,22}$/.test(value));
const configuredPrimaryPortalAdminId = String(process.env.PORTAL_PRIMARY_ADMIN_DISCORD_ID || "").trim();
const PRIMARY_PORTAL_ADMIN_ID = /^\d{15,22}$/.test(configuredPrimaryPortalAdminId) ? configuredPrimaryPortalAdminId : legacyPortalAdminIds[0] || "";

// -------------------------
// SUBSECTION 02B: Default Discord channel/role values
// These are fallback values. The portal database settings can override them.
// -------------------------

const DISCORD_VERIFIED_ROLE_ID = process.env.DISCORD_VERIFIED_ROLE_ID || "";
const DISCORD_UNVERIFIED_ROLE_ID = process.env.DISCORD_UNVERIFIED_ROLE_ID || "";
const DISCORD_TEMP_ACCESS_ROLE_ID = process.env.DISCORD_TEMP_ACCESS_ROLE_ID || "";
const DISCORD_TEMP_GUEST_ENABLED = String(process.env.DISCORD_TEMP_GUEST_ENABLED || "false").toLowerCase() === "true";
const DISCORD_TEMP_GUEST_HOURS = Math.max(1, Math.min(720, Number(process.env.DISCORD_TEMP_GUEST_HOURS || 6)));
const DISCORD_WELCOME_CHANNEL_ID = process.env.DISCORD_WELCOME_CHANNEL_ID || "";
const DISCORD_FREE_COMPANY_CHAT_CHANNEL_ID = process.env.DISCORD_FREE_COMPANY_CHAT_CHANNEL_ID || "";
const DISCORD_WELCOME_ENGAGEMENT_ENABLED = ["1", "true", "yes", "on"].includes(String(process.env.DISCORD_WELCOME_ENGAGEMENT_ENABLED || "false").toLowerCase());
const DEFAULT_WELCOME_WAVE_STICKER_IDS = [
  "816087792291282944",
  "754108890559283200",
  "749054660769218631",
  "781291131828699156",
  "819128604311027752",
  "751606379340365864",
  "816086581509095424",
  "781323769960202280",
  "819130301702995968",
  "772972089963577354",
  "783787404518883338",
  "831570715471380550",
  "831571726223540294"
].join(",");
const DISCORD_WELCOME_WAVE_STICKER_IDS = process.env.DISCORD_WELCOME_WAVE_STICKER_IDS ?? DEFAULT_WELCOME_WAVE_STICKER_IDS;
const DISCORD_OFFICER_LOG_CHANNEL_ID = process.env.DISCORD_OFFICER_LOG_CHANNEL_ID || "";
const DISCORD_EVENT_CHANNEL_ID = process.env.DISCORD_RAID_CHANNEL_ID || process.env.DISCORD_MOUNT_FARM_CHANNEL_ID || process.env.DISCORD_EVENT_CHANNEL_ID || "";
const DISCORD_RAID_CHANNEL_ID = process.env.DISCORD_RAID_CHANNEL_ID || "";
const DISCORD_MOUNT_FARM_CHANNEL_ID = process.env.DISCORD_MOUNT_FARM_CHANNEL_ID || "";
const DISCORD_MOUNT_WIN_CHANNEL_ID = process.env.DISCORD_MOUNT_WIN_CHANNEL_ID || "";
const DISCORD_TEST_CHANNEL_ID = process.env.DISCORD_TEST_CHANNEL_ID || "";

// -------------------------
// SUBSECTION 02C: Database value
// -------------------------

const DATABASE_URL = process.env.DATABASE_URL;
const PORTAL_URL = String(process.env.PORTAL_URL || "").trim();
const ANIME_SCHEDULE_URL = process.env.ANIME_SCHEDULE_URL || "";
const ANIME_SERVICE_API_TOKEN = process.env.ANIME_SERVICE_API_TOKEN || "";
const ANIME_DISCORD_ENABLED = ["1", "true", "yes", "on"].includes(String(process.env.ANIME_DISCORD_ENABLED || "false").toLowerCase());

// -------------------------
// SUBSECTION 02D: Startup validation
// -------------------------

if (!DISCORD_BOT_TOKEN) {
  throw new Error("DISCORD_BOT_TOKEN is required.");
}

if (!DISCORD_APPLICATION_ID) {
  throw new Error("DISCORD_APPLICATION_ID is required.");
}

if (!DISCORD_GUILD_ID) {
  throw new Error("DISCORD_GUILD_ID is required.");
}

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}


// =========================
// SECTION 03: Clients
// =========================

// -------------------------
// SUBSECTION 03A: PostgreSQL pool
// -------------------------

const pool = new Pool({
  connectionString: DATABASE_URL
});

// -------------------------
// SUBSECTION 03B: Discord gateway client
// -------------------------

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});


// =========================
// SECTION 04: Bot Settings Cache
// =========================

// -------------------------
// SUBSECTION 04A: Default settings
// These defaults come from .env. The portal settings table can override them.
// -------------------------

const DEFAULT_BOT_SETTINGS = {
  guild_id: DISCORD_GUILD_ID,
  verified_role_id: DISCORD_VERIFIED_ROLE_ID,
  unverified_role_id: DISCORD_UNVERIFIED_ROLE_ID,
  temp_access_role_id: DISCORD_TEMP_ACCESS_ROLE_ID,
  temporary_guest_enabled: DISCORD_TEMP_GUEST_ENABLED,
  onboarding_selection_minutes: 30,
  temp_guest_hours: DISCORD_TEMP_GUEST_HOURS,
  welcome_channel_id: DISCORD_WELCOME_CHANNEL_ID,
  free_company_chat_channel_id: DISCORD_FREE_COMPANY_CHAT_CHANNEL_ID,
  welcome_engagement_enabled: DISCORD_WELCOME_ENGAGEMENT_ENABLED,
  welcome_wave_sticker_ids: DISCORD_WELCOME_WAVE_STICKER_IDS,
  officer_log_channel_id: DISCORD_OFFICER_LOG_CHANNEL_ID,
  event_channel_id: DISCORD_EVENT_CHANNEL_ID,
  raid_channel_id: "",
  mount_farm_channel_id: "",
  mount_win_channel_id: DISCORD_MOUNT_WIN_CHANNEL_ID,
  mount_win_announcements_enabled: true,
  anime_event_scheduling_enabled: ANIME_DISCORD_ENABLED,
  crafting_channel_id: "",
  treasure_map_channel_id: "",
  treasure_map_auto_enabled: false,
  roster_review_channel_id: "",
  test_channel_id: DISCORD_TEST_CHANNEL_ID,
  member_rename_notification_channel_id: "",
  gaming_setups_channel_id: "",
  pets_gallery_channel_id: "",
  glamours_gallery_channel_id: "",
  artwork_gallery_channel_id: "",
  giveaway_channel_id: "",
  contestants_channel_id: "",
  fashion_report_channel_id: "",
  fashion_report_enabled: false,
  anime_ranking_channel_id: "",
  anime_ranking_enabled: false,
  anime_ranking_thread_enabled: true,
  lodestone_news_channel_id: "",
  lodestone_news_enabled: false,
  notification_window_enabled: false,
  notification_window_start_time: "08:00",
  notification_window_end_time: "22:00",
  rename_notifications_discord_members_enabled: true,
  rename_notifications_non_discord_members_enabled: true,
  auto_rename_enabled: true,
  auto_role_enabled: true,
  auto_roster_scan_enabled: false,
  roster_scan_interval_hours: 24,
  startup_member_sync_enabled: process.env.RUN_STARTUP_MEMBER_SYNC === "true",
  log_unmatched_attempts: true
};

// -------------------------
// SUBSECTION 04B: Cache state
// -------------------------

let cachedBotSettings = null;
let cachedBotSettingsAt = 0;

// -------------------------
// SUBSECTION 04C: Read bot settings from database
// -------------------------

async function getBotSettings({ fresh = false } = {}) {
  const now = Date.now();

  if (!fresh && cachedBotSettings && now - cachedBotSettingsAt < 30000) {
    return cachedBotSettings;
  }

  try {
    const result = await pool.query(`
      select
        guild_id,
        verified_role_id,
        unverified_role_id,
        temp_access_role_id,
        temporary_guest_enabled,
        onboarding_selection_minutes,
        temp_guest_hours,
        welcome_channel_id,
        free_company_chat_channel_id,
        welcome_engagement_enabled,
        welcome_wave_sticker_ids,
        officer_log_channel_id,
        event_channel_id,
        raid_channel_id,
        mount_farm_channel_id,
        mount_win_channel_id,
        mount_win_announcements_enabled,
        anime_event_scheduling_enabled,
        crafting_channel_id,
        treasure_map_channel_id,
        treasure_map_auto_enabled,
        roster_review_channel_id,
        test_channel_id,
        member_rename_notification_channel_id,
        gaming_setups_channel_id,
        pets_gallery_channel_id,
        glamours_gallery_channel_id,
        artwork_gallery_channel_id,
        giveaway_channel_id,
        contestants_channel_id,
        fashion_report_channel_id,
        fashion_report_enabled,
        anime_ranking_channel_id,
        anime_ranking_enabled,
        anime_ranking_thread_enabled,
        lodestone_news_channel_id,
        lodestone_news_enabled,
        notification_window_enabled,
        notification_window_start_time,
        notification_window_end_time,
        rename_notifications_discord_members_enabled,
        rename_notifications_non_discord_members_enabled,
        auto_rename_enabled,
        auto_role_enabled,
        startup_member_sync_enabled,
        log_unmatched_attempts,
        auto_roster_scan_enabled,
        roster_scan_interval_hours
      from portal_discord_bot_settings
      where id = 1;
    `);

    const row = result.rows[0] || {};

    cachedBotSettings = {
      guild_id: row.guild_id || DEFAULT_BOT_SETTINGS.guild_id,
      verified_role_id: row.verified_role_id || DEFAULT_BOT_SETTINGS.verified_role_id,
      unverified_role_id: row.unverified_role_id || DEFAULT_BOT_SETTINGS.unverified_role_id,
      temp_access_role_id: row.temp_access_role_id || DEFAULT_BOT_SETTINGS.temp_access_role_id,
      temporary_guest_enabled: typeof row.temporary_guest_enabled === "boolean"
        ? row.temporary_guest_enabled
        : DEFAULT_BOT_SETTINGS.temporary_guest_enabled,
      onboarding_selection_minutes: Number(row.onboarding_selection_minutes || DEFAULT_BOT_SETTINGS.onboarding_selection_minutes),
      temp_guest_hours: Number(
        typeof row.temporary_guest_enabled === "boolean"
          ? row.temp_guest_hours || DEFAULT_BOT_SETTINGS.temp_guest_hours
          : DEFAULT_BOT_SETTINGS.temp_guest_hours
      ),
      welcome_channel_id: row.welcome_channel_id || DEFAULT_BOT_SETTINGS.welcome_channel_id,
      free_company_chat_channel_id:
        row.free_company_chat_channel_id || DEFAULT_BOT_SETTINGS.free_company_chat_channel_id,
      welcome_engagement_enabled: typeof row.welcome_engagement_enabled === "boolean"
        ? row.welcome_engagement_enabled
        : DEFAULT_BOT_SETTINGS.welcome_engagement_enabled,
      welcome_wave_sticker_ids:
        row.welcome_wave_sticker_ids ?? DEFAULT_BOT_SETTINGS.welcome_wave_sticker_ids,
      officer_log_channel_id:
        row.officer_log_channel_id || DEFAULT_BOT_SETTINGS.officer_log_channel_id,
      event_channel_id: row.event_channel_id || DEFAULT_BOT_SETTINGS.event_channel_id,
      raid_channel_id: "",
      mount_farm_channel_id: "",
      mount_win_channel_id:
        row.mount_win_channel_id || DEFAULT_BOT_SETTINGS.mount_win_channel_id,
      mount_win_announcements_enabled:
        typeof row.mount_win_announcements_enabled === "boolean"
          ? row.mount_win_announcements_enabled
          : DEFAULT_BOT_SETTINGS.mount_win_announcements_enabled,
      anime_event_scheduling_enabled:
        typeof row.anime_event_scheduling_enabled === "boolean"
          ? row.anime_event_scheduling_enabled
          : DEFAULT_BOT_SETTINGS.anime_event_scheduling_enabled,
      crafting_channel_id:
        row.crafting_channel_id || DEFAULT_BOT_SETTINGS.crafting_channel_id,
      treasure_map_channel_id:
        row.treasure_map_channel_id || DEFAULT_BOT_SETTINGS.treasure_map_channel_id,
      treasure_map_auto_enabled:
        typeof row.treasure_map_auto_enabled === "boolean" ? row.treasure_map_auto_enabled : DEFAULT_BOT_SETTINGS.treasure_map_auto_enabled,
      roster_review_channel_id:
        row.roster_review_channel_id || DEFAULT_BOT_SETTINGS.roster_review_channel_id,
      test_channel_id: row.test_channel_id || DEFAULT_BOT_SETTINGS.test_channel_id,
      member_rename_notification_channel_id:
        row.member_rename_notification_channel_id || DEFAULT_BOT_SETTINGS.member_rename_notification_channel_id,
      gaming_setups_channel_id:
        row.gaming_setups_channel_id || DEFAULT_BOT_SETTINGS.gaming_setups_channel_id,
      pets_gallery_channel_id:
        row.pets_gallery_channel_id || DEFAULT_BOT_SETTINGS.pets_gallery_channel_id,
      glamours_gallery_channel_id:
        row.glamours_gallery_channel_id || DEFAULT_BOT_SETTINGS.glamours_gallery_channel_id,
      artwork_gallery_channel_id:
        row.artwork_gallery_channel_id || DEFAULT_BOT_SETTINGS.artwork_gallery_channel_id,
      giveaway_channel_id: row.giveaway_channel_id || DEFAULT_BOT_SETTINGS.giveaway_channel_id,
      contestants_channel_id: row.contestants_channel_id || DEFAULT_BOT_SETTINGS.contestants_channel_id,
      fashion_report_channel_id:
        row.fashion_report_channel_id || DEFAULT_BOT_SETTINGS.fashion_report_channel_id,
      fashion_report_enabled:
        typeof row.fashion_report_enabled === "boolean"
          ? row.fashion_report_enabled
          : DEFAULT_BOT_SETTINGS.fashion_report_enabled,
      anime_ranking_channel_id:
        row.anime_ranking_channel_id || DEFAULT_BOT_SETTINGS.anime_ranking_channel_id,
      anime_ranking_enabled:
        typeof row.anime_ranking_enabled === "boolean"
          ? row.anime_ranking_enabled
          : DEFAULT_BOT_SETTINGS.anime_ranking_enabled,
      anime_ranking_thread_enabled:
        typeof row.anime_ranking_thread_enabled === "boolean"
          ? row.anime_ranking_thread_enabled
          : DEFAULT_BOT_SETTINGS.anime_ranking_thread_enabled,
      lodestone_news_channel_id:
        row.lodestone_news_channel_id || DEFAULT_BOT_SETTINGS.lodestone_news_channel_id,
      lodestone_news_enabled:
        typeof row.lodestone_news_enabled === "boolean"
          ? row.lodestone_news_enabled
          : DEFAULT_BOT_SETTINGS.lodestone_news_enabled,
      notification_window_enabled:
        typeof row.notification_window_enabled === "boolean"
          ? row.notification_window_enabled
          : DEFAULT_BOT_SETTINGS.notification_window_enabled,
      notification_window_start_time:
        row.notification_window_start_time || DEFAULT_BOT_SETTINGS.notification_window_start_time,
      notification_window_end_time:
        row.notification_window_end_time || DEFAULT_BOT_SETTINGS.notification_window_end_time,
      rename_notifications_discord_members_enabled:
        typeof row.rename_notifications_discord_members_enabled === "boolean"
          ? row.rename_notifications_discord_members_enabled
          : DEFAULT_BOT_SETTINGS.rename_notifications_discord_members_enabled,
      rename_notifications_non_discord_members_enabled:
        typeof row.rename_notifications_non_discord_members_enabled === "boolean"
          ? row.rename_notifications_non_discord_members_enabled
          : DEFAULT_BOT_SETTINGS.rename_notifications_non_discord_members_enabled,
      auto_rename_enabled:
        typeof row.auto_rename_enabled === "boolean"
          ? row.auto_rename_enabled
          : DEFAULT_BOT_SETTINGS.auto_rename_enabled,
      auto_role_enabled:
        typeof row.auto_role_enabled === "boolean"
          ? row.auto_role_enabled
          : DEFAULT_BOT_SETTINGS.auto_role_enabled,
      startup_member_sync_enabled:
        typeof row.startup_member_sync_enabled === "boolean"
          ? row.startup_member_sync_enabled
          : DEFAULT_BOT_SETTINGS.startup_member_sync_enabled,
      log_unmatched_attempts:
        typeof row.log_unmatched_attempts === "boolean"
          ? row.log_unmatched_attempts
          : DEFAULT_BOT_SETTINGS.log_unmatched_attempts,
      auto_roster_scan_enabled:
        typeof row.auto_roster_scan_enabled === "boolean"
          ? row.auto_roster_scan_enabled
          : DEFAULT_BOT_SETTINGS.auto_roster_scan_enabled,
      roster_scan_interval_hours:
        Number(row.roster_scan_interval_hours || DEFAULT_BOT_SETTINGS.roster_scan_interval_hours)
    };
  } catch (error) {
    console.error("[cotf-bot] Failed to read bot settings, using .env defaults:", error.message);
    cachedBotSettings = DEFAULT_BOT_SETTINGS;
  }

  cachedBotSettingsAt = now;
  return cachedBotSettings;
}

// =========================
// SECTION 05: General Helpers
// =========================

// -------------------------
// SUBSECTION 05A: Normalize character/display names for matching
// -------------------------

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

// -------------------------
// SUBSECTION 05B: Extract useful Discord name values
// -------------------------

function getDiscordNameParts(memberOrUser) {
  const user = memberOrUser.user || memberOrUser;

  return {
    discordUserId: user.id,
    username: user.username || "",
    globalName: user.globalName || "",
    nickname: memberOrUser.nickname || "",
    displayName: memberOrUser.displayName || user.globalName || user.username || ""
  };
}

// -------------------------
// SUBSECTION 05C: Build public verification embed
// -------------------------

function buildVerifiedCharacterEmbed({ member, character }) {
  const imageUrl = character.portrait_url || character.avatar_url || null;
  const lodestoneUrl = character.lodestone_character_id
    ? `https://na.finalfantasyxiv.com/lodestone/character/${character.lodestone_character_id}/`
    : null;

  const embed = new EmbedBuilder()
    .setTitle(`${character.character_name} verified`)
    .setDescription(
      [
        `**${character.character_name}** has been verified as a ${GUILD_NAME} member.`,
        `Discord account: ${member}`,
        "",
        `World: **${character.world}**`,
        `FC Role: **${character.role}**`
      ].join("\n")
    )
    .setColor(0x8b5cf6)
    .setTimestamp()
    .setFooter({ text: "FFXIV materials © SQUARE ENIX" });

  if (lodestoneUrl) {
    embed.setURL(lodestoneUrl);
  }

  if (imageUrl) {
    embed.setImage(imageUrl);
  }

  return embed;
}

async function postVerifiedCharacterToWelcomeChannel(member, character) {
  try {
    const settings = await getBotSettings();
    if (!settings.welcome_channel_id) return false;

    const channel = await bot.channels.fetch(settings.welcome_channel_id);
    if (!channel?.isTextBased() || typeof channel.send !== "function") {
      throw new Error("The configured welcome destination is not a Discord text channel.");
    }

    await channel.send({
      content: `Welcome **${character.character_name}**! ${member}`,
      embeds: [buildVerifiedCharacterEmbed({ member, character })],
      allowedMentions: { users: [member.id], roles: [], repliedUser: false }
    });
    return true;
  } catch (error) {
    console.error(`[cotf-bot] Verified member welcome post failed for ${member.id}:`, error.message);
    return false;
  }
}

function parseWelcomeWaveStickerIds(value) {
  return [...new Set(String(value || "").split(/[\s,]+/).map((item) => item.trim()).filter(Boolean))];
}

async function selectWelcomeWaveSticker(stickerIds) {
  if (!stickerIds.length) return null;
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(846520260828);");
    await client.query(
      "insert into portal_welcome_wave_sticker_usage (sticker_id) select unnest($1::text[]) on conflict (sticker_id) do nothing;",
      [stickerIds]
    );
    const result = await client.query(
      "select sticker_id from portal_welcome_wave_sticker_usage where sticker_id = any($1::text[]) order by use_count asc, random() limit 1;",
      [stickerIds]
    );
    const stickerId = result.rows[0]?.sticker_id || stickerIds[Math.floor(Math.random() * stickerIds.length)];
    await client.query(
      "update portal_welcome_wave_sticker_usage set use_count = use_count + 1, last_used_at = now() where sticker_id = $1;",
      [stickerId]
    );
    await client.query("commit");
    return stickerId;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("[cotf-bot] Welcome-wave sticker rotation failed:", error.message);
    return stickerIds[Math.floor(Math.random() * stickerIds.length)];
  } finally {
    client.release();
  }
}
async function postCharacterGreetingOnce(member, character) {
  const membershipJoinedAt = Number(member.joinedTimestamp || 0);
  const claim = await pool.query(
    `insert into portal_verified_member_welcomes
       (guild_id,discord_user_id,membership_joined_at,character_id)
     values($1,$2,$3,$4)
     on conflict (guild_id,discord_user_id,membership_joined_at) do nothing
     returning guild_id`,
    [member.guild.id, member.id, membershipJoinedAt, character.id]
  );
  if (!claim.rows.length) return false;

  try {
    const settings = await getBotSettings();
    if (!settings.welcome_engagement_enabled || !settings.free_company_chat_channel_id) {
      await pool.query(
        `delete from portal_verified_member_welcomes
         where guild_id=$1 and discord_user_id=$2 and membership_joined_at=$3`,
        [member.guild.id, member.id, membershipJoinedAt]
      );
      return false;
    }
    const channel = await bot.channels.fetch(settings.free_company_chat_channel_id);
    if (!channel?.isTextBased() || typeof channel.send !== "function") throw new Error("The configured Free Company chat destination is not a Discord text channel.");
    const waveButton = new ButtonBuilder().setCustomId(`cotf_welcome_wave:${member.id}`).setLabel("Wave hello").setStyle(ButtonStyle.Secondary);
    await channel.send({
      content: `Welcome to the Free Company, **${character.character_name}**! ${member}`,
      components: [new ActionRowBuilder().addComponents(waveButton)],
      allowedMentions: { users: [member.id], roles: [], repliedUser: false }
    });
    await pool.query(
      `update portal_verified_member_welcomes set greeting_posted_at=now()
       where guild_id=$1 and discord_user_id=$2 and membership_joined_at=$3`,
      [member.guild.id, member.id, membershipJoinedAt]
    );
    return true;
  } catch (error) {
    await pool.query(
      `delete from portal_verified_member_welcomes
       where guild_id=$1 and discord_user_id=$2 and membership_joined_at=$3 and greeting_posted_at is null`,
      [member.guild.id, member.id, membershipJoinedAt]
    ).catch(() => undefined);
    console.error(`[cotf-bot] FC chat greeting failed for ${member.id}:`, error.message);
    return false;
  }
}

async function handleWelcomeWave(interaction) {
  const targetUserId = interaction.customId.split(":")[1];
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const settings = await getBotSettings();
    if (!settings.welcome_engagement_enabled) {
      await interaction.editReply("Portal welcome engagement is disabled. Your server can use Discord's built-in welcome features instead.");
      return;
    }
    let stickerIds = parseWelcomeWaveStickerIds(settings.welcome_wave_sticker_ids);
    if (!stickerIds.length && interaction.guild) {
      const stickers = await interaction.guild.stickers.fetch().catch(() => null);
      stickerIds = stickers ? [...stickers.values()].filter((sticker) => /wave|hello|welcome|greet|hi/i.test(sticker.name || "")).map((sticker) => sticker.id) : [];
    }
    const stickerId = await selectWelcomeWaveSticker(stickerIds);
    const content = `${interaction.user} waves hello to <@${targetUserId}>!`;
    try {
      await interaction.channel.send({ content, ...(stickerId ? { stickers: [stickerId] } : {}), allowedMentions: { users: [interaction.user.id, targetUserId], roles: [], repliedUser: false } });
    } catch (error) {
      await interaction.channel.send({ content, allowedMentions: { users: [interaction.user.id, targetUserId], roles: [], repliedUser: false } });
    }
    await interaction.editReply("Your greeting was posted.");
  } catch (error) {
    console.error("[cotf-bot] Welcome wave failed:", error.message);
    await interaction.editReply("The bot could not post that greeting right now.");
  }
}

// -------------------------
// SUBSECTION 05D: Build verification prompt UI
// -------------------------

function buildVerificationPromptMessage(targetUserId = "", selectionMinutes = 30, guestHours = 6, temporaryGuestsEnabled = false) {
  const targeted = Boolean(targetUserId);
  const embed = new EmbedBuilder()
    .setTitle(targeted ? "Choose Your Server Access" : `${GUILD_NAME} Verification`)
    .setDescription(
      targeted
        ? temporaryGuestsEnabled
          ? [
              "Choose the option that describes why you joined.",
              "",
              "**FC Member:** verify your FFXIV character and receive normal member access.",
              `**Temporary Guest:** receive private guest access for ${guestHours} hours.`,
              "",
              `Please choose within ${selectionMinutes} minutes or the server will remove you automatically.`
            ].join("\n")
          : [
              "Verify your FFXIV character to receive normal member access.",
              "",
              `Please complete verification within ${selectionMinutes} minutes or the server will remove you automatically.`
            ].join("\n")
        : [
            `Welcome to ${GUILD_NAME}.`,
            "",
            "Click **Verify Character** and enter your exact FFXIV character name.",
            "If your character is currently in the FC roster, I'll update your Discord nickname and assign access automatically."
          ].join("\n")
    )
    .setColor(0x8b5cf6);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(targeted ? `cotf_verify_character:${targetUserId}` : "cotf_verify_character")
      .setLabel(targeted ? "I'm an FC Member" : "Verify Character")
      .setStyle(ButtonStyle.Primary)
  );

  if (targeted && temporaryGuestsEnabled) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`cotf_temporary_guest:${targetUserId}`)
        .setLabel("I'm a Temporary Guest")
        .setStyle(ButtonStyle.Secondary)
    );
  }

  return { embeds: [embed], components: [row] };
}
// -------------------------
// SUBSECTION 05E: Build verification modal
// -------------------------

function buildVerificationModal(targetUserId = "") {
  const modal = new ModalBuilder()
    .setCustomId(targetUserId ? `cotf_verify_character_modal:${targetUserId}` : "cotf_verify_character_modal")
    .setTitle("Verify FFXIV Character");

  const characterInput = new TextInputBuilder()
    .setCustomId("character_name")
    .setLabel("Exact FFXIV character name")
    .setPlaceholder("Example: Y'shtola Rhul")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(64);

  const row = new ActionRowBuilder().addComponents(characterInput);

  modal.addComponents(row);

  return modal;
}

// =========================
// SECTION 06: Database Schema
// =========================

// -------------------------
// SUBSECTION 06A: Ensure Discord database tables exist
// -------------------------

async function ensureBotTables() {
  await pool.query(`
    create table if not exists portal_discord_links (
      discord_user_id text primary key,
      discord_username text,
      discord_global_name text,
      discord_nickname text,
      discord_display_name text,
      character_id integer references portal_characters(id) on delete set null,
      match_source text not null default 'unknown',
      matched_at timestamptz,
      last_seen_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await pool.query(`
    alter table portal_discord_links add column if not exists privacy_mode text not null default 'full';
    alter table portal_characters add column if not exists privacy_suppressed boolean not null default false;
    create table if not exists portal_privacy_suppressions (
      id bigserial primary key,
      discord_fingerprint text not null unique,
      lodestone_fingerprint text,
      status text not null default 'active' check(status in ('active','opted_back_in')),
      requested_by_kind text not null default 'member',
      policy_version text not null default '2026-09-06',
      requested_at timestamptz not null default now(),
      opted_back_in_at timestamptz
    );
    alter table portal_privacy_suppressions drop constraint if exists portal_privacy_suppressions_lodestone_fingerprint_key;
    create table if not exists portal_privacy_suppressed_characters(discord_fingerprint text not null,lodestone_fingerprint text not null,created_at timestamptz not null default now(),primary key(discord_fingerprint,lodestone_fingerprint));
  `);

  await pool.query(`
    create or replace function portal_reject_duplicate_character_link()
    returns trigger
    language plpgsql
    as $$
    begin
      if new.character_id is null then
        return new;
      end if;

      perform pg_advisory_xact_lock(new.character_id::bigint);
      if exists (
        select 1
        from portal_discord_links existing_link
        where existing_link.character_id = new.character_id
          and existing_link.discord_user_id <> new.discord_user_id
      ) then
        raise exception 'Character % is already linked to another Discord account.', new.character_id
          using errcode = '23505', constraint = 'portal_discord_links_character_owner';
      end if;

      if to_regclass('public.portal_alt_character_links') is not null and exists (
        select 1
        from portal_alt_character_links existing_alt
        where existing_alt.character_id = new.character_id
          and existing_alt.active = true
          and existing_alt.discord_user_id <> new.discord_user_id
      ) then
        raise exception 'Character % is already linked as another Discord account''s additional character.', new.character_id
          using errcode = '23505', constraint = 'portal_character_cross_owner';
      end if;

      if to_regclass('public.portal_alt_character_links') is not null then
        update portal_alt_character_links
        set active=false,is_primary=false,updated_at=now()
        where character_id=new.character_id and discord_user_id=new.discord_user_id and active=true;
      end if;

      return new;
    end;
    $$;

    drop trigger if exists portal_discord_links_one_owner on portal_discord_links;
    create trigger portal_discord_links_one_owner
      before insert or update of character_id on portal_discord_links
      for each row execute function portal_reject_duplicate_character_link();
  `);

  await pool.query(`
    do $$
    begin
      if not exists (
        select character_id
        from portal_discord_links
        where character_id is not null
        group by character_id
        having count(*) > 1
      ) then
        create unique index if not exists portal_discord_links_one_character
          on portal_discord_links (character_id)
          where character_id is not null;
      end if;
    end;
    $$;
  `);

  await pool.query(`
    create table if not exists portal_discord_audit_log (
      id bigserial primary key,
      discord_user_id text,
      discord_username text,
      discord_global_name text,
      discord_nickname text,
      discord_display_name text,
      submitted_character_name text,
      character_id integer references portal_characters(id) on delete set null,
      attempt_type text not null,
      result text not null,
      reason text,
      details jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
  `);



  await pool.query(`
    create table if not exists portal_welcome_wave_sticker_usage (
      sticker_id text primary key,
      use_count bigint not null default 0,
      last_used_at timestamptz
    );
  `);

  await pool.query(`
    create table if not exists portal_verified_member_welcomes (
      guild_id text not null,
      discord_user_id text not null,
      membership_joined_at bigint not null,
      character_id bigint references portal_characters(id) on delete set null,
      greeting_posted_at timestamptz,
      created_at timestamptz not null default now(),
      primary key (guild_id, discord_user_id, membership_joined_at)
    );
  `);

  await pool.query(`
    create table if not exists portal_discord_guest_access (
      id bigserial primary key,
      guild_id text not null,
      discord_user_id text not null,
      status text not null default 'pending',
      joined_at timestamptz not null default now(),
      selection_expires_at timestamptz not null,
      selected_at timestamptz,
      expires_at timestamptz,
      prompt_channel_id text,
      prompt_message_id text,
      processed_at timestamptz,
      last_error text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (guild_id, discord_user_id)
    );
  `);
  await pool.query(`
    create index if not exists portal_discord_guest_access_due_idx
      on portal_discord_guest_access (status, selection_expires_at, expires_at);
  `);

  await pool.query(`
    create table if not exists portal_character_rename_history (
      id bigserial primary key,
      character_id bigint not null references portal_characters(id) on delete cascade,
      old_name text not null,
      new_name text not null,
      detected_at timestamptz not null default now(),
      notification_status text not null default 'pending',
      notification_message_id text,
      confirmation_status text not null default 'pending',
      confirmed_at timestamptz,
      confirmed_by text
    );
  `);

  await pool.query(`
    create unique index if not exists portal_character_rename_history_unique
    on portal_character_rename_history (character_id, old_name, new_name);
  `);
  await pool.query(`
    alter table portal_characters
      add column if not exists mount_win_notifications_enabled boolean not null default true;
  `);

  await pool.query(`
    create table if not exists portal_mount_acquisitions (
      id bigserial primary key,
      character_id bigint not null,
      mount_id bigint not null,
      character_name text not null,
      mount_name text not null,
      detected_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      unique(character_id, mount_id)
    );
  `);

  await pool.query(`
    alter table portal_mount_acquisitions
      add column if not exists discord_sent_at timestamptz,
      add column if not exists discord_error text,
      add column if not exists is_test boolean not null default false;
  `);
  await pool.query(`
    create table if not exists portal_discord_bot_settings (
      id integer primary key default 1,
      guild_id text not null default '',
      verified_role_id text not null default '',
      unverified_role_id text not null default '',
      temp_access_role_id text not null default '',
      temporary_guest_enabled boolean,
      onboarding_selection_minutes integer not null default 30,
      temp_guest_hours integer not null default 6,
      welcome_channel_id text not null default '',
      free_company_chat_channel_id text not null default '',
      welcome_engagement_enabled boolean not null default false,
      welcome_wave_sticker_ids text not null default '',
      officer_log_channel_id text not null default '',
      event_channel_id text not null default '',
      raid_channel_id text not null default '',
      mount_farm_channel_id text not null default '',
      mount_win_channel_id text not null default '',
      mount_win_announcements_enabled boolean not null default true,
      anime_event_scheduling_enabled boolean,
      crafting_channel_id text not null default '',
      treasure_map_channel_id text not null default '',
      treasure_map_auto_enabled boolean not null default false,
      roster_review_channel_id text not null default '',
      test_channel_id text not null default '',
      member_rename_notification_channel_id text not null default '',
      gaming_setups_channel_id text not null default '',
      pets_gallery_channel_id text not null default '',
      glamours_gallery_channel_id text not null default '',
      artwork_gallery_channel_id text not null default '',
      giveaway_channel_id text not null default '',
      contestants_channel_id text not null default '',
      fashion_report_channel_id text not null default '',
      fashion_report_enabled boolean not null default false,
      anime_ranking_channel_id text not null default '',
      anime_ranking_enabled boolean not null default false,
      anime_ranking_thread_enabled boolean not null default true,
      lodestone_news_channel_id text not null default '',
      lodestone_news_enabled boolean not null default false,
      notification_window_enabled boolean not null default false,
      notification_window_start_time text not null default '08:00',
      notification_window_end_time text not null default '22:00',
      rename_notifications_discord_members_enabled boolean not null default true,
      rename_notifications_non_discord_members_enabled boolean not null default true,
      auto_rename_enabled boolean not null default true,
      auto_role_enabled boolean not null default true,
      startup_member_sync_enabled boolean not null default false,
      log_unmatched_attempts boolean not null default true,
      auto_roster_scan_enabled boolean not null default false,
      roster_scan_interval_hours integer not null default 24,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint portal_discord_bot_settings_singleton check (id = 1)
    );
  `);

  await pool.query(`
    alter table portal_discord_bot_settings
      add column if not exists guild_id text not null default '',
      add column if not exists verified_role_id text not null default '',
      add column if not exists unverified_role_id text not null default '',
      add column if not exists temp_access_role_id text not null default '',
      add column if not exists temporary_guest_enabled boolean,
      add column if not exists onboarding_selection_minutes integer not null default 30,
      add column if not exists temp_guest_hours integer not null default 6,
      add column if not exists welcome_channel_id text not null default '',
      add column if not exists free_company_chat_channel_id text not null default '',
      add column if not exists welcome_engagement_enabled boolean not null default false,
      add column if not exists welcome_wave_sticker_ids text not null default '',
      add column if not exists officer_log_channel_id text not null default '',
      add column if not exists event_channel_id text not null default '',
      add column if not exists raid_channel_id text not null default '',
      add column if not exists mount_farm_channel_id text not null default '',
      add column if not exists mount_win_channel_id text not null default '',
      add column if not exists mount_win_announcements_enabled boolean not null default true,
      add column if not exists anime_event_scheduling_enabled boolean,
      add column if not exists crafting_channel_id text not null default '',
      add column if not exists treasure_map_channel_id text not null default '',
      add column if not exists treasure_map_auto_enabled boolean not null default false,
      add column if not exists roster_review_channel_id text not null default '',
      add column if not exists test_channel_id text not null default '',
      add column if not exists member_rename_notification_channel_id text not null default '',
      add column if not exists gaming_setups_channel_id text not null default '',
      add column if not exists pets_gallery_channel_id text not null default '',
      add column if not exists glamours_gallery_channel_id text not null default '',
      add column if not exists artwork_gallery_channel_id text not null default '',
      add column if not exists giveaway_channel_id text not null default '',
      add column if not exists contestants_channel_id text not null default '',
      add column if not exists fashion_report_channel_id text not null default '',
      add column if not exists fashion_report_enabled boolean not null default false,
      add column if not exists anime_ranking_channel_id text not null default '',
      add column if not exists anime_ranking_enabled boolean not null default false,
      add column if not exists anime_ranking_thread_enabled boolean not null default true,
      add column if not exists lodestone_news_channel_id text not null default '',
      add column if not exists lodestone_news_enabled boolean not null default false,
      add column if not exists notification_window_enabled boolean not null default false,
      add column if not exists notification_window_start_time text not null default '08:00',
      add column if not exists notification_window_end_time text not null default '22:00',
      add column if not exists rename_notifications_discord_members_enabled boolean not null default true,
      add column if not exists rename_notifications_non_discord_members_enabled boolean not null default true,
      add column if not exists auto_rename_enabled boolean not null default true,
      add column if not exists auto_role_enabled boolean not null default true,
      add column if not exists startup_member_sync_enabled boolean not null default false,
      add column if not exists log_unmatched_attempts boolean not null default true,
      add column if not exists auto_roster_scan_enabled boolean not null default false,
      add column if not exists roster_scan_interval_hours integer not null default 24,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now();
  `);

  await pool.query(`
    update portal_discord_bot_settings
    set event_channel_id = case
          when raid_channel_id <> '' then raid_channel_id
          when event_channel_id = '' and mount_farm_channel_id <> '' then mount_farm_channel_id
          else event_channel_id
        end,
        raid_channel_id = '',
        mount_farm_channel_id = '',
        updated_at = now()
    where raid_channel_id <> '' or mount_farm_channel_id <> '';
  `);

  await pool.query(`
    alter table if exists portal_crafting_project_discord_posts
      add column if not exists completion_message_id text,
      add column if not exists completion_announced_at timestamptz,
      add column if not exists last_project_status text;
  `);

  await pool.query(`
    create table if not exists portal_community_gallery_posts (
      id bigserial primary key,
      category text not null check (category in ('gaming_setup', 'pet', 'glamour', 'artwork')),
      source_channel_id text not null,
      source_message_id text not null unique,
      discord_user_id text not null,
      discord_display_name text not null,
      caption text,
      posted_at timestamptz not null,
      review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
      reviewed_by text,
      reviewed_at timestamptz,
      review_note text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await pool.query(`
    create table if not exists portal_community_gallery_images (
      id bigserial primary key,
      post_id bigint not null references portal_community_gallery_posts(id) on delete cascade,
      source_attachment_id text not null,
      filename text not null,
      mime_type text not null,
      image_data bytea not null,
      image_size integer not null,
      created_at timestamptz not null default now(),
      unique (post_id, source_attachment_id)
    );
  `);
  await pool.query(`
    create index if not exists portal_community_gallery_posts_review_idx
    on portal_community_gallery_posts (review_status, category, posted_at desc);
  `);
  await pool.query(`
    create table if not exists portal_community_gallery_import_requests (
      category text primary key check (category in ('gaming_setup', 'pet', 'glamour', 'artwork')),
      requested_by text,
      requested_at timestamptz not null default now(),
      status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
      scanned_messages integer not null default 0,
      imported_posts integer not null default 0,
      completed_at timestamptz,
      error_text text
    );
  `);
  await pool.query(`
    do $$
    declare constraint_name text;
    begin
      select conname into constraint_name
      from pg_constraint
      where conrelid = 'portal_community_gallery_posts'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) like '%category%'
      limit 1;
      if constraint_name is not null then
        execute format('alter table portal_community_gallery_posts drop constraint %I', constraint_name);
      end if;
    end $$;
    alter table portal_community_gallery_posts
      add constraint portal_community_gallery_posts_category_allowed
      check (category in ('gaming_setup', 'pet', 'glamour', 'artwork'));
  `);
  await pool.query(`
    do $$
    declare constraint_name text;
    begin
      select conname into constraint_name
      from pg_constraint
      where conrelid = 'portal_community_gallery_import_requests'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) like '%category%'
      limit 1;
      if constraint_name is not null then
        execute format('alter table portal_community_gallery_import_requests drop constraint %I', constraint_name);
      end if;
    end $$;
    alter table portal_community_gallery_import_requests
      add constraint portal_community_gallery_import_requests_category_allowed
      check (category in ('gaming_setup', 'pet', 'glamour', 'artwork'));
  `);
  await pool.query(
      `
      insert into portal_discord_bot_settings (
        id,
        guild_id,
        verified_role_id,
        unverified_role_id,
        temp_access_role_id,
        temporary_guest_enabled,
        temp_guest_hours,
        welcome_channel_id,
        welcome_engagement_enabled,
        welcome_wave_sticker_ids,
        officer_log_channel_id,
        startup_member_sync_enabled
      )
      values (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      on conflict (id) do update set
        temporary_guest_enabled = coalesce(portal_discord_bot_settings.temporary_guest_enabled, excluded.temporary_guest_enabled),
        temp_access_role_id = case
          when portal_discord_bot_settings.temporary_guest_enabled is null then excluded.temp_access_role_id
          else portal_discord_bot_settings.temp_access_role_id
        end,
        temp_guest_hours = case
          when portal_discord_bot_settings.temporary_guest_enabled is null then excluded.temp_guest_hours
          else portal_discord_bot_settings.temp_guest_hours
        end;
    `,
    [
      DISCORD_GUILD_ID,
      DISCORD_VERIFIED_ROLE_ID,
      DISCORD_UNVERIFIED_ROLE_ID,
      DISCORD_TEMP_ACCESS_ROLE_ID,
      DISCORD_TEMP_GUEST_ENABLED,
      DISCORD_TEMP_GUEST_HOURS,
      DISCORD_WELCOME_CHANNEL_ID,
      DISCORD_WELCOME_ENGAGEMENT_ENABLED,
      DISCORD_WELCOME_WAVE_STICKER_IDS,
      DISCORD_OFFICER_LOG_CHANNEL_ID,
      process.env.RUN_STARTUP_MEMBER_SYNC === "true"
    ]
  );
}


// =========================
// SECTION 07: Character Matching
// =========================

// -------------------------
// SUBSECTION 07A: Find current FC character by exact normalized name
// -------------------------

async function findCurrentFcCharacterByName(characterName) {
  const normalized = normalizeName(characterName);

  if (!normalized) {
    return null;
  }

  const result = await pool.query(
    `
      select
        id::int,
        display_name,
        character_name,
        world,
        role,
        fc_membership_status,
        lodestone_character_id,
        portrait_url,
        avatar_url
      from portal_characters
      where active = true
        and fc_membership_status = 'current'
        and (
          regexp_replace(lower(character_name), '[^a-z0-9]+', '', 'g') = $1
          or regexp_replace(lower(display_name), '[^a-z0-9]+', '', 'g') = $1
        )
      order by lower(character_name) asc
      limit 2;
    `,
    [normalized]
  );

  if (result.rows.length !== 1) {
    return null;
  }

  return result.rows[0];
}


// =========================
// SECTION 08: Audit Logging
// =========================

// -------------------------
// SUBSECTION 08A: Send message to officer log channel
// -------------------------

async function sendOfficerLog(message, dedupeKey = `automation:${Date.now()}:${Math.random()}`, forceDelivery = false) {
  const settings = await getBotSettings();
  if (!settings.officer_log_channel_id) return;
  await queueOfficerLog(message, dedupeKey);
  await processPendingOfficerLogs(settings, forceDelivery);
}

async function postVerifiedCharacterGreeting(member, character) {
  const readiness = await getVerifiedWelcomeReadiness(member, character);
  if (!readiness.ready) {
    console.warn(`[cotf-bot] FC chat greeting deferred for ${member.id}: ${readiness.missing.join(", ")}.`);
    return false;
  }
  return postCharacterGreetingOnce(member, character);
}

async function postOfficerApprovedCharacterGreeting(member, characterName) {
  const membershipJoinedAt = new Date(member.joinedTimestamp).toISOString();
  const approval = await pool.query(
    `select 1 from portal_discord_roster_overrides
     where guild_id=$1 and discord_user_id=$2 and character_name=$3
       and status='approved' and membership_joined_at=$4::timestamptz
     limit 1`,
    [member.guild.id, member.id, characterName, membershipJoinedAt]
  );
  if (!approval.rows.length) return false;
  return postCharacterGreetingOnce(member, { id: null, character_name: characterName });
}

async function getVerifiedWelcomeReadiness(member, character) {
  if (!member?.guild?.id || !member?.id || !character?.id) {
    return { ready: false, missing: ["verified character link"] };
  }

  const settings = await getBotSettings();
  const link = await pool.query(
    `select 1
     from portal_characters c
     where c.id=$2 and c.active=true and c.fc_membership_status='current'
       and (
         exists (
           select 1 from portal_discord_links dl
           where dl.discord_user_id=$1 and dl.character_id=c.id
         )
         or exists (
           select 1 from portal_alt_character_links acl
           where acl.discord_user_id=$1 and acl.character_id=c.id and acl.active=true
         )
       )
     limit 1`,
    [member.id, character.id]
  );
  const missing = [];
  if (!link.rows.length) missing.push("verified character link");
  if (settings.auto_rename_enabled && member.displayName !== character.character_name) {
    missing.push("verified nickname");
  }
  if (
    settings.auto_role_enabled &&
    settings.verified_role_id &&
    !member.roles.cache.has(settings.verified_role_id)
  ) {
    missing.push("verified role");
  }
  return { ready: missing.length === 0, missing };
}

async function queueOfficerLog(payload, dedupeKey) {
  await pool.query(
    `insert into portal_discord_officer_log_outbox (dedupe_key, payload)
     values ($1, $2::jsonb)
     on conflict (dedupe_key) do nothing;`,
    [dedupeKey, JSON.stringify(payload)]
  );
}

async function processPendingOfficerLogs(settings = null, forceDelivery = false) {
  settings = settings || await getBotSettings();
  if (!settings.officer_log_channel_id || (!forceDelivery && !isAutomatedNotificationWindowOpen(settings))) return;
  const channel = await bot.channels.fetch(settings.officer_log_channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) return;
  const pending = await pool.query(`select id, payload from portal_discord_officer_log_outbox where status = 'pending' order by id asc limit 25;`);
  for (const row of pending.rows) {
    const claimed = await pool.query(`update portal_discord_officer_log_outbox set status = 'sending', updated_at = now() where id = $1 and status = 'pending' returning id;`, [row.id]);
    if (!claimed.rows.length) continue;
    try {
      await channel.send(row.payload);
      await pool.query(`update portal_discord_officer_log_outbox set status = 'sent', sent_at = now(), updated_at = now() where id = $1;`, [row.id]);
    } catch (error) {
      await pool.query(`update portal_discord_officer_log_outbox set status = 'pending', updated_at = now() where id = $1;`, [row.id]);
      console.error("[cotf-bot] Failed to deliver queued officer log:", error.message);
      break;
    }
  }
}

// -------------------------
// SUBSECTION 08B: Write audit row to database
// -------------------------

async function writeAuditLog({
  member,
  submittedCharacterName = "",
  character = null,
  attemptType,
  result,
  reason = "",
  details = {}
}) {
  const names = getDiscordNameParts(member);

  await pool.query(
    `
      insert into portal_discord_audit_log (
        discord_user_id,
        discord_username,
        discord_global_name,
        discord_nickname,
        discord_display_name,
        submitted_character_name,
        character_id,
        attempt_type,
        result,
        reason,
        details
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb);
    `,
    [
      names.discordUserId,
      names.username,
      names.globalName,
      names.nickname,
      names.displayName,
      submittedCharacterName,
      character?.id || null,
      attemptType,
      result,
      reason,
      JSON.stringify(details)
    ]
  );

  const settings = await getBotSettings();

  if (!["matched", "success", "completed"].includes(result) && settings.log_unmatched_attempts) {
    await sendOfficerLog(
      [
        `[Warning] **Discord automation ${result}**`,
        `User: ${names.displayName || names.username} (${names.discordUserId})`,
        submittedCharacterName ? `Submitted: ${submittedCharacterName}` : null,
        `Attempt: ${attemptType}`,
        reason ? `Reason: ${reason}` : null
      ]
        .filter(Boolean)
        .join("\n")
    );
  }
}


// =========================
// SECTION 09: Discord Link Management
// =========================

// -------------------------
// SUBSECTION 09A: Save Discord user <-> character link
// -------------------------

function privacyFingerprint(kind, value) {
  const secret = String(process.env.PRIVACY_SUPPRESSION_SECRET || process.env.AUTH_SECRET || "").trim();
  if (!secret) throw new Error("A privacy suppression secret is required for privacy suppression.");
  return createHmac("sha256", secret).update(`${kind}:${String(value).trim()}`).digest("hex");
}

async function isDiscordPrivacySuppressed(discordUserId) {
  if (!discordUserId) return false;
  const result = await pool.query(
    "select 1 from portal_privacy_suppressions where discord_fingerprint=$1 and status='active' limit 1",
    [privacyFingerprint("discord", discordUserId)]
  );
  return Boolean(result.rows.length);
}

async function isFcOwnershipVerified() {
  try {
    const result = await pool.query("select 1 from portal_fc_verification where id=1 and status='verified' limit 1");
    return Boolean(result.rows.length);
  } catch {
    return false;
  }
}

async function getDiscordPrivacyMode(discordUserId) {
  const result = await pool.query("select privacy_mode from portal_discord_links where discord_user_id=$1 limit 1", [discordUserId]);
  return String(result.rows[0]?.privacy_mode || "full");
}

async function optDiscordUserBackIn(discordUserId) {
  const fingerprint=privacyFingerprint("discord", discordUserId);
  const result = await pool.query(
    "update portal_privacy_suppressions set status='opted_back_in',opted_back_in_at=now() where discord_fingerprint=$1 and status='active' returning id",
    [fingerprint]
  );
  await pool.query("delete from portal_privacy_suppressed_characters where discord_fingerprint=$1",[fingerprint]);
  return Boolean(result.rows.length);
}

function buildPrivacyOptInPrompt(targetUserId = "", oneTimeMessageId = "") {
  return {
    content: "You previously opted out of portal verification and automatic data collection. To continue, explicitly opt back in. This starts a new verification record; deleted history is not restored.",
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`cotf_privacy_optin:${targetUserId}:${oneTimeMessageId}`).setLabel("Opt In and Re-verify").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("cotf_privacy_remain_opted_out").setLabel("Remain Opted Out").setStyle(ButtonStyle.Secondary)
    )]
  };
}

async function linkDiscordMemberToCharacter({
  member,
  character,
  matchSource
}) {
  const names = getDiscordNameParts(member);
  if (await isDiscordPrivacySuppressed(names.discordUserId)) return { ok: false, privacySuppressed: true };
  const verificationOnly = await getDiscordPrivacyMode(names.discordUserId) === "verification_only";
  const conflictResult = await pool.query(
    "select discord_user_id, discord_username, discord_global_name, discord_nickname, discord_display_name from portal_discord_links where character_id=$1 and discord_user_id<>$2 limit 1;",
    [character.id, names.discordUserId]
  );
  const conflict = conflictResult.rows[0] || null;

  if (conflict) {
    return { ok: false, conflict };
  }

  try {
    const savedLink = await pool.query(
      `
      insert into portal_discord_links (
        discord_user_id,
        discord_username,
        discord_global_name,
        discord_nickname,
        discord_display_name,
        character_id,
        match_source,
        matched_at,
        last_seen_at,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, now(), now(), now())
      on conflict (discord_user_id)
      do update set
        discord_username = excluded.discord_username,
        discord_global_name = excluded.discord_global_name,
        discord_nickname = excluded.discord_nickname,
        discord_display_name = excluded.discord_display_name,
        character_id = excluded.character_id,
        match_source = excluded.match_source,
        matched_at = now(),
        last_seen_at = now(),
        updated_at = now()
      where excluded.match_source <> 'roster_override_recheck'
        or (portal_discord_links.character_id = excluded.character_id
          and portal_discord_links.match_source = 'roster_override_recheck')
      returning discord_user_id;
      `,
      [
        names.discordUserId,
        verificationOnly ? null : names.username,
        verificationOnly ? null : names.globalName,
        verificationOnly ? null : names.nickname,
        verificationOnly ? null : names.displayName,
        character.id,
        matchSource
      ]
    );
    if (!savedLink.rows.length) return { ok: false, corrected: true, conflict: null };
  } catch (error) {
    if (error?.code === "23505") {
      const concurrentConflict = await pool.query(
        "select discord_user_id, discord_username, discord_global_name, discord_nickname, discord_display_name from portal_discord_links where character_id=$1 and discord_user_id<>$2 limit 1;",
        [character.id, names.discordUserId]
      );
      if (concurrentConflict.rows[0]) {
        return { ok: false, conflict: concurrentConflict.rows[0] };
      }
    }
    throw error;
  }

  return { ok: true, conflict: null };
}

async function getPrimaryPortalAdministratorId() {
  if (PRIMARY_PORTAL_ADMIN_ID) return PRIMARY_PORTAL_ADMIN_ID;

  const result = await pool.query("select value from portal_settings where key='additionalAdminDiscordIds' limit 1;").catch(() => ({ rows: [] }));
  return String(result.rows[0]?.value || "")
    .split(",")
    .map((value) => value.trim())
    .find((value) => /^\d{15,22}$/.test(value)) || "";
}

function getConflictDiscordName(conflict) {
  return conflict?.discord_display_name
    || conflict?.discord_nickname
    || conflict?.discord_global_name
    || conflict?.discord_username
    || conflict?.discord_user_id
    || "Unknown Discord account";
}

async function notifyCharacterLinkConflict({ member, character, conflict, attemptType }) {
  const primaryAdminId = await getPrimaryPortalAdministratorId();
  const existingName = getConflictDiscordName(conflict);
  const requestingName = member.displayName || member.user?.globalName || member.user?.username || member.id;
  const adminMention = primaryAdminId ? `<@${primaryAdminId}>` : "Portal administrator";
  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("Character Verification Conflict")
    .setDescription("Two Discord identities attempted to claim the same FC character. Verification for the newer attempt was blocked.")
    .addFields(
      { name: "FC Character", value: `${character.character_name} · ${character.world}`, inline: false },
      { name: "Existing Discord Link", value: `${existingName} (${conflict.discord_user_id})`, inline: false },
      { name: "Blocked Discord Attempt", value: `${requestingName} (${member.id})`, inline: false },
      { name: "Attempt", value: attemptType, inline: true },
      { name: "How to Resolve", value: "Open Officer Area → Discord Automation. Reassign the character to the intended Discord identity. The confirmation dialog can clear only the old link or explicitly transfer the Verified role.", inline: false }
    )
    .setTimestamp(new Date());

  const payload = {
    content: `${adminMention} a character verification conflict needs review.`,
    embeds: [embed],
    allowedMentions: primaryAdminId ? { users: [primaryAdminId] } : { parse: [] }
  };

  const conflictButtons = [
    new ButtonBuilder()
      .setCustomId(`cotf_link_conflict:keep:${character.id}:${conflict.discord_user_id}:${member.id}`)
      .setLabel("Keep Existing Link")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`cotf_link_conflict:replace:${character.id}:${conflict.discord_user_id}:${member.id}`)
      .setLabel("Replace Link Only")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`cotf_link_conflict:transfer:${character.id}:${conflict.discord_user_id}:${member.id}`)
      .setLabel("Replace + Transfer Role")
      .setStyle(ButtonStyle.Primary)
  ];

  if (PORTAL_URL) {
    try {
      const reviewUrl = new URL(PORTAL_URL);
      reviewUrl.hash = "officer-discord-automation";
      conflictButtons.push(
        new ButtonBuilder()
          .setLabel("Open Officer Review")
          .setStyle(ButtonStyle.Link)
          .setURL(reviewUrl.toString())
      );
    } catch {
      // The alert still contains complete manual navigation instructions.
    }
  }
  payload.components = [new ActionRowBuilder().addComponents(conflictButtons)];

  const hourBucket = new Date().toISOString().slice(0, 13);
  await sendOfficerLog(
    payload,
    `verification-conflict:${character.id}:${conflict.discord_user_id}:${member.id}:${hourBucket}`,
    true
  );
  return primaryAdminId;
}

async function handleCharacterLinkConflictAction(interaction) {
  const [, resolution, characterIdText, existingDiscordUserId, requestedDiscordUserId] = interaction.customId.split(":");
  const characterId = Number.parseInt(characterIdText || "", 10);
  if (!["keep", "replace", "transfer"].includes(resolution) || !Number.isFinite(characterId)) {
    await interaction.reply({ content: "This conflict action is invalid.", flags: MessageFlags.Ephemeral });
    return;
  }

  if (!await isProtectedPortalAdministrator(interaction.user.id)) {
    await interaction.reply({ content: "Only a configured portal administrator can resolve character-link conflicts.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  if (resolution === "keep") {
    await pool.query("insert into portal_discord_audit_log (discord_user_id,submitted_character_name,character_id,attempt_type,result,reason,details,created_at) select $1,c.character_name,c.id,'officer_conflict_keep','denied','Administrator kept the existing Discord character link.',$2::jsonb,now() from portal_characters c where c.id=$3;", [
      requestedDiscordUserId,
      JSON.stringify({ existingDiscordUserId, resolvedByDiscordUserId: interaction.user.id }),
      characterId
    ]);
    await interaction.message.edit({ components: [] }).catch(() => undefined);
    await interaction.editReply("The existing Discord character link was kept. No roles or links were changed.");
    return;
  }

  if (await isDiscordPrivacySuppressed(requestedDiscordUserId)) {
    await interaction.editReply("That member has opted out. They must personally choose Opt In and Re-verify before an officer can replace the link.");
    return;
  }

  if (!await isFcOwnershipVerified()) {
    await interaction.editReply("FC ownership verification is still pending. No character links or Discord roles were changed.");
    return;
  }

  const guild = interaction.guild;
  const requestedMember = guild ? await fetchGuildMemberSafe(guild, requestedDiscordUserId) : null;
  if (!guild || !requestedMember) {
    await interaction.editReply("The replacement Discord member is no longer present in this server. No changes were made.");
    return;
  }

  const names = getDiscordNameParts(requestedMember);
  const client = await pool.connect();
  let target = null;
  let transactionOpen = false;
  try {
    await client.query("begin");
    transactionOpen = true;
    const targetResult = await client.query("select id::int,character_name,world,role,active,fc_membership_status from portal_characters where id=$1 and active=true and fc_membership_status='current' for share;", [characterId]);
    target = targetResult.rows[0] || null;
    if (!target) throw new Error("The FC character is no longer active and current.");

    const existingResult = await client.query("select discord_user_id from portal_discord_links where character_id=$1 and discord_user_id=$2 for update;", [characterId, existingDiscordUserId]);
    if (!existingResult.rows[0]) throw new Error("The existing character link changed after this alert was posted. Refresh the officer page before trying again.");

    const previousRequestedLink = await client.query("select character_id::int from portal_discord_links where discord_user_id=$1 for update;", [requestedDiscordUserId]);
    await client.query("delete from portal_discord_links where character_id=$1 and discord_user_id=$2;", [characterId, existingDiscordUserId]);
    await client.query("insert into portal_discord_links (discord_user_id,discord_username,discord_global_name,discord_nickname,discord_display_name,character_id,match_source,matched_at,last_seen_at,updated_at) values ($1,$2,$3,$4,$5,$6,'admin_conflict_button',now(),now(),now()) on conflict (discord_user_id) do update set discord_username=excluded.discord_username,discord_global_name=excluded.discord_global_name,discord_nickname=excluded.discord_nickname,discord_display_name=excluded.discord_display_name,character_id=excluded.character_id,match_source=excluded.match_source,matched_at=now(),last_seen_at=now(),updated_at=now();", [
      names.discordUserId,
      names.username,
      names.globalName,
      names.nickname,
      names.displayName,
      characterId
    ]);
    await client.query("update portal_discord_member_snapshots set linked_character_id=null,linked_character_name=null,linked_world=null,linked_fc_status=null,linked_active=null,review_status=case when present_in_guild=true and has_verified_role=true then 'needs_review' else 'ok' end,review_reason=case when present_in_guild=true and has_verified_role=true then 'Verified Discord user has no linked FC character.' else null end,updated_at=now() where discord_user_id=$1;", [existingDiscordUserId]);
    await client.query("update portal_discord_member_snapshots set linked_character_id=$2,linked_character_name=$3,linked_world=$4,linked_fc_status='current',linked_active=true,review_status='ok',review_reason=null,updated_at=now() where discord_user_id=$1;", [requestedDiscordUserId, characterId, target.character_name, target.world]);
    await client.query("insert into portal_discord_audit_log (discord_user_id,discord_username,discord_global_name,discord_nickname,discord_display_name,submitted_character_name,character_id,attempt_type,result,reason,details,created_at) values ($1,$2,$3,$4,$5,$6,$7,'admin_conflict_button','matched',$8,$9::jsonb,now());", [
      requestedDiscordUserId,
      names.username,
      names.globalName,
      names.nickname,
      names.displayName,
      target.character_name,
      characterId,
      "Administrator replaced a conflicting Discord character link from the officer log.",
      JSON.stringify({ existingDiscordUserId, previousRequestedCharacterId: previousRequestedLink.rows[0]?.character_id || null, transferVerifiedRole: resolution === "transfer", resolvedByDiscordUserId: interaction.user.id })
    ]);
    await client.query("commit");
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) await client.query("rollback").catch(() => undefined);
    await interaction.editReply(error instanceof Error ? error.message : "The conflict could not be resolved.");
    return;
  } finally {
    client.release();
  }

  const roleActions = [];
  if (resolution === "transfer") {
    const settings = await getBotSettings();
    const existingMember = await fetchGuildMemberSafe(guild, existingDiscordUserId);
    const existingIsProtectedAdmin = await isProtectedPortalAdministrator(existingDiscordUserId);
    if (existingMember && settings.verified_role_id && existingMember.roles.cache.has(settings.verified_role_id) && !existingIsProtectedAdmin) {
      await existingMember.roles.remove(settings.verified_role_id, "Discord character-link conflict resolved by portal administrator");
      roleActions.push("removed Verified from the old Discord account");
    } else if (existingIsProtectedAdmin) {
      roleActions.push("kept the old account's role because portal administrators are protected");
    }
    const appliedActions = await applyVerifiedDiscordState(requestedMember, target);
    roleActions.push(...appliedActions);
  }

  await interaction.message.edit({ components: [] }).catch(() => undefined);
  const roleSummary = resolution === "transfer"
    ? " Role result: " + (roleActions.join(", ") || "no role changes were needed") + "."
    : " Discord roles were not changed.";
  await interaction.editReply(target.character_name + " is now linked to " + requestedMember.displayName + "." + roleSummary);
}

// -------------------------
// SUBSECTION 09B: Apply verified Discord state
// Handles nickname changes and role changes based on portal settings.
// -------------------------

let guestAccessProcessorRunning = false;

async function deleteGuestAccessPrompt(row) {
  if (!row?.prompt_channel_id || !row?.prompt_message_id) return;
  const channel = await bot.channels.fetch(row.prompt_channel_id).catch(() => null);
  if (!channel?.isTextBased()) return;
  const message = await channel.messages.fetch(row.prompt_message_id).catch(() => null);
  if (message) await message.delete().catch(() => null);
}

async function registerPendingGuestAccess(member, promptMessage, settings) {
  const selectionMinutes = Math.max(1, Number(settings.onboarding_selection_minutes || 30));
  await pool.query(
    `insert into portal_discord_guest_access (
       guild_id, discord_user_id, status, joined_at, selection_expires_at,
       prompt_channel_id, prompt_message_id, updated_at
     ) values ($1,$2,'pending',now(),now()+($3*interval '1 minute'),$4,$5,now())
     on conflict (guild_id,discord_user_id) do update set
       status='pending', joined_at=now(), selection_expires_at=now()+($3*interval '1 minute'),
       selected_at=null, expires_at=null, prompt_channel_id=excluded.prompt_channel_id,
       prompt_message_id=excluded.prompt_message_id, processed_at=null, last_error=null, updated_at=now();`,
    [member.guild.id, member.id, selectionMinutes, promptMessage.channelId, promptMessage.id]
  );
  await writeAuditLog({
    member,
    attemptType: "discord_onboarding_prompt",
    result: "success",
    reason: `Access choice sent; selection is required within ${selectionMinutes} minutes.`
  });
}

async function completeGuestAccessAfterVerification(member) {
  const result = await pool.query(
    `update portal_discord_guest_access
     set status='verified',processed_at=now(),last_error=null,updated_at=now()
     where guild_id=$1 and discord_user_id=$2 and status in ('pending','guest','verified')
     returning *;`,
    [member.guild.id, member.id]
  );
  if (result.rows[0]) await deleteGuestAccessPrompt(result.rows[0]);
}

async function memberHasCurrentCharacterLink(discordUserId) {
  const result = await pool.query(
    `select 1 from portal_discord_links dl
     join portal_characters c on c.id=dl.character_id
     where dl.discord_user_id=$1 and c.active=true and c.fc_membership_status='current' limit 1;`,
    [discordUserId]
  );
  return Boolean(result.rows[0]);
}

async function handleTemporaryGuestSelection(interaction, targetUserId) {
  if (!targetUserId || interaction.user.id !== targetUserId) {
    await interaction.reply({ content: "This access choice belongs to the member who just joined.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  if (!await isFcOwnershipVerified()) {
    await interaction.editReply("FC ownership verification is still pending. Temporary access choices will resume after an officer verifies the FC.");
    return;
  }
  const settings = await getBotSettings();
  const member = interaction.guild ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null) : null;
  if (!member) {
    await interaction.editReply("Your server membership could not be loaded. Please rejoin or contact an officer.");
    return;
  }
  if (await memberHasCurrentCharacterLink(member.id)) {
    await interaction.editReply("You already have a current FC character link. Please choose **I'm an FC Member** instead.");
    return;
  }
  if (!settings.temporary_guest_enabled) {
    await writeAuditLog({ member, attemptType: "discord_onboarding_guest", result: "failed", reason: "Temporary guest access is disabled." });
    await interaction.editReply("Temporary guest access is currently disabled. Please verify as an FC member or contact an officer.");
    return;
  }
  if (!settings.temp_access_role_id) {
    await writeAuditLog({ member, attemptType: "discord_onboarding_guest", result: "failed", reason: "The Temp Access role is not configured." });
    await interaction.editReply("Temporary guest access is not configured yet. Please contact an officer.");
    return;
  }

  try {
    await member.roles.add(settings.temp_access_role_id, "COTF temporary guest access");
    if (settings.unverified_role_id && member.roles.cache.has(settings.unverified_role_id)) {
      await member.roles.remove(settings.unverified_role_id, "COTF temporary guest access");
    }
  } catch (error) {
    await writeAuditLog({ member, attemptType: "discord_onboarding_guest", result: "failed", reason: error.message });
    await interaction.editReply("I could not assign temporary access. An officer can check the bot log.");
    return;
  }

  const guestHours = Math.max(1, Number(settings.temp_guest_hours || 6));
  const updated = await pool.query(
    `update portal_discord_guest_access set
       status='guest', selected_at=now(), expires_at=now()+($3*interval '1 hour'),
       processed_at=null,last_error=null,updated_at=now()
     where guild_id=$1 and discord_user_id=$2 returning *;`,
    [member.guild.id, member.id, guestHours]
  );
  const row = updated.rows[0];
  if (row) await deleteGuestAccessPrompt(row);
  else if (interaction.message) await interaction.message.delete().catch(() => null);

  const expiresUnix = Math.floor(new Date(row?.expires_at || Date.now() + guestHours * 3600000).getTime() / 1000);
  await writeAuditLog({
    member,
    attemptType: "discord_onboarding_guest",
    result: "success",
    reason: `Temporary guest access granted for ${guestHours} hours.`,
    details: { expiresAt: new Date(expiresUnix * 1000).toISOString() }
  });
  await interaction.editReply(
    `Temporary guest access is active until <t:${expiresUnix}:F> (<t:${expiresUnix}:R>). This timer is visible only to you. You will be removed automatically when it expires.`
  );
}

async function processGuestAccessExpirations() {
  if (guestAccessProcessorRunning) return;
  if (!await isFcOwnershipVerified()) return;
  guestAccessProcessorRunning = true;
  try {
    const due = await pool.query(
      `select * from portal_discord_guest_access
       where (status='pending' and selection_expires_at<=now())
          or (status='guest' and expires_at<=now())
       order by coalesce(expires_at,selection_expires_at) limit 25;`
    );
    for (const row of due.rows) {
      try {
        const guild = await bot.guilds.fetch(row.guild_id).catch(() => null);
        const member = guild ? await guild.members.fetch(row.discord_user_id).catch(() => null) : null;
        if (!member) {
          await deleteGuestAccessPrompt(row);
          await pool.query(`update portal_discord_guest_access set status='left',processed_at=now(),last_error=null,updated_at=now() where id=$1;`,[row.id]);
          continue;
        }
        const settings = await getBotSettings();
        if (await rosterOverrides?.protectedAccess(row.guild_id, row.discord_user_id, member.joinedTimestamp)) continue;
        if (await memberHasCurrentCharacterLink(member.id)) {
          if (settings.temp_access_role_id && member.roles.cache.has(settings.temp_access_role_id)) {
            await member.roles.remove(settings.temp_access_role_id, "COTF member verification completed").catch(() => null);
          }
          await deleteGuestAccessPrompt(row);
          await pool.query(`update portal_discord_guest_access set status='verified',processed_at=now(),last_error=null,updated_at=now() where id=$1;`,[row.id]);
          continue;
        }

        const finalStatus = row.status === "pending" ? "kicked_no_selection" : "kicked_guest_expired";
        const reason = row.status === "pending"
          ? settings.temporary_guest_enabled
            ? "No FC member or temporary guest selection was made before the onboarding deadline."
            : "FC member verification was not completed before the onboarding deadline."
          : "Temporary guest access expired.";
        await member.kick(reason);
        await deleteGuestAccessPrompt(row);
        await pool.query(`update portal_discord_guest_access set status=$2,processed_at=now(),last_error=null,updated_at=now() where id=$1;`,[row.id,finalStatus]);
        await writeAuditLog({
          member,
          attemptType: row.status === "pending" ? "discord_onboarding_no_selection" : "discord_onboarding_guest_expired",
          result: "success",
          reason
        });
      } catch (error) {
        await pool.query(`update portal_discord_guest_access set last_error=$2,updated_at=now() where id=$1;`,[row.id,error.message]).catch(() => null);
        console.error("[cotf-bot] Guest access expiration failed:", error.message);
      }
    }
  } finally {
    guestAccessProcessorRunning = false;
  }
}

function startGuestAccessProcessor() {
  setInterval(processGuestAccessExpirations, 60000);
  setTimeout(processGuestAccessExpirations, 10000);
}

async function applyVerifiedDiscordState(member, character) {
  if (!await isFcOwnershipVerified()) throw new Error("Free Company ownership verification is pending.");
  const settings = await getBotSettings();
  const actions = [];

  if (
    settings.auto_rename_enabled &&
    member.manageable &&
    member.displayName !== character.character_name
  ) {
    try {
      await member.setNickname(character.character_name, "COTF character verification");
      actions.push("nickname_updated");
    } catch (error) {
      actions.push("nickname_update_failed");
      console.error(`[cotf-bot] Nickname update failed for ${member.id}:`, error.message);
    }
  } else if (
    settings.auto_rename_enabled &&
    !member.manageable &&
    member.displayName !== character.character_name
  ) {
    actions.push("nickname_skipped_not_manageable");
  } else if (!settings.auto_rename_enabled) {
    actions.push("nickname_skipped_disabled");
  }

  if (
    settings.auto_role_enabled &&
    settings.verified_role_id &&
    !member.roles.cache.has(settings.verified_role_id)
  ) {
    try {
      await member.roles.add(settings.verified_role_id, "COTF character verification");
      actions.push("verified_role_added");
    } catch (error) {
      actions.push("verified_role_failed");
      console.error(`[cotf-bot] Verified role add failed for ${member.id}:`, error.message);
    }
  } else if (!settings.auto_role_enabled) {
    actions.push("verified_role_skipped_disabled");
  }

  if (
    settings.auto_role_enabled &&
    settings.unverified_role_id &&
    member.roles.cache.has(settings.unverified_role_id)
  ) {
    try {
      await member.roles.remove(settings.unverified_role_id, "COTF character verification");
      actions.push("unverified_role_removed");
    } catch (error) {
      actions.push("unverified_role_remove_failed");
      console.error(`[cotf-bot] Unverified role remove failed for ${member.id}:`, error.message);
    }
  }

  if (settings.temp_access_role_id && member.roles.cache.has(settings.temp_access_role_id)) {
    try {
      await member.roles.remove(settings.temp_access_role_id, "COTF character verification");
      actions.push("temp_access_role_removed");
    } catch (error) {
      actions.push("temp_access_role_remove_failed");
      console.error(`[cotf-bot] Temp Access role remove failed for ${member.id}:`, error.message);
    }
  }

  await completeGuestAccessAfterVerification(member);
  return actions;
}


// =========================
// SECTION 10: Verification Flows
// =========================

// -------------------------
// SUBSECTION 10A: Verify member by submitted character name
// Used by /iam.
// -------------------------

async function verifyMemberByCharacterName({
  member,
  submittedCharacterName,
  attemptType,
  matchSource
}) {
  if (!await isFcOwnershipVerified()) {
    return { ok: false, verificationPending: true, message: "Free Company ownership verification is still pending. An officer must complete the Lodestone profile check before member verification can continue." };
  }
  if (await isDiscordPrivacySuppressed(member.id)) {
    return { ok: false, privacySuppressed: true, message: "Your portal data is opted out. Use the Opt In and Re-verify button before submitting verification again." };
  }
  const character = await findCurrentFcCharacterByName(submittedCharacterName);

  if (!character) {
    if (attemptType !== "roster_override_recheck") await rosterOverrides?.offer(member, submittedCharacterName);
    await writeAuditLog({
      member,
      submittedCharacterName,
      attemptType,
      result: "pending",
      reason: "No exact current FC character match found."
    });

    return {
      ok: false,
      message:
        "I could not match that name to a current FC character. Make sure your Discord/server name matches your in-game character name."
    };
  }

  const linkResult = await linkDiscordMemberToCharacter({
    member,
    character,
    matchSource
  });

  if (linkResult.privacySuppressed) return { ok: false, privacySuppressed: true, message: "Your portal data is opted out. Explicitly opt back in before verifying again." };

  if (linkResult.corrected) {
    return { ok: false, message: "A newer character link already exists. The delayed verification did not change it." };
  }
  if (!linkResult.ok) {
    await writeAuditLog({
      member,
      submittedCharacterName,
      character,
      attemptType,
      result: "denied",
      reason: "Character is already linked to a different Discord account."
    });
    const primaryAdminId = await notifyCharacterLinkConflict({
      member,
      character,
      conflict: linkResult.conflict,
      attemptType
    });
    const adminGuidance = primaryAdminId
      ? `Please contact <@${primaryAdminId}> for help correcting the character link.`
      : "Please contact a portal administrator for help correcting the character link.";

    return {
      ok: false,
      conflict: true,
      primaryAdminId,
      message:
        `That character is already verified to another Discord account. ${adminGuidance}`
    };
  }

  const actions = await applyVerifiedDiscordState(member, character);
  const welcomeReadiness = await getVerifiedWelcomeReadiness(member, character);

  await writeAuditLog({
    member,
    submittedCharacterName,
    character,
    attemptType,
    result: "matched",
    reason: "Matched to current FC roster.",
    details: {
      actions
    }
  });

  if (welcomeReadiness.ready) {
    await postVerifiedCharacterGreeting(member, character);
  }

  return {
    ok: true,
    character,
    welcomeReady: welcomeReadiness.ready,
    message: welcomeReadiness.ready
      ? `Verified as ${character.character_name}.`
      : `Verified as ${character.character_name}, but the Discord nickname or verified role could not be completed. An officer should check the bot's permissions.`
  };
}

// -------------------------
// SUBSECTION 10B: Auto-match member by Discord nickname/display name
// Used on member join and optional startup scan.
// -------------------------

async function autoMatchMemberByDisplayName(member, attemptType = "auto_match") {
  if (!await isFcOwnershipVerified()) return false;
  if (await isDiscordPrivacySuppressed(member.id)) return false;
  if (await getDiscordPrivacyMode(member.id) === "verification_only") return false;
  const names = getDiscordNameParts(member);
  let ownershipConflict = null;

  // A current FC membership link is the durable access anchor. The member may
  // intentionally use the name of one of their verified additional characters
  // in Discord, so do not reinterpret that nickname as a missing FC member.
  const existingAnchor = (await pool.query(
    `select c.id::int,c.display_name,c.character_name,c.world,c.role,
       c.fc_membership_status,c.lodestone_character_id,c.portrait_url,c.avatar_url
     from portal_discord_links dl
     join portal_characters c on c.id=dl.character_id
     where dl.discord_user_id=$1 and c.active=true
       and c.fc_membership_status='current'
     limit 1`,
    [member.id]
  )).rows[0];
  if (existingAnchor) {
    const displayedCharacter =
      await getActiveCharacterForDiscordUser(member.id, names.displayName) ||
      existingAnchor;
    const actions = await applyVerifiedDiscordState(member, displayedCharacter);
    await pool.query(
      `update portal_discord_links set
         discord_username=$2,discord_global_name=$3,discord_nickname=$4,
         discord_display_name=$5,last_seen_at=now(),updated_at=now()
       where discord_user_id=$1`,
      [member.id,names.username,names.globalName,names.nickname,names.displayName]
    );
    await pool.query(
      `update portal_discord_roster_overrides set
         status='superseded',normalized_name=character_name || ':closed:' || id,
         updated_at=now()
       where guild_id=$1 and discord_user_id=$2
         and status in('pending','approved','review')`,
      [member.guild.id,member.id]
    );
    await writeAuditLog({
      member,
      submittedCharacterName: names.displayName,
      character: existingAnchor,
      attemptType,
      result: "matched",
      reason: "Existing current FC membership anchor retained; Discord nickname may identify a verified additional character.",
      details: {
        actions,
        displayedCharacterId: displayedCharacter.id,
        displayedCharacterName: displayedCharacter.character_name
      }
    });
    return displayedCharacter;
  }

  const possibleNames = [
    names.nickname,
    names.displayName,
    names.globalName,
    names.username
  ].filter(Boolean);

  for (const possibleName of possibleNames) {
    const character = await findCurrentFcCharacterByName(possibleName);

    if (character) {
      const linkResult = await linkDiscordMemberToCharacter({
        member,
        character,
        matchSource: attemptType
      });

      if (!linkResult.ok) {
        ownershipConflict = { character, conflict: linkResult.conflict };
        continue;
      }

      const actions = await applyVerifiedDiscordState(member, character);

      await writeAuditLog({
        member,
        submittedCharacterName: possibleName,
        character,
        attemptType,
        result: "matched",
        reason: "Auto-matched Discord display/nickname to current FC roster.",
        details: {
          actions
        }
      });

      return character;
    }
  }

  await writeAuditLog({
    member,
    submittedCharacterName: names.displayName,
    character: ownershipConflict?.character || null,
    attemptType,
    result: ownershipConflict ? "denied" : "pending",
    reason: ownershipConflict
      ? "Matching character is already linked to a different Discord account."
      : "No current FC character matched Discord nickname/display name."
  });

  if (ownershipConflict) {
    await notifyCharacterLinkConflict({
      member,
      character: ownershipConflict.character,
      conflict: ownershipConflict.conflict,
      attemptType
    });
  } else {
    await rosterOverrides?.offer(member, names.displayName);
  }

  return false;
}


// =========================
// SECTION 11: Slash Commands
// =========================

// -------------------------
// SUBSECTION 11A: Register guild slash commands
// -------------------------

async function registerGuildCommands() {
  const settings = await getBotSettings();
  const guildId = settings.guild_id || DISCORD_GUILD_ID;

  const commands = [
    buildFaeCommand().toJSON(),
    new ContextMenuCommandBuilder().setName("Identify Treasure Map").setType(ApplicationCommandType.Message).toJSON(),
    new SlashCommandBuilder()
      .setName("iam")
      .setDescription(`Verify yourself as a current ${GUILD_NAME} FC character.`.slice(0,100))
      .addStringOption((option) =>
        option
          .setName("character")
          .setDescription("Your exact FFXIV character name")
          .setRequired(true)
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName("postverify")
      .setDescription(`Post the ${GUILD_NAME} verification button in this channel.`.slice(0,100))
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(DISCORD_BOT_TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(DISCORD_APPLICATION_ID, guildId),
    {
      body: commands
    }
  );

  console.log(`[cotf-bot] Guild slash commands registered for guild ${guildId}.`);
}


// =========================
// SECTION 12: Startup Member Sync
// =========================

// -------------------------
// SUBSECTION 12A: Scan existing guild members
// Only runs when startup_member_sync_enabled is true.
// -------------------------

async function syncExistingGuildMembers() {
  if (!await isFcOwnershipVerified()) {
    console.log("[cotf-bot] Startup member sync paused until Free Company ownership is verified.");
    return;
  }
  const settings = await getBotSettings();
  const guildId = settings.guild_id || DISCORD_GUILD_ID;

  const guild = await bot.guilds.fetch(guildId);
  const members = await fetchAllGuildMembers(guild);

  let checked = 0;
  let matched = 0;

  for (const [, member] of members) {
    if (member.user.bot) {
      continue;
    }

    checked += 1;

    const result = await autoMatchMemberByDisplayName(member, "startup_auto_match");

    if (result) {
      matched += 1;
    }
  }

  console.log(`[cotf-bot] Startup member check complete. Checked ${checked}, matched ${matched}.`);
}

// ==================================================
// SECTION: Discord Action Queue
// ==================================================

async function executeKickMember(action, settings, guild, link) {
  const member = await fetchGuildMemberSafe(guild, action.discord_user_id);

  if (!member) {
    return "Skipped: Discord member was not found in this server.";
  }

  if (bot.user && member.id === bot.user.id) {
    return "Skipped: bot cannot kick itself.";
  }

  if (!member.kickable) {
    return "Skipped: bot cannot kick this member. Check bot role position and Kick Members permission.";
  }

  const payload = action.action_payload || {};
  const note = payload.note || "No note provided.";
  const displayName = getDisplayNameForAction(link, action.discord_user_id);

  const reason = `COTF roster review confirmed. Requested by ${
    action.requested_by || "Unknown officer"
  }. Note: ${note}`.slice(0, 512);

  await member.kick(reason);

  return `Kicked ${displayName} from Discord.`;
}

async function ensureDiscordActionQueueTable() {
  await pool.query(`
    create table if not exists portal_discord_action_queue (
      id bigserial primary key,
      discord_user_id text not null,
      action_type text not null,
      action_payload jsonb not null default '{}'::jsonb,
      status text not null default 'pending',
      requested_by text,
      requested_at timestamptz not null default now(),
      picked_at timestamptz,
      completed_at timestamptz,
      result_message text,
      error_message text,
      archived_at timestamptz,
      archived_by text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    alter table portal_discord_action_queue
      add column if not exists archived_at timestamptz,
      add column if not exists archived_by text;
  `);

  await pool.query(`
    create unique index if not exists portal_discord_action_queue_pending_once
    on portal_discord_action_queue (discord_user_id, action_type)
    where status = 'pending';
  `);
}

async function ensureDiscordScheduledPostsTable() {
  await pool.query(`
    create table if not exists portal_discord_scheduled_posts (
      id bigserial primary key,
      post_type text not null default 'custom',
      title text not null default '',
      message text not null default '',
      embed_image_url text,
      thumbnail_image_url text,
      target_channel_kind text not null default 'custom',
      target_channel_id text not null default '',
      scheduled_for timestamptz not null,
      status text not null default 'scheduled',
      created_by text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      sent_at timestamptz,
      sent_message_id text,
      error_message text,
      cancelled_at timestamptz,
      cancelled_by text,
      event_id bigint,
      reminder_offset_minutes integer
    );
  `);

  await pool.query(`
    alter table portal_discord_scheduled_posts
      add column if not exists post_type text not null default 'custom',
      add column if not exists title text not null default '',
      add column if not exists message text not null default '',
      add column if not exists embed_image_url text,
      add column if not exists thumbnail_image_url text,
      add column if not exists target_channel_kind text not null default 'custom',
      add column if not exists target_channel_id text not null default '',
      add column if not exists scheduled_for timestamptz not null default now(),
      add column if not exists status text not null default 'scheduled',
      add column if not exists created_by text,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now(),
      add column if not exists sent_at timestamptz,
      add column if not exists sent_message_id text,
      add column if not exists error_message text,
      add column if not exists cancelled_at timestamptz,
      add column if not exists cancelled_by text,
      add column if not exists event_id bigint,
      add column if not exists reminder_offset_minutes integer;
  `);

  await pool.query(`
    create index if not exists portal_discord_scheduled_posts_due_idx
    on portal_discord_scheduled_posts (status, scheduled_for);
  `);

  await pool.query(`
    create index if not exists portal_discord_scheduled_posts_event_idx
    on portal_discord_scheduled_posts (event_id, status, scheduled_for);
  `);
}

async function resetStaleDiscordActions() {
  await pool.query(`
    update portal_discord_action_queue
    set
      status = 'pending',
      picked_at = null,
      updated_at = now(),
      error_message = 'Reset after bot restart or stale processing timeout.'
    where status = 'processing'
      and picked_at < now() - interval '15 minutes';
  `);

}

async function resetStalePrivacyActions() {
  await pool.query(`
    update portal_discord_action_queue
    set status='pending',picked_at=null,updated_at=now(),
        error_message='Reset after bot restart or stale processing timeout.'
    where status='processing' and action_type='privacy_full_opt_out'
      and picked_at < now() - interval '15 minutes';
  `);
}

async function maintainDiscordActionHistory() {
  const result = await pool.query(`
    update portal_discord_action_queue
    set
      status = 'archived',
      archived_at = coalesce(archived_at, now()),
      archived_by = coalesce(archived_by, 'Automatic 3-day cleanup'),
      updated_at = now()
    where status in ('completed', 'cancelled')
      and coalesce(completed_at, updated_at) <= now() - interval '3 days'
    returning id;
  `);

  if (result.rows.length > 0) {
    console.log(`[cotf-bot] Archived ${result.rows.length} completed/cancelled Discord action(s) after the 3-day retention period.`);
  }
}

async function pickNextDiscordAction(privacyOnly = false) {
  const result = await pool.query(`
    with picked as (
      select id
      from portal_discord_action_queue
      where status = 'pending'
        and (not $1::boolean or action_type='privacy_full_opt_out')
      order by requested_at asc
      limit 1
      for update skip locked
    )
    update portal_discord_action_queue q
    set
      status = 'processing',
      picked_at = now(),
      updated_at = now(),
      error_message = null
    from picked
    where q.id = picked.id
    returning q.*;
  `, [privacyOnly]);

  return result.rows[0] || null;
}

async function completeDiscordAction(actionId, resultMessage) {
  await pool.query(
    `
      update portal_discord_action_queue
      set
        status = 'completed',
        completed_at = now(),
        result_message = $2,
        error_message = null,
        updated_at = now()
      where id = $1;
    `,
    [actionId, resultMessage]
  );
}

async function failDiscordAction(actionId, errorMessage) {
  await pool.query(
    `
      update portal_discord_action_queue
      set
        status = 'failed',
        completed_at = now(),
        error_message = $2,
        updated_at = now()
      where id = $1;
    `,
    [actionId, errorMessage]
  );
}

async function getDiscordLinkForAction(discordUserId) {
  const result = await pool.query(
    `
      select
        dl.discord_user_id,
        dl.discord_username,
        dl.discord_global_name,
        dl.discord_nickname,
        dl.discord_display_name,
        dl.character_id,
        c.character_name,
        c.world,
        c.role,
        c.fc_membership_status,
        c.active
      from portal_discord_links dl
      left join portal_characters c
        on c.id = dl.character_id
      where dl.discord_user_id = $1
      limit 1;
    `,
    [discordUserId]
  );

  return result.rows[0] || null;
}

async function fetchGuildMemberSafe(guild, discordUserId) {
  try {
    return await guild.members.fetch(discordUserId);
  } catch {
    return null;
  }
}

const FULL_GUILD_MEMBER_CACHE_MS = 60_000;
const fullGuildMemberFetchStates = new Map();

function getDiscordGatewayRetryAfterMs(error) {
  const message = String(error?.message || error || "");
  const match = message.match(/retry after\s+([0-9]+(?:\.[0-9]+)?)\s+seconds?/i);
  if (!match) return null;
  const milliseconds = Math.ceil(Number(match[1]) * 1000);
  return Number.isFinite(milliseconds) && milliseconds >= 0 ? milliseconds : null;
}

async function fetchAllGuildMembers(guild) {
  const guildId = String(guild?.id || "");
  const existing = fullGuildMemberFetchStates.get(guildId);
  if (existing?.promise) return existing.promise;
  if (existing?.members && Date.now() - existing.fetchedAt < FULL_GUILD_MEMBER_CACHE_MS) {
    return existing.members;
  }

  const state = existing || { promise: null, members: null, fetchedAt: 0 };
  const request = (async () => {
    try {
      let members;
      try {
        members = await guild.members.fetch();
      } catch (error) {
        const retryAfterMs = getDiscordGatewayRetryAfterMs(error);
        if (retryAfterMs === null || retryAfterMs > 60_000) throw error;
        console.warn(`[cotf-bot] Discord member request was rate limited; retrying in ${Math.ceil(retryAfterMs / 1000)} second(s).`);
        await new Promise((resolve) => setTimeout(resolve, retryAfterMs + 250));
        members = await guild.members.fetch();
      }
      state.members = members;
      state.fetchedAt = Date.now();
      return members;
    } finally {
      state.promise = null;
    }
  })();

  state.promise = request;
  fullGuildMemberFetchStates.set(guildId, state);
  return request;
}

function getDisplayNameForAction(link, discordUserId) {
  if (discordUserId === "__guild_roster_scan__") {
    return "Guild Roster Scan";
  }

  if (discordUserId === "__guild_name_match__") {
    return "Guild Discord Name Match";
  }

  return (
    link?.discord_display_name ||
    link?.discord_nickname ||
    link?.discord_global_name ||
    link?.discord_username ||
    discordUserId
  );
}

async function executeRemoveVerifiedRole(action, settings, guild, link) {
  if (!settings.verified_role_id) {
    return "Skipped: no verified role ID is configured.";
  }

  const member = await fetchGuildMemberSafe(guild, action.discord_user_id);

  if (!member) {
    return "Skipped: Discord member was not found in this server.";
  }

  if (!member.roles.cache.has(settings.verified_role_id)) {
    return "Skipped: member does not currently have the verified role.";
  }

  await member.roles.remove(settings.verified_role_id, "COTF roster review action queue");

  return `Removed verified role from ${getDisplayNameForAction(link, action.discord_user_id)}.`;
}

async function executeAddUnverifiedRole(action, settings, guild, link) {
  if (!settings.unverified_role_id) {
    return "Skipped: no unverified role ID is configured.";
  }

  const member = await fetchGuildMemberSafe(guild, action.discord_user_id);

  if (!member) {
    return "Skipped: Discord member was not found in this server.";
  }

  if (member.roles.cache.has(settings.unverified_role_id)) {
    return "Skipped: member already has the unverified role.";
  }

  await member.roles.add(settings.unverified_role_id, "COTF roster review action queue");

  return `Added unverified role to ${getDisplayNameForAction(link, action.discord_user_id)}.`;
}

async function executePrivacyFullOptOut(action, settings, guild) {
  const member = await fetchGuildMemberSafe(guild, action.discord_user_id);
  if (member) {
    for (const roleId of [settings.verified_role_id, settings.unverified_role_id, settings.temp_access_role_id].filter(Boolean)) {
      if (member.roles.cache.has(roleId)) await member.roles.remove(roleId, "Member portal privacy opt-out").catch((error) => console.warn(`[cotf-bot] Privacy role cleanup failed for ${member.id}:`, error.message));
    }
    if (member.manageable && member.nickname) await member.setNickname(null, "Member portal privacy opt-out").catch((error) => console.warn(`[cotf-bot] Privacy nickname cleanup failed for ${member.id}:`, error.message));
  }
  await pool.query("delete from portal_discord_member_snapshots where discord_user_id=$1", [action.discord_user_id]).catch(() => undefined);
  await pool.query("delete from portal_discord_guest_access where discord_user_id=$1", [action.discord_user_id]).catch(() => undefined);
  return member ? "Removed portal-managed Discord roles and nickname for privacy opt-out." : "Privacy opt-out recorded; member is not currently in the Discord server.";
}

async function executeApplyVerifiedState(action, settings, guild, link) {
  if (!link?.character_id || !link?.active || link.fc_membership_status !== "current") {
    return "Skipped: the Discord account does not have a valid active, current FC character link.";
  }

  const member = await fetchGuildMemberSafe(guild, action.discord_user_id);
  if (!member) {
    return "Skipped: Discord member was not found in this server.";
  }

  const actions = await applyVerifiedDiscordState(member, link);
  return `Applied the configured verified state to ${getDisplayNameForAction(link, action.discord_user_id)}. Actions: ${actions.join(", ") || "no changes needed"}.`;
}

async function executeOfficerAlert(action, settings, guild, link) {
  const channelId = settings.officer_log_channel_id;

  if (!channelId) {
    return "Skipped: no officer log channel is configured.";
  }

  const channel = await guild.channels.fetch(channelId).catch(() => null);

  if (!channel || !channel.isTextBased()) {
    return "Skipped: configured officer alert channel could not be found or is not text-based.";
  }

  const payload = action.action_payload || {};
  const note = payload.note || "No note provided.";
  const displayName = getDisplayNameForAction(link, action.discord_user_id);

  const embed = new EmbedBuilder()
    .setTitle("Discord Roster Review Action")
    .setDescription("An officer queued a roster review alert.")
    .addFields(
      {
        name: "Discord User",
        value: `${displayName}\n${action.discord_user_id}`,
        inline: false
      },
      {
        name: "Linked Character",
        value: link?.character_name
          ? `${link.character_name}${link.world ? ` \u00b7 ${link.world}` : ""}`
          : "No linked character",
        inline: false
      },
      {
        name: "Requested By",
        value: action.requested_by || "Unknown officer",
        inline: true
      },
      {
        name: "Note",
        value: note,
        inline: false
      }
    )
    .setTimestamp(new Date());

  await sendOfficerLog({ embeds: [embed] }, `action:${action.id}:officer-alert`);

  return `Sent officer alert for ${displayName}.`;
}

async function sendDiscordActionResultNotification(action, settings, guild, link, status, message) {
  if (action.action_type === "send_officer_alert" || action.action_type === "refresh_event_roster" || action.action_type === "refresh_crafting_project" || action.action_type === "send_test_mount_win" || action.action_type === "delete_event_post") {
    return;
  }

  const channelId = settings.officer_log_channel_id;

  if (!channelId) {
    return;
  }

  const channel = await guild.channels.fetch(channelId).catch(() => null);

  if (!channel || !channel.isTextBased()) {
    return;
  }

  const payload = action.action_payload || {};
  const note = payload.note || "No note provided.";
  const confirmedBy = payload.confirmedBy || null;
  const displayName = getDisplayNameForAction(link, action.discord_user_id);

  const statusLabel =
    status === "completed"
      ? "Completed"
      : status === "failed"
        ? "Failed"
        : "Updated";

  const embed = new EmbedBuilder()
    .setTitle(`Discord Action ${statusLabel}`)
    .setDescription("A queued roster-review action was processed by the bot.")
    .addFields(
      {
        name: "Action",
        value: action.action_type,
        inline: true
      },
      {
        name: "Status",
        value: statusLabel,
        inline: true
      },
      {
        name: "Discord User",
        value: `${displayName}\n${action.discord_user_id}`,
        inline: false
      },
      {
        name: "Linked Character",
        value: link?.character_name
          ? `${link.character_name}${link.world ? ` \u00b7 ${link.world}` : ""}`
          : "No linked character",
        inline: false
      },
      {
        name: "Requested By",
        value: action.requested_by || "Unknown officer",
        inline: true
      },
      {
        name: "Confirmed By",
        value: confirmedBy || "Not required",
        inline: true
      },
      {
        name: "Result",
        value: message || "No result message.",
        inline: false
      },
      {
        name: "Note",
        value: note,
        inline: false
      }
    )
    .setTimestamp(new Date());

  await sendOfficerLog({ embeds: [embed] }, `action:${action.id}:result:${status}`);
}

async function sendDiscordActionResultNotificationSafe(action, settings, guild, link, status, message) {
  try {
    await sendDiscordActionResultNotification(action, settings, guild, link, status, message);
  } catch (error) {
    console.error("[cotf-bot] Failed to send Discord action result notification:", error);
  }
}

async function executeDiscordRosterScan(action, settings, guild, memberSnapshot = null) {
  await ensureDiscordMemberSnapshotTable();

  if (!settings.verified_role_id) {
    return "Skipped: no verified role ID is configured.";
  }

  console.log("[cotf-bot] Starting Discord roster scan.");

  await pool.query(`
    update portal_discord_member_snapshots
    set
      present_in_guild = false,
      updated_at = now();
  `);

  const members = memberSnapshot || await fetchAllGuildMembers(guild);
  let scanned = 0;

  for (const member of members.values()) {
    if (await isDiscordPrivacySuppressed(member.id)) {
      await pool.query("delete from portal_discord_member_snapshots where discord_user_id=$1", [member.id]);
      continue;
    }
    if (await getDiscordPrivacyMode(member.id) === "verification_only") {
      await pool.query("delete from portal_discord_member_snapshots where discord_user_id=$1", [member.id]);
      continue;
    }
    scanned += 1;

    const hasVerifiedRole = member.roles.cache.has(settings.verified_role_id);
    const hasUnverifiedRole = settings.unverified_role_id
      ? member.roles.cache.has(settings.unverified_role_id)
      : false;

    await pool.query(
      `
        insert into portal_discord_member_snapshots (
          discord_user_id,
          discord_username,
          discord_global_name,
          discord_nickname,
          discord_display_name,
          is_bot,
          present_in_guild,
          has_verified_role,
          has_unverified_role,
          last_scanned_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, true, $7, $8, now(), now())
        on conflict (discord_user_id)
        do update set
          discord_username = excluded.discord_username,
          discord_global_name = excluded.discord_global_name,
          discord_nickname = excluded.discord_nickname,
          discord_display_name = excluded.discord_display_name,
          is_bot = excluded.is_bot,
          present_in_guild = true,
          has_verified_role = excluded.has_verified_role,
          has_unverified_role = excluded.has_unverified_role,
          last_scanned_at = now(),
          updated_at = now();
      `,
      [
        member.id,
        member.user.username || null,
        member.user.globalName || null,
        member.nickname || null,
        member.displayName || null,
        Boolean(member.user.bot),
        hasVerifiedRole,
        hasUnverifiedRole
      ]
    );
  }

  await pool.query(`
    update portal_discord_member_snapshots s
    set
      linked_character_id = null,
      linked_character_name = null,
      linked_world = null,
      linked_fc_status = null,
      linked_active = null,
      updated_at = now()
    where not exists (
      select 1
      from portal_discord_links dl
      where dl.discord_user_id = s.discord_user_id
    );
  `);

  await pool.query(`
    update portal_discord_member_snapshots s
    set
      linked_character_id = dl.character_id,
      linked_character_name = c.character_name,
      linked_world = c.world,
      linked_fc_status = c.fc_membership_status,
      linked_active = c.active,
      updated_at = now()
    from portal_discord_links dl
    left join portal_characters c
      on c.id = dl.character_id
    where s.discord_user_id = dl.discord_user_id;
  `);

  await pool.query(`
    update portal_discord_member_snapshots
    set
      review_status = case
        when is_bot = true then 'ok'
        when present_in_guild = false then 'ok'
        when has_verified_role = false then 'ok'
        when linked_character_id is null then 'needs_review'
        when linked_active = false then 'needs_review'
        when linked_fc_status is distinct from 'current' then 'needs_review'
        else 'ok'
      end,
      review_reason = case
        when is_bot = true then null
        when present_in_guild = false then null
        when has_verified_role = false then null
        when linked_character_id is null then 'Verified Discord user has no linked FC character.'
        when linked_active = false then 'Verified Discord user is linked to an inactive portal character.'
        when linked_fc_status is distinct from 'current' then 'Verified Discord user is linked to a character not marked current in the FC.'
        else null
      end,
      updated_at = now();
  `);

  const reviewResult = await pool.query(`
    select count(*)::int as needs_review
    from portal_discord_member_snapshots
    where present_in_guild = true
      and review_status = 'needs_review';
  `);

  const needsReview = Number(reviewResult.rows[0]?.needs_review || 0);

  return `Scanned ${scanned} Discord members. Found ${needsReview} verified users needing roster review.`;
}

async function executeDiscordNameMatch(action, settings, guild) {
  console.log("[cotf-bot] Starting queued Discord name match.");

  const existingLinks = await pool.query(`
    select dl.discord_user_id
    from portal_discord_links dl
    join portal_characters c on c.id = dl.character_id
    where c.active = true
      and c.fc_membership_status = 'current';
  `);
  const alreadyLinkedIds = new Set(
    existingLinks.rows.map((row) => String(row.discord_user_id || "")).filter(Boolean)
  );

  const members = await fetchAllGuildMembers(guild);
  let checked = 0;
  let matched = 0;
  let alreadyLinked = 0;
  let unmatched = 0;
  let failed = 0;

  for (const member of members.values()) {
    if (member.user.bot) continue;

    if (alreadyLinkedIds.has(member.id)) {
      alreadyLinked += 1;
      continue;
    }

    checked += 1;
    try {
      const character = await autoMatchMemberByDisplayName(member, "queued_name_match");
      if (character) matched += 1;
      else unmatched += 1;
    } catch (error) {
      failed += 1;
      console.error(`[cotf-bot] Queued name match failed for Discord member ${member.id}:`, error);
    }
  }

  const rosterRefresh = await executeDiscordRosterScan(action, settings, guild, members);
  const failureSummary = failed > 0 ? ` ${failed} failed and can be retried.` : "";
  return `Name match checked ${checked} unlinked Discord members: matched ${matched}, unmatched ${unmatched}, and skipped ${alreadyLinked} with valid current links.${failureSummary} ${rosterRefresh}`;
}

async function executeDeleteEventPost(action, settings, guild) {
  const posts = Array.isArray(action.action_payload?.posts) ? action.action_payload.posts : [];
  if (posts.length === 0) return "No Discord event messages needed deletion.";

  let deleted = 0;
  let alreadyMissing = 0;
  for (const post of posts) {
    const channelId = String(post.targetChannelId || "").trim() || getScheduledPostChannelId({
      target_channel_kind: String(post.targetChannelKind || "event"),
      target_channel_id: ""
    }, settings);
    const messageId = String(post.sentMessageId || "").trim();
    if (!channelId || !messageId) continue;

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased() || !channel.messages) {
      throw new Error(`Discord channel ${channelId} could not be found for event-post deletion.`);
    }
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      alreadyMissing += 1;
      continue;
    }
    await message.delete();
    deleted += 1;
  }

  return `Deleted ${deleted} Discord event message${deleted === 1 ? "" : "s"}${alreadyMissing ? `; ${alreadyMissing} already absent` : ""}.`;
}
async function executeRefreshEventRoster(action, guild) {
  const eventId = Number(action.action_payload?.eventId || 0);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    throw new Error("Refresh event roster action is missing a valid event ID.");
  }
  return refreshDiscordEventMessage(eventId, guild);
}
function getCraftingProjectChannelId(targetChannelKind, settings) {
  return targetChannelKind === "test" ? settings.test_channel_id : settings.crafting_channel_id;
}

function truncateDiscordText(value, maximum = 1024) {
  const text = String(value || "").trim();
  return text.length > maximum ? `${text.slice(0, Math.max(0, maximum - 3))}...` : text || "-";
}

async function getCraftingProjectDiscordPayload(projectId) {
  const postResult = await pool.query(`
    select cp.id::int as project_id, cp.title, cp.status, cp.notes, cp.current_phase_number,
           d.target_channel_kind, d.guild_id, d.channel_id, d.message_id,
           d.completion_message_id, d.completion_announced_at, d.last_project_status
    from portal_crafting_project_discord_posts d
    join portal_crafting_projects cp on cp.id=d.project_id
    where d.project_id=$1
    limit 1;`, [projectId]);
  const project = postResult.rows[0] || null;
  if (!project) return null;

  const phaseResult = await pool.query(`
    select id::int, phase_number, title, status, progress_result
    from portal_crafting_project_phases
    where project_id=$1 and phase_number=coalesce($2::int, 1)
    limit 1;`, [projectId, project.current_phase_number]);
  const phase = phaseResult.rows[0] || null;
  const materialResult = phase
    ? await pool.query(`
        select pm.id::int as project_material_id, i.id::int as item_id, i.name, i.icon_url, i.can_be_hq,
               pm.actual_quantity, pm.workshop_batch_quantity, pm.base_batch_count, pm.reduced_batch_count,
               coalesce(contributed.quantity, 0)::int as contributed,
               coalesce(claimed.quantity, 0)::int as claimed
        from portal_crafting_project_materials pm
        join portal_crafting_items i on i.id=pm.item_id
        left join lateral (
          select sum(quantity)::int as quantity
          from portal_crafting_contributions
          where project_material_id=pm.id and reversed_at is null
        ) contributed on true
        left join lateral (
          select sum(quantity)::int as quantity
          from portal_crafting_claims
          where project_material_id=pm.id and status='active'
        ) claimed on true
        where pm.project_phase_id=$1
        order by pm.sort_order, lower(i.name);`, [phase.id])
    : { rows: [] };
  const previousPhaseResult = phase && Number(phase.phase_number) > 1
    ? await pool.query(`select id::int, phase_number, progress_result from portal_crafting_project_phases where project_id=$1 and phase_number=$2 limit 1;`, [projectId, Number(phase.phase_number) - 1])
    : { rows: [] };
  const [contributorResult, recentContributionResult, topContributorResult] = await Promise.all([
    pool.query(`
      select count(distinct contributor_character_id)::int as contributor_count,
             coalesce(sum(quantity), 0)::int as contribution_count
      from portal_crafting_contributions
      where project_id=$1 and reversed_at is null;`, [projectId]),
    pool.query(`
      select c.contributor_name_snapshot, i.name as item_name, c.quantity, c.quality
      from portal_crafting_contributions c
      join portal_crafting_items i on i.id=c.item_id
      where c.project_id=$1 and c.reversed_at is null
      order by c.created_at desc
      limit 5;`, [projectId]),
    pool.query(`
      select contributor_name_snapshot, sum(quantity)::int as quantity
      from portal_crafting_contributions
      where project_id=$1 and reversed_at is null
      group by contributor_name_snapshot
      order by quantity desc, contributor_name_snapshot
      limit 5;`, [projectId])
  ]);
  return {
    project,
    phase,
    previousPhase: previousPhaseResult.rows[0] || null,
    materials: materialResult.rows,
    summary: contributorResult.rows[0] || { contributor_count: 0, contribution_count: 0 },
    recentContributions: recentContributionResult.rows,
    topContributors: topContributorResult.rows
  };
}

function craftingProgressBar(current, total, width = 14) {
  const safeTotal = Math.max(1, Number(total || 0));
  const filled = Math.max(0, Math.min(width, Math.round((Math.max(0, Number(current || 0)) / safeTotal) * width)));
  return `${"#".repeat(filled)}${"-".repeat(width - filled)}`;
}

function buildCraftingProjectComponents(payload) {
  if (payload.project.status !== "active" || payload.phase?.status !== "active" || !payload.materials.length) return [];
  const rows = [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cotf_craft_donate:${payload.project.project_id}`).setLabel("Donate Materials").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`cotf_craft_claim:${payload.project.project_id}`).setLabel("Claim Materials").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`cotf_craft_inspect:${payload.project.project_id}`).setLabel("Inspect Material").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`cotf_craft_details:${payload.project.project_id}`).setLabel("Project Details").setStyle(ButtonStyle.Secondary)
  )];
  const followUpButtons = [];
  if (payload.previousPhase) {
    followUpButtons.push(
      new ButtonBuilder().setCustomId(`cotf_craft_phase_result:${payload.project.project_id}:normal`).setLabel("Record Normal").setStyle(payload.previousPhase.progress_result === "normal" ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`cotf_craft_phase_result:${payload.project.project_id}:excellent`).setLabel("Record Excellent").setStyle(payload.previousPhase.progress_result === "excellent" ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`cotf_craft_phase_result:${payload.project.project_id}:outstanding`).setLabel("Record Outstanding").setStyle(payload.previousPhase.progress_result === "outstanding" ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );
  }
  followUpButtons.push(new ButtonBuilder().setCustomId(`cotf_craft_my_claims:${payload.project.project_id}`).setLabel("My Claims").setStyle(ButtonStyle.Secondary));
  rows.push(new ActionRowBuilder().addComponents(...followUpButtons));
  return rows;
}

function buildCraftingProjectEmbed(payload) {
  const phase = payload.phase;
  const materials = payload.materials || [];
  const completeRows = materials.filter((material) => Number(material.contributed || 0) >= Number(material.actual_quantity || 0)).length;
  const totalRequired = materials.reduce((sum, material) => sum + Number(material.actual_quantity || 0), 0);
  const totalDelivered = materials.reduce((sum, material) => sum + Math.min(Number(material.contributed || 0), Number(material.actual_quantity || 0)), 0);
  const percent = totalRequired ? Math.floor((totalDelivered / totalRequired) * 100) : 0;
  const materialLines = materials.length
    ? materials.slice(0, 14).map((material) => {
        const required = Number(material.actual_quantity || 0);
        const contributed = Number(material.contributed || 0);
        const claimed = Number(material.claimed || 0);
        const remaining = Math.max(0, required - contributed);
        return `**${truncateDiscordText(material.name, 80)}** - ${contributed}/${required} delivered | ${remaining} remaining${claimed ? ` | ${claimed} reserved` : ""}`;
      }).join("\n")
    : "No active phase materials are available.";
  const phaseName = phase?.title || "No active phase";
  const description = [payload.project.notes, phase ? `**Current phase:** ${phaseName}` : null].filter(Boolean).join("\n\n") || "FC crafting project";
  const embed = new EmbedBuilder()
    .setTitle(`FC Crafting Project: ${truncateDiscordText(payload.project.title, 180)}`)
    .setDescription(truncateDiscordText(description, 4096))
    .setColor(payload.project.status === "completed" ? 0x22c55e : 0x8b5cf6)
    .addFields(
      { name: "Project status", value: `${String(payload.project.status || "active").toUpperCase()}${phase ? ` | Phase ${phase.phase_number}: ${phase.status}` : ""}`, inline: true },
      { name: "Progress", value: phase ? `${craftingProgressBar(totalDelivered, totalRequired)} ${percent}%\n${completeRows}/${materials.length} top materials complete` : "No active phase", inline: true },
      { name: "Contributors", value: `${Number(payload.summary.contributor_count || 0)} members | ${Number(payload.summary.contribution_count || 0)} items delivered`, inline: true },
      { name: "Current workshop requirements", value: truncateDiscordText(materialLines, 1024), inline: false },
      ...(payload.recentContributions?.length ? [{ name: "Recent contributions", value: truncateDiscordText(payload.recentContributions.map((row) => `${row.contributor_name_snapshot}: ${row.quantity}x ${row.item_name}${row.quality === "hq" ? " (HQ)" : ""}`).join("\n"), 1024), inline: false }] : [])
    )
    .setFooter({ text: "Use the buttons below to donate, reserve materials, or view project details. This post updates automatically." })
    .setTimestamp(new Date());
  return embed;
}

function buildCraftingProjectCompletionEmbed(payload) {
  const contributors = payload.topContributors?.length
    ? payload.topContributors.map((row, index) => `${index + 1}. **${row.contributor_name_snapshot}** \u2014 ${row.quantity} item${Number(row.quantity) === 1 ? "" : "s"}`).join("\n")
    : "No contribution records were found.";
  return new EmbedBuilder()
    .setTitle(`Project Complete: ${truncateDiscordText(payload.project.title, 180)}`)
    .setDescription("All project phases are complete. Thank you to everyone who contributed materials, crafts, and planning time.")
    .setColor(0x22c55e)
    .addFields(
      { name: "Top contributors", value: truncateDiscordText(contributors, 1024), inline: false },
      { name: "Project total", value: `${Number(payload.summary.contributor_count || 0)} contributors | ${Number(payload.summary.contribution_count || 0)} items delivered`, inline: false }
    )
    .setFooter({ text: `${GUILD_NAME} workshop project` })
    .setTimestamp(new Date());
}
async function saveCraftingProjectDiscordState(projectId, values) {
  const assignments = [];
  const params = [projectId];
  for (const [column, value] of Object.entries(values)) {
    params.push(value);
    assignments.push(`${column}=$${params.length}`);
  }
  assignments.push("updated_at=now()");
  await pool.query(`update portal_crafting_project_discord_posts set ${assignments.join(", ")} where project_id=$1;`, params);
}

async function executeRefreshCraftingProject(action, settings, guild) {
  const projectId = Number(action.action_payload?.projectId || 0);
  if (!Number.isFinite(projectId) || projectId <= 0) throw new Error("Crafting refresh action is missing a valid project ID.");
  try {
    const payload = await getCraftingProjectDiscordPayload(projectId);
    if (!payload) return "Skipped: no Discord post has been requested for this crafting project.";
    const configuredChannelId = getCraftingProjectChannelId(payload.project.target_channel_kind, settings);
    const channelId = payload.project.channel_id || configuredChannelId;
    if (!channelId) throw new Error(`No ${payload.project.target_channel_kind === "test" ? "Test Channel" : "Crafting Channel"} ID is configured.`);
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) throw new Error("Configured crafting project channel could not be found or is not text-based.");
    const embed = buildCraftingProjectEmbed(payload);
    let message = null;
    if (payload.project.message_id && channel.messages) message = await channel.messages.fetch(payload.project.message_id).catch(() => null);
    const components = buildCraftingProjectComponents(payload);
    if (message) await message.edit({ embeds: [embed], components });
    else message = await channel.send({ embeds: [embed], components });
    await saveCraftingProjectDiscordState(projectId, {
      guild_id: guild.id,
      channel_id: channelId,
      message_id: message.id,
      last_refreshed_at: new Date(),
      last_error: null
    });
    const previousStatus = payload.project.last_project_status || null;
    if (payload.project.status === "completed" && previousStatus === "active" && !payload.project.completion_message_id) {
      const tribute = await channel.send({ embeds: [buildCraftingProjectCompletionEmbed(payload)] });
      await saveCraftingProjectDiscordState(projectId, {
        completion_message_id: tribute.id,
        completion_announced_at: new Date(),
        last_project_status: "completed"
      });
    } else if (previousStatus !== payload.project.status) {
      await saveCraftingProjectDiscordState(projectId, { last_project_status: payload.project.status });
    }
    return `${payload.project.message_id ? "Updated" : "Posted"} crafting project ${projectId} in the ${payload.project.target_channel_kind === "test" ? "Test Channel" : "Crafting Channel"}.`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await saveCraftingProjectDiscordState(projectId, { last_error: message }).catch(() => null);
    throw error;
  }
}
async function refreshExistingCraftingProjectMessages(settings, guild) {
  const result = await pool.query(`
    select project_id::int as project_id
    from portal_crafting_project_discord_posts
    order by project_id;`);
  for (const row of result.rows) {
    try {
      await executeRefreshCraftingProject({ action_payload: { projectId: Number(row.project_id) } }, settings, guild);
    } catch (error) {
      console.error(`[cotf-bot] Startup crafting post refresh failed for ${row.project_id}:`, error);
    }
  }
}
function buildCraftingMaterialPicker(projectPayload, action) {
  const verb = action === "donate" ? "donate" : action === "claim" ? "claim" : "inspect";
  const options = projectPayload.materials.slice(0, 25).map((material) => {
    const required = Number(material.actual_quantity || 0);
    const contributed = Number(material.contributed || 0);
    const claimed = Number(material.claimed || 0);
    const remaining = Math.max(0, required - contributed);
    return {
      label: truncateDiscordText(material.name, 100),
      value: String(material.item_id),
      description: truncateDiscordText(`${contributed}/${required} delivered | ${remaining} remaining${action === "claim" ? ` | ${Math.max(0, remaining - claimed)} unclaimed` : ""}`, 100)
    };
  });
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`cotf_craft_material:${action}:${projectPayload.project.project_id}`)
      .setPlaceholder(`Choose a material to ${verb}`)
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(options)
  );
}

function buildCraftingMaterialModal(action, projectId, material) {
  const verb = action === "donate" ? "Donate" : "Claim";
  const quantityInput = new TextInputBuilder()
    .setCustomId("cotf_craft_quantity")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Whole number")
    .setRequired(true)
    .setMaxLength(7);
  const required = Number(material.actual_quantity || 0);
  const delivered = Number(material.contributed || 0);
  const reserved = Number(material.claimed || 0);
  const remaining = Math.max(0, required - delivered);
  const available = action === "claim" ? Math.max(0, remaining - reserved) : remaining;
  const quantityLabel = new LabelBuilder()
    .setLabel(`${verb} ${truncateDiscordText(material.name, 35)}`)
    .setDescription(`${available} still available in this phase. Enter a whole number up to ${available}.`)
    .setTextInputComponent(quantityInput);
  const modal = new ModalBuilder()
    .setCustomId(`cotf_craft_${action}_modal:${projectId}:${material.item_id}`)
    .setTitle(`${verb} materials`)
    .addLabelComponents(quantityLabel);
  if (action === "donate" && material.can_be_hq) {
    const qualitySelect = new StringSelectMenuBuilder()
      .setCustomId("cotf_craft_quality")
      .setPlaceholder("Choose the item quality")
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        { label: "Normal Quality (NQ)", value: "nq", default: true },
        { label: "High Quality (HQ)", value: "hq" }
      );
    modal.addLabelComponents(new LabelBuilder()
      .setLabel("Quality")
      .setDescription("Choose the quality of the material you are turning in.")
      .setStringSelectMenuComponent(qualitySelect));
  }
  return modal;
}

function buildCraftingProjectDetailsEmbed(payload) {
  const phase = payload.phase;
  const lines = payload.materials.map((material) => {
    const required = Number(material.actual_quantity || 0);
    const delivered = Number(material.contributed || 0);
    const reserved = Number(material.claimed || 0);
    return `**${truncateDiscordText(material.name, 80)}**\n${delivered}/${required} delivered | ${Math.max(0, required - delivered)} remaining${reserved ? ` | ${reserved} reserved` : ""}`;
  });
  return new EmbedBuilder()
    .setTitle(`Project details: ${truncateDiscordText(payload.project.title, 180)}`)
    .setDescription(phase ? `**${phase.title}**\n${payload.project.notes || "No planning notes."}` : (payload.project.notes || "No active phase."))
    .setColor(0x8b5cf6)
    .addFields({ name: "Current materials", value: truncateDiscordText(lines.join("\n\n") || "No active phase materials.", 1024) })
    .setFooter({ text: "Only you can see this project-detail view." });
}

async function getCraftingMaterialInspection(projectId, itemId) {
  const projectResult = await pool.query(`
    select p.id::int as project_id, p.title, ph.id::int as phase_id, ph.title as phase_title, ph.status as phase_status
    from portal_crafting_projects p
    join portal_crafting_project_phases ph on ph.project_id=p.id and ph.phase_number=p.current_phase_number
    where p.id=$1
    limit 1;`, [projectId]);
  const project = projectResult.rows[0];
  if (!project || project.phase_status !== "active") return null;
  const treeResult = await pool.query(`
    with recursive tree(item_id, needed, depth, path) as (
      select pm.item_id, greatest(pm.actual_quantity - coalesce(contributed.quantity, 0), 0)::numeric, 0, array[pm.item_id]::bigint[]
      from portal_crafting_project_materials pm
      left join lateral (
        select sum(quantity)::int as quantity
        from portal_crafting_contributions
        where project_material_id=pm.id and reversed_at is null
      ) contributed on true
      where pm.project_phase_id=$1 and pm.item_id=$2
      union all
      select ingredient.item_id,
             ceil(tree.needed / greatest(recipe.output_quantity, 1)::numeric) * ingredient.quantity,
             tree.depth + 1,
             tree.path || ingredient.item_id
      from tree
      join lateral (
        select id, output_quantity
        from portal_crafting_recipes
        where output_item_id=tree.item_id
        order by preferred desc, id
        limit 1
      ) recipe on true
      join portal_crafting_recipe_ingredients ingredient on ingredient.recipe_id=recipe.id
      where tree.depth < 5 and not ingredient.item_id = any(tree.path)
    )
    select tree.item_id::int as item_id, ceil(sum(tree.needed))::int as needed, min(tree.depth)::int as depth,
           i.name, i.icon_url, i.can_be_hq, i.is_raw,
           nullif(i.level_equip, 0)::int as level,
           nullif(i.item_level, 0)::int as item_level,
           coalesce(sources.source_details, '[]'::jsonb) as source_details
    from tree
    join portal_crafting_items i on i.id=tree.item_id
    left join lateral (
      select jsonb_agg(jsonb_build_object('type', source_type, 'name', source_name, 'location', location_name) order by source_type, source_name, location_name) as source_details
      from portal_crafting_item_sources
      where item_id=i.id
    ) sources on true
    group by tree.item_id, i.name, i.icon_url, i.can_be_hq, i.is_raw, i.level_equip, i.item_level, sources.source_details
    order by min(tree.depth), lower(i.name);`, [project.phase_id, itemId]);
  const material = treeResult.rows.find((row) => Number(row.item_id) === itemId) || null;
  return material ? { project, material, tree: treeResult.rows } : null;
}

function craftingGatheringActionLabel(name) {
  const labels = {
    Harvesting: "Botanist \u2014 Harvesting",
    Logging: "Botanist \u2014 Logging",
    Mining: "Miner \u2014 Mining",
    Quarrying: "Miner \u2014 Quarrying"
  };
  return labels[String(name || "")] || String(name || "Gathering");
}

function summarizeCraftingSources(value) {
  let sources = value;
  if (!Array.isArray(sources)) {
    try { sources = JSON.parse(String(value || "[]")); } catch { sources = []; }
  }
  const gatheringRoles = {
    Harvesting: "Botanist",
    Logging: "Botanist",
    Mining: "Miner",
    Quarrying: "Miner"
  };
  const roles = new Map();
  const otherSources = new Map();
  for (const source of sources) {
    const type = String(source?.type || "other");
    const name = String(source?.name || source?.type || "Source");
    const location = String(source?.location || "").trim();
    if (type === "gathering" && gatheringRoles[name]) {
      const role = gatheringRoles[name];
      const actions = roles.get(role) || new Map();
      const locations = actions.get(name) || [];
      if (location && !locations.includes(location)) locations.push(location);
      actions.set(name, locations);
      roles.set(role, actions);
      continue;
    }
    const key = `${type}:${name}`;
    const locations = otherSources.get(key) || { name, locations: [] };
    if (location && !locations.locations.includes(location)) locations.locations.push(location);
    otherSources.set(key, locations);
  }
  const roleSummary = [...roles.entries()].map(([role, actions]) => {
    const locations = [...actions.values()].flat().filter((location, index, values) => values.indexOf(location) === index);
    return `${role}: ${locations.length ? locations.join(", ") : "location unavailable"}`;
  });
  const otherSummary = [...otherSources.values()].map((source) => `${source.name}: ${source.locations.length ? source.locations.join(", ") : "location unavailable"}`);
  return [...roleSummary, ...otherSummary].join("\n");
}

function buildCraftingMaterialInspectionEmbed(inspected) {
  const lines = inspected.tree.slice(0, 20).map((row) => {
    const indent = "  ".repeat(Math.min(4, Number(row.depth || 0)));
    const level = [row.level ? `Lv. ${row.level}` : "", row.item_level ? `iLvl ${row.item_level}` : ""].filter(Boolean).join(" | ");
    const sourceSummary = summarizeCraftingSources(row.source_details);
    const source = row.is_raw && sourceSummary ? ` \u2014 ${truncateDiscordText(sourceSummary, 220)}` : row.is_raw ? " \u2014 source not imported yet" : " \u2014 craftable";
    return `${indent}${Number(row.depth || 0) ? "\u21b3" : "\u2022"} **${truncateDiscordText(row.name, 70)}** \u00d7${row.needed}${level ? ` (${level})` : ""}${source}`;
  });
  return new EmbedBuilder()
    .setTitle(`Material details: ${truncateDiscordText(inspected.material.name, 180)}`)
    .setDescription(`**${inspected.project.title}** \u2014 ${inspected.project.phase_title}\nThe tree is calculated for the quantity still needed in this phase.`)
    .setColor(0x8b5cf6)
    .setThumbnail(inspected.material.icon_url || null)
    .addFields({ name: "Crafting tree", value: truncateDiscordText(lines.join("\n") || "No recipe details are available.", 1024) })
    .setFooter({ text: "Only you can see this material inspection." });
}

function buildCraftingInspectionComponents(projectId, itemId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cotf_craft_selected_donate:${projectId}:${itemId}`).setLabel("Donate this material").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`cotf_craft_selected_claim:${projectId}:${itemId}`).setLabel("Claim this material").setStyle(ButtonStyle.Primary)
  )];
}

async function saveCraftingDiscordPhaseResult({ projectId, result, character }) {
  if (!["normal", "excellent", "outstanding"].includes(result)) throw new Error("That phase result is not valid.");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const phases = await client.query(`
      select source.id::int as source_id, source.phase_number as source_number, source.status as source_status,
             target.id::int as target_id, target.status as target_status
      from portal_crafting_projects p
      join portal_crafting_project_phases target on target.project_id=p.id and target.phase_number=p.current_phase_number
      join portal_crafting_project_phases source on source.project_id=p.id and source.phase_number=target.phase_number-1
      where p.id=$1 and p.status='active'
      limit 1
      for update of source, target;`, [projectId]);
    const phase = phases.rows[0];
    if (!phase || phase.source_status !== "completed" || phase.target_status !== "active") throw new Error("A completed phase immediately before the active phase is required.");
    const used = await client.query(`select exists(
      select 1 from portal_crafting_contributions where project_phase_id=$1 and reversed_at is null
      union all
      select 1 from portal_crafting_claims where project_phase_id=$1 and status='active'
    ) as used;`, [phase.target_id]);
    if (used.rows[0]?.used) throw new Error("This phase already has contributions or active claims, so its result can no longer be changed.");
    const factor = result === "excellent" ? 1 : result === "outstanding" ? 2 : 0;
    await client.query(`update portal_crafting_project_phases set progress_result=$1 where id=$2;`, [result, phase.source_id]);
    await client.query(`
      update portal_crafting_project_materials
      set reduced_batch_count=floor((base_batch_count * $1)::numeric / 3)::int,
          actual_quantity=greatest(1, base_quantity - (workshop_batch_quantity * floor((base_batch_count * $1)::numeric / 3)::int))
      where project_phase_id=$2;`, [factor, phase.target_id]);
    await addCraftingActivity(client, projectId, phase.target_id, character, "previous_phase_progress_recorded", {
      sourcePhaseId: phase.source_id,
      targetPhaseId: phase.target_id,
      result,
      source: "discord"
    });
    await client.query("commit");
    return `${character.character_name}: recorded ${result} progress for the previous phase.`;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
async function addCraftingActivity(client, projectId, phaseId, character, actionType, metadata) {
  await client.query(
    `insert into portal_crafting_activity
      (project_id, project_phase_id, action_type, actor_character_id, actor_discord_user_id, actor_name_snapshot, metadata)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb);`,
    [projectId, phaseId, actionType, Number(character.id), String(character.discord_user_id || ""), character.character_name, JSON.stringify(metadata)]
  );
}

async function advanceCraftingProjectFromDiscord(client, projectId, character) {
  const phaseResult = await client.query(
    `select id::int, phase_number
     from portal_crafting_project_phases
     where project_id=$1 and status='active'
     order by phase_number
     limit 1
     for update;`, [projectId]);
  const phase = phaseResult.rows[0];
  if (!phase) return false;
  const readiness = await client.query(
    `select count(pm.id)::int as material_count,
            count(pm.id) filter (where coalesce(contributed.quantity, 0) >= pm.actual_quantity)::int as complete_count
     from portal_crafting_project_materials pm
     left join lateral (
       select sum(quantity)::int as quantity
       from portal_crafting_contributions
       where project_material_id=pm.id and reversed_at is null
     ) contributed on true
     where pm.project_phase_id=$1;`, [phase.id]);
  const summary = readiness.rows[0];
  if (!summary || Number(summary.material_count) === 0 || Number(summary.complete_count) !== Number(summary.material_count)) return false;
  await client.query(`update portal_crafting_project_phases set status='ready' where id=$1 and status='active';`, [phase.id]);
  await addCraftingActivity(client, projectId, phase.id, character, "phase_ready", { phaseNumber: phase.phase_number, source: "discord" });
  await client.query(`update portal_crafting_project_phases set status='completed', completed_at=now() where id=$1;`, [phase.id]);
  await addCraftingActivity(client, projectId, phase.id, character, "phase_completed", { phaseNumber: phase.phase_number, source: "discord" });
  const nextResult = await client.query(
    `select id::int, phase_number
     from portal_crafting_project_phases
     where project_id=$1 and phase_number>$2 and status='provisional'
     order by phase_number
     limit 1
     for update;`, [projectId, phase.phase_number]);
  const next = nextResult.rows[0];
  if (next) {
    await client.query(`update portal_crafting_project_phases set status='active', activated_at=coalesce(activated_at, now()) where id=$1;`, [next.id]);
    await client.query(`update portal_crafting_projects set current_phase_number=$1, updated_at=now() where id=$2;`, [next.phase_number, projectId]);
    await addCraftingActivity(client, projectId, next.id, character, "phase_activated", { phaseNumber: next.phase_number, source: "discord" });
  } else {
    await client.query(`update portal_crafting_projects set status='completed', completed_at=now(), updated_at=now() where id=$1;`, [projectId]);
    await addCraftingActivity(client, projectId, phase.id, character, "project_completed", { finalPhaseNumber: phase.phase_number, source: "discord" });
  }
  return true;
}

async function saveCraftingDiscordInteraction({ projectId, itemId, quantity, quality, action, character }) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const phaseResult = await client.query(
      `select p.status as project_status, ph.id::int as phase_id, ph.status as phase_status
       from portal_crafting_projects p
       join portal_crafting_project_phases ph on ph.project_id=p.id
       where p.id=$1 and ph.phase_number=p.current_phase_number
       limit 1
       for update;`, [projectId]);
    const phase = phaseResult.rows[0];
    if (!phase || phase.project_status !== "active" || phase.phase_status !== "active") throw new Error("This workshop phase is no longer accepting materials.");
    const materialResult = await client.query(
      `select pm.id::int as project_material_id, pm.actual_quantity, i.id::int as item_id, i.name, i.can_be_hq,
              coalesce(contributed.quantity, 0)::int as contributed,
              coalesce(claimed.quantity, 0)::int as claimed
       from portal_crafting_project_materials pm
       join portal_crafting_items i on i.id=pm.item_id
       left join lateral (
         select sum(quantity)::int as quantity
         from portal_crafting_contributions
         where project_material_id=pm.id and reversed_at is null
       ) contributed on true
       left join lateral (
         select sum(quantity)::int as quantity
         from portal_crafting_claims
         where project_material_id=pm.id and status='active'
       ) claimed on true
       where pm.project_phase_id=$1 and pm.item_id=$2
       limit 1;`, [phase.phase_id, itemId]);
    const material = materialResult.rows[0];
    if (!material) throw new Error("That material is no longer part of the active phase.");
    const required = Number(material.actual_quantity || 0);
    const delivered = Number(material.contributed || 0);
    const remaining = Math.max(0, required - delivered);
    if (action === "donate") {
      if (quantity > remaining) throw new Error(`Only ${remaining} of ${material.name} is still needed.`);
      const normalizedQuality = material.can_be_hq && quality === "hq" ? "hq" : material.can_be_hq ? "nq" : "not_applicable";
      await client.query(
        `insert into portal_crafting_contributions
          (project_id,project_phase_id,project_material_id,item_id,contributor_character_id,contributor_discord_user_id,contributor_name_snapshot,quantity,quality,note)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10);`,
        [projectId, phase.phase_id, material.project_material_id, itemId, Number(character.id), character.discord_user_id, character.character_name, quantity, normalizedQuality, "Recorded from Discord"]
      );
      await addCraftingActivity(client, projectId, phase.phase_id, character, "contribution_added", { itemId, quantity, quality: normalizedQuality, source: "discord" });
      await advanceCraftingProjectFromDiscord(client, projectId, character);
      await client.query("commit");
      return `${character.character_name}: recorded ${quantity}x ${material.name}${normalizedQuality === "hq" ? " (HQ)" : ""}.`;
    }
    const unclaimed = Math.max(0, remaining - Number(material.claimed || 0));
    if (quantity > unclaimed) throw new Error(`Only ${unclaimed} unclaimed of ${material.name} remains.`);
    await client.query(
      `insert into portal_crafting_claims
        (project_id,project_phase_id,project_material_id,item_id,claimant_character_id,claimant_discord_user_id,claimant_name_snapshot,quantity)
       values ($1,$2,$3,$4,$5,$6,$7,$8);`,
      [projectId, phase.phase_id, material.project_material_id, itemId, Number(character.id), character.discord_user_id, character.character_name, quantity]
    );
    await addCraftingActivity(client, projectId, phase.phase_id, character, "claim_created", { itemId, quantity, source: "discord" });
    await client.query("commit");
    return `${character.character_name}: reserved ${quantity}x ${material.name}.`;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function getCraftingDiscordClaims(projectId, discordUserId) {
  const result = await pool.query(`
    select c.id::int, c.quantity, i.name as item_name, ph.title as phase_title
    from portal_crafting_claims c
    join portal_crafting_items i on i.id=c.item_id
    join portal_crafting_project_phases ph on ph.id=c.project_phase_id
    where c.project_id=$1 and c.claimant_discord_user_id=$2 and c.status='active'
    order by ph.phase_number, lower(i.name), c.id
    limit 20;`, [projectId, discordUserId]);
  return result.rows;
}

function buildCraftingClaimsReply(projectTitle, projectId, claims) {
  if (!claims.length) {
    return { content: `You have no active material claims on **${truncateDiscordText(projectTitle, 100)}**.`, ephemeral: true };
  }
  const embed = new EmbedBuilder()
    .setTitle(`Your claims: ${truncateDiscordText(projectTitle, 180)}`)
    .setDescription(claims.map((claim) => `**${claim.quantity}x ${claim.item_name}** \u2014 ${claim.phase_title}`).join("\n"))
    .setColor(0x8b5cf6)
    .setFooter({ text: "Use a release button only if you are no longer working on that material." });
  const components = [];
  for (let index = 0; index < claims.length; index += 5) {
    components.push(new ActionRowBuilder().addComponents(...claims.slice(index, index + 5).map((claim) =>
      new ButtonBuilder()
        .setCustomId(`cotf_craft_release_claim:${projectId}:${claim.id}`)
        .setLabel(`Release ${truncateDiscordText(claim.item_name, 55)}`)
        .setStyle(ButtonStyle.Danger)
    )));
  }
  return { embeds: [embed], components, ephemeral: true };
}

async function releaseCraftingDiscordClaim({ projectId, claimId, character }) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const claimResult = await client.query(`
      select id::int, project_phase_id::int, item_id::int, quantity
      from portal_crafting_claims
      where id=$1 and project_id=$2 and claimant_discord_user_id=$3 and status='active'
      limit 1
      for update;`, [claimId, projectId, character.discord_user_id]);
    const claim = claimResult.rows[0];
    if (!claim) throw new Error("That active claim is not available for your Discord account.");
    await client.query(`update portal_crafting_claims set status='released', released_at=now() where id=$1;`, [claim.id]);
    await addCraftingActivity(client, projectId, claim.project_phase_id, character, "claim_released", { claimId: claim.id, itemId: claim.item_id, quantity: claim.quantity, source: "discord" });
    await client.query("commit");
    return "Your material claim has been released.";
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
async function handleCraftingProjectInteraction(interaction) {
  const buttonMatch = interaction.isButton() ? interaction.customId.match(/^cotf_craft_(donate|claim|details|inspect|my_claims):(\d+)$/) : null;
  const selectedMaterialMatch = interaction.isButton() ? interaction.customId.match(/^cotf_craft_selected_(donate|claim):(\d+):(\d+)$/) : null;
  const releaseClaimMatch = interaction.isButton() ? interaction.customId.match(/^cotf_craft_release_claim:(\d+):(\d+)$/) : null;
  const phaseResultMatch = interaction.isButton() ? interaction.customId.match(/^cotf_craft_phase_result:(\d+):(normal|excellent|outstanding)$/) : null;
  const selectMatch = interaction.isStringSelectMenu() ? interaction.customId.match(/^cotf_craft_material:(donate|claim|inspect):(\d+)$/) : null;
  const modalMatch = interaction.isModalSubmit() ? interaction.customId.match(/^cotf_craft_(donate|claim)_modal:(\d+):(\d+)$/) : null;
  if (!buttonMatch && !selectedMaterialMatch && !releaseClaimMatch && !phaseResultMatch && !selectMatch && !modalMatch) return false;
  try {
    const matched = buttonMatch || selectedMaterialMatch || releaseClaimMatch || phaseResultMatch || selectMatch || modalMatch;
    const action = matched[1];
    const projectId = Number(phaseResultMatch ? phaseResultMatch[1] : releaseClaimMatch ? releaseClaimMatch[1] : matched[2]);
    const character = await getActiveCharacterForDiscordUser(interaction.user.id,getDiscordInteractionDisplayName(interaction));
    if (!character) throw new Error("Your Discord account is not linked to a current, active FC character. Use verification or ask an officer for help.");
    character.discord_user_id = interaction.user.id;
    const settings = await getBotSettings();
    const guild = interaction.guild || await bot.guilds.fetch(settings.guild_id || DISCORD_GUILD_ID);
    if (phaseResultMatch) {
      await interaction.deferReply({ ephemeral: true });
      const result = await saveCraftingDiscordPhaseResult({ projectId, result: phaseResultMatch[2], character });
      await executeRefreshCraftingProject({ action_payload: { projectId } }, settings, guild).catch((error) => console.error("[cotf-bot] Crafting phase-result refresh failed:", error));
      await interaction.editReply(result);
      return true;
    }
    if (releaseClaimMatch) {
      await interaction.deferReply({ ephemeral: true });
      const result = await releaseCraftingDiscordClaim({ projectId, claimId: Number(releaseClaimMatch[2]), character });
      await executeRefreshCraftingProject({ action_payload: { projectId } }, settings, guild).catch((error) => console.error("[cotf-bot] Crafting claim-release refresh failed:", error));
      await interaction.editReply(result);
      return true;
    }
    if (selectedMaterialMatch) {
      const itemId = Number(selectedMaterialMatch[3]);
      const payload = await getCraftingProjectDiscordPayload(projectId);
      const material = payload?.materials.find((row) => Number(row.item_id) === itemId);
      if (!material) throw new Error("That material is no longer available in the active phase.");
      await interaction.showModal(buildCraftingMaterialModal(action, projectId, material));
      return true;
    }
    if (buttonMatch) {
      const payload = await getCraftingProjectDiscordPayload(projectId);
      if (!payload) throw new Error("That crafting project is no longer available.");
      if (action === "details") {
        await interaction.reply({ embeds: [buildCraftingProjectDetailsEmbed(payload)], ephemeral: true });
      } else if (action === "my_claims") {
        const claims = await getCraftingDiscordClaims(projectId, interaction.user.id);
        await interaction.reply(buildCraftingClaimsReply(payload.project.title, projectId, claims));
      } else {
        if (payload.project.status !== "active" || payload.phase?.status !== "active" || !payload.materials.length) throw new Error("This project is not currently accepting materials.");
        await interaction.reply({ content: `Choose a material to ${action === "donate" ? "donate" : action === "claim" ? "claim" : "inspect"}.`, components: [buildCraftingMaterialPicker(payload, action)], ephemeral: true });
      }
      return true;
    }
    if (selectMatch) {
      const itemId = Number(interaction.values?.[0] || 0);
      const payload = await getCraftingProjectDiscordPayload(projectId);
      const material = payload?.materials.find((row) => Number(row.item_id) === itemId);
      if (!material) throw new Error("That material is no longer available in the active phase.");
      if (action === "inspect") {
        await interaction.deferReply({ ephemeral: true });
        const inspected = await getCraftingMaterialInspection(projectId, itemId);
        if (!inspected) throw new Error("Material inspection is no longer available for this phase.");
        await interaction.editReply({ embeds: [buildCraftingMaterialInspectionEmbed(inspected)], components: buildCraftingInspectionComponents(projectId, itemId) });
      } else {
        await interaction.showModal(buildCraftingMaterialModal(action, projectId, material));
      }
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    const itemId = Number(modalMatch[3]);
    const quantity = Number.parseInt(String(interaction.fields.getTextInputValue("cotf_craft_quantity") || ""), 10);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Enter a whole number greater than zero.");
    let quality = "not_applicable";
    if (action === "donate") {
      try { quality = interaction.fields.getStringSelectValues("cotf_craft_quality")?.[0] || "nq"; } catch { quality = "nq"; }
    }
    const result = await saveCraftingDiscordInteraction({ projectId, itemId, quantity, quality, action, character });
    await executeRefreshCraftingProject({ action_payload: { projectId } }, settings, guild).catch((error) => console.error("[cotf-bot] Crafting project refresh after interaction failed:", error));
    await interaction.editReply(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cotf-bot] Crafting project interaction failed:", error);
    if (interaction.deferred || interaction.replied) await interaction.editReply(`Crafting action could not be saved: ${message}`);
    else await interaction.reply({ content: `Crafting action could not be saved: ${message}`, ephemeral: true });
  }
  return true;
}
async function executeTestMountWin(action, settings, guild) {
  const payload = action.action_payload || {};
  const winnerNames = Array.isArray(payload.winnerNames)
    ? payload.winnerNames.map((name) => String(name || "").trim()).filter(Boolean)
    : [];
  if (!settings.test_channel_id) {
    return "Skipped: no Test Channel ID is configured.";
  }
  if (!payload.mountName || !winnerNames.length) {
    throw new Error("Test mount-win action is missing a mount or winner names.");
  }

  const channel = await guild.channels.fetch(settings.test_channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    throw new Error("Configured Test Channel could not be found or is not text-based.");
  }

  const embed = new EmbedBuilder()
    .setTitle("Mount Win! (Test)")
    .setDescription(`Congratulations to **${winnerNames.join(", ")}** on collecting **${payload.mountName}**!`)
    .setColor(0x9d4edd)
    .addFields(
      { name: "Mount", value: limitMountWinText(payload.mountName), inline: true },
      { name: "Expansion", value: limitMountWinText(payload.expansion || payload.setName || "Mount"), inline: true },
      { name: "Character(s)", value: limitMountWinText(winnerNames.join("\n")), inline: false },
      { name: "Source", value: limitMountWinText(payload.sourceName || payload.setName || "Mount acquisition detected"), inline: false }
    )
    .setTimestamp()
    .setFooter({ text: "FFXIV materials © SQUARE ENIX" });
  if (payload.imageUrl) embed.setImage(payload.imageUrl);

  await channel.send({
    content: `Test mount-win notification for ${winnerNames.join(", ")}.`,
    embeds: [embed]
  });
  return `Sent a test mount-win post for ${payload.mountName} to the Test Channel.`;
}
async function cleanupStaleDiscordLinkAfterAbsentMember(action, resultMessage) {
  const alreadyAbsent = resultMessage === "Skipped: Discord member was not found in this server.";
  const shouldClean = (action.action_type === "kick_member" && (alreadyAbsent || resultMessage.startsWith("Kicked "))) || (action.action_type === "remove_verified_role" && alreadyAbsent);
  if (!shouldClean) return;
  await pool.query(`delete from portal_discord_links dl where dl.discord_user_id = $1 and not exists (select 1 from portal_characters c where c.id = dl.character_id and c.active = true and c.fc_membership_status = 'current');`, [action.discord_user_id]);
  await pool.query(`delete from portal_discord_roster_review_decisions where discord_user_id = $1;`, [action.discord_user_id]);
  await pool.query(`update portal_discord_member_snapshots set present_in_guild = false, has_verified_role = false, linked_character_id = null, linked_character_name = null, linked_world = null, linked_fc_status = null, linked_active = null, review_status = 'ok', review_reason = null, updated_at = now() where discord_user_id = $1;`, [action.discord_user_id]);
}

async function isProtectedPortalAdministrator(discordUserId) {
  const protectedIds = new Set(PRIMARY_PORTAL_ADMIN_ID ? [PRIMARY_PORTAL_ADMIN_ID] : []);
  const result = await pool.query(`select value from portal_settings where key='additionalAdminDiscordIds' limit 1;`).catch(() => ({ rows: [] }));
  String(result.rows[0]?.value || "").split(",").map((value) => value.trim()).filter(Boolean).forEach((value) => protectedIds.add(value));
  return protectedIds.has(String(discordUserId || ""));
}

async function processOneDiscordAction(privacyOnly = false) {
  const action = await pickNextDiscordAction(privacyOnly);

  if (!action) {
    return false;
  }

  let settings = null;
  let guild = null;
  let link = null;

  try {
    settings = await getBotSettings();
    const guildId = settings.guild_id || DISCORD_GUILD_ID;

    if (!guildId) {
      await failDiscordAction(action.id, "No Discord guild/server ID is configured.");
      return true;
    }

    guild = await bot.guilds.fetch(guildId);
    link = await getDiscordLinkForAction(action.discord_user_id);

    let resultMessage = "";

    const isDestructiveRosterAction = ["remove_verified_role", "add_unverified_role", "kick_member"].includes(action.action_type);
    if (isDestructiveRosterAction && await isProtectedPortalAdministrator(action.discord_user_id)) {
      resultMessage = "Skipped: portal administrators are protected from destructive roster actions.";
    } else if (action.action_type === "remove_verified_role") {
      resultMessage = await executeRemoveVerifiedRole(action, settings, guild, link);
    } else if (action.action_type === "add_unverified_role") {
      resultMessage = await executeAddUnverifiedRole(action, settings, guild, link);
    } else if (action.action_type === "apply_verified_state") {
      resultMessage = await executeApplyVerifiedState(action, settings, guild, link);
    } else if (action.action_type === "send_officer_alert") {
      resultMessage = await executeOfficerAlert(action, settings, guild, link);
    } else if (action.action_type === "kick_member") {
      resultMessage = await executeKickMember(action, settings, guild, link);
    } else if (action.action_type === "privacy_full_opt_out") {
      resultMessage = await executePrivacyFullOptOut(action, settings, guild);
    } else if (action.action_type === "scan_discord_roster") {
      resultMessage = await executeDiscordRosterScan(action, settings, guild);
    } else if (action.action_type === "match_discord_names") {
      resultMessage = await executeDiscordNameMatch(action, settings, guild);
    } else if (action.action_type === "send_test_mount_win") {
      resultMessage = await executeTestMountWin(action, settings, guild);
    } else if (action.action_type === "refresh_event_roster") {
      resultMessage = await executeRefreshEventRoster(action, guild);
    } else if (action.action_type === "delete_event_post") {
      resultMessage = await executeDeleteEventPost(action, settings, guild);
    } else if (action.action_type === "refresh_crafting_project") {
      resultMessage = await executeRefreshCraftingProject(action, settings, guild);
    } else {
      throw new Error(`Unsupported action type: ${action.action_type}`);
    }

    await cleanupStaleDiscordLinkAfterAbsentMember(action, resultMessage);

    if (action.action_type === "privacy_full_opt_out") {
      await pool.query("delete from portal_discord_action_queue where id=$1", [action.id]);
      console.log(`[cotf-bot] Completed privacy cleanup action ${action.id}.`);
      return true;
    }

    await completeDiscordAction(action.id, resultMessage);

    await sendDiscordActionResultNotificationSafe(
      action,
      settings,
      guild,
      link,
      "completed",
      resultMessage
    );

    console.log(`[cotf-bot] Completed Discord action ${action.id}: ${resultMessage}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await failDiscordAction(action.id, message);

    if (settings && guild) {
      await sendDiscordActionResultNotificationSafe(
        action,
        settings,
        guild,
        link,
        "failed",
        message
      );
    }

    console.error(`[cotf-bot] Failed Discord action ${action.id}:`, error);
  }

  return true;
}

async function queueAutomaticDiscordRosterScanIfDue() {
  const settings = await getBotSettings({ fresh: true });

  if (!settings.auto_roster_scan_enabled) {
    return;
  }

  const intervalHours = Math.max(
    1,
    Math.min(168, Number(settings.roster_scan_interval_hours || 24))
  );

  const result = await pool.query(`
    select requested_at
    from portal_discord_action_queue
    where action_type = 'scan_discord_roster'
    order by requested_at desc
    limit 1;
  `);

  const lastRequestedAt = result.rows[0]?.requested_at
    ? new Date(result.rows[0].requested_at)
    : null;

  const nextAllowedAt = lastRequestedAt
    ? new Date(lastRequestedAt.getTime() + intervalHours * 60 * 60 * 1000)
    : null;

  if (nextAllowedAt && nextAllowedAt > new Date()) {
    return;
  }

  await pool.query(
    `
      insert into portal_discord_action_queue (
        discord_user_id,
        action_type,
        action_payload,
        status,
        requested_by,
        requested_at,
        updated_at
      )
      values (
        '__guild_roster_scan__',
        'scan_discord_roster',
        $1::jsonb,
        'pending',
        'Automatic roster scanner',
        now(),
        now()
      )
      on conflict (discord_user_id, action_type)
      where status = 'pending'
      do nothing;
    `,
    [JSON.stringify({ note: `Automatic scan every ${intervalHours} hour(s).` })]
  );

  console.log(`[cotf-bot] Queued automatic Discord roster scan. Interval: ${intervalHours} hour(s).`);
}

async function resetStaleDiscordScheduledPosts() {
  await pool.query(`
    update portal_discord_scheduled_posts
    set
      status = 'scheduled',
      error_message = 'Reset after bot restart or stale processing timeout.',
      updated_at = now()
    where status = 'processing'
      and updated_at < now() - interval '15 minutes';
  `);
}

async function pickNextDiscordScheduledPost() {
  const result = await pool.query(`
    with picked as (
      select id
      from portal_discord_scheduled_posts
      where status = 'scheduled'
        and scheduled_for <= now()
      order by scheduled_for asc, created_at asc
      limit 1
      for update skip locked
    )
    update portal_discord_scheduled_posts p
    set
      status = 'processing',
      error_message = null,
      updated_at = now()
    from picked
    where p.id = picked.id
    returning p.*;
  `);

  return result.rows[0] || null;
}

async function completeDiscordScheduledPost(postId, sentMessageId) {
  await pool.query(
    `
      update portal_discord_scheduled_posts
      set
        status = 'sent',
        sent_at = now(),
        sent_message_id = $2,
        error_message = null,
        updated_at = now()
      where id = $1;
    `,
    [postId, sentMessageId || null]
  );
}

async function failDiscordScheduledPost(postId, errorMessage) {
  await pool.query(
    `
      update portal_discord_scheduled_posts
      set
        status = 'failed',
        error_message = $2,
        updated_at = now()
      where id = $1;
    `,
    [postId, errorMessage]
  );
}

function getScheduledPostChannelId(post, settings) {
  if (post.target_channel_id) {
    return post.target_channel_id;
  }

  const channelMap = {
    event: settings.event_channel_id,
    raid: settings.event_channel_id,
    mount_farm: settings.event_channel_id,
    officer_log: settings.officer_log_channel_id,
    test: settings.test_channel_id
  };

  return channelMap[post.target_channel_kind] || "";
}

function getScheduledPostTypeLabel(postType) {
  if (postType === "raid") return "Raid";
  if (postType === "mount_farm") return "Mount Farm";
  if (postType === "reminder" || postType === "event_reminder") return "Reminder";
  return "Custom";
}

const EVENT_RSVP_STATUSES = new Set(["going", "maybe", "cant_attend"]);
const EVENT_CHECK_IN_LEAD_MINUTES = 60;
const DEFAULT_EVENT_DURATION_HOURS = 6;
const CHECKED_IN_ATTENDANCE_STATUSES = new Set(["present", "late"]);

function getDiscordEventAttendanceWindow(event) {
  const startsAt = new Date(event.event_starts_at).getTime();
  const endsAt = event.event_ends_at
    ? new Date(event.event_ends_at).getTime()
    : startsAt + DEFAULT_EVENT_DURATION_HOURS * 60 * 60 * 1000;
  return { startsAt, opensAt: startsAt - EVENT_CHECK_IN_LEAD_MINUTES * 60 * 1000, endsAt };
}

function isDiscordEventCheckInOpen(event) {
  if (!event?.event_starts_at || event.event_status !== "planned" || event.check_in_required !== true) return false;
  const now = Date.now();
  const window = getDiscordEventAttendanceWindow(event);
  return now >= window.opensAt && now <= window.endsAt;
}

const EVENT_ROLE_PREFERENCES = new Set([
  "tank",
  "healer",
  "melee_dps",
  "ranged_dps",
  "caster",
  "flexible"
]);

function getEventRoleLabel(rolePreference) {
  const labels = {
    tank: "Tank",
    healer: "Healer",
    melee_dps: "Melee DPS",
    ranged_dps: "Ranged DPS",
    caster: "Caster",
    flexible: "Flexible"
  };
  return labels[rolePreference] || "Flexible";
}

function buildEventRsvpComponents(eventId, hasMountTarget = false, options = {}) {
  const buttons = [];
  if (options.rsvpOpen !== false) {
    buttons.push(new ButtonBuilder()
      .setCustomId(`cotf_event_rsvp:${eventId}:going`)
      .setLabel("Going")
      .setStyle(ButtonStyle.Success));
    buttons.push(new ButtonBuilder()
      .setCustomId(`cotf_event_rsvp:${eventId}:maybe`)
      .setLabel("Maybe")
      .setStyle(ButtonStyle.Primary));
    buttons.push(new ButtonBuilder()
      .setCustomId(`cotf_event_rsvp:${eventId}:cant_attend`)
      .setLabel("Can't Attend")
      .setStyle(ButtonStyle.Secondary));
  }
  if (options.checkInOpen) {
    buttons.push(new ButtonBuilder()
      .setCustomId(`cotf_event_checkin:${eventId}`)
      .setLabel("Check In")
      .setStyle(ButtonStyle.Success));
  }
  if (options.completionOpen) {
    buttons.push(new ButtonBuilder()
      .setCustomId(`cotf_event_complete:${eventId}`)
      .setLabel(hasMountTarget ? "Got Mount" : "Rotation Complete")
      .setStyle(ButtonStyle.Secondary));
  }

  return buttons.length > 0 ? [new ActionRowBuilder().addComponents(...buttons)] : [];
}

function buildEventRoleModal(eventId, signupStatus) {
  const statusLabel = signupStatus === "going" ? "Going" : "Maybe";
  const roleSelect = new StringSelectMenuBuilder()
    .setCustomId("cotf_event_role_choice")
    .setPlaceholder("Choose your preferred FFXIV role")
    .setRequired(true)
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      { label: "Tank", value: "tank" },
      { label: "Healer", value: "healer" },
      { label: "Melee DPS", value: "melee_dps" },
      { label: "Ranged DPS", value: "ranged_dps" },
      { label: "Caster", value: "caster" },
      { label: "Flexible", value: "flexible" }
    );

  const roleLabel = new LabelBuilder()
    .setLabel("Preferred FFXIV role")
    .setDescription(`Required to finish your ${statusLabel} RSVP.`)
    .setStringSelectMenuComponent(roleSelect);

  return new ModalBuilder()
    .setCustomId(`cotf_event_role_modal:${eventId}:${signupStatus}`)
    .setTitle(`${statusLabel} RSVP`)
    .addLabelComponents(roleLabel);
}

function formatEventRosterField(signups) {
  if (signups.length === 0) return "No one yet.";

  const lines = [];
  for (const signup of signups) {
    const line = `${signup.character_name} \u2014 ${getEventRoleLabel(signup.role_preference)}`;
    if ([...lines, line].join("\n").length > 980) {
      const remaining = signups.length - lines.length;
      lines.push(`\u2026and ${remaining} more.`);
      break;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

function getDiscordPartyRoleNeeds(signups, partySize) {
  const safePartySize = Math.max(1, Number(partySize || 8));
  const supportTarget = safePartySize <= 3 ? 0 : Math.max(1, Math.floor(safePartySize / 4));
  const targets = { tank: supportTarget, healer: supportTarget, dps: Math.max(0, safePartySize - supportTarget * 2) };
  const counts = {
    tank: signups.filter((signup) => signup.role_preference === "tank").length,
    healer: signups.filter((signup) => signup.role_preference === "healer").length,
    dps: signups.filter((signup) => ["melee_dps", "ranged_dps", "caster"].includes(signup.role_preference)).length
  };
  let flexible = signups.filter((signup) => signup.role_preference === "flexible").length;
  const gaps = { tank: Math.max(0, targets.tank - counts.tank), healer: Math.max(0, targets.healer - counts.healer), dps: Math.max(0, targets.dps - counts.dps) };
  for (const role of ["tank", "healer", "dps"]) {
    const covered = Math.min(flexible, gaps[role]);
    gaps[role] -= covered;
    flexible -= covered;
  }
  return [gaps.tank ? `${gaps.tank} tank` : "", gaps.healer ? `${gaps.healer} healer` : "", gaps.dps ? `${gaps.dps} DPS` : ""]
    .filter(Boolean).join(", ") || "Covered";
}

function assignDiscordEventParties(signups, strategy, partySize, standardPartyRolesRequired = true) {
  const safePartySize = Math.max(1, Math.min(24, Math.floor(Number(partySize || 8))));
  const ordered = [...signups].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
    String(a.character_name).localeCompare(String(b.character_name)) || Number(a.character_id) - Number(b.character_id)
  );
  const assignments = new Map();
  if (strategy !== "split") {
    ordered.forEach((signup, index) => assignments.set(Number(signup.character_id), {
      state: index < safePartySize ? "active" : "waiting",
      partyNumber: index < safePartySize ? 1 : null
    }));
    return assignments;
  }
  const teamCount = Math.max(1, Math.ceil(ordered.length / safePartySize));
  const baseSize = Math.floor(ordered.length / teamCount);
  const extra = ordered.length % teamCount;
  const teams = Array.from({ length: teamCount }, (_, index) => ({
    number: index + 1, capacity: baseSize + (index < extra ? 1 : 0), members: []
  }));
  const priority = { tank: 0, healer: 1, flexible: 2, melee_dps: 3, ranged_dps: 3, caster: 3 };
  const partyOrdered = standardPartyRolesRequired
    ? [...ordered].sort((a, b) =>
        (priority[a.role_preference] ?? 4) - (priority[b.role_preference] ?? 4) ||
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    : ordered;
  for (const signup of partyOrdered) {
    const available = teams.filter((team) => team.members.length < team.capacity);
    available.sort((a, b) => {
      const roleDifference = standardPartyRolesRequired
        ? a.members.filter((member) => member.role_preference === signup.role_preference).length -
          b.members.filter((member) => member.role_preference === signup.role_preference).length
        : 0;
      return roleDifference || a.members.length - b.members.length || a.number - b.number;
    });
    const team = available[0];
    if (!team) continue;
    team.members.push(signup);
    assignments.set(Number(signup.character_id), { state: "active", partyNumber: team.number });
  }
  return assignments;
}

async function rebalanceDiscordEventRoster(eventId, queryable = pool) {
  const eventResult = await queryable.query(
    `select party_strategy, party_size, standard_party_roles_required, check_in_required, event_starts_at
     from portal_discord_events where id = $1 for update;`, [eventId]
  );
  if (eventResult.rows.length === 0) return;
  const event = eventResult.rows[0];
  const attendanceRequired = event.check_in_required === true &&
    new Date(event.event_starts_at).getTime() <= Date.now();
  const signupResult = await queryable.query(
    `select s.character_id::int, s.role_preference, s.created_at, c.character_name
     from portal_discord_event_signups s
     join portal_characters c on c.id = s.character_id
     where s.event_id = $1 and s.signup_status = 'going' and s.roster_state <> 'completed'
       and ($2::boolean = false or s.attendance_status in ('present', 'late'))
     order by s.created_at asc, s.character_id asc;`, [eventId, attendanceRequired]
  );
  const assignments = assignDiscordEventParties(
    signupResult.rows, event.party_strategy, event.party_size,
    event.standard_party_roles_required !== false
  );
  await queryable.query(
    `update portal_discord_event_signups
     set roster_state = 'waiting', party_number = null, updated_at = now()
     where event_id = $1 and roster_state <> 'completed';`, [eventId]
  );
  for (const [characterId, assignment] of assignments) {
    await queryable.query(
      `update portal_discord_event_signups
       set roster_state = $3, party_number = $4, updated_at = now()
       where event_id = $1 and character_id = $2 and roster_state <> 'completed';`,
      [eventId, characterId, assignment.state, assignment.partyNumber]
    );
  }
}

async function rebalanceActiveDiscordEventRosters() {
  const result = await pool.query(`select id::int from portal_discord_events where status = 'planned' order by id asc;`);
  for (const row of result.rows) await rebalanceDiscordEventRoster(Number(row.id));
}

function buildDiscordPartyFields(roster, partySize, standardPartyRolesRequired = true, attendanceStarted = false) {
  const active = roster.filter((signup) => signup.signup_status === "going" && signup.roster_state === "active" &&
    (!attendanceStarted || CHECKED_IN_ATTENDANCE_STATUSES.has(signup.attendance_status)));
  const partyNumbers = [...new Set(active.map((signup) => Number(signup.party_number || 1)))].sort((a, b) => a - b);
  const lines = partyNumbers.map((partyNumber) => {
    const party = active.filter((signup) => Number(signup.party_number || 1) === partyNumber);
    const members = party.map((signup) => `${signup.character_name} (${getEventRoleLabel(signup.role_preference)})`).join(", ");
    const composition = standardPartyRolesRequired
      ? `Needs: ${getDiscordPartyRoleNeeds(party, partySize)}`
      : "Flexible composition - standard roles not required";
    return `**Party ${partyNumber} (${party.length}/${partySize})** - ${members}\n${composition}`;
  });
  if (lines.length === 0) return [{ name: "Active Parties (0)", value: "No active participants yet.", inline: false }];
  const fields = [];
  let chunk = "";
  for (const line of lines) {
    const candidate = chunk ? `${chunk}\n${line}` : line;
    if (candidate.length > 1000 && chunk) {
      fields.push({ name: fields.length === 0 ? `Active Parties (${active.length})` : "Active Parties (continued)", value: chunk, inline: false });
      chunk = line;
    } else chunk = candidate;
    if (fields.length >= 5) break;
  }
  if (chunk && fields.length < 6) fields.push({ name: fields.length === 0 ? `Active Parties (${active.length})` : "Active Parties (continued)", value: chunk.slice(0, 1024), inline: false });
  return fields;
}
async function getDiscordEventAnnouncementByPostId(postId) {
  const result = await pool.query(
    `select e.id::int as event_id, e.status as event_status, e.roster_locked, e.party_strategy, e.party_size, e.check_in_required,
            e.event_starts_at, e.event_ends_at
     from portal_discord_scheduled_posts p
     join portal_discord_events e
       on e.id = p.event_id or e.announcement_scheduled_post_id = p.id
     where p.id = $1
     limit 1;`,
    [postId]
  );
  return result.rows[0] || null;
}

async function getDiscordEventAnnouncement(eventId) {
  const result = await pool.query(
    `select e.id::int as event_id, e.status as event_status, e.roster_locked, e.party_strategy, e.party_size, e.check_in_required,
            e.event_starts_at, e.event_ends_at, p.*
     from portal_discord_events e
     join portal_discord_scheduled_posts p
       on p.id = e.announcement_scheduled_post_id
     where e.id = $1
     limit 1;`,
    [eventId]
  );
  return result.rows[0] || null;
}

async function getDiscordEventRoster(eventId) {
  const result = await pool.query(
    `select s.character_id::int, c.character_name, s.signup_status, s.role_preference,
            s.roster_state, s.party_number, s.completed_at, s.completed_by,
            s.attendance_status, s.checked_in_at, s.attendance_updated_at, s.created_at,
            case
              when target.mount_id is null then null
              else not coalesce(cm.owned, false)
            end as needs_target_mount
     from portal_discord_event_signups s
     join portal_characters c on c.id = s.character_id
     left join lateral (
       select em.mount_id
       from portal_discord_event_mounts em
       where em.event_id = s.event_id
       order by em.sort_order asc, em.mount_id asc
       limit 1
     ) target on true
     left join portal_character_mounts cm
       on cm.character_id = s.character_id and cm.mount_id = target.mount_id
     where s.event_id = $1
     order by
       case s.signup_status when 'going' then 0 when 'maybe' then 1 else 2 end,
       case s.roster_state when 'active' then 0 when 'waiting' then 1 else 2 end,
       coalesce(s.party_number, 999) asc, s.created_at asc, lower(c.character_name) asc;`,
    [eventId]
  );
  return result.rows;
}

async function getDiscordEventMountInsights(eventId) {
  const targetResult = await pool.query(
    `select e.event_type, e.level, e.level_max, e.party_strategy, e.party_size, e.standard_party_roles_required, e.check_in_required, e.roster_locked,
            e.status as event_status, e.event_starts_at, e.event_ends_at,
            m.id::int as mount_id, m.mount_name, m.source_name
     from portal_discord_events e
     left join lateral (
       select em.mount_id
       from portal_discord_event_mounts em
       where em.event_id = e.id
       order by em.sort_order asc, em.mount_id asc
       limit 1
     ) target on true
     left join portal_mounts m on m.id = target.mount_id
     where e.id = $1
     limit 1;`,
    [eventId]
  );
  const event = targetResult.rows[0] || null;
  if (!event) return { targetMount: null, suggestions: [], partyStrategy: "rotation", partySize: 8, standardPartyRolesRequired: true, checkInRequired: false, rosterLocked: false, eventStatus: null, eventStartsAt: null, eventEndsAt: null };

  const targetMount = event.mount_id
    ? { id: Number(event.mount_id), name: event.mount_name, sourceName: event.source_name }
    : null;
  const suggestionEventTypes = ["custom", "raid", "trial", "dungeon"];
  if (targetMount || !suggestionEventTypes.includes(event.event_type)) {
    return {
      targetMount, suggestions: [], partyStrategy: event.party_strategy || "rotation",
      partySize: Number(event.party_size || 8),
      standardPartyRolesRequired: event.standard_party_roles_required !== false,
      checkInRequired: event.check_in_required === true,
      rosterLocked: Boolean(event.roster_locked),
      eventStatus: event.event_status,
      eventStartsAt: event.event_starts_at,
      eventEndsAt: event.event_ends_at
    };
  }

  const parsedEventLevel = Number.parseInt(String(event.level ?? ""), 10);
  const eventLevel = Number.isFinite(parsedEventLevel) && parsedEventLevel > 0
    ? parsedEventLevel
    : null;
  const parsedEventLevelMax = Number.parseInt(String(event.level_max ?? ""), 10);
  const eventLevelMax = Number.isFinite(parsedEventLevelMax) && parsedEventLevelMax > 0
    ? parsedEventLevelMax
    : null;
  const suggestionResult = await pool.query(
    `select m.id::int as mount_id, m.mount_name, m.source_name, count(*)::int as need_count
     from portal_discord_event_signups s
     join portal_characters c on c.id = s.character_id and c.active = true
     cross join portal_mounts m
     left join lateral (
       select coalesce(d.level, d.level_required)::int as level
       from portal_discord_duties d
       where d.active = true
         and coalesce(d.level, d.level_required) is not null
         and regexp_replace(lower(d.name), '[^a-z0-9]+', '', 'g')
           = regexp_replace(
               lower(
                 regexp_replace(
                   coalesce(m.source_name, ''),
                   '^(trial|raid|dungeon|alliance raid|alliance|ultimate|criterion|variant|source)[[:space:]]*:[[:space:]]*',
                   '',
                   'i'
                 )
               ),
               '[^a-z0-9]+',
               '',
               'g'
             )
       order by d.sort_order asc, lower(d.name) asc
       limit 1
     ) source_duty on true
     left join portal_character_mounts cm
       on cm.character_id = s.character_id and cm.mount_id = m.id
     where s.event_id = $1
       and s.signup_status = 'going'
       and s.roster_state <> 'completed'
       and m.active = true
       and m.farm_priority = 'farm_target'
       and m.mount_category in ('Trial', 'Raid', 'Dungeon', 'Dungeon / Criterion', 'Variant / Criterion')
       and coalesce(m.source_name, '') ~*
         '^(trial|raid|dungeon|alliance raid|alliance|ultimate|criterion|variant)[[:space:]]*:'
       and (
         $2::text = 'custom'
         or ($2::text = 'raid' and m.mount_category = 'Raid')
         or ($2::text = 'trial' and m.mount_category = 'Trial')
         or ($2::text = 'dungeon' and m.mount_category in ('Dungeon', 'Dungeon / Criterion', 'Variant / Criterion'))
       )
       and source_duty.level is not null
       and (
         $3::int is null
         or source_duty.level >= $3::int
       )
       and (
         $4::int is null
         or source_duty.level <= $4::int
       )
       and not coalesce(cm.owned, false)
     group by m.id, m.mount_name, m.source_name, source_duty.level
     order by source_duty.level asc, count(*) desc, lower(m.mount_name) asc
     limit 5;`,
    [eventId, event.event_type, eventLevel, eventLevelMax]
  );
  return {
    targetMount: null,
    partyStrategy: event.party_strategy || "rotation",
    partySize: Number(event.party_size || 8),
    standardPartyRolesRequired: event.standard_party_roles_required !== false,
    checkInRequired: event.check_in_required === true,
    rosterLocked: Boolean(event.roster_locked),
    eventStatus: event.event_status,
    eventStartsAt: event.event_starts_at,
    eventEndsAt: event.event_ends_at,
    suggestions: suggestionResult.rows.map((row) => ({
      id: Number(row.mount_id),
      name: row.mount_name,
      sourceName: row.source_name,
      needCount: Number(row.need_count)
    }))
  };
}

function buildScheduledPostEmbed(post, eventRoster = null, mountInsights = null) {
  const isStructuredEventPost = eventRoster !== null || post.post_type === "raid" || post.post_type === "mount_farm";
  const description = mountInsights?.eventStartsAt
    ? String(post.message || "No message provided.").replace(
        /^\*\*Event Time:\*\*.*$/m,
        `**Event Time:** ${formatDiscordEventTime(mountInsights.eventStartsAt)}`
      )
    : post.message || "No message provided.";
  const embed = new EmbedBuilder()
    .setTitle(post.title || "Scheduled Discord Post")
    .setDescription(description)
    .setColor(0x8b5cf6)
    .setTimestamp(new Date());

  if (!isStructuredEventPost) {
    embed.addFields(
      { name: "Type", value: getScheduledPostTypeLabel(post.post_type), inline: true },
      {
        name: "Post At",
        value: post.scheduled_for
          ? new Date(post.scheduled_for).toLocaleString("en-US", {
              timeZone: "America/Chicago",
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit"
            })
          : "Unknown",
        inline: true
      }
    );
  }

  if (eventRoster) {
    if (post.created_by) {
      embed.addFields({
        name: "Organized by",
        value: String(post.created_by).slice(0, 1024),
        inline: true
      });
    }
    const going = eventRoster.filter((signup) => signup.signup_status === "going");
    const maybe = eventRoster.filter((signup) => signup.signup_status === "maybe");
    const cantAttend = eventRoster.filter((signup) => signup.signup_status === "cant_attend");
    const eventStartsAt = mountInsights?.eventStartsAt ? new Date(mountInsights.eventStartsAt).getTime() : null;
    const eventEndsAt = mountInsights?.eventEndsAt
      ? new Date(mountInsights.eventEndsAt).getTime()
      : eventStartsAt === null ? null : eventStartsAt + DEFAULT_EVENT_DURATION_HOURS * 60 * 60 * 1000;
    const checkInRequired = mountInsights?.checkInRequired === true;
    const attendanceStarted = checkInRequired && eventStartsAt !== null && Date.now() >= eventStartsAt;
    const attendanceRelevant = checkInRequired && eventStartsAt !== null && Date.now() >= eventStartsAt - EVENT_CHECK_IN_LEAD_MINUTES * 60 * 1000;
    const checkedIn = going.filter((signup) => CHECKED_IN_ATTENDANCE_STATUSES.has(signup.attendance_status));
    const late = going.filter((signup) => signup.attendance_status === "late");
    const left = going.filter((signup) => signup.attendance_status === "left");
    const noShow = going.filter((signup) => signup.attendance_status === "no_show");
    const awaitingCheckIn = going.filter((signup) => signup.attendance_status === "not_checked_in");
    const rosterEligibleGoing = attendanceStarted ? checkedIn : going;
    const active = rosterEligibleGoing.filter((signup) => signup.roster_state === "active");
    const waiting = rosterEligibleGoing.filter((signup) => signup.roster_state === "waiting");
    const completed = going.filter((signup) => signup.roster_state === "completed");
    const strategyLabel = mountInsights?.partyStrategy === "split" ? "Split Teams" : "Rotation / Overflow";
    const partySize = Number(mountInsights?.partySize || 8);
    const standardPartyRolesRequired = mountInsights?.standardPartyRolesRequired !== false;

    embed.addFields(
      {
        name: `Roster Plan - ${strategyLabel}`,
        value: `${going.length} Going${checkInRequired ? ` - ${checkedIn.length} Checked In` : ""} - ${active.length} Active - ${waiting.length} Next Up - ${completed.length} Completed\nParty size: ${partySize} - ${standardPartyRolesRequired ? "standard roles required" : "flexible composition"}${checkInRequired ? " - check-in required" : ""}${mountInsights?.rosterLocked ? " - RSVPs locked" : ""}`,
        inline: false
      },
      { name: `Maybe (${maybe.length})`, value: formatEventRosterField(maybe), inline: true },
      { name: `Can't Attend (${cantAttend.length})`, value: formatEventRosterField(cantAttend), inline: true }
    );
    if (checkInRequired && (attendanceRelevant || mountInsights?.eventStatus !== "planned")) {
      embed.addFields({
        name: `Live Attendance (${checkedIn.length} checked in)`,
        value: `${Math.max(0, checkedIn.length - late.length)} present - ${late.length} late - ${left.length} left - ${noShow.length} no-show - ${awaitingCheckIn.length} awaiting check-in${eventEndsAt && Date.now() > eventEndsAt ? "\nEvent attendance closed." : ""}`,
        inline: false
      });
    }

    embed.addFields(...buildDiscordPartyFields(eventRoster, partySize, standardPartyRolesRequired, attendanceStarted));

    if (waiting.length > 0) {
      embed.addFields({
        name: `Next Up (${waiting.length})`,
        value: waiting.map((signup, index) => `${index + 1}. ${signup.character_name} - ${getEventRoleLabel(signup.role_preference)}`).join("\n").slice(0, 1024),
        inline: false
      });
    }
    if (completed.length > 0) {
      embed.addFields({
        name: `Completed (${completed.length})`,
        value: completed.map((signup) => `${signup.character_name}${mountInsights?.targetMount ? " - mount received" : ""}`).join("\n").slice(0, 1024),
        inline: false
      });
    }

    if (mountInsights?.targetMount) {
      const eligibleGoing = rosterEligibleGoing.filter((signup) => signup.roster_state !== "completed");
      const goingNeedsMount = eligibleGoing.filter((signup) => signup.needs_target_mount === true);
      const maybeNeedsMount = maybe.filter((signup) => signup.needs_target_mount === true);
      const needLines = goingNeedsMount.length > 0
        ? goingNeedsMount.map((signup) => signup.character_name).join("\n")
        : eligibleGoing.length > 0
          ? "Everyone still in the roster already owns it."
          : "No confirmed participants still need it.";
      embed.addFields({
        name: `${mountInsights.targetMount.name}: ${goingNeedsMount.length} need${maybeNeedsMount.length > 0 ? ` (+${maybeNeedsMount.length} maybe)` : ""}`,
        value: needLines.slice(0, 1024),
        inline: false
      });
    } else if (mountInsights?.suggestions?.length > 0) {
      embed.addFields({
        name: "Most Needed Mounts",
        value: mountInsights.suggestions
          .map((suggestion, index) => `${index + 1}. ${suggestion.name} - ${suggestion.needCount} need`)
          .join("\n")
          .slice(0, 1024),
        inline: false
      });
    }
  }
  if (post.embed_image_url && /^https?:\/\//i.test(String(post.embed_image_url))) {
    embed.setImage(String(post.embed_image_url));
  }
  if (post.thumbnail_image_url && /^https?:\/\//i.test(String(post.thumbnail_image_url))) {
    embed.setThumbnail(String(post.thumbnail_image_url));
  }
  embed.setFooter({ text: "FFXIV materials in event content © SQUARE ENIX" });
  return embed;
}

async function refreshDiscordEventMessage(eventId, guild) {
  const announcement = await getDiscordEventAnnouncement(eventId);
  if (!announcement) throw new Error("Event announcement record was not found.");
  if (!announcement.sent_message_id) return "Skipped: event announcement has not been sent yet.";

  const settings = await getBotSettings();
  const channelId = getScheduledPostChannelId(announcement, settings);
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || !channel.messages) {
    throw new Error("Event announcement channel could not be found or edited.");
  }

  const message = await channel.messages.fetch(announcement.sent_message_id).catch(() => null);
  if (!message) throw new Error("Original event announcement message could not be found.");

  const [roster, mountInsights] = await Promise.all([
    getDiscordEventRoster(eventId),
    getDiscordEventMountInsights(eventId)
  ]);
  const components = announcement.event_status === "planned"
    ? buildEventRsvpComponents(eventId, Boolean(mountInsights?.targetMount), {
        rsvpOpen: !announcement.roster_locked,
        checkInOpen: isDiscordEventCheckInOpen(announcement),
        completionOpen: new Date(announcement.event_starts_at).getTime() <= Date.now()
      })
    : [];
  await message.edit({ embeds: [buildScheduledPostEmbed(announcement, roster, mountInsights)], components });
  return `Updated Discord event post and roster for event ${eventId}.`;
}

async function refreshActiveDiscordEventMessages(guild) {
  const result = await pool.query(
    `select e.id::int
     from portal_discord_events e
     join portal_discord_scheduled_posts p on p.id = e.announcement_scheduled_post_id
     where e.status = 'planned' and p.status = 'sent' and p.sent_message_id is not null
     order by e.event_starts_at asc
     limit 50;`
  );
  for (const row of result.rows) {
    try {
      await refreshDiscordEventMessage(Number(row.id), guild);
    } catch (error) {
      console.error(`[cotf-bot] Failed to refresh event ${row.id} on startup:`, error);
    }
  }
}
async function getEventReminderMentionUserIds(eventId, scheduledPostId) {
  try {
    const finalReminderResult = await pool.query(
      `select not exists (
         select 1
         from portal_discord_scheduled_posts later
         join portal_discord_scheduled_posts current on current.id = $1
         where later.event_id = $2
           and later.post_type = 'event_reminder'
           and later.status in ('scheduled', 'processing')
           and later.scheduled_for > current.scheduled_for
       ) as is_final;`,
      [scheduledPostId, eventId]
    );
    const isFinalReminder = finalReminderResult.rows[0]?.is_final === true;
    const result = await pool.query(
      `select distinct coalesce(dl.discord_user_id,acl.discord_user_id) as discord_user_id
       from portal_discord_event_signups s
       left join portal_discord_links dl on dl.character_id = s.character_id
       left join portal_alt_character_links acl on acl.character_id=s.character_id and acl.active=true
       left join portal_discord_links anchor_dl on anchor_dl.discord_user_id=acl.discord_user_id
       left join portal_characters anchor on anchor.id=anchor_dl.character_id
       left join portal_member_preferences p on p.discord_user_id = coalesce(dl.discord_user_id,acl.discord_user_id)
       where s.event_id = $1
         and s.signup_status = 'going'
         and (dl.discord_user_id is not null or (anchor.active=true and anchor.fc_membership_status='current'))
         and coalesce(
           p.event_reminder_level,
           case when coalesce(p.event_reminder_mentions_enabled, true) then 'all' else 'none' end
         ) <> 'none'
         and (
           coalesce(p.event_reminder_level, 'all') = 'all'
           or (coalesce(p.event_reminder_level, 'all') = 'final' and $2::boolean = true)
         )
       order by coalesce(dl.discord_user_id,acl.discord_user_id)
       limit 50;`,
      [eventId, isFinalReminder]
    );
    return result.rows
      .map((row) => String(row.discord_user_id || '').trim())
      .filter((discordUserId) => /^\d{5,}$/.test(discordUserId));
  } catch (error) {
    console.error(`[cotf-bot] Could not load event reminder mention preferences for event ${eventId}:`, error);
    return [];
  }
}

async function sendDiscordScheduledPost(post, settings, guild) {
  const channelId = getScheduledPostChannelId(post, settings);
  if (!channelId) throw new Error(`No Discord channel ID is configured for ${post.target_channel_kind}.`);

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    throw new Error("Configured Discord channel could not be found or is not text-based.");
  }

  if (post.post_type === "event_plan" && post.event_plan_id) {
    const sentMessage = await channel.send(await buildEventPlanDiscordPayload(pool, Number(post.event_plan_id)));
    await pool.query(`update portal_event_plans set discord_channel_id=$2,discord_message_id=$3,synced_at=now(),updated_at=now() where id=$1`,[Number(post.event_plan_id),channel.id,sentMessage.id]);
    return sentMessage.id;
  }

  const event = await getDiscordEventAnnouncementByPostId(post.id);
  const [roster, mountInsights] = event
    ? await Promise.all([
        getDiscordEventRoster(event.event_id),
        getDiscordEventMountInsights(event.event_id)
      ])
    : [null, null];

  let postForEmbed = post;
  if (event && post.post_type === "event_reminder") {
    const announcement = await getDiscordEventAnnouncement(event.event_id);
    if (announcement?.sent_message_id) {
      const eventLink = `https://discord.com/channels/${guild.id}/${channelId}/${announcement.sent_message_id}`;
      postForEmbed = {
        ...post,
        message: `${post.message || ""}\n\n[Open the live RSVP post](${eventLink})`
      };
    }
  }

  const components = event && event.event_status === "planned" && post.post_type !== "event_reminder"
    ? buildEventRsvpComponents(event.event_id, Boolean(mountInsights?.targetMount), {
        rsvpOpen: !event.roster_locked,
        checkInOpen: isDiscordEventCheckInOpen(event),
        completionOpen: new Date(event.event_starts_at).getTime() <= Date.now()
      })
    : [];
  const reminderMentionUserIds = event && post.post_type === "event_reminder"
    ? await getEventReminderMentionUserIds(event.event_id, post.id)
    : [];
  const sentMessage = await channel.send({
    content: reminderMentionUserIds.length
      ? reminderMentionUserIds.map((discordUserId) => `<@${discordUserId}>`).join(" ")
      : undefined,
    allowedMentions: reminderMentionUserIds.length ? { users: reminderMentionUserIds } : undefined,
    embeds: [buildScheduledPostEmbed(postForEmbed, roster, mountInsights)],
    components
  });
  return sentMessage?.id || null;
}
async function processDueDiscordScheduledPosts() {
  await resetStaleDiscordScheduledPosts();

  const settings = await getBotSettings();
  if (!isAutomatedNotificationWindowOpen(settings)) return;

  const guildId = settings.guild_id || DISCORD_GUILD_ID;

  if (!guildId) {
    console.error("[cotf-bot] Cannot process scheduled posts: no guild/server ID is configured.");
    return;
  }

  const guild = await bot.guilds.fetch(guildId);

  for (let i = 0; i < 5; i += 1) {
    const post = await pickNextDiscordScheduledPost();

    if (!post) {
      break;
    }

    try {
      const sentMessageId = await sendDiscordScheduledPost(post, settings, guild);
      await completeDiscordScheduledPost(post.id, sentMessageId);

      console.log(`[cotf-bot] Sent scheduled Discord post ${post.id}: ${post.title}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await failDiscordScheduledPost(post.id, message);

      console.error(`[cotf-bot] Failed scheduled Discord post ${post.id}:`, error);
    }
  }
}

async function ensureDiscordEventLifecycleColumns() {
  await pool.query(`
    alter table portal_discord_events
      add column if not exists expired_at timestamptz,
      add column if not exists archived_at timestamptz,
      add column if not exists archived_by text,
      add column if not exists level_max integer,
      add column if not exists event_time_zone text not null default 'America/Chicago',
      add column if not exists party_strategy text not null default 'rotation',
      add column if not exists party_size integer not null default 8,
      add column if not exists standard_party_roles_required boolean not null default true,
      add column if not exists check_in_required boolean not null default false,
      add column if not exists roster_locked boolean not null default false,
      add column if not exists check_in_opened_at timestamptz,
      add column if not exists attendance_started_at timestamptz,
      add column if not exists series_id bigint,
      add column if not exists series_occurrence_number integer,
      add column if not exists reminder_24h_enabled boolean not null default true,
      add column if not exists reminder_1h_enabled boolean not null default true;
  `);
  await pool.query(`
    alter table portal_discord_event_signups
      add column if not exists roster_state text not null default 'active',
      add column if not exists party_number integer,
      add column if not exists completed_at timestamptz,
      add column if not exists completed_by text,
      add column if not exists attendance_status text not null default 'not_checked_in',
      add column if not exists checked_in_at timestamptz,
      add column if not exists attendance_updated_at timestamptz,
      add column if not exists attendance_updated_by text;
  `);
  await pool.query(`create index if not exists portal_discord_event_signups_attendance_idx on portal_discord_event_signups (event_id, attendance_status, attendance_updated_at);`);
}

async function ensureDiscordRecurringEventTables() {
  await pool.query(`
    create table if not exists portal_discord_event_templates (
      id bigserial primary key, name text not null unique, event_type text not null default 'custom',
      title text not null default '', description text not null default '', level integer,
      duty_id bigint, duty_name text, duty_image_url text, mount_id bigint, mount_name text,
      mount_source_name text, embed_image_url text, thumbnail_image_url text,
      target_channel_kind text not null default 'event', target_channel_id text not null default '',
      party_strategy text not null default 'rotation', party_size integer not null default 8,
      standard_party_roles_required boolean not null default true,
      check_in_required boolean not null default false,
      reminder_24h_enabled boolean not null default true, reminder_1h_enabled boolean not null default true,
      announcement_lead_minutes integer not null default 10080, created_by text,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
  `);
  await pool.query(`
    create table if not exists portal_discord_event_series (
      id bigserial primary key, template_id bigint, series_name text not null,
      event_type text not null default 'custom', title text not null default '',
      description text not null default '', level integer, duty_id bigint, duty_name text,
      duty_image_url text, mount_id bigint, mount_name text, mount_source_name text,
      embed_image_url text, thumbnail_image_url text, target_channel_kind text not null default 'event',
      target_channel_id text not null default '', party_strategy text not null default 'rotation',
      party_size integer not null default 8, standard_party_roles_required boolean not null default true,
      check_in_required boolean not null default false,
      reminder_24h_enabled boolean not null default true,
      reminder_1h_enabled boolean not null default true, announcement_lead_minutes integer not null default 10080,
      recurrence_kind text not null default 'weekly', next_occurrence_at timestamptz not null,
      next_occurrence_number integer not null default 1, end_at timestamptz,
      occurrences_ahead integer not null default 4, active boolean not null default true,
      generated_count integer not null default 0, last_generated_at timestamptz,
      created_by text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      paused_at timestamptz, paused_by text, ended_at timestamptz, ended_by text
    );
  `);
  await pool.query(`alter table portal_discord_event_templates add column if not exists standard_party_roles_required boolean not null default true;`);
  await pool.query(`alter table portal_discord_event_templates add column if not exists check_in_required boolean not null default false;`);
  await pool.query(`alter table portal_discord_event_series add column if not exists standard_party_roles_required boolean not null default true;`);
  await pool.query(`alter table portal_discord_event_series add column if not exists check_in_required boolean not null default false;`);
  await pool.query(`create index if not exists portal_discord_event_series_active_next_idx on portal_discord_event_series (active, next_occurrence_at);`);
  await pool.query(`create unique index if not exists portal_discord_events_series_occurrence_idx on portal_discord_events (series_id, event_starts_at) where series_id is not null;`);
}

let discordEventSchemaReady = false;
let discordEventSchemaRetryTimer = null;

async function initializeDiscordEventSchema() {
  if (discordEventSchemaReady) return true;
  try {
    const baseTables = await pool.query(`
      select
        to_regclass('public.portal_discord_events') as events,
        to_regclass('public.portal_discord_event_signups') as signups;
    `);
    if (!baseTables.rows[0]?.events || !baseTables.rows[0]?.signups) {
      throw new Error("The portal event tables have not been created yet.");
    }
    await ensureDiscordEventLifecycleColumns();
    await ensureDiscordRecurringEventTables();
    await maintainRecurringEventSeries();
    await rebalanceActiveDiscordEventRosters();
    discordEventSchemaReady = true;
    console.log("[cotf-bot] Discord event schema is ready.");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[cotf-bot] Discord event features are waiting for the portal schema: ${message}`);
    return false;
  }
}

function scheduleDiscordEventSchemaRetry() {
  if (discordEventSchemaReady || discordEventSchemaRetryTimer) return;
  discordEventSchemaRetryTimer = setTimeout(async () => {
    discordEventSchemaRetryTimer = null;
    if (await initializeDiscordEventSchema()) await ensureEventDraftTable(pool);
    else scheduleDiscordEventSchemaRetry();
  }, 30000);
}

function formatRecurringEventDateTime(value) {
  return new Date(value).toLocaleString("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit"
  });
}

function formatDiscordEventTime(value) {
  return `<t:${Math.floor(new Date(value).getTime() / 1000)}:F>`;
}

async function insertBotRecurringOccurrence(client, series, startsAt) {
  const leadMinutes = Math.max(0, Number(series.announcement_lead_minutes ?? 10080));
  const requestedAnnouncementAt = leadMinutes === 0
    ? new Date(Date.now() + 60000)
    : new Date(startsAt.getTime() - leadMinutes * 60000);
  const announcementPostAt = new Date(Math.max(Date.now() + 60000, requestedAnnouncementAt.getTime()));
  const eventResult = await client.query(
    `insert into portal_discord_events (
       event_type,title,description,level,duty_id,duty_name,duty_image_url,
       target_channel_kind,target_channel_id,event_starts_at,announcement_post_at,
       party_strategy,party_size,standard_party_roles_required,check_in_required,series_id,series_occurrence_number,
       reminder_24h_enabled,reminder_1h_enabled,status,created_by,created_at,updated_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'planned',$20,now(),now())
     on conflict (series_id,event_starts_at) where series_id is not null do nothing returning id::int;`,
    [series.event_type,series.title,series.description || "",series.level,series.duty_id,
     series.duty_name,series.duty_image_url,series.target_channel_kind,series.target_channel_id,
     startsAt.toISOString(),announcementPostAt.toISOString(),series.party_strategy,
     Number(series.party_size || 8),series.standard_party_roles_required !== false,series.check_in_required === true,
     Number(series.id),Number(series.next_occurrence_number || 1),
     Boolean(series.reminder_24h_enabled),Boolean(series.reminder_1h_enabled),
     series.created_by || "Recurring event series"]
  );
  if (eventResult.rows.length === 0) return null;
  const eventId = Number(eventResult.rows[0].id);
  if (series.mount_id) {
    await client.query(`insert into portal_discord_event_mounts (event_id,mount_id,sort_order) values ($1,$2,10) on conflict do nothing;`, [eventId, Number(series.mount_id)]);
  }
  const typeLabel = series.event_type === "mount_farm" ? "Mount Farm" : series.event_type === "raid" ? "Raid" : "Event";
  const lines = [
    `**Type:** ${typeLabel}`, `**Series:** ${series.series_name}`,
    `**Event Time:** ${formatDiscordEventTime(startsAt)}`,
    `**Party Plan:** ${series.party_strategy === "split" ? "Split Teams" : "Rotation"} - ${Number(series.party_size || 8)} per party - ${series.standard_party_roles_required === false ? "flexible composition" : "standard roles required"}`,
    series.check_in_required === true ? `**Check-in:** Required - opens 1 hour before the event` : "",
    series.level ? `**Level:** ${series.level}` : "",
    series.duty_name ? `**Duty / Raid:** ${series.duty_name}` : "",
    series.mount_name ? `**Mount Target:** ${series.mount_name}` : "",
    series.mount_source_name ? `**Source:** ${series.mount_source_name}` : "",
    series.description ? `**Notes:**\n${series.description}` : ""
  ].filter(Boolean);
  const postResult = await client.query(
    `insert into portal_discord_scheduled_posts (
       post_type,title,message,embed_image_url,thumbnail_image_url,target_channel_kind,
       target_channel_id,scheduled_for,status,created_by,event_id,reminder_offset_minutes,created_at,updated_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,'scheduled',$9,$10,null,now(),now()) returning id::int;`,
    [series.event_type,series.title,lines.join("\n"),series.embed_image_url,series.thumbnail_image_url,
     series.target_channel_kind,series.target_channel_id,announcementPostAt.toISOString(),
     series.created_by || "Recurring event series",eventId]
  );
  await client.query(`update portal_discord_events set announcement_scheduled_post_id=$2 where id=$1;`, [eventId, Number(postResult.rows[0].id)]);
  for (const reminder of [{enabled:series.reminder_24h_enabled,offset:1440,label:"24-hour"},{enabled:series.reminder_1h_enabled,offset:60,label:"1-hour"}]) {
    if (!reminder.enabled) continue;
    const scheduledFor = new Date(startsAt.getTime() - reminder.offset * 60000);
    if (scheduledFor <= announcementPostAt || scheduledFor.getTime() <= Date.now()) continue;
    await client.query(
      `insert into portal_discord_scheduled_posts (
         post_type,title,message,embed_image_url,thumbnail_image_url,target_channel_kind,target_channel_id,
         scheduled_for,status,created_by,event_id,reminder_offset_minutes,created_at,updated_at
       ) values ('event_reminder',$1,$2,$3,$4,$5,$6,$7,'scheduled',$8,$9,$10,now(),now());`,
      [`${reminder.label} reminder: ${series.title}`,
       [`**Reminder:** This event starts in ${reminder.label.replace("-"," ")}.`,...lines].join("\n"),
       series.embed_image_url,series.thumbnail_image_url,series.target_channel_kind,
       series.target_channel_id,scheduledFor.toISOString(),series.created_by || "Recurring event series",eventId,reminder.offset]
    );
  }
  return eventId;
}

async function advanceBotRecurringSeries(client, seriesId, generated) {
  const result = await client.query(
    `update portal_discord_event_series set
       next_occurrence_at=case recurrence_kind
         when 'weekly' then ((next_occurrence_at at time zone 'America/Chicago')+interval '7 days') at time zone 'America/Chicago'
         when 'biweekly' then ((next_occurrence_at at time zone 'America/Chicago')+interval '14 days') at time zone 'America/Chicago'
         when 'monthly' then ((next_occurrence_at at time zone 'America/Chicago')+interval '1 month') at time zone 'America/Chicago'
         else ((next_occurrence_at at time zone 'America/Chicago')+interval '7 days') at time zone 'America/Chicago' end,
       next_occurrence_number=next_occurrence_number+1,
       generated_count=generated_count+case when $2 then 1 else 0 end,
       last_generated_at=case when $2 then now() else last_generated_at end,updated_at=now()
     where id=$1 returning *;`, [seriesId, generated]
  );
  return result.rows[0] || null;
}

async function maintainRecurringEventSeries() {
  const client = await pool.connect();
  let generatedTotal = 0;
  try {
    await client.query("begin");
    const result = await client.query(`select * from portal_discord_event_series where active=true order by id asc for update;`);
    for (const initial of result.rows) {
      let series = initial;
      const countResult = await client.query(`select count(*)::int as count from portal_discord_events where series_id=$1 and event_starts_at>=now();`, [series.id]);
      let futureCount = Number(countResult.rows[0]?.count || 0);
      let safety = 0;
      while (futureCount < Number(series.occurrences_ahead || 4) && safety < 24) {
        safety += 1;
        const startsAt = new Date(series.next_occurrence_at);
        if (series.end_at && startsAt > new Date(series.end_at)) {
          await client.query(`update portal_discord_event_series set active=false,ended_at=coalesce(ended_at,now()),ended_by=coalesce(ended_by,'Series end date'),updated_at=now() where id=$1;`, [series.id]);
          break;
        }
        if (startsAt.getTime() < Date.now() - 21600000) {
          series = await advanceBotRecurringSeries(client, Number(series.id), false);
          if (!series) break;
          continue;
        }
        const eventId = await insertBotRecurringOccurrence(client, series, startsAt);
        series = await advanceBotRecurringSeries(client, Number(series.id), Boolean(eventId));
        if (eventId) { futureCount += 1; generatedTotal += 1; }
        if (!series) break;
      }
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  if (generatedTotal > 0) console.log(`[cotf-bot] Generated ${generatedTotal} recurring event occurrence(s).`);
}
async function maintainDiscordEventLifecycle() {
  const checkInResult = await pool.query(`
    update portal_discord_events
    set check_in_opened_at = now(), updated_at = now()
    where status = 'planned' and check_in_required = true and check_in_opened_at is null
      and event_starts_at <= now() + interval '60 minutes'
      and coalesce(event_ends_at, event_starts_at + interval '6 hours') > now()
    returning id::int;
  `);

  const attendanceStartResult = await pool.query(`
    update portal_discord_events
    set attendance_started_at = now(), updated_at = now()
    where status = 'planned' and check_in_required = true and attendance_started_at is null
      and event_starts_at <= now()
      and coalesce(event_ends_at, event_starts_at + interval '6 hours') > now()
    returning id::int;
  `);
  for (const row of attendanceStartResult.rows) {
    await rebalanceDiscordEventRoster(Number(row.id));
  }
  const expiredResult = await pool.query(`
    update portal_discord_events
    set status = 'expired', expired_at = coalesce(expired_at, now()), updated_at = now()
    where status = 'planned'
      and coalesce(event_ends_at, event_starts_at + interval '6 hours') <= now()
    returning id::int;
  `);

  if (expiredResult.rows.length > 0) {
    await pool.query(
      `update portal_discord_event_signups
       set attendance_status = 'no_show', attendance_updated_at = now(),
           attendance_updated_by = 'Automatic event lifecycle', updated_at = now()
       where event_id = any($1::bigint[]) and signup_status = 'going'
         and attendance_status = 'not_checked_in'
         and exists (
           select 1 from portal_discord_events e where e.id = portal_discord_event_signups.event_id and e.check_in_required = true
         );`,
      [expiredResult.rows.map((row) => Number(row.id))]
    );
  }
  const archivedResult = await pool.query(`
    update portal_discord_events
    set status = 'archived', archived_at = coalesce(archived_at, now()),
        archived_by = coalesce(archived_by, 'Automatic 3-day cleanup'), updated_at = now()
    where status in ('cancelled', 'expired')
      and coalesce(cancelled_at, expired_at, updated_at) <= now() - interval '3 days'
    returning id::int;
  `);

  const cancelledPostResult = await pool.query(`
    update portal_discord_scheduled_posts p
    set status = 'cancelled', cancelled_at = coalesce(p.cancelled_at, now()),
        cancelled_by = coalesce(p.cancelled_by, 'Automatic event lifecycle'), updated_at = now()
    from portal_discord_events e
    where p.event_id = e.id
      and p.status = 'scheduled'
      and e.status in ('cancelled', 'expired', 'archived')
    returning p.id;
  `);

  if (cancelledPostResult.rows.length > 0) {
    console.log(`[cotf-bot] Cancelled ${cancelledPostResult.rows.length} unsent event announcement/reminder(s).`);
  }

  const changedEventIds = [...new Set([
    ...checkInResult.rows.map((row) => Number(row.id)),
    ...attendanceStartResult.rows.map((row) => Number(row.id)),
    ...expiredResult.rows.map((row) => Number(row.id)),
    ...archivedResult.rows.map((row) => Number(row.id))
  ])];
  if (changedEventIds.length === 0) return;

  const settings = await getBotSettings();
  const guild = await bot.guilds.fetch(settings.guild_id || DISCORD_GUILD_ID);
  for (const eventId of changedEventIds) {
    try {
      await refreshDiscordEventMessage(eventId, guild);
    } catch (error) {
      console.error(`[cotf-bot] Failed to refresh lifecycle state for event ${eventId}:`, error);
    }
  }

  if (checkInResult.rows.length > 0) {
    console.log(`[cotf-bot] Opened check-in for ${checkInResult.rows.length} event(s).`);
  }
  if (attendanceStartResult.rows.length > 0) {
    console.log(`[cotf-bot] Switched ${attendanceStartResult.rows.length} event roster(s) to checked-in participants.`);
  }
  if (expiredResult.rows.length > 0) {
    console.log(`[cotf-bot] Marked ${expiredResult.rows.length} event(s) expired.`);
  }
  if (archivedResult.rows.length > 0) {
    console.log(`[cotf-bot] Archived ${archivedResult.rows.length} event(s) after the 3-day retention period.`);
  }
}
function notificationTimeToMinutes(value, fallback) {
  const match = String(value || fallback).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback === "22:00" ? 1320 : 480;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
    ? hours * 60 + minutes
    : (fallback === "22:00" ? 1320 : 480);
}

function isAutomatedNotificationWindowOpen(settings, now = new Date()) {
  if (!settings.notification_window_enabled) return true;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  const current = hour * 60 + minute;
  const start = notificationTimeToMinutes(settings.notification_window_start_time, "08:00");
  const end = notificationTimeToMinutes(settings.notification_window_end_time, "22:00");

  // Equal times intentionally mean a full-day window. A window may also span midnight.
  if (start === end) return true;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

async function processPendingCharacterRenameNotifications() {
  const settings = await getBotSettings();
  const channelId = settings.member_rename_notification_channel_id;

  // Never notify for a record that is no longer an active, current FC member,
  // or for a no-op name change. This also clears old invalid queue entries.
  await pool.query(`
    update portal_character_rename_history h
    set notification_status = 'suppressed', confirmation_status = 'not_applicable'
    from portal_characters c
    where h.character_id = c.id
      and h.notification_status = 'pending'
      and (
        c.active is not true
        or c.fc_membership_status <> 'current'
        or lower(trim(h.old_name)) = lower(trim(h.new_name))
      );
  `);

  if (!channelId || !isAutomatedNotificationWindowOpen(settings)) return;

  const pending = await pool.query(`
    select h.id, h.old_name, h.new_name, c.portrait_url, c.avatar_url, dl.discord_user_id
    from portal_character_rename_history h
    join portal_characters c on c.id = h.character_id
    left join portal_discord_links dl on dl.character_id = c.id
    where h.notification_status = 'pending'
      and c.active = true
      and c.fc_membership_status = 'current'
      and lower(trim(h.old_name)) <> lower(trim(h.new_name))
    order by h.detected_at asc
    limit 10;
  `);
  if (!pending.rows.length) return;

  const channel = await bot.channels.fetch(channelId).catch(() => null);
  const guild = await bot.guilds.fetch(settings.guild_id || DISCORD_GUILD_ID).catch(() => null);
  if (!channel || !channel.isTextBased() || !guild) return;

  for (const rename of pending.rows) {
    const member = rename.discord_user_id
      ? await guild.members.fetch(rename.discord_user_id).catch(() => null)
      : null;
    const hasActiveDiscordMember = Boolean(member);
    const notificationsEnabled = hasActiveDiscordMember
      ? settings.rename_notifications_discord_members_enabled
      : settings.rename_notifications_non_discord_members_enabled;

    if (!notificationsEnabled) {
      await pool.query(
        `update portal_character_rename_history
         set notification_status = 'suppressed', confirmation_status = 'not_applicable'
         where id = $1;`,
        [rename.id]
      );
      continue;
    }

    const image = rename.portrait_url || rename.avatar_url || undefined;
    const content = hasActiveDiscordMember
      ? `<@${rename.discord_user_id}> \u2014 we noticed that your character name changed from **${rename.old_name}** to **${rename.new_name}**. Would you like us to update your Discord nickname?`
      : `**${rename.old_name}** has changed their character name to **${rename.new_name}**.`;
    const payload = {
      content,
      embeds: image ? [new EmbedBuilder().setImage(image).setFooter({ text: "FFXIV materials © SQUARE ENIX" })] : [],
      components: hasActiveDiscordMember
        ? [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`cotf_rename_yes:${rename.id}`).setLabel("Yes, update my name").setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId(`cotf_rename_later:${rename.id}`).setLabel("Not now").setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId(`cotf_rename_not_me:${rename.id}`).setLabel("This isn't me").setStyle(ButtonStyle.Danger)
            )
          ]
        : []
    };

    try {
      const message = await channel.send(payload);
      await pool.query(
        `update portal_character_rename_history
         set notification_status = 'sent',
             notification_message_id = $2,
             confirmation_status = case when $3 then confirmation_status else 'not_applicable' end
         where id = $1;`,
        [rename.id, message.id, hasActiveDiscordMember]
      );
    } catch (error) {
      console.error("[cotf-bot] Rename notification failed:", error.message);
    }
  }
}
function limitMountWinText(value, maxLength = 1000) {
  const text = String(value || "").trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`;
}

async function markMountWinDelivery(acquisitionIds, error = null) {
  if (!acquisitionIds.length) return;
  await pool.query(
    `
      update portal_mount_acquisitions
      set discord_sent_at = now(), discord_error = $2
      where id = any($1::bigint[]);
    `,
    [acquisitionIds, error]
  );
}

async function latestCompletedMountOwnershipScan() {
  const result = await pool.query(`
    select status, finished_at
    from portal_sync_runs
    where sync_type = 'mount-ownership-sync'
    order by started_at desc, id desc
    limit 1;
  `);
  const run = result.rows[0];
  if (!run || run.status !== "success" || !run.finished_at) return null;
  return run.finished_at;
}

async function processPendingMountWinNotifications() {
  const settings = await getBotSettings();
  if (!settings.mount_win_announcements_enabled) {
    await pool.query(`
      update portal_mount_acquisitions
      set
        discord_sent_at = now(),
        discord_error = 'Skipped: mount-win announcements are disabled for this Discord server.'
      where discord_sent_at is null;
    `);
    return;
  }
  const completedScanAt = await latestCompletedMountOwnershipScan();
  if (!completedScanAt) return;
  if (!settings.mount_win_channel_id || !isAutomatedNotificationWindowOpen(settings)) return;

  await pool.query(`
    update portal_mount_acquisitions a
    set
      discord_sent_at = now(),
      discord_error = 'Skipped: character has no eligible Discord link or mount-win notifications are disabled.'
    where a.discord_sent_at is null
      and a.detected_at <= $1
      and not exists (
        select 1
        from portal_characters c
        left join portal_discord_links dl on dl.character_id = c.id
        left join portal_alt_character_links acl on acl.character_id = c.id and acl.active = true
        left join portal_discord_links anchor_dl on anchor_dl.discord_user_id = acl.discord_user_id
        left join portal_characters anchor on anchor.id = anchor_dl.character_id
        where c.id = a.character_id
          and c.active = true
          and c.mount_win_notifications_enabled = true
          and (
            (dl.discord_user_id is not null and c.fc_membership_status = 'current')
            or
            (acl.discord_user_id is not null and anchor.active = true and anchor.fc_membership_status = 'current')
          )
      );
  `, [completedScanAt]);

  const result = await pool.query(`
    select
      a.id::int,
      a.character_id::int,
      a.mount_id::int,
      coalesce(m.mount_name, a.mount_name) as mount_name,
      coalesce(c.display_name, a.character_name) as character_name,
      coalesce(dl.discord_user_id, acl.discord_user_id) as discord_user_id,
      m.source_name,
      m.image_url,
      m.icon_url,
      ms.name as set_name,
      ms.expansion
    from portal_mount_acquisitions a
    join portal_characters c on c.id = a.character_id
    left join portal_discord_links dl on dl.character_id = c.id
    left join portal_alt_character_links acl on acl.character_id = c.id and acl.active = true
    left join portal_discord_links anchor_dl on anchor_dl.discord_user_id = acl.discord_user_id
    left join portal_characters anchor on anchor.id = anchor_dl.character_id
    left join portal_mounts m on m.id = a.mount_id
    left join portal_mount_sets ms on ms.id = m.mount_set_id
    where a.discord_sent_at is null
      and a.detected_at <= $1
      and c.active = true
      and c.mount_win_notifications_enabled = true
      and (
        (dl.discord_user_id is not null and c.fc_membership_status = 'current')
        or
        (acl.discord_user_id is not null and anchor.active = true and anchor.fc_membership_status = 'current')
      )
    order by a.detected_at asc
    limit 50;
  `, [completedScanAt]);
  if (!result.rows.length) return;

  const channel = await bot.channels.fetch(settings.mount_win_channel_id).catch(() => null);
  const guild = await bot.guilds.fetch(settings.guild_id || DISCORD_GUILD_ID).catch(() => null);
  if (!channel || !channel.isTextBased() || !guild) return;

  // Keep the communal celebration: several people winning one mount produces one post.
  // A solo member with several different mounts is instead condensed into one post.
  const mountGroups = new Map();
  for (const row of result.rows) {
    const key = `${row.mount_id}:${row.mount_name}`;
    if (!mountGroups.has(key)) {
      mountGroups.set(key, {
        acquisitionIds: [],
        mountName: String(row.mount_name),
        sourceName: row.source_name,
        setName: row.set_name,
        expansion: row.expansion,
        imageUrl: row.image_url || row.icon_url || null,
        winners: []
      });
    }
    const group = mountGroups.get(key);
    group.acquisitionIds.push(Number(row.id));
    group.winners.push({
      acquisitionId: Number(row.id),
      characterId: Number(row.character_id),
      discordUserId: String(row.discord_user_id),
      characterName: String(row.character_name)
    });
  }

  const sharedMountGroups = [];
  const soloWinnerBatches = new Map();
  for (const mountGroup of mountGroups.values()) {
    const distinctWinners = new Map();
    for (const winner of mountGroup.winners) {
      distinctWinners.set(winner.discordUserId, winner);
    }
    const winners = [...distinctWinners.values()];

    if (winners.length > 1) {
      sharedMountGroups.push({ ...mountGroup, winners });
      continue;
    }

    const winner = winners[0];
    const key = winner.discordUserId;
    if (!soloWinnerBatches.has(key)) {
      soloWinnerBatches.set(key, {
        acquisitionIds: [],
        discordUserId: winner.discordUserId,
        characterNames: new Set(),
        mounts: []
      });
    }
    const batch = soloWinnerBatches.get(key);
    batch.acquisitionIds.push(...mountGroup.acquisitionIds);
    batch.characterNames.add(winner.characterName);
    batch.mounts.push({
      mountName: mountGroup.mountName,
      sourceName: mountGroup.sourceName || mountGroup.setName || "Mount acquisition detected",
      expansion: mountGroup.expansion || mountGroup.setName || "Mount",
      imageUrl: mountGroup.imageUrl
    });
  }

  for (const group of sharedMountGroups) {
    const activeWinners = [];
    const skippedIds = [];
    for (const winner of group.winners) {
      const member = await guild.members.fetch(winner.discordUserId).catch(() => null);
      if (member) activeWinners.push(winner);
      else skippedIds.push(winner.acquisitionId);
    }

    await markMountWinDelivery(skippedIds, 'Skipped: linked Discord user is no longer in the server.');
    if (!activeWinners.length) continue;

    const mentions = activeWinners.map((winner) => `<@${winner.discordUserId}>`).join(" ");
    const names = activeWinners.map((winner) => winner.characterName);
    const embed = new EmbedBuilder()
      .setTitle("Mount Win!")
      .setDescription(`Congratulations ${names.map((name) => `**${name}**`).join(", ")} on collecting **${group.mountName}**!`)
      .setColor(0x9d4edd)
      .addFields(
        { name: "Mount", value: limitMountWinText(group.mountName), inline: true },
        { name: "Expansion", value: limitMountWinText(group.expansion || group.setName || "Mount"), inline: true },
        { name: "Character(s)", value: limitMountWinText(names.join("\n")), inline: false },
        { name: "Source", value: limitMountWinText(group.sourceName || group.setName || "Mount acquisition detected"), inline: false }
      )
      .setTimestamp()
      .setFooter({ text: "FFXIV materials © SQUARE ENIX" });
    if (group.imageUrl) embed.setImage(group.imageUrl);

    try {
      await channel.send({ content: mentions, embeds: [embed] });
      await markMountWinDelivery(activeWinners.map((winner) => winner.acquisitionId));
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1000) : "Discord mount-win notification failed.";
      await pool.query(
        `update portal_mount_acquisitions set discord_error = $2 where id = any($1::bigint[]);`,
        [activeWinners.map((winner) => winner.acquisitionId), message]
      );
      console.error("[cotf-bot] Mount-win notification failed:", message);
    }
  }

  for (const batch of soloWinnerBatches.values()) {
    const member = await guild.members.fetch(batch.discordUserId).catch(() => null);
    if (!member) {
      await markMountWinDelivery(batch.acquisitionIds, 'Skipped: linked Discord user is no longer in the server.');
      continue;
    }

    const mountLines = batch.mounts.map(
      (mount) => `- **${mount.mountName}** - ${mount.expansion}\n  ${mount.sourceName}`
    );
    const title = batch.mounts.length === 1 ? "Mount Win!" : "Mount Wins!";
    const characterLabel = [...batch.characterNames].map((name) => `**${name}**`).join(", ");
    const description =
      batch.mounts.length === 1
        ? `Congratulations ${characterLabel} on collecting **${batch.mounts[0].mountName}**!`
        : `Congratulations ${characterLabel} on collecting **${batch.mounts.length} new mounts**!`;
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(0x9d4edd)
      .addFields(
        { name: "Character", value: limitMountWinText([...batch.characterNames].join("\n")), inline: false },
        { name: batch.mounts.length === 1 ? "Mount" : "Mounts", value: limitMountWinText(mountLines.join("\n")), inline: false }
      )
      .setTimestamp()
      .setFooter({ text: "FFXIV materials © SQUARE ENIX" });
    const imageUrl = batch.mounts.find((mount) => mount.imageUrl)?.imageUrl;
    if (imageUrl) {
      if (batch.mounts.length === 1) {
        embed.setImage(imageUrl);
      } else {
        embed.setThumbnail(imageUrl);
      }
    }

    try {
      await channel.send({ content: `<@${batch.discordUserId}>`, embeds: [embed] });
      await markMountWinDelivery(batch.acquisitionIds);
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1000) : "Discord mount-win notification failed.";
      await pool.query(
        `update portal_mount_acquisitions set discord_error = $2 where id = any($1::bigint[]);`,
        [batch.acquisitionIds, message]
      );
      console.error("[cotf-bot] Condensed mount-win notification failed:", message);
    }
  }
}
function galleryCategoryForChannel(settings, channelId) {
  if (channelId && channelId === settings.gaming_setups_channel_id) return "gaming_setup";
  if (channelId && channelId === settings.pets_gallery_channel_id) return "pet";
  if (channelId && channelId === settings.glamours_gallery_channel_id) return "glamour";
  if (channelId && channelId === settings.artwork_gallery_channel_id) return "artwork";
  return null;
}

function isGalleryImageAttachment(attachment) {
  const contentType = String(attachment.contentType || "").toLowerCase();
  if (contentType.startsWith("image/")) return true;
  return /\.(?:avif|gif|jpe?g|png|webp)$/i.test(String(attachment.name || ""));
}

async function importCommunityGalleryMessage(message, category) {
  if (!message || message.author?.bot) return false;
  const attachments = [...message.attachments.values()].filter(isGalleryImageAttachment);
  if (!attachments.length) return false;
  const displayName = message.member?.displayName || message.author.globalName || message.author.username || "Discord member";
  const post = (await pool.query(`insert into portal_community_gallery_posts(category,source_channel_id,source_message_id,discord_user_id,discord_display_name,caption,posted_at) values($1,$2,$3,$4,$5,$6,$7) on conflict(source_message_id) do update set category=excluded.category,source_channel_id=excluded.source_channel_id,discord_user_id=excluded.discord_user_id,discord_display_name=excluded.discord_display_name,caption=excluded.caption returning id::int;`,[category,message.channelId,message.id,message.author.id,displayName,String(message.content||"").trim()||null,message.createdAt.toISOString()])).rows[0];
  await pool.query(`delete from portal_community_gallery_images where post_id=$1;`,[post.id]);
  try{for(const attachment of attachments){const response=await fetch(attachment.url);if(!response.ok)throw new Error(`Discord attachment download failed (${response.status}).`);const imageData=Buffer.from(await response.arrayBuffer());const mimeType=String(attachment.contentType||"").trim()||"application/octet-stream";await pool.query(`insert into portal_community_gallery_images(post_id,source_attachment_id,filename,mime_type,image_data,image_size) values($1,$2,$3,$4,$5,$6) on conflict(post_id,source_attachment_id) do update set filename=excluded.filename,mime_type=excluded.mime_type,image_data=excluded.image_data,image_size=excluded.image_size;`,[post.id,attachment.id,attachment.name||"Discord image",mimeType,imageData,imageData.length]);}return true;}catch(error){throw error;}
}
async function importCommunityGalleryHistory(category, channelId) {
  const channel = await bot.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.() || !channel.messages?.fetch) {
    throw new Error("The configured gallery channel could not be read by the bot.");
  }

  let before;
  let scanned = 0;
  let imported = 0;
  while (true) {
    const messages = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (!messages.size) break;
    const ordered = [...messages.values()].sort((left, right) => left.createdTimestamp - right.createdTimestamp);
    for (const message of ordered) {
      scanned += 1;
      if (await importCommunityGalleryMessage(message, category)) imported += 1;
    }
    if (messages.size < 100) break;
    before = ordered[0]?.id;
    if (!before) break;
  }
  return { scanned, imported };
}

async function processCommunityGalleryImportRequests() {
  const requests = await pool.query(`
    select category
    from portal_community_gallery_import_requests
    where status = 'pending'
    order by requested_at asc
    limit 2;
  `);
  if (!requests.rows.length) return;

  const settings = await getBotSettings({ fresh: true });
  for (const request of requests.rows) {
    const category = request.category;
    const channelId =
      category === "gaming_setup"
        ? settings.gaming_setups_channel_id
        : category === "glamour"
          ? settings.glamours_gallery_channel_id
          : category === "artwork"
            ? settings.artwork_gallery_channel_id
            : settings.pets_gallery_channel_id;
    if (!channelId) {
      await pool.query(`update portal_community_gallery_import_requests set status='failed', error_text='No channel ID is configured for this gallery.', completed_at=now() where category=$1;`, [category]);
      continue;
    }
    await pool.query(`update portal_community_gallery_import_requests set status='running', error_text=null where category=$1;`, [category]);
    try {
      const result = await importCommunityGalleryHistory(category, channelId);
      await pool.query(`update portal_community_gallery_import_requests set status='completed', scanned_messages=$2, imported_posts=$3, completed_at=now(), error_text=null where category=$1;`, [category, result.scanned, result.imported]);
      console.log(`[cotf-bot] Imported ${result.imported} ${category} gallery post(s) from ${result.scanned} message(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1000) : "Gallery import failed.";
      await pool.query(`update portal_community_gallery_import_requests set status='failed', error_text=$2, completed_at=now() where category=$1;`, [category, message]);
      console.error(`[cotf-bot] Gallery import failed for ${category}:`, message);
    }
  }
}

async function processDiscordActionQueue() {
  const fcVerified = await isFcOwnershipVerified();
  if (!fcVerified) {
    try {
      await pool.query(`update portal_discord_guest_access set selection_expires_at=greatest(selection_expires_at,now()+interval '30 minutes'),expires_at=case when expires_at is null then null else greatest(expires_at,now()+interval '30 minutes') end,updated_at=now() where status in('pending','guest');`);
      await pool.query(`update portal_alt_character_claims set code_expires_at=greatest(code_expires_at,now()+interval '30 minutes'),updated_at=now() where status in('pending','code_required') and code_expires_at is not null;`);
      await pool.query(`update portal_discord_roster_overrides set due_at=greatest(due_at,now()+interval '30 minutes'),access_deadline_at=greatest(access_deadline_at,now()+interval '30 minutes'),check_deadline_at=greatest(check_deadline_at,now()+interval '30 minutes'),updated_at=now() where status='approved';`);
    } catch (error) {
      console.error("[cotf-bot] Could not preserve membership deadlines while FC verification is pending:", error);
    }
  }
  try {
    await maintainRecurringEventSeries();
  } catch (error) {
    console.error("[cotf-bot] Recurring event maintenance failed; processing will continue:", error);
  }

  try {
    await maintainDiscordEventLifecycle();
  } catch (error) {
    console.error("[cotf-bot] Event lifecycle maintenance failed; queue processing will continue:", error);
  }

  try {
    await maintainDiscordActionHistory();
  } catch (error) {
    console.error("[cotf-bot] Discord action-history maintenance failed; queue processing will continue:", error);
  }

  if (fcVerified) {
    try {
      await resetStaleDiscordActions();
      await queueAutomaticDiscordRosterScanIfDue();

      for (let i = 0; i < 5; i += 1) {
        const processed = await processOneDiscordAction();

        if (!processed) {
          break;
        }
      }
    } catch (error) {
      console.error("[cotf-bot] Discord action queue processor failed:", error);
    }
  } else {
    try {
      await resetStalePrivacyActions();
      for (let i = 0; i < 5; i += 1) {
        if (!await processOneDiscordAction(true)) break;
      }
    } catch (error) {
      console.error("[cotf-bot] Privacy cleanup queue processor failed:", error);
    }
  }

  try {
    await processPendingOfficerLogs();
  } catch (error) {
    console.error("[cotf-bot] Officer log outbox processor failed:", error);
  }

  if (fcVerified) {
    try {
      await processPendingCharacterRenameNotifications();
    } catch (error) {
      console.error("[cotf-bot] Rename notification processor failed:", error);
    }

    try {
      await processPendingMountWinNotifications();
    } catch (error) {
      console.error("[cotf-bot] Mount-win notification processor failed:", error);
    }
  }
  try {
    await processCommunityGalleryImportRequests();
    await processGiveawayJobs({ pool, bot, getSettings: getBotSettings });
  } catch (error) {
    console.error("[cotf-bot] Community gallery import processor failed:", error);
  }
  try {
    await processPollJobs({ pool, bot });
  } catch (error) {
    console.error("[cotf-bot] Poll processor failed:", error);
  }
  try {
    await processDueDiscordScheduledPosts();
  } catch (error) {
    console.error("[cotf-bot] Scheduled Discord post processor failed:", error);
  }
  try {
    await processFashionReport({
      pool,
      bot,
      getSettings: getBotSettings,
      isNotificationWindowOpen: isAutomatedNotificationWindowOpen
    });
  } catch (error) {
    console.error("[cotf-bot] Fashion Report processor failed:", error);
  }
  try {
    await processAnimeRanking({
      pool,
      bot,
      getSettings: getBotSettings,
      isNotificationWindowOpen: isAutomatedNotificationWindowOpen
    });
  } catch (error) {
    console.error("[cotf-bot] Anime ranking processor failed:", error);
  }
  try {
    await processLodestoneNews({
      pool,
      bot,
      getSettings: getBotSettings,
      isNotificationWindowOpen: isAutomatedNotificationWindowOpen
    });
  } catch (error) {
    console.error("[cotf-bot] Lodestone News processor failed:", error);
  }
}

function startDiscordActionQueueProcessor() {
  setInterval(processDiscordActionQueue, 30000);

  setTimeout(() => {
    processDiscordActionQueue();
  }, 5000);
}

async function ensureOfficerLogOutboxTable() {
  await pool.query(`create table if not exists portal_discord_officer_log_outbox (id bigserial primary key, dedupe_key text not null unique, payload jsonb not null, status text not null default 'pending', created_at timestamptz not null default now(), sent_at timestamptz, updated_at timestamptz not null default now());`);
  await pool.query(`update portal_discord_officer_log_outbox set status = 'pending', updated_at = now() where status = 'sending';`);
}
async function ensureDiscordMemberSnapshotTable() {
  await pool.query(`
    create table if not exists portal_discord_member_snapshots (
      discord_user_id text primary key,
      discord_username text,
      discord_global_name text,
      discord_nickname text,
      discord_display_name text,
      is_bot boolean not null default false,
      present_in_guild boolean not null default true,
      has_verified_role boolean not null default false,
      has_unverified_role boolean not null default false,
      linked_character_id bigint,
      linked_character_name text,
      linked_world text,
      linked_fc_status text,
      linked_active boolean,
      review_status text not null default 'ok',
      review_reason text,
      last_scanned_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    alter table portal_discord_member_snapshots
      add column if not exists discord_username text,
      add column if not exists discord_global_name text,
      add column if not exists discord_nickname text,
      add column if not exists discord_display_name text,
      add column if not exists is_bot boolean not null default false,
      add column if not exists present_in_guild boolean not null default true,
      add column if not exists has_verified_role boolean not null default false,
      add column if not exists has_unverified_role boolean not null default false,
      add column if not exists linked_character_id bigint,
      add column if not exists linked_character_name text,
      add column if not exists linked_world text,
      add column if not exists linked_fc_status text,
      add column if not exists linked_active boolean,
      add column if not exists review_status text not null default 'ok',
      add column if not exists review_reason text,
      add column if not exists last_scanned_at timestamptz,
      add column if not exists created_at timestamptz not null default now(),
      add column if not exists updated_at timestamptz not null default now();
  `);
}


// =========================
function getDiscordInteractionDisplayName(interaction){
  return String(interaction?.member?.displayName || interaction?.member?.nickname || interaction?.user?.globalName || interaction?.user?.username || "").trim();
}
async function getActiveCharacterForDiscordUser(discordUserId,currentNickname="") {
  const result = await pool.query(
    `with membership as (
       select dl.discord_user_id,dl.character_id anchor_id,coalesce(nullif($2,''),dl.discord_nickname,dl.discord_display_name,'') current_nickname
       from portal_discord_links dl join portal_characters anchor on anchor.id=dl.character_id
       where dl.discord_user_id=$1 and anchor.active=true and anchor.fc_membership_status='current'
         and exists(select 1 from portal_fc_verification verification where verification.id=1 and verification.status='verified')
     ), candidates as (
       select anchor.id::int,anchor.character_name,anchor.world,
         case when lower(trim(anchor.character_name))=lower(trim(m.current_nickname)) or lower(trim(anchor.display_name))=lower(trim(m.current_nickname)) then 0 else 1 end identity_priority
       from membership m join portal_characters anchor on anchor.id=m.anchor_id
       union all
       select linked.id::int,linked.character_name,linked.world,
         case when lower(trim(linked.character_name))=lower(trim(m.current_nickname)) or lower(trim(linked.display_name))=lower(trim(m.current_nickname)) then 0 else 2 end identity_priority
       from membership m join portal_alt_character_links acl on acl.discord_user_id=m.discord_user_id and acl.active=true
       join portal_characters linked on linked.id=acl.character_id and linked.active=true
     ) select id,character_name,world from candidates order by identity_priority,id limit 1;`,
    [discordUserId,currentNickname]
  );
  return result.rows[0] || null;
}

async function saveDiscordEventRsvp({ eventId, characterId, discordUserId, signupStatus = null, rolePreference = null }) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`,[`event-member:${eventId}:${discordUserId}`]);
    const eventResult = await client.query(
      `select id, roster_locked from portal_discord_events where id = $1 and status = 'planned' limit 1;`, [eventId]
    );
    if (eventResult.rows.length === 0) throw new Error("This event is no longer accepting RSVPs.");
    if (eventResult.rows[0].roster_locked) throw new Error("This event roster is locked. Ask an officer to make changes.");
    if (signupStatus) {
      await client.query(`update portal_discord_event_signups s set character_id=$2,updated_at=now()
        where s.event_id=$1 and s.character_id<>$2
          and (exists(select 1 from portal_discord_links dl where dl.discord_user_id=$3 and dl.character_id=s.character_id)
            or exists(select 1 from portal_alt_character_links acl where acl.discord_user_id=$3 and acl.character_id=s.character_id and acl.active=true))
          and not exists(select 1 from portal_discord_event_signups target where target.event_id=$1 and target.character_id=$2)
          and s.character_id=(select owned.character_id from portal_discord_event_signups owned
            where owned.event_id=$1 and (exists(select 1 from portal_discord_links dl where dl.discord_user_id=$3 and dl.character_id=owned.character_id)
              or exists(select 1 from portal_alt_character_links acl where acl.discord_user_id=$3 and acl.character_id=owned.character_id and acl.active=true))
            order by owned.created_at,owned.character_id limit 1)`,[eventId,characterId,discordUserId]);
      await client.query(`delete from portal_discord_event_signups s where s.event_id=$1 and s.character_id<>$2 and (exists(select 1 from portal_discord_links dl where dl.discord_user_id=$3 and dl.character_id=s.character_id) or exists(select 1 from portal_alt_character_links acl where acl.discord_user_id=$3 and acl.character_id=s.character_id and acl.active=true))`,[eventId,characterId,discordUserId]);
      await client.query(
        `insert into portal_discord_event_signups (
           event_id, character_id, signup_status, role_preference, roster_state,
           party_number, completed_at, completed_by, created_at, updated_at
         ) values ($1, $2, $3, coalesce($4, 'flexible'), case when $3 = 'going' then 'active' else 'waiting' end,
                   null, null, null, now(), now())
         on conflict (event_id, character_id) do update set
           signup_status = excluded.signup_status,
           role_preference = case
             when $4::text is not null then excluded.role_preference
             else portal_discord_event_signups.role_preference
           end,
           roster_state = case
             when excluded.signup_status = 'going' and portal_discord_event_signups.roster_state = 'completed'
               and portal_discord_event_signups.signup_status = 'going' then 'completed'
             when excluded.signup_status = 'going' then 'active'
             else 'waiting'
           end,
           party_number = case when excluded.signup_status = 'going' then portal_discord_event_signups.party_number else null end,
           completed_at = case
             when excluded.signup_status = 'going' and portal_discord_event_signups.roster_state = 'completed'
               then portal_discord_event_signups.completed_at
             else null
           end,
           completed_by = case
             when excluded.signup_status = 'going' and portal_discord_event_signups.roster_state = 'completed'
               then portal_discord_event_signups.completed_by
             else null
           end,
           attendance_status = case
             when excluded.signup_status = 'going' then portal_discord_event_signups.attendance_status
             else 'not_checked_in'
           end,
           checked_in_at = case
             when excluded.signup_status = 'going' then portal_discord_event_signups.checked_in_at
             else null
           end,
           attendance_updated_at = case when excluded.signup_status = 'going' then portal_discord_event_signups.attendance_updated_at else now() end,
           attendance_updated_by = case when excluded.signup_status = 'going' then portal_discord_event_signups.attendance_updated_by else 'Discord RSVP' end,
           updated_at = now();`,
        [eventId, characterId, signupStatus, rolePreference]
      );
    } else if (rolePreference) {
      const roleUpdateResult = await client.query(
        `update portal_discord_event_signups
         set role_preference = $3, updated_at = now()
         where event_id = $1 and signup_status in ('going', 'maybe')
           and (character_id=$2 or exists(select 1 from portal_alt_character_links acl where acl.discord_user_id=$4 and acl.character_id=portal_discord_event_signups.character_id and acl.active=true))
         returning signup_status, role_preference;`,
        [eventId, characterId, rolePreference, discordUserId]
      );
      if (roleUpdateResult.rows.length === 0) {
        const existingResult = await client.query(
          `select signup_status from portal_discord_event_signups
           where event_id = $1 and (character_id=$2 or exists(select 1 from portal_alt_character_links acl where acl.discord_user_id=$3 and acl.character_id=portal_discord_event_signups.character_id and acl.active=true)) limit 1;`, [eventId, characterId, discordUserId]
        );
        if (existingResult.rows[0]?.signup_status === "cant_attend") {
          throw new Error("Change your attendance to Going or Maybe before selecting a preferred role.");
        }
        throw new Error("Choose Going or Maybe before selecting a preferred role.");
      }
    }
    await rebalanceDiscordEventRoster(eventId, client);
    const result = await client.query(
      `select signup_status, role_preference from portal_discord_event_signups
       where event_id = $1 and (character_id=$2 or exists(select 1 from portal_alt_character_links acl where acl.discord_user_id=$3 and acl.character_id=portal_discord_event_signups.character_id and acl.active=true));`, [eventId, characterId, discordUserId]
    );
    await client.query("commit");
    return result.rows[0];
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
async function checkInDiscordEventParticipant({ eventId, characterId, discordUserId, checkedInBy }) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const eventResult = await client.query(
      `select status as event_status, event_starts_at, event_ends_at, check_in_required
       from portal_discord_events where id = $1 limit 1 for update;`,
      [eventId]
    );
    if (eventResult.rows.length === 0) throw new Error("This event could not be found.");
    if (!isDiscordEventCheckInOpen(eventResult.rows[0])) {
      throw new Error("Check-in opens one hour before the event and closes when the event ends.");
    }
    const result = await client.query(
      `update portal_discord_event_signups
       set signup_status = 'going', attendance_status = 'present',
           checked_in_at = coalesce(checked_in_at, now()), attendance_updated_at = now(),
           attendance_updated_by = $4, updated_at = now()
       where event_id = $1 and signup_status in ('going', 'maybe')
         and (character_id=$2 or exists(select 1 from portal_alt_character_links acl where acl.discord_user_id=$3 and acl.character_id=portal_discord_event_signups.character_id and acl.active=true))
       returning character_id;`,
      [eventId, characterId, discordUserId, checkedInBy]
    );
    if (result.rows.length === 0) throw new Error("RSVP Going or Maybe before checking in.");
    await rebalanceDiscordEventRoster(eventId, client);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
async function completeDiscordEventParticipant({ eventId, characterId, discordUserId, completedBy }) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query(
      `update portal_discord_event_signups s
       set roster_state = 'completed', party_number = null, completed_at = now(), completed_by = $4,
           attendance_status = case when attendance_status = 'not_checked_in' then 'present' else attendance_status end,
           checked_in_at = coalesce(checked_in_at, now()), attendance_updated_at = now(),
           attendance_updated_by = $4, updated_at = now()
       from portal_discord_events e
       where s.event_id = $1 and s.signup_status = 'going'
         and (s.character_id=$2 or exists(select 1 from portal_alt_character_links acl where acl.discord_user_id=$3 and acl.character_id=s.character_id and acl.active=true))
         and s.roster_state = 'active'
         and (e.check_in_required = false or s.attendance_status in ('present', 'late'))
         and e.id = s.event_id and e.status = 'planned' and e.event_starts_at <= now()
       returning s.character_id;`,
      [eventId, characterId, discordUserId, completedBy]
    );
    if (result.rows.length === 0) throw new Error("Join an active party before marking your rotation complete. Events using attendance tracking also require check-in.");
    const completedCharacterId=Number(result.rows[0].character_id);
    const mountResult = await client.query(
      `select em.mount_id::int, m.mount_name, c.character_name
       from portal_discord_event_mounts em
       join portal_mounts m on m.id = em.mount_id
       join portal_characters c on c.id = $2
       where em.event_id = $1
       order by em.sort_order asc, em.mount_id asc limit 1;`,
      [eventId, completedCharacterId]
    );
    let mountName = null;
    if (mountResult.rows.length > 0) {
      const mount = mountResult.rows[0];
      mountName = String(mount.mount_name);
      await client.query(
        `insert into portal_character_mounts (
           character_id, mount_id, owned, ownership_source, obtained_at, last_checked_at, updated_at
         ) values ($1, $2, true, 'event_roster', now(), now(), now())
         on conflict (character_id, mount_id) do update set
           owned = true, ownership_source = 'event_roster',
           obtained_at = coalesce(portal_character_mounts.obtained_at, now()),
           last_checked_at = now(), updated_at = now();`,
        [completedCharacterId, Number(mount.mount_id)]
      );
      await client.query(
        `insert into portal_mount_acquisitions (
           character_id, mount_id, character_name, mount_name, detected_at
         ) values ($1, $2, $3, $4, now())
         on conflict (character_id, mount_id) do nothing;`,
        [completedCharacterId, Number(mount.mount_id), String(mount.character_name), mountName]
      );
    }
    await rebalanceDiscordEventRoster(eventId, client);
    await client.query("commit");
    return { mountName };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
async function handleDiscordEventRsvpInteraction(interaction) {
  const statusMatch = interaction.customId.match(/^cotf_event_rsvp:(\d+):(going|maybe|cant_attend)$/);
  const roleModalMatch = interaction.customId.match(/^cotf_event_role_modal:(\d+):(going|maybe)$/);
  const legacyRoleMatch = interaction.customId.match(/^cotf_event_role:(\d+)$/);
  const completeMatch = interaction.customId.match(/^cotf_event_complete:(\d+)$/);
  const checkInMatch = interaction.customId.match(/^cotf_event_checkin:(\d+)$/);
  if (!statusMatch && !roleModalMatch && !legacyRoleMatch && !completeMatch && !checkInMatch) return false;

  if (statusMatch && statusMatch[2] !== "cant_attend") {
    try {
      await interaction.showModal(buildEventRoleModal(Number(statusMatch[1]), statusMatch[2]));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[cotf-bot] Event RSVP role modal failed:", error);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: `RSVP could not be started: ${message}`, ephemeral: true });
      } else {
        await interaction.reply({ content: `RSVP could not be started: ${message}`, ephemeral: true });
      }
    }
    return true;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const eventId = Number(statusMatch?.[1] || roleModalMatch?.[1] || legacyRoleMatch?.[1] || completeMatch?.[1] || checkInMatch?.[1] || 0);
    const character = await getActiveCharacterForDiscordUser(interaction.user.id,getDiscordInteractionDisplayName(interaction));
    if (!character) throw new Error("Your Discord account is not linked to a current, active FC character. Use verification or ask an officer for help.");
    const settings = await getBotSettings();
    const guild = interaction.guild || await bot.guilds.fetch(settings.guild_id || DISCORD_GUILD_ID);

    if (checkInMatch) {
      await checkInDiscordEventParticipant({
        eventId,
        characterId: Number(character.id),
        discordUserId: interaction.user.id,
        checkedInBy: `Discord: ${interaction.user.id}`
      });
      await refreshDiscordEventMessage(eventId, guild);
      await interaction.editReply(`${character.character_name}: checked in. The live party roster has been updated.`);
      return true;
    }

    if (completeMatch) {
      const completion = await completeDiscordEventParticipant({
        eventId,
        characterId: Number(character.id),
        discordUserId: interaction.user.id,
        completedBy: `Discord: ${interaction.user.id}`
      });
      await refreshDiscordEventMessage(eventId, guild);
      await interaction.editReply(
        completion.mountName
          ? `${character.character_name}: ${completion.mountName} recorded. You are complete and the next participant has been promoted.`
          : `${character.character_name}: rotation complete. The next participant has been promoted.`
      );
      return true;
    }

    const signupStatus = roleModalMatch?.[2] || statusMatch?.[2] || null;
    const rolePreference = roleModalMatch
      ? interaction.fields.getStringSelectValues("cotf_event_role_choice")?.[0] || null
      : legacyRoleMatch
        ? interaction.values?.[0] || null
        : null;
    if (signupStatus && !EVENT_RSVP_STATUSES.has(signupStatus)) throw new Error("Invalid RSVP status.");
    if (rolePreference && !EVENT_ROLE_PREFERENCES.has(rolePreference)) throw new Error("Invalid role preference.");
    const signup = await saveDiscordEventRsvp({ eventId, characterId: Number(character.id), discordUserId: interaction.user.id, signupStatus, rolePreference });
    await refreshDiscordEventMessage(eventId, guild);
    const statusLabel = signup.signup_status === "going" ? "Going" : signup.signup_status === "maybe" ? "Maybe" : "Can't Attend";
    const roleLabel = signup.signup_status === "cant_attend" ? "" : ` - ${getEventRoleLabel(signup.role_preference)}`;
    await interaction.editReply(`${character.character_name}: ${statusLabel}${roleLabel}. The event roster has been updated.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cotf-bot] Event RSVP interaction failed:", error);
    await interaction.editReply(`Event response could not be saved: ${message}`);
  }
  return true;
}
// SECTION 13: Discord Event Handlers
// =========================

// -------------------------
// SUBSECTION 13A: Bot ready event
// -------------------------

let verificationCleanupRunning = false;
async function cleanupUsedVerificationPrompts() {
  if (verificationCleanupRunning) return;
  verificationCleanupRunning = true;
  try {
    const prompts = await pool.query("select message_id,channel_id from portal_discord_verification_prompts where used_at is not null and removed_at is null order by used_at limit 25");
    for (const prompt of prompts.rows) {
      try {
        const channel = await bot.channels.fetch(prompt.channel_id);
        if (!channel?.messages) throw new Error("Verification channel is not accessible.");
        await channel.messages.delete(prompt.message_id);
        await pool.query("update portal_discord_verification_prompts set removed_at=now() where message_id=$1",[prompt.message_id]);
      } catch (error) {
        if ([10008,10003].includes(error.code)) {
          await pool.query("update portal_discord_verification_prompts set removed_at=now() where message_id=$1",[prompt.message_id]);
        } else {
          await sendOfficerLog({content:"A used verification prompt could not be removed. It cannot be reused; check bot access to the channel. Cleanup will retry.",allowedMentions:{parse:[]}},
            `verification-cleanup:${prompt.message_id}`,true);
        }
      }
    }
  } catch (error) { console.error("[cotf-bot] Verification prompt cleanup failed:",error.message); }
  finally { verificationCleanupRunning = false; }
}

bot.once("clientReady", async () => {
  console.log(`[cotf-bot] Logged in as ${bot.user.tag}.`);

  await ensureBotTables();
  try { await ensureGiveawayBotTables(pool); } catch (error) { console.warn("[cotf-bot] Giveaway tables are waiting for the portal schema migration:", error.message); }
  try { await ensurePollBotTables(pool); } catch (error) { console.warn("[cotf-bot] Poll tables are waiting for the portal schema migration:", error.message); }
  try { await ensureAvailabilitySchema(pool); } catch (error) { console.warn("[cotf-bot] Availability tables are waiting for the portal schema migration:", error.message); }
  await ensureDiscordActionQueueTable();
  await ensureDiscordMemberSnapshotTable();
  await ensureOfficerLogOutboxTable();
  rosterOverrides = createRosterOverrides({
    pool, bot, settings: getBotSettings, isAdmin: isProtectedPortalAdministrator,
    primaryAdmin: getPrimaryPortalAdministratorId, notify: sendOfficerLog,
    findCharacter: findCurrentFcCharacterByName, verify: verifyMemberByCharacterName,
    welcomePost: postVerifiedCharacterToWelcomeChannel,
    welcomeGreeting: postOfficerApprovedCharacterGreeting,
    completeOnboarding: completeGuestAccessAfterVerification, audit: writeAuditLog,
    isFcVerified: isFcOwnershipVerified
  });
  await rosterOverrides.ensure();
  altCharacterClaims = createAltCharacterClaims({ pool, bot, getSettings: getBotSettings, isAdmin: isProtectedPortalAdministrator, isFcVerified: isFcOwnershipVerified });
  await altCharacterClaims.ensure();
  await pool.query(`create table if not exists portal_discord_verification_prompts (
    message_id text primary key, guild_id text not null, channel_id text not null,
    used_by text, used_at timestamptz, created_at timestamptz not null default now());`);
  await pool.query("alter table portal_discord_verification_prompts add column if not exists removed_at timestamptz;");
  setInterval(cleanupUsedVerificationPrompts,60000);
  await cleanupUsedVerificationPrompts();
  rosterOverrides.start();
  await ensureDiscordScheduledPostsTable();
  const eventSchemaReady = await initializeDiscordEventSchema();
  if (eventSchemaReady) await ensureEventDraftTable(pool);
  if (!eventSchemaReady) scheduleDiscordEventSchemaRetry();
  await ensureFashionReportTables(pool);
  await ensureAnimeRankingTables(pool);
  await ensureLodestoneNewsTables(pool);
  await getBotSettings({ fresh: true });
  ensureTreasureMapSchema(pool)
    .then(() => bootstrapTreasureMapCatalog(pool))
    .catch((error) => console.warn("[treasure-maps] Bundled catalog import failed; manual corrections remain available:", error?.message || error));
  await registerGuildCommands();

  const settings = await getBotSettings({ fresh: true });
  try {
    const guild = await bot.guilds.fetch(settings.guild_id || DISCORD_GUILD_ID);
    if (eventSchemaReady) await refreshActiveDiscordEventMessages(guild);
    await refreshExistingCraftingProjectMessages(settings, guild);
  } catch (error) {
    console.error("[cotf-bot] Startup event roster refresh failed:", error);
  }

  if (settings.startup_member_sync_enabled) {
    try {
      await syncExistingGuildMembers();
    } catch (error) {
      console.error("[cotf-bot] Startup member sync failed:", error.message);
    }
  } else {
    console.log("[cotf-bot] Startup member sync skipped.");
  }

  startDiscordActionQueueProcessor();
  startGuestAccessProcessor();
  setInterval(() => processEventPlanSyncs(pool, bot).catch((error) => console.error("[cotf-bot] Planning-request sync failed:", error)), 15000);
  setTimeout(() => processEventPlanSyncs(pool, bot).catch((error) => console.error("[cotf-bot] Initial planning-request sync failed:", error)), 7000);

  startAnimeScheduledEventSync({
    bot,
    guildId: settings.guild_id || DISCORD_GUILD_ID,
    baseUrl: ANIME_SCHEDULE_URL,
    token: ANIME_SERVICE_API_TOKEN,
    enabled: async () => (await getBotSettings()).anime_event_scheduling_enabled
  });

  console.log("[cotf-bot] Ready.");
});

// -------------------------
// SUBSECTION 13B: New guild member event
// -------------------------

bot.on("guildMemberAdd", async (member) => {
  try {
    if (member.user.bot) return;
    if (!await isFcOwnershipVerified()) {
      console.log(`[cotf-bot] Member onboarding for ${member.id} paused until Free Company ownership is verified.`);
      return;
    }
    await rosterOverrides?.onJoin(member);
    const matchedCharacter = await autoMatchMemberByDisplayName(member, "member_join_auto_match");
    const settings = await getBotSettings();

    if (matchedCharacter) {
      const welcomeReadiness = await getVerifiedWelcomeReadiness(member, matchedCharacter);
      if (welcomeReadiness.ready) {
        await postVerifiedCharacterToWelcomeChannel(member, matchedCharacter);
        await postVerifiedCharacterGreeting(member, matchedCharacter);
      } else {
        console.warn(`[cotf-bot] Verified welcome deferred for ${member.id}: ${welcomeReadiness.missing.join(", ")}.`);
      }
    } else if (settings.welcome_channel_id) {
      const channel = await bot.channels.fetch(settings.welcome_channel_id);

      if (channel && channel.isTextBased()) {
        const promptMessage = await channel.send({
          content: `Welcome ${member}. This access choice is only for you.`,
          ...buildVerificationPromptMessage(
            member.id,
            settings.onboarding_selection_minutes,
            settings.temp_guest_hours,
            settings.temporary_guest_enabled
          )
        });
        await registerPendingGuestAccess(member, promptMessage, settings);
      }
    }
  } catch (error) {
    console.error("[cotf-bot] guildMemberAdd handling failed:", error.message);
  }
});

// -------------------------
// SUBSECTION 13C: Community gallery channel watcher
bot.on("guildMemberRemove", member => {
  rosterOverrides?.onLeave(member).catch(error => console.error("[roster-override] Leave cleanup failed:",error.message));
});
// -------------------------

bot.on("messageCreate", async (message) => {
  try {
    const settings = await getBotSettings();
    if (await handleTreasureMapChannelMessage(message, pool, settings, { portalUrl: PORTAL_URL })) return;
    const category = galleryCategoryForChannel(settings, message.channelId);
    if (!category) return;
    const imported = await importCommunityGalleryMessage(message, category);
    if (imported) console.log(`[cotf-bot] Added pending ${category} gallery post from ${message.author?.username || "Discord member"}.`);
    await autoEnrollGiveawaySubmission({ message, pool });
  } catch (error) {
    console.error("[cotf-bot] Community gallery message import failed:", error);
  }
});

bot.on("messageUpdate",async(_oldMessage,newMessage)=>{try{const message=newMessage.partial?await newMessage.fetch():newMessage;const settings=await getBotSettings();const category=galleryCategoryForChannel(settings,message.channelId);if(!category)return;await importCommunityGalleryMessage(message,category);await mirrorAutoEnrolledGiveawaySource({message,pool});}catch(error){console.error("[cotf-bot] Community gallery message update failed:",error);}});
bot.on("messageDelete",async message=>{try{await mirrorAutoEnrolledGiveawaySource({message,pool,deleted:true});await pool.query(`delete from portal_community_gallery_posts where source_message_id=$1;`,[message.id]);}catch(error){console.error("[cotf-bot] Community gallery message delete failed:",error);}});

// SUBSECTION 13D: Slash command, button, and modal interactions
// -------------------------

bot.on("interactionCreate", async (interaction) => {
  if ((interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) && interaction.customId.startsWith("fae:availability:")) {
    await handleAvailabilityInteraction(interaction,pool,{isOfficer:async(current)=>Boolean(await isProtectedPortalAdministrator(current.user.id))||Boolean(current.memberPermissions?.has(PermissionFlagsBits.ManageGuild))});
    return;
  }
  if ((interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) && interaction.customId.startsWith("fae:event-plan:")) {
    await handleEventPlanComponent(interaction,pool);
    return;
  }
  if ((interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) && interaction.customId.startsWith("map:")) {
    const settings = await getBotSettings();
    await handleTreasureMapComponent(interaction, pool, {
      portalUrl: PORTAL_URL,
      officerLogChannelId: settings.officer_log_channel_id,
      isOfficer: async (current) => Boolean(await isProtectedPortalAdministrator(current.user.id)) || Boolean(current.memberPermissions?.has(PermissionFlagsBits.ManageGuild))
    });
    return;
  }
  if (interaction.isMessageContextMenuCommand() && interaction.commandName === "Identify Treasure Map") {
    if (!await isFaeCommandEnabled(pool, "map")) await interaction.reply({ ...disabledFaeCommandReply("map"), flags: MessageFlags.Ephemeral });
    else await handleTreasureMapContextCommand(interaction, pool, { portalUrl: PORTAL_URL });
    return;
  }
  if (interaction.isAutocomplete() && interaction.commandName === DISCORD_COMMAND_NAME && interaction.options.getSubcommand(false) === "chocobocolor") {
    if (!await isFaeCommandEnabled(pool, "chocobocolor")) { await interaction.respond([]).catch(() => null); return; }
    await handleChocoboAutocomplete(interaction).catch(() => interaction.respond([]).catch(() => null));
    return;
  }
  if (interaction.isAutocomplete() && interaction.commandName === DISCORD_COMMAND_NAME && interaction.options.getSubcommand(false) === "craftmacro") {
    if (!await isFaeCommandEnabled(pool, "craftmacro")) { await interaction.respond([]).catch(() => null); return; }
    await handleCraftMacroAutocomplete(interaction, pool).catch(() => interaction.respond([]).catch(() => null));
    return;
  }
  if (interaction.isAutocomplete() && interaction.commandName === DISCORD_COMMAND_NAME && interaction.options.getSubcommandGroup(false) === "share") {
    if (!await isFaeCommandEnabled(pool, "share")) { await interaction.respond([]).catch(() => null); return; }
    await handleShareAutocomplete(interaction, pool);
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith("cotf_welcome_wave:")) {
    await handleWelcomeWave(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith("share:")) {
    await handleShareComponent(interaction, pool);
    return;
  }
  if ((interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) && interaction.customId.startsWith("altchar:")) {
    if(!altCharacterClaims){if(interaction.deferred||interaction.replied)await interaction.editReply({content:"Character claims are still starting. Please try again in a moment.",components:[]}).catch(()=>null);else await interaction.reply({content:"Character claims are still starting. Please try again in a moment.",flags:MessageFlags.Ephemeral}).catch(()=>null);}
    else{
      const startedAt=Date.now(),referenceId=createFaeDiagnosticReference(),commandPath=`/${DISCORD_COMMAND_NAME} character > ${interaction.customId.replace(/^altchar:/,"").replaceAll(":", " > ")}`;
      try{
        const result=await altCharacterClaims.handle(interaction);
        const error=result&&typeof result==="object"?result.error:null;
        await recordFaeDiagnostic(pool,interaction,{referenceId,commandPath,interactionKind:"component",outcome:error?"failure":"success",startedAt,error});
      }catch(error){
        await recordFaeDiagnostic(pool,interaction,{referenceId,commandPath,interactionKind:"component",outcome:"failure",startedAt,error});
        throw error;
      }
    }
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith("fae:craftmacro:")) {
    await handleCraftMacroModal(interaction, pool);
    return;
  }
  if ((interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) && interaction.customId.startsWith("fae:event:")) {
    const startedAt=Date.now(),referenceId=createFaeDiagnosticReference(),commandPath=`/${DISCORD_COMMAND_NAME} event > ${interaction.customId.replace(/^fae:event:/,"").replaceAll(":"," > ")}`;
    const result=await handleEventComponent(interaction,pool),error=result&&typeof result==="object"?result.error:null;
    await recordFaeDiagnostic(pool,interaction,{referenceId,commandPath,interactionKind:"component",outcome:error?"failure":"success",startedAt,error});
    return;
  }
  if ((interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) && interaction.customId.startsWith("cotf_poll_")) {
    const startedAt=Date.now(),referenceId=createFaeDiagnosticReference(),commandPath=`/${DISCORD_COMMAND_NAME} poll > ${interaction.customId.replace(/^cotf_poll_/,"").replaceAll(":"," > ")}`;
    const result=await handlePollInteraction(interaction,pool),error=result&&typeof result==="object"?result.error:null;
    await recordFaeDiagnostic(pool,interaction,{referenceId,commandPath,interactionKind:"component",outcome:error?"failure":"success",startedAt,error});
    return;
  }
  if ((interaction.isButton() || interaction.isStringSelectMenu()) && interaction.customId.startsWith("fae:")) {
    await handleFaeComponent(interaction, pool);
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith("cotf_giveaway_")) {
    await handleGiveawayInteraction(interaction, pool);
    return;
  }
  if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
    if (await handleCraftingProjectInteraction(interaction)) return;
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith("cotf_roster_override:")) {
      try { await rosterOverrides.handle(interaction); }
      catch (error) {
        console.error("[cotf-bot] Roster override failed:", error.message);
        if (interaction.deferred) await interaction.editReply("Approval could not be completed. Check the bot log and retry.").catch(() => {});
      }
      return;
    }
    if (interaction.customId.startsWith("cotf_link_conflict:")) {
      await handleCharacterLinkConflictAction(interaction);
      return;
    }
    if (interaction.customId.startsWith("cotf_rename_")) {
      await interaction.deferReply({ ephemeral: true });
      const [actionPrefix, renameId] = interaction.customId.split(":");
      const action = actionPrefix.replace("cotf_", "");
      const rename = await pool.query(
        `
          select h.id, h.new_name, h.old_name, c.portrait_url, c.avatar_url, dl.discord_user_id
          from portal_character_rename_history h
          join portal_characters c on c.id = h.character_id
          left join portal_discord_links dl on dl.character_id = c.id
          where h.id = $1
            and h.confirmation_status = 'pending'
          limit 1;
        `,
        [Number(renameId)]
      );
      const row = rename.rows[0];
      if (!row || row.discord_user_id !== interaction.user.id) {
        await interaction.editReply("This rename confirmation is not available for your account.");
        return;
      }

      if (action === "rename_yes") {
        const member = interaction.guild
          ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
          : null;
        if (!member?.manageable) {
          await pool.query(
            `update portal_character_rename_history
             set confirmation_status = 'needs_officer_review', confirmed_at = now(), confirmed_by = $2
             where id = $1;`,
            [row.id, interaction.user.id]
          );
          await interaction.editReply("I could not update your nickname automatically, so officers have been notified to review it.");
          return;
        }

        await member.setNickname(row.new_name, "COTF confirmed character rename");
        await pool.query(
          `update portal_character_rename_history
           set confirmation_status = 'confirmed', confirmed_at = now(), confirmed_by = $2
           where id = $1;`,
          [row.id, interaction.user.id]
        );
        await interaction.message.edit({ components: [] });
        await interaction.message.channel.send({
          content: `Your Discord name has been changed to **${row.new_name}**.`,
          embeds: row.portrait_url || row.avatar_url
            ? [new EmbedBuilder().setImage(row.portrait_url || row.avatar_url).setFooter({ text: "FFXIV materials © SQUARE ENIX" })]
            : []
        });
        await interaction.editReply("Your Discord nickname has been updated.");
      } else if (action === "rename_later") {
        await pool.query(
          `update portal_character_rename_history
           set confirmation_status = 'deferred', confirmed_at = now(), confirmed_by = $2
           where id = $1;`,
          [row.id, interaction.user.id]
        );
        await interaction.message.edit({ components: [] });
        await interaction.message.channel.send(
          "No problem. When you're ready, use `/iam charactername` to update your linked character name."
        );
        await interaction.editReply("No changes were made.");
      } else if (action === "rename_not_me") {
        await pool.query(
          `update portal_character_rename_history
           set confirmation_status = 'disputed', confirmed_at = now(), confirmed_by = $2
           where id = $1;`,
          [row.id, interaction.user.id]
        );
        await interaction.message.edit({ components: [] });
        await interaction.editReply("Thanks \u2014 officers have been asked to review this rename.");
      } else {
        await interaction.editReply("That rename action is not recognized.");
      }
      return;
    }
    if (interaction.customId.startsWith("cotf_event_rsvp:") || interaction.customId.startsWith("cotf_event_complete:") || interaction.customId.startsWith("cotf_event_checkin:")) {
      await handleDiscordEventRsvpInteraction(interaction);
      return;
    }
    if (interaction.customId.startsWith("cotf_temporary_guest:")) {
      try {
        await handleTemporaryGuestSelection(interaction, interaction.customId.split(":")[1] || "");
      } catch (error) {
        console.error("[cotf-bot] temporary guest selection failed:", error);
        const content = "Temporary guest access could not be completed right now. Please try again shortly or contact an officer.";
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(content).catch(() => {});
        } else {
          await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
      }
      return;
    }

    if (interaction.customId === "cotf_privacy_remain_opted_out") {
      await interaction.update({ content: "You remain opted out. No verification or automatic portal collection was performed.", components: [] });
      return;
    }

    if (interaction.customId.startsWith("cotf_privacy_optin:")) {
      const [, targetUserId = "", oneTimeMessageId = ""] = interaction.customId.split(":");
      if (targetUserId && targetUserId !== interaction.user.id) {
        await interaction.reply({ content: "This opt-in confirmation belongs to another member.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (oneTimeMessageId) {
        const prompt = await pool.query("select 1 from portal_discord_verification_prompts where message_id=$1 and guild_id=$2 and channel_id=$3 and used_at is null", [oneTimeMessageId, interaction.guildId, interaction.channelId]);
        if (!prompt.rows.length) { await interaction.reply({ content: "This verification prompt has already been used.", flags: MessageFlags.Ephemeral }); return; }
      }
      await optDiscordUserBackIn(interaction.user.id);
      await interaction.showModal(buildVerificationModal(targetUserId).setCustomId(`cotf_verify_character_modal:${targetUserId}:${oneTimeMessageId}`));
      return;
    }

    if (interaction.customId === "cotf_officer_verify_once") {
      const prompt = await pool.query("select 1 from portal_discord_verification_prompts where message_id=$1 and guild_id=$2 and channel_id=$3 and used_at is null", [interaction.message.id, interaction.guildId, interaction.channelId]);
      if (!prompt.rows.length) {
        await interaction.reply({ content: "This verification prompt has already been used.", flags: MessageFlags.Ephemeral });
        return;
      }
      if (await isDiscordPrivacySuppressed(interaction.user.id)) {
        await interaction.reply({ ...buildPrivacyOptInPrompt("", interaction.message.id), flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.showModal(buildVerificationModal().setCustomId(`cotf_verify_character_modal::${interaction.message.id}`));
      return;
    }
    if (interaction.customId === "cotf_verify_character" || interaction.customId.startsWith("cotf_verify_character:")) {
      const targetUserId = interaction.customId.split(":")[1] || "";
      if (targetUserId && interaction.user.id !== targetUserId) {
        await interaction.reply({
          content: "This verification button belongs to the member who just joined.",
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      if (await isDiscordPrivacySuppressed(interaction.user.id)) {
        await interaction.reply({ ...buildPrivacyOptInPrompt(targetUserId, ""), flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.showModal(buildVerificationModal(targetUserId));
      return;
    }

    return;
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith("cotf_event_role:")) {
      await handleDiscordEventRsvpInteraction(interaction);
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("cotf_event_role_modal:")) {
      await handleDiscordEventRsvpInteraction(interaction);
      return;
    }
    if (interaction.customId !== "cotf_verify_character_modal" && !interaction.customId.startsWith("cotf_verify_character_modal:")) {
      return;
    }

    const targetUserId = interaction.customId.split(":")[1] || "";
    if (targetUserId && interaction.user.id !== targetUserId) {
      await interaction.reply({
        content: "This verification form belongs to the member who just joined.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const oneTimeMessageId = interaction.customId.split(":")[2];
      if (oneTimeMessageId) {
        const consumed = await pool.query(`update portal_discord_verification_prompts set used_by=$4,used_at=now()
          where message_id=$1 and guild_id=$2 and channel_id=$3 and used_at is null returning message_id`,
          [oneTimeMessageId, interaction.guildId, interaction.channelId, interaction.user.id]);
        if (!consumed.rows.length) { await interaction.editReply("This verification prompt has already been used."); return; }
        const message = await interaction.channel.messages.fetch(oneTimeMessageId).catch(() => null);
        if (message) {
          try {
            await message.delete();
            await pool.query("update portal_discord_verification_prompts set removed_at=now() where message_id=$1",[oneTimeMessageId]);
          } catch {
            await message.edit({ components: [] }).catch(() => {});
            // The persisted used_at marker prevents reuse; background cleanup retries deletion.
          }
        }
      }
      const characterName = interaction.fields.getTextInputValue("character_name");
      const member = interaction.member;

      const result = await verifyMemberByCharacterName({
        member,
        submittedCharacterName: characterName,
        attemptType: "verify_button_modal",
        matchSource: "verify_button_modal"
      });

      if (result.ok && result.character) {
        await interaction.editReply(result.message);
        if (result.welcomeReady) await postVerifiedCharacterToWelcomeChannel(member, result.character);
      } else if (result.conflict) {
        await interaction.deleteReply().catch(() => undefined);
        const mentionedUsers = [member.id, result.primaryAdminId].filter(Boolean);
        await interaction.followUp({
          content: `<@${member.id}> ${result.message}`,
          allowedMentions: { users: mentionedUsers }
        });
      } else if (result.privacySuppressed) {
        await interaction.editReply(buildPrivacyOptInPrompt(targetUserId, oneTimeMessageId || ""));
      } else {
        await interaction.editReply(result.message);
      }
    } catch (error) {
      console.error("[cotf-bot] verification modal failed:", error.message);

      await interaction.editReply(
        "Verification failed because the bot hit an error. An officer can check the bot logs."
      );
    }

    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (interaction.commandName === DISCORD_COMMAND_NAME) {
    const faeGroup = interaction.options.getSubcommandGroup(false);
    const faeCommand = faeGroup === "share" || faeGroup === "officer" ? faeGroup : interaction.options.getSubcommand(false);
    if (!await isFaeCommandEnabled(pool, faeCommand)) {
      await interaction.reply({ ...disabledFaeCommandReply(faeCommand), flags: MessageFlags.Ephemeral });
      return;
    }
    if (faeGroup === "officer") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const settings = await getBotSettings();
        if (!interaction.inGuild() || interaction.guildId !== settings.guild_id ||
            (!await isProtectedPortalAdministrator(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild))) {
          await interaction.editReply("Only a portal administrator or a Discord officer with Manage Server permission can post verification.");
          return;
        }
        if (interaction.options.getSubcommand() !== "verify") { await interaction.editReply("Unknown officer command."); return; }
        const prompt = buildVerificationPromptMessage();
        prompt.components = [new ActionRowBuilder().addComponents(new ButtonBuilder()
          .setCustomId("cotf_officer_verify_once").setLabel("Verify Character").setStyle(ButtonStyle.Primary))];
        const message = await interaction.channel.send(prompt);
        await pool.query("insert into portal_discord_verification_prompts(message_id,guild_id,channel_id) values($1,$2,$3)",
          [message.id, interaction.guildId, interaction.channelId]);
        await writeAuditLog({ member: interaction.member, attemptType: "officer_post_verify", result: "success",
          reason: "Officer posted a verification button.", details: { channelId: interaction.channelId } });
        await interaction.editReply("Single-use verification posted in this channel. Anyone can submit it; the prompt disappears after the first submission.");
      } catch (error) {
        console.error("[cotf-bot] Officer verification prompt failed:", error.message);
        await interaction.editReply("I could not post verification. Check the bot's channel permissions.");
      }
    } else if (faeGroup === "share") {
      await handleShareCommand(interaction, pool);
    } else if (interaction.options.getSubcommand() === "chocobocolor") {
      await handleChocoboColorCommand(interaction);
    } else if (interaction.options.getSubcommand() === "craftmacro") {
      if (await isDiscordPrivacySuppressed(interaction.user.id)) await interaction.reply({ ...buildPrivacyOptInPrompt(interaction.user.id, ""), flags: MessageFlags.Ephemeral });
      else {
        const eligible=await pool.query(`select 1 from portal_discord_links dl join portal_characters c on c.id=dl.character_id where dl.discord_user_id=$1 and c.active=true and c.fc_membership_status='current' limit 1`,[interaction.user.id]);
        if(!eligible.rowCount)await interaction.reply({content:"Link a current FC character before using the crafting calculator.",flags:MessageFlags.Ephemeral});
        else await handleCraftMacroCommand(interaction, pool);
      }
    } else if (interaction.options.getSubcommand() === "map") {
      await handleTreasureMapCommand(interaction, pool, { portalUrl: PORTAL_URL });
    } else if (interaction.options.getSubcommand() === "availability") {
      if (await isDiscordPrivacySuppressed(interaction.user.id)) await interaction.reply({ ...buildPrivacyOptInPrompt(interaction.user.id, ""), flags: MessageFlags.Ephemeral });
      else await handleAvailabilityCommand(interaction,pool,{isOfficer:Boolean(await isProtectedPortalAdministrator(interaction.user.id))||Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild))});
    } else if (interaction.options.getSubcommand() === "planevent") {
      const startedAt=Date.now(),referenceId=createFaeDiagnosticReference(),commandPath=`/${DISCORD_COMMAND_NAME} planevent`;
      try {
        if (await isDiscordPrivacySuppressed(interaction.user.id)) await interaction.reply({ ...buildPrivacyOptInPrompt(interaction.user.id, ""), flags: MessageFlags.Ephemeral });
        else { await handleEventCommand(interaction, pool); await recordFaeDiagnostic(pool,interaction,{referenceId,commandPath,interactionKind:"command",outcome:"success",startedAt}); }
      } catch (error) {
        await recordFaeDiagnostic(pool,interaction,{referenceId,commandPath,interactionKind:"command",outcome:"failure",startedAt,error});
        const message=`The private event setup could not be opened. Please try again shortly.\nReference: ${referenceId}`;
        if(interaction.deferred||interaction.replied)await interaction.editReply({content:message,components:[]}).catch(()=>null);else await interaction.reply({content:message,flags:MessageFlags.Ephemeral}).catch(()=>null);
      }
    } else if (interaction.options.getSubcommand() === "character") {
      if (await isDiscordPrivacySuppressed(interaction.user.id)) await interaction.reply({ ...buildPrivacyOptInPrompt(interaction.user.id, ""), flags: MessageFlags.Ephemeral });
      else if(!altCharacterClaims)await interaction.reply({content:"Character claims are still starting. Please try again in a moment.",flags:MessageFlags.Ephemeral});
      else{
        const startedAt=Date.now(),referenceId=createFaeDiagnosticReference(),commandPath=`/${DISCORD_COMMAND_NAME} character`;
        try{
          await altCharacterClaims.command(interaction);
          await recordFaeDiagnostic(pool,interaction,{referenceId,commandPath,interactionKind:"command",outcome:"success",startedAt});
        }catch(error){
          console.error(`[cotf-bot] ${commandPath} failed (${referenceId}):`,error);
          await recordFaeDiagnostic(pool,interaction,{referenceId,commandPath,interactionKind:"command",outcome:"failure",startedAt,error});
          const message=`The character claim panel could not be opened right now. Please try again shortly.\nReference: ${referenceId}`;
          if(interaction.deferred||interaction.replied)await interaction.editReply({content:message,embeds:[],components:[]}).catch(()=>null);else await interaction.reply({content:message,flags:MessageFlags.Ephemeral}).catch(()=>null);
        }
      }
    } else {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        if (await isDiscordPrivacySuppressed(interaction.user.id)) {
          await interaction.editReply(buildPrivacyOptInPrompt(interaction.user.id, ""));
        } else {
          await handleFaeCommand(interaction, pool, { alreadyDeferred: true });
        }
      } catch (error) {
        console.error("[cotf-bot] Privacy gate configuration failed:", error.message);
        await interaction.editReply("This command is temporarily unavailable because the bot's privacy-protection secret is not configured. Ask an administrator to update the bot container settings.");
      }
    }
    return;
  }

  if (interaction.commandName === "postverify") {
    if (!await isProtectedPortalAdministrator(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "Only a portal administrator or Discord officer with Manage Server permission can post verification.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply(buildVerificationPromptMessage());
    return;
  }

  if (interaction.commandName !== "iam") {
    return;
  }

  await interaction.deferReply();

  try {
    const characterName = interaction.options.getString("character", true);
    const member = interaction.member;

    const result = await verifyMemberByCharacterName({
      member,
      submittedCharacterName: characterName,
      attemptType: "iam_command",
      matchSource: "iam_command"
    });

    if (result.ok && result.character) {
      await interaction.editReply({
        content: result.message,
        embeds: [
          buildVerifiedCharacterEmbed({
            member,
            character: result.character
          })
        ]
      });
    } else {
      await interaction.editReply(result.message);
    }
  } catch (error) {
    console.error("[cotf-bot] /iam failed:", error.message);

    await interaction.editReply(
      "Verification failed because the bot hit an error. An officer can check the bot logs."
    );
  }
});


// =========================
// SECTION 14: Shutdown Handling
// =========================

// -------------------------
// SUBSECTION 14A: Graceful container shutdown
// -------------------------

process.on("SIGTERM", async () => {
  console.log("[cotf-bot] SIGTERM received. Shutting down.");

  try {
    await closeTreasureMapOcr();
  } catch {
    // Ignore shutdown errors.
  }

  try {
    await bot.destroy();
  } catch {
    // Ignore shutdown errors.
  }

  try {
    await pool.end();
  } catch {
    // Ignore shutdown errors.
  }

  process.exit(0);
});


// =========================
// SECTION 15: Startup
// =========================

// -------------------------
// SUBSECTION 15A: Login to Discord
// -------------------------

const transientStartupDatabaseCodes = new Set(["57P01", "57P02", "57P03", "ECONNREFUSED", "ECONNRESET", "EAI_AGAIN", "ENOTFOUND", "ETIMEDOUT"]);

function isTransientStartupDatabaseError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || error || "");
  return transientStartupDatabaseCodes.has(code)
    || /database system is (starting up|shutting down|in recovery mode)|connection (terminated|refused)|getaddrinfo|timeout expired/i.test(message);
}

async function waitForDatabaseAtStartup() {
  let attempt = 0;
  while (true) {
    try {
      await pool.query("select 1");
      return;
    } catch (error) {
      if (!isTransientStartupDatabaseError(error)) throw error;
      attempt += 1;
      const waitMilliseconds = Math.min(15000, 1000 * (2 ** Math.min(attempt - 1, 4)));
      const reason = String(error?.message || error || "database unavailable").replace(/\s+/g, " ").trim();
      console.warn(`[cotf-bot] PostgreSQL is not reachable yet (${reason}); retrying in ${waitMilliseconds / 1000}s.`);
      await new Promise((resolve) => setTimeout(resolve, waitMilliseconds));
    }
  }
}

await waitForDatabaseAtStartup();
startTreasureMapCleanup(pool);
await bot.login(DISCORD_BOT_TOKEN);

