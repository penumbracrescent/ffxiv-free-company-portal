import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sidebar = readFileSync(new URL("./app/components/ResponsiveSidebar.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("./app/page.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./app/globals.css", import.meta.url), "utf8");

test("desktop navigation scrolls independently from long page content", () => {
  assert.match(styles, /\.sidebar \{[\s\S]*height: 100dvh;[\s\S]*overflow: hidden;/);
  assert.match(styles, /\.side-nav \{[\s\S]*overflow-y: auto;[\s\S]*overscroll-behavior: contain;/);
  assert.match(styles, /\.side-nav \{[\s\S]*align-content: start;[\s\S]*grid-auto-rows: max-content;/);
  assert.match(styles, /\.sidebar-navigation \{[\s\S]*min-height: 0;/);
});

test("small screens use an accessible closable navigation drawer", () => {
  assert.match(page, /<ResponsiveSidebar/);
  assert.match(sidebar, /aria-controls="guild-sidebar"/);
  assert.match(sidebar, /aria-expanded=\{open\}/);
  assert.match(sidebar, /event\.key === "Escape"/);
  assert.match(sidebar, /event\.key !== "Tab"/);
  assert.match(sidebar, /main\.inert = true/);
  assert.match(sidebar, /Scroll for more/);
  assert.match(sidebar, /closest\("a"\)/);
  assert.match(styles, /\.sidebar\.mobile-open/);
  assert.match(styles, /\.mobile-menu-backdrop\.open/);
  assert.match(styles, /transform: translateX\(-105%\)/);
});
