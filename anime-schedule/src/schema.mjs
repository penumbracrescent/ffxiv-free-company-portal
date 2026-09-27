import { pool } from "./db.mjs";

export async function ensureSchema() {
  await pool.query(`create schema if not exists anime;`);
  await pool.query(`
    create table if not exists anime.series (
      id bigserial primary key,
      series_key text not null unique,
      english_title text not null,
      romaji_title text,
      native_title text,
      aliases jsonb not null default '[]'::jsonb,
      image_url text,
      status text not null default 'unknown',
      first_seen_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await pool.query(`
    create table if not exists anime.releases (
      id bigserial primary key,
      release_key text not null unique,
      series_id bigint not null references anime.series(id) on delete cascade,
      episode_number numeric,
      episode_label text,
      release_kind text not null default 'episode',
      language text not null check (language in ('sub','dub')),
      status text not null default 'expected' check (status in ('confirmed','expected','delayed','unknown','released')),
      starts_at timestamptz not null,
      duration_minutes integer,
      source_key text not null,
      source_priority integer not null default 100,
      source_observed_at timestamptz not null,
      source_timezone text,
      source_timestamp text,
      confirmed boolean not null default false,
      last_seen_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(series_id, language, episode_label)
    );
  `);
  await pool.query(`alter table anime.series add column if not exists source_route text;`);
  await pool.query(`alter table anime.series add column if not exists description text;`);
  await pool.query(`alter table anime.series add column if not exists source_url text;`);
  await pool.query(`alter table anime.series add column if not exists description_updated_at timestamptz;`);
  await pool.query(`alter table anime.releases add column if not exists delayed_until timestamptz;`);
  await pool.query(`alter table anime.releases add column if not exists delay_note text;`);
  await pool.query(`
    create table if not exists anime.platforms (
      id bigserial primary key,
      platform_key text not null unique,
      display_name text not null,
      official_url text,
      icon_url text,
      updated_at timestamptz not null default now()
    );
  `);
  await pool.query(`
    create table if not exists anime.release_platforms (
      release_id bigint not null references anime.releases(id) on delete cascade,
      platform_id bigint not null references anime.platforms(id) on delete cascade,
      available_at timestamptz,
      source_url text,
      source_key text not null,
      updated_at timestamptz not null default now(),
      primary key (release_id, platform_id)
    );
  `);
  await pool.query(`
    create table if not exists anime.source_state (
      source_key text primary key,
      last_attempt_at timestamptz,
      last_success_at timestamptz,
      last_result_count integer not null default 0,
      consecutive_failures integer not null default 0,
      retry_count integer not null default 0,
      next_retry_at timestamptz,
      last_error text,
      updated_at timestamptz not null default now()
    );
  `);
  await pool.query(`
    create table if not exists anime.sync_runs (
      id bigserial primary key,
      run_kind text not null,
      source_key text,
      status text not null,
      dry_run boolean not null default false,
      started_at timestamptz not null default now(),
      completed_at timestamptz,
      summary jsonb not null default '{}'::jsonb,
      error_text text
    );
  `);
  await pool.query(`
    create table if not exists anime.source_observations (
      id bigserial primary key,
      source_key text not null,
      release_key text,
      source_record_key text,
      observed_at timestamptz not null,
      payload jsonb not null,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    );
  `);
  await pool.query(`
    create table if not exists anime.external_event_mappings (
      output_kind text not null check (output_kind in ('google','discord')),
      release_id bigint not null references anime.releases(id) on delete cascade,
      external_event_id text not null,
      last_payload_hash text,
      status text not null default 'active',
      last_synced_at timestamptz,
      last_error text,
      updated_at timestamptz not null default now(),
      primary key (output_kind, release_id),
      unique(output_kind, external_event_id)
    );
  `);
  await pool.query(`alter table anime.external_event_mappings add column if not exists external_container_id text;`);
  await pool.query(`create index if not exists anime_releases_starts_idx on anime.releases(starts_at, language, status);`);
  await pool.query(`create index if not exists anime_observations_expiry_idx on anime.source_observations(expires_at);`);
  await pool.query(`
    with latest as (
      select distinct on (release_key) release_key, payload
      from anime.source_observations
      where source_key='animeschedule' and release_key is not null
      order by release_key, observed_at desc
    )
    update anime.releases r set
      status=case
        when lower(coalesce(latest.payload->>'airingStatus','')) like '%delay%' then 'delayed'
        when lower(coalesce(latest.payload->>'airingStatus',''))='aired' then 'released'
        else 'confirmed'
      end,
      delayed_until=case
        when lower(coalesce(latest.payload->>'airingStatus','')) like '%delay%'
          and coalesce(latest.payload->>'delayedUntil','') not like '0001-01-01%'
        then (latest.payload->>'delayedUntil')::timestamptz else null end,
      delay_note=case
        when lower(coalesce(latest.payload->>'airingStatus','')) like '%delay%'
        then coalesce(
          case lower(coalesce(latest.payload->>'airType',''))
            when 'sub' then latest.payload->>'subDelayedTimetable'
            when 'dub' then latest.payload->>'dubDelayedTimetable'
            else null
          end,
          latest.payload->>'delayedTimetable'
        ) else null end,
      updated_at=now()
    from latest
    where r.release_key=latest.release_key and r.source_key='animeschedule';
  `);}
