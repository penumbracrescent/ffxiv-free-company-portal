import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from "discord.js";
import { PORTAL_URL } from "./installation-config.mjs";

const SOURCES = [
  { key: "news", url: "https://na.finalfantasyxiv.com/lodestone/news/news.xml", defaultCategory: "News" },
  { key: "topics", url: "https://na.finalfantasyxiv.com/lodestone/news/topics.xml", defaultCategory: "Topics" },
  { key: "developers-blog", url: "https://na.finalfantasyxiv.com/blog/atom.xml", defaultCategory: "Developer Blog" }
];
const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20_000;
const MAX_POSTS_PER_RUN = 10;

let lastAttemptAt = 0;
let syncRunning = false;

function decodeEntities(value = "") {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function stripCdata(value = "") {
  return String(value).replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "");
}

function readTag(xml, tagName) {
  const match = String(xml).match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? decodeEntities(stripCdata(match[1]).trim()) : "";
}

function normalizeUrl(value = "") {
  const url = decodeEntities(value).trim();
  return /^https:\/\//i.test(url) ? url : "";
}

function htmlToText(value = "") {
  return decodeEntities(decodeEntities(stripCdata(value)))
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<\/h[1-6]\s*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncate(value, maxLength) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function readLink(entry, rel) {
  const links = [...String(entry).matchAll(/<link\b([^>]*)\/?\s*>/gi)];
  for (const match of links) {
    const attributes = match[1] || "";
    const relMatch = attributes.match(/\brel=["']([^"']+)["']/i);
    const hrefMatch = attributes.match(/\bhref=["']([^"']+)["']/i);
    if (hrefMatch && (!rel || relMatch?.[1]?.toLowerCase() === rel.toLowerCase())) {
      return normalizeUrl(hrefMatch[1]);
    }
  }
  return "";
}

function readCategory(entry, fallback) {
  const match = String(entry).match(/<category\b[^>]*\bterm=["']([^"']+)["'][^>]*>/i);
  return decodeEntities(match?.[1] || fallback).trim() || fallback;
}

export function parseLodestoneEntries(xml, source) {
  const entries = String(xml).match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) || [];
  return entries.map((entry) => {
    const permalink = readLink(entry, "alternate");
    const rawContent = readTag(entry, "content");
    const summary = htmlToText(readTag(entry, "summary") || rawContent);
    const imageMatch = rawContent.match(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i);
    const enclosure = readLink(entry, "enclosure");
    const publishedAt = new Date(readTag(entry, "published") || readTag(entry, "updated"));
    const id = readTag(entry, "id") || permalink;

    return {
      sourceKey: `${source.key}:${id}`,
      source: source.key,
      title: htmlToText(readTag(entry, "title")),
      permalink,
      category: source.key === "developers-blog" ? "Developer Blog" : readCategory(entry, source.defaultCategory),
      summary,
      imageUrl: source.key === "topics" ? enclosure || normalizeUrl(imageMatch?.[1] || "") : "",
      publishedAt
    };
  }).filter((entry) => entry.sourceKey && entry.title && entry.permalink && Number.isFinite(entry.publishedAt.getTime()));
}

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

async function readOfficialFeeds() {
  const results = await Promise.all(SOURCES.map(async (source) => {
    const response = await fetchWithTimeout(source.url);
    if (!response.ok) throw new Error(`${source.defaultCategory} feed returned HTTP ${response.status}.`);
    return parseLodestoneEntries(await response.text(), source);
  }));

  const unique = new Map();
  for (const entry of results.flat()) unique.set(entry.sourceKey, entry);
  return [...unique.values()].sort((left, right) => left.publishedAt.getTime() - right.publishedAt.getTime());
}

function categoryStyle(category) {
  const value = String(category || "").toLowerCase();
  if (value.includes("maintenance")) return { color: 0xd6a11d, label: "Maintenance" };
  if (value.includes("status")) return { color: 0xc64b52, label: "Status" };
  if (value.includes("update")) return { color: 0x64a83b, label: "Updates" };
  if (value.includes("developer")) return { color: 0x5f8dd3, label: "Developer Blog" };
  if (value.includes("notice")) return { color: 0x9b93a8, label: "Notices" };
  if (value.includes("topic")) return { color: 0xd5a426, label: "Topics" };
  return { color: 0x8f2de2, label: category || "News" };
}

function makeMessage(entry) {
  const style = categoryStyle(entry.category);
  const description = truncate(entry.summary || "Read the full announcement on the Lodestone.", 900);
  const embed = new EmbedBuilder()
    .setColor(style.color)
    .setTitle(truncate(entry.title, 256))
    .setURL(entry.permalink)
    .setDescription(description)
    .setTimestamp(entry.publishedAt)
    .setFooter({ text: `${style.label} · FINAL FANTASY XIV, The Lodestone · © SQUARE ENIX` });

  if (entry.imageUrl) embed.setImage(entry.imageUrl);

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Read on the Lodestone").setURL(entry.permalink)
  );

  return { embeds: [embed], components: [buttons], allowedMentions: { parse: [] } };
}

