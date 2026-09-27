import data from "./gathering-achievement-data.json";
import type { BuiltInGuide } from "./guide-library";

const refs = {
  achievements: { label: "Official Lodestone — Achievements", url: "https://na.finalfantasyxiv.com/lodestone/playguide/db/achievement/" },
  gathering: { label: "Official gathering guide", url: "https://na.finalfantasyxiv.com/crafting_gathering_guide/miner/" },
  teamcraft: { label: "Teamcraft open data", url: "https://github.com/ffxiv-teamcraft/ffxiv-teamcraft" },
  fishTracker: { label: "FF14 Fish Tracker open data", url: "https://github.com/icykoneko/ff14-fish-tracker-app" },
  oceanSchedule: { label: "Ocean Fishing live route schedule", url: "https://ffxiv.pf-n.co/ocean-fishing" },
};

const escapeCell = (value: unknown) => String(value ?? "—").replaceAll("|", "/").replace(/\s+/g, " ").trim() || "—";
const table = (headers: string[], rows: unknown[][]) => [
  `| ${headers.join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
].join("\n");
const chunk = <T,>(values: T[], size: number) => Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size));
const liveCell = (value: unknown) => `LIVE:${encodeURIComponent(JSON.stringify(value))}`;

const commonLogRules = `## What counts—and what does not
- The achievement counter is for **unique discoveries**, not total catches or total swings. Repeating an entry does not add another point.
- The in-game **Fishing Log** or **Gathering Log** discovery mark and the matching achievement counter are the authority. This guide's checkboxes are a planning aid and do not read character data.
- Miner/Botanist: normal class-exclusive log items, folklore items, and aetherial-reduction collectables count. Prime and Sublime variants count separately.
- Miner/Botanist: shared elemental shards, crystals, clusters, pigments, ordinary collectable turn-ins, and sidequest-only items do not count. The directory removes items shared by both jobs.
- Fisher: rod fishing, spearfishing, big fish, and eligible Ocean Fishing discoveries can advance the unique-fish series. A single fish caught at multiple holes still counts once.

## Before starting
- [ ] Open **Character → Achievements → Crafting & Gathering** and pin the relevant I Caught That or I Found That achievement.
- [ ] Open the job's log and compare its discovered marks with this directory. Start by marking everything already complete.
- [ ] Unlock every expansion zone you intend to use, flight where available, and the current folklore books for the later timed entries.
- [ ] Carry cordial/hi-cordial supplies. Fishers should keep versatile lures plus the listed specialist bait; Miner/Botanist should have enough GP to reveal hidden items.

## Efficient order
1. Clear **always-available** entries by expansion and zone. This supplies most of every tool threshold with almost no waiting.
2. Clear hidden items while visiting the same nodes. Use **Luck of the Mountaineer** or **Luck of the Pioneer** when the target does not appear.
3. Make a timed-node or fishing-window alarm list from the remaining directory rows. Work permanent entries between windows.
4. Leave weather chains, intuition fish, big fish, and awkward Ocean Fishing routes for last unless a window is currently open.
5. Recheck the achievement counter after every batch; never grind an entry whose discovery mark is already filled.

> Times in the directories are **Eorzea Time (ET)**. Windows that cross midnight are intentional. Weather-transition fish list both current and previous weather when known.`;

const overview: BuiltInGuide = {
  slug: "gathering-achievement-tools",
  parentSlug: "relic-tools",
  type: "collection",
  category: "Gathering Achievement Tools",
  title: "Fisher, Miner & Botanist Finishing Tools",
  summary: "Complete non-relic tool routes for Luminary, Ironworks, Blessed, and Resplendent gathering rewards, with searchable fish and node directories.",
  expansion: "Multiple",
  level: "1–100",
  audience: "Gathering",
  tags: ["tackleking", "mineking", "fieldking", "blessed", "resplendent", "luminary", "ironworks fishing rod"],
  imageUrl: "/guides/relic-stage-route.svg",
  order: 9,
};

const landing: BuiltInGuide = {
  slug: "gathering-achievement-tools-start",
  parentSlug: overview.slug,
  type: "article",
  category: "Gathering Achievement Tools",
  title: "Start Here: Tool Families, Checkpoints & Route Plan",
  summary: "Identify the exact reward you want, understand what counts, and follow the fastest order without confusing vendor gear with achievement tools.",
  expansion: "Multiple",
  level: "1–100",
  audience: "Gathering",
  tags: ["overview", "route", "achievement", "non-relic"],
  imageUrl: "/guides/relic-stage-route.svg",
  order: 1,
  content: `## First: the names are genuinely confusing
**Tackleking's Rod** and **Blessed Tackleking's Rod are different items.** The plain Tackleking/Mineking/Fieldking tools were Stormblood scrip gear. Their original item-level-300 versions are no longer obtainable; their stronger **Augmented** versions remain available for Purple Gatherers' Scrips. The glowing **Blessed** tools come from discovery achievements and do not require buying the scrip tool first.

## Reward roadmap
| Job | Milestone | Requirement | Reward |
| --- | --- | --- | --- |
| Fisher | ARR regional activity chains | Finish the La Noscea, Black Shroud, and Thanalan Fisher activity achievements | Rod of the Luminary |
| Fisher | Go Big or Go Home X | 106 distinct qualifying big fish | Ironworks Fishing Rod |
| Fisher | I Caught That III | 160 unique fish | Master Fisher's Ring |
| Fisher | I Caught That V | 460 unique fish | Blessed Tacklekeep's Rod |
| Fisher | I Caught That VI | 780 unique fish | Blessed Tackleking's Rod |
| Fisher | I Caught That VII | 1,140 unique fish | Resplendent Tacklefiend's Rod |
| Miner | ARR regional activity chains | Finish the three regional Miner activity achievements | Pick of the Luminary |
| Miner | I Found That: Miner III | 50 class-exclusive items | Master Miner's Ring |
| Miner | I Found That: Miner V | 150 class-exclusive items | Blessed Minekeep's Pickaxe |
| Miner | I Found That: Miner VI | 180 class-exclusive items | Blessed Mineking's Pickaxe |
| Miner | I Found That: Miner VII | 220 class-exclusive items | Resplendent Minefiend's Pickaxe |
| Botanist | ARR regional activity chains | Finish the three regional Botanist activity achievements | Axe of the Luminary |
| Botanist | I Found That: Botanist III | 100 class-exclusive items | Master Botanist's Ring |
| Botanist | I Found That: Botanist V | 230 class-exclusive items | Blessed Fieldkeep's Hatchet |
| Botanist | I Found That: Botanist VI | 280 class-exclusive items | Blessed Fieldking's Hatchet |
| Botanist | I Found That: Botanist VII | 340 class-exclusive items | Resplendent Fieldfiend's Hatchet |

Later discovery achievements continue to **1,730 fish**, **280 Miner items**, and **420 Botanist items**, but those later milestones award titles rather than another tool. The directories deliberately contain enough current entries to finish those title milestones too.

${commonLogRules}

## Claiming and replacing rewards
- Open the completed achievement and claim its item reward if the client presents a claim button.
- If the achievement is complete but the tool was discarded, use a **Calamity Salvager → Purchase Quest Rewards → Purchase Achievement Rewards II**. The three city salvagers are in Limsa Lominsa Upper Decks (X:11.4, Y:14.4), Old Gridania (X:10.0, Y:8.4), and Ul'dah – Steps of Thal (X:12.6, Y:13.1). Eligible replacement tools cost 1,000 gil.
- These are now glamour/collection goals, not current-stat upgrades. Store or glamour them after claiming.

## Directory data and verification rule
The directory combines current Teamcraft game-data extraction with FF14 Fish Tracker's hand-maintained time, weather, bait, intuition, and hookset records. Rows marked **verify Fishing Log** lack a hand-maintained condition record, so the in-game log wins if a patch changes a route.`,
  references: [refs.achievements, refs.gathering, refs.teamcraft, refs.fishTracker],
};

