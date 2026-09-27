import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const source = await readFile(new URL("./lib/portal-branding.ts", import.meta.url), "utf8");
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { exports, require: createRequire(import.meta.url), Buffer, File });
test("branding rejects SVG and mismatched file signatures", () => {
  assert.throws(() => exports.imageExtension(Buffer.from("<svg/>"), "image/svg+xml"));
  assert.throws(() => exports.imageExtension(Buffer.from("<script/>"), "image/png"));
  assert.equal(exports.imageExtension(Buffer.from([137,80,78,71,13,10,26,10]), "image/png"), "png");
  assert.equal(exports.imageExtension(Buffer.from([255,216,255]), "image/jpeg"), "jpg");
});
test("branding paths cannot escape the image directory", () => {
  assert.equal(exports.validBrandingUrl("/api/branding/12345678-1234-1234-1234-123456789012.png"), true);
  for (const value of ["/api/branding/../../.env", "https://example.com/image.png", "/uploads/logo.svg"]) assert.equal(exports.validBrandingUrl(value), false);
});
test("branding supports keeping an existing image and enforces upload limit", async () => {
  assert.equal(await exports.prepareBrandingImage(null), null);
  await assert.rejects(exports.prepareBrandingImage(new File([new Uint8Array(8 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })), /8 MB/);
});

test("tile color is independently configurable and survives setup finalization", async () => {
  const [page, wizard, route, prefill, styles, finalize, compose] = await Promise.all([
    readFile(new URL("./app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./app/setup/SetupWizard.tsx", import.meta.url), "utf8"),
    readFile(new URL("./app/api/setup/complete/route.ts", import.meta.url), "utf8"),
    readFile(new URL("./app/api/setup/prefill/route.ts", import.meta.url), "utf8"),
    readFile(new URL("./app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../installer/finalize.mjs", import.meta.url), "utf8"),
    readFile(new URL("../compose.yaml", import.meta.url), "utf8"),
  ]);

  assert.match(wizard, /name="tileColor"/);
  assert.match(route, /const tileColor = text\(form, "tileColor"\)/);
  assert.match(page, /row\.key === "tileColor"/);
  assert.match(page, /"--tile-color": settings\.tileColor/);
  assert.match(page, /"--accent": settings\.accentColor/);
  assert.match(styles, /--tile-surface: var\(--tile-color\)/);
  assert.match(styles, /linear-gradient\(180deg, var\(--tile-surface\), var\(--tile-surface-deep\)\)/);
  assert.match(styles, /linear-gradient\(135deg, var\(--tile-surface-raised\), var\(--tile-surface-deep\)\)/);
  assert.match(styles, /\.settings-form[\s\S]*?background: var\(--tile-surface\)/);
  assert.match(styles, /\.guild-app \.discord-roster-control-card/);
  assert.match(styles, /background-image: none/);
  assert.match(styles, /Saved portal colors own all non-semantic accents and standard surfaces/);
  assert.match(styles, /\.guild-app \.settings-form,[\s\S]*?background-color: var\(--tile-color\)/);
  assert.match(styles, /\.guild-app \.tag:not\(\.success\):not\(\.warning\):not\(\.danger\)/);
  assert.match(styles, /linear-gradient\(135deg, var\(--accent-dark\), var\(--accent\)\)/);
  assert.match(finalize, /PORTAL_TILE_COLOR: setup\.tileColor/);
  assert.match(compose, /PORTAL_TILE_COLOR:/);
  assert.match(prefill, /async function restoredPortalTheme\(\)/);
  assert.match(prefill, /select key,value from portal_settings/);
  for (const key of ["backgroundColor", "accentColor", "tileColor"]) {
    assert.match(prefill, new RegExp(`${key}: databasePortalTheme\\?\\.${key} \\?\\? value`));
  }
});

test("changing access methods cannot retain a stale public URL", async () => {
  const wizard = await readFile(new URL("./app/setup/SetupWizard.tsx", import.meta.url), "utf8");
  assert.match(wizard, /function chooseAccessMode\(value: string\)/);
  assert.match(wizard, /value === "cloudflare"[\s\S]*?setPortalUrl\(cloudflareHostname \? `https:\/\/\$\{cloudflareHostname\}\/` : ""\)/);
  assert.match(wizard, /onChange=\{\(\) => chooseAccessMode\(value\)\}/);
  assert.match(wizard, /setCloudflareHostname\(value\); setPortalUrl\(value \? `https:\/\/\$\{value\}\/` : ""\)/);
});

test("Cloudflare setup explains the connector-first installation sequence", async () => {
  const [wizard, readme] = await Promise.all([
    readFile(new URL("./app/setup/SetupWizard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8")
  ]);
  for (const guidance of [
    "Networking → Tunnels → Create tunnel → Cloudflared",
    "Do not run the sample Docker command",
    "Routes → Add route → Published application",
    "http://portal:3000",
    "No router port forwarding"
  ]) assert.match(wizard, new RegExp(guidance.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(wizard, /accessMode === "cloudflare" \? <div className="setup-access-details">/);
  assert.match(readme, /### Cloudflare Tunnel sequence/);
  assert.match(readme, /Copy only the long private value after `--token`/);
});

test("officers can edit semantic portal colors without complicating first-time setup", async () => {
  const [page, editor, styles, wizard, activityLog] = await Promise.all([
    readFile(new URL("./app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./app/components/ThemeEditor.tsx", import.meta.url), "utf8"),
    readFile(new URL("./app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("./app/setup/SetupWizard.tsx", import.meta.url), "utf8"),
    readFile(new URL("./app/components/OfficerActivityLog.tsx", import.meta.url), "utf8")
  ]);
  assert.match(page, /isOfficer \? <ThemeEditor/);
  assert.match(page, /async function savePortalThemeColor/);
  assert.match(page, /\["Admins", "Guild Officers"\]/);
  for (const key of ["backgroundColor", "backgroundSecondaryColor", "sidebarColor", "tileColor", "insetColor", "borderColor", "accentColor", "labelColor", "headingColor", "textColor", "mutedTextColor"]) {
    assert.match(page, new RegExp(`row\\.key === "${key}"`));
  }
  assert.match(editor, /Click an element to edit it/);
  assert.match(editor, /document\.addEventListener\("click", choose, true\)/);
  assert.match(editor, /cotf\.portal-theme-editor/);
  assert.match(editor, /localStorage\.setItem/);
  assert.match(editor, /closest\("a\[href\]"\)/);
  assert.match(editor, /Yes — Save &amp; Exit/);
  assert.match(editor, /No — Keep Editing/);
  assert.match(editor, /Discard &amp; Exit/);
  assert.match(editor, /Save color/);
  assert.match(editor, /Bottom fade color|selected\.secondary\.label/);
  assert.match(styles, /Officer Editor Mode: semantic colors/);
  assert.match(styles, /linear-gradient\(180deg, var\(--theme-page\), var\(--theme-page-secondary, var\(--theme-page\)\)\)/);
  assert.match(styles, /\.guild-app \.eyebrow \{[\s\S]*?background: transparent/);
  assert.doesNotMatch(styles, /:where\([^)]*\.eyebrow[^)]*\) \{[\s\S]*?background: color-mix/);
  assert.match(styles, /--tile-surface: var\(--theme-surface/);
  assert.match(styles, /\.theme-editor-active \[data-theme-editor-target\]/);
  assert.match(wizard, /name="backgroundColor"/);
  assert.match(wizard, /name="accentColor"/);
  assert.match(wizard, /name="tileColor"/);
  assert.doesNotMatch(activityLog, /className="primary-button"/);
  assert.match(activityLog, /className="button primary"[^>]*>[\s\S]*?Refresh/);
  assert.match(activityLog, /className="button primary"[^>]*>[\s\S]*?Next/);
});

test("officers can reorder the shared sidebar without moving the pinned officer area", async () => {
  const [page, editor, styles] = await Promise.all([
    readFile(new URL("./app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./app/components/ThemeEditor.tsx", import.meta.url), "utf8"),
    readFile(new URL("./app/globals.css", import.meta.url), "utf8")
  ]);
  assert.match(page, /async function savePortalNavigationOrder/);
  assert.match(page, /row\.key === "navigationOrder"/);
  assert.match(page, /orderNavigationItems\(memberNavItems, settings\.navigationOrder\)/);
  assert.match(page, /data-nav-key=\{item\.view\}/);
  assert.match(page, /saveNavigationAction=\{savePortalNavigationOrder\}/);
  assert.match(editor, />Alphabetize</);
  assert.match(editor, />Restore default</);
  assert.match(editor, /draggable/);
  assert.match(editor, /Move \$\{item\.label\} up/);
  assert.match(editor, /Officer Area remains pinned/);
  assert.match(styles, /\.theme-editor-nav-list/);
});