async function recordState(pool, status, errorText = null, posted = false) {
  await pool.query(
    `update portal_lodestone_news_state
     set status = $1,
         error_text = $2,
         last_checked_at = now(),
         last_posted_at = case when $3 then now() else last_posted_at end,
         updated_at = now()
     where id = 1;`,
    [status, errorText, posted]
  );
}

async function insertEntry(pool, entry, status) {
  const result = await pool.query(
    `insert into portal_lodestone_news_posts
       (source_key, source_name, title, permalink, category, summary, image_url, published_at, status, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     on conflict (source_key) do nothing
     returning source_key;`,
    [entry.sourceKey, entry.source, entry.title, entry.permalink, entry.category,
      entry.summary || null, entry.imageUrl || null, entry.publishedAt, status]
  );
  return Boolean(result.rowCount);
}

export async function ensureLodestoneNewsTables(pool) {
  await pool.query(`
    create table if not exists portal_lodestone_news_posts (
      source_key text primary key,
      source_name text not null,
      title text not null,
      permalink text not null,
      category text not null,
      summary text,
      image_url text,
      published_at timestamptz not null,
      status text not null default 'pending',
      discord_channel_id text,
      discord_message_id text,
      posted_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await pool.query(`
    create table if not exists portal_lodestone_news_state (
      id integer primary key default 1,
      initialized_at timestamptz,
      status text not null default 'idle',
      error_text text,
      last_checked_at timestamptz,
      last_posted_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint portal_lodestone_news_state_singleton check (id = 1)
    );
  `);
  await pool.query(`insert into portal_lodestone_news_state (id) values (1) on conflict (id) do nothing;`);
}

export async function processLodestoneNews({ pool, bot, getSettings, isNotificationWindowOpen, force = false }) {
  const nowMs = Date.now();
  if (!force && nowMs - lastAttemptAt < CHECK_INTERVAL_MS) return;
  if (syncRunning) return;
  lastAttemptAt = nowMs;
  syncRunning = true;

  try {
    const settings = await getSettings();
    if (!settings.lodestone_news_enabled || !settings.lodestone_news_channel_id) {
      await recordState(pool, "disabled");
      return;
    }
    if (!isNotificationWindowOpen(settings)) {
      await recordState(pool, "waiting_for_notification_window");
      return;
    }

    const entries = await readOfficialFeeds();
    if (!entries.length) throw new Error("The official Lodestone feeds returned no usable entries.");

    const stateResult = await pool.query(`select initialized_at from portal_lodestone_news_state where id = 1;`);
    if (!stateResult.rows[0]?.initialized_at) {
      for (const entry of entries) await insertEntry(pool, entry, "baseline");
      await pool.query(`update portal_lodestone_news_state set initialized_at = now(), status = 'baseline_complete', error_text = null, last_checked_at = now(), updated_at = now() where id = 1;`);
      console.log(`[cotf-bot] Lodestone News baseline complete (${entries.length} existing entries recorded; no backlog posted).`);
      return;
    }

    const channel = await bot.channels.fetch(settings.lodestone_news_channel_id);
    if (!channel?.isTextBased() || typeof channel.send !== "function") {
      throw new Error("The configured Lodestone News destination is not a Discord text channel.");
    }

    let postedCount = 0;
    const candidates = entries.slice(-MAX_POSTS_PER_RUN);
    for (const entry of candidates) {
      const inserted = await insertEntry(pool, entry, "sending");
      if (!inserted) continue;

      try {
        const message = await channel.send(makeMessage(entry));
        await pool.query(
          `update portal_lodestone_news_posts
           set status = 'posted', discord_channel_id = $2, discord_message_id = $3,
               posted_at = now(), updated_at = now()
           where source_key = $1;`,
          [entry.sourceKey, settings.lodestone_news_channel_id, message.id]
        );
        postedCount += 1;
      } catch (error) {
        await pool.query(`delete from portal_lodestone_news_posts where source_key = $1 and status = 'sending';`, [entry.sourceKey]);
        throw error;
      }
    }

    await recordState(pool, postedCount ? "posted" : "current", null, postedCount > 0);
    if (postedCount) console.log(`[cotf-bot] Posted ${postedCount} new Lodestone announcement${postedCount === 1 ? "" : "s"}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Lodestone News sync failed.";
    try { await recordState(pool, "failed", message); } catch { /* Preserve the original error. */ }
    console.error("[cotf-bot] Lodestone News sync failed:", message);
  } finally {
    syncRunning = false;
  }
}
