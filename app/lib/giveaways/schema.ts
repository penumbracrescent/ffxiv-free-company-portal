import type { Client } from "pg";

export async function ensureGiveawayTables(client: Client) {
  await client.query(`
    create table if not exists portal_giveaways (
      id bigserial primary key,
      kind text not null check (kind in ('random','fcfs','contest','challenge','objective')),
      status text not null default 'draft' check (status in ('draft','scheduled','open','submissions_open','submissions_closed','voting_open','voting_closed','awaiting_claim','completed','cancelled','no_eligible_entries')),
      title text not null,
      description text not null default '',
      rules text not null default '',
      theme text,
      winner_mode text not null default 'random' check (winner_mode in ('random','fcfs','member_vote','officer_vote','random_submission','objective')),
      visibility_mode text not null default 'public' check (visibility_mode in ('public','anonymous')),
      ballot_privacy_mode text not null default 'private' check (ballot_privacy_mode in ('public','private','anonymous')),
      is_test boolean not null default false,
      delete_pending boolean not null default false,
      opens_at timestamptz,
      closes_at timestamptz,
      submission_opens_at timestamptz,
      submission_closes_at timestamptz,
      voting_opens_at timestamptz,
      voting_closes_at timestamptz,
      winner_count integer not null default 1 check (winner_count between 1 and 100),
      alternate_count integer not null default 0 check (alternate_count between 0 and 100),
      votes_allowed integer not null default 1 check (votes_allowed between 1 and 3),
      placement_count integer not null default 1 check (placement_count between 1 and 20),
      max_photos integer not null default 4 check (max_photos between 1 and 10),
      max_entries_per_member integer not null default 1 check (max_entries_per_member between 1 and 10),
      cooldown_policy text not null default 'none' check (cooldown_policy in ('none','last_winner','30_days','60_days','90_days')),
      claim_period_enabled boolean not null default false,
      claim_window_hours integer check (claim_window_hours is null or claim_window_hours between 1 and 8760),
      tie_policy text not null default 'random' check (tie_policy in ('random','officer','shared','manual','runoff')),
      live_totals_visible boolean not null default false,
      post_opening boolean not null default false,
      reminders_enabled boolean not null default false,
      reminder_minutes integer[] not null default '{}',
      post_voting_open boolean not null default false,
      discord_contest_gallery boolean not null default false,
      discord_voting_enabled boolean not null default false,
      post_results boolean not null default true,
      discord_auto_enroll boolean not null default false,
      discord_source_channel_id text,
      discord_cleanup_after_days integer not null default 30 check (discord_cleanup_after_days between 1 and 365),
      material_rules_locked_at timestamptz,
      created_by text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table portal_giveaways add column if not exists delete_pending boolean not null default false;
    alter table portal_giveaways add column if not exists qualification_instructions text not null default '';
    alter table portal_giveaways add column if not exists objective_metric_label text not null default '';
    alter table portal_giveaways add column if not exists objective_direction text not null default 'highest';
    alter table portal_giveaways add column if not exists evidence_required boolean not null default false;
    alter table portal_giveaways add column if not exists ballot_privacy_mode text not null default 'private';
    alter table portal_giveaways drop constraint if exists portal_giveaways_ballot_privacy_mode_check;
    alter table portal_giveaways add constraint portal_giveaways_ballot_privacy_mode_check check (ballot_privacy_mode in ('public','private','anonymous'));
    update portal_giveaways set visibility_mode='public' where kind='contest' and discord_auto_enroll=true and visibility_mode<>'public';
    alter table portal_giveaways drop constraint if exists portal_giveaways_winner_mode_check;
    alter table portal_giveaways add constraint portal_giveaways_winner_mode_check check (winner_mode in ('random','fcfs','member_vote','ranked_vote','officer_vote','random_submission','objective'));
    alter table portal_giveaways drop constraint if exists portal_giveaways_cooldown_policy_check;
    alter table portal_giveaways add constraint portal_giveaways_cooldown_policy_check check (cooldown_policy in ('none','last_winner','7_days','14_days','30_days','60_days','90_days'));
    alter table portal_giveaways drop constraint if exists portal_giveaways_objective_direction_check;
    alter table portal_giveaways add constraint portal_giveaways_objective_direction_check check (objective_direction in ('highest','lowest'));

    create table if not exists portal_giveaway_prizes (
      id bigserial primary key,
      giveaway_id bigint not null references portal_giveaways(id) on delete cascade,
      prize_name text not null,
      quantity integer not null default 1 check (quantity between 1 and 10000),
      category text not null default 'in_game',
      donor_display text,
      notes text,
      image_filename text,
      image_mime_type text,
      image_data bytea,
      status text not null default 'reserved' check (status in ('available','reserved','awarded')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table portal_giveaway_prizes add column if not exists image_filename text;
    alter table portal_giveaway_prizes add column if not exists image_mime_type text;
    alter table portal_giveaway_prizes add column if not exists image_data bytea;

    create table if not exists portal_giveaway_entries (
      id bigserial primary key,
      giveaway_id bigint not null references portal_giveaways(id) on delete cascade,
      character_id bigint not null references portal_characters(id) on delete restrict,
      discord_user_id text not null,
      character_name_snapshot text not null,
      status text not null default 'entered' check (status in ('entered','claimed','withdrawn','ineligible','disqualified')),
      entered_at timestamptz not null default now(),
      claimed_at timestamptz,
      invalidated_at timestamptz,
      invalidation_reason text,
      unique (giveaway_id, character_id)
    );

    create table if not exists portal_giveaway_submissions (
      id bigserial primary key,
      giveaway_id bigint not null references portal_giveaways(id) on delete cascade,
      character_id bigint not null references portal_characters(id) on delete restrict,
      discord_user_id text not null,
      character_name_snapshot text not null,
      entry_number integer not null default 1,
      title text not null default '',
      description text not null default '',
      status text not null default 'active' check (status in ('active','withdrawn','disqualified','finalized')),
      source_kind text not null default 'website' check (source_kind in ('website','discord','officer')),
      source_message_id text,
      gallery_post_id bigint references portal_community_gallery_posts(id) on delete set null,
      frozen_at timestamptz,
      disqualified_reason text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (giveaway_id, character_id, entry_number),
      unique (giveaway_id, source_message_id)
    );

    create table if not exists portal_giveaway_submission_images (
      id bigserial primary key,
      submission_id bigint not null references portal_giveaway_submissions(id) on delete cascade,
      source_attachment_id text not null,
      filename text not null,
      mime_type text not null,
      image_data bytea not null,
      image_size integer not null,
      sort_order integer not null default 100,
      created_at timestamptz not null default now(),
      unique (submission_id, source_attachment_id)
    );

    create table if not exists portal_giveaway_votes (
      id bigserial primary key,
      giveaway_id bigint not null references portal_giveaways(id) on delete cascade,
      submission_id bigint not null references portal_giveaway_submissions(id) on delete cascade,
      voter_character_id bigint references portal_characters(id) on delete restrict,
      voter_discord_user_id text,
      voter_key text,
      voter_discord_ciphertext text,
      voter_label text,
      source text not null default 'website' check (source in ('website','discord','officer')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (giveaway_id, voter_character_id, submission_id)
    );

    alter table portal_giveaway_votes add column if not exists rank_choice integer;
    alter table portal_giveaway_votes add column if not exists voter_key text;
    alter table portal_giveaway_votes add column if not exists voter_discord_ciphertext text;
    alter table portal_giveaway_votes add column if not exists voter_label text;
    alter table portal_giveaway_votes alter column voter_character_id drop not null;
    alter table portal_giveaway_votes alter column voter_discord_user_id drop not null;
    create unique index if not exists portal_giveaway_votes_voter_key_submission_idx on portal_giveaway_votes(giveaway_id,voter_key,submission_id) where voter_key is not null;

    create table if not exists portal_giveaway_objective_scores (
      id bigserial primary key,
      giveaway_id bigint not null references portal_giveaways(id) on delete cascade,
      submission_id bigint not null references portal_giveaway_submissions(id) on delete cascade,
      score numeric not null,
      evidence text not null default '',
      verified boolean not null default false,
      verified_by text,
      verified_at timestamptz,
      unique(giveaway_id,submission_id)
    );

    create table if not exists portal_giveaway_prize_inventory (
      id bigserial primary key,
      name text not null,
      category text not null default 'in_game',
      donor_display text,
      quantity_available integer not null default 0 check(quantity_available>=0),
      notes text not null default '',
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create unique index if not exists portal_giveaway_prize_inventory_name_idx on portal_giveaway_prize_inventory(lower(name)) where active=true;
    alter table portal_giveaway_prizes add column if not exists inventory_item_id bigint references portal_giveaway_prize_inventory(id) on delete set null;

    create table if not exists portal_giveaway_templates (
      id bigserial primary key,
      name text not null unique,
      payload jsonb not null default '{}'::jsonb,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists portal_giveaway_results (
      id bigserial primary key,
      giveaway_id bigint not null references portal_giveaways(id) on delete cascade,
      character_id bigint not null references portal_characters(id) on delete restrict,
      submission_id bigint references portal_giveaway_submissions(id) on delete set null,
      character_name_snapshot text not null,
      placement integer not null,
      result_kind text not null check (result_kind in ('winner','alternate','placement','fcfs')),
      public boolean not null default true,
      claim_status text not null default 'not_required' check (claim_status in ('not_required','awaiting','claimed','forfeited','replaced')),
      claim_deadline timestamptz,
      selected_at timestamptz not null default now(),
      selected_by text,
      selection_method text not null,
      replacement_reason text,
      unique (giveaway_id, result_kind, placement)
    );

    alter table portal_giveaway_results add column if not exists display_placement integer;

    create table if not exists portal_giveaway_audit (
      id bigserial primary key,
      giveaway_id bigint references portal_giveaways(id) on delete cascade,
      action_type text not null,
      actor_discord_user_id text,
      actor_character_id bigint references portal_characters(id) on delete set null,
      actor_label text,
      details jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create table if not exists portal_giveaway_discord_artifacts (
      id bigserial primary key,
      giveaway_id bigint not null references portal_giveaways(id) on delete cascade,
      submission_id bigint references portal_giveaway_submissions(id) on delete cascade,
      artifact_kind text not null,
      channel_id text not null,
      message_id text not null,
      active boolean not null default true,
      last_synced_at timestamptz,
      delete_after timestamptz,
      last_error text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (giveaway_id, submission_id, artifact_kind)
    );

    create table if not exists portal_giveaway_discord_jobs (
      id bigserial primary key,
      giveaway_id bigint references portal_giveaways(id) on delete cascade,
      submission_id bigint references portal_giveaway_submissions(id) on delete cascade,
      job_kind text not null,
      dedupe_key text not null unique,
      payload jsonb not null default '{}'::jsonb,
      status text not null default 'pending' check (status in ('pending','processing','completed','failed','cancelled')),
      attempts integer not null default 0,
      run_after timestamptz not null default now(),
      last_error text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      completed_at timestamptz
    );

    create index if not exists portal_giveaways_status_time_idx on portal_giveaways (is_test, status, opens_at, closes_at);
    create index if not exists portal_giveaway_entries_active_idx on portal_giveaway_entries (giveaway_id, status);
    create index if not exists portal_giveaway_submissions_active_idx on portal_giveaway_submissions (giveaway_id, status);
    create index if not exists portal_giveaway_votes_count_idx on portal_giveaway_votes (giveaway_id, submission_id);
    create index if not exists portal_giveaway_jobs_due_idx on portal_giveaway_discord_jobs (status, run_after, id);
  `);

  await client.query(`
    create or replace function portal_prevent_giveaway_self_vote() returns trigger language plpgsql as $$
    declare entrant bigint;
    begin
      select character_id into entrant from portal_giveaway_submissions where id = new.submission_id;
      if entrant = new.voter_character_id then raise exception 'Self-voting is not allowed.'; end if;
      return new;
    end $$;
    drop trigger if exists portal_giveaway_no_self_vote on portal_giveaway_votes;
    create trigger portal_giveaway_no_self_vote before insert or update on portal_giveaway_votes
      for each row execute function portal_prevent_giveaway_self_vote();
  `);
}
