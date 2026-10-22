export function includesEpisodeOne(release) {
  const kind = release.release_kind || 'episode';
  if (!['episode', 'batch'].includes(kind)) return false;
  const label = String(release.episode_label || '').trim();
  if (kind === 'batch') return /^0*1\s*[-–—]\s*\d+(?:\.0+)?$/.test(label);
  return label ? /^0*1(?:\.0+)?$/.test(label) : Number(release.episode_number) === 1;
}
export function premiereTitle(release) {
  const title = String(release.english_title || '').replace(/^⭐\s*/, '');
  return (includesEpisodeOne(release) ? '⭐ ' : '') + title;
}