const fisherGuide: BuiltInGuide = {
  slug: "fisher-achievement-tool-route",
  parentSlug: overview.slug,
  type: "article",
  category: "Fisher Achievement Tools",
  title: "Blessed Tackleking & Resplendent Tacklefiend Route",
  summary: "A complete 160 → 460 → 780 → 1,140 unique-fish route, including timing, weather, bait, intuition, Ocean Fishing, and spearfishing rules.",
  expansion: "Multiple",
  level: "1–100",
  audience: "Fisher",
  tags: ["blessed tackleking", "tacklekeep", "resplendent tacklefiend", "fish log"],
  imageUrl: "/guides/relic-stage-route.svg",
  order: 10,
  content: `## Exact finish line
- [ ] **160** unique fish — Master Fisher's Ring.
- [ ] **460** unique fish — Blessed Tacklekeep's Rod.
- [ ] **780** unique fish — Blessed Tackleking's Rod.
- [ ] **1,140** unique fish — Resplendent Tacklefiend's Rod.
- [ ] Optional title cleanup: 1,460 for **Of the Irresistible Lure** and 1,730 for **Globe-trotting Fisher**.

${commonLogRules}

## Fisher-specific preparation
- Complete Fisher job quests through the level cap. Important actions include **Mooch**, **Mooch II**, **Patience**, **Fish Eyes**, **Snagging**, **Surface Slap**, **Identical Cast**, **Prize Catch**, and **Makeshift Bait**.
- Unlock spearfishing in the Ruby Sea and keep the gig equipped. Swimming Shadows entries require catching the listed prerequisite fish in the same area before the hidden school appears.
- Unlock Ocean Fishing at the Limsa Lominsa Lower Decks. The boat follows real-world departure windows; “Ocean Fishing voyage” rows must be matched to the route and spectral current rather than an ET land window.
- Buy regional folklore tomes before working later expansions. A row explicitly names folklore when the maintained data marks it.

## How to read each fish row
- **Window** and **weather** are hard requirements when listed. “Previous” means the weather immediately before the current weather.
- **Bait / route** is ordered left-to-right for mooch chains. Catch the first item, Mooch into the next, and continue until the target.
- **Hook** gives the recommended hookset and tug strength where maintained. Under Patience, use Precision for light tugs and Powerful for stronger tugs unless the row says otherwise.
- **Intuition** lists the prerequisite catches and quantities. Catch them in the same session, then cast during the buff.

## Recommended batching plan
1. Work the directory's **Any-time fishing** tier by expansion and zone until the achievement counter stalls.
2. Clear **Spearfishing** in compact underwater-zone circuits.
3. Queue every **Time window** entry as an ET alarm and fill the gaps with permanent fish.
4. Add weather and previous-weather fish only after the permanent list is exhausted.
5. Use Ocean Fishing and big-fish/intuition rows as the final pool. You need the threshold, not every row, so skip especially hostile windows once the reward triggers.`,
  references: [refs.achievements, refs.fishTracker, refs.teamcraft],
};

