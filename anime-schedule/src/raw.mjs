// Match source identity and episode, never a title guess or broadcast date.
export const TRANSLATED_EPISODE_SQL = `(translated.series_id=r.series_id or exists (
  select 1 from anime.series original join anime.series replacement on replacement.source_route=original.source_route
  where original.id=r.series_id and replacement.id=translated.series_id and original.source_route is not null
)) and translated.language in ('sub','dub') and translated.status <> 'unknown'
  and (translated.episode_label=r.episode_label or (
    r.release_kind='episode' and translated.release_kind='episode'
    and r.episode_number>0 and r.episode_number=translated.episode_number
    and r.episode_label ~ '^[0-9]+([.][0-9]+)?$' and translated.episode_label ~ '^[0-9]+([.][0-9]+)?$'
  ) or (
    r.episode_number is not null and translated.release_kind='batch'
    and translated.episode_label ~ '^[0-9]+-[0-9]+$'
    and r.episode_number between
      (case when translated.episode_label ~ '^[0-9]+-[0-9]+$' then split_part(translated.episode_label,'-',1)::numeric end) and
      (case when translated.episode_label ~ '^[0-9]+-[0-9]+$' then split_part(translated.episode_label,'-',2)::numeric end)
  ))`;
export const RAW_FALLBACK_SQL = `(r.language <> 'raw' or not exists (
  select 1 from anime.releases translated where ${TRANSLATED_EPISODE_SQL}
))`;
export function fallbackLanguages(languages) { return [...new Set([...languages, 'raw'])]; }
