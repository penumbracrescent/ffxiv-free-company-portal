import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("officers can enable or disable Discord anime scheduled-event reconciliation", async () => {
  const [page, bot, events] = await Promise.all([
    readFile(new URL("app/app/page.tsx", root), "utf8"),
    readFile(new URL("bot/bot.mjs", root), "utf8"),
    readFile(new URL("bot/anime-events.mjs", root), "utf8")
  ]);

  assert.match(page, /anime_event_scheduling_enabled boolean/);
  assert.match(page, /name="animeEventSchedulingEnabled"/);
  assert.match(page, /checked\("animeEventSchedulingEnabled"\)/);
  assert.match(page, /Existing Discord events are left in place/);
  assert.match(page, /animeDiscordSchedulingEnabled/);
  assert.match(bot, /enabled: async \(\) => \(await getBotSettings\(\)\)\.anime_event_scheduling_enabled/);
  assert.match(events, /typeof enabled === "function" \? Boolean\(await enabled\(\)\)/);
  assert.match(events, /disabled in Officer Bot Settings/);
});

test("the private anime schedule command supports bounded day navigation", async () => {
  const [commands, bot, compose] = await Promise.all([
    readFile(new URL("bot/fae-commands.mjs", root), "utf8"),
    readFile(new URL("bot/bot.mjs", root), "utf8"),
    readFile(new URL("compose.yaml", root), "utf8")
  ]);

  assert.match(commands, /\["animeschedule","Browse the anime release schedule by day\."\]/);
  assert.match(commands, /if\(name==="animeschedule"\)return animeSchedule\(pool\)/);
  assert.match(commands, /fae:anime:day:/);
  assert.match(commands, /ANIME_DAY_LIMIT = 30/);
  assert.match(commands, /MessageFlags\.Ephemeral/);
  assert.match(commands, /"minions",Number\(interaction\.values\[0\]\)/);
  assert.match(commands, /Discord displays release times in your local timezone/);
  assert.match(commands, /alreadyDeferred=false/);
  assert.match(commands, /if\(!secret\)return/);
  const faeDispatch = bot.slice(
    bot.indexOf('if (interaction.commandName === DISCORD_COMMAND_NAME)'),
    bot.indexOf('if (interaction.commandName === "postverify")'),
  );
  assert.doesNotMatch(faeDispatch, /result\.privacySuppressed/);
  assert.match(bot, /if \(await isDiscordPrivacySuppressed\(interaction\.user\.id\)\)/);
  assert.match(bot, /handleFaeCommand\(interaction, pool, \{ alreadyDeferred: true \}\)/);
  assert.match(bot, /Privacy gate configuration failed/);
  assert.match(compose, /ANIME_TIMEZONE: \$\{ANIME_TIMEZONE:-America\/Chicago\}/);
});