const livePlannerGuide: BuiltInGuide = {
  slug: "gathering-live-planner-help",
  parentSlug: overview.slug,
  type: "article",
  category: "Gathering Achievement Tools",
  title: "Live ET, Weather & Route Planner",
  summary: "Use the live Eorzea clock, weather-chain forecast, available-now filter, travel column, maps, and optimized missing-route export.",
  expansion: "Multiple",
  level: "1–100",
  audience: "Gathering",
  tags: ["eorzea time", "weather", "route planner", "aetheryte", "map"],
  imageUrl: "/guides/relic-stage-route.svg",
  order: 2,
  content: `## What the live planner does
- Every discovery-directory page displays the current **Eorzea Time** and recalculates approximately every 30 seconds.
- **Live availability** combines the ET window, current weather, and previous-weather transition. Available rows are highlighted; closed rows show an approximate next real-world opening.
- **Available now** hides everything that cannot currently be gathered. Ocean Fishing stays in its voyage-specific workflow because its route is not an overworld ET/weather window.
- **Copy optimized missing route** puts open windows first, then upcoming windows, then groups comparable locations. Apply Missing only, level, route-tier, or text filters before copying to control the route.
- **Nearest travel** names the closest same-map aetheryte or aethernet shard in the extracted map data. It is a starting point, not a promise that terrain permits a straight line.
- **Zone map** opens the underlying zone art; use the adjacent coordinates for the target. **Item details** opens the Teamcraft item page for an additional interactive source/map check.

## Forecast limits and safety checks
The weather calculation uses the game's deterministic eight-ET-hour forecast periods and checks the immediately preceding period for transition fish. “Next” times are planning estimates rounded to an ET-hour search step. Arrive early, verify the in-game clock and weather icon, and use the Fishing/Gathering Log if a patch has changed a condition.

## Building a practical session
1. Select your progress profile and import or mark existing discoveries.
2. Turn on **Missing only**.
3. Turn on **Available now** and clear everything in one zone.
4. Turn Available now off, filter to Time window or Timed node, and copy the optimized route to see the next openings.
5. Search an aetheryte, zone, bait, tome, or weather name to batch entries sharing preparation.
6. Export the profile when finished so browser storage is never your only copy.`,
  references: [refs.teamcraft, refs.fishTracker],
};

