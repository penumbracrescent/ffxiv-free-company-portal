import type { Client } from "pg";

export async function ensurePollTables(client: Client) {
  await client.query(`
    create table if not exists portal_polls (
      id bigserial primary key,
      status text not null default 'draft' check(status in ('draft','scheduled','open','awaiting_tie','closed','cancelled')),
      poll_type text not null check(poll_type in ('single','multiple','yes_no','ranked','rating','image')),
      question text not null,
      description text not null default '',
      privacy_mode text not null default 'private' check(privacy_mode in ('public','private','anonymous')),
      results_visibility text not null default 'hidden_until_close' check(results_visibility in ('hidden_until_close','live','officer_only_until_close')),
      max_selections integer not null default 1 check(max_selections between 1 and 25),
      winner_count integer not null default 1 check(winner_count between 1 and 25),
      min_selections integer check(min_selections is null or min_selections between 1 and 25),
      rank_depth integer not null default 3 check(rank_depth between 1 and 3),
      abstain_enabled boolean not null default false,
      quorum_minimum integer check(quorum_minimum is null or quorum_minimum between 1 and 100000),
      officer_voting_enabled boolean not null default true,
      is_test boolean not null default false,
      opens_at timestamptz,
      closes_at timestamptz not null,
      target_channel_id text not null,
      target_channel_name text not null default '',
      reminder_minutes integer[] not null default '{}',
      post_results boolean not null default true,
      material_locked_at timestamptz,
      winner_choice_id bigint,
      resolution_note text,
      extension_count integer not null default 0,
      created_by_discord_user_id text,
      created_by text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table if not exists portal_poll_choices (
      id bigserial primary key,
      poll_id bigint not null references portal_polls(id) on delete cascade,
      label text not null,
      description text not null default '',
      sort_order integer not null default 100,
      image_filename text,
      image_mime_type text,
      image_data bytea,
      created_at timestamptz not null default now(),
      unique(poll_id,sort_order)
    );
    do $$ begin
      if not exists(select 1 from pg_constraint where conname='portal_polls_winner_choice_fk') then
        alter table portal_polls add constraint portal_polls_winner_choice_fk foreign key(winner_choice_id) references portal_poll_choices(id) on delete set null;
      end if;
    end $$;
    create table if not exists portal_poll_ballots (
      id bigserial primary key,
      poll_id bigint not null references portal_polls(id) on delete cascade,
      voter_key text not null,
      voter_discord_user_id text,
      voter_discord_ciphertext text,
      voter_character_id bigint references portal_characters(id) on delete set null,
      voter_label text,
      source text not null default 'website' check(source in ('website','discord','officer')),
      voter_is_officer boolean not null default false,
      counted boolean not null default true,
      invalidated_at timestamptz,
      invalidation_reason text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(poll_id,voter_key)
    );
    create table if not exists portal_poll_ballot_choices (
      ballot_id bigint not null references portal_poll_ballots(id) on delete cascade,
      choice_id bigint not null references portal_poll_choices(id) on delete cascade,
      rank_choice integer,
      rating_value integer,
      primary key(ballot_id,choice_id),
      check(rank_choice is null or rank_choice between 1 and 3),
      check(rating_value is null or rating_value between 1 and 5)
    );
    create unique index if not exists portal_poll_ballot_rank_idx on portal_poll_ballot_choices(ballot_id,rank_choice) where rank_choice is not null;
    alter table portal_polls add column if not exists resolution_note text;
    alter table portal_polls add column if not exists min_selections integer;
    alter table portal_polls add column if not exists winner_count integer;
    update portal_polls set winner_count=case when poll_type='multiple' and status in ('draft','scheduled','open','awaiting_tie') then max_selections else 1 end where winner_count is null;
    alter table portal_polls alter column winner_count set default 1;
    alter table portal_polls alter column winner_count set not null;
    alter table portal_polls drop constraint if exists portal_polls_max_selections_check;
    alter table portal_polls add constraint portal_polls_max_selections_check check(max_selections between 1 and 25);
    alter table portal_polls drop constraint if exists portal_polls_winner_count_check;
    alter table portal_polls add constraint portal_polls_winner_count_check check(winner_count between 1 and 25);
    alter table portal_polls drop constraint if exists portal_polls_min_selections_check;
    alter table portal_polls add constraint portal_polls_min_selections_check check(min_selections is null or (min_selections between 1 and 25 and min_selections<=max_selections));
    alter table portal_poll_ballots add column if not exists voter_is_officer boolean not null default false;
    create table if not exists portal_poll_winners (
      poll_id bigint not null references portal_polls(id) on delete cascade,
      choice_id bigint not null references portal_poll_choices(id) on delete cascade,
      placement integer not null check(placement between 1 and 25),
      selected_by_tie_resolution boolean not null default false,
      created_at timestamptz not null default now(),
      primary key(poll_id,choice_id),
      unique(poll_id,placement)
    );
    alter table portal_poll_winners drop constraint if exists portal_poll_winners_placement_check;
    alter table portal_poll_winners add constraint portal_poll_winners_placement_check check(placement between 1 and 25);
    insert into portal_poll_winners(poll_id,choice_id,placement)
    select id,winner_choice_id,1 from portal_polls
    where winner_choice_id is not null
    on conflict do nothing;
    create table if not exists portal_poll_audit (
      id bigserial primary key,
      poll_id bigint references portal_polls(id) on delete cascade,
      action_type text not null,
      actor_discord_user_id text,
      actor_character_id bigint references portal_characters(id) on delete set null,
      actor_label text,
      details jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create table if not exists portal_poll_discord_artifacts (
      id bigserial primary key,
      poll_id bigint not null references portal_polls(id) on delete cascade,
      artifact_kind text not null,
      channel_id text not null,
      message_id text not null,
      active boolean not null default true,
      last_synced_at timestamptz,
      delete_after timestamptz,
      last_error text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(poll_id,artifact_kind)
    );
    create table if not exists portal_poll_discord_jobs (
      id bigserial primary key,
      poll_id bigint references portal_polls(id) on delete cascade,
      job_kind text not null check(job_kind in ('sync_opening','sync_results','reminder','delete_artifacts','tie_alert')),
      dedupe_key text not null unique,
      payload jsonb not null default '{}'::jsonb,
      status text not null default 'pending' check(status in ('pending','processing','completed','failed','cancelled')),
      attempts integer not null default 0,
      run_after timestamptz not null default now(),
      last_error text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      completed_at timestamptz
    );
    alter table portal_poll_discord_jobs drop constraint if exists portal_poll_discord_jobs_job_kind_check;
    alter table portal_poll_discord_jobs add constraint portal_poll_discord_jobs_job_kind_check check(job_kind in ('sync_opening','sync_results','reminder','delete_artifacts','tie_alert'));
    create index if not exists portal_polls_status_time_idx on portal_polls(is_test,status,opens_at,closes_at,id);
    create index if not exists portal_poll_ballots_poll_idx on portal_poll_ballots(poll_id,counted,id);
    create index if not exists portal_poll_jobs_due_idx on portal_poll_discord_jobs(status,run_after,id);
  `);
  await client.query(`update portal_poll_ballots b set voter_label=c.character_name,updated_at=now() from portal_characters c where b.voter_character_id=c.id and lower(coalesce(b.voter_label,'')) in ('true','false')`);
}
