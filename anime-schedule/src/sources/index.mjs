import { createAnimeScheduleSource } from "./animeschedule.mjs";
import { createOfficialFeedSource } from "./official-feed.mjs";

export function createSources(config) {
  const known = new Map([["animeschedule", createAnimeScheduleSource(config)]]);
  for (const [key, url] of Object.entries(config.officialFeedUrls || {})) known.set(key.toLowerCase(), createOfficialFeedSource(key.toLowerCase(), url));
  const requested = [...new Set([...config.sourceNames, ...Object.keys(config.officialFeedUrls || {}).map((key) => key.toLowerCase())])];
  return requested.map((name) => { const source=known.get(name); if(!source) throw new Error(`Unknown anime source: ${name}`); return source; });
}