const oceanFishingGuide: BuiltInGuide = {
  slug: "ocean-fishing-discovery-route",
  parentSlug: overview.slug,
  type: "article",
  category: "Fisher Achievement Tools",
  title: "Ocean Fishing Voyages, Spectral Currents & Discovery Cleanup",
  summary: "Plan voyage-only discoveries by route, stop, day phase, bait, and spectral-current requirement without treating them like ordinary ET windows.",
  expansion: "Shadowbringers–Dawntrail",
  level: "1–100",
  audience: "Fisher",
  tags: ["ocean fishing", "spectral current", "voyage", "bait"],
  imageUrl: "/guides/relic-stage-route.svg",
  order: 12,
  content: `## Unlock and departure workflow
- Complete **All the Fish in the Sea** in Limsa Lominsa and register with **Dryskthota** near the Fishermen's Guild in the Lower Decks.
- Voyages operate on a repeating real-world schedule with a short registration window. Open the linked live schedule before committing bait or travel; it shows the upcoming route and departure phase.
- A voyage visits three fishing areas. The directory's Ocean Fishing rows name the area or spectral version when the extracted source provides it.
- **Day, Sunset, and Night** are departure-route phases, not the ordinary ET time window shown for overworld fish.

## Spectral-current procedure
1. Bring Ragworm, Krill, and Plump Worm plus any row-specific tackle. The directory's **Initial tackle source** tells you where a specialist bait comes from when the game data has a direct vendor or recipe.
2. At each stop, target the area's spectral-trigger fish. Multiple players contribute; a trigger is never guaranteed from one catch.
3. When the current begins, switch immediately to the listed spectral bait/route. Spectral-only rows explicitly say **spectral current required**.
4. Use Double Hook/Triple Hook only after identifying the target tug and bite timing; discovery needs one catch, so conserve GP when uncertain.
5. Mark discoveries between stops. Do not assume a fish from a similarly named normal area satisfies a spectral-only row.

## Efficient achievement use
Ocean Fishing supplies many unique discoveries, but route rotation makes it poor for filling a small final gap. Clear broad overworld and spearfishing pools first, then use Missing only + Ocean Fishing voyage to prepare one route at a time.`,
  references: [refs.oceanSchedule, refs.teamcraft, refs.achievements],
};

