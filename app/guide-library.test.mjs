import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const appRoot = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/(?:([A-Za-z]:))/, "$1"));

function loadTypeScriptModule(file, localRequire) {
  const source = fs.readFileSync(file, "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "require", "module", "__filename", "__dirname", javascript)(
    module.exports,
    localRequire,
    module,
    file,
    path.dirname(file),
  );
  return module.exports;
}

function loadGuides() {
  const expansionPath = path.join(appRoot, "lib", "guide-expansions.ts");
  const expansionModule = loadTypeScriptModule(expansionPath, () => {
    throw new Error("guide-expansions.ts has an unexpected runtime import");
  });
  const titleFamiliesPath = path.join(appRoot, "lib", "guide-title-families.ts");
  const titleFamiliesModule = loadTypeScriptModule(titleFamiliesPath, () => {
    throw new Error("guide-title-families.ts has an unexpected runtime import");
  });
  const collectionRewardsPath = path.join(appRoot, "lib", "guide-collection-rewards.ts");
  const collectionRewardsModule = loadTypeScriptModule(collectionRewardsPath, () => {
    throw new Error("guide-collection-rewards.ts has an unexpected runtime import");
  });
  const limitedJobData = JSON.parse(fs.readFileSync(path.join(appRoot, "lib", "limited-job-data.json"), "utf8"));
  const limitedJobsExtraPath = path.join(appRoot, "lib", "guide-limited-jobs-extra.ts");
  const limitedJobsExtraModule = loadTypeScriptModule(limitedJobsExtraPath, (id) => {
    if (id === "./limited-job-data.json") return { default: limitedJobData, ...limitedJobData };
    throw new Error(`guide-limited-jobs-extra.ts has an unexpected runtime import: ${id}`);
  });
  const limitedJobsReferencePath = path.join(appRoot, "lib", "guide-limited-jobs-reference.ts");
  const limitedJobsReferenceModule = loadTypeScriptModule(limitedJobsReferencePath, (id) => {
    if (id === "./limited-job-data.json") return { default: limitedJobData, ...limitedJobData };
    throw new Error(`guide-limited-jobs-reference.ts has an unexpected runtime import: ${id}`);
  });
  const limitedJobsPath = path.join(appRoot, "lib", "guide-limited-jobs.ts");
  const limitedJobsModule = loadTypeScriptModule(limitedJobsPath, (id) => {
    if (id === "./limited-job-data.json") return { default: limitedJobData, ...limitedJobData };
    if (id === "./guide-limited-jobs-extra") return limitedJobsExtraModule;
    if (id === "./guide-limited-jobs-reference") return limitedJobsReferenceModule;
    throw new Error(`guide-limited-jobs.ts has an unexpected runtime import: ${id}`);
  });
  const fieldOperationData = JSON.parse(fs.readFileSync(path.join(appRoot, "lib", "field-operation-data.json"), "utf8"));
  const fieldOperationsPath = path.join(appRoot, "lib", "guide-field-operations.ts");
  const fieldOperationsModule = loadTypeScriptModule(fieldOperationsPath, (id) => {
    if (id === "./field-operation-data.json") return { default: fieldOperationData, ...fieldOperationData };
    throw new Error("guide-field-operations.ts has an unexpected runtime import: " + id);
  });
  const variantCriterionPath = path.join(appRoot, "lib", "guide-variant-criterion.ts");
  const variantCriterionModule = loadTypeScriptModule(variantCriterionPath, () => {
    throw new Error("guide-variant-criterion.ts has an unexpected runtime import");
  });
  const gatheringAchievementData = JSON.parse(fs.readFileSync(path.join(appRoot, "lib", "gathering-achievement-data.json"), "utf8"));
  const gatheringAchievementPath = path.join(appRoot, "lib", "guide-gathering-achievement-tools.ts");
  const gatheringAchievementModule = loadTypeScriptModule(gatheringAchievementPath, (id) => {
    if (id === "./gathering-achievement-data.json") return { default: gatheringAchievementData, ...gatheringAchievementData };
    throw new Error(`guide-gathering-achievement-tools.ts has an unexpected runtime import: ${id}`);
  });
  const libraryPath = path.join(appRoot, "lib", "guide-library.ts");
  const libraryModule = loadTypeScriptModule(libraryPath, (id) => {
    if (id === "./guide-expansions") return expansionModule;
    if (id === "./guide-title-families") return titleFamiliesModule;
    if (id === "./guide-collection-rewards") return collectionRewardsModule;
    if (id === "./guide-limited-jobs") return limitedJobsModule;
    if (id === "./guide-field-operations") return fieldOperationsModule;
    if (id === "./guide-variant-criterion") return variantCriterionModule;
    if (id === "./guide-gathering-achievement-tools") return gatheringAchievementModule;
    throw new Error(`guide-library.ts has an unexpected runtime import: ${id}`);
  });
  return libraryModule.BUILT_IN_GUIDES;
}

