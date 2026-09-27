import type { BuiltInGuide, GuideReference } from "./guide-library";
import data from "./limited-job-data.json";

type Row = Record<string, unknown>;
const rows = (name: string) => (data as unknown as Record<string, Row[]>)[name] || [];
const text = (value: unknown) => String(value ?? "").replaceAll("|", " / ").replaceAll("\n", " ").trim() || "—";
const table = (headers: string[], body: unknown[][]) => `| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n${body.map((row) => `| ${row.map(text).join(" | ")} |`).join("\n")}`;
const range = (items: Row[], from: number, to: number) => items.slice(from - 1, to);
const official = (label: string, url: string): GuideReference => ({ label, url });
const blueReferences: GuideReference[] = [
  official("Official Blue Mage job guide", "https://na.finalfantasyxiv.com/jobguide/bluemage/"),
  { label: "Blue Mage reference", url: "https://ffxiv.consolegameswiki.com/wiki/Blue_Mage" },
  { label: "Blue Mage Log reference", url: String(data.sources.blueMageLog) },
  { label: "Masked Carnivale reference", url: String(data.sources.maskedCarnivale) },
];
const beastReferences: GuideReference[] = [
  official("Official Beastmaster job guide", "https://na.finalfantasyxiv.com/jobguide/beastmaster/"),
  official("Patch 7.56 notes", "https://na.finalfantasyxiv.com/lodestone/topics/detail/a8a526ad64db45c8ca8d1c7fdcce8a5eedaa18bc"),
  { label: "Beastmaster reference", url: String(data.sources.beastmasterJob) },
  { label: "Crucible reference", url: String(data.sources.crucibleGuide) },
];
const common = { expansion: "Multiple", audience: "Limited jobs", imageUrl: "/guides/field-operations.svg", verifiedPatch: data.verifiedPatch, verifiedOn: data.verifiedOn };

function actionTable(items: Row[]) {
  return table(["Action", "Level", "Type", "MP", "Cast / recast", "Range / radius", "Complete effect"], items.map((entry) => [entry.number ? `${entry.number}. ${entry.name}` : entry.name, entry.level ?? entry.acquired, entry.type, entry.mp, `${text(entry.cast)} / ${text(entry.recast)}`, entry.rangeRadius, entry.description]));
}
function achievementTable(items: Row[]) {
  return table(["Achievement", "Points", "Requirement", "Reward", "Patch"], items.map((entry) => [entry.name, entry.points, entry.task, entry.reward, entry.patch]));
}
function questTable(items: Row[]) {
  return table(["Level", "Quest", "Starting NPC and coordinates", "Prerequisite / gate", "Unlocks", "Rewards"], items.map((entry) => [entry.level, entry.title, `${text(entry.giver)} — ${text(entry.location)} (X:${text(entry.x)}, Y:${text(entry.y)})`, [entry.requirements, entry.prerequisite].filter(Boolean).map(text).join(" / "), entry.unlocks, entry.rewards]));
}
function article(slug: string, parentSlug: string, category: string, title: string, summary: string, order: number, content: string, references: GuideReference[], level = "1–100"): BuiltInGuide {
  return { ...common, slug, parentSlug, type: "article", category, title, summary, level, tags: [category.toLowerCase(), "complete reference", "limited jobs"], order, content, references };
}

const blueActions = rows("blueMageActions");
const blueLog = rows("blueMageLogDuties");
const carnivale = rows("maskedCarnivaleStages");
const blueAchievements = rows("blueMageAchievements");
const beastAchievements = rows("beastmasterAchievements");
const encounters = rows("crucibleEncounters");