const folkloreGuide: BuiltInGuide = {
  slug: "gathering-folklore-unlock-guide",
  parentSlug: overview.slug,
  type: "article",
  category: "Gathering Achievement Tools",
  title: "Folklore Tomes, Hidden Items & Timed-Node Preparation",
  summary: "Read exact per-row folklore requirements, purchase sources, hidden-item actions, and preparation checks before traveling to a timed node.",
  expansion: "Heavensward–Dawntrail",
  level: "55–100",
  audience: "Miner / Botanist / Fisher",
  tags: ["folklore", "timed node", "hidden item", "scrip"],
  imageUrl: "/guides/crafting.svg",
  order: 29,
  content: `## Use the exact row—not a generic expansion guess
Folklore access is recorded per fish or gathering node. Miner and Botanist rows now show the exact tome item plus an extracted vendor, coordinates, currency, and cost whenever the current game data exposes a trade. Fisher rows name their folklore volume in Special requirements; search that tome name across the directory before shopping.

## Purchase checklist
- [ ] Unlock Collectables and the expansion's Scrip Exchange access quest.
- [ ] Search the directory for **Requires** or **Folklore**, then copy the exact tome name.
- [ ] Buy the tome or required trader-token exchange shown in the Folklore unlock column.
- [ ] Use the tome from inventory. Merely purchasing it does not unlock the log entry.
- [ ] Reopen the Gathering/Fishing Log and confirm the entry is visible before traveling.

## Hidden and timed nodes
- Miner hidden items require **Luck of the Mountaineer**; Botanist hidden items require **Luck of the Pioneer**. The item can remain absent until the reveal action is used on the correct node set.
- Unspoiled/legendary nodes are not automatically folklore nodes. The directory labels **Timed folklore** only when the extracted node has an actual folklore item ID.
- Arrive before the ET opening with GP restored, Truth of Mountains/Forests active, and enough gathering/perception for the node's level.
- Ephemeral nodes and aetherial-reduction discoveries are separate from folklore. Prime and Sublime results can count as separate log discoveries where present.`,
  references: [refs.gathering, refs.teamcraft],
};

const bigFishGuide: BuiltInGuide = {
  slug: "fisher-ironworks-luminary-rods",
  parentSlug: overview.slug,
  type: "article",
  category: "Fisher Achievement Tools",
  title: "Rod of the Luminary & Ironworks Fishing Rod",
  summary: "Finish the ARR regional cast-count chains and catch 106 distinct big fish for both special level-50 rods.",
  expansion: "A Realm Reborn",
  level: "1–50",
  audience: "Fisher",
  tags: ["rod of the luminary", "ironworks fishing rod", "big fish", "go big or go home"],
  imageUrl: "/guides/relic-stage-route.svg",
  order: 11,
  content: `## Rod of the Luminary
This is an activity-volume achievement, not a discovery-log reward.

- [ ] In **Achievements → Crafting & Gathering → Fisher**, track all five **Good Things Come to Those Who Bait** tiers for La Noscea.
- [ ] Repeat for the Black Shroud.
- [ ] Repeat for Thanalan.
- [ ] Completing the three regional **A Fisher's Life for Me** achievements completes **A Fisher's Life for Me: Greater Eorzea** and awards the Rod of the Luminary.

The regional tiers count successful fishing attempts from level 1–10, 11–20, 21–30, 31–40, and 41–50 waters. Fish at an appropriate hole in the named region; discovery status and fish rarity do not matter. Use the achievement panel for the exact remaining count because progress is split across fifteen sub-achievements.

## Ironworks Fishing Rod
Complete **Go Big or Go Home X** by catching **106 different varieties of big fish** in ARR, Heavensward, or Stormblood areas.

1. Unlock big-fish catching with the level-50 Fisher quest **The Beast of Brewer's Beacon**.
2. Filter the fish directories to **Big fish / intuition** and begin with any-time or broad-window entries.
3. Each species counts once. Recatching an existing big fish does not advance the achievement.
4. Use the listed time, current weather, previous weather, bait chain, Snagging, and intuition requirements literally.
5. Stop when Go Big or Go Home X completes; later big-fish achievements are optional and do not upgrade the rod.

Both rods can be replaced from a Calamity Salvager for 1,000 gil after their achievements are complete.`,
  references: [refs.achievements, refs.fishTracker],
};

