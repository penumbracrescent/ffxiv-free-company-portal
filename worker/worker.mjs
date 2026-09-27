// =========================
// SECTION: Imports
// =========================

import pg from "pg";
import * as cheerio from "cheerio";
import { createHmac } from "node:crypto";
import { ensureAchievementCollectionTables, syncAchievementAndTitleCatalogIfDue, syncCharacterAchievementsIfDue } from "./achievement-collections.mjs";
import { buildVerifiedMemberPageUrl, checkFcVerification, ensureFcVerification } from "./fc-verification.mjs";

const { Client } = pg;

function privacyFingerprint(kind, value) {
  const secret=String(process.env.PRIVACY_SUPPRESSION_SECRET||process.env.AUTH_SECRET||"").trim();
  if(!secret)throw new Error("A privacy suppression secret is required for privacy suppression.");
  return createHmac("sha256",secret).update(`${kind}:${String(value).trim()}`).digest("hex");
}

// =========================
// SECTION: Environment
// =========================

const DATABASE_URL = process.env.DATABASE_URL;
const PORTAL_NAME = String(process.env.PORTAL_NAME || "Free Company").trim() || "Free Company";
const FC_LODESTONE_URL = process.env.FC_LODESTONE_URL || "";
const FC_VERIFICATION_OPTIONS = {
  lodestoneUrl: FC_LODESTONE_URL,
  discordGuildId: process.env.DISCORD_GUILD_ID || "",
  world: process.env.DEFAULT_WORLD || "",
  datacenter: process.env.DEFAULT_DATACENTER || "",
  secret: process.env.AUTH_SECRET || "",
  sealPath: process.env.FC_VERIFICATION_SEAL_PATH || "/fc-verification/identity.json"
};

async function resolveFcVerificationOptions(client) {
  const configuredGuildId = String(FC_VERIFICATION_OPTIONS.discordGuildId || "").trim();
  if (/^\d{15,22}$/.test(configuredGuildId)) return FC_VERIFICATION_OPTIONS;
  const saved = await client.query("select guild_id from portal_discord_bot_settings where id=1 limit 1").catch(() => ({ rows: [] }));
  const savedGuildId = String(saved.rows[0]?.guild_id || "").trim();
  return { ...FC_VERIFICATION_OPTIONS, discordGuildId: savedGuildId };
}
const SYNC_INTERVAL_MINUTES = Number.parseInt(process.env.SYNC_INTERVAL_MINUTES || "720", 10);
const DEFAULT_WORLD = String(process.env.DEFAULT_WORLD || "").trim();
const DEFAULT_DATACENTER = String(process.env.DEFAULT_DATACENTER || "").trim();
if (!DEFAULT_WORLD || !DEFAULT_DATACENTER) {
  throw new Error("World/data center configuration is missing. Finish and seal setup, then recreate the containers.");
}
const MAX_FC_PAGES = Number.parseInt(process.env.MAX_FC_PAGES || "40", 10);
const MANUAL_FC_ROSTER_REQUEST_POLL_MS = 60 * 1000;
const XIVAPI_BASE_URL = "https://v2.xivapi.com";
const TEAMCRAFT_DATA_BASE_URL = process.env.TEAMCRAFT_DATA_BASE_URL || "https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/staging/libs/data/src/lib/json";
const DUTY_SYNC_LIMIT = Number(process.env.DUTY_SYNC_LIMIT || 1200);
const DUTY_SYNC_PAGE_SIZE = Number(process.env.DUTY_SYNC_PAGE_SIZE || 200);
const CRAFTING_CATALOG_SYNC_INTERVAL_HOURS = Number.parseInt(
  process.env.CRAFTING_CATALOG_SYNC_INTERVAL_HOURS || "168",
  10
);
const CRAFTING_CATALOG_PAGE_SIZE = Number.parseInt(
  process.env.CRAFTING_CATALOG_PAGE_SIZE || "200",
  10
);
const CRAFTING_CATALOG_MAX_RECIPES = Number.parseInt(
  process.env.CRAFTING_CATALOG_MAX_RECIPES || "0",
  10
);
const CRAFTING_CATALOG_SCHEMA_VERSION = 7;
const CRAFTING_WORKSHOP_SYNC_INTERVAL_HOURS = Number.parseInt(
  process.env.CRAFTING_WORKSHOP_SYNC_INTERVAL_HOURS || "168",
  10
);
/* Bump this when the transformer changes so the next worker start safely
   refreshes the official Company Workshop plans. */
const CRAFTING_WORKSHOP_SCHEMA_VERSION = 1;

const COMPANY_CRAFT_SEQUENCE_XIVAPI_FIELDS = [
  "CompanyCraftPart@as(raw)",
  "CompanyCraftDraftCategory.Name",
  "CompanyCraftType.Name",
  "ResultItem@as(raw)"
].join(",");
const COMPANY_CRAFT_PART_XIVAPI_FIELDS = [
  "CompanyCraftProcess@as(raw)",
  "CompanyCraftType.Name"
].join(",");
const COMPANY_CRAFT_PROCESS_XIVAPI_FIELDS = [
  "SetQuantity",
  "SetsRequired",
  "SupplyItem@as(raw)"
].join(",");
const COMPANY_CRAFT_SUPPLY_ITEM_XIVAPI_FIELDS = "Item@as(raw)";

const CRAFTING_RECIPE_XIVAPI_FIELDS = [
  "AmountIngredient",
  "AmountResult",
  "CanHq",
  "CollectableMetadata@as(raw)",
  "CraftType.Name",
  "DifficultyFactor",
  "DurabilityFactor",
  "Ingredient@as(raw)",
  "IsExpert",
  "ItemResult@as(raw)",
  "QualityFactor",
  "RecipeLevelTable",
  "RecipeLevelTable@as(raw)",
  "RequiredCraftsmanship",
  "RequiredControl",
  "RequiredQuality"
].join(",");

const CRAFTING_ITEM_XIVAPI_FIELDS = [
  "Name",
  "CanBeHq",
  "Icon",
  "LevelEquip",
  "LevelItem.Value",
  "ItemUICategory.Name",
  "ItemAction.Data"
].join(",");
const CRAFTING_ITEM_FOOD_XIVAPI_FIELDS = ["BaseParam@as(raw)", "IsRelative", "Max", "MaxHQ", "Value", "ValueHQ"].join(",");
const GATHERING_POINT_BASE_XIVAPI_FIELDS = [
  "GatheringType.Name",
  "Item@as(raw)"
].join(",");
const GATHERING_POINT_XIVAPI_FIELDS = [
  "GatheringPointBase@as(raw)",
  "TerritoryType.PlaceName.Name"
].join(",");

const DUTY_XIVAPI_FIELDS = [
  "Name",
  "Description",
  "ContentType.Name",
  "ClassJobLevelRequired",
  "ItemLevelRequired",
  "ContentMemberType",
  "Image",
  "Icon"
].join(",");

const MAX_MOUNT_SYNC_CHARACTERS = Number.parseInt(
  process.env.MAX_MOUNT_SYNC_CHARACTERS || "150",
  10
);
const MAX_PORTRAIT_SYNC_CHARACTERS = Number.parseInt(
  process.env.MAX_PORTRAIT_SYNC_CHARACTERS || "25",
  10
);
const PORTRAIT_SYNC_REQUEST_DELAY_MS = Number.parseInt(
  process.env.PORTRAIT_SYNC_REQUEST_DELAY_MS || "850",
  10
);
const MOUNT_SYNC_REQUEST_DELAY_MS = Number.parseInt(
  process.env.MOUNT_SYNC_REQUEST_DELAY_MS || "850",
  10
);
const DISCORD_MOUNT_WEBHOOK_URL = String(
  process.env.DISCORD_MOUNT_WEBHOOK_URL || ""
).trim();

const FFXIV_COLLECT_MOUNTS_URL = "https://ffxivcollect.com/api/mounts";
const FFXIV_COLLECT_MINIONS_URL = "https://ffxivcollect.com/api/minions";
const KNOWN_COLLECTION_SOURCE_TYPES = new Set(["Achievement", "Bozja", "Chaotic Raid", "Cosmic Exploration", "Crafting", "Deep Dungeon", "Dungeon", "Eureka", "Event", "FATE", "Gathering", "Gold Saucer", "Hunts", "Island Sanctuary", "Occult Crescent", "Other", "Premium", "Purchase", "PvP", "Quest", "Raid", "Skybuilders", "Treasure Hunt", "Trial", "Tribal", "V&C Dungeon", "Venture", "Voyages", "Wondrous Tails"]);

if (!DATABASE_URL) {
  console.error("[cotf-worker] Missing DATABASE_URL");
  process.exit(1);
}

if (!FC_LODESTONE_URL) {
  console.error("[cotf-worker] Missing FC_LODESTONE_URL");
  process.exit(1);
}

const syncIntervalMs = Math.max(SYNC_INTERVAL_MINUTES, 5) * 60 * 1000;
const PORTAL_DISPLAY_TIME_ZONE = "America/Chicago";
const PRIVACY_DEFAULT_FORMER_MEMBER_DAYS = Number.parseInt(process.env.PORTAL_FORMER_MEMBER_RETENTION_DAYS || "30",10);
const PRIVACY_DEFAULT_ACTIVITY_DAYS = Number.parseInt(process.env.PORTAL_ACTIVITY_RETENTION_DAYS || "365",10);

// =========================
// SECTION: General Helpers
// =========================

function formatCentralDateTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PORTAL_DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short"
  }).format(new Date(value));
}