const blueActionGuides = [[1, 40], [41, 80], [81, 124]].map(([from, to], index) => article(
  `blue-mage-action-encyclopedia-${String(from).padStart(3, "0")}-${String(to).padStart(3, "0")}`,
  "blue-mage", "Blue Mage", `Blue Magic Action Encyclopedia: ${from}–${to}`,
  `Exact MP cost, timing, range, and complete in-game effect text for Blue Magic spells ${from} through ${to}.`, 32 + index,
  `## How to use this encyclopedia
This is the mechanical companion to the acquisition spellbook. Use it to compare potency, targeting, MP cost, cast and recast time, range, radius, status effects, duration, and restrictions before building a 24-action set. The numbered entries match the Blue Magic Spellbook.

${actionTable(range(blueActions, from, to))}

## Loadout check
- [ ] Confirm the action works on the intended target and level sync.
- [ ] Check whether the effect shares a recast timer with another action.
- [ ] Reserve enough MP for healing, mitigation, or Diamondback.
- [ ] Pair physical and magical burst actions with the correct buffs.
- [ ] Replace redundant utility with the encounter-specific interrupt, cleanse, movement, or elemental action.`,
  blueReferences,
));

const blueQuestGuide = article("blue-mage-exact-quest-directory", "blue-mage", "Blue Mage", "Blue Mage Exact Quest Directory", "Every Blue Mage quest with the starting NPC, coordinates, requirements, prerequisites, unlocks, and rewards.", 13,
  `## Complete quest chain
The table is generated from the current quest records rather than a hand-written milestone summary. Read both the requirement and prerequisite columns: later quests can require a particular learned spell, a Masked Carnivale clear, or completion of the preceding chapter.

${questTable(rows("blueMageQuests"))}

## Before accepting the next quest
- [ ] Learn the specifically named spell in the gate column.
- [ ] Complete the required Carnivale stage when one is named.
- [ ] Open job-gear coffers while on Blue Mage and compare equipment before discarding it.
- [ ] Revisit Wayward Gaheel Ja after spell-count achievements for available Whalaqee Totems.
- [ ] Keep the journal active when a quest temporarily moves away from the usual Ul'dah hub.`, blueReferences, "1–80");

const blueSystemGuide = article("blue-mage-role-actions-traits-and-totems", "blue-mage", "Blue Mage", "Blue Mage Role Actions, Traits, and Totems", "The complete supporting action set, passive traits, and every Whalaqee Totem requirement.", 36,
  `## Magical ranged role actions
${actionTable(rows("blueMageRoleActions"))}

## Passive traits
${table(["Trait", "Level", "Effect"], rows("blueMageTraits").map((entry) => [entry.name, entry.level, entry.effect]))}

## Whalaqee Totems
Totem actions are claimed from **Wayward Gaheel Ja** in Ul'dah - Steps of Thal after satisfying the associated achievement or progression requirement.

${table(["Totem", "Spell", "Achievement", "Requirement"], rows("blueMageTotems").map((entry) => [entry.totem, entry.spell, entry.achievement, entry.requirements]))}

## Collection routine
- [ ] Claim newly eligible totems after every spell-count milestone.
- [ ] Put role actions and Blue Magic on separate mental checklists; role actions do not consume Blue Magic spellbook numbers.
- [ ] Recheck traits at each level cap because passive upgrades can change potency and survivability.
- [ ] Save role-specific action sets only after confirming Aetherial Mimicry and encounter utility.`, blueReferences);

const blueLogGuides = [[1, 41], [42, 82], [83, 122]].map(([from, to], index) => article(
  `blue-mage-log-directory-${String(from).padStart(3, "0")}-${String(to).padStart(3, "0")}`,
  "blue-mage", "Blue Mage Log", `Blue Mage Log Duty Directory: ${from}–${to}`,
  `Duties ${from} through ${to} from the complete 122-entry Blue Mage Log, including level, minimum item level, and sync.`, 82 + index,
  `## Directory
Every row is an eligible Log duty. Category letters preserve the grouping used by the source table. Form a qualifying party of Blue Mages, check undersized and level-sync requirements, and verify the weekly target icon in the live Log before committing a group.

${table(["No.", "Category", "Duty", "Level", "Minimum item level", "Item-level sync"], range(blueLog, from, to).map((entry, offset) => [from + offset, entry.category, entry.duty, entry.level, entry.itemLevel, entry.itemLevelSync]))}

## Party check
- [ ] Confirm every participant is on Blue Mage before entry.
- [ ] Assign tank, healer, resurrection, interrupt, and cleanse duties.
- [ ] Read the weekly target conditions in game; weekly marks change independently of this permanent directory.
- [ ] Use the listed sync to choose gear and materia rather than assuming the level cap is enough.
- [ ] Record a first clear before optimizing speed or achievement conditions.`, blueReferences, "50–80",
));

