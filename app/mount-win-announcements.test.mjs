import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("officers can mute mount-win announcements without creating a later backlog", async () => {
  const [page, bot] = await Promise.all([
    readFile(new URL("app/app/page.tsx", root), "utf8"),
    readFile(new URL("bot/bot.mjs", root), "utf8")
  ]);

  assert.match(page, /mount_win_announcements_enabled boolean not null default true/);
  assert.match(page, /name="mountWinAnnouncementsEnabled"/);
  assert.match(page, /checked\("mountWinAnnouncementsEnabled"\)/);
  assert.match(page, /Wins detected while muted will not be posted later/);
  assert.match(bot, /mount_win_announcements_enabled boolean not null default true/);
  assert.match(bot, /if \(!settings\.mount_win_announcements_enabled\)/);
  assert.match(bot, /Skipped: mount-win announcements are disabled for this Discord server\./);
  assert.match(bot, /where discord_sent_at is null/);
});

test("mount-win delivery waits for a successful completed ownership scan", async () => {
  const [page, bot, worker] = await Promise.all([
    readFile(new URL("app/app/page.tsx", root), "utf8"),
    readFile(new URL("bot/bot.mjs", root), "utf8"),
    readFile(new URL("worker/worker.mjs", root), "utf8")
  ]);

  assert.match(worker, /runLoggedSync\(client, "mount-ownership-sync"/);
  assert.match(worker, /status==='lodestone_missing'\?'missing':'failed'/);
  assert.match(worker, /else \{\s*failed \+= 1;\s*\}/);
  assert.match(bot, /where sync_type = 'mount-ownership-sync'/);
  assert.match(bot, /run\.status !== "success"/);
  assert.match(bot, /if \(!completedScanAt\) return/);
  assert.ok((bot.match(/a\.detected_at <= \$1/g) || []).length >= 2);
  assert.match(bot, /left join portal_alt_character_links acl on acl\.character_id = c\.id and acl\.active = true/);
  assert.match(bot, /coalesce\(dl\.discord_user_id, acl\.discord_user_id\) as discord_user_id/);
  assert.match(page, /private or unavailable member profiles do not hold everyone else/);
});
