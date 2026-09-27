export const ANIME_RANKING_FEED_URL = "https://www.reddit.com/user/Abysswatcherbel/submitted.rss";

function decodeEntities(value = "") {
  return String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function stripCdata(value = "") {
  return String(value).replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function readTag(xml, tagName) {
  const match = String(xml).match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? decodeEntities(stripCdata(match[1]).trim()) : "";
}

function normalizeUrl(value = "") {
  const decoded = decodeEntities(value).replaceAll("&amp;", "&").trim();
  if (!/^https:\/\//i.test(decoded)) return "";
  return decoded;
}

export function originalRedditImageUrl(value = "") {
  const normalized = normalizeUrl(value);
  if (!normalized) return "";
  try {
    const url = new URL(normalized);
    if (url.hostname.toLowerCase() !== "preview.redd.it") return normalized;
    url.hostname = "i.redd.it";
    url.search = "";
    return url.toString();
  } catch {
    return normalized;
  }
}

export function parseAnimeRankingEntries(xml) {
  const entries = String(xml).match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) || [];
  return entries.map((entry) => {
    const linkMatch = entry.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
    const content = readTag(entry, "content");
    const hrefs = [...content.matchAll(/\bhref=["']([^"']+)["']/gi)].map((match) => normalizeUrl(match[1]));
    const images = [...content.matchAll(/\bsrc=["']([^"']+)["']/gi)].map((match) => normalizeUrl(match[1]));
    const previewImageUrl = hrefs.find((url) => /(?:i\.redd\.it|preview\.redd\.it|\.png(?:\?|$)|\.jpe?g(?:\?|$)|\.webp(?:\?|$))/i.test(url)) ||
      images.find((url) => /(?:redd\.it|redditmedia\.com|\.png(?:\?|$)|\.jpe?g(?:\?|$)|\.webp(?:\?|$))/i.test(url)) || "";
    const author = readTag(readTag(entry, "author"), "name").replace(/^\/?u\//i, "");
    const id = readTag(entry, "id").split("_").pop() || "";

    return {
      id,
      title: readTag(entry, "title"),
      author,
      postUrl: normalizeUrl(linkMatch?.[1] || ""),
      imageUrl: originalRedditImageUrl(previewImageUrl),
      previewImageUrl,
      publishedAt: new Date(readTag(entry, "published") || readTag(entry, "updated"))
    };
  });
}
