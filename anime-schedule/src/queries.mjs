import { pool } from "./db.mjs";

function releaseFilters(params, allowedLanguages) {
  const clauses = ["r.starts_at >= $1", "r.starts_at < $2"];
  const values = [params.from, params.to];
  const language = String(params.language || "all").toLowerCase();
  if (language !== "all") {
    if (!allowedLanguages.includes(language)) throw new Error("Unsupported language filter.");
    values.push(language); clauses.push(`r.language=$${values.length}`);
  } else {
    values.push(allowedLanguages); clauses.push(`r.language=any($${values.length}::text[])`);
  }
  if (params.platforms?.length) {
    values.push(params.platforms); clauses.push(`exists (select 1 from anime.release_platforms rp2 join anime.platforms p2 on p2.id=rp2.platform_id where rp2.release_id=r.id and p2.platform_key=any($${values.length}::text[]))`);
  }
  return { clauses, values };
}

export async function listReleases(params, allowedLanguages) {
  const { clauses, values } = releaseFilters(params, allowedLanguages);
  const result = await pool.query(`select r.id::text,r.release_key,r.episode_number::float8,r.episode_label,r.release_kind,
    r.language,r.status,r.starts_at,r.duration_minutes,r.delayed_until,r.delay_note,r.confirmed,r.updated_at,
    s.series_key,s.english_title,s.romaji_title,s.native_title,s.aliases,s.image_url,s.description,s.source_url,
    coalesce(jsonb_agg(distinct jsonb_build_object('key',p.platform_key,'name',p.display_name,'url',rp.source_url)) filter (where p.id is not null),'[]'::jsonb) platforms
    from anime.releases r join anime.series s on s.id=r.series_id
    left join anime.release_platforms rp on rp.release_id=r.id left join anime.platforms p on p.id=rp.platform_id
    where ${clauses.join(" and ")} group by r.id,s.id order by r.starts_at,s.english_title,r.episode_number;`, values);
  return result.rows;
}

export async function listPlatforms() {
  return (await pool.query(`select platform_key as key,display_name as name,official_url from anime.platforms order by display_name;`)).rows;
}

export async function sourceHealth() {
  return (await pool.query(`select source_key,last_attempt_at,last_success_at,last_result_count,consecutive_failures,retry_count,next_retry_at,last_error from anime.source_state order by source_key;`)).rows;
}

const CURRENT_RELEASE_SQL = `
  r.language=any($2::text[])
  and r.starts_at between now()-interval '1 day' and now()+($3::text || ' days')::interval
  and r.status <> 'unknown'
  and (ss.last_success_at is null or r.last_seen_at >= ss.last_success_at-interval '1 hour')`;

export async function outputFeed({ kind, languages, horizonDays }) {
  return (await pool.query(`select r.id::text,r.release_key,r.language,r.status,r.starts_at,r.duration_minutes,r.delayed_until,r.delay_note,r.episode_label,
    s.english_title,s.image_url,s.description,s.source_url,m.external_event_id,m.external_container_id,m.last_payload_hash,
    coalesce((select jsonb_agg(jsonb_build_object('key',p.platform_key,'name',p.display_name,'url',rp.source_url) order by p.display_name) from anime.release_platforms rp join anime.platforms p on p.id=rp.platform_id where rp.release_id=r.id),'[]'::jsonb) platforms
    from anime.releases r join anime.series s on s.id=r.series_id
    left join anime.source_state ss on ss.source_key=r.source_key
    left join anime.external_event_mappings m on m.release_id=r.id and m.output_kind=$1 and m.status='active'
    where ${CURRENT_RELEASE_SQL} order by r.starts_at;`, [kind,languages,String(horizonDays)])).rows;
}

export async function staleOutputMappings({ kind, languages, horizonDays }) {
  return (await pool.query(`select r.id::text,r.release_key,r.language,r.status,r.starts_at,r.last_seen_at,
    m.external_event_id,m.external_container_id,m.last_payload_hash,m.status as mapping_status
    from anime.external_event_mappings m
    join anime.releases r on r.id=m.release_id
    left join anime.source_state ss on ss.source_key=r.source_key
    where m.output_kind=$1 and m.status='active' and r.language=any($2::text[])
      and not (${CURRENT_RELEASE_SQL})
    order by r.starts_at;`, [kind,languages,String(horizonDays)])).rows;
}

export async function syncStatus(discordHorizonDays = 3) {
  const [sources, releases, runs, mappings] = await Promise.all([
    sourceHealth(),
    pool.query(`select
      count(*)::int as total,
      count(*) filter (where language = 'sub')::int as sub,
      count(*) filter (where language = 'dub')::int as dub,
      count(*) filter (where starts_at >= now() and starts_at < now() + ($1::text || ' days')::interval)::int as upcoming_discord_window,
      count(*) filter (where status = 'delayed')::int as delayed,
      max(updated_at) as last_catalog_update
      from anime.releases;`, [String(discordHorizonDays)]),
    pool.query(`select id::int, run_kind, source_key, status, dry_run, started_at, completed_at, summary, error_text
      from anime.sync_runs order by started_at desc limit 12;`),
    pool.query(`select m.output_kind, r.language as output_language,
      count(*) filter (where m.status='active')::int as mapped,
      max(m.last_synced_at) as last_synced_at,
      count(*) filter (where m.status not in ('active','retired') or m.last_error is not null)::int as issues
      from anime.external_event_mappings m join anime.releases r on r.id=m.release_id
      group by m.output_kind,r.language order by m.output_kind,r.language;`)
  ]);
  return {
    sources,
    releases: releases.rows[0] || { total: 0, sub: 0, dub: 0, upcoming_discord_window: 0, delayed: 0, last_catalog_update: null },
    recentRuns: runs.rows,
    outputs: mappings.rows
  };
}
export async function saveExternalMapping({ kind, releaseId, externalEventId, externalContainerId = null, payloadHash, status = "active", error = null }) {
  await pool.query(`insert into anime.external_event_mappings
    (output_kind,release_id,external_event_id,external_container_id,last_payload_hash,status,last_synced_at,last_error,updated_at)
    values ($1,$2,$3,$4,$5,$6,now(),$7,now()) on conflict (output_kind,release_id) do update set
    external_event_id=excluded.external_event_id,external_container_id=excluded.external_container_id,last_payload_hash=excluded.last_payload_hash,status=excluded.status,
    last_synced_at=now(),last_error=excluded.last_error,updated_at=now();`,
  [kind,releaseId,externalEventId,externalContainerId,payloadHash,status,error]);
}
export async function recordOutputRun({ outputKey, status, dryRun, summary = {}, error = null, startedAt = new Date() }) {
  await pool.query(`insert into anime.sync_runs
    (run_kind,source_key,status,dry_run,started_at,completed_at,summary,error_text)
    values ('output',$1,$2,$3,$4,now(),$5::jsonb,$6);`,
  [outputKey,status,dryRun,startedAt,JSON.stringify(summary),error ? String(error.message || error).slice(0,4000) : null]);
}