import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, mkdir, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const routeSource = await readFile(new URL("app/app/api/setup/restore/route.ts", root), "utf8");
function route(options = {}) {
  const calls = { writes: [], released: 0 };
  const fakeFs = {
    stat: async () => options.offline ? null : { mtimeMs: Date.now() },
    open: async () => ({ writeFile: async value => calls.writes.push(value), close: async () => {} }),
    rename: async () => {}, unlink: async () => {}, writeFile: async (path, data) => calls.writes.push([path, data])
  };
  const exports = {};
  const requires = {
    "node:fs/promises": fakeFs,
    "next/server": { NextResponse: { json: (body, init) => ({ body, status: init.status, headers: init.headers }) } },
    "../../../../lib/setup-security": { isValidSetupToken: value => !options.sealed && value === "test-only" },
    "../../../../lib/setup-restore": {
      restoreDirectory: "/test", restoreAllowed: () => !options.existing,
      restoreState: async () => options.state || { phase: "idle" },
      lockSetupOperation: async () => {
        if (options.locked) throw Object.assign(new Error("busy"), { code: "EEXIST" });
        return async () => { calls.released++; };
      }
    }
  };
  vm.runInNewContext(ts.transpileModule(routeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { if (!(name in requires)) throw new Error(name); return requires[name]; }, URL, Date, JSON, Number, Error });
  return { POST: exports.POST, calls };
}
const request = (action, body = {}, token = "test-only", extra = {}) => new Request(`http://localhost/api/setup/restore?action=${action}`, {
  method: "POST", headers: { "x-setup-token": token, ...extra }, body: JSON.stringify(body)
});

test("restore rejects invalid tokens and sealed installations before filesystem access", async () => {
  assert.equal((await route().POST(request("list", {}, "wrong"))).status, 403);
  assert.equal((await route({ sealed: true }).POST(request("status"))).status, 403);
  assert.equal((await route({ existing: true }).POST(request("list"))).status, 409);
});
test("restore reports unavailable helper and concurrent operations", async () => {
  assert.equal((await route({ offline: true }).POST(request("list"))).status, 503);
  assert.equal((await route({ locked: true }).POST(request("list"))).status, 409);
});
test("restore refuses unsafe shared-folder names", async () => {
  const api = route();
  assert.equal((await api.POST(request("inspect", { filename: "../private.tar.gz" }))).status, 400);
  assert.equal(api.calls.released, 1);
  assert.equal(api.calls.writes.length, 0);
});
test("restore confirmation requires preview match and trusted-source acknowledgement", async () => {
  const state = { phase: "ready", preview: { confirmation: "expected" } };
  assert.equal((await route({ state }).POST(request("confirm", { confirmation: "expected" }))).status, 400);
  assert.equal((await route({ state }).POST(request("confirm", { trusted: true, confirmation: "other" }))).status, 400);
  const api = route({ state });
  assert.equal((await api.POST(request("confirm", { trusted: true, confirmation: "expected" }))).status, 202);
  assert.equal(api.calls.released, 0, "worker owns the lock after handoff");
});
test("oversized uploads are refused without reading their body", async () => {
  const api = route();
  assert.equal((await api.POST(request("upload", {}, "test-only", { "content-length": String(3 * 1024 ** 3) }))).status, 413);
  assert.equal(api.calls.writes.length, 0);
});
test("inspection is queued and status responses are not cached", async () => {
  const api = route();
  assert.equal((await api.POST(request("inspect", { filename: "backup.tar.gz" }))).status, 202);
  assert.ok(api.calls.writes.some(([name]) => name.endsWith("restore-request.tmp")));
  assert.equal((await api.POST(request("status"))).headers["Cache-Control"], "no-store");
});
for (const mode of ["node", ...(process.platform === "win32" ? ["powershell"] : [])]) test(`${mode} sealing merges restored integrations while preserving new installation identity`, async () => {
  const directory = await mkdtemp(join(tmpdir(), "cotf-restore-test-"));
  try {
    const setup = join(directory, "data", "setup");
    await mkdir(setup, { recursive: true });
    await writeFile(join(directory, ".env"), "POSTGRES_PASSWORD='fresh-db'\nPORTAL_PORT='9031'\nAUTH_SECRET='fresh-session'\nSETUP_TOKEN='temporary'\n");
    await writeFile(join(setup, "restored-env.json"), JSON.stringify({ AUTH_PROVIDER: "authentik", AUTH_AUTHENTIK_ID: "old-client", AUTH_AUTHENTIK_SECRET: "old-secret", AUTH_AUTHENTIK_ISSUER: "https://auth.example.test/application/o/portal/", ANIME_GOOGLE_SUB_CALENDAR_ID: "calendar" }));
    await writeFile(join(setup, "installation.json"), JSON.stringify({ portalName: "Restored", portalUrl: "https://portal.example.test/", accessMode: "reverse-proxy", dataCenter: "Chaos", world: "Moogle" }));
    if (mode === "node") execFileSync(process.execPath, [fileURLToPath(new URL("installer/finalize.mjs", root))], { env: { ...process.env, INSTALL_ROOT: directory }, stdio: "pipe" });
    else {
      await writeFile(join(directory, "setup.ps1"), await readFile(new URL("setup.ps1", root)));
      execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(directory, "setup.ps1")], { stdio: "pipe" });
    }
    const env = await readFile(join(directory, ".env"), "utf8");
    for (const expected of ["POSTGRES_PASSWORD='fresh-db'", "PORTAL_PORT='9031'", "AUTH_SECRET='fresh-session'", "AUTH_PROVIDER='authentik'", "AUTH_AUTHENTIK_SECRET='old-secret'", "ANIME_GOOGLE_SUB_CALENDAR_ID='calendar'", "SETUP_MODE='false'"]) assert.ok(env.includes(expected), expected);
    assert.ok(!env.includes("SETUP_TOKEN="));
    await access(join(setup, "setup-sealed.json"));
    await assert.rejects(access(join(setup, "restored-env.json")));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