const minerGuide: BuiltInGuide = {
  slug: "miner-achievement-tool-route",
  parentSlug: overview.slug,
  type: "article",
  category: "Miner Achievement Tools",
  title: "Blessed Mineking & Resplendent Minefiend Route",
  summary: "Complete the class-exclusive Miner log with permanent, hidden, ephemeral, timed, and folklore node routes.",
  expansion: "Multiple",
  level: "1–100",
  audience: "Miner",
  tags: ["blessed mineking", "minekeep", "resplendent minefiend", "mining log"],
  imageUrl: "/guides/relic-stage-route.svg",
  order: 30,
  content: `## Exact finish line
- [ ] 50 unique Miner-only items — Master Miner's Ring.
- [ ] 150 — Blessed Minekeep's Pickaxe.
- [ ] 180 — Blessed Mineking's Pickaxe.
- [ ] 220 — Resplendent Minefiend's Pickaxe.
- [ ] Optional titles: 260 for **Of the Relentless Sledge** and 280 for **Globe-trotting Miner**.

${commonLogRules}

## Miner route details
- Clear **Always available** first. The directory has more valid entries than the 220-tool threshold, so no specific timed item is mandatory.
- A **Hidden item** may not appear on a node. Use **Luck of the Mountaineer**, learned from the level-55 Miner quest, on the correct node set.
- **Ephemeral / reduction** entries count when the resulting class-exclusive collectable is a discovery entry. Prime and Sublime variants are separate.
- **Timed folklore** entries require both the correct Regional Folklore tome and the ET window. Buy the book before traveling.
- Coordinates identify the node cluster. If the exact node is not visible, activate **Lay of the Land** and circle the cluster.

## Pick of the Luminary
For the separate ARR tool, complete all five **Mining Your Own Business** tiers in each of La Noscea, the Black Shroud, and Thanalan, then claim **A Miner's Life for Me: Greater Eorzea**. This counts swings at the specified level-band nodes, not unique log entries.`,
  references: [refs.achievements, refs.gathering, refs.teamcraft],
};

const botanistGuide: BuiltInGuide = {
  slug: "botanist-achievement-tool-route",
  parentSlug: overview.slug,
  type: "article",
  category: "Botanist Achievement Tools",
  title: "Blessed Fieldking & Resplendent Fieldfiend Route",
  summary: "Complete the class-exclusive Botanist log with permanent, hidden, ephemeral, timed, and folklore node routes.",
  expansion: "Multiple",
  level: "1–100",
  audience: "Botanist",
  tags: ["blessed fieldking", "fieldkeep", "resplendent fieldfiend", "botany log"],
  imageUrl: "/guides/relic-stage-route.svg",
  order: 50,
  content: `## Exact finish line
- [ ] 100 unique Botanist-only items — Master Botanist's Ring.
- [ ] 230 — Blessed Fieldkeep's Hatchet.
- [ ] 280 — Blessed Fieldking's Hatchet.
- [ ] 340 — Resplendent Fieldfiend's Hatchet.
- [ ] Optional titles: 380 for **Of the Keen Hatchet** and 420 for **Globe-trotting Botanist**.

${commonLogRules}

## Botanist route details
- Clear **Always available** logging and harvesting entries first. You have enough alternatives to skip hostile windows before the 340-tool threshold.
- A **Hidden item** may not appear on a node. Use **Luck of the Pioneer**, learned from the level-55 Botanist quest, on the correct node set.
- **Ephemeral / reduction** entries can award multiple separately counted Prime and Sublime discoveries.
- **Timed folklore** rows require the matching Regional Folklore tome. Unlock the book before setting the alarm.
- The directory labels Logging versus Harvesting so you know which node icon and secondary tool interaction to expect.

## Axe of the Luminary
For the separate ARR tool, complete all five regional Botanist gathering-volume tiers in La Noscea, the Black Shroud, and Thanalan, then claim **A Botanist's Life for Me: Greater Eorzea**. This is independent of the unique-item log.`,
  references: [refs.achievements, refs.gathering, refs.teamcraft],
};

