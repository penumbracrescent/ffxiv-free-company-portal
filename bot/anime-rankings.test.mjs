import test from "node:test";
import assert from "node:assert/strict";
import {
  ANIME_RANKING_FEED_URL,
  originalRedditImageUrl,
  parseAnimeRankingEntries
} from "./anime-ranking-source.mjs";

test("uses Reddit's current Atom feed URL", () => {
  assert.equal(
    ANIME_RANKING_FEED_URL,
    "https://www.reddit.com/user/Abysswatcherbel/submitted.rss"
  );
});

test("promotes Reddit preview images to their original attachment URL", () => {
  assert.equal(
    originalRedditImageUrl("https://preview.redd.it/example.png?width=640&amp;crop=smart&amp;auto=webp"),
    "https://i.redd.it/example.png"
  );
});

test("parses a ranking entry with an original and fallback image", () => {
  const entries = parseAnimeRankingEntries(`
    <feed>
      <entry>
        <id>t3_1w2gy9t</id>
        <title>r/anime Karma Ranking &amp; Discussion | Week 9 [Summer 2026]</title>
        <author><name>/u/Abysswatcherbel</name></author>
        <published>2026-09-07T18:00:00Z</published>
        <link href="https://www.reddit.com/r/anime/comments/1w2gy9t/example/" />
        <content><![CDATA[<a href="https://preview.redd.it/example.png?width=640&amp;crop=smart"><img src="https://preview.redd.it/example.png?width=640&amp;crop=smart" /></a>]]></content>
      </entry>
    </feed>
  `);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, "1w2gy9t");
  assert.equal(entries[0].author, "Abysswatcherbel");
  assert.equal(entries[0].imageUrl, "https://i.redd.it/example.png");
  assert.equal(entries[0].previewImageUrl, "https://preview.redd.it/example.png?width=640&crop=smart");
});