const carnivaleGuide = article("blue-mage-carnivale-complete-index", "blue-mage", "Masked Carnivale", "Masked Carnivale Complete Stage Index", "All 32 stages with acts, enemies, target times, and fixed gil, Allied Seal, and tomestone rewards.", 59,
  `## Complete index
Use this factual index beside the two stage-strategy chapters. Standard and ideal times support weekly bonus planning; the act columns show the encounter structure before entry. Weekly targets and bonus conditions rotate and must still be checked in game.

${table(["Stage", "Level", "Standard / ideal", "Act 1", "Act 2", "Act 3", "Gil", "Seals", "Tomestones"], carnivale.map((entry) => [`${entry.number}. ${entry.name}`, entry.level, `${text(entry.standardTime)} / ${text(entry.idealTime)}`, entry.act1, entry.act2, entry.act3, entry.gil, entry.seals, entry.tomestones]))}

## Entry checklist
- [ ] Read every act before locking the action set.
- [ ] Carry the required interrupt, cleanse, movement, damage type, and healing tools.
- [ ] Do not assume acts create checkpoints; prepare to repeat the complete stage.
- [ ] Check the current weekly target and bonus objectives in the Masked Carnivale interface.
- [ ] Use a safe first clear before pursuing time, no-damage, elemental, or limited-action bonuses.`, blueReferences, "50–80");

const blueAchievementGuides = [[1, 40], [41, 79]].map(([from, to], index) => article(
  `blue-mage-achievements-${String(from).padStart(3, "0")}-${String(to).padStart(3, "0")}`,
  "blue-mage", "Blue Mage", `Blue Mage Achievements and Rewards: ${from}–${to}`,
  `Achievement requirements, points, rewards, and originating patch for entries ${from} through ${to}.`, 90 + index,
  `## Achievement directory
Use the requirement column as the source of truth for the clear condition. Reward “—” means the achievement grants points or progression without a separately listed item or title. Verify synced-party, party-size, and Echo restrictions in the live achievement before entry.

${achievementTable(range(blueAchievements, from, to))}

## Completion check
- [ ] Pin the achievement in game and read every restriction.
- [ ] Confirm the correct duty difficulty and level sync.
- [ ] Assign all required Blue Mage roles before entry.
- [ ] Claim title, item, or currency rewards after completion.
- [ ] Record progression locally only after the achievement appears in game.`, blueReferences,
));

const beastQuestGuide = article("beastmaster-exact-quest-directory", "beastmaster", "Beastmaster", "Beastmaster Exact Quest Directory", "Every Beastmaster quest with the starting NPC, coordinates, requirements, prerequisites, unlocks, and rewards.", 13,
  `## Complete quest chain
The chain begins in New Gridania and advances the job systems, level caps, gear, duties, and familiar access. Use the prerequisite and unlock columns together so a missing feature can be traced to the exact quest gate.

${questTable(rows("beastmasterQuests"))}

## Progression check
- [ ] Complete the preceding quest and any named scenario requirement.
- [ ] Open job-gear coffers while on Beastmaster.
- [ ] Review new familiar and action access after every capstone quest.
- [ ] Rebuild Battlehorn teams when a new slot, gourd, or instinct becomes available.
- [ ] Verify live journal destinations when a quest moves away from the normal hub.`, beastReferences, "1–100");

