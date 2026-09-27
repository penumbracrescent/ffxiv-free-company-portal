import { allAliases, releaseKey, seriesKey } from "./identity.mjs";
import { shouldReplaceRelease, validateSourceResult } from "./policy.mjs";
import { withTransaction } from "./db.mjs";

function comparableRelease(row) {
  return {
    startsAt: row?.starts_at ? new Date(row.starts_at).toISOString() : null,
    status: row?.status || null,
    sourcePriority: Number(row?.source_priority || 0),
    episodeLabel: row?.episode_label || null
  };
}

function hasMaterialChange(existing, observation) {
  const current = comparableRelease(existing);
  return current.startsAt !== new Date(observation.startsAt).toISOString() ||
    current.status !== observation.status ||
    current.sourcePriority !== Number(observation.sourcePriority) ||
    current.episodeLabel !== observation.episodeLabel;
}

async function upsertSeries(client, observation) {
  const key = seriesKey(observation);
  const aliases = allAliases(observation);
  const result = await client.query(`
    insert into anime.series (
      series_key, english_title, romaji_title, native_title, aliases, image_url, status, source_route, description, source_url, description_updated_at, updated_at
    ) values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,case when $9::text is not null then now() else null end,now())
    on conflict (series_key) do update set
      english_title = excluded.english_title,
      romaji_title = coalesce(excluded.romaji_title, anime.series.romaji_title),
      native_title = coalesce(excluded.native_title, anime.series.native_title),
      aliases = (
        select jsonb_agg(distinct alias)
        from jsonb_array_elements(anime.series.aliases || excluded.aliases) alias
      ),
      image_url = coalesce(excluded.image_url, anime.series.image_url),
      status = excluded.status,
      source_route = coalesce(excluded.source_route, anime.series.source_route),
      description = coalesce(excluded.description, anime.series.description),
      source_url = coalesce(excluded.source_url, anime.series.source_url),
      description_updated_at = case when excluded.description is not null then now() else anime.series.description_updated_at end,
      updated_at = now()
    returning id::int;`,
    [key, observation.englishTitle || observation.displayTitle, observation.romajiTitle, observation.nativeTitle,
      JSON.stringify(aliases), observation.imageUrl, String(observation.seriesStatus || "unknown").toLowerCase(),
      observation.sourceRoute || null, observation.description || null, observation.sourceUrl || null]
  );
  return Number(result.rows[0].id);
}

async function replacePlatforms(client, releaseId, observation) {
  for (const platform of observation.platforms || []) {
    const platformResult = await client.query(`
      insert into anime.platforms (platform_key, display_name, official_url, updated_at)
      values ($1,$2,$3,now())
      on conflict (platform_key) do update set
        display_name=excluded.display_name,
        official_url=coalesce(excluded.official_url, anime.platforms.official_url),
        updated_at=now()
      returning id::int;`,
      [platform.platformKey, platform.displayName, platform.sourceUrl]
    );
    await client.query(`
      insert into anime.release_platforms (release_id, platform_id, available_at, source_url, source_key, updated_at)
      values ($1,$2,$3,$4,$5,now())
      on conflict (release_id, platform_id) do update set
        available_at=excluded.available_at,
        source_url=coalesce(excluded.source_url, anime.release_platforms.source_url),
        source_key=excluded.source_key,
        updated_at=now();`,
      [releaseId, platformResult.rows[0].id, platform.availableAt || observation.startsAt, platform.sourceUrl, observation.sourceKey]
    );
  }
}

export async function reconcileObservations({ sourceKey, observations, previousCount = 0, dryRun = false, cacheRetentionDays = 30 }) {
  validateSourceResult({ previousCount, observations });
  const summary = { received: observations.length, created: 0, updated: 0, unchanged: 0, ignoredLowerConfidence: 0 };
  return withTransaction(async (client) => {
    for (const observation of observations) {
      const key = releaseKey(observation);
      const existingResult = await client.query(`select * from anime.releases where release_key=$1 limit 1;`, [key]);
      const existing = existingResult.rows[0] || null;
      const replace = shouldReplaceRelease(existing, observation);
      if (!existing) summary.created += 1;
      else if (!replace) summary.ignoredLowerConfidence += 1;
      else if (hasMaterialChange(existing, observation)) summary.updated += 1;
      else summary.unchanged += 1;
      if (dryRun) continue;
      const seriesId = existing && !replace ? Number(existing.series_id) : await upsertSeries(client, observation);
      let releaseId = existing?.id ? Number(existing.id) : null;
      if (!existing) {
        const inserted = await client.query(`
          insert into anime.releases (
            release_key,series_id,episode_number,episode_label,release_kind,language,status,starts_at,
            duration_minutes,delayed_until,delay_note,source_key,source_priority,source_observed_at,source_timezone,source_timestamp,
            confirmed,last_seen_at,updated_at
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now(),now()) returning id::int;`,
          [key,seriesId,observation.episodeNumber,observation.episodeLabel,observation.releaseKind,observation.language,
            observation.status,observation.startsAt,observation.durationMinutes,observation.delayedUntil,observation.delayNote,observation.sourceKey,
            observation.sourcePriority,observation.observedAt,observation.sourceTimezone,observation.sourceTimestamp,
            observation.confirmed]
        );
        releaseId = Number(inserted.rows[0].id);
      } else if (replace) {
        await client.query(`
          update anime.releases set
            series_id=$2,episode_number=$3,episode_label=$4,release_kind=$5,language=$6,status=$7,
            starts_at=$8,duration_minutes=$9,delayed_until=$10,delay_note=$11,source_key=$12,source_priority=$13,source_observed_at=$14,
            source_timezone=$15,source_timestamp=$16,confirmed=$17,last_seen_at=now(),updated_at=now()
          where id=$1;`,
          [releaseId,seriesId,observation.episodeNumber,observation.episodeLabel,observation.releaseKind,
            observation.language,observation.status,observation.startsAt,observation.durationMinutes,
            observation.delayedUntil,observation.delayNote,observation.sourceKey,observation.sourcePriority,observation.observedAt,observation.sourceTimezone,
            observation.sourceTimestamp,observation.confirmed]
        );
      } else {
        await client.query(`update anime.releases set last_seen_at=now() where id=$1;`, [releaseId]);
      }
      if (replace && releaseId) await replacePlatforms(client, releaseId, observation);
      await client.query(`
        insert into anime.source_observations (
          source_key,release_key,source_record_key,observed_at,payload,expires_at
        ) values ($1,$2,$3,$4,$5::jsonb,now()+($6::text || ' days')::interval);`,
        [sourceKey,key,observation.sourceRecordKey,observation.observedAt,JSON.stringify(observation.raw || observation),String(cacheRetentionDays)]
      );
    }
    return summary;
  });
}
