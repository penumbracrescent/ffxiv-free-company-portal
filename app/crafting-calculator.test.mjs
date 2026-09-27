import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const nodeRequire=createRequire(import.meta.url);
function loadTypeScriptModule(file) { const source=fs.readFileSync(file,"utf8"); const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText; const module={exports:{}}; new Function("exports","require","module",javascript)(module.exports,nodeRequire,module); return module.exports; }

test("crafting calculator imports simulation-ready recipes and stat consumables", async () => {
  const worker = await read("../worker/worker.mjs");
  const schema = await read("./lib/crafting/schema.ts");
  assert.match(worker, /RecipeLevelTable/);
  assert.match(worker, /fetchCraftingConsumableBonuses/);
  assert.match(worker, /async function fetchCraftingItemFoodRows\(itemFoodIds\)/);
  assert.match(worker, /message\.includes\("404 Not Found"\)/);
  assert.match(worker, /Skipping missing XIVAPI ItemFood row/);
  assert.match(worker, /CRAFTING_CATALOG_SCHEMA_VERSION = 7/);
  assert.match(worker, /fetchCraftingConsumableItems/);
  assert.match(worker, /ItemAction\.Data\[0\]=48 ItemAction\.Data\[0\]=49/);
  assert.match(schema, /portal_crafting_consumables/);
  assert.match(schema, /is_collectable/);
  assert.match(schema, /portal_crafter_profiles/);
  assert.match(schema, /primary key \(discord_user_id, craft_job\)/);
});

test("calculator generates safe macros locally and suggests stat consumables", async () => {
  const component = await read("./app/components/CraftingMacroCalculator.tsx");
  const solver = await read("./lib/crafting/macro-solver.ts");
  const worker = await read("../worker/worker.mjs");
  const service = await read("./lib/crafting/service.ts");
  assert.match(component, /maximum collectability/i);
  assert.match(component, /Complete with maximum collectability/);
  assert.match(component, /Prioritize quickest completion/);
  assert.match(component, /Suggested boost/);
  assert.match(component, /Recommended consumables/);
  assert.match(component, /Food options/);
  assert.match(component, /Medicine options/);
  assert.match(component, /recommendedFoods\.map/);
  assert.match(component, /recommendedMedicines\.map/);
  assert.match(component, /profilesReady/);
  assert.match(component, /normalizeJob\(value\.recipe\.job\)/);
  assert.match(component, /Woodworking:"Carpenter"/);
  assert.match(worker, /Woodworking: "Carpenter"/);
  assert.match(worker, /craftJobAliases\[sourceCraftJob\]/);
  assert.match(worker, /const sourceCraftJob = getXivapiRelationshipName\(fields\.CraftType\)/);
  assert.match(service, /normalizeCraftJob\(recipe\.rows\[0\]\.job\)/);
  assert.match(component, /Calculation runs on your device/);
  assert.match(component, /generating\|\|/);
  assert.match(component, /suggestionDeadline/);
  assert.match(component, /solveCraftProgressive/);
  assert.match(component, /timeLimitMs:goal==="max"\?15000:5000/);
  assert.match(component, /Evaluating rotations/);
  assert.match(component, /action paths tested/);
  assert.match(component, /Continue searching for another 15 seconds/);
  assert.match(component, /Search exhausted/);
  assert.match(component, /beamWidth>=2500/);
  assert.match(component, /incumbentActions:previous\?\.actions/);
  assert.match(component, /Math\.min\(2500,700\+nextPass\*400\)/);
  assert.match(solver, /deadlineAt/);
  assert.match(solver, /beamWidth \|\| 700/);
  assert.match(solver, /await new Promise<void>/);
  assert.match(solver, /incumbentActions\?: string\[\]/);
  assert.match(solver, /incumbentSim\.progression >= craft\.progress/);
  assert.match(solver, /run\(true, 100, true\)/);
  assert.match(solver, /sim\.progression >= craft\.progress/);
  assert.match(solver, /sim\.quality > best\.sim\.quality/);
  assert.match(solver, /targetQuality === 0 \|\| sim\.quality >= targetQuality/);
  assert.match(solver, /searchStopReason = "exhausted"/);
  assert.match(solver, /i\+=15/);
  const safeList = solver.match(/const ACTION_NAMES = \[([^;]+)/s)?.[1] || "";
  for (const risky of ["RapidSynthesis","HastyTouch","DaringTouch","PreciseTouch","IntensiveSynthesis"]) assert.doesNotMatch(safeList, new RegExp(`\\"${risky}\\"`));
});

test("maximum-quality mode returns a completed craft even when absolute maximum quality is unreachable", () => {
  const root=path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/(?:([A-Za-z]:))/,"$1"));
  const { makeCraft, solveCraft }=loadTypeScriptModule(path.join(root,"lib","crafting","macro-solver.ts"));
  const craft=makeCraft({id:1,job:"Carpenter",recipeLevel:1,level:1,durability:40,difficulty:20,quality:10000,stars:0,canHq:true,expert:false,requiredControl:0,requiredCraftsmanship:0,requiredQuality:0,conditionsFlag:0,progressDivider:50,qualityDivider:50,progressModifier:100,qualityModifier:100});
  const result=solveCraft(craft,{level:100,craftsmanship:1000,control:1000,cp:0,specialist:false},craft.quality,Date.now()+1000);
  assert.equal(result?.success,true);
  assert.ok(result.progress>=craft.progress);
  assert.ok(result.quality<craft.quality);
});

