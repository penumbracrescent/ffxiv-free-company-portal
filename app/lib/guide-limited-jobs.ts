import data from "./limited-job-data.json";
import type { BuiltInGuide, GuideReference } from "./guide-library";
import { LIMITED_JOB_EXTRA_GUIDES } from "./guide-limited-jobs-extra";
import { LIMITED_JOB_REFERENCE_GUIDES } from "./guide-limited-jobs-reference";

type BlueSpell = {
  number: number;
  name: string;
  rank: string;
  sourceType: string;
  minimumLevel: number;
  worldLevel: string;
  dutyLevel: string;
  acquisition: string;
};

type Familiar = {
  number: number;
  name: string;
  tamedFrom: string;
  location: string;
  minimumLevel: number;
  gourd: string;
};

type FamiliarAction = {
  number: number;
  name: string;
  kin: string;
  autoAttack: string;
  temperedRelease: string;
  temperedTarget: string;
  trick: string;
  trickTarget: string;
  borrow: string;
};

const verifiedPatch = data.verifiedPatch;
const verifiedOn = data.verifiedOn;
const spells = data.blueMageSpells as BlueSpell[];
const familiars = data.beastmasterFamiliars as Familiar[];
const familiarActions = data.beastmasterActions as FamiliarAction[];

const official = (label: string, url: string): GuideReference => ({ label, url });
const blueReferences: GuideReference[] = [
  official("Official Blue Mage job guide", "https://na.finalfantasyxiv.com/jobguide/bluemage/"),
  official("Official Blue Mage play guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/bluemage/"),
  { label: "Blue Magic Spellbook acquisition table", url: data.sources.blueMage },
  { label: "Masked Carnivale stage reference", url: "https://ffxiv.consolegameswiki.com/wiki/Masked_Carnivale" },
  { label: "Blue Mage level 1–80 routes", url: "https://mage.blue/getting-started/leveling/" },
  { label: "Blue Mage role and rotation reference", url: "https://www.icy-veins.com/ffxiv/blue-mage-pve-dps-rotation-openers-abilities" },
];
const beastReferences: GuideReference[] = [
  official("Official Beastmaster job guide", "https://na.finalfantasyxiv.com/jobguide/beastmaster/"),
  official("Patch 7.56 notes", "https://na.finalfantasyxiv.com/lodestone/topics/detail/a8a526ad64db45c8ca8d1c7fdcce8a5eedaa18bc"),
  { label: "Master's Bestiary acquisition table", url: data.sources.beastmaster },
  { label: "Crucible board and system reference", url: "https://www.icy-veins.com/ffxiv/beastmaster-crucible-of-the-unbroken" },
];

function cell(value: string | number) {
  return String(value || "—").replaceAll("|", " / ").replaceAll("\n", " ");
}

function spellTable(from: number, to: number) {
  const rows = spells
    .filter((spell) => spell.number >= from && spell.number <= to)
    .map((spell) => `| ${spell.number} | ${cell(spell.name)} | ${cell(spell.rank)} | ${cell(spell.sourceType)} | ${spell.minimumLevel} | ${cell(spell.acquisition)} |`)
    .join("\n");
  return `| No. | Spell | Rank | Source type | Min. level | Enemy, location, duty, raid, trial, or unlock |\n| --- | --- | --- | --- | --- | --- |\n${rows}`;
}

function familiarTable(from: number, to: number) {
  const rows = familiars
    .filter((familiar) => familiar.number >= from && familiar.number <= to)
    .map((familiar) => `| ${familiar.number} | ${cell(familiar.name)} | ${cell(familiar.tamedFrom)} | ${cell(familiar.location)} | ${familiar.minimumLevel} | ${cell(familiar.gourd)} |`)
    .join("\n");
  return `| No. | Familiar | Tame from | Zone coordinates or duty location | Min. level | Gourd or quest alternative |\n| --- | --- | --- | --- | --- | --- |\n${rows}`;
}

