import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildVerifiedMemberPageUrl, checkFcVerification, ensureFcVerification, parseLodestoneFreeCompanyUrl } from "./fc-verification.mjs";

class FakeClient {
  row = null;
  async query(sql, params = []) {
    const normalized = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized.startsWith("create table")) return { rows: [] };
    if (normalized.startsWith("select * from portal_fc_verification")) return { rows: this.row ? [this.row] : [] };
    if (normalized.startsWith("insert into portal_fc_verification")) {
      this.row = {
        fc_lodestone_id: params[0], lodestone_url: params[1], discord_guild_id: params[2],
        world: params[3], datacenter: params[4], verification_code: params[5], status: params[6],
        verified_at: params[7], last_checked_at: params[8], last_error: params[9]
      };
      return { rows: [], rowCount: 1 };
    }
    if (normalized.startsWith("update portal_fc_verification set last_checked_at")) {
      this.row.last_checked_at = new Date(); this.row.last_error = params[0];
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected query: ${normalized}`);
  }
}

const baseOptions = (sealPath, overrides = {}) => ({
  lodestoneUrl: "https://na.finalfantasyxiv.com/lodestone/freecompany/9230971861225975023/",
  discordGuildId: "397427070558273536", world: "Faerie", datacenter: "Aether",
  secret: "installation-secret-one", sealPath, ...overrides
});

test("only official Lodestone Free Company URLs are accepted", () => {
  assert.equal(parseLodestoneFreeCompanyUrl(baseOptions("x").lodestoneUrl).fcId, "9230971861225975023");
  assert.throws(() => parseLodestoneFreeCompanyUrl("https://example.com/lodestone/freecompany/123/"), /official HTTPS/);
  assert.throws(() => parseLodestoneFreeCompanyUrl("https://na.finalfantasyxiv.com/lodestone/character/123/"), /Free Company ID/);
});

test("a signed pending identity ignores later environment target edits", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cotf-fc-verification-"));
  const sealPath = join(directory, "identity.json");
  const client = new FakeClient();
  const first = await ensureFcVerification(client, baseOptions(sealPath));
  const edited = await ensureFcVerification(client, baseOptions(sealPath, {
    lodestoneUrl: "https://na.finalfantasyxiv.com/lodestone/freecompany/1111111111111111111/"
  }));
  assert.equal(first.status, "pending");
  assert.equal(edited.fcId, first.fcId);
  assert.equal(edited.verificationCode, first.verificationCode);
  assert.match(await readFile(sealPath, "utf8"), new RegExp(first.verificationCode));
});

test("a fresh installation secret invalidates a restored seal and creates a new challenge", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cotf-fc-restore-"));
  const sealPath = join(directory, "identity.json");
  const client = new FakeClient();
  const original = await ensureFcVerification(client, baseOptions(sealPath));
  const restored = await ensureFcVerification(client, baseOptions(sealPath, { secret: "fresh-installation-secret" }));
  assert.equal(restored.status, "pending");
  assert.notEqual(restored.verificationCode, original.verificationCode);
});

test("profile challenge verification unlocks member-page URLs", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "cotf-fc-check-"));
  const sealPath = join(directory, "identity.json");
  const client = new FakeClient();
  const pending = await ensureFcVerification(client, baseOptions(sealPath));
  assert.throws(() => buildVerifiedMemberPageUrl(pending, 1), /still pending/);
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(`<html>${pending.verificationCode}</html>`, { status: 200 });
  context.after(() => { globalThis.fetch = previousFetch; });
  const verified = await checkFcVerification(client, baseOptions(sealPath));
  assert.equal(verified.status, "verified");
  assert.equal(buildVerifiedMemberPageUrl(verified, 2), "https://na.finalfantasyxiv.com/lodestone/freecompany/9230971861225975023/member/?page=2");
});

test("a public FC forum thread title can satisfy the ownership challenge", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "cotf-fc-forum-check-"));
  const sealPath = join(directory, "identity.json");
  const client = new FakeClient();
  const pending = await ensureFcVerification(client, baseOptions(sealPath));
  const requestedUrls = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    return new Response(String(url).endsWith("/forum/") ? `<html><h3>${pending.verificationCode}</h3></html>` : "<html>No code here</html>", { status: 200 });
  };
  context.after(() => { globalThis.fetch = previousFetch; });
  const verified = await checkFcVerification(client, baseOptions(sealPath));
  assert.equal(verified.status, "verified");
  assert.deepEqual(requestedUrls, [
    "https://na.finalfantasyxiv.com/lodestone/freecompany/9230971861225975023/",
    "https://na.finalfantasyxiv.com/lodestone/freecompany/9230971861225975023/forum/"
  ]);
});

test("a manual verification check bypasses the automatic fifteen-minute cooldown", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "cotf-fc-manual-check-"));
  const sealPath = join(directory, "identity.json");
  const client = new FakeClient();
  const pending = await ensureFcVerification(client, baseOptions(sealPath));
  client.row.last_checked_at = new Date();
  client.row.last_error = "Previous cached miss";
  let requests = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    requests += 1;
    return new Response("<html>" + pending.verificationCode + "</html>", { status: 200 });
  };
  context.after(() => { globalThis.fetch = previousFetch; });
  const verified = await checkFcVerification(client, baseOptions(sealPath), { force: true });
  assert.equal(requests, 1);
  assert.equal(verified.status, "verified");
});