function nowLabel() {
  return formatCentralDateTime(new Date());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function auditCollectionSourceTypes(client, catalogName, entries) {
  const itemsBySourceType = new Map();
  for (const entry of entries) {
    const itemName = String(entry?.name || "Unknown collection item").trim() || "Unknown collection item";
    for (const source of Array.isArray(entry?.sources) ? entry.sources : []) {
      const sourceType = String(source?.type || "Unknown").trim() || "Unknown";
      if (!itemsBySourceType.has(sourceType)) itemsBySourceType.set(sourceType, new Set());
      itemsBySourceType.get(sourceType).add(itemName);
    }
  }
  const unknown = [...itemsBySourceType.keys()].filter((sourceType) => !KNOWN_COLLECTION_SOURCE_TYPES.has(sourceType)).sort();
  for (const sourceType of unknown) {
    const affectedItems = [...itemsBySourceType.get(sourceType)].sort();
    await client.query(`
      insert into portal_collection_source_warnings (
        catalog_name, source_type, affected_count, example_items, first_observed_at, last_observed_at, resolved_at
      ) values ($1, $2, $3, $4::jsonb, now(), now(), null)
      on conflict (catalog_name, source_type) do update set
        affected_count = excluded.affected_count, example_items = excluded.example_items,
        last_observed_at = now(), resolved_at = null;
    `, [catalogName, sourceType, affectedItems.length, JSON.stringify(affectedItems.slice(0, 5))]);
  }
  await client.query(`
    update portal_collection_source_warnings set resolved_at = now()
    where catalog_name = $1 and resolved_at is null
      and not (source_type = any($2::text[]));
  `, [catalogName, unknown]);
  if (unknown.length) console.warn(`[cotf-worker] ${catalogName} returned unmapped acquisition source type(s): ${unknown.join(", ")}. Add an explicit guide or availability policy before release.`);
  return unknown;
}

async function getClient() {
  const client = new Client({
    connectionString: DATABASE_URL
  });

  await client.connect();
  return client;
}

// =========================
// SECTION: Database Schema
// =========================

async function ensureWorkerTables(client) {
  await client.query(`create table if not exists portal_privacy_settings (id integer primary key check(id=1),operator_name text not null,privacy_contact text not null,operator_region text not null default '',former_member_retention_days integer not null default 30 check(former_member_retention_days between 1 and 3650),activity_retention_days integer not null default 365 check(activity_retention_days between 1 and 3650),backup_retention_days integer not null default 90 check(backup_retention_days between 1 and 3650),additional_notice text not null default '',effective_at timestamptz not null default now(),updated_at timestamptz not null default now());`);
  await client.query(`insert into portal_privacy_settings(id,operator_name,privacy_contact,former_member_retention_days,activity_retention_days) values(1,$1,$2,$3,$4) on conflict(id) do nothing`,[PORTAL_NAME,String(process.env.PORTAL_PRIVACY_CONTACT||""),PRIVACY_DEFAULT_FORMER_MEMBER_DAYS,PRIVACY_DEFAULT_ACTIVITY_DAYS]);
  await client.query(`
    create table if not exists portal_sync_runs (
      id bigserial primary key,
      sync_type text not null,
      status text not null,
      message text,
      started_at timestamptz not null default now(),
      finished_at timestamptz
    );
  `);
  await client.query(`
    create table if not exists portal_collection_source_warnings (
      id bigserial primary key,
      catalog_name text not null,
      source_type text not null,
      affected_count integer not null default 0,
      example_items jsonb not null default '[]'::jsonb,
      first_observed_at timestamptz not null default now(),
      last_observed_at timestamptz not null default now(),
      resolved_at timestamptz,
      unique (catalog_name, source_type)
    );
  `);

  await client.query(`
    create table if not exists portal_worker_requests (
      id bigserial primary key,
      request_type text not null,
      status text not null default 'pending',
      requested_by text,
      requested_at timestamptz not null default now(),
      started_at timestamptz,
      completed_at timestamptz,
      message text
    );
  `);
  await client.query(`
    create unique index if not exists portal_worker_requests_pending_unique
    on portal_worker_requests (request_type)
    where status = 'pending';
  `);
  await client.query(`
    create table if not exists portal_fc_roster_change_log (
      id bigserial primary key,
      scan_source text not null default 'scheduled',
      change_type text not null check (change_type in ('added', 'removed')),
      character_name text not null,
      world text not null,
      lodestone_character_id text,
      detected_at timestamptz not null default now()
    );
  `);
  await client.query(`
    create index if not exists portal_fc_roster_change_log_detected_idx
    on portal_fc_roster_change_log (detected_at desc);
  `);
  await client.query(`
    create table if not exists portal_characters (
      id bigserial primary key,
      display_name text not null,
      character_name text not null,
      world text not null,
      lodestone_character_id text,
      ffxiv_collect_character_id text,
      authentik_email text,
      portrait_url text,
      avatar_url text,
      portrait_synced_at timestamptz,
      role text not null default 'Member',
      notes text,
      active boolean not null default true,
      mount_win_notifications_enabled boolean not null default true,
      fc_membership_status text not null default 'unknown',
      sync_status text not null default 'pending',
      last_fc_check_at timestamptz,
      last_mount_sync_at timestamptz,
      last_seen_in_fc_at timestamptz,
      first_seen_in_fc_at timestamptz,
      fc_rank_name text,
      fc_rank_changed_at timestamptz,
      join_date_override date,
      join_date_source text not null default 'unknown',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await client.query(`
    alter table portal_characters
      add column if not exists ffxiv_collect_character_id text,
      add column if not exists mount_win_notifications_enabled boolean not null default true,
      add column if not exists fc_membership_status text not null default 'unknown',
      add column if not exists sync_status text not null default 'pending',
      add column if not exists last_fc_check_at timestamptz,
      add column if not exists last_mount_sync_at timestamptz,
      add column if not exists last_seen_in_fc_at timestamptz,
      add column if not exists first_seen_in_fc_at timestamptz,
      add column if not exists fc_rank_name text,
      add column if not exists fc_rank_changed_at timestamptz,
      add column if not exists join_date_override date,
      add column if not exists join_date_source text not null default 'unknown',
      add column if not exists portrait_url text,
      add column if not exists avatar_url text,
      add column if not exists portrait_synced_at timestamptz,
      add column if not exists privacy_suppressed boolean not null default false;
  `);
  await client.query(`create table if not exists portal_privacy_suppressions (id bigserial primary key,discord_fingerprint text not null unique,lodestone_fingerprint text,status text not null default 'active' check(status in ('active','opted_back_in')),requested_by_kind text not null default 'member',policy_version text not null default '2026-09-06',requested_at timestamptz not null default now(),opted_back_in_at timestamptz); alter table portal_privacy_suppressions drop constraint if exists portal_privacy_suppressions_lodestone_fingerprint_key; create table if not exists portal_privacy_suppressed_characters(discord_fingerprint text not null,lodestone_fingerprint text not null,created_at timestamptz not null default now(),primary key(discord_fingerprint,lodestone_fingerprint));`);
  await client.query(`create table if not exists portal_discord_links (discord_user_id text primary key,discord_username text,discord_global_name text,discord_nickname text,discord_display_name text,character_id integer references portal_characters(id) on delete set null,match_source text not null default 'unknown',matched_at timestamptz,last_seen_at timestamptz not null default now(),created_at timestamptz not null default now(),updated_at timestamptz not null default now());`);
  await client.query(`alter table portal_discord_links add column if not exists privacy_mode text not null default 'full';`);
  await client.query(`create table if not exists portal_alt_character_limits(discord_user_id text primary key,max_additional_characters integer not null check(max_additional_characters between 0 and 32),updated_by_discord_user_id text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());`);
  await client.query(`create table if not exists portal_alt_character_links(id bigserial primary key,discord_user_id text not null,character_id bigint not null references portal_characters(id) on delete cascade,is_primary boolean not null default false,verification_method text not null,verified_by_discord_user_id text,verified_at timestamptz not null default now(),active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(discord_user_id,character_id));`);
  await client.query(`create unique index if not exists portal_alt_character_one_owner_idx on portal_alt_character_links(character_id) where active=true;`);

  await client.query(`
    update portal_characters
    set
      first_seen_in_fc_at = coalesce(first_seen_in_fc_at, created_at, last_seen_in_fc_at, now()),
      join_date_source = case
        when join_date_override is not null then 'manual'
        when join_date_source is null or join_date_source = 'unknown' then 'first_seen'
        else join_date_source
      end
    where fc_membership_status not in ('retention_expired', 'privacy_opt_out')
      and (first_seen_in_fc_at is null
       or join_date_source is null
       or join_date_source = 'unknown');
  `);

  await client.query(`
    create table if not exists portal_character_fc_rank_history (
      id bigserial primary key,
      character_id bigint not null references portal_characters(id) on delete cascade,
      old_rank_name text not null,
      new_rank_name text not null,
      old_rank_started_at timestamptz,
      detected_at timestamptz not null default now()
    );
  `);
  await client.query(`
    create index if not exists portal_character_fc_rank_history_character_idx
    on portal_character_fc_rank_history (character_id, detected_at desc);
  `);

  await client.query(`
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

  await client.query(`
    create unique index if not exists portal_character_rename_history_unique
    on portal_character_rename_history (character_id, old_name, new_name);
  `);
  await client.query(`
    create unique index if not exists portal_characters_lodestone_character_id_unique
    on portal_characters (lodestone_character_id)
    where lodestone_character_id is not null;
  `);

  await client.query(`
    create table if not exists portal_mount_sets (
      id bigserial primary key,
      name text not null unique,
      expansion text not null,
      sort_order integer not null default 100,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await client.query(`
    create table if not exists portal_mounts (
      id bigserial primary key,
      mount_name text not null,
      source_name text,
      description text,
      acquisition_data jsonb not null default '[]'::jsonb,
      ffxiv_collect_mount_id text,
      patch text,
      icon_url text,
      image_url text,
      owned_percent text,
      mount_category text not null default 'Other',
      farm_priority text not null default 'optional',
      manual_override boolean not null default false,
      mount_set_id bigint references portal_mount_sets(id) on delete set null,
      sort_order integer not null default 100,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (mount_name)
    );
  `);

  await client.query(`
    alter table portal_mounts
      add column if not exists description text,
      add column if not exists acquisition_data jsonb not null default '[]'::jsonb,
      add column if not exists patch text,
      add column if not exists icon_url text,
      add column if not exists image_url text,
      add column if not exists owned_percent text,
      add column if not exists mount_category text not null default 'Other',
      add column if not exists farm_priority text not null default 'optional',
      add column if not exists manual_override boolean not null default false;
  `);

  await client.query(`alter table portal_mounts add column if not exists marketboard_item_id bigint, add column if not exists marketboard_item_name text, add column if not exists marketboard_eligible boolean not null default false, add column if not exists marketboard_mapping_source text;`);
  await client.query(`create table if not exists portal_marketboard_item_prices (item_id bigint not null, world_name text not null, data_center_name text, min_price bigint, median_price bigint, average_sale_price numeric, daily_sale_velocity numeric, updated_at timestamptz not null default now(), primary key (item_id, world_name));`);
  await client.query(`
    create table if not exists portal_minions (
      id bigserial primary key,
      minion_name text not null unique,
      source_name text,
      description text,
      acquisition_data jsonb not null default '[]'::jsonb,
      ffxiv_collect_minion_id text,
      patch text,
      icon_url text,
      image_url text,
      marketboard_item_id bigint,
      marketboard_item_name text,
      marketboard_eligible boolean not null default false,
      updated_at timestamptz not null default now()
    );
  `);
  await client.query(`alter table portal_minions add column if not exists description text, add column if not exists acquisition_data jsonb not null default '[]'::jsonb, add column if not exists marketboard_item_id bigint, add column if not exists marketboard_item_name text, add column if not exists marketboard_eligible boolean not null default false;`);
  await client.query(`create table if not exists portal_marketboard_minion_prices (item_id bigint not null, world_name text not null, data_center_name text, min_price bigint, updated_at timestamptz not null default now(), primary key (item_id, world_name));`);
  await client.query(`
    create unique index if not exists portal_mounts_ffxiv_collect_mount_id_unique
    on portal_mounts (ffxiv_collect_mount_id)
    where ffxiv_collect_mount_id is not null;
  `);

  // ==========================================================
  // DUTY CATALOG TABLE
  // ==========================================================

  await client.query(`
    create table if not exists portal_discord_duties (
      id bigserial primary key,
      xivapi_id integer not null,
      name text not null,
      description text,
      duty_type text not null default 'Other',
      level_required integer,
      item_level_required integer,
      party_size integer,
      image_url text,
      is_active boolean not null default true,
      xivapi_data jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  /*
    These ALTER statements make the worker tolerant of the portal
    having created an earlier or smaller version of the table.
  */
  await client.query(`
    alter table portal_discord_duties
      add column if not exists xivapi_id integer,
      add column if not exists name text,
      add column if not exists description text,
      add column if not exists duty_type text default 'Other',
      add column if not exists level_required integer,
      add column if not exists item_level_required integer,
      add column if not exists party_size integer,
      add column if not exists image_url text,
      add column if not exists is_active boolean default true,
      add column if not exists xivapi_data jsonb,
      add column if not exists created_at timestamptz default now(),
      add column if not exists updated_at timestamptz default now();
  `);

  /*
    The unique XIVAPI ID allows ON CONFLICT (xivapi_id) to update
    an existing duty instead of creating duplicates every sync.
  */
  await client.query(`
    create unique index if not exists portal_discord_duties_xivapi_id_unique
    on portal_discord_duties (xivapi_id);
  `);

  await client.query(`
    create index if not exists portal_discord_duties_type_index
    on portal_discord_duties (duty_type);
  `);

  await client.query(`
    create index if not exists portal_discord_duties_active_index
    on portal_discord_duties (is_active);
  `);

  await client.query(`
    create table if not exists portal_character_mounts (
      character_id bigint not null references portal_characters(id) on delete cascade,
      mount_id bigint not null references portal_mounts(id) on delete cascade,
      owned boolean not null default false,
      ownership_source text not null default 'unknown',
      obtained_at timestamptz,
      last_checked_at timestamptz,
      updated_at timestamptz not null default now(),
      primary key (character_id, mount_id)
    );
  `);

  await client.query(`alter table portal_characters add column if not exists mount_ownership_initialized_at timestamptz, add column if not exists mount_ownership_source text, add column if not exists last_mount_sync_count integer, add column if not exists last_mount_sync_result text;`);

  await client.query(`
    create table if not exists portal_character_minions (
      character_id bigint not null references portal_characters(id) on delete cascade,
      minion_id bigint not null references portal_minions(id) on delete cascade,
      owned boolean not null default false,
      ownership_source text not null default 'unknown',
      obtained_at timestamptz,
      last_checked_at timestamptz,
      updated_at timestamptz not null default now(),
      primary key (character_id, minion_id)
    );
  `);

  await client.query(`
    alter table portal_characters
      add column if not exists minion_ownership_initialized_at timestamptz,
      add column if not exists minion_ownership_source text,
      add column if not exists last_minion_sync_at timestamptz,
      add column if not exists last_minion_sync_count integer,
      add column if not exists last_minion_sync_result text,
      add column if not exists minion_sync_status text not null default 'pending';
  `);

  await client.query(`
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

  await client.query(`
    alter table portal_mount_acquisitions
      add column if not exists discord_sent_at timestamptz,
      add column if not exists discord_error text,
      add column if not exists is_test boolean not null default false;
  `);

  await client.query(`
    create or replace function portal_record_mount_acquisition()
    returns trigger as $$
    begin
      if old.owned = false
        and new.owned = true
        and coalesce(current_setting('portal.suppress_mount_acquisition', true), '') <> 'true' then
        insert into portal_mount_acquisitions (
          character_id,
          mount_id,
          character_name,
          mount_name,
          detected_at
        )
        select
          new.character_id,
          new.mount_id,
          coalesce(c.display_name, c.character_name, 'Unknown Character'),
          coalesce(m.mount_name, 'Unknown Mount'),
          now()
        from portal_characters c
        join portal_mounts m on m.id = new.mount_id
        where c.id = new.character_id
          and m.active = true
        on conflict (character_id, mount_id) do nothing;
      end if;

      return new;
    end;
    $$ language plpgsql;
  `);

  await client.query(`
    drop trigger if exists portal_mount_acquisition_update on portal_character_mounts;

    create trigger portal_mount_acquisition_update
    after update of owned on portal_character_mounts
    for each row
    when (old.owned is distinct from new.owned)
    execute function portal_record_mount_acquisition();
  `);

  const defaultMountSets = [
    ["ARR Extreme Trial Mounts", "A Realm Reborn", 10],
    ["Heavensward Extreme Trial Mounts", "Heavensward", 20],
    ["Stormblood Extreme Trial Mounts", "Stormblood", 30],
    ["Shadowbringers Extreme Trial Mounts", "Shadowbringers", 40],
    ["Endwalker Extreme Trial Mounts", "Endwalker", 50],
    ["Dawntrail Extreme Trial Mounts", "Dawntrail", 60],
    ["Variant / Criterion Dungeon Mounts", "Variant / Criterion", 65],
    ["Savage / Raid Mounts", "Raid", 70],
    ["Other Priority Mounts", "Other", 80]
  ];

  for (const [name, expansion, sortOrder] of defaultMountSets) {
    await client.query(
      `
        insert into portal_mount_sets (name, expansion, sort_order)
        values ($1, $2, $3)
        on conflict (name)
        do update set
          expansion = excluded.expansion,
          sort_order = excluded.sort_order,
          updated_at = now();
      `,
      [name, expansion, sortOrder]
    );
  }
}

async function tableColumnExists(client,table,column){return Boolean((await client.query(`select exists(select 1 from information_schema.columns where table_schema='public' and table_name=$1 and column_name=$2) ok`,[table,column])).rows[0]?.ok)}
async function cleanupPrivacyRetention(client){
  const settings=(await client.query(`select former_member_retention_days,activity_retention_days from portal_privacy_settings where id=1`)).rows[0]||{};
  const formerDays=Math.max(1,Number(settings.former_member_retention_days)||PRIVACY_DEFAULT_FORMER_MEMBER_DAYS),activityDays=Math.max(1,Number(settings.activity_retention_days)||PRIVACY_DEFAULT_ACTIVITY_DAYS);
  const hasLinks=await tableColumnExists(client,"portal_discord_links","discord_user_id");
  if(!hasLinks)return `Privacy retention cleanup deferred until the Discord link table is initialized.`;
  const former=(await client.query(`select c.id,array_remove(array_agg(dl.discord_user_id),null) discord_ids from portal_characters c left join portal_discord_links dl on dl.character_id=c.id where c.active=false and c.fc_membership_status not in ('retention_expired','privacy_opt_out') and coalesce(c.last_seen_in_fc_at,c.last_fc_check_at,c.updated_at)<now()-($1::text||' days')::interval group by c.id`,[formerDays])).rows;
  const characterTargets=[["portal_crafting_activity","actor_character_id"],["portal_crafting_claims","claimant_character_id"],["portal_crafting_contributions","contributor_character_id"],["portal_discord_event_signups","character_id"],["portal_character_fc_rank_history","character_id"],["portal_character_rename_history","character_id"],["portal_mount_acquisitions","character_id"],["portal_character_achievement_sync_state","character_id"],["portal_character_achievements","character_id"],["portal_character_minions","character_id"],["portal_character_mounts","character_id"]];
  const discordTargets=[["portal_alt_character_claims","discord_user_id"],["portal_alt_character_limits","discord_user_id"],["portal_alt_character_links","discord_user_id"],["portal_crafting_activity","actor_discord_user_id"],["portal_crafting_claims","claimant_discord_user_id"],["portal_crafting_contributions","contributor_discord_user_id"],["portal_giveaway_votes","voter_discord_user_id"],["portal_giveaway_submissions","discord_user_id"],["portal_giveaway_entries","discord_user_id"],["portal_community_gallery_posts","discord_user_id"],["portal_command_diagnostics","discord_user_id"],["portal_discord_audit_log","discord_user_id"],["portal_discord_action_queue","discord_user_id"],["portal_discord_roster_overrides","discord_user_id"],["portal_discord_roster_review_decisions","discord_user_id"],["portal_discord_member_snapshots","discord_user_id"],["portal_discord_guest_access","discord_user_id"],["portal_member_preferences","discord_user_id"],["portal_discord_links","discord_user_id"]];
  discordTargets.unshift(["portal_crafter_profiles","discord_user_id"]);
  let removed=0,anonymized=0;
  await client.query("begin");
  try{
    for(const row of former){
      const characterId=Number(row.id),discordIds=row.discord_ids||[];
      if(discordIds.length){
        if(await tableColumnExists(client,"portal_crafting_projects","created_by_discord_user_id"))await client.query(`update portal_crafting_projects set lead_character_id=null,created_by_character_id=null,created_by_discord_user_id=null where lead_character_id=$1 or created_by_character_id=$1 or created_by_discord_user_id=any($2::text[])`,[characterId,discordIds]);
        if(await tableColumnExists(client,"portal_crafting_project_discord_posts","posted_by_discord_user_id"))await client.query(`update portal_crafting_project_discord_posts set posted_by_character_id=null,posted_by_discord_user_id=null where posted_by_character_id=$1 or posted_by_discord_user_id=any($2::text[])`,[characterId,discordIds]);
        if(await tableColumnExists(client,"portal_giveaway_audit","actor_discord_user_id"))await client.query(`update portal_giveaway_audit set actor_discord_user_id=null,actor_character_id=null,actor_label='Former member',details=details-'discordUserId'-'characterId' where actor_discord_user_id=any($1::text[]) or actor_character_id=$2`,[discordIds,characterId]);
        if(await tableColumnExists(client,"portal_discord_event_audit_log","changed_by"))await client.query(`update portal_discord_event_audit_log set changed_by='Former member' where changed_by=any($1::text[])`,[discordIds]);
      }
      if(await tableColumnExists(client,"portal_giveaway_results","character_id"))await client.query(`update portal_giveaway_results set character_name_snapshot='Former member' where character_id=$1`,[characterId]);
      for(const [table,column] of characterTargets)if(await tableColumnExists(client,table,column)){const result=await client.query(`delete from ${table} where ${column}=$1`,[characterId]);removed+=result.rowCount||0;}
      if(discordIds.length)for(const [table,column] of discordTargets)if(await tableColumnExists(client,table,column)){const result=await client.query(`delete from ${table} where ${column}=any($1::text[])`,[discordIds]);removed+=result.rowCount||0;}
      const result=await client.query(`update portal_characters set display_name='Former member',character_name='Former member',world='Removed',lodestone_character_id=null,ffxiv_collect_character_id=null,authentik_email=null,portrait_url=null,avatar_url=null,portrait_synced_at=null,role='Former Member',fc_rank_name=null,fc_rank_changed_at=null,notes=null,mount_win_notifications_enabled=false,fc_membership_status='retention_expired',sync_status='retention_expired',last_fc_check_at=null,last_mount_sync_at=null,last_seen_in_fc_at=null,first_seen_in_fc_at=null,join_date_override=null,join_date_source='retention_expired',updated_at=now() where id=$1`,[characterId]);
      anonymized+=result.rowCount||0;
    }
    for(const [table,column] of [["portal_discord_audit_log","created_at"],["portal_discord_event_audit_log","created_at"],["portal_giveaway_audit","created_at"],["portal_fc_roster_change_log","detected_at"],["portal_privacy_requests","requested_at"]])if(await tableColumnExists(client,table,column)){const result=await client.query(`delete from ${table} where ${column}<now()-($1::text||' days')::interval`,[activityDays]);removed+=result.rowCount||0;}
    await client.query("commit");
  }catch(error){await client.query("rollback");throw error;}
  return `Privacy retention cleanup complete. ${removed} expired record(s) removed and ${anonymized} former character record(s) deidentified; former-member threshold ${formerDays} days, activity/audit threshold ${activityDays} days.`;
}

// =========================
// SECTION: Crafting Catalog Schema
// =========================

/* The worker owns only the live item/recipe catalog. The portal owns the
   project, contribution, and claim tables. Keeping this subset here lets a
   fresh worker safely start before the portal has served its first request. */
async function ensureCraftingCatalogTables(client) {
  await client.query(`
    create table if not exists portal_crafting_items (
      id bigserial primary key,
      external_key text not null unique,
      name text not null,
      icon_url text,
      can_be_hq boolean not null default false,
      is_raw boolean not null default false,
      source_kind text not null default 'development_fixture',
      xivapi_id integer,
      item_category text,
      level_equip integer,
      item_level integer,
      acquisition_data jsonb,
      last_synced_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    alter table portal_crafting_items
      add column if not exists xivapi_id integer,
      add column if not exists item_category text,
      add column if not exists level_equip integer,
      add column if not exists item_level integer,
      add column if not exists acquisition_data jsonb,
      add column if not exists last_synced_at timestamptz;
    create unique index if not exists portal_crafting_items_xivapi_id_idx
      on portal_crafting_items(xivapi_id) where xivapi_id is not null;

    create table if not exists portal_crafting_recipes (
      id bigserial primary key,
      output_item_id bigint not null references portal_crafting_items(id) on delete cascade,
      output_quantity integer not null check (output_quantity > 0),
      preferred boolean not null default false,
      source_kind text not null default 'development_fixture',
      xivapi_id integer,
      craft_job text,
      last_synced_at timestamptz,
      created_at timestamptz not null default now()
    );
    alter table portal_crafting_recipes
      add column if not exists xivapi_id integer,
      add column if not exists craft_job text,
      add column if not exists recipe_level integer,
      add column if not exists class_job_level integer,
      add column if not exists durability integer,
      add column if not exists difficulty integer,
      add column if not exists quality integer,
      add column if not exists conditions_flag integer,
      add column if not exists progress_divider integer,
      add column if not exists quality_divider integer,
      add column if not exists progress_modifier integer,
      add column if not exists quality_modifier integer,
      add column if not exists required_craftsmanship integer,
      add column if not exists required_control integer,
      add column if not exists required_quality integer,
      add column if not exists stars integer,
      add column if not exists can_hq boolean not null default false,
      add column if not exists is_expert boolean not null default false,
      add column if not exists is_collectable boolean not null default false,
      add column if not exists last_synced_at timestamptz;
    create unique index if not exists portal_crafting_recipes_xivapi_id_idx
      on portal_crafting_recipes(xivapi_id) where xivapi_id is not null;
    create unique index if not exists portal_crafting_recipes_preferred_output_idx
      on portal_crafting_recipes(output_item_id) where preferred;

    create table if not exists portal_crafting_recipe_ingredients (
      recipe_id bigint not null references portal_crafting_recipes(id) on delete cascade,
      item_id bigint not null references portal_crafting_items(id),
      quantity integer not null check (quantity > 0),
      primary key (recipe_id, item_id)
    );

    create table if not exists portal_crafting_consumables (
      id bigserial primary key,
      item_id bigint not null references portal_crafting_items(id) on delete cascade,
      item_food_xivapi_id integer not null,
      consumable_type text not null check (consumable_type in ('food', 'medicine')),
      bonuses jsonb not null default '[]'::jsonb,
      last_synced_at timestamptz not null default now(),
      unique (item_id, item_food_xivapi_id)
    );
    create index if not exists portal_crafting_consumables_type_idx on portal_crafting_consumables(consumable_type);

    create table if not exists portal_crafting_item_sources (
      id bigserial primary key,
      item_id bigint not null references portal_crafting_items(id) on delete cascade,
      external_key text not null unique,
      source_type text not null check (source_type in ('gathering', 'vendor', 'other')),
      source_name text,
      location_name text,
      details jsonb not null default '{}'::jsonb,
      source_kind text not null default 'xivapi',
      last_synced_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists portal_crafting_item_sources_item_idx
      on portal_crafting_item_sources(item_id, source_type);

    create table if not exists portal_crafting_source_sync_state (
      source_key text primary key,
      last_successful_sync_at timestamptz,
      last_attempt_at timestamptz,
      last_error text,
      updated_at timestamptz not null default now()
    );
    insert into portal_crafting_source_sync_state (source_key)
      values ('gathering'), ('teamcraft_sources'), ('teamcraft_sources_v2') on conflict (source_key) do nothing;
    create table if not exists portal_crafting_catalog_sync_state (
      id smallint primary key default 1 check (id = 1),
      last_successful_sync_at timestamptz,
      last_attempt_at timestamptz,
      last_error text,
      updated_at timestamptz not null default now()
    );
    alter table portal_crafting_catalog_sync_state
      add column if not exists catalog_version integer not null default 0,
      add column if not exists source_version text;
    insert into portal_crafting_catalog_sync_state (id)
      values (1) on conflict (id) do nothing;
  `);
}
// =========================
// =========================
// SECTION: Company Workshop Schema
// =========================

async function ensureCompanyWorkshopTables(client) {
  await client.query(`
    create table if not exists portal_crafting_workshop_templates (
      id bigserial primary key,
      external_key text not null unique,
      name text not null,
      category text not null,
      description text,
      is_development_fixture boolean not null default true,
      source_kind text not null default 'development_fixture',
      xivapi_id integer,
      active boolean not null default true,
      last_synced_at timestamptz,
      created_at timestamptz not null default now()
    );
    alter table portal_crafting_workshop_templates
      add column if not exists source_kind text not null default 'development_fixture',
      add column if not exists xivapi_id integer,
      add column if not exists last_synced_at timestamptz;
    create unique index if not exists portal_crafting_workshop_templates_xivapi_id_idx
      on portal_crafting_workshop_templates(xivapi_id) where xivapi_id is not null;
    create table if not exists portal_crafting_workshop_template_phases (
      id bigserial primary key,
      template_id bigint not null references portal_crafting_workshop_templates(id) on delete cascade,
      phase_number integer not null check (phase_number > 0),
      title text not null,
      description text,
      unique (template_id, phase_number)
    );
    create table if not exists portal_crafting_workshop_template_materials (
      id bigserial primary key,
      template_phase_id bigint not null references portal_crafting_workshop_template_phases(id) on delete cascade,
      item_id bigint not null references portal_crafting_items(id),
      base_quantity integer not null check (base_quantity > 0),
      workshop_batch_quantity integer not null default 1 check (workshop_batch_quantity > 0),
      base_batch_count integer not null default 1 check (base_batch_count > 0),
      sort_order integer not null default 0,
      unique (template_phase_id, item_id)
    );
    create table if not exists portal_crafting_workshop_sync_state (
      id smallint primary key default 1 check (id = 1),
      last_successful_sync_at timestamptz,
      last_attempt_at timestamptz,
      last_error text,
      sync_version integer not null default 0,
      source_version text,
      updated_at timestamptz not null default now()
    );
    insert into portal_crafting_workshop_sync_state (id)
      values (1) on conflict (id) do nothing;
  `);
}
// SECTION: Sync Run Logging
// =========================

async function startSyncRun(client, syncType) {
  const result = await client.query(
    `
      insert into portal_sync_runs (sync_type, status, message)
      values ($1, 'running', $2)
      returning id;
    `,
    [syncType, "Worker sync started."]
  );

  return result.rows[0].id;
}

async function finishSyncRun(client, runId, status, message) {
  await client.query(
    `
      update portal_sync_runs
      set
        status = $2,
        message = $3,
        finished_at = now()
      where id = $1;
    `,
    [runId, status, message]
  );
}

async function runLoggedSync(client, syncType, callback) {
  const runId = await startSyncRun(client, syncType);

  try {
    const message = await callback();
    await finishSyncRun(client, runId, "success", message);
    console.log(`[cotf-worker] ${nowLabel()} ${message}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishSyncRun(client, runId, "failed", message);
    console.error(`[cotf-worker] ${nowLabel()} ${syncType} failed: ${message}`);
  }
}

// =========================
// SECTION: HTTP Helpers
// =========================

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Children-of-the-Fae-Portal/0.1 (+private FC sync worker)",
      Accept: "application/json"
    }
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(`Fetch failed ${response.status} ${response.statusText} for ${url}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Children-of-the-Fae-Portal/0.1 (+private FC sync worker)",
      Accept: "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} ${response.statusText} for ${url}`);
  }

  return response.text();
}

// =========================
// SECTION: Duty Catalog Helpers
// =========================

function normalizeDutyRows(payload) {
  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }

  return [];
}

/*
  XIVAPI relationship fields generally have a structure similar to:

  {
    value: 2,
    row_id: 2,
    fields: {
      Name: "Trials"
    }
  }

  This helper safely returns the nested fields object.
*/
function getXivapiRelationshipFields(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  if (value.fields && typeof value.fields === "object") {
    return value.fields;
  }

  return {};
}

function getXivapiRelationshipName(value) {
  const fields = getXivapiRelationshipFields(value);
  return String(fields.Name || "").trim();
}

function toPositiveInteger(value) {
  const parsedValue = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

/*
  Convert the ContentType name returned by XIVAPI into the simpler
  categories the portal needs.

  Examples:
  "Dungeons" -> "Dungeon"
  "Trials"   -> "Trial"
  "Raids"    -> "Raid"

  Content types outside these categories are skipped for now.
*/
function classifyDutyType(contentTypeName) {
  const normalized = String(contentTypeName || "").trim().toLowerCase();

  if (normalized.includes("raid")) {
    return "Raid";
  }

  if (normalized.includes("trial")) {
    return "Trial";
  }

  if (normalized.includes("dungeon")) {
    return "Dungeon";
  }

  return null;
}

/*
  ContentMemberType describes the expected party makeup.

  Field names may vary slightly with XIVAPI's schema, so this starts
  conservatively. The raw XIVAPI data is also saved in the database
  so this can be tuned after the first successful sync.
*/
function calculateDutyPartySize(contentMemberType) {
  const fields = getXivapiRelationshipFields(contentMemberType);

  const tanks = toPositiveInteger(fields.TanksPerParty) ?? 0;
  const healers = toPositiveInteger(fields.HealersPerParty) ?? 0;
  const melee = toPositiveInteger(fields.MeleesPerParty) ?? 0;
  const ranged = toPositiveInteger(fields.RangedPerParty) ?? 0;

  const total = tanks + healers + melee + ranged;

  return total > 0 ? total : null;
}

/*
  XIVAPI icon/image fields can contain a game asset path.

  Example game path:
  ui/icon/060000/060123.tex

  XIVAPI's browser-ready asset endpoint converts that path to PNG.
*/
function extractXivapiAssetPath(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value !== "object") {
    return "";
  }

  return String(
    value.path_hr1 ||
      value.path ||
      value.PathHD ||
      value.Path ||
      value.fields?.PathHD ||
      value.fields?.Path ||
      ""
  ).trim();
}

function buildXivapiAssetUrl(value) {
  const assetPath = extractXivapiAssetPath(value);

  if (!assetPath) {
    return null;
  }

  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath;
  }

  const url = new URL(`${XIVAPI_BASE_URL}/api/asset`);
  url.searchParams.set("path", assetPath);
  url.searchParams.set("format", "png");

  return url.toString();
}

/*
  Turn one ContentFinderCondition row into the format stored in
  portal_discord_duties.
*/
function normalizeDutyRow(row) {
  const xivapiId = Number.parseInt(String(row?.row_id ?? ""), 10);
  const fields = row?.fields || {};

  if (!Number.isFinite(xivapiId)) {
    return null;
  }

  const name = String(fields.Name || "").trim();

  if (!name) {
    return null;
  }

  const contentTypeName = getXivapiRelationshipName(fields.ContentType);
  const dutyType = classifyDutyType(contentTypeName);

  /*
    For this foundation, only dungeon/trial/raid-related content is
    inserted. PvP, guildhests, roulettes, and miscellaneous internal
    rows are skipped.
  */
  if (!dutyType) {
    return null;
  }

  const imageUrl =
    buildXivapiAssetUrl(fields.Image) ||
    buildXivapiAssetUrl(fields.Icon);

  return {
    xivapiId,
    name,
    description: String(fields.Description || "").trim(),
    dutyType,
    levelRequired: toPositiveInteger(fields.ClassJobLevelRequired),
    itemLevelRequired: toPositiveInteger(fields.ItemLevelRequired),
    partySize: calculateDutyPartySize(fields.ContentMemberType),
    imageUrl,
    xivapiData: row
  };
}

/*
  Download ContentFinderCondition in row-ID order.

  XIVAPI's `after` parameter means:
  return rows whose IDs are greater than this value.
*/
async function fetchDutyCatalogRows() {
  const maximumRows =
    Number.isFinite(DUTY_SYNC_LIMIT) && DUTY_SYNC_LIMIT > 0
      ? Math.floor(DUTY_SYNC_LIMIT)
      : 1200;

  const configuredPageSize =
    Number.isFinite(DUTY_SYNC_PAGE_SIZE) && DUTY_SYNC_PAGE_SIZE > 0
      ? Math.floor(DUTY_SYNC_PAGE_SIZE)
      : 200;

  const allRows = [];
  let afterRowId = null;

  while (allRows.length < maximumRows) {
    const remainingRows = maximumRows - allRows.length;
    const pageSize = Math.min(configuredPageSize, remainingRows);

    const url = new URL(
      `${XIVAPI_BASE_URL}/api/sheet/ContentFinderCondition`
    );

    url.searchParams.set("fields", DUTY_XIVAPI_FIELDS);
    url.searchParams.set("language", "en");
    url.searchParams.set("limit", String(pageSize));

    if (afterRowId !== null) {
      url.searchParams.set("after", String(afterRowId));
    }

    const payload = await fetchJson(url.toString());
    const pageRows = normalizeDutyRows(payload);

    if (pageRows.length === 0) {
      break;
    }

    allRows.push(...pageRows);

    const lastRowId = Number.parseInt(
      String(pageRows[pageRows.length - 1]?.row_id ?? ""),
      10
    );

    if (!Number.isFinite(lastRowId)) {
      throw new Error(
        "XIVAPI duty pagination returned a row without a valid row_id."
      );
    }

    if (lastRowId === afterRowId) {
      throw new Error(
        `XIVAPI duty pagination stopped advancing at row ${lastRowId}.`
      );
    }

    afterRowId = lastRowId;

    console.log(
      `[cotf-worker] Duty catalog fetch: ${allRows.length}/${maximumRows} rows received.`
    );

    await sleep(250);
  }

  return allRows.slice(0, maximumRows);
}

// =========================
// SECTION: Discord Announcements
// =========================

function limitDiscordText(value, maxLength = 950) {
  const text = String(value || "").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}…`;
}

function buildMountWinDiscordPayload(group) {
  const characterNames = group.character_names.filter(Boolean);
  const characterList = characterNames.join(", ");

  const content =
    characterNames.length === 1
      ? `Congratulations ${characterNames[0]} on collecting ${group.mount_name}!`
      : `Congratulations on collecting ${group.mount_name}: ${characterList}!`;

  return {
    username: PORTAL_NAME,
    content,
    embeds: [
      {
        title: "Mount Win!",
        description: content,
        color: 10040063,
        fields: [
          {
            name: "Mount",
            value: limitDiscordText(group.mount_name),
            inline: true
          },
          {
            name: "Expansion",
            value: limitDiscordText(group.expansion || "Mount"),
            inline: true
          },
          {
            name: "Character(s)",
            value: limitDiscordText(characterNames.join("\n") || "Unknown"),
            inline: false
          },
          {
            name: "Source",
            value: limitDiscordText(
              group.source_name || group.set_name || "Mount acquisition detected"
            ),
            inline: false
          }
        ],
        timestamp: new Date().toISOString()
      }
    ]
  };
}

async function postDiscordWebhook(payload) {
  if (!DISCORD_MOUNT_WEBHOOK_URL) {
    return {
      sent: false,
      message: "Discord webhook URL is not configured."
    };
  }

  const response = await fetch(DISCORD_MOUNT_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Discord webhook failed: ${response.status} ${errorText}`.trim());
  }

  return {
    sent: true,
    message: "Discord webhook sent."
  };
}

