export const SOURCE_PRIORITY = Object.freeze({
  predicted: 100,
  secondary: 200,
  publisher: 300,
  official: 400,
  observed: 500
});

export function shouldReplaceRelease(existing, incoming) {
  if (!existing) return true;
  const existingPriority = Number(existing.source_priority || 0);
  const incomingPriority = Number(incoming.sourcePriority || 0);
  if (incomingPriority > existingPriority) return true;
  if (incomingPriority < existingPriority) return false;
  return new Date(incoming.observedAt).getTime() >= new Date(existing.source_observed_at || 0).getTime();
}

export function validateSourceResult({ previousCount, observations }) {
  if (!Array.isArray(observations)) throw new Error("Source adapter did not return an observation array.");
  if (previousCount > 5 && observations.length === 0) {
    throw new Error(`Source returned zero records after previously returning ${previousCount}; preserving prior data.`);
  }
  if (previousCount >= 20 && observations.length < Math.floor(previousCount * 0.2)) {
    throw new Error(`Source returned an unexpectedly small result (${observations.length}/${previousCount}); preserving prior data.`);
  }
}

export function matchesOutputPolicy(release, { languages, platforms = [] }) {
  if (languages?.length && !languages.includes(release.language)) return false;
  if (!platforms.length) return true;
  const available = (release.platforms || []).map((platform) => platform.platform_key);
  return platforms.some((platform) => available.includes(platform));
}
