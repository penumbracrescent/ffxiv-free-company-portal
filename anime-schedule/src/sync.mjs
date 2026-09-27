import { pool } from "./db.mjs";
import { createSources } from "./sources/index.mjs";
import { reconcileObservations } from "./reconcile.mjs";
import { localDateKey } from "./time.mjs";

const LOCK_ID = 78190415;

async function recordRun({ kind, sourceKey = null, status, dryRun, summary = {}, error = null, startedAt }) {
  await pool.query(`insert into anime.sync_runs
    (run_kind, source_key, status, dry_run, started_at, completed_at, summary, error_text)
    values ($1,$2,$3,$4,$5,now(),$6::jsonb,$7);`,
  [kind, sourceKey, status, dryRun, startedAt, JSON.stringify(summary), error ? String(error.message || error) : null]);
}

async function updateSourceSuccess(sourceKey, count) {
  await pool.query(`insert into anime.source_state
    (source_key,last_attempt_at,last_success_at,last_result_count,consecutive_failures,retry_count,next_retry_at,last_error,updated_at)
    values ($1,now(),now(),$2,0,0,null,null,now())
    on conflict (source_key) do update set last_attempt_at=now(),last_success_at=now(),last_result_count=$2,
      consecutive_failures=0,retry_count=0,next_retry_at=null,last_error=null,updated_at=now();`, [sourceKey, count]);
}

async function updateSourceFailure(sourceKey, error, config) {
  await pool.query(`insert into anime.source_state
    (source_key,last_attempt_at,consecutive_failures,retry_count,next_retry_at,last_error,updated_at)
    values ($1,now(),1,1,now()+($2::text || ' hours')::interval,$3,now())
    on conflict (source_key) do update set last_attempt_at=now(),
      consecutive_failures=anime.source_state.consecutive_failures+1,
      retry_count=least(anime.source_state.retry_count+1,$4),
      next_retry_at=case when anime.source_state.retry_count+1 < $4 then now()+($2::text || ' hours')::interval else null end,
      last_error=$3,updated_at=now();`,
  [sourceKey, String(config.retryIntervalHours), String(error.message || error).slice(0, 4000), config.retryCount]);
}

export async function cleanup(config) {
  const releases = await pool.query(`delete from anime.releases where starts_at < now()-($1::text || ' days')::interval;`, [String(config.retentionDays)]);
  const cache = await pool.query(`delete from anime.source_observations where expires_at < now();`);
  await pool.query(`delete from anime.sync_runs where completed_at < now()-interval '30 days';`);
  return { releases: releases.rowCount, observations: cache.rowCount };
}

async function sourceFetchContext(source, config) {
  if (source.key !== "animeschedule") return {};
  const result = await pool.query(`select source_route from anime.series
    where source_route is not null and description is not null
      and description_updated_at > now()-($1::text || ' days')::interval;`,
  [String(config.descriptionRefreshDays)]);
  return { freshDescriptionRoutes: new Set(result.rows.map((row) => row.source_route).filter(Boolean)) };
}
export async function runSync(config, { sourceKey = null, dryRun = false, kind = "manual" } = {}) {
  const lock = await pool.connect();
  const locked = (await lock.query(`select pg_try_advisory_lock($1) as locked;`, [LOCK_ID])).rows[0]?.locked;
  if (!locked) { lock.release(); return { skipped: true, reason: "another sync is already running", sources: [] }; }
  const overall = { skipped: false, dryRun, sources: [], cleanup: null };
  try {
    const sources = createSources(config).filter((source) => !sourceKey || source.key === sourceKey);
    if (sourceKey && sources.length === 0) throw new Error(`Unknown or disabled source: ${sourceKey}`);
    for (const source of sources) {
      const startedAt = new Date();
      if (!source.enabled) {
        const result = { sourceKey: source.key, status: "disabled", reason: source.disabledReason };
        overall.sources.push(result);
        await recordRun({ kind, sourceKey: source.key, status: "disabled", dryRun, summary: result, startedAt });
        continue;
      }
      try {
        const state = await pool.query(`select last_result_count from anime.source_state where source_key=$1;`, [source.key]);
        const fetched = await source.fetchObservations(await sourceFetchContext(source, config));
        const summary = await reconcileObservations({ sourceKey: source.key, observations: fetched.observations,
          previousCount: Number(state.rows[0]?.last_result_count || 0), dryRun, cacheRetentionDays: config.cacheRetentionDays });
        const result = { sourceKey: source.key, status: "success", ...summary, metadata: fetched.metadata };
        overall.sources.push(result);
        if (!dryRun) await updateSourceSuccess(source.key, fetched.observations.length);
        await recordRun({ kind, sourceKey: source.key, status: "success", dryRun, summary: result, startedAt });
      } catch (error) {
        const result = { sourceKey: source.key, status: "failed", error: String(error.message || error) };
        overall.sources.push(result);
        if (!dryRun) await updateSourceFailure(source.key, error, config);
        await recordRun({ kind, sourceKey: source.key, status: "failed", dryRun, summary: result, error, startedAt });
      }
    }
    if (!dryRun) overall.cleanup = await cleanup(config);
    return overall;
  } finally {
    await lock.query(`select pg_advisory_unlock($1);`, [LOCK_ID]).catch(() => undefined);
    lock.release();
  }
}

export async function sourcesDue(config, now = new Date()) {
  const rows = (await pool.query(`select * from anime.source_state;`)).rows;
  const states = new Map(rows.map((row) => [row.source_key, row]));
  const today = localDateKey(now, config.timezone);
  const localNow = new Intl.DateTimeFormat("en-CA", { timeZone: config.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  return createSources(config).filter((source) => {
    if (!source.enabled) return false;
    const state = states.get(source.key);
    if (!state) return config.syncOnStartup || localNow >= config.dailySyncTime;
    if (state.last_success_at && localDateKey(state.last_success_at, config.timezone) === today) return false;
    if (state.next_retry_at) return new Date(state.next_retry_at) <= now && Number(state.retry_count) <= config.retryCount;
    if (Number(state.consecutive_failures) > 0 && state.last_attempt_at && localDateKey(state.last_attempt_at, config.timezone) === today) return false;
    return localNow >= config.dailySyncTime;
  }).map((source) => source.key);
}