async function sendPendingMountDiscordAnnouncements() {
  return "Mount wins are queued for Discord bot delivery.";
}

// =========================
// SECTION: Mount Catalog Helpers
// =========================

function normalizeMountPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.mounts)) return payload.mounts;
  return [];
}

function sourceTextForMount(mount) {
  if (Array.isArray(mount.sources) && mount.sources.length > 0) {
    const first = mount.sources[0];

    return [first.type, first.text]
      .filter(Boolean)
      .join(": ")
      .trim();
  }

  return "";
}

function getPrimarySourceType(mount) {
  if (Array.isArray(mount.sources) && mount.sources.length > 0) {
    return String(mount.sources[0].type || "").trim();
  }

  return "";
}

const VARIANT_CRITERION_MOUNT_NAMES = new Set([
  "silkie",
  "sil'dihn throne",
  "burabura chochin",
  "shishioji",
  "spectral statice",
  "quaqua",
  "royal magicked carpet",
  "genie of the lamp"
]);

function isVariantCriterionMount(mount) {
  const mountName = String(mount?.name || "").trim().toLowerCase();
  const sources = JSON.stringify(mount?.sources || "").toLowerCase();
  return VARIANT_CRITERION_MOUNT_NAMES.has(mountName) ||
    sources.includes("the sil'dihn subterrane") ||
    sources.includes("dig deep: the sil'dihn subterrane") ||
    sources.includes("mononopeke") ||
    sources.includes("mount rokkon") ||
    sources.includes("aloalo island") ||
    sources.includes("merchant's tale") ||
    sources.includes("corvosi manuscript") ||
    sources.includes("corvosi brass") ||
    sources.includes("good-willed hunting");
}

function classifyMountMetadata(mount) {
  const sourceType = getPrimarySourceType(mount);
  const sourceText = sourceTextForMount(mount);
  const combined = `${sourceType} ${sourceText} ${mount.name || ""}`.toLowerCase();

  if (
    combined.includes("mog station") ||
    combined.includes("online store") ||
    combined.includes("premium") ||
    combined.includes("optional item")
  ) {
    return {
      mountCategory: "Premium",
      farmPriority: "ignore",
      active: false
    };
  }

  if (
    combined.includes("legacy") ||
    combined.includes("pre-order") ||
    combined.includes("preorder") ||
    combined.includes("campaign") ||
    combined.includes("seasonal") ||
    combined.includes("event")
  ) {
    return {
      mountCategory: "Limited / Event",
      farmPriority: "ignore",
      active: false
    };
  }

  if (isVariantCriterionMount(mount)) {
    return {
      mountCategory: "Variant / Criterion",
      farmPriority: "farm_target",
      active: true
    };
  }

  if (
    sourceType.toLowerCase().includes("achievement") ||
    combined.includes("achievement:")
  ) {
    return {
      mountCategory: "Achievement",
      farmPriority: "ignore",
      active: false
    };
  }

  if (
    combined.includes("gold saucer") ||
    combined.includes("mgp") ||
    combined.includes("vendor") ||
    combined.includes("bicolor gemstone") ||
    combined.includes("allied seals") ||
    combined.includes("centurio seals") ||
    combined.includes("sacks of nuts")
  ) {
    return {
      mountCategory: "Vendor / Currency",
      farmPriority: "ignore",
      active: false
    };
  }

  if (
    sourceType.toLowerCase().includes("trial") ||
    combined.includes("extreme") ||
    combined.includes("totem") ||
    combined.includes("trial:")
  ) {
    return {
      mountCategory: "Trial",
      farmPriority: "farm_target",
      active: true
    };
  }

  if (
    sourceType.toLowerCase().includes("raid") ||
    combined.includes("savage") ||
    combined.includes("raid:")
  ) {
    return {
      mountCategory: "Raid",
      farmPriority: "farm_target",
      active: true
    };
  }

  if (
    combined.includes("dungeon") ||
    combined.includes("criterion") ||
    combined.includes("variant")
  ) {
    return {
      mountCategory: "Dungeon",
      farmPriority: "farm_target",
      active: true
    };
  }

  return {
    mountCategory: "Other",
    farmPriority: "optional",
    active: false
  };
}

function classifyMountSetName(mount) {
  const sourceText = JSON.stringify(mount.sources || "").toLowerCase();
  const mountName = String(mount.name || "").toLowerCase();

  if (isVariantCriterionMount(mount)) {
    return "Variant / Criterion Dungeon Mounts";
  }

  if (
    sourceText.includes("savage") ||
    sourceText.includes("raid") ||
    mountName.includes("gobwalker") ||
    mountName.includes("model o") ||
    mountName.includes("eden") ||
    mountName.includes("p12s")
  ) {
    return "Savage / Raid Mounts";
  }

  const patch = Number.parseFloat(String(mount.patch || ""));

  if (Number.isFinite(patch)) {
    if (patch >= 7 && patch < 8) return "Dawntrail Extreme Trial Mounts";
    if (patch >= 6 && patch < 7) return "Endwalker Extreme Trial Mounts";
    if (patch >= 5 && patch < 6) return "Shadowbringers Extreme Trial Mounts";
    if (patch >= 4 && patch < 5) return "Stormblood Extreme Trial Mounts";
    if (patch >= 3 && patch < 4) return "Heavensward Extreme Trial Mounts";
    if (patch >= 2 && patch < 3) return "ARR Extreme Trial Mounts";
  }

  return "Other Priority Mounts";
}

async function getMountSetIdByName(client, name) {
  const result = await client.query(
    `
      select id
      from portal_mount_sets
      where name = $1
      limit 1;
    `,
    [name]
  );

  return result.rows[0]?.id ?? null;
}

// =========================
// SECTION: Mount Catalog Sync
// =========================

async function getMarketboardItemName(itemId) {
  const url = new URL(`${XIVAPI_BASE_URL}/api/sheet/Item/${itemId}`);
  url.searchParams.set("fields", "Name");
  url.searchParams.set("language", "en");
  const payload = await fetchJson(url.toString());
  return String(payload?.fields?.Name || "").trim() || null;
}
function calculateXivMapCoordinate(rawCoordinate, sizeFactor) {
  const raw = Number(rawCoordinate);
  const scale = Number(sizeFactor) / 100;
  if (!Number.isFinite(raw) || !Number.isFinite(scale) || scale <= 0) return null;
  return Number(((41 / scale) * ((raw + 1024) / 2048) + 1).toFixed(1));
}

async function getMinionQuestAcquisitionDetails(questId) {
  const url = new URL(`${XIVAPI_BASE_URL}/api/sheet/Quest/${questId}`);
  url.searchParams.set("fields", "Name,IssuerStart,IssuerLocation,PlaceName");
  url.searchParams.set("language", "en");
  const payload = await fetchJson(url.toString());
  const fields = payload?.fields || {};
  const location = fields?.IssuerLocation?.fields || {};
  const sizeFactor = location?.Map?.fields?.SizeFactor;
  const x = calculateXivMapCoordinate(location?.X, sizeFactor);
  const y = calculateXivMapCoordinate(location?.Z, sizeFactor);
  return {
    questName: String(fields?.Name || "").trim() || null,
    questGiver: String(fields?.IssuerStart?.fields?.Singular || "").trim() || null,
    location: String(fields?.PlaceName?.fields?.Name || "").trim() || null,
    coordinates: x !== null && y !== null ? `X: ${x}, Y: ${y}` : null
  };
}

