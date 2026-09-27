import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("creates the gallery import table before inspecting its constraints", async () => {
  const source = await readFile(new URL("./app/page.tsx", import.meta.url), "utf8");
  const createTable = source.indexOf(
    "create table if not exists portal_community_gallery_import_requests"
  );
  const inspectConstraint = source.indexOf(
    "where conrelid = 'portal_community_gallery_import_requests'::regclass"
  );

  assert.notEqual(createTable, -1, "gallery import table creation is missing");
  assert.notEqual(inspectConstraint, -1, "gallery import constraint migration is missing");
  assert.ok(
    createTable < inspectConstraint,
    "gallery import table must exist before its constraints are inspected"
  );
});

test("creates character records before schemas that reference them", async () => {
  const source = await readFile(new URL("./app/page.tsx", import.meta.url), "utf8");
  const createCharacters = source.indexOf("await ensureCharactersTable(client);");
  const dependentSchemas = [
    "await ensureGiveawayTables(client);",
    "await ensureCraftingTables(client);",
    "await ensureCharacterRenameHistoryTable(client);",
    "await ensureFcRosterAuditTables(client);",
    "await ensureMountSyncTables(client);",
  ];

  assert.notEqual(createCharacters, -1, "character schema migration is missing");
  for (const migration of dependentSchemas) {
    const dependent = source.indexOf(migration);
    assert.notEqual(dependent, -1, `${migration} is missing`);
    assert.ok(
      createCharacters < dependent,
      `character records must exist before ${migration}`
    );
  }
});

test("creates Discord links before alt-character migrations reference them", async () => {
  const source = await readFile(new URL("./app/page.tsx", import.meta.url), "utf8");
  const createCharacters = source.indexOf("await ensureCharactersTable(client);");
  const createDiscordLinks = source.indexOf("await ensureDiscordLinksTable(client);");
  const createAltCharacters = source.indexOf("await ensureDiscordBotSettingsTable(client);");

  assert.notEqual(createDiscordLinks, -1, "Discord-link schema migration is missing");
  assert.notEqual(createAltCharacters, -1, "alt-character schema migration is missing");
  assert.ok(createCharacters < createDiscordLinks, "characters must exist before Discord links");
  assert.ok(createDiscordLinks < createAltCharacters, "Discord links must exist before alt-character tables and triggers");
});

test("fresh setup creates Discord bot settings before saving them", async () => {
  const source = await readFile(new URL("./app/api/setup/complete/route.ts", import.meta.url), "utf8");
  const ensureSettings = source.indexOf("await ensureDiscordBotSettingsTable(settingsClient);");
  const saveSettings = source.indexOf("insert into portal_discord_bot_settings");

  assert.notEqual(ensureSettings, -1, "setup Discord settings migration is missing");
  assert.notEqual(saveSettings, -1, "setup Discord settings insert is missing");
  assert.ok(ensureSettings < saveSettings, "setup must create Discord settings before inserting them");
});