const legacyGuide: BuiltInGuide = {
  slug: "legacy-gatherer-scrip-tools",
  parentSlug: overview.slug,
  type: "article",
  category: "Gatherer Scrip Tools",
  title: "Tackleking, Mineking & Fieldking: Legacy Scrip Gear",
  summary: "Acquire the currently obtainable augmented versions and avoid mistaking the obsolete base tools for Blessed achievement rewards.",
  expansion: "Heavensward–Shadowbringers",
  level: "60–80",
  audience: "Gathering",
  tags: ["tackleking", "mineking", "fieldking", "augmented", "purple scrips"],
  imageUrl: "/guides/crafting.svg",
  order: 70,
  content: `## What is still obtainable
| Level | Fisher | Miner | Botanist | Current route |
| --- | --- | --- | --- | --- |
| 60 / IL 200 | Augmented Tacklekeep's Rod | Augmented Minekeep's Pickaxe | Augmented Fieldkeep's Hatchet | Purple Gatherers' Scrip exchange, Lv. 60/IL 200, 250 scrips |
| 70 / IL 330 | Augmented Tackleking's Rod | Augmented Mineking's Pickaxe | Augmented Fieldking's Hatchet | Purple Gatherers' Scrip exchange, Lv. 70/IL 330, 250 scrips |
| 80 / IL 440 | Tacklefiend's Rod | Minefiend's Pickaxe | Fieldfiend's Hatchet | Purple Gatherers' Scrip exchange, Lv. 80/IL 440, 250 scrips |

## Unlocks and vendors
- Level 60 stock requires **Go West, Craftsman**. A convenient representative is in Foundation (X:10.5, Y:11.8); Grinmox in Idyllshire (X:6.6, Y:7.4) also handles old augmentation exchanges.
- Level 70 stock requires **Reach Long and Prosper**. Use the Rowena's Representative in Kugane (X:12.2, Y:10.8) or any Scrip Exchange showing the Lv. 70/IL 330 category.
- Level 80 stock requires **The Boutique Always Wins**. Use Mowen's Merchant in the Crystarium (X:10.1, Y:11.8) or a Scrip Exchange showing Lv. 80/IL 440.

## Obsolete base tools
The unaugmented **Tackleking's Rod**, **Mineking's Pickaxe**, and **Fieldking's Hatchet** were old yellow-scrip items. They are no longer obtainable. Buy the stronger augmented versions instead.

## No dependency on Blessed tools
Owning an augmented scrip tool does not advance I Caught That or I Found That, and it is not consumed when the Blessed reward is earned. The similarly named Blessed tools are direct achievement rewards.`,
  references: [refs.achievements],
};