const beastActionsGuide = article("beastmaster-actions-traits-and-instincts", "beastmaster", "Beastmaster", "Beastmaster Actions, Traits, and Instincts", "Every player action, instinct action, duty action, passive trait, and documented instinct combo.", 32,
  `## Beastmaster actions
${actionTable(rows("beastmasterJobActions"))}

## Instinct actions
${actionTable(rows("beastmasterInstinctActions"))}

## Duty actions
${actionTable(rows("beastmasterDutyActions"))}

## Passive traits
${table(["Trait", "Level", "Effect"], rows("beastmasterTraits").map((entry) => [entry.name, entry.level, entry.effect]))}

## Instinctual combinations
${table(["Combination", "Sequence", "Grants", "Multiplier"], rows("beastmasterInstinctCombos").map((entry) => [entry.name, entry.sequence, entry.grants, entry.multiplier]))}

## Build check
- [ ] Match kinship and instinct conditions to the selected familiars.
- [ ] Keep player actions and familiar actions distinct when planning recasts.
- [ ] Confirm combo order before entering synced content.
- [ ] Save a defensive team as well as a damage-focused team.`, beastReferences);

const boardPaths: Record<string, string> = {
  "First Board of the Unbroken": "Left at the first fork, then right at the second.",
  "Second Board of the Unbroken": "Right at the first fork, then right again.",
  "Third Board of the Unbroken": "Right at all three forks.",
  "First Master's Board of the Unbroken": "Right, then left, then right.",
  "Second Master's Board of the Unbroken": "Right, then left, then right, then straight.",
};
const crucibleGuide = article("beastmaster-crucible-encounter-index", "beastmaster", "Beastmaster Crucible", "Crucible of the Unbroken Encounter Index", "All 44 encounters grouped by board, with observed ability names and safe-path directions.", 62,
  `## Board requirements and pathing
The Crucible syncs by board: First Board at level 30/rank 5; Second at level 40/rank 10; Third at level 50/item level 100/rank 15; First Master's at level 50/item level 120/rank 20; and Second Master's at level 50/item level 135/rank 25. Paths below are concise navigation references, not substitutes for reading live telegraphs.

${Object.keys(boardPaths).map((board) => `## ${board}
**Safe path:** ${boardPaths[board]}

${table(["Encounter", "Observed abilities"], encounters.filter((entry) => entry.board === board).map((entry) => [entry.encounter, Array.isArray(entry.abilities) ? entry.abilities.join(", ") : entry.abilities]))}`).join("\n\n")}

## Before entering
- [ ] Meet the board's Beastmaster level, bestiary rank, and item-level requirement.
- [ ] Build three active Battlehorns plus reserves around encounter kin and mechanics.
- [ ] Carry recovery and mitigation instead of relying only on a safe path.
- [ ] Treat every named ability as a cue to learn its telegraph on the first pull.`, beastReferences, "30–50");

const beastAchievementGuides = [[1, 25], [26, 49]].map(([from, to], index) => article(
  `beastmaster-achievements-${String(from).padStart(3, "0")}-${String(to).padStart(3, "0")}`,
  "beastmaster", "Beastmaster", `Beastmaster Achievements and Rewards: ${from}–${to}`,
  `Achievement requirements, points, rewards, and originating patch for entries ${from} through ${to}.`, 90 + index,
  `## Achievement directory
This directory combines leveling, bestiary, Crucible, collection, and challenge achievements. Reward “—” means no separately listed item or title. Confirm the live achievement text before a restricted run because party, sync, or familiar conditions can be more specific than the name.

${achievementTable(range(beastAchievements, from, to))}

## Completion check
- [ ] Pin the target achievement in game.
- [ ] Confirm board, rank, item level, and familiar restrictions.
- [ ] Record bestiary and Crucible progress after the achievement updates.
- [ ] Claim any title, item, or currency reward.
- [ ] Keep a separate team preset for achievements with unusual kin or action constraints.`, beastReferences,
));

export const LIMITED_JOB_REFERENCE_GUIDES: BuiltInGuide[] = [
  blueQuestGuide,
  ...blueActionGuides,
  blueSystemGuide,
  ...blueLogGuides,
  carnivaleGuide,
  ...blueAchievementGuides,
  beastQuestGuide,
  beastActionsGuide,
  crucibleGuide,
  ...beastAchievementGuides,
];