function familiarActionTable(from: number, to: number) {
  const rows = familiarActions
    .filter((familiar) => familiar.number >= from && familiar.number <= to)
    .map((familiar) => `| ${familiar.number} | ${cell(familiar.name)} | ${cell(familiar.kin)} | ${cell(familiar.autoAttack)} | ${cell(familiar.temperedRelease)} (${cell(familiar.temperedTarget)}) | ${cell(familiar.trick)} (${cell(familiar.trickTarget)}) | ${cell(familiar.borrow)} |`)
    .join("\n");
  return `| No. | Familiar | Kin | Auto-attack | Tempered Release | Trick | Borrow |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows}`;
}

const shared = {
  expansion: "Multiple",
  audience: "Limited jobs",
  imageUrl: "/guides/field-operations.svg",
  verifiedPatch,
  verifiedOn,
};

export const LIMITED_JOB_GUIDES: BuiltInGuide[] = [
  {
    ...shared,
    slug: "limited-jobs",
    parentSlug: null,
    type: "collection",
    category: "Limited Jobs",
    title: "Limited Jobs",
    summary: "Complete Blue Mage and Beastmaster guides with unlocks, progression, combat systems, spell sources, familiar locations, coordinates, duties, trials, and raids.",
    level: "1–80",
    tags: ["limited jobs", "blue mage", "beastmaster", "spellbook", "bestiary"],
    order: 58,
  },
  {
    ...shared,
    slug: "blue-mage",
    parentSlug: "limited-jobs",
    type: "collection",
    category: "Blue Mage",
    title: "Blue Mage",
    summary: "Unlock and level Blue Mage, learn every spell, build role-based sets, and progress through the Masked Carnivale and Blue Mage Log.",
    level: "1–80",
    tags: ["blue mage", "blu", "spells", "masked carnivale", "blue mage log"],
    order: 10,
  },
  {
    ...shared,
    slug: "blue-mage-starting-and-leveling",
    parentSlug: "blue-mage",
    type: "article",
    category: "Blue Mage",
    title: "Starting and Leveling Blue Mage",
    summary: "Unlock requirements, limited-job restrictions, fast leveling priorities, spell-learning rules, and a practical first route.",
    level: "1–80",
    tags: ["blue mage", "unlock", "leveling", "learning spells"],
    order: 10,
    references: blueReferences,
    content: `## Unlock Blue Mage
- [ ] Reach level 50 with any Disciple of War or Magic.
- [ ] Complete the level-50 main scenario quest **The Ultimate Weapon**.
- [ ] Accept **Out of the Blue** from the Zealous Yellowjacket in Limsa Lominsa Lower Decks (X:9.9, Y:11.0).

Blue Mage is a limited job with a current level cap of **80**. It cannot enter content through the normal Duty Finder matchmaking queue, cannot progress the main scenario, and receives its combat identity from learned blue magic rather than a conventional job-action ladder. Premade and unrestricted parties are the normal way to farm duty spells.

## How spell learning works
The enemy must visibly use the desired action, and the Blue Mage must then be present when that enemy is defeated. Merely seeing the action is not enough. Learning is not based on landing the killing blow, and being incapacitated when the target dies can prevent the learn. Synced duty clears provide the dependable route for difficult dungeon, trial, and raid spells; unrestricted clears can be faster but do not offer the same certainty.

## Why overworld enemies are the leveling route
Blue Mage receives a very large experience bonus from ordinary overworld enemies. That bonus does **not** apply to FATE or levequest enemies. Level-80 enemies provide the useful upper end of this bonus; enemies above level 80 award sharply reduced experience to Blue Mage. Duties are valuable for spells and progression, but ordinary overworld enemies are normally the fastest way to reach the level cap.

## Power leveling with a high-level helper
This is the fastest and simplest route when another player is available.

1. **Do not form a normal party with the high-level helper.** A large party level difference reduces the Blue Mage's experience. The helper stays nearby but outside the Blue Mage's party.
2. The Blue Mage attacks first and establishes enmity. **Flying Sardine** is the preferred instant ranged tag and is learned from Apkallu in Eastern La Noscea (X:27, Y:35). Water Cannon works until Flying Sardine is available.
3. After the tag lands, the helper kills that enemy. The Blue Mage receives the kill experience despite not landing the final blow.
4. Stay alive and close enough to receive experience. The helper should shield or heal when necessary and avoid killing an untagged enemy.
5. Repeat against dense groups of level-80 enemies until level 80. Do not move to level-81-or-higher enemies expecting more experience.

### Suggested helper routes
| Route | Enemies and loop |
| --- | --- |
| Thavnair | Akyaali Crab and Hamsa from approximately (X:12.4, Y:26.7) toward (X:13.8, Y:29.9), then the nearby group from approximately (X:20.4, Y:26.3) toward (X:14.5, Y:25.5) |
| Labyrinthos | Caribou and Limascabra around (X:13.3, Y:7.1) → (X:17.5, Y:5.0) → (X:17.3, Y:7.0) |

Several Blue Mages can level together in their own party when they are close in level, while the max-level helper remains outside that party. If their levels differ substantially, raise the lowest Blue Mage first before grouping them. Dense spawns and safe repetition matter more than forcing a specific route when it is crowded.

## Solo power leveling in The Tempest
The northern area of **The Tempest around (X:27, Y:5)** contains level-79 Deep-sea Leeches and Clionids. A Clionid will consume a nearby leech; if the Blue Mage tagged the leech first, the Blue Mage receives the experience.

1. Use Flying Sardine or Water Cannon to tag a Deep-sea Leech. Sleep can hold the leech while positioning.
2. Bring the tagged leech beside a Clionid and let the Clionid consume it.
3. Do not feed three leeches to one Clionid. After three, it becomes fully enlarged and gains an attack capable of killing the player immediately.
4. At higher levels, **Mighty Guard** and **Aetheric Mimicry: Tank** make accidental contact safer.

This technique can level Blue Mage without a second player, but it requires Shadowbringers zone access and careful positioning. It is particularly practical for the 70–80 stretch. Death, another player taking the kill, or mishandling a Clionid can make it less consistent than helper leveling.

## Conventional solo leveling
Players who want to fight normally should kill ordinary overworld enemies around their current level. Use a companion chocobo for healing or damage and keep casting gear current.

### Spell milestones
- **Levels 1–20:** Use Water Cannon and other early open-world attacks. Fight one manageable enemy at a time until a safer toolkit is available.
- **Around level 20:** Learn **1000 Needles** from Sabotender Bailaor in Southern Thanalan (X:16, Y:15). It deals a fixed 1,000 damage divided among targets, so isolate one enemy and combine it with Sleep or Swiftcast while the long cast is still efficient.
- **Around level 40:** Learn **The Ram's Voice** from Cutter's Cry. Its Deep Freeze makes normal enemy packs safer and replaces 1000 Needles once regular spells deal damage faster.
- **Around level 50:** Learn **Choco Meteor** from Courser Chocobo in the Dravanian Forelands (X:34, Y:28). With the companion chocobo summoned, it becomes the primary repeatable overworld attack through level 80.
- **Later levels:** The Ram's Voice followed by Ultravibration instantly defeats susceptible enemies at or below the Blue Mage's level, but Ultravibration's cooldown prevents it from replacing the normal route completely.

### Solo zone progression
| Levels | Suggested zones |
| --- | --- |
| 1–15 | Western Thanalan |
| 15–20 | Western La Noscea |
| 20–30 | South Shroud |
| 30–35 | Eastern La Noscea |
| 35–40 | Coerthas Central Highlands |
| 40–45 | East Shroud |
| 45–50 | Mor Dhona |
| 50–55 | Dravanian Forelands or Churning Mists |
| 55–60 | Sea of Clouds or Azys Lla |
| 60–65 | The Peaks or Yanxia |
| 65–70 | Yanxia or The Lochs |
| 70–75 | Amh Araeng or Kholusia |
| 75–80 | Rak'tika Greatwood or The Tempest |

The zones are starting points, not mandatory camps. Move when enemies become slow, dangerous, crowded, or significantly below the Blue Mage's level. Use vendor or crafted casting gear below 50, then Ironworks, Shire, and Scaevan caster gear at the corresponding level caps.

## Where solo duties fit
**Basic Instinct** improves Blue Mage when entering eligible duties alone or with fewer players than intended. It is useful for acquiring spells and clearing older content, but dungeon grinding is not the primary level 1–80 experience route because it does not receive the same overworld-enemy bonus. Use solo duties when they also advance a spell, quest, or log goal.

## Leveling checklist
- [ ] Equip the Blue Mage weapon and a complete set of level-appropriate casting gear.
- [ ] Choose helper leveling, the Tempest environmental route, or conventional solo combat before traveling.
- [ ] Learn Flying Sardine for safe tagging and keep the high-level helper outside the party.
- [ ] Stop at milestones to learn attacks, healing, defense, interruption, and role-setting spells instead of reaching 80 with only the starter spell.
- [ ] Complete job quests as they become available; several require a particular spell or Carnivale milestone.
- [ ] Unlock Whalaqee Totem spells by meeting their achievement, spell-count, or content conditions and speaking with Wayward Gaheel Ja in Ul'dah - Steps of Thal.

## Before farming duties
Create a saved spell set for general farming and leave room for the required learn. Blue Mage can equip up to **24 active spells** and save multiple sets. Confirm the target enemy and whether the spell comes from a boss phase, add, mechanic, or alternate encounter before entering. The three spellbook directory pages list all 124 spells and preserve every named dungeon, trial, raid, FATE, coordinate, Carnivale stage, and totem source from the maintained acquisition catalog.

Continue with [[blue-mage-spellbook-001-040|Spells 1–40]], [[blue-mage-spellbook-041-080|Spells 41–80]], and [[blue-mage-spellbook-081-124|Spells 81–124]].`,
  },
  {
    ...shared,
    slug: "blue-mage-spellbook-001-040",
    parentSlug: "blue-mage",
    type: "article",
    category: "Blue Mage Spellbook",
    title: "Blue Magic Spellbook: Spells 1–40",
    summary: "Exact enemies, coordinates, dungeons, trials, raids, Carnivale stages, and unlock methods for spells 1 through 40.",
    level: "1–60",
    tags: ["blue mage", "spell locations", "dungeons", "trials", "raids", "coordinates"],
    order: 20,
    references: blueReferences,
    content: `## How to use this directory
Filter first by spell number or name, then use the source type and acquisition column to plan the route. When several sources are listed, choose the source your group can repeat most quickly. Open-world entries include zone coordinates when the maintained source provides them; duty entries name the dungeon, trial, raid, guildhest, or Carnivale stage.

${spellTable(1, 40)}

## Farm checklist
- [ ] Confirm the target used the spell before defeating it.
- [ ] Stay alive through the enemy's defeat.
- [ ] Prefer a synced premade clear when the learn must be guaranteed.
- [ ] Mark the spell learned in the in-game Blue Magic Spellbook before moving to the next source.

Continue with [[blue-mage-spellbook-041-080|Spells 41–80]].`,
  },
  {
    ...shared,
    slug: "blue-mage-spellbook-041-080",
    parentSlug: "blue-mage",
    type: "article",
    category: "Blue Mage Spellbook",
    title: "Blue Magic Spellbook: Spells 41–80",
    summary: "Exact acquisition sources for the middle spellbook, including overworld coordinates and named battle content.",
    level: "1–70",
    tags: ["blue mage", "spell locations", "dungeons", "trials", "raids", "coordinates"],
    order: 30,
    references: blueReferences,
    content: `## Spell directory
Entries retain alternate sources so a party can choose between an open-world enemy, a normal duty, a raid or trial, and a Masked Carnivale source when more than one is available. Required job-quest and Whalaqee Totem entries are labeled in the same acquisition column.

${spellTable(41, 80)}

## Route notes
- [ ] Group spells from the same duty before entering so one clear can cover several targets.
- [ ] For an enemy action tied to a mechanic, delay damage until the cast has visibly completed.
- [ ] Recheck the spellbook after every clear; do not assume an unrestricted clear learned the action.
- [ ] Keep one defensive, one healing, and one interrupt option equipped while farming unfamiliar encounters.

Continue with [[blue-mage-spellbook-081-124|Spells 81–124]].`,
  },
  {
    ...shared,
    slug: "blue-mage-spellbook-081-124",
    parentSlug: "blue-mage",
    type: "article",
    category: "Blue Mage Spellbook",
    title: "Blue Magic Spellbook: Spells 81–124",
    summary: "Endgame Blue Magic acquisition sources through level 80, with duties, raids, trials, zones, and special unlocks.",
    level: "60–80",
    tags: ["blue mage", "spell locations", "shadowbringers", "raids", "trials"],
    order: 40,
    references: blueReferences,
    content: `## High-level spell directory
Later spells increasingly come from bosses, raids, trials, and mechanics that are easier to coordinate with a full Blue Mage group. Read the acquisition entry before queueing and decide who will control damage so the required action is not skipped.

${spellTable(81, 124)}

## Completion check
- [ ] Collect every job-quest requirement before returning to the trainer.
- [ ] Claim available Whalaqee Totems after meeting their conditions.
- [ ] Save a general solo set, a dungeon-damage set, and role-specific tank or healer sets.
- [ ] Use the completed spellbook to work through the Blue Mage Log and weekly Masked Carnivale targets.

The source list is a location directory, not a promise that every listed encounter is equally efficient. Prefer synced organized runs for rare or mechanically awkward duty spells.`,
  },
  {
    ...shared,
    slug: "blue-mage-battle-content",
    parentSlug: "blue-mage",
    type: "article",
    category: "Blue Mage",
    title: "Blue Mage Loadouts, Carnivale, and Log",
    summary: "Build functional spell sets and approach the Masked Carnivale, weekly targets, and Blue Mage Log without wasting slots.",
    level: "50–80",
    tags: ["blue mage", "loadouts", "masked carnivale", "blue mage log", "roles"],
    order: 50,
    references: blueReferences,
    content: `## Build sets around a job
Blue Mage has only 24 active slots, so a useful set needs a purpose. Start with a dependable global-cooldown attack, area damage, healing, mitigation, crowd control or interruption, and movement. Add encounter-specific elemental or status tools only after the core survives the content. Save separate sets instead of rebuilding one bar every time.

### Party roles
- **Tank:** use the tank role-setting spell, threat tools, mitigation, and self-sustain. Coordinate invulnerability or heavy mitigation before raidwide and tankbuster mechanics.
- **Healer:** use the healer role-setting spell, a repeatable heal, an area heal, revival support where available, and enough damage to contribute between recovery windows.
- **Damage:** combine efficient filler with off-global attacks and planned burst windows. Avoid loading the bar with many long-recast spells that cannot all fit into the same encounter plan.

## Masked Carnivale
The Carnivale is a set of staged solo encounters unlocked through Blue Mage progression. Each stage tests spell choice as much as execution: elemental weaknesses, reflected damage, interrupts, positioning, cleanses, and instant-failure mechanics matter. Read the stage objectives before building a set, then save that set if the stage is part of a rotating weekly target.

- [ ] Clear the stage normally before chasing bonus objectives.
- [ ] Carry the exact control, cleanse, movement, or elemental answer the stage expects.
- [ ] Complete weekly targets for the additional rewards after the base clear is stable.
- [ ] Use the spellbook pages in this collection when a stage requires an action you have not learned.

## Blue Mage Log
The log tracks eligible duties completed with a qualifying Blue Mage party. Treat it as organized group content: confirm role coverage, required spells, level sync, and encounter-specific mechanics before entry. A duty being easy unsynced does not mean its log entry or spell learn should be attempted under the same conditions.

## Safe preparation checklist
- [ ] Repair gear and use level-appropriate accessories.
- [ ] Agree who is tanking and healing before the pull.
- [ ] Confirm every player has the one required mechanic spell, not merely a high-damage bar.
- [ ] Keep progression and challenge achievements separate; clear first, then optimize the special condition.`,
  },
  {
    ...shared,
    slug: "beastmaster",
    parentSlug: "limited-jobs",
    type: "collection",
    category: "Beastmaster",
    title: "Beastmaster",
    summary: "Unlock and level Beastmaster, tame every familiar, understand battlehorn teams, and prepare for the Crucible.",
    level: "1–50",
    tags: ["beastmaster", "bst", "familiars", "master's bestiary", "crucible"],
    order: 20,
  },
  {
    ...shared,
    slug: "beastmaster-starting-and-capture",
    parentSlug: "beastmaster",
    type: "article",
    category: "Beastmaster",
    title: "Starting, Leveling, and Capturing as Beastmaster",
    summary: "Unlock requirements, familiar capture rules, bestiary progression, gourd alternatives, and a practical leveling route.",
    level: "1–50",
    tags: ["beastmaster", "unlock", "capture", "leveling", "familiars"],
    order: 10,
    references: beastReferences,
    content: `## Unlock Beastmaster
- [ ] Reach level 50 with any Disciple of War or Magic.
- [ ] Complete the prerequisite main scenario progression required by the limited-job quest.
- [ ] Accept **Strangers in the Wood** in New Gridania (X:11.8, Y:13.6).

Beastmaster is a limited job with a current level cap of **50**. Progression revolves around collecting familiars in the **Master's Bestiary**, placing them into battlehorns, and choosing actions and affinities that fit the encounter. It does not use normal Duty Finder matchmaking in the same way as a standard combat job.

## Capturing a familiar
Use **Capture** on the eligible target under the conditions shown by the bestiary and job interface. Target selection, health, level, and encounter state matter; if a capture fails, verify the familiar entry rather than repeatedly defeating the wrong variant. The bestiary pages in this collection name the exact enemy and provide the zone coordinates, dungeon section, boss, trial, or quest-gourd alternative for all 50 current familiars.

## Practical leveling route
- [ ] Follow the job quests; they unlock core systems and provide several gourd alternatives.
- [ ] Capture nearby open-world familiars as your level reaches their minimum requirement.
- [ ] Replace weak or redundant teams with familiars that add a new damage type, affinity, combo, healing, defense, or control option.
- [ ] Enter dungeons with a premade or unrestricted group when the target familiar is tied to a boss or a particular section.
- [ ] Revisit the bestiary after quest milestones because some gourds require the level-30, level-40, or level-50 Beastmaster quest.

## Gourds and duty targets
A listed gourd is an alternate acquisition route or quest-linked reward for that familiar; it does not erase the value of learning where the corresponding creature appears. Duty entries identify the relevant boss or section whenever the maintained catalog supplies it. Open-world entries include coordinates. Continue with [[beastmaster-bestiary-001-025|Familiars 1–25]] and [[beastmaster-bestiary-026-050|Familiars 26–50]].`,
  },
  {
    ...shared,
    slug: "beastmaster-bestiary-001-025",
    parentSlug: "beastmaster",
    type: "article",
    category: "Master's Bestiary",
    title: "Master's Bestiary: Familiars 1–25",
    summary: "Exact targets, coordinates, duty sections, minimum levels, and gourd alternatives for the first half of the bestiary.",
    level: "1–30",
    tags: ["beastmaster", "bestiary", "coordinates", "dungeons", "familiars"],
    order: 20,
    references: beastReferences,
    content: `## Acquisition directory
Use the familiar number to match the in-game bestiary. **Tame from** identifies the exact enemy variant; **Location** gives the zone and coordinates or the named duty section. If a gourd is listed, read its quest condition before assuming it is immediately available.

${familiarTable(1, 25)}

## Capture checklist
- [ ] Match the exact enemy name, not only the creature family.
- [ ] Meet the minimum Beastmaster level shown for the entry.
- [ ] For a duty target, keep the target alive long enough to complete the capture attempt.
- [ ] Check job quests for any listed gourd alternative.
- [ ] Confirm the familiar appears in the Master's Bestiary before leaving the area.

Continue with [[beastmaster-bestiary-026-050|Familiars 26–50]].`,
  },
  {
    ...shared,
    slug: "beastmaster-bestiary-026-050",
    parentSlug: "beastmaster",
    type: "article",
    category: "Master's Bestiary",
    title: "Master's Bestiary: Familiars 26–50",
    summary: "Higher-level familiar sources across open-world zones, dungeons, bosses, trials, and Beastmaster quest rewards.",
    level: "30–50",
    tags: ["beastmaster", "bestiary", "coordinates", "dungeons", "trials", "familiars"],
    order: 30,
    references: beastReferences,
    content: `## Higher-level acquisition directory
This half of the bestiary contains more duty and quest-gated targets. Organize dungeon captures by duty and bring a premade group when normal matchmaking is unavailable to the limited job. For open-world entries, travel to the listed coordinate and verify the exact enemy name before attempting Capture.

${familiarTable(26, 50)}

## Completion route
- [ ] Finish the level-30 quest **Into the Crucible** before relying on its gourd unlocks.
- [ ] Finish the level-40 quest **Gobsmacked** before relying on its gourd unlocks.
- [ ] Finish the level-50 quest **A Beastmaster's Path** before relying on its gourd unlocks.
- [ ] Group targets by dungeon or region to reduce repeated travel and setup.
- [ ] Build at least one balanced battlehorn from captured familiars before entering challenge content.

The table records the maintained acquisition catalog as reviewed for patch 7.56; the in-game bestiary and quest UI remain authoritative if a later patch changes a spawn or requirement.`,
  },
  {
    ...shared,
    slug: "beastmaster-combat-and-crucible",
    parentSlug: "beastmaster",
    type: "article",
    category: "Beastmaster",
    title: "Beastmaster Combat, Battlehorns, and the Crucible",
    summary: "Build familiar teams around affinities and combos, manage commands, and prepare reliable boards for Crucible challenges.",
    level: "30–50",
    tags: ["beastmaster", "battlehorn", "crucible", "affinity", "combos"],
    order: 40,
    references: beastReferences,
    content: `## Build a battlehorn with a plan
A strong battlehorn is not simply the four highest-level familiars. Review each familiar's role, action behavior, damage type, affinity, and combo relationship. Build one dependable general team first, then specialized teams for encounters that punish a particular range, element, movement pattern, or defensive weakness.

## Command priorities
- Keep the familiar positioned where its action can connect without placing it in avoidable danger.
- Use combo actions in the intended order; a powerful follow-up loses much of its value when its setup never lands.
- Preserve defensive and recovery tools for scripted pressure instead of spending every command immediately.
- Replace a familiar whose affinity is consistently disadvantaged rather than forcing the same team through every board.

## The Crucible
The Crucible is Beastmaster's dedicated challenge content. Boards test collection depth and team construction as well as execution. Treat a failed attempt as information: identify whether the failure came from damage type, affinity, positioning, survival, or a missed combo, then change only the part of the battlehorn that addresses that problem.

### Preparation loop
- [ ] Complete the relevant Beastmaster job quests and capture the familiars needed for the planned team.
- [ ] Read the board conditions before choosing a battlehorn.
- [ ] Include a stable damage plan and at least one answer to the board's main pressure.
- [ ] Practice command timing before optimizing for a faster clear or ranking.
- [ ] Save successful team compositions by board so later attempts are reproducible.

## Collection before optimization
The two Master's Bestiary pages in this collection are the acquisition foundation. When a recommended strategy calls for a familiar you do not own, use its numbered row to find the exact enemy, coordinate, dungeon section, boss, trial, or gourd unlock. Expanding the collection usually creates a cleaner solution than over-leveling a poorly matched team.`,
  },
  ...LIMITED_JOB_EXTRA_GUIDES,
  ...LIMITED_JOB_REFERENCE_GUIDES,
];
