import {
  AttachmentBuilder,
  EmbedBuilder,
} from "discord.js";
import { PORTAL_URL } from "./installation-config.mjs";
import { ANIME_RANKING_FEED_URL, parseAnimeRankingEntries } from "./anime-ranking-source.mjs";
const AUTHOR_NAME = "Abysswatcherbel";
const SUBREDDIT_NAME = "anime";
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20_000;
const MAX_POST_AGE_MS = 10 * 24 * 60 * 60 * 1000;
const MIN_IMAGE_BYTES = 5_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const TITLE_PATTERN = /^\/?r\/anime Karma Ranking & Discussion \| Week \d+ \[[^\]]+\]$/i;

let lastAttemptAt = 0;
let syncRunning = false;

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": `Mozilla/5.0 (compatible; FFXIVFreeCompanyPortal/1.0; +${PORTAL_URL})`
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readLatestRanking() {
  const response = await fetchWithTimeout(ANIME_RANKING_FEED_URL);
  if (!response.ok) throw new Error(`Reddit ranking feed returned HTTP ${response.status}.`);
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("text/html") || response.url.includes("/login/")) {
    throw new Error("Reddit redirected the ranking feed to an HTML login page.");
  }
  if (!contentType.includes("xml") && !contentType.includes("atom") && !contentType.includes("rss")) {
    throw new Error(`Reddit ranking feed returned an unexpected content type: ${contentType || "unknown"}.`);
  }
  const entries = parseAnimeRankingEntries(await response.text())
    .filter((entry) => entry.author.toLowerCase() === AUTHOR_NAME.toLowerCase())
    .filter((entry) => entry.postUrl.includes(`/r/${SUBREDDIT_NAME}/comments/`))
    .filter((entry) => TITLE_PATTERN.test(entry.title))
    .filter((entry) => Number.isFinite(entry.publishedAt.getTime()))
    .sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime());

  const ranking = entries[0];
  if (!ranking) throw new Error("No validated weekly r/anime Karma Ranking was found in the source feed.");
  if (Date.now() - ranking.publishedAt.getTime() > MAX_POST_AGE_MS) {
    throw new Error("The newest validated ranking is older than ten days; no stale post was published.");
  }
  if (!ranking.id || !ranking.imageUrl) throw new Error("The validated ranking did not provide a usable post ID and image.");
  return ranking;
}

async function downloadImageCandidate(url) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Reddit ranking image returned HTTP ${response.status}.`);
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("image/")) throw new Error("The Reddit ranking attachment was not an image.");
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_IMAGE_BYTES) throw new Error("The Reddit ranking image was larger than the safe attachment limit.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < MIN_IMAGE_BYTES || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("The Reddit ranking image size was outside the safe limits.");
  }
  const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  return { buffer, extension };
}

async function downloadImage(url, fallbackUrl = "") {
  const candidates = [...new Set([url, fallbackUrl].filter(Boolean))];
  let lastError;
  for (const candidate of candidates) {
    try {
      return await downloadImageCandidate(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("The Reddit ranking did not provide a downloadable image.");
}

function makeMessage(ranking, image) {
  const filename = `anime-karma-ranking-${ranking.id}.${image.extension}`;
  const embed = new EmbedBuilder()
    .setColor(0x8f2de2)
    .setAuthor({ name: `/u/${AUTHOR_NAME}` })
    .setTitle(ranking.title)
    .setURL(ranking.postUrl)
    .setDescription("The latest weekly r/anime Karma Ranking and discussion.")
    .setImage(`attachment://${filename}`)
    .setTimestamp(ranking.publishedAt)
    .setFooter({ text: "Weekly r/anime Karma Ranking" });

  return {
    embeds: [embed],
    files: [new AttachmentBuilder(image.buffer, { name: filename })],
    allowedMentions: { parse: [] }
  };
}

async function recordStatus(pool, fields) {
  await pool.query(
    `update portal_anime_ranking_state
     set status = $1,
         error_text = $2,
         latest_reddit_post_id = coalesce($3, latest_reddit_post_id),
         last_checked_at = now(),
         last_posted_at = case when $4 then now() else last_posted_at end,
         updated_at = now()
     where id = 1;`,
    [fields.status, fields.errorText ?? null, fields.postId ?? null, Boolean(fields.posted)]
  );
}

export async function ensureAnimeRankingTables(pool) {
  await pool.query(`
    create table if not exists portal_anime_ranking_posts (
      reddit_post_id text primary key,
      title text not null,
      permalink text not null,
      image_url text,
      published_at timestamptz not null,
      discord_channel_id text,
      discord_message_id text,
      discord_thread_id text,
      posted_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await pool.query(`
    create table if not exists portal_anime_ranking_state (
      id integer primary key default 1,
      status text not null default 'idle',
      error_text text,
      latest_reddit_post_id text,
      last_checked_at timestamptz,
      last_posted_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint portal_anime_ranking_state_singleton check (id = 1)
    );
  `);
  await pool.query(`insert into portal_anime_ranking_state (id) values (1) on conflict (id) do nothing;`);
}

export async function processAnimeRanking({ pool, bot, getSettings, isNotificationWindowOpen, force = false }) {
  const nowMs = Date.now();
  if (!force && nowMs - lastAttemptAt < CHECK_INTERVAL_MS) return;
  if (syncRunning) return;
  lastAttemptAt = nowMs;
  syncRunning = true;

  try {
    const settings = await getSettings();
    if (!settings.anime_ranking_enabled || !settings.anime_ranking_channel_id) {
      await recordStatus(pool, { status: "disabled", errorText: null });
      return;
    }
    if (!isNotificationWindowOpen(settings)) {
      await recordStatus(pool, { status: "waiting_for_notification_window", errorText: null });
      return;
    }

    const ranking = await readLatestRanking();
    const prior = await pool.query(
      `select discord_message_id from portal_anime_ranking_posts where reddit_post_id = $1;`,
      [ranking.id]
    );
    if (prior.rowCount) {
      await recordStatus(pool, { status: "current", errorText: null, postId: ranking.id });
      return;
    }

    const channel = await bot.channels.fetch(settings.anime_ranking_channel_id);
    if (!channel?.isTextBased() || typeof channel.send !== "function") {
      throw new Error("The configured Anime Rankings destination is not a Discord text channel.");
    }

    const image = await downloadImage(ranking.imageUrl, ranking.previewImageUrl);
    const message = await channel.send(makeMessage(ranking, image));
    await pool.query(
      `insert into portal_anime_ranking_posts
         (reddit_post_id, title, permalink, image_url, published_at, discord_channel_id,
          discord_message_id, discord_thread_id, posted_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
       on conflict (reddit_post_id) do nothing;`,
      [ranking.id, ranking.title, ranking.postUrl, ranking.imageUrl, ranking.publishedAt,
        settings.anime_ranking_channel_id, message.id, null]
    );
    await recordStatus(pool, { status: "posted", errorText: null, postId: ranking.id, posted: true });
    console.log(`[cotf-bot] Posted ${ranking.title}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Anime ranking sync failed.";
    try {
      await recordStatus(pool, { status: "failed", errorText: message });
    } catch {
      // Preserve the source or Discord error if state recording also fails.
    }
    console.error("[cotf-bot] Anime ranking sync failed:", message);
  } finally {
    syncRunning = false;
  }
}
