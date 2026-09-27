import type { Client } from "pg";

export async function ensureDiscordBotSettingsTable(client: Client) {
  await client.query(`
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

  await client.query(`
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

  await client.query(`
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
}