test("maximum-collectability mode completes the Grade 4 Artisanal Skybuilders Icebox with the reported crafter stats", () => {
  const root=path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/(?:([A-Za-z]:))/,"$1"));
  const { makeCraft, solveCraft }=loadTypeScriptModule(path.join(root,"lib","crafting","macro-solver.ts"));
  const craft=makeCraft({id:34473,job:"Woodworking",recipeLevel:513,level:80,durability:55,difficulty:5059,quality:15474,stars:4,canHq:false,expert:true,requiredControl:2540,requiredCraftsmanship:2620,requiredQuality:0,conditionsFlag:483,progressDivider:140,qualityDivider:130,progressModifier:100,qualityModifier:100});
  const result=solveCraft(craft,{level:100,craftsmanship:4628,control:4221,cp:533,specialist:false},craft.quality,Date.now()+1500);
  assert.equal(result?.success,true);
  assert.ok(result.progress>=craft.progress);
  assert.ok(result.quality>350,"maximum-collectability mode should keep searching beyond the first completion-only rotation");
});

test("progressive search reports live work and preserves a completed result", async () => {
  const root=path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/(?:([A-Za-z]:))/,"$1"));
  const { makeCraft, solveCraftProgressive }=loadTypeScriptModule(path.join(root,"lib","crafting","macro-solver.ts"));
  const craft=makeCraft({id:2,job:"Carpenter",recipeLevel:1,level:1,durability:40,difficulty:20,quality:1000,stars:0,canHq:true,expert:false,requiredControl:0,requiredCraftsmanship:0,requiredQuality:0,conditionsFlag:0,progressDivider:50,qualityDivider:50,progressModifier:100,qualityModifier:100});
  const updates=[];
  const result=await solveCraftProgressive(craft,{level:100,craftsmanship:1000,control:1000,cp:180,specialist:false},craft.quality,{timeLimitMs:1000,maxDepth:20,beamWidth:100,onProgress:(progress)=>updates.push(progress)});
  assert.equal(result?.success,true);
  assert.ok(result.progress>=craft.progress);
  assert.equal(updates.at(-1)?.percent,100);
  assert.ok((updates.at(-1)?.explored||0)>0);
});

test("crafter profiles retain stable consumable item identifiers and disclose storage", async () => {
  const service = await read("./lib/crafting/service.ts");
  const profiles = await read("./app/api/crafting/profiles/route.ts");
  const guard = await read("./lib/crafting/request-guard.ts");
  const privacy = await read("./app/privacy/page.tsx");
  assert.match(service, /select i\.id::int, i\.name/);
  assert.match(profiles, /preferred_food_item_id/);
  assert.match(profiles, /consumable_type/);
  assert.match(guard, /fc_membership_status='current'/);
  assert.match(guard, /status: 429/);
  assert.match(privacy, /per-crafting-job level, Craftsmanship, Control, CP/);
  assert.match(privacy, /submitted stats are saved/);
});

test("calculators are grouped while workshop work stays directly accessible", async () => {
  const portal = await read("./app/page.tsx");
  const workshop = await read("./app/components/CraftingWorkshopView.tsx");
  assert.match(portal, /Tools & Calculators/);
  assert.match(portal, /view=calculators&calculator=crafting/);
  assert.match(portal, /Workshop Projects &amp; Craft Requests/);
  assert.match(portal, /activeView === "crafting"/);
  assert.doesNotMatch(workshop, /craftingTab: "workshop"/);
});

test("catalog search ranks partial names and reasonable spelling mistakes", () => {
  const root=path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/(?:([A-Za-z]:))/,"$1"));
  const { rankCraftingCatalogItems }=loadTypeScriptModule(path.join(root,"lib","crafting","catalog-search.ts"));
  const items=[
    {id:1,name:"Grade 4 Artisanal Skybuilders' Icebox",category:null,level:80,itemLevel:null},
    {id:2,name:"Rarefied Sykon Bavarois",category:null,level:90,itemLevel:null},
    {id:3,name:"Bronze Ingot",category:null,level:1,itemLevel:null}
  ];
  assert.equal(rankCraftingCatalogItems(items,"skybuildres icebox")[0]?.id,1);
  assert.equal(rankCraftingCatalogItems(items,"artisnal skybuilders icebo")[0]?.id,1);
  assert.equal(rankCraftingCatalogItems(items,"sykon bavaro")[0]?.id,2);
  assert.deepEqual(rankCraftingCatalogItems(items,"completely unrelated"),[]);
});

test("catalog search labels use the crafting job and recipe level", async () => {
  const service = await read("./lib/crafting/service.ts");
  assert.match(service, /r\.craft_job as category/);
  assert.match(service, /nullif\(r\.class_job_level, 0\)::int as level/);
  assert.match(service, /r\.preferred desc/);
});
