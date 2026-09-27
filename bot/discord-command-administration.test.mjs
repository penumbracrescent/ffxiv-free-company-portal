import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getDisabledFaeCommands, isFaeCommandEnabled } from "./fae-commands.mjs";

const pool = (value) => ({ query: async () => ({ rows: value === null ? [] : [{ value }] }) });

test("officers can disable optional commands while required disclosures stay enabled", async () => {
  const disabled = await getDisabledFaeCommands(pool("character,craftmacro,about,privacy,unknown"));
  assert.deepEqual([...disabled], ["character", "craftmacro"]);
  assert.equal(await isFaeCommandEnabled(pool("character"), "character"), false);
  assert.equal(await isFaeCommandEnabled(pool("about,privacy"), "about"), true);
  assert.equal(await isFaeCommandEnabled(pool("about,privacy"), "privacy"), true);
  assert.equal(await isFaeCommandEnabled(pool(""), "officer"), true);
});

test("the bot gates execution and help uses the saved command list", async () => {
  const [commands, bot] = await Promise.all([
    readFile(new URL("./fae-commands.mjs", import.meta.url), "utf8"),
    readFile(new URL("./bot.mjs", import.meta.url), "utf8")
  ]);
  assert.match(commands, /discordDisabledCommands/);
  assert.match(commands, /FAE_HELP_ITEMS\.filter/);
  assert.match(bot, /if \(!await isFaeCommandEnabled\(pool, faeCommand\)\)/);
  assert.match(bot, /disabledFaeCommandReply\(faeCommand\)/);
});

test("Officer Area displays optional toggles and locked About and Privacy rows", async () => {
  const page = await readFile(new URL("../app/app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Discord Command Administration/);
  assert.match(page, /enabledDiscordCommands/);
  assert.match(page, /Cannot be disabled/);
  assert.match(page, /name: "about"[\s\S]*?required: true/);
  assert.match(page, /name: "privacy"[\s\S]*?required: true/);
  assert.match(page, /\["Admins", "Guild Officers"\]/);
});