const fishDirectories: BuiltInGuide[] = chunk(data.fish, 380).map((entries, index, all) => {
  const first = index * 380 + 1;
  const last = first + entries.length - 1;
  return {
    slug: `fisher-discovery-directory-${String(first).padStart(4, "0")}-${String(last).padStart(4, "0")}`,
    parentSlug: overview.slug,
    type: "article",
    category: "Fisher Discovery Directory",
    title: `Fish Discovery Directory ${first}–${last}`,
    summary: `Search and track fish ${first}–${last} of ${data.fish.length}, including location, coordinates, ET window, weather, bait route, hookset, and special requirements.`,
    expansion: "Multiple",
    level: "1–100",
    audience: "Fisher",
    tags: ["fish directory", "bait", "weather", "eorzea time", "fishing log"],
    imageUrl: "/guides/relic-stage-route.svg",
    order: 12 + index,
    content: `## Directory ${index + 1} of ${all.length}
Rows are ordered from generally easiest route tier to hardest. The live column combines ET, current weather, and previous weather; the initial-tackle source lists the first bait rather than mooched fish. “Verify Fishing Log” means no hand-maintained condition record was available for that row.

${table(["No.", "Fish", "Route tier", "Expansion", "Level", "Location", "Coordinates", "Nearest travel", "Window", "Weather", "Previous weather", "Bait / route", "Initial tackle source", "Hook", "Special requirements", "Live availability", "Map / details", "Data status", "Added"], entries.map((entry, rowIndex) => [first + rowIndex, entry.name, entry.routeTier, entry.expansion, entry.level, entry.location, entry.coordinates, entry.nearestTravel, entry.time, entry.weather, entry.previousWeather || "—", entry.bait, entry.baitSource, entry.hook, entry.requirements, liveCell(entry.live), entry.mapLink, entry.dataStatus, `Patch ${entry.patch}`]))}`,
    references: [refs.fishTracker, refs.teamcraft],
  } satisfies BuiltInGuide;
});

const gatherDirectories = (job: "miner" | "botanist", entries: typeof data.miner, startOrder: number): BuiltInGuide[] => chunk(entries, 220).map((part, index, all) => {
  const first = index * 220 + 1;
  const last = first + part.length - 1;
  const titleJob = job === "miner" ? "Miner" : "Botanist";
  return {
    slug: `${job}-discovery-directory-${String(first).padStart(3, "0")}-${String(last).padStart(3, "0")}`,
    parentSlug: overview.slug,
    type: "article",
    category: `${titleJob} Discovery Directory`,
    title: `${titleJob} Discovery Directory ${first}–${last}`,
    summary: `Track ${titleJob} entries ${first}–${last} of ${entries.length}, including node type, zone, coordinates, ET window, hidden-item action, ephemeral status, and folklore requirement.`,
    expansion: "Multiple",
    level: "1–100",
    audience: titleJob,
    tags: [`${job} directory`, "node", "folklore", "eorzea time", "gathering log"],
    imageUrl: "/guides/relic-stage-route.svg",
    order: startOrder + index,
    content: `## Directory ${index + 1} of ${all.length}
Rows exclude items shared by Miner and Botanist because those do not advance the class-exclusive achievement. Work the permanent rows first and use the timed rows only when needed.

${table(["No.", "Item", "Route tier", "Expansion", "Level", "Node type", "Location", "Coordinates", "Nearest travel", "Window", "Special requirements", "Folklore unlock", "Live availability", "Map / details", "Data status", "Added"], part.map((entry, rowIndex) => [first + rowIndex, entry.name, entry.routeTier, entry.expansion, entry.level, entry.nodeType, entry.location, entry.coordinates, entry.nearestTravel, entry.time, entry.requirements, entry.folklore, liveCell(entry.live), entry.mapLink, entry.dataStatus, `Patch ${entry.patch}`]))}`,
    references: [refs.teamcraft, refs.gathering],
  } satisfies BuiltInGuide;
});

export const GATHERING_ACHIEVEMENT_TOOL_GUIDES: BuiltInGuide[] = [
  overview,
  landing,
  livePlannerGuide,
  fisherGuide,
  bigFishGuide,
  oceanFishingGuide,
  ...fishDirectories,
  folkloreGuide,
  minerGuide,
  ...gatherDirectories("miner", data.miner, 31),
  botanistGuide,
  ...gatherDirectories("botanist", data.botanist, 51),
  legacyGuide,
];