test("gathering achievement tools include complete routes and interactive fish and node directories", () => {
  const guides = loadGuides();
  const data = JSON.parse(fs.readFileSync(path.join(appRoot, "lib", "gathering-achievement-data.json"), "utf8"));
  const required = [
    "gathering-achievement-tools",
    "gathering-achievement-tools-start",
    "gathering-live-planner-help",
    "fisher-achievement-tool-route",
    "fisher-ironworks-luminary-rods",
    "ocean-fishing-discovery-route",
    "gathering-folklore-unlock-guide",
    "miner-achievement-tool-route",
    "botanist-achievement-tool-route",
    "legacy-gatherer-scrip-tools",
  ];
  for (const slug of required) assert.ok(guides.some((guide) => guide.slug === slug), `${slug} is missing`);
  assert.ok(data.fish.length >= 1730, "fish directory must cover the current title threshold");
  assert.ok(data.miner.length >= 280, "miner directory must cover the current title threshold");
  assert.ok(data.botanist.length >= 420, "botanist directory must cover the current title threshold");
  assert.ok(data.fish.some((entry) => entry.time.includes("ET")), "fish directory lacks timed windows");
  assert.ok(data.fish.some((entry) => entry.weather !== "Any weather"), "fish directory lacks weather conditions");
  assert.ok(data.fish.some((entry) => entry.requirements.includes("Intuition")), "fish directory lacks intuition prerequisites");
  assert.ok(data.fish.some((entry) => entry.routeTier === "Spearfishing"), "fish directory lacks spearfishing");
  assert.ok(data.miner.some((entry) => entry.routeTier === "Timed folklore"), "miner directory lacks timed folklore nodes");
  assert.ok(data.botanist.some((entry) => entry.routeTier === "Hidden item"), "botanist directory lacks hidden items");
  assert.ok(data.fish.every((entry) => entry.patch && entry.dataStatus && entry.nearestTravel && entry.mapLink && entry.live), "fish directory lacks provenance, travel, map, or live-planner metadata");
  assert.ok(data.fish.some((entry) => entry.baitSource.startsWith("Buy:") || entry.baitSource.startsWith("Craft:")), "fish directory lacks tackle acquisition sources");
  assert.ok(data.miner.some((entry) => entry.folklore.includes("Buy:")), "miner directory lacks exact folklore acquisition sources");
  assert.ok(data.botanist.every((entry) => entry.live && entry.mapLink && entry.patch), "botanist directory lacks live, map, or patch metadata");

  const content = (slug) => guides.find((guide) => guide.slug === slug)?.content || "";
  assert.match(content("gathering-achievement-tools-start"), /780 unique fish[\s\S]*Blessed Tackleking's Rod/);
  assert.match(content("gathering-achievement-tools-start"), /1,140 unique fish[\s\S]*Resplendent Tacklefiend's Rod/);
  assert.match(content("miner-achievement-tool-route"), /220.*Resplendent Minefiend's Pickaxe/);
  assert.match(content("botanist-achievement-tool-route"), /340.*Resplendent Fieldfiend's Hatchet/);
  assert.match(content("fisher-ironworks-luminary-rods"), /106 different varieties of big fish/);
  assert.match(content("legacy-gatherer-scrip-tools"), /original item-level-300|unaugmented[\s\S]*no longer obtainable/i);
  assert.match(content("gathering-live-planner-help"), /Available now/i);
  assert.match(content("gathering-live-planner-help"), /previous-weather/i);
  assert.match(content("gathering-live-planner-help"), /optimized missing route/i);
  assert.match(content("ocean-fishing-discovery-route"), /Day, Sunset, and Night[\s\S]*spectral current/i);
  assert.match(content("gathering-folklore-unlock-guide"), /exact tome item[\s\S]*Luck of the Mountaineer/i);

  const fishDirectory = guides.filter((guide) => guide.slug.startsWith("fisher-discovery-directory-")).map((guide) => guide.content || "").join("\n");
  const minerDirectory = guides.filter((guide) => guide.slug.startsWith("miner-discovery-directory-")).map((guide) => guide.content || "").join("\n");
  const botanistDirectory = guides.filter((guide) => guide.slug.startsWith("botanist-discovery-directory-")).map((guide) => guide.content || "").join("\n");
  assert.equal((fishDirectory.match(/^\| \d+ \|/gm) || []).length, data.fish.length);
  assert.equal((minerDirectory.match(/^\| \d+ \|/gm) || []).length, data.miner.length);
  assert.equal((botanistDirectory.match(/^\| \d+ \|/gm) || []).length, data.botanist.length);

  const component = fs.readFileSync(path.join(appRoot, "app", "components", "GuideLibrary.tsx"), "utf8");
  assert.match(component, /fisher\|miner\|botanist/);
  assert.match(component, /Route tier/);
  assert.match(component, /guide-directory-progress/);
  assert.match(component, /formatEorzeaClock/);
  assert.match(component, /weatherAt/);
  assert.match(component, /Available now/);
  assert.match(component, /Copy missing route \(optimized\)/);
});

test("variant and criterion guides cover every released family, route, mount, and achievement mode", () => {
  const guides = loadGuides();
  const required = [
    "variant-criterion-sildihn-subterrane",
    "variant-criterion-mount-rokkon",
    "variant-criterion-aloalo-island",
    "variant-criterion-merchants-tale",
  ];
  for (const slug of required) assert.ok(guides.some((guide) => guide.slug === slug), `${slug} is missing`);
  const content = (slug) => guides.find((guide) => guide.slug === slug)?.content || "";
  for (let route = 1; route <= 12; route += 1) {
    for (const slug of required) assert.match(content(slug), new RegExp(`\\| ${route} \\|`));
  }
  assert.match(content(required[3]), /\| 13 \| The Eye of the Beholder/);
  assert.match(content(required[0]), /Silkie[\s\S]*Sil'dihn Throne[\s\S]*Infamy of Sil'dih/);
  assert.match(content(required[1]), /Burabura Chochin[\s\S]*Shishioji[\s\S]*Ascendant Ascetic/);
  assert.match(content(required[2]), /Spectral Statice[\s\S]*Quaqua[\s\S]*Force of Nature/);
  assert.match(content(required[3]), /Royal Magicked Carpet[\s\S]*Genie of the Lamp[\s\S]*Literary Cannon/);
  assert.match(content(required[3]), /no separate Criterion \(Savage\) duty/i);
  for (const slug of required) {
    assert.match(content(slug), /### Mobile route card/);
    assert.match(content(slug), /## Variant combat playbook/);
    assert.match(content(slug), /Party Finder template/);
    assert.match(content(slug), /Complete reward catalog/);
    assert.match(content(slug), /personal/i);
  }
  assert.match(content(required[0]), /Item level 575[\s\S]*24-minute combat enrage[\s\S]*25 clears/);
  assert.match(content(required[1]), /Item level 605[\s\S]*Okuri Chochin[\s\S]*25 clears/);
  assert.match(content(required[2]), /Exquisite weapon[\s\S]*Elevated Ester[\s\S]*25 Criterion clears/);
  assert.match(content(required[3]), /item level 760[\s\S]*1 personal Brass per boss[\s\S]*25 clears/);
});

test("limited-job guides include every current spell and familiar acquisition", () => {
  const guides = loadGuides();
  const data = JSON.parse(fs.readFileSync(path.join(appRoot, "lib", "limited-job-data.json"), "utf8"));
  assert.equal(data.blueMageSpells.length, 124);
  assert.equal(data.beastmasterFamiliars.length, 50);
  assert.equal(data.beastmasterActions.length, 50);
  assert.deepEqual(data.blueMageSpells.map((entry) => entry.number), Array.from({ length: 124 }, (_, index) => index + 1));
  assert.deepEqual(data.beastmasterFamiliars.map((entry) => entry.number), Array.from({ length: 50 }, (_, index) => index + 1));

  const limitedSlugs = [
    "limited-jobs",
    "blue-mage",
    "blue-mage-starting-and-leveling",
    "blue-mage-spellbook-001-040",
    "blue-mage-spellbook-041-080",
    "blue-mage-spellbook-081-124",
    "blue-mage-battle-content",
    "blue-mage-quest-checklist",
    "blue-mage-loadouts-and-combos",
    "blue-mage-gear-and-stats",
    "blue-mage-carnivale-001-016",
    "blue-mage-carnivale-017-032",
    "blue-mage-log-and-raids",
    "beastmaster",
    "beastmaster-starting-and-capture",
    "beastmaster-bestiary-001-025",
    "beastmaster-bestiary-026-050",
    "beastmaster-combat-and-crucible",
    "beastmaster-quest-checklist",
    "beastmaster-familiar-actions-001-025",
    "beastmaster-familiar-actions-026-050",
    "beastmaster-battlehorn-teams",
    "beastmaster-crucible-boards",
    "beastmaster-gear-and-upgrades",
    "limited-job-collection-routes",
  ];
  for (const slug of limitedSlugs) assert.ok(guides.some((guide) => guide.slug === slug), `${slug} is missing`);

  const spellDirectory = guides.filter((guide) => guide.slug.startsWith("blue-mage-spellbook-"))
    .map((guide) => guide.content).join("\n");
  const bestiary = guides.filter((guide) => guide.slug.startsWith("beastmaster-bestiary-"))
    .map((guide) => guide.content).join("\n");
  for (const spell of data.blueMageSpells) {
    assert.match(spellDirectory, new RegExp(`\\| ${spell.number} \\|`));
    assert.ok(spell.acquisition.trim(), `spell ${spell.number} has no acquisition source`);
  }
  for (const familiar of data.beastmasterFamiliars) {
    assert.match(bestiary, new RegExp(`\\| ${familiar.number} \\|`));
    assert.ok(familiar.location.trim() || familiar.gourd.trim(), `familiar ${familiar.number} has no acquisition source`);
  }
  assert.match(spellDirectory, /Dungeon|Raid|Trial/);
  assert.match(bestiary, /\( X: \d+, Y: \d+\)/);
  assert.match(bestiary, /Copperbell Mines/);
  assert.doesNotMatch(guides.filter((guide) => limitedSlugs.includes(guide.slug)).map((guide) => guide.content || "").join("\n"), /Discord|webhook|automation/i);
});

test("limited-job directories are interactive and strategy chapters cover every requested system", () => {
  const guides = loadGuides();
  const component = fs.readFileSync(path.join(appRoot, "app", "components", "GuideLibrary.tsx"), "utf8");
  const styles = fs.readFileSync(path.join(appRoot, "app", "globals.css"), "utf8");
  assert.match(component, /guide-directory-progress/);
  assert.match(component, /Missing only/);
  assert.match(component, /Maximum level/);
  assert.match(component, /Mark shown complete/);
  assert.match(component, /Progress profile/);
  assert.match(component, /Export/);
  assert.match(component, /Import/);
  assert.match(component, /Reset profile/);
  assert.match(component, /Copy coordinates/);
  assert.match(component, /Copy missing route/);
  assert.match(styles, /guide-directory-tools/);

  const content = (slug) => guides.find((guide) => guide.slug === slug)?.content || "";
  const carnivale = `${content("blue-mage-carnivale-001-016")}\n${content("blue-mage-carnivale-017-032")}`;
  for (let stage = 1; stage <= 32; stage += 1) assert.match(carnivale, new RegExp(`\\| ${stage} (?:—|-)`), `Carnivale stage ${stage} is missing`);
  assert.match(content("blue-mage-loadouts-and-combos"), /Damage template/);
  assert.match(content("blue-mage-loadouts-and-combos"), /Tank template/);
  assert.match(content("blue-mage-loadouts-and-combos"), /Healer templates/);
  assert.match(content("blue-mage-log-and-raids"), /one tank mimic, two healer mimics, and five damage mimics/i);
  assert.match(content("blue-mage-starting-and-leveling"), /Do not form a normal party with the high-level helper/);
  assert.match(content("blue-mage-starting-and-leveling"), /Flying Sardine/);
  assert.match(content("blue-mage-starting-and-leveling"), /Solo power leveling in The Tempest/);
  assert.match(content("blue-mage-starting-and-leveling"), /1000 Needles/);
  assert.match(content("blue-mage-starting-and-leveling"), /75–80 \| Rak'tika Greatwood or The Tempest/);
  assert.match(content("blue-mage-starting-and-leveling"), /Basic Instinct/);
  assert.match(content("beastmaster-crucible-boards"), /Second Master's Board/);
  assert.match(content("beastmaster-battlehorn-teams"), /Three active horns/);
  assert.match(content("beastmaster-gear-and-upgrades"), /Kornago Merchant in Central Shroud \(X:21\.9, Y:22\.6\)/);
  assert.match(content("beastmaster-gear-and-upgrades"), /416 Bright Remnants total/);
  assert.match(content("beastmaster-gear-and-upgrades"), /Final Coil of Bahamut . Turn 1/);
  assert.match(content("beastmaster-gear-and-upgrades"), /Coil is not a prerequisite for the Beastmaster job set/);
  assert.match(content("limited-job-collection-routes"), /Pharos Sirius/);
  assert.match(content("limited-job-collection-routes"), /Cutter's Cry/);
});

test("limited-job reference library contains the complete structured directories", () => {
  const guides = loadGuides();
  const data = JSON.parse(fs.readFileSync(path.join(appRoot, "lib", "limited-job-data.json"), "utf8"));
  assert.equal(data.blueMageActions.length, 124);
  assert.equal(data.blueMageLogDuties.length, 122);
  assert.equal(data.maskedCarnivaleStages.length, 32);
  assert.equal(data.blueMageQuests.length, 26);
  assert.equal(data.blueMageAchievements.length, 79);
  assert.equal(data.beastmasterQuests.length, 13);
  assert.equal(data.beastmasterJobActions.length, 24);
  assert.equal(data.beastmasterInstinctActions.length, 8);
  assert.equal(data.beastmasterDutyActions.length, 2);
  assert.equal(data.beastmasterTraits.length, 14);
  assert.equal(data.beastmasterInstinctCombos.length, 7);
  assert.equal(data.beastmasterAchievements.length, 49);
  assert.equal(data.crucibleEncounters.length, 44);

  const content = (slug) => guides.find((guide) => guide.slug === slug)?.content || "";
  assert.match(content("blue-mage-exact-quest-directory"), /Blood Drain/);
  assert.match(content("blue-mage-exact-quest-directory"), /Anything Gogo/);
  assert.match(content("blue-mage-action-encyclopedia-081-124"), /Winged Reprobation/);
  assert.match(content("blue-mage-role-actions-traits-and-totems"), /Whalaqee/);
  assert.match(content("blue-mage-log-directory-083-122"), /Item-level sync/);
  assert.match(content("blue-mage-carnivale-complete-index"), /ideal/i);
  assert.match(content("beastmaster-actions-traits-and-instincts"), /Instinctual combinations/);
  assert.match(content("beastmaster-crucible-encounter-index"), /Enemy #/);
  assert.doesNotMatch(guides.map((guide) => guide.content || "").join("\n"), /Requested-spell progression check/);
});

test("field-operation guides include complete action data and separate large-duty chapters", () => {
  const guides = loadGuides();
  const data = JSON.parse(fs.readFileSync(path.join(appRoot, "lib", "field-operation-data.json"), "utf8"));
  assert.equal(data.logosActions.length, 56);
  assert.equal(data.logograms.length, 9);
  assert.equal(data.lostActions.length, 99);
  assert.equal(data.forgottenFragments.length, 36);

  const required = [
    "eureka-logos-action-directory-001-028",
    "eureka-logos-action-directory-029-056",
    "eureka-logogram-acquisition-directory",
    "bozja-lost-action-directory-001-050",
    "bozja-lost-action-directory-051-099",
    "bozja-forgotten-fragment-directory",
    "bozja-castrum-lacus-litore-complete",
    "bozja-delubrum-reginae-complete",
    "bozja-dalriada-complete",
    "occult-forked-tower-blood-complete",
    "occult-forked-tower-magic-complete",
    "occult-forked-tower-magic-extreme-complete",
  ];
  for (const slug of required) assert.ok(guides.some((guide) => guide.slug === slug), slug + " is missing");

  const logos = guides.filter((guide) => guide.slug.startsWith("eureka-logos-action-directory-")).map((guide) => guide.content).join("\n");
  const lost = guides.filter((guide) => guide.slug.startsWith("bozja-lost-action-directory-")).map((guide) => guide.content).join("\n");
  for (const entry of data.logosActions) assert.match(logos, new RegExp("\\| " + entry.index + " \\|"));
  for (const entry of data.lostActions) assert.match(lost, new RegExp("\\| " + entry.index + " \\|"));

  const baldesion = guides.find((guide) => guide.slug === "eureka-baldesion-arsenal")?.content || "";
  assert.match(baldesion, /Art and Owain/);
  assert.match(baldesion, /Absolute Virtue/);
  assert.match(baldesion, /Proto Ozma/);
  assert.match(baldesion, /Expedition Support/);
  assert.match(baldesion, /Perception L/);
});

test("public guide tree is complete and internally self-contained", () => {
  const guides = loadGuides();
  const slugs = new Set(guides.map((guide) => guide.slug));
  assert.equal(slugs.size, guides.length, "guide slugs must be unique");

  for (const guide of guides) {
    assert.match(guide.verifiedPatch, /^\d+\.\d+/, `${guide.slug} has no maintenance patch`);
    assert.match(guide.verifiedOn, /^\d{4}-\d{2}-\d{2}$/, `${guide.slug} has no review date`);
    if (guide.parentSlug) {
      assert.ok(slugs.has(guide.parentSlug), `${guide.slug} has missing parent ${guide.parentSlug}`);
    }

    if (guide.imageUrl) {
      const imagePath = path.join(appRoot, "public", guide.imageUrl.replace(/^\//, ""));
      assert.ok(fs.existsSync(imagePath), `${guide.slug} has missing image ${guide.imageUrl}`);
    }

    for (const match of (guide.content || "").matchAll(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g)) {
      assert.ok(slugs.has(match[1]), `${guide.slug} links to missing guide ${match[1]}`);
    }

    if (guide.type === "article") {
      assert.ok((guide.content || "").trim().length >= 600, `${guide.slug} is not a full guide`);
      assert.doesNotMatch(`${guide.slug} ${guide.title}`, /overview/i, `${guide.slug} is an overview placeholder`);
    }
  }

  for (const collection of guides.filter((guide) => guide.type === "collection")) {
    assert.ok(
      guides.some((guide) => guide.parentSlug === collection.slug),
      `${collection.slug} is an empty collection`,
    );
  }
});

test("guide-specific legal and source notices ship with the release", () => {
  const releaseRoot = path.dirname(appRoot);
  const thirdParty = fs.readFileSync(path.join(releaseRoot, "THIRD_PARTY_NOTICES.md"), "utf8");
  const legalNotice = fs.readFileSync(path.join(releaseRoot, "LEGAL_NOTICE.md"), "utf8");
  const legalPage = fs.readFileSync(path.join(appRoot, "app", "legal", "page.tsx"), "utf8");

  for (const source of [thirdParty, legalNotice, legalPage]) {
    assert.match(source, /built-in guide/i);
    assert.match(source, /independently written/i);
    assert.match(source, /GNU Free Documentation\s+License/i);
    assert.match(source, /Square Enix images/i);
  }

  assert.match(thirdParty, /ffxiv\.consolegameswiki\.com/);
  assert.match(thirdParty, /fdl-1\.2\.html/);
  assert.match(thirdParty, /FFXIV Collect collection catalog/);
  assert.match(thirdParty, /Lodestone achievement ownership/);
  assert.match(thirdParty, /public API availability does not/i);
  for (const source of [thirdParty, legalNotice, legalPage]) {
    assert.match(source, /non-commercial/i);
    assert.match(source, /completion timestamps/i);
    assert.match(source, /last-known/i);
    assert.match(source, /retention/i);
  }
});

test("guides are public while installation resources retain explicit visibility", () => {
  const page = fs.readFileSync(path.join(appRoot, "app", "page.tsx"), "utf8");
  const component = fs.readFileSync(path.join(appRoot, "app", "components", "GuideLibrary.tsx"), "utf8");
  const guides = loadGuides();
  assert.match(page, /const publicNavItems[\s\S]*Guides & Resources/);
  assert.match(page, /visibility_mode text not null default 'members'/);
  assert.match(page, /visibility_mode = 'public' or \$1::boolean/);
  assert.match(page, /name="guideVisibility"/);
  assert.match(component, /visibility_mode: "public" \| "members"/);
  assert.ok(guides.some((guide) => guide.slug === "treasure-map-identification"));
});

test("the current Square Enix policy is applied across the full release", () => {
  const releaseRoot = path.dirname(appRoot);
  const legalPage = fs.readFileSync(path.join(appRoot, "app", "legal", "page.tsx"), "utf8");
  const legalNotice = fs.readFileSync(path.join(releaseRoot, "LEGAL_NOTICE.md"), "utf8");
  const thirdParty = fs.readFileSync(path.join(releaseRoot, "THIRD_PARTY_NOTICES.md"), "utf8");
  const layout = fs.readFileSync(path.join(appRoot, "app", "layout.tsx"), "utf8");
  for (const source of [legalPage, legalNotice, thirdParty]) {
    assert.match(source, /September 16, 2026/);
    assert.match(source, /North American/i);
    assert.match(source, /harass/i);
    assert.match(source, /physical/i);
    assert.match(source, /treasure-map/i);
  }
  assert.match(layout, /FINAL FANTASY XIV materials are © SQUARE ENIX/);
});

test("every ARR society guide carries the complete Call of the Wild finale", () => {
  const guides = loadGuides();
  const arrSocieties = [
    "society-amaljaa",
    "society-sylph",
    "society-kobold",
    "society-sahagin",
    "society-ixal",
  ];
  const chain = [
    "Call of the Wild",
    "Little Sylphs Lost",
    "Clutching at Straws",
    "Digging for Answers",
    "Rattled in Ehcatl",
    "Ash Not What Your Brotherhood Can Do for You",
    "Friends Forever",
  ];

  for (const slug of arrSocieties) {
    const guide = guides.find((candidate) => candidate.slug === slug);
    assert.ok(guide, `${slug} is missing`);
    for (const quest of chain) assert.match(guide.content, new RegExp(quest.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(guide.content, /level 50 Disciple of War or Magic/);
    assert.match(guide.content, /In Pursuit of the Past/);
    assert.match(guide.content, /Sable Death Mask/);
    assert.match(guide.content, /The Negotiator/);
    assert.match(guide.content, /Wind-up Founder/);
    assert.match(guide.content, /Wind-up Dezul Qualan/);
    assert.ok(guide.references.some((reference) => reference.url.includes("finalfantasyxiv.com/lodestone/topics/detail/")));
  }
});

test("every curated achievement guide resolves to a public built-in guide", () => {
  const guides = loadGuides();
  const slugs = new Set(guides.map((guide) => guide.slug));
  const links = fs.readFileSync(path.join(appRoot, "lib", "achievement-guide-links.ts"), "utf8");
  const mappedSlugs = [...links.matchAll(/link\("([^"]+)"/g)].map((match) => match[1]);
  assert.ok(mappedSlugs.length >= 3);
  for (const slug of mappedSlugs) assert.ok(slugs.has(slug), `${slug} is not a public guide`);
});

test("every collection source guide route resolves to a public built-in guide", () => {
  const guides = loadGuides();
  const slugs = new Set(guides.map((guide) => guide.slug));
  const links = fs.readFileSync(path.join(appRoot, "lib", "collection-source-guide-links.ts"), "utf8");
  const mappedSlugs = [...links.matchAll(/detailed\("([^"]+)"/g)].map((match) => match[1]);
  assert.ok(mappedSlugs.length >= 15);
  for (const slug of mappedSlugs) assert.ok(slugs.has(slug), `${slug} is not a public guide`);
});
