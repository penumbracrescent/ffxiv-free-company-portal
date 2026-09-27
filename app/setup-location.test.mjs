import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import ts from "typescript";

async function loadModule(path) {
  const exports = {};
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
  } }).outputText, { exports });
  return exports;
}
const { validateSetupWorld } = await loadModule("./lib/setup-worlds.ts");
test("unmounting the completed restore panel releases the setup form lock", async () => {
  const source = await readFile(new URL("./app/setup/RestoreBackup.tsx", import.meta.url), "utf8");
  const exports = {};
  const effects = [];
  let stateIndex = 0;
  const react = {
    useState(initial) { return [stateIndex++ === 1 ? { phase: "complete", message: "Restored" } : initial, () => {}]; },
    useEffect(callback) { effects.push(callback); }
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX
  } }).outputText, { exports, require: name => name === "react" ? react : { jsx: () => null, jsxs: () => null } });
  const states = [];
  exports.default({ setupToken: "test", onPendingChange: value => states.push(value) });
  const cleanup = effects[0]();
  assert.deepEqual(states, [true]);
  cleanup();
  assert.deepEqual(states, [true, false]);
});
test("restored command remains controlled and its chosen value is explicitly submitted", async () => {
  const source = await readFile(new URL("./app/setup/SetupWizard.tsx", import.meta.url), "utf8");
  assert.match(source, /name="commandName" value=\{commandName\}/);
  assert.match(source, /formData.set\("commandName", commandName\)/);
  assert.match(source, /setRestoredBackup\(true\);\s*setRestorePending\(false\)/);
});
test("setup and officer verification clearly explain every supported code placement", async () => {
  const [setup, portal] = await Promise.all([
    readFile(new URL("./app/setup/SetupWizard.tsx", import.meta.url), "utf8"),
    readFile(new URL("./app/page.tsx", import.meta.url), "utf8")
  ]);
  for (const source of [setup, portal]) {
    assert.match(source, /slogan, company board, or estate profile/);
    assert.match(source, /Public/);
    assert.match(source, /Members Only/);
  }
  assert.match(setup, /forum thread/);
  assert.match(portal, /FC forum:[^]*new thread/);
  assert.match(portal, /exact code as the thread title/);
  assert.match(portal, /codes placed only inside a thread body are not visible/);
  assert.match(portal, /label: "Sync Status"[\s\S]*anchor: "officer-sync-status"/);
  assert.match(portal, /<h2>Free Company Verification<\/h2>/);
  assert.match(portal, /<h3>Sync Status<\/h3>/);
  assert.match(portal, /open=\{fcVerification\?\.status !== "verified" \? true : undefined\}/);
  assert.match(portal, /async function queueFcVerificationCheck\(\)[\s\S]*'fc_verification_check'/);
  assert.match(portal, /Check Verification Now/);
  assert.match(portal, /normally within one minute/);
  assert.match(portal, /Authenticated through \{installationAuthProviderLabel\}/);
});
test("setup accepts Chaos/Moogle and rejects missing or mismatched locations", () => {
  assert.equal(validateSetupWorld("Chaos", "Moogle").world, "Moogle");
  assert.throws(() => validateSetupWorld("Aether", "Moogle"));
  assert.throws(() => validateSetupWorld("", ""));
});

for (const platform of ["node", ...(process.platform === "win32" ? ["powershell"] : [])]) {
  test(platform + " sealing replaces old location and preserves unrelated deployment settings", async () => {
    const root = await mkdtemp(join(tmpdir(), "portal-location-"));
    try {
      await mkdir(join(root, "data", "setup"), { recursive: true });
      await writeFile(join(root, ".env"), "DEFAULT_WORLD='Faerie'\nDEFAULT_DATACENTER='Aether'\nPOSTGRES_PASSWORD='keep-secret'\nPORTAL_PORT='9031'\nDOCKER_NETWORK_SUBNET='172.30.70.0/24'\n");
      await writeFile(join(root, "data", "setup", "restored-env.json"), JSON.stringify({ DEFAULT_WORLD: "Faerie", DEFAULT_DATACENTER: "Aether" }));
      await writeFile(join(root, "data", "setup", "installation.json"), JSON.stringify({
        world: "Moogle", dataCenter: "Chaos", portalName: "Test Company",
        portalUrl: "http://localhost:9031", accessMode: "local"
      }));
      if (platform === "node") {
        execFileSync(process.execPath, [fileURLToPath(new URL("../installer/finalize.mjs", import.meta.url))], { env: { ...process.env, INSTALL_ROOT: root } });
      } else {
        await cp(new URL("../setup.ps1", import.meta.url), join(root, "setup.ps1"));
        execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(root, "setup.ps1")]);
      }
      const env = await readFile(join(root, ".env"), "utf8");
      for (const expected of ["DEFAULT_WORLD='Moogle'", "DEFAULT_DATACENTER='Chaos'", "POSTGRES_PASSWORD='keep-secret'", "PORTAL_PORT='9031'", "DOCKER_NETWORK_SUBNET='172.30.70.0/24'"]) assert.ok(env.includes(expected), expected);
      await writeFile(join(root, "data", "setup", "installation.json"), JSON.stringify({ world: "", dataCenter: "Chaos" }));
      const runInvalid = () => platform === "node"
        ? execFileSync(process.execPath, [fileURLToPath(new URL("../installer/finalize.mjs", import.meta.url))], { env: { ...process.env, INSTALL_ROOT: root }, stdio: "pipe" })
        : execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(root, "setup.ps1")], { stdio: "pipe" });
      assert.throws(runInvalid, /missing the data center or world/);
      assert.equal(await readFile(join(root, ".env"), "utf8"), env);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}

test("generated defaults replace the previous generated value, not custom copy", async () => {
  const { syncGeneratedDefault } = await loadModule("./lib/generated-defaults.ts");
  for (const current of ["Faerie", "Custom house location"]) {
    let saved = current;
    const client = { query: async (sql, values) => {
      if (sql.startsWith("select")) return { rows: [{ value: "Faerie" }] };
      if (sql.startsWith("update") && saved === values[2]) saved = values[1];
      return { rows: [] };
    } };
    await syncGeneratedDefault(client, "fcHouseLocation", "Moogle", "Faerie");
    assert.equal(saved, current === "Faerie" ? "Moogle" : current);
  }
});