async function syncMinionCatalog(client) {
  const payload = await fetchJson(FFXIV_COLLECT_MINIONS_URL);
  const minions = (payload?.results || payload || []).filter((minion) => minion?.id && minion?.name);
  await auditCollectionSourceTypes(client, "Minion catalog", minions);
  const existing = await client.query(`select marketboard_item_id, marketboard_item_name from portal_minions where marketboard_item_id is not null and marketboard_item_name is not null;`);
  const names = new Map(existing.rows.map((row) => [Number(row.marketboard_item_id), row.marketboard_item_name]));
  const pending = [...new Set(minions.filter((minion) => minion.tradeable === true && Number(minion.item_id) > 0).map((minion) => Number(minion.item_id)).filter((id) => !names.has(id)))];
  for (let i = 0; i < pending.length; i += 8) {
    const resolved = await Promise.all(pending.slice(i, i + 8).map(async (id) => [id, await getMarketboardItemName(id).catch(() => null)]));
    for (const [id, name] of resolved) if (name) names.set(id, name);
  }

  const questIds = [...new Set(minions.flatMap((minion) => Array.isArray(minion.sources) ? minion.sources : [])
    .filter((source) => String(source?.related_type || "").toLowerCase() === "quest" && Number(source?.related_id) > 0)
    .map((source) => Number(source.related_id)))];
  const questDetails = new Map();
  for (let i = 0; i < questIds.length; i += 6) {
    const resolved = await Promise.all(questIds.slice(i, i + 6).map(async (id) => [id, await getMinionQuestAcquisitionDetails(id).catch(() => null)]));
    for (const [id, details] of resolved) if (details) questDetails.set(id, details);
    await sleep(250);
  }

  for (const minion of minions) {
    const itemId = Number(minion.item_id || 0);
    const eligible = minion.tradeable === true && itemId > 0;
    const rawSources = Array.isArray(minion.sources) ? minion.sources : [];
    const acquisitionData = rawSources.map((source) => {
      const relatedId = Number(source?.related_id || 0) || null;
      const relatedType = String(source?.related_type || "").trim() || null;
      const quest = relatedType?.toLowerCase() === "quest" && relatedId ? questDetails.get(relatedId) : null;
      return {
        type: String(source?.type || "Other").trim() || "Other",
        text: String(source?.text || "").trim(),
        relatedType,
        relatedId,
        questName: quest?.questName || null,
        questGiver: quest?.questGiver || null,
        location: quest?.location || null,
        coordinates: quest?.coordinates || null
      };
    });
    const sourceName = acquisitionData.map((source) => `${source.type}: ${source.text}`.trim()).filter(Boolean).join(" | ");
    await client.query(`
      insert into portal_minions (
        minion_name, source_name, description, acquisition_data, ffxiv_collect_minion_id, patch,
        icon_url, image_url, marketboard_item_id, marketboard_item_name, marketboard_eligible, updated_at
      ) values ($1, nullif($2, ''), nullif($3, ''), $4::jsonb, $5, nullif($6, ''), nullif($7, ''),
                nullif($8, ''), $9, nullif($10, ''), $11, now())
      on conflict (minion_name) do update set
        source_name = excluded.source_name,
        description = excluded.description,
        acquisition_data = excluded.acquisition_data,
        ffxiv_collect_minion_id = excluded.ffxiv_collect_minion_id,
        patch = excluded.patch,
        icon_url = excluded.icon_url,
        image_url = excluded.image_url,
        marketboard_item_id = excluded.marketboard_item_id,
        marketboard_item_name = excluded.marketboard_item_name,
        marketboard_eligible = excluded.marketboard_eligible,
        updated_at = now();`,
      [
        minion.name,
        sourceName,
        String(minion.description || ""),
        JSON.stringify(acquisitionData),
        String(minion.id),
        String(minion.patch || ""),
        String(minion.icon || ""),
        String(minion.image || ""),
        eligible ? itemId : null,
        eligible ? (names.get(itemId) || "") : "",
        eligible
      ]
    );
  }
  return `Minion catalog sync complete. FFXIV Collect returned ${minions.length} minions and enriched ${questDetails.size} quest sources.`;
}async function syncMountCatalog(client) {
  const payload = await fetchJson(FFXIV_COLLECT_MOUNTS_URL);
  const rawMounts = normalizeMountPayload(payload).filter((mount) => mount?.id && mount?.name);
  /* FFXIV Collect occasionally exposes the same numeric mount ID under more
     than one display record. Keep one current record per ID so the database
     can retain its unique identity constraint. */
  const mounts = [...new Map(rawMounts.map((mount) => [String(mount.id), mount])).values()];
  await auditCollectionSourceTypes(client, "Mount catalog", mounts);

  if (mounts.length === 0) {
    throw new Error("No mounts were returned from FFXIV Collect.");
  }

  const existingItemNames = await client.query(`select marketboard_item_id, marketboard_item_name from portal_mounts where marketboard_item_id is not null and marketboard_item_name is not null;`);
  const itemNameById = new Map(existingItemNames.rows.map((row) => [Number(row.marketboard_item_id), row.marketboard_item_name]));
  const itemIdsToResolve = [...new Set(mounts.filter((mount) => mount.tradeable === true && Number(mount.item_id) > 0).map((mount) => Number(mount.item_id)).filter((itemId) => !itemNameById.has(itemId)))];
  for (let i = 0; i < itemIdsToResolve.length; i += 8) {
    const resolved = await Promise.all(itemIdsToResolve.slice(i, i + 8).map(async (itemId) => [itemId, await getMarketboardItemName(itemId).catch(() => null)]));
    for (const [itemId, itemName] of resolved) if (itemName) itemNameById.set(itemId, itemName);
  }
  const setIdCache = new Map();
  let farmTargets = 0;
  let ignoredOrOptional = 0;

  await client.query("begin");

  try {
    for (const mount of mounts) {
      const metadata = classifyMountMetadata(mount);
      const setName = classifyMountSetName(mount);

      if (!setIdCache.has(setName)) {
        setIdCache.set(setName, await getMountSetIdByName(client, setName));
      }

      const mountSetId = setIdCache.get(setName);
      const sourceName = sourceTextForMount(mount);
      const acquisitionData = (Array.isArray(mount.sources) ? mount.sources : []).map((source) => ({
        type: String(source?.type || "Other").trim() || "Other",
        text: String(source?.text || "").trim(),
        relatedType: String(source?.related_type || "").trim() || null,
        relatedId: Number(source?.related_id || 0) || null
      }));
      const sortOrderRaw = Number.parseInt(String(mount.order || ""), 10);
      const sortOrder = Number.isFinite(sortOrderRaw) ? sortOrderRaw : 100;
      const marketboardItemIdRaw = Number(mount.item_id ?? mount.item?.id ?? 0);
      const marketboardEligible = mount.tradeable === true && Number.isFinite(marketboardItemIdRaw) && marketboardItemIdRaw > 0;

      /* Preserve any historical row, but free a stale duplicate upstream ID
         before the current catalog entry claims it. */
      await client.query(
        `update portal_mounts
         set ffxiv_collect_mount_id = null, updated_at = now()
         where ffxiv_collect_mount_id = $1 and mount_name <> $2;`,
        [String(mount.id), mount.name]
      );


      if (metadata.active) {
        farmTargets += 1;
      } else {
        ignoredOrOptional += 1;
      }

      await client.query(
        `
          insert into portal_mounts (
            mount_name,
            source_name,
            description,
            acquisition_data,
            ffxiv_collect_mount_id,
            patch,
            icon_url,
            image_url,
            owned_percent,
            mount_category,
            farm_priority,
            mount_set_id,
            sort_order,
            marketboard_item_id,
            marketboard_item_name,
            marketboard_eligible,
            marketboard_mapping_source,
            active,
            updated_at
          )
          values (
            $1,
            nullif($2, ''),
            nullif($3, ''),
            $4::jsonb,
            $5,
            nullif($6, ''),
            nullif($7, ''),
            nullif($8, ''),
            nullif($9, ''),
            $10,
            $11,
            $12,
            $13,
            $14,
            nullif($15, ''),
            $16,
            $17,
            $18,
            now()
          )
          on conflict (mount_name)
          do update set
            source_name = excluded.source_name,
            description = coalesce(excluded.description, portal_mounts.description),
            acquisition_data = excluded.acquisition_data,
            ffxiv_collect_mount_id = excluded.ffxiv_collect_mount_id,
            patch = excluded.patch,
            icon_url = excluded.icon_url,
            image_url = excluded.image_url,
            owned_percent = excluded.owned_percent,
            mount_category = case
              when portal_mounts.manual_override = true then portal_mounts.mount_category
              else excluded.mount_category
            end,
            farm_priority = case
              when portal_mounts.manual_override = true then portal_mounts.farm_priority
              else excluded.farm_priority
            end,
            mount_set_id = excluded.mount_set_id,
            sort_order = excluded.sort_order,
            marketboard_item_id = excluded.marketboard_item_id,
            marketboard_item_name = excluded.marketboard_item_name,
            marketboard_eligible = excluded.marketboard_eligible,
            marketboard_mapping_source = excluded.marketboard_mapping_source,
            active = case
              when portal_mounts.manual_override = true then portal_mounts.active
              else excluded.active
            end,
            updated_at = now();
        `,
        [
          mount.name,
          sourceName,
          String(mount.description || mount.enhanced_description || ""),
          JSON.stringify(acquisitionData),
          String(mount.id),
          String(mount.patch || ""),
          String(mount.icon || ""),
          String(mount.image || ""),
          String(mount.owned || ""),
          metadata.mountCategory,
          metadata.farmPriority,
          mountSetId,
          sortOrder,
          marketboardEligible ? marketboardItemIdRaw : null,
          marketboardEligible ? (itemNameById.get(marketboardItemIdRaw) || "") : "",
          marketboardEligible,
          marketboardEligible ? "ffxiv_collect_tradeable" : null,
          metadata.active
        ]
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  const countResult = await client.query(`
    select
      count(*)::int as total_mounts,
      count(*) filter (where active = true)::int as active_mounts,
      count(*) filter (where farm_priority = 'farm_target')::int as farm_targets,
      count(*) filter (where farm_priority <> 'farm_target')::int as ignored_or_optional,
      count(*) filter (where ffxiv_collect_mount_id is not null)::int as collect_ready,
      count(*) filter (where marketboard_eligible = true and marketboard_item_id is not null)::int as marketboard_mapped
    from portal_mounts;
  `);

  const counts = countResult.rows[0];

  return [
    "Mount catalog sync complete.",
    `FFXIV Collect returned ${mounts.length} mounts.`,
    `Mounts in DB: ${counts.total_mounts}.`,
    `Active farm targets: ${counts.active_mounts}.`,
    `Classified farm targets this run: ${farmTargets}.`,
    `Ignored/optional this run: ${ignoredOrOptional}.`,
    `FFXIV-Collect-ready: ${counts.collect_ready}.`,
    `Marketboard mappings: ${counts.marketboard_mapped}.`
  ].join(" ");
}

// =========================
// SECTION: Duty Catalog Sync
// =========================

async function syncDutyCatalog(client) {
  const xivapiRows = await fetchDutyCatalogRows();

  if (xivapiRows.length === 0) {
    throw new Error(
      "XIVAPI returned no ContentFinderCondition rows."
    );
  }

  const duties = xivapiRows
    .map((row) => normalizeDutyRow(row))
    .filter(Boolean);

  if (duties.length === 0) {
    throw new Error(
      "XIVAPI rows were returned, but no dungeon, trial, or raid duties could be normalized."
    );
  }

  let insertedOrUpdated = 0;
  let dutiesWithImages = 0;
  let dutiesWithPartySize = 0;

  await client.query("begin");

  try {
    for (const duty of duties) {
      await client.query(
        `
          insert into portal_discord_duties (
            xivapi_id,
            duty_type,
            name,
            description,
            level,
            level_required,
            item_level_required,
            party_size,
            image_url,
            active,
            is_active,
            external_source,
            external_id,
            manual_override,
            last_synced_at,
            xivapi_data,
            updated_at
          )
          values (
            $1,
            $2,
            $3,
            nullif($4, ''),
            $5,
            $5,
            $6,
            $7,
            $8,
            true,
            true,
            'xivapi',
            $9,
            false,
            now(),
            $10::jsonb,
            now()
          )
          on conflict (xivapi_id)
          do update set
            duty_type = case
              when portal_discord_duties.manual_override = true
                then portal_discord_duties.duty_type
              else excluded.duty_type
            end,
            description = coalesce(nullif(excluded.description, ''), portal_discord_duties.description),
            name = case
              when portal_discord_duties.manual_override = true
                then portal_discord_duties.name
              else excluded.name
            end,
            level = case
              when portal_discord_duties.manual_override = true
                then portal_discord_duties.level
              else excluded.level
            end,
            level_required = excluded.level_required,
            item_level_required = excluded.item_level_required,
            party_size = excluded.party_size,

            /*
              Do not erase a working image merely because XIVAPI did
              not return one during a later sync.
            */
            image_url = case
              when portal_discord_duties.image_override_url is not null
                then portal_discord_duties.image_url
              else coalesce(
                excluded.image_url,
                portal_discord_duties.image_url
              )
            end,
            active = true,
            is_active = true,
            external_source = excluded.external_source,
            external_id = excluded.external_id,
            last_synced_at = excluded.last_synced_at,
            xivapi_data = excluded.xivapi_data,
            updated_at = now();
        `,
        [
          duty.xivapiId,
          duty.dutyType,
          duty.name,
          duty.description,
          duty.levelRequired,
          duty.itemLevelRequired,
          duty.partySize,
          duty.imageUrl,
          String(duty.xivapiId),
          JSON.stringify(duty.xivapiData)
        ]
      );

      insertedOrUpdated += 1;

      if (duty.imageUrl) {
        dutiesWithImages += 1;
      }

      if (duty.partySize) {
        dutiesWithPartySize += 1;
      }

      if (insertedOrUpdated % 100 === 0) {
        console.log(
          `[cotf-worker] Duty catalog database progress: ${insertedOrUpdated}/${duties.length}.`
        );
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  const countResult = await client.query(`
    select
      count(*)::int as total_duties,
      count(*) filter (where is_active = true)::int as active_duties,
      count(*) filter (where duty_type = 'Dungeon')::int as dungeons,
      count(*) filter (where duty_type = 'Trial')::int as trials,
      count(*) filter (where duty_type = 'Raid')::int as raids,
      count(*) filter (where image_url is not null)::int as duties_with_images,
      count(*) filter (where party_size is not null)::int as duties_with_party_size
    from portal_discord_duties;
  `);

  const counts = countResult.rows[0];

  return [
    "Duty catalog sync complete.",
    `XIVAPI rows downloaded: ${xivapiRows.length}.`,
    `Relevant duties processed: ${insertedOrUpdated}.`,
    `Images discovered this run: ${dutiesWithImages}.`,
    `Party sizes discovered this run: ${dutiesWithPartySize}.`,
    `Duties in DB: ${counts.total_duties}.`,
    `Active: ${counts.active_duties}.`,
    `Dungeons: ${counts.dungeons}.`,
    `Trials: ${counts.trials}.`,
    `Raids: ${counts.raids}.`,
    `Rows with images: ${counts.duties_with_images}.`,
    `Rows with party size: ${counts.duties_with_party_size}.`
  ].join(" ");
}

// =========================
// SECTION: FC Roster Helpers
// =========================

function cleanCharacterName(rawText) {
  let text = String(rawText || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";

  const worldMarker = `${DEFAULT_WORLD} [${DEFAULT_DATACENTER}]`;
  const worldIndex = text.indexOf(worldMarker);

  if (worldIndex > 0) {
    text = text.slice(0, worldIndex).trim();
  }

  text = text
    .replace(/^Character Profile\s*/i, "")
    .replace(/\s+Free Company\s*$/i, "")
    .trim();

  return text;
}

function isPlausibleRosterCharacterName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  // Reject roster positions, activity counts, and other page metadata before
  // they can become member records.
  return (
    parts.length >= 2 &&
    parts.every((part) => /^[\p{L}][\p{L}'’\-]*$/u.test(part))
  );
}

function findRosterCharacterName($, row) {
  // A valid FC roster card has its own dedicated character-name element. Do not
  // fall back to arbitrary profile-link or row text, which can include page data.
  const rawName = row.find(".entry__name, [class*='entry__name']").first().text();
  const name = cleanCharacterName(rawName);
  return isPlausibleRosterCharacterName(name) ? name : "";
}

function hasRosterWorldMarker($, row, worldMarker) {
  // Require a dedicated world field from the same roster card as the name.
  const worldText = row
    .find(".entry__world, [class*='entry__world']")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();

  return worldText.includes(worldMarker);
}

function parseRosterMembers(html) {
  const $ = cheerio.load(html);
  const members = new Map();
  const worldMarker = `${DEFAULT_WORLD} [${DEFAULT_DATACENTER}]`;

  // Lodestone member pages also embed unrelated character links (for example,
  // ranking widgets). Only direct FC roster cards use li.entry > a.entry__bg.
  $("li.entry").each((_, element) => {
    const row = $(element);
    const memberLink = row
      .children('a.entry__bg[href*="/lodestone/character/"]')
      .first();
    const href = memberLink.attr("href") || "";
    const idMatch = href.match(/\/lodestone\/character\/(\d+)\//);

    if (!idMatch) return;

    const worldText = row
      .find("p.entry__world")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();

    if (!worldText.includes(worldMarker)) return;

    const characterName = cleanCharacterName(
      row
        .find("p.entry__name")
        .first()
        .text()
    );

    if (!isPlausibleRosterCharacterName(characterName) || characterName.length > 64) {
      return;
    }

    const lodestoneCharacterId = idMatch[1];
    const fcRankName = row
      .find("ul.entry__freecompany__info > li")
      .first()
      .find("span")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();

    members.set(lodestoneCharacterId, {
      lodestoneCharacterId,
      characterName,
      fcRankName: fcRankName && fcRankName.length <= 100 ? fcRankName : null
    });
  });

  return Array.from(members.values());
}

async function fetchFcRoster(verification) {
  const allMembers = new Map();

  for (let page = 1; page <= MAX_FC_PAGES; page += 1) {
    const url = buildVerifiedMemberPageUrl(verification, page);
    const html = await fetchText(url);
    const pageMembers = parseRosterMembers(html);
    if (page === 1 && pageMembers.length === 0) {
      const $ = cheerio.load(html);
      const observed = [...new Set($("li.entry").filter((_, row) =>
        $(row).children('a.entry__bg[href*="/lodestone/character/"]').length > 0
      ).find("p.entry__world").map((_, field) => $(field).text().replace(/\s+/g, " ").trim()).get())].filter(Boolean);
      if (observed.length && !observed.some((value) => value.includes(`${DEFAULT_WORLD} [${DEFAULT_DATACENTER}]`))) {
        throw new Error(`FC roster location mismatch: worker expects ${DEFAULT_WORLD} [${DEFAULT_DATACENTER}], but Lodestone lists ${observed.join(", ")}. Review setup world/data center, seal it, and recreate containers. No roster changes were applied.`);
      }
    }

    let newMembers = 0;

    for (const member of pageMembers) {
      if (!allMembers.has(member.lodestoneCharacterId)) {
        allMembers.set(member.lodestoneCharacterId, member);
        newMembers += 1;
      }
    }

    console.log(
      `[cotf-worker] FC roster page ${page}: found ${pageMembers.length}, new ${newMembers}.`
    );

    if (pageMembers.length === 0 || newMembers === 0) {
      break;
    }

    await sleep(750);
  }

  return Array.from(allMembers.values());
}

// =========================
// SECTION: Lodestone Portrait Sync
// =========================

function buildCharacterProfileUrl(character) {
  if (!character.lodestone_character_id) {
    return null;
  }

  return `https://na.finalfantasyxiv.com/lodestone/character/${encodeURIComponent(
    character.lodestone_character_id
  )}/`;
}

function toAbsoluteLodestoneImageUrl(value) {
  const rawUrl = String(value || "").trim();

  if (!rawUrl) {
    return null;
  }

  if (rawUrl.startsWith("//")) {
    return `https:${rawUrl}`;
  }

  try {
    return new URL(rawUrl, "https://na.finalfantasyxiv.com").toString();
  } catch {
    return null;
  }
}

function extractLodestoneCharacterImages(html) {
  const $ = cheerio.load(html);
  const candidates = [];

  const addCandidate = (rawUrl, score, reason = "") => {
    const url = toAbsoluteLodestoneImageUrl(rawUrl);

    if (!url) {
      return;
    }

    const lowerUrl = url.toLowerCase();

    /*
      Only accept Lodestone character image CDN URLs.
      This intentionally rejects generic Lodestone/Dawntrail/social images.
    */
    if (!lowerUrl.startsWith("https://img2.finalfantasyxiv.com/f/")) {
      return;
    }

    candidates.push({
      url,
      score,
      reason
    });
  };

  $("img").each((_, element) => {
    const src =
      $(element).attr("src") ||
      $(element).attr("data-src") ||
      $(element).attr("data-original") ||
      "";

    const className = String($(element).attr("class") || "").toLowerCase();
    const alt = String($(element).attr("alt") || "").toLowerCase();
    const parentClass = String($(element).parent().attr("class") || "").toLowerCase();
    const srcLower = String(src || "").toLowerCase();

    let score = 10;

    /*
      l0.jpg is usually the larger character/profile portrait.
      c0.jpg tends to be the face/avatar crop.
    */
    if (/\/f\/.*l0\.jpg/i.test(srcLower)) {
      score += 300;
    }

    if (/\/f\/.*c0\.jpg/i.test(srcLower)) {
      score += 180;
    }

    if (className.includes("character") || className.includes("chara")) {
      score += 40;
    }

    if (parentClass.includes("character") || parentClass.includes("chara")) {
      score += 40;
    }

    if (alt.includes("character") || alt.includes("portrait")) {
      score += 25;
    }

    addCandidate(src, score, "lodestone img");
  });

  const uniqueCandidates = Array.from(
    new Map(candidates.map((candidate) => [candidate.url, candidate])).values()
  ).sort((a, b) => b.score - a.score);

  const portraitUrl = uniqueCandidates[0]?.url || null;
  const avatarUrl = uniqueCandidates.find((candidate) =>
    /\/f\/.*c0\.jpg/i.test(candidate.url)
  )?.url || uniqueCandidates[1]?.url || portraitUrl;

  if (portraitUrl) {
    console.log(`[cotf-worker] Selected portrait image: ${portraitUrl}`);
  }

  return {
    portraitUrl,
    avatarUrl
  };
}

async function getCharactersForPortraitSync(client) {
  const result = await client.query(
    `
      select
        id,
        display_name,
        lodestone_character_id,
        portrait_url,
        portrait_synced_at
      from portal_characters
      where active = true
        and (fc_membership_status = 'current' or exists(select 1 from portal_alt_character_links acl join portal_discord_links adl on adl.discord_user_id=acl.discord_user_id join portal_characters anchor on anchor.id=adl.character_id where acl.character_id=portal_characters.id and acl.active=true and anchor.active=true and anchor.fc_membership_status='current'))
        and lodestone_character_id is not null
        and privacy_suppressed = false
        and not exists (select 1 from portal_discord_links dl where (dl.character_id=portal_characters.id or dl.discord_user_id in(select acl.discord_user_id from portal_alt_character_links acl where acl.character_id=portal_characters.id and acl.active=true)) and dl.privacy_mode='verification_only')
        and (
          portrait_url is null
          or portrait_synced_at is null
          or portrait_synced_at < now() - interval '14 days'
        )
      order by
        portrait_synced_at asc nulls first,
        lower(display_name) asc
      limit $1;
    `,
    [MAX_PORTRAIT_SYNC_CHARACTERS]
  );

  return result.rows;
}

async function syncCharacterPortraits(client) {
  const characters = await getCharactersForPortraitSync(client);

  if (characters.length === 0) {
    return "Portrait sync skipped. No current FC characters need portrait updates.";
  }

  let updated = 0;
  let noImage = 0;
  let failed = 0;

  for (const character of characters) {
    const profileUrl = buildCharacterProfileUrl(character);

    if (!profileUrl) {
      noImage += 1;
      continue;
    }

    try {
      const html = await fetchText(profileUrl);
      const images = extractLodestoneCharacterImages(html);

      if (!images.portraitUrl && !images.avatarUrl) {
        noImage += 1;

        await client.query(
          `
            update portal_characters
            set
              portrait_synced_at = now(),
              updated_at = now()
            where id = $1;
          `,
          [character.id]
        );
      } else {
        await client.query(
          `
            update portal_characters
            set
              portrait_url = coalesce($2, portrait_url),
              avatar_url = coalesce($3, avatar_url),
              portrait_synced_at = now(),
              updated_at = now()
            where id = $1;
          `,
          [character.id, images.portraitUrl, images.avatarUrl]
        );

        updated += 1;
      }

      console.log(`[cotf-worker] ${character.display_name}: portrait sync checked.`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[cotf-worker] ${character.display_name}: portrait sync failed: ${message}`);
    }

    await sleep(Math.max(PORTRAIT_SYNC_REQUEST_DELAY_MS, 250));
  }

  return [
    "Portrait sync complete.",
    `Characters checked: ${characters.length}.`,
    `Updated: ${updated}.`,
    `No image found: ${noImage}.`,
    `Failed: ${failed}.`
  ].join(" ");
}

// =========================
// SECTION: FC Roster Sync
// =========================

async function syncFcRoster(client, scanSource = "scheduled") {
  const verification = await ensureFcVerification(client, await resolveFcVerificationOptions(client));
  if (verification.status !== "verified") throw new Error("Free Company ownership verification is still pending; roster scanning is paused.");
  const fetchedRosterMembers = await fetchFcRoster(verification);

  if (fetchedRosterMembers.length === 0) {
    throw new Error(
      "No FC members were found. Lodestone markup may have changed or the FC URL may be wrong."
    );
  }
  const suppressedFingerprints=new Set((await client.query("select lodestone_fingerprint from portal_privacy_suppressions where status='active' and lodestone_fingerprint is not null union select sc.lodestone_fingerprint from portal_privacy_suppressed_characters sc join portal_privacy_suppressions s on s.discord_fingerprint=sc.discord_fingerprint where s.status='active'")).rows.map((row)=>String(row.lodestone_fingerprint)));
  const rosterMembers=fetchedRosterMembers.filter((member)=>!suppressedFingerprints.has(privacyFingerprint("lodestone",member.lodestoneCharacterId)));

  const seenIds = rosterMembers.map((member) => member.lodestoneCharacterId);
  const existingMembersResult = await client.query(`
    select character_name, world, lodestone_character_id
    from portal_characters
    where active = true
      and fc_membership_status = 'current'
      and lodestone_character_id is not null;
  `);
  const existingMembersById = new Map(
    existingMembersResult.rows.map((row) => [String(row.lodestone_character_id), row])
  );
  const addedMembers = rosterMembers.filter(
    (member) => !existingMembersById.has(String(member.lodestoneCharacterId))
  );
  const removedMembers = existingMembersResult.rows.filter(
    (member) => !seenIds.includes(String(member.lodestone_character_id))
  );
  let removedAutoImports = 0;
  let rankChanges = 0;

  await client.query("begin");

  try {
    for (const member of rosterMembers) {
      const existingCharacterResult = await client.query(
        `select id, character_name, fc_rank_name, fc_rank_changed_at from portal_characters where lodestone_character_id = $1 limit 1;`,
        [member.lodestoneCharacterId]
      );
      const existingCharacter = existingCharacterResult.rows[0] || null;

      if (
        existingCharacter &&
        String(existingCharacter.character_name).trim() &&
        String(existingCharacter.character_name).trim() !== member.characterName
      ) {
        await client.query(
          `insert into portal_character_rename_history (character_id, old_name, new_name)
           values ($1, $2, $3)
           on conflict (character_id, old_name, new_name) do nothing;`,
          [existingCharacter.id, String(existingCharacter.character_name).trim(), member.characterName]
        );
      }

      if (
        member.fcRankName &&
        existingCharacter?.fc_rank_name &&
        String(existingCharacter.fc_rank_name).trim() !== member.fcRankName
      ) {
        await client.query(
          `insert into portal_character_fc_rank_history
            (character_id, old_rank_name, new_rank_name, old_rank_started_at)
           values ($1, $2, $3, $4);`,
          [
            existingCharacter.id,
            String(existingCharacter.fc_rank_name).trim(),
            member.fcRankName,
            existingCharacter.fc_rank_changed_at
          ]
        );
        rankChanges += 1;
      }

      await client.query(
        `
          insert into portal_characters (
            display_name,
            character_name,
            world,
            lodestone_character_id,
            ffxiv_collect_character_id,
            role,
            active,
            fc_membership_status,
            sync_status,
            last_fc_check_at,
            last_seen_in_fc_at,
            first_seen_in_fc_at,
            fc_rank_name,
            fc_rank_changed_at,
            join_date_source,
            updated_at
          )
          values ($1, $1, $2, $3, $3, 'Member', true, 'current', 'fc_synced', now(), now(), now(), $4, now(), 'first_seen', now())
          on conflict (lodestone_character_id) where lodestone_character_id is not null
          do update set
            display_name = excluded.display_name,
            character_name = excluded.character_name,
            world = excluded.world,
            ffxiv_collect_character_id = coalesce(
              portal_characters.ffxiv_collect_character_id,
              excluded.ffxiv_collect_character_id
            ),
            active = true,
            fc_membership_status = 'current',
            sync_status = 'fc_synced',
            last_fc_check_at = now(),
            last_seen_in_fc_at = now(),
            first_seen_in_fc_at = coalesce(
              portal_characters.first_seen_in_fc_at,
              portal_characters.created_at,
              excluded.first_seen_in_fc_at
            ),
            fc_rank_name = coalesce(excluded.fc_rank_name, portal_characters.fc_rank_name),
            fc_rank_changed_at = case
              when excluded.fc_rank_name is not null
                and (
                  portal_characters.fc_rank_name is null
                  or portal_characters.fc_rank_name is distinct from excluded.fc_rank_name
                )
              then now()
              else portal_characters.fc_rank_changed_at
            end,
            join_date_source = case
              when portal_characters.join_date_override is not null then 'manual'
              when portal_characters.join_date_source is null
                or portal_characters.join_date_source = 'unknown'
              then 'first_seen'
              else portal_characters.join_date_source
            end,
            updated_at = now();
        `,
        [member.characterName, DEFAULT_WORLD, member.lodestoneCharacterId, member.fcRankName]
      );
    }

    await client.query(
      `
        update portal_characters
        set
          active = false,
          fc_membership_status = 'not_seen_in_fc',
          sync_status = 'fc_missing',
          last_fc_check_at = now(),
          updated_at = now()
        where lodestone_character_id is not null
          and fc_membership_status = 'current'
          and not (lodestone_character_id = any($1::text[]));
      `,
      [seenIds]
    );

    await client.query(`update portal_characters alt set active=false,fc_membership_status='linked_anchor_departed',sync_status='linked_anchor_departed',last_seen_in_fc_at=coalesce(alt.last_seen_in_fc_at,now()),updated_at=now() from portal_alt_character_links acl join portal_discord_links dl on dl.discord_user_id=acl.discord_user_id join portal_characters anchor on anchor.id=dl.character_id where alt.id=acl.character_id and acl.active=true and (anchor.active=false or anchor.fc_membership_status<>'current');`);
    await client.query(`update portal_characters alt set active=true,fc_membership_status='linked_external',sync_status=case when alt.sync_status='linked_anchor_departed' then 'pending' else alt.sync_status end,last_seen_in_fc_at=null,updated_at=now() from portal_alt_character_links acl join portal_discord_links dl on dl.discord_user_id=acl.discord_user_id join portal_characters anchor on anchor.id=dl.character_id where alt.id=acl.character_id and acl.active=true and anchor.active=true and anchor.fc_membership_status='current' and alt.fc_membership_status='linked_anchor_departed';`);

    const cleanupResult = await client.query(
      `
        delete from portal_characters
        where lodestone_character_id is not null
          and not (lodestone_character_id = any($1::text[]))
          and fc_membership_status = 'not_seen_in_fc'
          and authentik_email is null
          and notes is null
          and role = 'Member'
          and not exists (select 1 from portal_discord_links dl where dl.character_id=portal_characters.id)
          and not exists (select 1 from portal_alt_character_links acl where acl.character_id=portal_characters.id and acl.active=true);
      `,
      [seenIds]
    );

    removedAutoImports = cleanupResult.rowCount ?? 0;

    for (const member of addedMembers) {
      await client.query(
        `insert into portal_fc_roster_change_log
          (scan_source, change_type, character_name, world, lodestone_character_id)
         values ($1, 'added', $2, $3, $4);`,
        [scanSource, member.characterName, DEFAULT_WORLD, member.lodestoneCharacterId]
      );
    }

    for (const member of removedMembers) {
      await client.query(
        `insert into portal_fc_roster_change_log
          (scan_source, change_type, character_name, world, lodestone_character_id)
         values ($1, 'removed', $2, $3, $4);`,
        [scanSource, member.character_name, member.world, member.lodestone_character_id]
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  const characterResult = await client.query(`
    select
      count(*)::int as total,
      count(*) filter (where active = true)::int as active_count,
      count(*) filter (where fc_membership_status = 'current')::int as current_fc_count,
      count(*) filter (where lodestone_character_id is not null)::int as lodestone_ready,
      count(*) filter (where ffxiv_collect_character_id is not null)::int as collect_ready
    from portal_characters;
  `);

  const counts = characterResult.rows[0];

  return [
    "FC roster sync complete.",
    `Roster members found: ${rosterMembers.length}.`,
    `Removed non-FC auto-imports: ${removedAutoImports}.`,
    `Roster changes: ${addedMembers.length} added, ${removedMembers.length} removed.`,
    `FC rank changes: ${rankChanges}.`,
    `Characters in DB: ${counts.total}.`,
    `Active: ${counts.active_count}.`,
    `Current FC: ${counts.current_fc_count}.`,
    `Lodestone-ready: ${counts.lodestone_ready}.`,
    `FFXIV-Collect-ready: ${counts.collect_ready}.`
  ].join(" ");
}

// =========================
// SECTION: Mount Ownership Helpers
// =========================

function buildCharacterOwnedMountsUrl(character, page = 1) {
  if (!character.lodestone_character_id) return null;
  const base = `https://na.finalfantasyxiv.com/lodestone/character/${encodeURIComponent(character.lodestone_character_id)}/mount/`;
  return page > 1 ? `${base}?page=${page}` : base;
}

function normalizeMountName(value) {
  return String(value || "").toLowerCase().normalize("NFKD").replace(/[’'`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

async function getCharactersForMountSync(client) {
  const result = await client.query(`select id, display_name, character_name, lodestone_character_id, sync_status, mount_ownership_initialized_at from portal_characters c where active = true and (fc_membership_status = 'current' or exists(select 1 from portal_alt_character_links acl join portal_discord_links adl on adl.discord_user_id=acl.discord_user_id join portal_characters anchor on anchor.id=adl.character_id where acl.character_id=c.id and acl.active=true and anchor.active=true and anchor.fc_membership_status='current')) and lodestone_character_id is not null and privacy_suppressed=false and not exists(select 1 from portal_discord_links dl where (dl.character_id=c.id or dl.discord_user_id in(select acl.discord_user_id from portal_alt_character_links acl where acl.character_id=c.id and acl.active=true)) and dl.privacy_mode='verification_only') order by last_mount_sync_at asc nulls first, lower(display_name) asc limit $1;`, [MAX_MOUNT_SYNC_CHARACTERS]);
  return result.rows;
}

async function markCharacterMountSyncStatus(client, characterId, syncStatus, diagnostics = {}) {
  await client.query(`update portal_characters set sync_status=$2, last_mount_sync_at=now(), mount_ownership_source=coalesce($3, mount_ownership_source), last_mount_sync_count=coalesce($4, last_mount_sync_count), last_mount_sync_result=coalesce($5, last_mount_sync_result), updated_at=now() where id=$1;`, [characterId, syncStatus, diagnostics.source || null, diagnostics.count ?? null, diagnostics.result || null]);
}

async function scrapeLodestoneMounts(character) {
  const names = new Set(); let expectedTotal = null; let page = 1;
  while (page <= 50) {
    const html = await fetchText(buildCharacterOwnedMountsUrl(character, page));
    const $ = cheerio.load(html);
    const text = $("body").text();
    const totalMatch = text.match(/Total:\s*([0-9,]+)/i);
    if (totalMatch) expectedTotal = Number(totalMatch[1].replace(/,/g, ""));
    const tooltipUrls = $(".mount__list_icon[data-tooltip_href]").map((_, el) => $(el).attr("data-tooltip_href")).get();
    if (!tooltipUrls.length && expectedTotal > 0) throw new Error("Lodestone mount tooltip links could not be parsed.");
    for (const tooltipUrl of tooltipUrls) {
      const tooltipHtml = await fetchText(`https://na.finalfantasyxiv.com${tooltipUrl}`);
      const tooltip = cheerio.load(tooltipHtml);
      const name = tooltip(".mount__header__label").first().text().trim();
      if (!name) throw new Error("Lodestone mount tooltip name could not be parsed.");
      names.add(name);
      await sleep(300);
    }
    if (expectedTotal === null) throw new Error("Lodestone mount total could not be parsed.");
    if (names.size >= expectedTotal) break;
    const next = $(`a[href*="page=${page + 1}"]`).length > 0;
    if (!next) throw new Error(`Lodestone pagination incomplete (${names.size}/${expectedTotal}).`);
    page += 1; await sleep(800);
  }
  if (names.size !== expectedTotal) throw new Error(`Lodestone parsed ${names.size} mounts but displayed ${expectedTotal}.`);
  return { names: [...names], expectedTotal };
}

async function upsertCharacterMountOwnership(client, character, ownedMountNames, options = {}) {
  const catalog = await client.query(`select id, mount_name from portal_mounts;`);
  const byName = new Map(catalog.rows.map((row) => [normalizeMountName(row.mount_name), row.id]));
  const ids = ownedMountNames.map(normalizeMountName).map((name) => byName.get(name)).filter(Boolean);
  const unmatched = ownedMountNames.filter((name) => !byName.has(normalizeMountName(name)));
  if (unmatched.length > Math.max(5, Math.ceil(ownedMountNames.length * 0.1))) throw new Error(`Too many unmatched Lodestone mounts (${unmatched.length}).`);
  const baseline = !character.mount_ownership_initialized_at || character.sync_status === 'lodestone_private';
  await client.query('begin'); try {
    if (baseline || options.suppressAcquisitionNotifications) await client.query("select set_config('portal.suppress_mount_acquisition', 'true', true);");
    await client.query(`insert into portal_character_mounts (character_id,mount_id,owned,ownership_source,obtained_at,last_checked_at,updated_at) select $1,id,id=any($2::bigint[]),'lodestone',case when id=any($2::bigint[]) then now() else null end,now(),now() from portal_mounts on conflict (character_id,mount_id) do nothing;`, [character.id, ids]);
    await client.query(`update portal_character_mounts set owned=(mount_id=any($2::bigint[])), ownership_source='lodestone', last_checked_at=now(), updated_at=now() where character_id=$1;`, [character.id, ids]);
    await client.query(`update portal_characters set mount_ownership_initialized_at=coalesce(mount_ownership_initialized_at,now()), mount_ownership_source='lodestone', last_mount_sync_count=$2, last_mount_sync_result=$3, sync_status='mount_synced', last_mount_sync_at=now(), updated_at=now() where id=$1;`, [character.id, ids.length, `Lodestone validated: ${ownedMountNames.length} parsed, ${ids.length} matched, ${unmatched.length} unmatched.`]);
    await client.query('commit'); return { matched: ids.length, unmatched };
  } catch(error) { await client.query('rollback').catch(()=>null); throw error; }
}

async function syncSingleCharacterMounts(client, character) {
  try { const scraped=await scrapeLodestoneMounts(character); if(scraped.expectedTotal === 0 && character.mount_ownership_initialized_at) throw new Error('Unexpected zero-mount Lodestone result.'); const result=await upsertCharacterMountOwnership(client,character,scraped.names); return {status:'success',ownedCount:result.matched,message:`${character.display_name}: Lodestone validated ${scraped.expectedTotal} mounts (${result.matched} catalog matches).${!character.mount_ownership_initialized_at ? ' Initial baseline completed; notifications suppressed.' : ''}`}; }
  catch(error) { const status=error?.status===403 ? 'lodestone_private' : error?.status===404 ? 'lodestone_missing' : 'mount_sync_failed'; await markCharacterMountSyncStatus(client,character.id,status,{source:'lodestone',result:error.message}); return {status:status==='lodestone_private'?'private':status==='lodestone_missing'?'missing':'failed',ownedCount:0,message:`${character.display_name}: ${error.message}`}; }
}
async function syncCharacterMountOwnership(client) {
  const characters = await getCharactersForMountSync(client);

  if (characters.length === 0) {
    return "Mount ownership sync skipped. No active current FC characters with Lodestone IDs were found.";
  }

  let synced = 0;
  let privateCount = 0;
  let missing = 0;
  let failed = 0;
  let totalOwnedRows = 0;

  for (const character of characters) {
    try {
      const result = await syncSingleCharacterMounts(client, character);

      if (result.status === "success") {
        synced += 1;
        totalOwnedRows += result.ownedCount;
      } else if (result.status === "private") {
        privateCount += 1;
      } else if (result.status === "missing") {
        missing += 1;
      } else {
        failed += 1;
      }

      console.log(`[cotf-worker] ${result.message}`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[cotf-worker] ${character.display_name}: mount ownership sync failed: ${message}`
      );
    }

    await sleep(Math.max(MOUNT_SYNC_REQUEST_DELAY_MS, 250));
  }

  const ownershipResult = await client.query(`
    select
      count(*)::int as total_rows,
      count(*) filter (where owned = true)::int as owned_rows
    from portal_character_mounts;
  `);

  const counts = ownershipResult.rows[0];

  return [
    "Mount ownership sync complete.",
    `Characters checked: ${characters.length}.`,
    `Synced: ${synced}.`,
    `Private: ${privateCount}.`,
    `Missing: ${missing}.`,
    `Failed: ${failed}.`,
    `Owned mounts reported this run: ${totalOwnedRows}.`,
    `Ownership rows in DB: ${counts.total_rows}.`,
    `Owned rows in DB: ${counts.owned_rows}.`
  ].join(" ");
}

// =========================
// SECTION: Minion Ownership Helpers
// =========================

function buildCharacterOwnedMinionsUrl(character, page = 1) {
  if (!character.lodestone_character_id) return null;
  const base = `https://na.finalfantasyxiv.com/lodestone/character/${encodeURIComponent(character.lodestone_character_id)}/minion/`;
  return page > 1 ? `${base}?page=${page}` : base;
}

function normalizeMinionName(value) {
  return String(value || "").toLowerCase().normalize("NFKD").replace(/[’'`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

async function getCharactersForMinionSync(client) {
  const result = await client.query(
    `select id, display_name, character_name, lodestone_character_id, minion_sync_status, minion_ownership_initialized_at
       from portal_characters
      where active = true
        and (fc_membership_status = 'current' or exists(select 1 from portal_alt_character_links acl join portal_discord_links adl on adl.discord_user_id=acl.discord_user_id join portal_characters anchor on anchor.id=adl.character_id where acl.character_id=portal_characters.id and acl.active=true and anchor.active=true and anchor.fc_membership_status='current'))
        and lodestone_character_id is not null
        and privacy_suppressed = false
        and not exists (select 1 from portal_discord_links dl where (dl.character_id=portal_characters.id or dl.discord_user_id in(select acl.discord_user_id from portal_alt_character_links acl where acl.character_id=portal_characters.id and acl.active=true)) and dl.privacy_mode='verification_only')
      order by last_minion_sync_at asc nulls first, lower(display_name) asc
      limit $1;`,
    [MAX_MOUNT_SYNC_CHARACTERS]
  );
  return result.rows;
}

async function markCharacterMinionSyncStatus(client, characterId, minionSyncStatus, diagnostics = {}) {
  await client.query(
    `update portal_characters
        set minion_sync_status = $2,
            last_minion_sync_at = now(),
            minion_ownership_source = coalesce($3, minion_ownership_source),
            last_minion_sync_count = coalesce($4, last_minion_sync_count),
            last_minion_sync_result = coalesce($5, last_minion_sync_result),
            updated_at = now()
      where id = $1;`,
    [characterId, minionSyncStatus, diagnostics.source || null, diagnostics.count ?? null, diagnostics.result || null]
  );
}

async function scrapeLodestoneMinions(character) {
  const names = new Set();
  let expectedTotal = null;
  let page = 1;

  while (page <= 50) {
    const html = await fetchText(buildCharacterOwnedMinionsUrl(character, page));
    const $ = cheerio.load(html);
    const totalMatch = $("body").text().match(/Total:\s*([0-9,]+)/i);
    if (totalMatch) expectedTotal = Number(totalMatch[1].replace(/,/g, ""));

    const tooltipUrls = $(".minion__list_icon[data-tooltip_href]")
      .map((_, element) => $(element).attr("data-tooltip_href"))
      .get();

    if (!tooltipUrls.length && expectedTotal > 0) {
      throw new Error("Lodestone minion tooltip links could not be parsed.");
    }

    for (const tooltipUrl of tooltipUrls) {
      const tooltipHtml = await fetchText(`https://na.finalfantasyxiv.com${tooltipUrl}`);
      const tooltip = cheerio.load(tooltipHtml);
      const name = tooltip(".minion__header__label").first().text().trim();
      if (!name) throw new Error("Lodestone minion tooltip name could not be parsed.");
      names.add(name);
      await sleep(300);
    }

    if (expectedTotal === null) throw new Error("Lodestone minion total could not be parsed.");
    if (names.size >= expectedTotal) break;
    if (!$(`a[href*="page=${page + 1}"]`).length) {
      throw new Error(`Lodestone minion pagination incomplete (${names.size}/${expectedTotal}).`);
    }
    page += 1;
    await sleep(800);
  }

  if (names.size !== expectedTotal) {
    throw new Error(`Lodestone parsed ${names.size} minions but displayed ${expectedTotal}.`);
  }
  return { names: [...names], expectedTotal };
}

async function upsertCharacterMinionOwnership(client, character, ownedMinionNames) {
  const catalog = await client.query(`select id, minion_name from portal_minions;`);
  const byName = new Map(catalog.rows.map((row) => [normalizeMinionName(row.minion_name), row.id]));
  const ids = [...new Set(ownedMinionNames.map(normalizeMinionName).map((name) => byName.get(name)).filter(Boolean))];
  const unmatched = ownedMinionNames.filter((name) => !byName.has(normalizeMinionName(name)));

  if (unmatched.length > Math.max(5, Math.ceil(ownedMinionNames.length * 0.1))) {
    throw new Error(`Too many unmatched Lodestone minions (${unmatched.length}).`);
  }

  await client.query("begin");
  try {
    await client.query(
      `insert into portal_character_minions
         (character_id, minion_id, owned, ownership_source, obtained_at, last_checked_at, updated_at)
       select $1, id, id = any($2::bigint[]), 'lodestone',
              case when id = any($2::bigint[]) then now() else null end,
              now(), now()
         from portal_minions
       on conflict (character_id, minion_id) do nothing;`,
      [character.id, ids]
    );
    await client.query(
      `update portal_character_minions
          set owned = (minion_id = any($2::bigint[])),
              obtained_at = case when minion_id = any($2::bigint[]) then coalesce(obtained_at, now()) else obtained_at end,
              ownership_source = 'lodestone',
              last_checked_at = now(),
              updated_at = now()
        where character_id = $1;`,
      [character.id, ids]
    );
    await client.query(
      `update portal_characters
          set minion_ownership_initialized_at = coalesce(minion_ownership_initialized_at, now()),
              minion_ownership_source = 'lodestone',
              last_minion_sync_count = $2,
              last_minion_sync_result = $3,
              minion_sync_status = 'minion_synced',
              last_minion_sync_at = now(),
              updated_at = now()
        where id = $1;`,
      [character.id, ids.length, `Lodestone validated: ${ownedMinionNames.length} parsed, ${ids.length} matched, ${unmatched.length} unmatched.`]
    );
    await client.query("commit");
    return { matched: ids.length, unmatched };
  } catch (error) {
    await client.query("rollback").catch(() => null);
    throw error;
  }
}

async function syncSingleCharacterMinions(client, character) {
  try {
    const scraped = await scrapeLodestoneMinions(character);
    if (scraped.expectedTotal === 0 && character.minion_ownership_initialized_at) {
      throw new Error("Unexpected zero-minion Lodestone result.");
    }
    const result = await upsertCharacterMinionOwnership(client, character, scraped.names);
    return {
      status: "success",
      ownedCount: result.matched,
      message: `${character.display_name}: Lodestone validated ${scraped.expectedTotal} minions (${result.matched} catalog matches).${!character.minion_ownership_initialized_at ? " Initial minion baseline completed; notifications are disabled." : ""}`
    };
  } catch (error) {
    const status = error?.status === 403
      ? "lodestone_private"
      : error?.status === 404
        ? "lodestone_missing"
        : "minion_sync_failed";
    await markCharacterMinionSyncStatus(client, character.id, status, {
      source: "lodestone",
      result: error instanceof Error ? error.message : String(error)
    });
    return {
      status: status === "lodestone_private" ? "private" : status === "lodestone_missing" ? "missing" : "failed",
      ownedCount: 0,
      message: `${character.display_name}: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function syncCharacterMinionOwnership(client) {
  const characters = await getCharactersForMinionSync(client);
  if (!characters.length) {
    return "Minion ownership sync skipped. No active current FC characters with Lodestone IDs were found.";
  }

  let synced = 0;
  let privateCount = 0;
  let missing = 0;
  let failed = 0;
  let totalOwnedRows = 0;

  for (const character of characters) {
    const result = await syncSingleCharacterMinions(client, character);
    if (result.status === "success") {
      synced += 1;
      totalOwnedRows += result.ownedCount;
    } else if (result.status === "private") {
      privateCount += 1;
    } else if (result.status === "missing") {
      missing += 1;
    } else {
      failed += 1;
    }
    console.log(`[cotf-worker] ${result.message}`);
    await sleep(Math.max(MOUNT_SYNC_REQUEST_DELAY_MS, 250));
  }

  const ownershipResult = await client.query(`
    select count(*)::int as total_rows,
           count(*) filter (where owned = true)::int as owned_rows
      from portal_character_minions;
  `);
  const counts = ownershipResult.rows[0];

  return [
    "Minion ownership sync complete.",
    `Characters checked: ${characters.length}.`,
    `Synced: ${synced}.`,
    `Private: ${privateCount}.`,
    `Missing: ${missing}.`,
    `Failed: ${failed}.`,
    `Owned minions reported this run: ${totalOwnedRows}.`,
    `Ownership rows in DB: ${counts.total_rows}.`,
    `Owned rows in DB: ${counts.owned_rows}.`,
    "Discord notifications: disabled."
  ].join(" ");
}

// =========================
// SECTION: Crafting Item and Recipe Catalog Sync
// =========================

const craftJobAliases = { Woodworking: "Carpenter", Smithing: "Blacksmith", Armorcraft: "Armorer", Goldsmithing: "Goldsmith", Leatherworking: "Leatherworker", Clothcraft: "Weaver", Alchemy: "Alchemist", Cooking: "Culinarian" };

function normalizeCraftingRecipeRow(row) {
  const xivapiId = toPositiveInteger(row?.row_id);
  const fields = row?.fields || {};
  const sourceCraftJob = getXivapiRelationshipName(fields.CraftType) || null;
  const outputItemXivapiId = toPositiveInteger(fields["ItemResult@as(raw)"]);
  const outputQuantity = toPositiveInteger(fields.AmountResult) || 1;
  const rawIngredientIds = Array.isArray(fields["Ingredient@as(raw)"])
    ? fields["Ingredient@as(raw)"]
    : [];
  const rawAmounts = Array.isArray(fields.AmountIngredient)
    ? fields.AmountIngredient
    : [];
  const ingredientsByItem = new Map();

  for (let index = 0; index < rawIngredientIds.length; index += 1) {
    const itemXivapiId = toPositiveInteger(rawIngredientIds[index]);
    const quantity = toPositiveInteger(rawAmounts[index]);
    if (!itemXivapiId || !quantity) continue;
    ingredientsByItem.set(
      itemXivapiId,
      (ingredientsByItem.get(itemXivapiId) || 0) + quantity
    );
  }

  if (!xivapiId || !outputItemXivapiId || ingredientsByItem.size === 0) {
    return null;
  }

  const level = fields.RecipeLevelTable?.fields || fields.RecipeLevelTable || {};
  const scaled = (base, factor) => Math.floor((Number(base) || 0) * (Number(factor) || 100) / 100);

  return {
    xivapiId,
    outputItemXivapiId,
    outputQuantity,
    craftJob: craftJobAliases[sourceCraftJob] || sourceCraftJob,
    recipeLevel: toPositiveInteger(fields["RecipeLevelTable@as(raw)"]),
    classJobLevel: toPositiveInteger(level.ClassJobLevel),
    durability: scaled(level.Durability, fields.DurabilityFactor),
    difficulty: scaled(level.Difficulty, fields.DifficultyFactor),
    quality: scaled(level.Quality, fields.QualityFactor),
    conditionsFlag: Number(level.ConditionsFlag) || 0,
    progressDivider: toPositiveInteger(level.ProgressDivider),
    qualityDivider: toPositiveInteger(level.QualityDivider),
    progressModifier: Number(level.ProgressModifier) || 100,
    qualityModifier: Number(level.QualityModifier) || 100,
    requiredCraftsmanship: Number(fields.RequiredCraftsmanship) || 0,
    requiredControl: Number(fields.RequiredControl) || 0,
    requiredQuality: Number(fields.RequiredQuality) || 0,
    stars: Number(level.Stars) || 0,
    canHq: Boolean(fields.CanHq),
    isExpert: Boolean(fields.IsExpert),
    isCollectable: Boolean(Number(fields["CollectableMetadata@as(raw)"]) > 0),
    ingredients: [...ingredientsByItem.entries()].map(([itemXivapiId, quantity]) => ({
      itemXivapiId,
      quantity
    }))
  };
}

async function fetchCraftingRecipeCatalogRows() {
  const maximumRecipes = Number.isFinite(CRAFTING_CATALOG_MAX_RECIPES) && CRAFTING_CATALOG_MAX_RECIPES > 0
    ? Math.floor(CRAFTING_CATALOG_MAX_RECIPES)
    : Number.MAX_SAFE_INTEGER;
  const pageSize = Math.min(Math.max(CRAFTING_CATALOG_PAGE_SIZE || 200, 25), 500);
  const recipes = [];
  let afterRowId = null;

  while (recipes.length < maximumRecipes) {
    const url = new URL(`${XIVAPI_BASE_URL}/api/sheet/Recipe`);
    url.searchParams.set("fields", CRAFTING_RECIPE_XIVAPI_FIELDS);
    url.searchParams.set("language", "en");
    url.searchParams.set("limit", String(Math.min(pageSize, maximumRecipes - recipes.length)));
    if (afterRowId !== null) url.searchParams.set("after", String(afterRowId));

    const payload = await fetchJson(url.toString());
    const pageRows = normalizeDutyRows(payload);
    if (!pageRows.length) break;

    const lastRowId = toPositiveInteger(pageRows[pageRows.length - 1]?.row_id);
    if (!lastRowId || lastRowId === afterRowId) {
      throw new Error("XIVAPI crafting recipe pagination did not advance.");
    }
    afterRowId = lastRowId;

    for (const row of pageRows) {
      const recipe = normalizeCraftingRecipeRow(row);
      if (recipe) recipes.push(recipe);
    }

    console.log(`[cotf-worker] Crafting recipe catalog fetch: ${recipes.length}${maximumRecipes === Number.MAX_SAFE_INTEGER ? "" : `/${maximumRecipes}`} usable recipes.`);
    await sleep(120);
  }

  return recipes.slice(0, maximumRecipes);
}

function chunkValues(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function normalizeCraftingItemRow(row) {
  const xivapiId = toPositiveInteger(row?.row_id);
  const fields = row?.fields || {};
  const name = String(fields.Name || "").trim();
  if (!xivapiId || !name) return null;
  return {
    xivapiId,
    name,
    iconUrl: buildXivapiAssetUrl(fields.Icon),
    canBeHq: Boolean(fields.CanBeHq),
    itemCategory: getXivapiRelationshipName(fields.ItemUICategory) || null,
    levelEquip: toPositiveInteger(fields.LevelEquip),
    itemLevel: toPositiveInteger(fields.LevelItem?.value),
    consumableType: Number(fields.ItemAction?.fields?.Data?.[0]) === 48 ? "food" : Number(fields.ItemAction?.fields?.Data?.[0]) === 49 ? "medicine" : null,
    itemFoodXivapiId: toPositiveInteger(fields.ItemAction?.fields?.Data?.[1])
  };
}

async function fetchCraftingItems(itemXivapiIds) {
  const items = new Map();
  for (const chunk of chunkValues([...itemXivapiIds], 100)) {
    if (!chunk.length) continue;
    const url = new URL(`${XIVAPI_BASE_URL}/api/sheet/Item`);
    url.searchParams.set("fields", CRAFTING_ITEM_XIVAPI_FIELDS);
    url.searchParams.set("language", "en");
    url.searchParams.set("rows", chunk.join(","));
    const payload = await fetchJson(url.toString());

    for (const row of normalizeDutyRows(payload)) {
      const item = normalizeCraftingItemRow(row);
      if (item) items.set(item.xivapiId, item);
    }

    console.log(`[cotf-worker] Crafting item catalog fetch: ${items.size}/${itemXivapiIds.size} items received.`);
    await sleep(120);
  }
  return items;
}

async function fetchCraftingConsumableItems() {
  const items = new Map();
  let cursor = null;
  do {
    const url = new URL(`${XIVAPI_BASE_URL}/api/search`);
    url.searchParams.set("fields", CRAFTING_ITEM_XIVAPI_FIELDS);
    url.searchParams.set("language", "en");
    url.searchParams.set("limit", "500");
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    } else {
      url.searchParams.set("sheets", "Item");
      url.searchParams.set("query", "+(ItemAction.Data[0]=48 ItemAction.Data[0]=49)");
    }
    const payload = await fetchJson(url.toString());
    for (const row of payload?.results || []) {
      const item = normalizeCraftingItemRow(row);
      if (item?.consumableType && item.itemFoodXivapiId) items.set(item.xivapiId, item);
    }
    cursor = String(payload?.next || "").trim() || null;
    console.log(`[cotf-worker] Crafting consumable discovery: ${items.size} items received.`);
    if (cursor) await sleep(120);
  } while (cursor);
  return items;
}

async function fetchCraftingItemFoodRows(itemFoodIds) {
  if (!itemFoodIds.length) return [];
  const url = new URL(`${XIVAPI_BASE_URL}/api/sheet/ItemFood`);
  url.searchParams.set("fields", CRAFTING_ITEM_FOOD_XIVAPI_FIELDS);
  url.searchParams.set("language", "en");
  url.searchParams.set("rows", itemFoodIds.join(","));
  try {
    const payload = await fetchJson(url.toString());
    return normalizeDutyRows(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("404 Not Found")) throw error;
    if (itemFoodIds.length === 1) {
      console.warn(`[cotf-worker] Skipping missing XIVAPI ItemFood row ${itemFoodIds[0]}.`);
      return [];
    }
    const midpoint = Math.ceil(itemFoodIds.length / 2);
    const left = await fetchCraftingItemFoodRows(itemFoodIds.slice(0, midpoint));
    const right = await fetchCraftingItemFoodRows(itemFoodIds.slice(midpoint));
    return [...left, ...right];
  }
}

async function fetchCraftingConsumableBonuses(itemsByXivapiId) {
  const ids = new Set([...itemsByXivapiId.values()].map((item) => item.itemFoodXivapiId).filter(Boolean));
  const bonusesById = new Map();
  for (const chunk of chunkValues([...ids], 100)) {
    const rows = await fetchCraftingItemFoodRows(chunk);
    for (const row of rows) {
      const fields = row?.fields || {};
      const params = fields["BaseParam@as(raw)"] || [];
      const relative = fields.IsRelative || [];
      const values = fields.Value || [];
      const valuesHq = fields.ValueHQ || [];
      const max = fields.Max || [];
      const maxHq = fields.MaxHQ || [];
      const bonuses = params.map((param, index) => ({
        stat: Number(param) === 11 ? "cp" : Number(param) === 70 ? "craftsmanship" : Number(param) === 71 ? "control" : null,
        relative: Boolean(relative[index]), value: Number(values[index]) || 0, valueHq: Number(valuesHq[index]) || 0,
        max: Number(max[index]) || 0, maxHq: Number(maxHq[index]) || 0
      })).filter((bonus) => bonus.stat && (bonus.value || bonus.valueHq));
      if (bonuses.length) bonusesById.set(Number(row.row_id), bonuses);
    }
    await sleep(120);
  }
  return bonusesById;
}

async function persistCraftingCatalog(client, recipes, itemsByXivapiId, consumableBonusesById) {
  const outputItemXivapiIds = new Set(recipes.map((recipe) => recipe.outputItemXivapiId));
  const items = [...itemsByXivapiId.values()];
  let itemWrites = 0;

  for (const chunk of chunkValues(items, 300)) {
    await client.query(`
      insert into portal_crafting_items
        (external_key, xivapi_id, name, icon_url, can_be_hq, is_raw, source_kind, item_category, level_equip, item_level, last_synced_at, updated_at)
       select external_key, xivapi_id, name, icon_url, can_be_hq, is_raw, 'xivapi', item_category, level_equip, item_level, now(), now()
       from unnest($1::text[], $2::int[], $3::text[], $4::text[], $5::boolean[], $6::boolean[], $7::text[], $8::int[], $9::int[])
         as data(external_key, xivapi_id, name, icon_url, can_be_hq, is_raw, item_category, level_equip, item_level)
      on conflict (external_key) do update set
        xivapi_id = excluded.xivapi_id,
        name = excluded.name,
        icon_url = coalesce(excluded.icon_url, portal_crafting_items.icon_url),
        can_be_hq = excluded.can_be_hq,
        is_raw = excluded.is_raw,
        source_kind = 'xivapi',
        item_category = excluded.item_category,
        level_equip = excluded.level_equip,
        item_level = excluded.item_level,
        last_synced_at = now(),
        updated_at = now();`, [
      chunk.map((item) => `xivapi_item_${item.xivapiId}`),
      chunk.map((item) => item.xivapiId),
      chunk.map((item) => item.name),
      chunk.map((item) => item.iconUrl),
      chunk.map((item) => item.canBeHq),
      chunk.map((item) => !outputItemXivapiIds.has(item.xivapiId)),
      chunk.map((item) => item.itemCategory),
      chunk.map((item) => item.levelEquip),
      chunk.map((item) => item.itemLevel)
    ]);
    itemWrites += chunk.length;
  }

  const itemIdResult = await client.query(
    `select id::int, xivapi_id::int from portal_crafting_items where xivapi_id = any($1::int[]);`,
    [[...itemsByXivapiId.keys()]]
  );
  const databaseItemIdByXivapiId = new Map(itemIdResult.rows.map((row) => [row.xivapi_id, row.id]));
  const completeRecipes = recipes.filter((recipe) =>
    databaseItemIdByXivapiId.has(recipe.outputItemXivapiId) &&
    recipe.ingredients.every((ingredient) => databaseItemIdByXivapiId.has(ingredient.itemXivapiId))
  );
  const recipeIdByXivapiId = new Map();

  for (const chunk of chunkValues(completeRecipes, 300)) {
    const result = await client.query(`
      insert into portal_crafting_recipes
        (xivapi_id, output_item_id, output_quantity, preferred, source_kind, craft_job, recipe_level, class_job_level, durability, difficulty, quality, conditions_flag, progress_divider, quality_divider, progress_modifier, quality_modifier, required_craftsmanship, required_control, required_quality, stars, can_hq, is_expert, is_collectable, last_synced_at)
      select xivapi_id, output_item_id, output_quantity, false, 'xivapi', craft_job, recipe_level, class_job_level, durability, difficulty, quality, conditions_flag, progress_divider, quality_divider, progress_modifier, quality_modifier, required_craftsmanship, required_control, required_quality, stars, can_hq, is_expert, is_collectable, now()
      from jsonb_to_recordset($1::jsonb) as data(xivapi_id int, output_item_id bigint, output_quantity int, craft_job text, recipe_level int, class_job_level int, durability int, difficulty int, quality int, conditions_flag int, progress_divider int, quality_divider int, progress_modifier int, quality_modifier int, required_craftsmanship int, required_control int, required_quality int, stars int, can_hq boolean, is_expert boolean, is_collectable boolean)
      on conflict (xivapi_id) where xivapi_id is not null do update set
        output_item_id = excluded.output_item_id,
        output_quantity = excluded.output_quantity,
        source_kind = 'xivapi',
        craft_job = excluded.craft_job, recipe_level=excluded.recipe_level, class_job_level=excluded.class_job_level,
        durability=excluded.durability, difficulty=excluded.difficulty, quality=excluded.quality, conditions_flag=excluded.conditions_flag,
        progress_divider=excluded.progress_divider, quality_divider=excluded.quality_divider, progress_modifier=excluded.progress_modifier,
        quality_modifier=excluded.quality_modifier, required_craftsmanship=excluded.required_craftsmanship, required_control=excluded.required_control,
        required_quality=excluded.required_quality, stars=excluded.stars, can_hq=excluded.can_hq, is_expert=excluded.is_expert, is_collectable=excluded.is_collectable,
        last_synced_at = now()
      returning id::int, xivapi_id::int;`, [JSON.stringify(chunk.map((recipe) => ({...recipe, outputItemId: undefined, ingredients: undefined, output_item_id: databaseItemIdByXivapiId.get(recipe.outputItemXivapiId), output_quantity: recipe.outputQuantity, craft_job: recipe.craftJob, recipe_level: recipe.recipeLevel, class_job_level: recipe.classJobLevel, conditions_flag: recipe.conditionsFlag, progress_divider: recipe.progressDivider, quality_divider: recipe.qualityDivider, progress_modifier: recipe.progressModifier, quality_modifier: recipe.qualityModifier, required_craftsmanship: recipe.requiredCraftsmanship, required_control: recipe.requiredControl, required_quality: recipe.requiredQuality, can_hq: recipe.canHq, is_expert: recipe.isExpert, is_collectable: recipe.isCollectable, xivapi_id: recipe.xivapiId}))) ]);
    for (const row of result.rows) recipeIdByXivapiId.set(row.xivapi_id, row.id);
  }

  const recipeDatabaseIds = [...recipeIdByXivapiId.values()];
  if (recipeDatabaseIds.length) {
    await client.query(`delete from portal_crafting_recipe_ingredients where recipe_id = any($1::bigint[]);`, [recipeDatabaseIds]);
  }

  const ingredients = [];
  for (const recipe of completeRecipes) {
    const recipeId = recipeIdByXivapiId.get(recipe.xivapiId);
    if (!recipeId) continue;
    for (const ingredient of recipe.ingredients) {
      ingredients.push({
        recipeId,
        itemId: databaseItemIdByXivapiId.get(ingredient.itemXivapiId),
        quantity: ingredient.quantity
      });
    }
  }
  for (const chunk of chunkValues(ingredients, 1200)) {
    await client.query(`
      insert into portal_crafting_recipe_ingredients (recipe_id, item_id, quantity)
      select recipe_id, item_id, quantity
      from unnest($1::bigint[], $2::bigint[], $3::int[])
        as data(recipe_id, item_id, quantity)
      on conflict (recipe_id, item_id) do update set quantity = excluded.quantity;`, [
      chunk.map((ingredient) => ingredient.recipeId),
      chunk.map((ingredient) => ingredient.itemId),
      chunk.map((ingredient) => ingredient.quantity)
    ]);
  }

  await client.query(`delete from portal_crafting_consumables;`);
  for (const item of items) {
    if (!item.consumableType || !item.itemFoodXivapiId) continue;
    const bonuses = consumableBonusesById.get(item.itemFoodXivapiId);
    const itemId = databaseItemIdByXivapiId.get(item.xivapiId);
    if (!bonuses || !itemId) continue;
    await client.query(`insert into portal_crafting_consumables (item_id,item_food_xivapi_id,consumable_type,bonuses,last_synced_at) values ($1,$2,$3,$4::jsonb,now()) on conflict (item_id,item_food_xivapi_id) do update set consumable_type=excluded.consumable_type,bonuses=excluded.bonuses,last_synced_at=now();`, [itemId,item.itemFoodXivapiId,item.consumableType,JSON.stringify(bonuses)]);
  }

  /* Respect any future officer override: only assign an automatic preferred
     recipe if no recipe for that output already has one. */
  await client.query(`
    with automatic_candidates as (
      select distinct on (r.output_item_id) r.id
      from portal_crafting_recipes r
      where r.source_kind = 'xivapi'
        and not exists (
          select 1 from portal_crafting_recipes preferred_recipe
          where preferred_recipe.output_item_id = r.output_item_id
            and preferred_recipe.preferred = true
        )
      order by r.output_item_id, r.xivapi_id
    )
    update portal_crafting_recipes recipe
    set preferred = true
    from automatic_candidates candidate
    where recipe.id = candidate.id;`);

  return { itemWrites, recipeWrites: completeRecipes.length, ingredientWrites: ingredients.length };
}

async function getCraftingRecipeCatalogVersion() {
  const url = new URL(`${XIVAPI_BASE_URL}/api/sheet/Recipe`);
  url.searchParams.set("fields", "AmountResult");
  url.searchParams.set("language", "en");
  url.searchParams.set("limit", "1");
  const payload = await fetchJson(url.toString());
  const version = String(payload?.version || "").trim();
  return version || null;
}
async function syncCraftingCatalogIfDue(client) {
  const state = await client.query(`select last_successful_sync_at, catalog_version, source_version from portal_crafting_catalog_sync_state where id = 1;`);
  const stateRow = state.rows[0];
  const lastSuccessful = stateRow?.last_successful_sync_at ? new Date(stateRow.last_successful_sync_at) : null;
  const intervalMs = Math.max(CRAFTING_CATALOG_SYNC_INTERVAL_HOURS || 168, 1) * 60 * 60 * 1000;
  const catalogIsCurrent = lastSuccessful && Number(stateRow?.catalog_version || 0) >= CRAFTING_CATALOG_SCHEMA_VERSION && Date.now() - lastSuccessful.getTime() < intervalMs;
  if (catalogIsCurrent && stateRow?.source_version) {
    try {
      const upstreamVersion = await getCraftingRecipeCatalogVersion();
      if (!upstreamVersion || upstreamVersion === stateRow.source_version) {
        return `Crafting catalog is current; next full import is due after ${formatCentralDateTime(lastSuccessful)}.`;
      }
      console.log("[cotf-worker] XIVAPI recipe data version changed; refreshing the full crafting catalog.");
    } catch {
      return "Crafting catalog is current; XIVAPI version check will retry on the next worker run.";
    }
  } else if (catalogIsCurrent) {
    return `Crafting catalog is current; next full import is due after ${formatCentralDateTime(lastSuccessful)}.`;
  }

  await client.query(`update portal_crafting_catalog_sync_state set last_attempt_at = now(), last_error = null, updated_at = now() where id = 1;`);
  try {
    const sourceVersion = await getCraftingRecipeCatalogVersion();
    const recipes = await fetchCraftingRecipeCatalogRows();
    if (!recipes.length) throw new Error("XIVAPI returned no usable crafting recipes.");
    const requestedItemIds = new Set();
    for (const recipe of recipes) {
      requestedItemIds.add(recipe.outputItemXivapiId);
      for (const ingredient of recipe.ingredients) requestedItemIds.add(ingredient.itemXivapiId);
    }
    const itemsByXivapiId = await fetchCraftingItems(requestedItemIds);
    if (!itemsByXivapiId.size) throw new Error("XIVAPI returned no crafting item records.");
    const consumableItems = await fetchCraftingConsumableItems();
    for (const [xivapiId, item] of consumableItems) itemsByXivapiId.set(xivapiId, item);
    const consumableBonusesById = await fetchCraftingConsumableBonuses(itemsByXivapiId);

    await client.query("begin");
    let counts;
    try {
      counts = await persistCraftingCatalog(client, recipes, itemsByXivapiId, consumableBonusesById);
      await client.query(`update portal_crafting_catalog_sync_state set last_successful_sync_at = now(), catalog_version = $1, source_version = $2, last_error = null, updated_at = now() where id = 1;`, [CRAFTING_CATALOG_SCHEMA_VERSION, sourceVersion]);
      await client.query(`update portal_crafting_source_sync_state set last_successful_sync_at = null, last_error = null, updated_at = now() where source_key = 'gathering';`);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
    return `Crafting catalog sync complete. Recipes: ${counts.recipeWrites}. Items: ${counts.itemWrites}. Ingredients: ${counts.ingredientWrites}.`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await client.query(`update portal_crafting_catalog_sync_state set last_error = $1, updated_at = now() where id = 1;`, [message]);
    throw error;
  }
}
// =========================
// SECTION: Official Company Workshop Import
// =========================

function rawXivapiField(fields, name) {
  const raw = fields?.[`${name}@as(raw)`];
  if (raw !== undefined) return raw;
  const value = fields?.[name];
  return value?.value ?? value;
}

function xivapiFieldName(value) {
  return String(value?.fields?.Name || value?.Name || "").trim();
}

async function getXivapiSheetVersion(sheet, fields) {
  const url = new URL(`${XIVAPI_BASE_URL}/api/sheet/${sheet}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("language", "en");
  url.searchParams.set("limit", "1");
  const payload = await fetchJson(url.toString());
  const version = String(payload?.version || "").trim();
  return version || null;
}

async function fetchCompanyWorkshopPlans() {
  const [sequenceRows, partRows, processRows, supplyRows] = await Promise.all([
    fetchAllXivapiSheetRows("CompanyCraftSequence", COMPANY_CRAFT_SEQUENCE_XIVAPI_FIELDS),
    fetchAllXivapiSheetRows("CompanyCraftPart", COMPANY_CRAFT_PART_XIVAPI_FIELDS),
    fetchAllXivapiSheetRows("CompanyCraftProcess", COMPANY_CRAFT_PROCESS_XIVAPI_FIELDS),
    fetchAllXivapiSheetRows("CompanyCraftSupplyItem", COMPANY_CRAFT_SUPPLY_ITEM_XIVAPI_FIELDS)
  ]);

  const partById = new Map(partRows.map((row) => [toPositiveInteger(row?.row_id), row]));
  const processById = new Map(processRows.map((row) => [toPositiveInteger(row?.row_id), row]));
  const itemXivapiIdBySupplyId = new Map(
    supplyRows.map((row) => [
      toPositiveInteger(row?.row_id),
      toPositiveInteger(rawXivapiField(row?.fields || {}, "Item"))
    ])
  );
  const plans = [];

  for (const sequence of sequenceRows) {
    const sequenceId = toPositiveInteger(sequence?.row_id);
    const fields = sequence?.fields || {};
    const resultItemXivapiId = toPositiveInteger(rawXivapiField(fields, "ResultItem"));
    const partIds = Array.isArray(rawXivapiField(fields, "CompanyCraftPart"))
      ? rawXivapiField(fields, "CompanyCraftPart")
      : [];
    const phases = [];
    let phaseNumber = 1;

    for (const rawPartId of partIds) {
      const partId = toPositiveInteger(rawPartId);
      const part = partById.get(partId);
      if (!partId || !part) continue;
      const partFields = part.fields || {};
      const partName = xivapiFieldName(partFields.CompanyCraftType) || "Workshop assembly";
      const processIds = Array.isArray(rawXivapiField(partFields, "CompanyCraftProcess"))
        ? rawXivapiField(partFields, "CompanyCraftProcess")
        : [];

      for (let processIndex = 0; processIndex < processIds.length; processIndex += 1) {
        const processId = toPositiveInteger(processIds[processIndex]);
        const process = processById.get(processId);
        if (!processId || !process) continue;
        const processFields = process.fields || {};
        const supplyIds = Array.isArray(rawXivapiField(processFields, "SupplyItem"))
          ? rawXivapiField(processFields, "SupplyItem")
          : [];
        const setQuantities = Array.isArray(processFields.SetQuantity) ? processFields.SetQuantity : [];
        const setsRequired = Array.isArray(processFields.SetsRequired) ? processFields.SetsRequired : [];
        const materialByItemId = new Map();

        for (let materialIndex = 0; materialIndex < supplyIds.length; materialIndex += 1) {
          const supplyId = toPositiveInteger(supplyIds[materialIndex]);
          const itemXivapiId = itemXivapiIdBySupplyId.get(supplyId) || 0;
          const setQuantity = toPositiveInteger(setQuantities[materialIndex]);
          const setCount = toPositiveInteger(setsRequired[materialIndex]);
          if (!supplyId || !itemXivapiId || !setQuantity || !setCount) continue;
          const existing = materialByItemId.get(itemXivapiId);
          materialByItemId.set(itemXivapiId, existing
            ? { ...existing, baseQuantity: existing.baseQuantity + (setQuantity * setCount) }
            : { itemXivapiId, baseQuantity: setQuantity * setCount, workshopBatchQuantity: setQuantity, baseBatchCount: setCount });
        }

        if (!materialByItemId.size) continue;
        phases.push({
          phaseNumber,
          title: `Phase ${phaseNumber} — ${partName} · stage ${processIndex + 1}`,
          description: `Official Company Workshop assembly stage ${processIndex + 1} for ${partName}.`,
          materials: [...materialByItemId.values()]
        });
        phaseNumber += 1;
      }
    }

    if (!sequenceId || !resultItemXivapiId || !phases.length) continue;
    plans.push({
      xivapiId: sequenceId,
      resultItemXivapiId,
      nameFallback: xivapiFieldName(fields.CompanyCraftType) || `Company Workshop plan ${sequenceId}`,
      category: xivapiFieldName(fields.CompanyCraftDraftCategory) || "Company Workshop",
      phases
    });
  }

  return plans;
}

async function persistAdditionalCraftingItems(client, itemsByXivapiId) {
  const items = [...itemsByXivapiId.values()];
  for (const chunk of chunkValues(items, 300)) {
    await client.query(`
      insert into portal_crafting_items
        (external_key, xivapi_id, name, icon_url, can_be_hq, is_raw, source_kind, item_category, level_equip, item_level, last_synced_at, updated_at)
      select external_key, xivapi_id, name, icon_url, can_be_hq, true, 'xivapi', item_category, level_equip, item_level, now(), now()
      from unnest($1::text[], $2::int[], $3::text[], $4::text[], $5::boolean[], $6::text[], $7::int[], $8::int[])
        as data(external_key, xivapi_id, name, icon_url, can_be_hq, item_category, level_equip, item_level)
      on conflict (external_key) do update set
        name = excluded.name,
        icon_url = coalesce(excluded.icon_url, portal_crafting_items.icon_url),
        can_be_hq = excluded.can_be_hq,
        source_kind = 'xivapi',
        item_category = excluded.item_category,
        level_equip = excluded.level_equip,
        item_level = excluded.item_level,
        last_synced_at = now(),
        updated_at = now();`, [
      chunk.map((item) => `xivapi_item_${item.xivapiId}`),
      chunk.map((item) => item.xivapiId),
      chunk.map((item) => item.name),
      chunk.map((item) => item.iconUrl),
      chunk.map((item) => item.canBeHq),
      chunk.map((item) => item.itemCategory),
      chunk.map((item) => item.levelEquip),
      chunk.map((item) => item.itemLevel)
    ]);
  }
}

async function persistCompanyWorkshopPlans(client, plans, itemsByXivapiId) {
  await persistAdditionalCraftingItems(client, itemsByXivapiId);
  const databaseItems = await client.query(
    `select id::int, xivapi_id::int, name from portal_crafting_items where xivapi_id = any($1::int[]);`,
    [[...itemsByXivapiId.keys()]]
  );
  const itemByXivapiId = new Map(databaseItems.rows.map((row) => [row.xivapi_id, row]));
  let templateCount = 0;
  let phaseCount = 0;
  let materialCount = 0;

  for (const plan of plans) {
    const resultItem = itemByXivapiId.get(plan.resultItemXivapiId);
    if (!resultItem) continue;
    const template = await client.query(`
      insert into portal_crafting_workshop_templates
        (external_key, xivapi_id, name, category, description, is_development_fixture, source_kind, active, last_synced_at)
      values ($1,$2,$3,$4,$5,false,'xivapi_company_craft',true,now())
      on conflict (external_key) do update set
        xivapi_id = excluded.xivapi_id,
        name = excluded.name,
        category = excluded.category,
        description = excluded.description,
        is_development_fixture = false,
        source_kind = 'xivapi_company_craft',
        active = true,
        last_synced_at = now()
      returning id::int;`, [
      `xivapi_company_craft_sequence_${plan.xivapiId}`,
      plan.xivapiId,
      resultItem.name || plan.nameFallback,
      plan.category,
      `Official Company Workshop plan for ${resultItem.name || plan.nameFallback}.`
    ]);
    const templateId = template.rows[0]?.id;
    if (!templateId) continue;
    templateCount += 1;

    for (const phase of plan.phases) {
      const phaseResult = await client.query(`
        insert into portal_crafting_workshop_template_phases (template_id, phase_number, title, description)
        values ($1,$2,$3,$4)
        on conflict (template_id, phase_number) do update set title=excluded.title, description=excluded.description
        returning id::int;`, [templateId, phase.phaseNumber, phase.title, phase.description]);
      const templatePhaseId = phaseResult.rows[0]?.id;
      if (!templatePhaseId) continue;
      phaseCount += 1;
      let sortOrder = 10;
      for (const material of phase.materials) {
        const item = itemByXivapiId.get(material.itemXivapiId);
        if (!item) continue;
        await client.query(`
          insert into portal_crafting_workshop_template_materials
            (template_phase_id, item_id, base_quantity, workshop_batch_quantity, base_batch_count, sort_order)
          values ($1,$2,$3,$4,$5,$6)
          on conflict (template_phase_id, item_id) do update set
            base_quantity=excluded.base_quantity,
            workshop_batch_quantity=excluded.workshop_batch_quantity,
            base_batch_count=excluded.base_batch_count,
            sort_order=excluded.sort_order;`, [templatePhaseId, item.id, material.baseQuantity, material.workshopBatchQuantity, material.baseBatchCount, sortOrder]);
        sortOrder += 10;
        materialCount += 1;
      }
    }
  }
  return { templateCount, phaseCount, materialCount };
}

async function syncCompanyWorkshopPlansIfDue(client) {
  const state = await client.query(`select last_successful_sync_at, sync_version, source_version from portal_crafting_workshop_sync_state where id=1;`);
  const stateRow = state.rows[0];
  const lastSuccessful = stateRow?.last_successful_sync_at ? new Date(stateRow.last_successful_sync_at) : null;
  const intervalMs = Math.max(CRAFTING_WORKSHOP_SYNC_INTERVAL_HOURS || 168, 1) * 60 * 60 * 1000;
  const isCurrent = lastSuccessful && Number(stateRow?.sync_version || 0) >= CRAFTING_WORKSHOP_SCHEMA_VERSION && Date.now() - lastSuccessful.getTime() < intervalMs;
  if (isCurrent && stateRow?.source_version) {
    try {
      const upstreamVersion = await getXivapiSheetVersion("CompanyCraftSequence", COMPANY_CRAFT_SEQUENCE_XIVAPI_FIELDS);
      if (!upstreamVersion || upstreamVersion === stateRow.source_version) {
        return `Company Workshop plans are current; next full import is due after ${formatCentralDateTime(lastSuccessful)}.`;
      }
      console.log("[cotf-worker] XIVAPI Company Workshop data changed; refreshing official plans.");
    } catch {
      return "Company Workshop plans are current; XIVAPI version check will retry on the next worker run.";
    }
  } else if (isCurrent) {
    return `Company Workshop plans are current; next full import is due after ${formatCentralDateTime(lastSuccessful)}.`;
  }

  await client.query(`update portal_crafting_workshop_sync_state set last_attempt_at=now(), last_error=null, updated_at=now() where id=1;`);
  try {
    const sourceVersion = await getXivapiSheetVersion("CompanyCraftSequence", COMPANY_CRAFT_SEQUENCE_XIVAPI_FIELDS);
    const plans = await fetchCompanyWorkshopPlans();
    if (!plans.length) throw new Error("XIVAPI returned no usable Company Workshop plans.");
    const itemIds = new Set();
    for (const plan of plans) {
      itemIds.add(plan.resultItemXivapiId);
      for (const phase of plan.phases) for (const material of phase.materials) itemIds.add(material.itemXivapiId);
    }
    const itemsByXivapiId = await fetchCraftingItems(itemIds);
    if (!itemsByXivapiId.size) throw new Error("XIVAPI returned no Company Workshop item records.");

    await client.query("begin");
    try {
      const counts = await persistCompanyWorkshopPlans(client, plans, itemsByXivapiId);
      await client.query(`update portal_crafting_workshop_sync_state set last_successful_sync_at=now(), sync_version=$1, source_version=$2, last_error=null, updated_at=now() where id=1;`, [CRAFTING_WORKSHOP_SCHEMA_VERSION, sourceVersion]);
      await client.query(`update portal_crafting_source_sync_state set last_successful_sync_at=null, last_error=null, updated_at=now() where source_key='gathering';`);
      await client.query("commit");
      return `Company Workshop import complete. Plans: ${counts.templateCount}. Stages: ${counts.phaseCount}. Materials: ${counts.materialCount}.`;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await client.query(`update portal_crafting_workshop_sync_state set last_error=$1, updated_at=now() where id=1;`, [message]);
    throw error;
  }
}
// =========================
// SECTION: Gathering Source Sync
// =========================

async function fetchAllXivapiSheetRows(sheet, fields) {
  const rows = [];
  let afterRowId = null;
  while (true) {
    const url = new URL(`${XIVAPI_BASE_URL}/api/sheet/${sheet}`);
    url.searchParams.set("fields", fields);
    url.searchParams.set("language", "en");
    url.searchParams.set("limit", "500");
    if (afterRowId !== null) url.searchParams.set("after", String(afterRowId));
    const payload = await fetchJson(url.toString());
    const pageRows = normalizeDutyRows(payload);
    if (!pageRows.length) break;
    rows.push(...pageRows);
    const lastRowId = toPositiveInteger(pageRows[pageRows.length - 1]?.row_id);
    if (!lastRowId || lastRowId === afterRowId) {
      throw new Error(`XIVAPI ${sheet} pagination did not advance.`);
    }
    afterRowId = lastRowId;
    console.log(`[cotf-worker] ${sheet} source fetch: ${rows.length} rows received.`);
    await sleep(120);
  }
  return rows;
}

function gatheringPointLocation(fields) {
  return String(
    fields?.TerritoryType?.fields?.PlaceName?.fields?.Name || ""
  ).trim();
}

async function syncGatheringSourcesIfDue(client) {
  const state = await client.query(`select last_successful_sync_at from portal_crafting_source_sync_state where source_key = 'gathering';`);
  const stateRow = state.rows[0];
  const lastSuccessful = stateRow?.last_successful_sync_at ? new Date(stateRow.last_successful_sync_at) : null;
  const intervalMs = Math.max(CRAFTING_CATALOG_SYNC_INTERVAL_HOURS || 168, 1) * 60 * 60 * 1000;
  if (lastSuccessful && Date.now() - lastSuccessful.getTime() < intervalMs) {
    return "Gathering source data is current.";
  }

  await client.query(`update portal_crafting_source_sync_state set last_attempt_at = now(), last_error = null, updated_at = now() where source_key = 'gathering';`);
  try {
    const [baseRows, pointRows] = await Promise.all([
      fetchAllXivapiSheetRows("GatheringPointBase", GATHERING_POINT_BASE_XIVAPI_FIELDS),
      fetchAllXivapiSheetRows("GatheringPoint", GATHERING_POINT_XIVAPI_FIELDS)
    ]);
    const baseItems = new Map();
    for (const row of baseRows) {
      const baseId = toPositiveInteger(row?.row_id);
      const fields = row?.fields || {};
      const gatheringType = getXivapiRelationshipName(fields.GatheringType) || "Gathering";
      const itemIds = Array.isArray(fields["Item@as(raw)"])
        ? [...new Set(fields["Item@as(raw)"].map((itemId) => toPositiveInteger(itemId)).filter(Boolean))]
        : [];
      if (baseId && itemIds.length) baseItems.set(baseId, { gatheringType, itemIds });
    }

    const pointsByBase = new Map();
    for (const row of pointRows) {
      const pointId = toPositiveInteger(row?.row_id);
      const fields = row?.fields || {};
      const baseId = toPositiveInteger(fields["GatheringPointBase@as(raw)"]);
      const location = gatheringPointLocation(fields);
      if (!pointId || !baseId || !location) continue;
      const points = pointsByBase.get(baseId) ?? [];
      points.push({ pointId, location });
      pointsByBase.set(baseId, points);
    }

    const itemXivapiIds = [...new Set([...baseItems.values()].flatMap((entry) => entry.itemIds))];
    const databaseItems = itemXivapiIds.length
      ? await client.query(`select id::int, xivapi_id::int from portal_crafting_items where xivapi_id = any($1::int[]);`, [itemXivapiIds])
      : { rows: [] };
    const databaseItemIdByXivapiId = new Map(databaseItems.rows.map((row) => [row.xivapi_id, row.id]));
    const sourceByKey = new Map();
    for (const [baseId, base] of baseItems) {
      const uniquePoints = new Map((pointsByBase.get(baseId) ?? []).map((point) => [point.location, point]));
      for (const itemXivapiId of base.itemIds) {
        const itemId = databaseItemIdByXivapiId.get(itemXivapiId);
        if (!itemId) continue;
        for (const point of uniquePoints.values()) {
          const externalKey = `xivapi_gathering_${baseId}_${itemXivapiId}_${point.location.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
          sourceByKey.set(externalKey, { itemId, externalKey, name: base.gatheringType, location: point.location, pointId: point.pointId, baseId });
        }
      }
    }
    const sources = [...sourceByKey.values()];

    await client.query("begin");
    try {
      for (const chunk of chunkValues(sources, 500)) {
        await client.query(`
          insert into portal_crafting_item_sources
            (item_id, external_key, source_type, source_name, location_name, details, source_kind, last_synced_at, updated_at)
          select item_id, external_key, 'gathering', source_name, location_name, details::jsonb, 'xivapi', now(), now()
          from unnest($1::bigint[], $2::text[], $3::text[], $4::text[], $5::text[])
            as data(item_id, external_key, source_name, location_name, details)
          on conflict (external_key) do update set
            item_id = excluded.item_id,
            source_type = 'gathering',
            source_name = excluded.source_name,
            location_name = excluded.location_name,
            details = excluded.details,
            source_kind = 'xivapi',
            last_synced_at = now(),
            updated_at = now();`, [
          chunk.map((source) => source.itemId),
          chunk.map((source) => source.externalKey),
          chunk.map((source) => source.name),
          chunk.map((source) => source.location),
          chunk.map((source) => JSON.stringify({ gatheringPointId: source.pointId, gatheringPointBaseId: source.baseId }))
        ]);
      }
      await client.query(`update portal_crafting_source_sync_state set last_successful_sync_at = now(), last_error = null, updated_at = now() where source_key = 'gathering';`);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
    return `Gathering source sync complete. Sources: ${sources.length}. Zones: ${new Set(sources.map((source) => source.location)).size}.`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await client.query(`update portal_crafting_source_sync_state set last_error = $1, updated_at = now() where source_key = 'gathering';`, [message]);
    throw error;
  }
}
async function syncTeamcraftSourcesIfDue(client) {
  const key = "teamcraft_sources_v2";
  const state = await client.query(`select last_successful_sync_at from portal_crafting_source_sync_state where source_key=$1`, [key]);
  const last = state.rows[0]?.last_successful_sync_at ? new Date(state.rows[0].last_successful_sync_at) : null;
  if (last && Date.now() - last.getTime() < Math.max(CRAFTING_CATALOG_SYNC_INTERVAL_HOURS || 168, 1) * 3600000) return "Vendor and monster-drop source data is current.";
  await client.query(`update portal_crafting_source_sync_state set last_attempt_at=now(),last_error=null,updated_at=now() where source_key=$1`, [key]);
  try {
    const db = await client.query(`select id::int,xivapi_id::int from portal_crafting_items where xivapi_id is not null`);
    const ids = new Map(db.rows.map(row => [row.xivapi_id, row.id]));
    if (!ids.size) return "Vendor and monster-drop sources are waiting for the crafting catalog.";
    const get = async (file) => fetchJson(`${TEAMCRAFT_DATA_BASE_URL}/${file}`);
    const [shops,npcs,places,drops,mobs,monsters] = await Promise.all([get("shops.json"),get("npcs.json"),get("places.json"),get("drop-sources.json"),get("mobs.json"),get("monsters.json")]);
    const place = (zoneId) => String(places?.[String(zoneId)]?.en || "").trim() || null;
    const coordinate = (value) => { const parsed = Number(value); return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : null; };
    const source = new Map();
    for (const shop of Array.isArray(shops) ? shops : []) {
      if (shop?.type !== "GilShop" || !Array.isArray(shop?.npcs) || !Array.isArray(shop?.trades)) continue;
      for (const trade of shop.trades) {
        const gil = Array.isArray(trade?.currencies) ? trade.currencies.find(currency => Number(currency?.id) === 1) : null;
        if (!gil || !Array.isArray(trade?.items)) continue;
        for (const item of trade.items) for (const npcId of shop.npcs) {
          const xivapiId=toPositiveInteger(item?.id),itemId=xivapiId ? ids.get(xivapiId) : null,npc=npcs?.[String(npcId)],name=String(npc?.en||"").trim(),zoneId=toPositiveInteger(npc?.position?.zoneid),location=place(zoneId);
          if (!itemId || !name || !location) continue;
          const externalKey=`teamcraft_vendor_${xivapiId}_${npcId}_${zoneId}`; source.set(externalKey,{itemId,externalKey,type:"vendor",name:`Vendor: ${name}`,location,details:{npcId:Number(npcId),zoneId,priceGil:toPositiveInteger(gil.amount)||null,x:coordinate(npc?.position?.x),y:coordinate(npc?.position?.y)}});
        }
      }
    }
    for (const [rawItemId,list] of Object.entries(drops || {})) {
      const xivapiId=toPositiveInteger(rawItemId),itemId=xivapiId ? ids.get(xivapiId) : null;if(!itemId || !Array.isArray(list)) continue;
      for (const rawMonsterId of list) {
        const monsterId=toPositiveInteger(rawMonsterId);if(!monsterId)continue;const name=String(mobs?.[String(monsterId)]?.en||"").trim()||"Unknown monster",positions=Array.isArray(monsters?.[String(monsterId)]?.positions)?monsters[String(monsterId)].positions:[],zones=new Map();
        for(const position of positions){const zoneId=toPositiveInteger(position?.zoneid),location=place(zoneId);if(zoneId&&location)zones.set(zoneId,{zoneId,location,level:toPositiveInteger(position?.level)||null});}if(!zones.size)zones.set(0,{zoneId:null,location:null,level:null});
        for(const zone of zones.values()){const externalKey=`teamcraft_monster_${xivapiId}_${monsterId}_${zone.zoneId||0}`;source.set(externalKey,{itemId,externalKey,type:"other",name:`Monster drop: ${name}`,location:zone.location,details:{monsterId,zoneId:zone.zoneId,level:zone.level}});}
      }
    }
    const all=[...source.values()];await client.query("begin");try{for(const chunk of chunkValues(all,500))await client.query(`insert into portal_crafting_item_sources(item_id,external_key,source_type,source_name,location_name,details,source_kind,last_synced_at,updated_at) select item_id,external_key,source_type,source_name,location_name,details::jsonb,'teamcraft',now(),now() from unnest($1::bigint[],$2::text[],$3::text[],$4::text[],$5::text[],$6::text[]) as data(item_id,external_key,source_type,source_name,location_name,details) on conflict(external_key) do update set item_id=excluded.item_id,source_type=excluded.source_type,source_name=excluded.source_name,location_name=excluded.location_name,details=excluded.details,source_kind='teamcraft',last_synced_at=now(),updated_at=now()`,[chunk.map(s=>s.itemId),chunk.map(s=>s.externalKey),chunk.map(s=>s.type),chunk.map(s=>s.name),chunk.map(s=>s.location),chunk.map(s=>JSON.stringify(s.details))]);await client.query(`update portal_crafting_source_sync_state set last_successful_sync_at=now(),last_error=null,updated_at=now() where source_key=$1`,[key]);await client.query("commit");}catch(error){await client.query("rollback");throw error;}
    const vendors=all.filter(s=>s.type==="vendor").length;return `Vendor and monster-drop source sync complete. Vendors: ${vendors}. Monster drops: ${all.length-vendors}.`;
  }catch(error){const message=error instanceof Error?error.message:String(error);await client.query(`update portal_crafting_source_sync_state set last_error=$1,updated_at=now() where source_key=$2`,[message,key]);throw error;}
}
// =========================
// SECTION: Manual FC Roster Requests
// =========================

async function processPendingFcRosterRequests(client) {
  const pending = await client.query(`
    select id, requested_by
    from portal_worker_requests
    where request_type = 'fc_roster_scan'
      and status = 'pending'
    order by requested_at asc
    limit 1;
  `);
  const request = pending.rows[0];
  if (!request) return;

  const claimed = await client.query(
    `update portal_worker_requests
     set status = 'running', started_at = now()
     where id = $1 and status = 'pending'
     returning id;`,
    [request.id]
  );
  if (!claimed.rowCount) return;

  const runId = await startSyncRun(client, 'fc-roster-manual-scan');
  try {
    const message = await syncFcRoster(client, 'manual');
    await finishSyncRun(client, runId, 'success', message);
    console.log(`[cotf-worker] ${nowLabel()} ${message}`);
    await client.query(
      `update portal_worker_requests
       set status = 'completed', completed_at = now(), message = $2
       where id = $1;`,
      [request.id, message]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : 'Manual FC roster scan failed.';
    await finishSyncRun(client, runId, 'failed', message);
    console.error(`[cotf-worker] ${nowLabel()} fc-roster-manual-scan failed: ${message}`);
    await client.query(
      `update portal_worker_requests
       set status = 'failed', completed_at = now(), message = $2
       where id = $1;`,
      [request.id, message]
    );
  }
}

async function processPendingFcVerificationRequests(client) {
  const pending = await client.query(`
    select id, requested_by
    from portal_worker_requests
    where request_type = 'fc_verification_check'
      and status = 'pending'
    order by requested_at asc
    limit 1;
  `);
  const request = pending.rows[0];
  if (!request) return null;

  const claimed = await client.query(
    `update portal_worker_requests
     set status = 'running', started_at = now()
     where id = $1 and status = 'pending'
     returning id;`,
    [request.id]
  );
  if (!claimed.rowCount) return null;

  try {
    const verification = await checkFcVerification(client, await resolveFcVerificationOptions(client), { force: true });
    const message = verification.status === "verified"
      ? "Free Company ownership verification succeeded."
      : `Verification code is not publicly visible yet.${verification.lastError ? ` ${verification.lastError}` : ""}`.slice(0, 1000);
    await client.query(
      `update portal_worker_requests
       set status = 'completed', completed_at = now(), message = $2
       where id = $1;`,
      [request.id, message]
    );
    console.log(`[cotf-worker] ${nowLabel()} Manual FC verification check completed: ${message}`);
    return verification;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Manual FC verification check failed.";
    await client.query(
      `update portal_worker_requests
       set status = 'failed', completed_at = now(), message = $2
       where id = $1;`,
      [request.id, message]
    );
    console.error(`[cotf-worker] ${nowLabel()} Manual FC verification check failed: ${message}`);
    throw error;
  }
}

async function syncMarketboardMountPrices(client) {
  const items = await client.query(`select distinct marketboard_item_id from portal_mounts where marketboard_eligible = true and marketboard_item_id is not null;`);
  if (!items.rows.length) return "Marketboard mount pricing skipped. No mapped tradeable mounts.";

  const [worlds, dataCenters] = await Promise.all([
    fetchJson("https://universalis.app/api/v2/worlds"),
    fetchJson("https://universalis.app/api/v2/data-centers")
  ]);
  const worldNames = new Map((worlds || []).map((world) => [Number(world.id), world.name]));
  const worldDataCenters = new Map();
  for (const dataCenter of dataCenters || []) {
    for (const worldId of dataCenter.worlds || []) worldDataCenters.set(Number(worldId), dataCenter.name);
  }

  let updated = 0;
  for (let i = 0; i < items.rows.length; i += 100) {
    const ids = items.rows.slice(i, i + 100).map((row) => row.marketboard_item_id).join(",");
    const [northAmerica, faerie] = await Promise.all([
      fetchJson(`https://universalis.app/api/v2/North-America/${ids}?listings=100&entries=0`),
      fetchJson(`https://universalis.app/api/v2/${encodeURIComponent(DEFAULT_WORLD)}/${ids}?listings=1&entries=0`)
    ]);

    for (const itemId of ids.split(",").map(Number)) {
      const regionItem = northAmerica.items?.[String(itemId)] || northAmerica.items?.[itemId] || null;
      const faerieItem = faerie.items?.[String(itemId)] || faerie.items?.[itemId] || null;
      const cheapestByWorld = new Map();
      for (const listing of regionItem?.listings || []) {
        const worldId = Number(listing.worldID);
        const price = Number(listing.pricePerUnit);
        if (!Number.isFinite(worldId) || !Number.isFinite(price) || price <= 0) continue;
        const current = cheapestByWorld.get(worldId);
        if (!current || price < current.price) cheapestByWorld.set(worldId, { worldId, worldName: listing.worldName || worldNames.get(worldId) || `World ${worldId}`, price });
      }
      const selected = [...cheapestByWorld.values()].filter((listing) => String(listing.worldName).toLowerCase() !== DEFAULT_WORLD.toLowerCase()).sort((a, b) => a.price - b.price).slice(0, 3);
      const faerieListing = (faerieItem?.listings || []).find((listing) => Number(listing.pricePerUnit) > 0);
      if (faerieListing) {
        const faeriePrice = Number(faerieListing.pricePerUnit);
        if (!selected.some((listing) => listing.worldId === Number(faerieListing.worldID))) selected.push({ worldId: Number(faerieListing.worldID), worldName: faerieListing.worldName || DEFAULT_WORLD, price: faeriePrice });
      }
      await client.query(`delete from portal_marketboard_item_prices where item_id = $1;`, [itemId]);
      if (!selected.length) continue;
      for (const listing of selected) {
        await client.query(
          `insert into portal_marketboard_item_prices (item_id, world_name, data_center_name, min_price, updated_at)
           values ($1,$2,$3,$4,now())
           on conflict (item_id,world_name) do update set data_center_name=excluded.data_center_name, min_price=excluded.min_price, updated_at=now();`,
          [itemId, listing.worldName, worldDataCenters.get(listing.worldId) || "North-America", listing.price]
        );
      }
      updated += 1;
    }
    await sleep(750);
  }
  return `Marketboard mount pricing updated for ${updated} tradeable mount items (top three worlds plus ${DEFAULT_DATACENTER}/${DEFAULT_WORLD} comparison).`;
}

async function syncMarketboardMinionPrices(client) {
  const items = await client.query(`select distinct marketboard_item_id from portal_minions where marketboard_eligible = true and marketboard_item_id is not null;`);
  if (!items.rows.length) return "Marketboard minion pricing skipped. No mapped tradeable minions.";

  const [worlds, dataCenters] = await Promise.all([
    fetchJson("https://universalis.app/api/v2/worlds"),
    fetchJson("https://universalis.app/api/v2/data-centers")
  ]);
  const worldNames = new Map((worlds || []).map((world) => [Number(world.id), world.name]));
  const worldDataCenters = new Map();
  for (const dataCenter of dataCenters || []) {
    for (const worldId of dataCenter.worlds || []) worldDataCenters.set(Number(worldId), dataCenter.name);
  }

  let updated = 0;
  for (let i = 0; i < items.rows.length; i += 100) {
    const ids = items.rows.slice(i, i + 100).map((row) => row.marketboard_item_id).join(",");
    const [northAmerica, faerie] = await Promise.all([
      fetchJson(`https://universalis.app/api/v2/North-America/${ids}?listings=100&entries=0`),
      fetchJson(`https://universalis.app/api/v2/${encodeURIComponent(DEFAULT_WORLD)}/${ids}?listings=1&entries=0`)
    ]);

    for (const itemId of ids.split(",").map(Number)) {
      const regionItem = northAmerica.items?.[String(itemId)] || northAmerica.items?.[itemId] || null;
      const faerieItem = faerie.items?.[String(itemId)] || faerie.items?.[itemId] || null;
      const cheapestByWorld = new Map();
      for (const listing of regionItem?.listings || []) {
        const worldId = Number(listing.worldID);
        const price = Number(listing.pricePerUnit);
        if (!Number.isFinite(worldId) || !Number.isFinite(price) || price <= 0) continue;
        const current = cheapestByWorld.get(worldId);
        if (!current || price < current.price) cheapestByWorld.set(worldId, { worldId, worldName: listing.worldName || worldNames.get(worldId) || `World ${worldId}`, price });
      }
      const selected = [...cheapestByWorld.values()].filter((listing) => String(listing.worldName).toLowerCase() !== DEFAULT_WORLD.toLowerCase()).sort((a, b) => a.price - b.price).slice(0, 3);
      const faerieListing = (faerieItem?.listings || []).find((listing) => Number(listing.pricePerUnit) > 0);
      if (faerieListing) {
        const faeriePrice = Number(faerieListing.pricePerUnit);
        if (!selected.some((listing) => listing.worldId === Number(faerieListing.worldID))) selected.push({ worldId: Number(faerieListing.worldID), worldName: faerieListing.worldName || DEFAULT_WORLD, price: faeriePrice });
      }
      await client.query(`delete from portal_marketboard_minion_prices where item_id = $1;`, [itemId]);
      if (!selected.length) continue;
      for (const listing of selected) {
        await client.query(
          `insert into portal_marketboard_minion_prices (item_id, world_name, data_center_name, min_price, updated_at)
           values ($1,$2,$3,$4,now())
           on conflict (item_id,world_name) do update set data_center_name=excluded.data_center_name, min_price=excluded.min_price, updated_at=now();`,
          [itemId, listing.worldName, worldDataCenters.get(listing.worldId) || "North-America", listing.price]
        );
      }
      updated += 1;
    }
    await sleep(750);
  }
  return `Marketboard minion pricing updated for ${updated} tradeable minion items (top three worlds plus ${DEFAULT_DATACENTER}/${DEFAULT_WORLD} comparison).`;
}
// =========================
// SECTION: Main Sync Cycle
// =========================

async function runMarketboardPriceSyncNow() {
  const client = await getClient();
  try { await ensureWorkerTables(client); await runLoggedSync(client, "marketboard-mount-price-sync", async () => syncMarketboardMountPrices(client)); await runLoggedSync(client, "marketboard-minion-price-sync", async () => syncMarketboardMinionPrices(client)); }
  finally { await client.end(); }
}

async function runSync() {
  const client = await getClient();

  try {
    /* Portal and worker can both initialize catalog tables after a rebuild.
       This short advisory lock prevents their schema changes from racing. */
    await client.query("select pg_advisory_lock(91742026);");
    try {
      await ensureWorkerTables(client);
      await ensureCraftingCatalogTables(client);
      await ensureCompanyWorkshopTables(client);
      await ensureAchievementCollectionTables(client);
    } finally {
      await client.query("select pg_advisory_unlock(91742026);");
    }

    const fcVerification = await checkFcVerification(client, await resolveFcVerificationOptions(client));
    if (fcVerification.status === "verified") await processPendingFcRosterRequests(client);
    else console.warn(`[cotf-worker] FC verification pending. Add ${fcVerification.verificationCode} to the public Free Company profile or a public FC forum thread title; member and character scans are paused.`);
    await runLoggedSync(client,"privacy-retention-cleanup",async()=>cleanupPrivacyRetention(client));

    await runLoggedSync(client, "mount-catalog-sync", async () => {
      return syncMountCatalog(client);
    });
    await runLoggedSync(client, "minion-catalog-sync", async () => syncMinionCatalog(client));
    await runLoggedSync(client, "achievement-title-catalog-sync", async () => syncAchievementAndTitleCatalogIfDue(client));

    runMarketboardPriceSyncNow().catch((error) => console.error("[cotf-worker] Startup marketboard price sync failed:", error));

    await sleep(750);

    await runLoggedSync(client, "duty-catalog-sync", async () => {
      return syncDutyCatalog(client);
    });

    await sleep(750);

    await runLoggedSync(client, "crafting-catalog-sync", async () => {
      return syncCraftingCatalogIfDue(client);
    });

    await sleep(750);

    await runLoggedSync(client, "company-workshop-template-sync", async () => {
      return syncCompanyWorkshopPlansIfDue(client);
    });

    await sleep(750);

    await runLoggedSync(client, "crafting-gathering-sources-sync", async () => {
      return syncGatheringSourcesIfDue(client);
    });

    await sleep(750);
    await runLoggedSync(client, "crafting-teamcraft-sources-sync", async () => {
      return syncTeamcraftSourcesIfDue(client);
    });

    await sleep(750);
    if (fcVerification.status === "verified") {
      await runLoggedSync(client, "fc-roster-sync", async () => syncFcRoster(client));
      await sleep(750);
      await runLoggedSync(client, "portrait-sync", async () => syncCharacterPortraits(client));
      await sleep(750);
      await runLoggedSync(client, "mount-ownership-sync", async () => syncCharacterMountOwnership(client));
      await sleep(750);
      await runLoggedSync(client, "minion-ownership-sync", async () => syncCharacterMinionOwnership(client));
      await sleep(750);
      await runLoggedSync(client, "achievement-ownership-sync", async () => syncCharacterAchievementsIfDue(client));
      await sleep(750);
      await runLoggedSync(client, "discord-mount-announcements", async () => sendPendingMountDiscordAnnouncements(client));
    }
  } finally {
    await client.end();
  }
}

// =========================
// SECTION: Manual Request Polling
// =========================

async function pollPendingFcRosterRequests() {
  const client = await getClient();

  try {
    await client.query("select pg_advisory_lock(91742026);");
    try {
      await ensureWorkerTables(client);
    } finally {
      await client.query("select pg_advisory_unlock(91742026);");
    }

    const requestedVerification = await processPendingFcVerificationRequests(client);
    const verification = requestedVerification || await checkFcVerification(client, await resolveFcVerificationOptions(client));
    if (verification.status === "verified") await processPendingFcRosterRequests(client);
  } finally {
    await client.end();
  }
}
// =========================
// SECTION: Startup
// =========================

async function main() {
  console.log(`[fc-portal-worker] Starting ${PORTAL_NAME} sync worker.`);
  console.log(`[cotf-worker] Interval: ${SYNC_INTERVAL_MINUTES} minutes.`);
  console.log(`[cotf-worker] FC Lodestone URL: ${FC_LODESTONE_URL}`);
  console.log(`[cotf-worker] Default world: ${DEFAULT_WORLD}`);
  console.log(`[cotf-worker] Default datacenter: ${DEFAULT_DATACENTER}`);
  console.log(`[cotf-worker] FFXIV Collect mounts URL: ${FFXIV_COLLECT_MOUNTS_URL}`);
  console.log(
    `[cotf-worker] XIVAPI duty sheet: ${XIVAPI_BASE_URL}/api/sheet/ContentFinderCondition`
  );
  console.log(`[cotf-worker] Duty sync row limit: ${DUTY_SYNC_LIMIT}`);
  console.log(`[cotf-worker] Duty sync page size: ${DUTY_SYNC_PAGE_SIZE}`);
  console.log(`[cotf-worker] Crafting catalog sync interval: ${CRAFTING_CATALOG_SYNC_INTERVAL_HOURS} hour(s).`);
  console.log(`[cotf-worker] Crafting catalog importer revision: ${CRAFTING_CATALOG_SCHEMA_VERSION}.`);
  console.log(`[cotf-worker] Crafting catalog recipe limit: ${CRAFTING_CATALOG_MAX_RECIPES > 0 ? CRAFTING_CATALOG_MAX_RECIPES : "full catalog"}.`);
  console.log(`[cotf-worker] Crafting catalog page size: ${CRAFTING_CATALOG_PAGE_SIZE}.`);
  console.log(`[cotf-worker] Max mount-sync characters: ${MAX_MOUNT_SYNC_CHARACTERS}`);
  console.log(`[cotf-worker] Max portrait-sync characters: ${MAX_PORTRAIT_SYNC_CHARACTERS}`);
  console.log(`[cotf-worker] Portrait-sync request delay: ${PORTRAIT_SYNC_REQUEST_DELAY_MS}ms`);
  console.log(`[cotf-worker] Mount-sync request delay: ${MOUNT_SYNC_REQUEST_DELAY_MS}ms`);
  console.log("[cotf-worker] Mount-win delivery: handled by the Discord bot.");

  const pollVerificationAndRequests = () => {
    pollPendingFcRosterRequests().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[cotf-worker] Manual FC roster request poll failed: ${message}`);
    });
  };
  await pollPendingFcRosterRequests();
  setInterval(pollVerificationAndRequests, MANUAL_FC_ROSTER_REQUEST_POLL_MS);

  await runSync();

  const runHourlyMarketboardPrices = async () => {
    const client = await getClient();
    try { await ensureWorkerTables(client); await runLoggedSync(client, "marketboard-mount-price-sync", async () => syncMarketboardMountPrices(client)); await runLoggedSync(client, "marketboard-minion-price-sync", async () => syncMarketboardMinionPrices(client)); }
    finally { await client.end(); }
  };
  const hourlyDelay = 60 * 60 * 1000 - (Date.now() % (60 * 60 * 1000));
  setTimeout(() => { runHourlyMarketboardPrices().catch((error) => console.error("[cotf-worker] Marketboard price sync failed:", error)); setInterval(() => runHourlyMarketboardPrices().catch((error) => console.error("[cotf-worker] Marketboard price sync failed:", error)), 60 * 60 * 1000); }, hourlyDelay);
  setInterval(() => {
    runSync().catch((error) => {
      console.error("[cotf-worker] Unhandled sync error:", error);
    });
  }, syncIntervalMs);
}

main().catch((error) => {
  console.error("[cotf-worker] Fatal startup error:", error);
  process.exit(1);
});

