import type { BuiltInGuide, GuideReference } from "./guide-library";
import data from "./limited-job-data.json";

type FamiliarAction = { number: number; name: string; kin: string; autoAttack: string; temperedRelease: string; temperedTarget: string; trick: string; trickTarget: string; borrow: string };
const familiarActions = data.beastmasterActions as FamiliarAction[];
const cell = (value: string | number) => String(value || "—").replaceAll("|", " / ").replaceAll("\n", " ");
function familiarActionTable(from: number, to: number) {
  const rows = familiarActions.filter((entry) => entry.number >= from && entry.number <= to).map((entry) =>
    `| ${entry.number} | ${cell(entry.name)} | ${cell(entry.kin)} | ${cell(entry.autoAttack)} | ${cell(entry.temperedRelease)} (${cell(entry.temperedTarget)}) | ${cell(entry.trick)} (${cell(entry.trickTarget)}) | ${cell(entry.borrow)} |`,
  ).join("\n");
  return `| No. | Familiar | Kin | Auto-attack | Tempered Release | Trick | Borrow |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows}`;
}

const official = (label: string, url: string): GuideReference => ({ label, url });
const blueReferences: GuideReference[] = [
  official("Official Blue Mage job guide", "https://na.finalfantasyxiv.com/jobguide/bluemage/"),
  { label: "Blue Mage quest and action reference", url: "https://ffxiv.consolegameswiki.com/wiki/Blue_Mage" },
  { label: "Masked Carnivale stage reference", url: "https://ffxiv.consolegameswiki.com/wiki/Masked_Carnivale" },
  { label: "Blue Mage role and rotation reference", url: "https://www.icy-veins.com/ffxiv/blue-mage-pve-dps-rotation-openers-abilities" },
];
const beastReferences: GuideReference[] = [
  official("Official Beastmaster job guide", "https://na.finalfantasyxiv.com/jobguide/beastmaster/"),
  official("Patch 7.56 notes", "https://na.finalfantasyxiv.com/lodestone/topics/detail/a8a526ad64db45c8ca8d1c7fdcce8a5eedaa18bc"),
  { label: "Beastmaster quest and system reference", url: "https://ffxiv.consolegameswiki.com/wiki/Beastmaster" },
  { label: "Beastmaster gear and upgrade tables", url: "https://ffxiv.consolegameswiki.com/wiki/Beastmaster_Gear" },
  { label: "Patch 7.56 Beastmaster best-in-slot reference", url: "https://www.icy-veins.com/ffxiv/beastmaster-pve-dps-gear-best-in-slot" },
  { label: "Crucible board and system reference", url: "https://www.icy-veins.com/ffxiv/beastmaster-crucible-of-the-unbroken" },
];
const common = { expansion: "Multiple", audience: "Limited jobs", imageUrl: "/guides/field-operations.svg", verifiedPatch: "7.56", verifiedOn: "2026-09-19" };

export const LIMITED_JOB_EXTRA_GUIDES: BuiltInGuide[] = [
  {
    ...common, slug: "blue-mage-quest-checklist", parentSlug: "blue-mage", type: "article", category: "Blue Mage", title: "Blue Mage Quest Checklist",
    summary: "Every Blue Mage quest from unlock through level 80, with spell and Carnivale gates, major rewards, and quest hubs.", level: "1–80", tags: ["blue mage", "quests", "coordinates", "job gear"], order: 12, references: blueReferences,
    content: `## Quest hubs
The unlock begins with the **Zealous Yellowjacket** in Limsa Lominsa Lower Decks (X:9.9, Y:11.0). Most later quests begin with **Martyn** or **Maudlin Latool Ja** near Milvaneth Sacrarium in Ul'dah - Steps of Thal (X:12.5, Y:13.0). The Masked Carnivale attendant is nearby at (X:11.5, Y:13.2). Follow the live journal destination after accepting a quest.

| Level | Quest | Important gate or reward |
| --- | --- | --- |
| 1 | Blue Leading the Blue | Demonstrate Water Cannon |
| 10 | Blue Collar Work | Learn Blood Drain |
| 20 | Why They Call It the Blues | Learn Mind Blast |
| 30 | Scream Blue Murder | Learn Faze |
| 40 | Blue Gold | Learn 1000 Needles |
| 50 | The Real Folk Blues | Unlocks Masked Carnivale; Magus attire and Spirit of the Whalaqee |
| 50 | Turning Over a Blue Leaf | Clear Dirty Rotten Azulmagia; Azulmagia reward |
| 50 | Into the Blue Again | Begins the level-60 chapter |
| 53 | Something Borrowed, Something Blue | Learn Northerlies |
| 55 | Bolt from the Blue | Learn Whistle |
| 58 | Blue in the Face | Learn Exuviation |
| 60 | Blue Scream of Death | Learn Frog Legs; unlocks Blue Mage Log after prerequisites |
| 60 | Blue Cheese | Story Part 2 and Mask of Azuro |
| 60 | Second-rate Entertainment | Begins the level-70 chapter |
| 63 | Everybody Was Fukumen Fighting | Learn Basic Instinct |
| 65 | Azuro and Goliath | Learn Tingle |
| 68 | Where the Gold Goes | Learn Ultravibration |
| 70 | Master of Mimicry | Learn Aetherial Spark; Mirage gear; unlock condition for stage 31 |
| 70 | A Future in Blue | Clear Anything Gogo's; Story Part 3 and Predatrice |
| 70 | And the Crowd Goes Mild | Begins the level-80 chapter |
| 73 | The Beard, the Myth, the Legend | Learn Goblin Punch |
| 75 | Gridania's Most Wanted | Learn Schiltron |
| 78 | No Butts About It | Learn Rehydration |
| 80 | A New Gold Standard | Phantasmal attire; unlock condition for stage 32 |
| 80 | The Brave and the Blue | Clear A Golden Opportunity; Story Part 4 and Blue-eyes reward |

## Before each quest
- [ ] Read the journal objective for the required spell or stage instead of relying on level alone.
- [ ] Verify the requested spell is recorded in the spellbook.
- [ ] Equip a survival set before solo instances and Carnivale gates.
- [ ] Open equipment coffers on Blue Mage and compare the pieces before discarding older synced gear.
- [ ] Revisit Wayward Gaheel Ja for newly eligible Whalaqee Totems after spell-count milestones.`,
  },
  {
    ...common, slug: "blue-mage-loadouts-and-combos", parentSlug: "blue-mage", type: "article", category: "Blue Mage", title: "Blue Mage Loadouts and Spell Combinations",
    summary: "Concrete 24-slot templates for damage, tanking, healing, solo play, and farming, with the combinations that make them work.", level: "50–80", tags: ["blue mage", "loadout", "rotation", "tank", "healer", "dps"], order: 52, references: blueReferences,
    content: `## Treat these as templates
Encounter mechanics outrank a generic list. Start from the intended role, then replace optional damage with the interrupt, cleanse, movement, mitigation, or element the fight requires. Set Aetheric Mimicry before entry.

## Solo and spell farming
| Need | Recommended spells |
| --- | --- |
| Filler and tagging | Sonic Boom or Goblin Punch; Flying Sardine |
| Area clearing | Hydro Pull, The Ram's Voice, Ultravibration |
| Sustain | Healer Mimicry, Pom Cure, Gobskin, Exuviation, Angel Whisper |
| Defense | Mighty Guard, Diamondback, Dragon Force, Bad Breath |
| MP and utility | Magic Hammer, Blood Drain, Loom, Sticky Tongue, White Wind |
| Finisher | Bristle, Whistle, Final Sting or Self-destruct only when a reset is acceptable |

**The Ram's Voice → Ultravibration** removes many enemies that accept Deep Freeze. Hydro Pull can gather them first. Keep Flying Sardine available for interruptible casts.

## Damage template
Use DPS Mimicry; Goblin Punch or Sonic Boom; Moon Flute; Whistle; Tingle; Triple Trident; Bristle; Song of Torment; Breath of Magic; Mortal Flame; Nightbloom; Phantom Flurry; Shock Strike; Feather Rain; J Kick; Surpanakha; Sea Shanty; Being Mortal; Cold Fog; Winged Reprobation; The Rose of Destruction; Matra Magic; Magic Hammer; and one encounter slot.

- Use **Whistle → Tingle → Triple Trident** for the physical burst package.
- Put powerful off-global attacks inside Moon Flute without clipping casts.
- Moon Flute's downtime must not overlap required healing, movement, mitigation, or interrupts.
- Final Sting is a coordinated kill attempt, not a normal rotational button.

## Tank template
Use Tank Mimicry, Mighty Guard, Goblin Punch, Bad Breath, Magic Hammer, Blood Drain, Diamondback, Dragon Force, Chelonian Gate, Devour, White Wind, Frog Legs, Sticky Tongue, Cactguard, Avail, Angel Whisper, Exuviation, Flying Sardine, Loom, Gobskin, The Look, and encounter-specific choices.

Preserve MP for Diamondback. Frog Legs is a short-range swap tool that moves the caster just above current top enmity, not a conventional ranged provoke. Bad Breath reduces party pressure.

## Healer templates
Both healers use Healer Mimicry, Pom Cure, Gobskin, Angel Whisper, Exuviation, White Wind, and Stotram. The main healer keeps more recovery. The off healer retains the damage core and uses Moon Flute only when healing is covered. Magic Hammer supports MP and Bad Breath provides mitigation.

## Interaction reminders
- Bristle and Whistle must not be consumed by an unintended spell.
- Assign Off-guard and Peculiar Light rather than duplicating them blindly.
- Condensed Libra only helps attacks matching its applied vulnerability.
- Cold Fog and Chelonian Gate require their trigger conditions before their follow-up actions appear.
- Basic Instinct is for qualifying undersized situations; check actual party size.`,
  },
  {
    ...common, slug: "blue-mage-gear-and-stats", parentSlug: "blue-mage", type: "article", category: "Blue Mage", title: "Blue Mage Gear, Materia, and Food",
    summary: "Gear priorities at levels 50, 60, 70, and 80, with synced-content rules and role-specific substats.", level: "50–80", tags: ["blue mage", "gear", "materia", "food", "sync"], order: 54, references: blueReferences,
    content: `## Practical rule
Use the highest-item-level caster gear available at the cap you are playing, then optimize for content you repeat. Blue Mage uses Intelligence caster equipment. Job-quest gear is a strong starting point; augmented tomestone and raid caster pieces fill gaps.

| Content | Equipment plan |
| --- | --- |
| Level 50 | Magus/job gear or stronger level-50 caster gear; keep enough vitality for mechanics |
| Level 60 achievements | Higher gear can sync to capped substats; an on-level weapon can still benefit from materia |
| Level 70 duties | Strong level-70 caster gear or higher pieces that sync efficiently |
| Level 80 | Phantasmal gear plus strong level-80 caster alternatives; compare actual synced stats |

## Substats
- **Damage:** Critical Hit and Spell Speed are both practical. Spell Speed makes Moon Flute sequences more forgiving; Critical Hit has more variance. Determination is stable.
- **Tank/healer:** Spell Speed improves responsiveness; Determination supports consistent damage and healing.
- **Direct Hit:** useful for damage but provides no defense and should not displace progression survival.

## Sync, materia, and food
Materia is generally disabled when an item syncs, while native substats are capped. Do not copy a level-80 set into a level-60 achievement without checking the result. Choose food that reaches its stat caps at the target item level: reinforce Critical Hit or Spell Speed for damage, and Spell Speed/Determination for support. Vitality is useful during progression.

- [ ] Equip current caster accessories as well as armor.
- [ ] Repair before organized farms, Log duties, and Carnivale progression.
- [ ] Save separate sets for level-60 achievements and level-80 play.
- [ ] Recheck materia after replacing an unsynced weapon or piece.
- [ ] Prefer mechanical comfort over a theoretical substat gain.`,
  },
  {
    ...common, slug: "blue-mage-carnivale-001-016", parentSlug: "blue-mage", type: "article", category: "Masked Carnivale", title: "Masked Carnivale: Stages 1–16",
    summary: "Clear plans and preparation cues for the first sixteen Masked Carnivale stages.", level: "50", tags: ["blue mage", "masked carnivale", "weekly targets"], order: 60, references: blueReferences,
    content: `## Before entering
Use Healer Mimicry while learning, carry Pom Cure or Exuviation, magical and physical filler, and Flying Sardine. These stages sync to 50. Spells cannot be changed after entry and acts do not create checkpoints.

| Stage | Clear plan |
| --- | --- |
| 1 — All's Well That Starts Well | Avoid telegraphs and defeat the introductory slime and dullahan |
| 2 — Much Ado About Pudding | Match each pudding's elemental weakness; interrupt Golden Tongue |
| 3 — Waiting for Golem | Bring water damage and interrupt Obliterate |
| 4 — Gentlemen Prefer Swords | Heal through the pack, dodge Grand Strike, interrupt Magitek Field |
| 5 — The Threepenny Turtles | Use 1000 Needles or a valid death effect through their mitigation |
| 6 — Eye Society | Use mandragora Blind to neutralize gazes, then handle Stone damage |
| 7 — A Chorus Slime | Sticky Tongue explosive slimes beside targets; use walls against lethal line attacks |
| 8 — Bomb-edy of Errors | Trigger controlled chains, engage the boss first, interrupt Burst |
| 9 — To Kill a Mockingslime | Match elements on adds, dodge Dark, interrupt Golden Tongue |
| 10 — A Little Knight Music | Dodge colossus telegraphs and interrupt King's Will |
| 11 — Some Like It Excruciatingly Hot | Control gas-bomb spacing so chains hit enemies, not you |
| 12 — The Plant-om of the Opera | Remove roselets before pressure compounds; carry healing and cleanse |
| 13 — Beauty and a Beast | Respect gaze/charm mechanics, kill adds, preserve healing for Carmilla |
| 14 — Blobs in the Woods | Bring Loom; teleport behind the center obstacle during The Last Song |
| 15 — The Me Nobody Nodes | Interrupt High Voltage and avoid point-blank attacks |
| 16 — Sunset Bull-evard | Read swing direction, aim knockbacks away from edges, use donut safe zones |

For weekly targets, read every objective before entry. Some spellcasting objectives count spells actually cast, not merely equipped. Clear normally before combining time, element, heal, or action-count restrictions. Continue with [[blue-mage-carnivale-017-032|Stages 17–32]].`,
  },
  {
    ...common, slug: "blue-mage-carnivale-017-032", parentSlug: "blue-mage", type: "article", category: "Masked Carnivale", title: "Masked Carnivale: Stages 17–32",
    summary: "Required tools and major failure points for the advanced stages through Goldor.", level: "50–80", tags: ["blue mage", "azulmagia", "gogo", "goldor"], order: 61, references: blueReferences,
    content: `## Unlock bands
Stages 17–25 sync to 50. Stages 26–30 require **Blue Scream of Death** and sync to 60. Stage 31 requires **Master of Mimicry** and syncs to 70. Stage 32 requires **A New Gold Standard** and syncs to 80.

| Stage | Required preparation and clear plan |
| --- | --- |
| 17 — The Sword of Music | Physical on the magic-reflect claw; magical on the physical-reflect claw; repeat during Kreios adds |
| 18 — Midsummer Night's Explosion | Aim attacks and knockbacks to detonate kegs into manticores while escaping the chain |
| 19 — On a Clear Day You Can Smell Forever | Respect reflect states and hazards; do not attack into active reflection |
| 20 — Miss Typhon | Diamondback Snort/Fireballs; interrupt Ultros's Imp Song; save defense for the combined act |
| 21 — Chimera on a Hot Tin Roof | Interrupt imps; Ram's Voice out, Dragon's Voice in; avoid Ram's Keeper |
| 22 — Here Comes the Boom | Use bomb explosions as the stage tool and keep an escape path |
| 23 — Behemoths and Broomsticks | Use arena objects against hazards and respect meteor-style attacks |
| 24 — Amazing Technicolor Pit Fiends | Magic on Viking, physical on Magus; interrupt Silence; cleanse Libra or Diamondback Triple Hit |
| 25 — Dirty Rotten Azulmagia | Bring Loom and both damage types; obey reflects, voices, and meteor movement |
| 26 — Papa Mia | Eerie Soundwave removes Alternate Plumage; control Humbaba knockbacks |
| 27 — Lock up Your Snorters | Plan every Snort around the edge; favor movement/defense over greed |
| 28 — Dangerous When Dead | Bring healing; kill gravekeepers and aim forced march into the Bifrost safe edge |
| 29 — Red, Fraught, and Blue | Interrupt Fluid Swing, stop during Pyretic, switch answers between fire and water acts |
| 30 — The Catch of the Siegfried | Carry both damage types; obey reflect/counter states and clone patterns |
| 31 — Anything Gogo's | Do not attack mimic/reflect states; interrupt and reproduce required mechanics |
| 32 — A Golden Opportunity | Bring elements and healing; handle crystals, combined spell patterns, and Goldor Rush safely |

- [ ] Carry every named required tool before entry.
- [ ] Learn one act at a time; do not Final Sting until the threshold is tested.
- [ ] Verify separate achievement conditions before an achievement run.
- [ ] Claim Moon Flute after 10 unique clears, Doom after 20, and Angel Whisper after 30 when eligible.`,
  },
  {
    ...common, slug: "blue-mage-log-and-raids", parentSlug: "blue-mage", type: "article", category: "Blue Mage", title: "Blue Mage Log, Trials, and Raid Progression",
    summary: "Party setup, role responsibilities, and preparation for synced duties and Blue Mage raid achievements.", level: "60–80", tags: ["blue mage log", "raids", "trials", "savage", "party composition"], order: 70, references: blueReferences,
    content: `## Unlock and register
Complete **Blue Scream of Death** at 60 after **Blue in the Face** and Frog Legs. Form the required all-Blue-Mage party and register with **Undersized Party disabled**. Confirm the entry message says Log conditions are active.

## Eight-player structure
Begin with **one tank mimic, two healer mimics, and five damage mimics**. Experienced groups can shift more damage to an off healer. Assign Off-guard/Peculiar Light, interrupts, Bad Breath mitigation, raises, and Diamondback mechanics before pulling.

| Role | Foundation | Encounter swaps |
| --- | --- | --- |
| Tank | Tank Mimicry, Mighty Guard, Diamondback, Dragon Force, Bad Breath, MP recovery | Frog Legs, Avail/Cactguard, movement |
| Main healer | Healer Mimicry, Pom Cure, Gobskin, Angel Whisper, Exuviation, White Wind | Stotram, cleanse, extra mitigation |
| Off healer | Healing foundation plus damage core | Remove optional damage before required recovery |
| Damage | DPS Mimicry, filler, Moon Flute package, Angel Whisper | Diamondback, interrupt, movement, encounter utility |

## Progression order
1. Practice roles in ordinary Log dungeons and trials.
2. Learn fights with conservative sets before speed or restricted achievements.
3. Progress older Extreme and Coil/Alexander/Omega/Eden targets at their required sync.
4. Save separate level-60, level-70, and level-80 sets.
5. Attempt raid-series reward achievements only after everyone owns mandatory survival spells.

- [ ] Assign Angel Whisper raises.
- [ ] Name the response to every tankbuster and raidwide.
- [ ] Assign Frog Legs for required tank swaps.
- [ ] Keep Moon Flute away from healing, movement, and interrupt windows.
- [ ] Call Final Sting only inside a tested combined threshold.

A normal clear, Log clear, spell learn, and raid achievement are separate outcomes. Achievement runs may require level sync, no Echo, and an all-Blue-Mage party; read the exact achievement before entering.`,
  },
  {
    ...common, slug: "beastmaster-quest-checklist", parentSlug: "beastmaster", type: "article", category: "Beastmaster", title: "Beastmaster Quest Checklist",
    summary: "Every Beastmaster story and high-end Crucible unlock quest, with hubs, board unlocks, and equipment rewards.", level: "1–50", tags: ["beastmaster", "quests", "coordinates", "crucible", "job gear"], order: 12, references: beastReferences,
    content: `## Quest hubs
Unlock Beastmaster with the **Excited Adventurer** in New Gridania (X:11.8, Y:13.6) after The Ultimate Weapon and with Dawntrail registered. The guild develops near Bentbranch Meadows in Central Shroud around (X:22, Y:23). Enter the Crucible through **Lauda** at Central Shroud (X:21.9, Y:22.8). Later Master's Board quests remain centered on this guild/Crucible chain; follow the live quest marker for Sylmond.

| Level | Quest | Unlock or reward |
| --- | --- | --- |
| Unlock | Strangers in the Wood | Beastmaster, Master's Bestiary, soul crystal, starting axe/shield/coffer, Cu Sith Gourd |
| 1 | The Wilds Call | Beast Tender axe and shield |
| 8 | Hearts Aligned | Beast Handler axe and shield |
| 18 | Master of the Lhu | Beast Whisperer axe and shield |
| 30 | Into the Crucible | First Board; Beast Tamer weapon, shield, and item-level-30 coffer |
| 30 | Wit as Weaponry | Continues the First Board story |
| 40 | Gobsmacked | Second Board; Beastwarden weapon, shield, and item-level-40 coffer |
| 40 | Sin of Blood | Continues the Second Board story through Lauda |
| 50 | A Beastmaster's Path | Third Board; Beastmaster weapon, shield, and item-level-90 coffer |
| 50 | Bonds Unbroken | Beastmaster New Game+ and Cu Sith Horn |
| 50 | Free for All | First Master's Board |
| 50 | Mastery Rematch | Second Master's Board |
| 50 | Blazing Trails | Crucible Degrees and seasonal leaderboards |

## Progression gates
The three Boards of the Unbroken are part of the job story, not optional side challenges. A new quest may expect a board clear, a stronger roster, or upgraded equipment. Job quests teach the systems and award gear rather than unlocking a conventional action every five levels.

- [ ] Capture familiars as levels permit instead of arriving at a board with only the starter.
- [ ] Open each gear coffer on Beastmaster and equip the weapon and shield upgrades.
- [ ] Clear the required board before looking for the next quest marker.
- [ ] Recheck the gourd vendor after Second Board progression expands stock.
- [ ] Finish all five boards before attempting Degrees and leaderboard preparation.`,
  },
  {
    ...common, slug: "beastmaster-familiar-actions-001-025", parentSlug: "beastmaster", type: "article", category: "Familiar Actions", title: "Familiar Actions: Bestiary 1–25",
    summary: "Kin, attack type, Tempered Release, Trick, target shape, and Borrow action for familiars 1 through 25.", level: "1–32", tags: ["beastmaster", "familiar actions", "kin", "borrow", "combos"], order: 32, references: beastReferences,
    content: `## Read the action set
**Tempered Release** is the familiar's major command, **Trick** is its repeatable contribution, and **Borrow** gives Beastmaster a related personal action. Kin and auto-attack type matter when a Crucible enemy panel lists weaknesses, resistances, or a Kin Gambit objective. Use the filters to compare familiars and mark the action sets you have reviewed.

${familiarActionTable(1, 25)}

## Team-building pass
- [ ] Cover more than one physical or elemental attack type.
- [ ] Include control, mitigation, recovery, or resistance support instead of three interchangeable attackers.
- [ ] Confirm whether Tempered Release is single-target or area-of-effect.
- [ ] Put Borrow actions into the intended Beastmaster instinct chain.
- [ ] Revisit the acquisition guide when an ideal action belongs to a missing familiar.

Continue with [[beastmaster-familiar-actions-026-050|Familiars 26–50]].`,
  },
  {
    ...common, slug: "beastmaster-familiar-actions-026-050", parentSlug: "beastmaster", type: "article", category: "Familiar Actions", title: "Familiar Actions: Bestiary 26–50",
    summary: "Complete action and kin reference for higher-level and duty-sourced Beastmaster familiars.", level: "30–50", tags: ["beastmaster", "familiar actions", "kin", "borrow", "crucible"], order: 33, references: beastReferences,
    content: `## Higher-level action directory
Later familiars add strong control, resistance manipulation, burst attacks, and defensive options needed for advanced boards. No single trio answers every encounter: inspect the enemy panel before a Crucible fight and select the familiars whose damage type, element, control, and survival tools answer it.

${familiarActionTable(26, 50)}

## Comparison checklist
- [ ] Identify the familiar that supplies the encounter's required interrupt, control, or resistance answer.
- [ ] Keep a durable familiar available while learning an unfamiliar mechanic.
- [ ] Pair resistance-lowering effects with matching follow-up damage.
- [ ] Do not spend every Tempered Release before a boss or dangerous elite.
- [ ] Rank frequently used familiars on a board whose sync does not waste their experience.

The action text is an index. The live enemy panel and Master's Bestiary remain authoritative for patch changes and exact combat values.`,
  },
  {
    ...common, slug: "beastmaster-battlehorn-teams", parentSlug: "beastmaster", type: "article", category: "Beastmaster", title: "Battlehorn Teams and Familiar Combinations",
    summary: "Practical three-horn teams, larger Crucible rosters, control choices, damage coverage, and substitution rules.", level: "18–50", tags: ["beastmaster", "battlehorn", "team", "familiars", "combos"], order: 42, references: beastReferences,
    content: `## Three active horns versus a Crucible roster
Normal Beastmaster combat swaps between familiars assigned to three battlehorns. The Crucible can take a larger roster, but each encounter still rewards choosing a focused active solution. Extra roster members increase coverage yet can reduce roster-size score bonuses and split experience.

## Useful team patterns
| Goal | Familiar pattern | Why it works |
| --- | --- | --- |
| Safe learning | Durable tank-style familiar + control familiar + flexible damage | Moves pressure off the player while preserving a mechanic answer |
| Control | Chimera or Ziz + resistance-matched damage + sustain | Deep Freeze or Petrify prevents more damage than a small damage increase |
| Elemental burst | Resistance-lowering familiar + two matching attackers | Converts one setup into a coordinated damage window |
| Physical coverage | Slashing + piercing + blunt options | Answers board panels that punish one physical type |
| Kin objective | Three compatible familiars from one kin with distinct roles | Progresses Kin Gambit goals without giving up every utility slot |

## Recommended early roster foundation
Capture broad, accessible tools rather than chasing only bosses. Squirrel supplies speed support; Ziz offers long control; Adamantoise offers physical protection; Gigantoad can draw and hinder a target; Coeurl supports lightning pressure; Raptor supports fire pressure. Later, Chimera supplies powerful Deep Freeze, Ice Golem supports magic-oriented teams, and durable options such as Behemoth, Cu Sith, or Adamantoise can absorb learning pressure when used with Snarl.

## Build a team from the encounter panel
1. Read elemental and physical/magical weaknesses before engaging.
2. Check interrupt, sleep, bind, stun, petrify, and Deep Freeze susceptibility.
3. Select one primary damage plan and one control or survival plan.
4. Confirm the Borrow chain and familiar actions can actually execute that plan.
5. Re-select familiars after every encounter; the interface can leave no horns selected if you advance too quickly.

## Substitution rules
- Missing Chimera: use Ziz where Petrify is accepted, or replace control with a durable Snarl target.
- Missing an ideal element: favor correct physical/magical type and control instead of a resisted high-level familiar.
- Struggling to survive: replace the weakest redundant attacker with mitigation, sustain, or a durable familiar.
- Struggling with time: retain the mechanic answer and replace excess defense, not the sole interrupt or control tool.

Use [[beastmaster-familiar-actions-001-025|Actions 1–25]] and [[beastmaster-familiar-actions-026-050|Actions 26–50]] to compare exact commands.`,
  },
  {
    ...common, slug: "beastmaster-crucible-boards", parentSlug: "beastmaster", type: "article", category: "Crucible", title: "Crucible Boards, Degrees, and Scoring",
    summary: "Board-by-board preparation, safe routing principles, duty actions, roster ranks, scoring conditions, and progression rewards.", level: "30–50", tags: ["beastmaster", "crucible", "boards", "degrees", "leaderboard", "scoring"], order: 44, references: beastReferences,
    content: `## Board progression
| Board | Sync and entry expectation | Main purpose |
| --- | --- | --- |
| First Board of the Unbroken | Level 30; beast rank sync 5 | Teaches board routing, Challenge/Snarl, camps, items, and roster selection |
| Second Board of the Unbroken | Level 40; beast rank sync 10 | Demands more deliberate duty-action and familiar juggling |
| Third Board of the Unbroken | Level 50; item level 100; beast rank sync 15 | Exposes weak gear and an untrained roster |
| First Master's Board | Level 50; item level 120; beast rank sync 20 | Advanced mechanics and a substantial equipment check |
| Second Master's Board | Level 50; item level 135; beast rank sync 25 | Final board, ranking preparation, and strongest roster check |

The first three boards are required by the Beastmaster story. The two Master's Boards unlock afterward. Do not enter a higher board merely because Beastmaster reached 50: meet its equipment and familiar-rank expectations.

## Before each encounter
Click the enemy piece and read the red weakness and resistance text. It reveals element, physical/magical type, interruptibility, and status vulnerabilities. Change the selected familiars before engaging. **Challenge** forces the enemy onto the player; **Snarl** makes the familiar tank and suppresses the player's enmity generation while active.

## First-board safe foundation
A broad learning roster can include Ice Golem, Opo-opo, Gigantoad, Coeurl, Geshunpest, Behemoth, Cu Sith, Zu, Adamantoise, and Colibri. This is coverage, not a mandatory fixed team. Select only the familiars needed for the next piece. Durable Snarl targets help while learning; Chimera or Ziz can replace damage with control once available.

## Camps, items, and routing
Camps divide their healing among selected recipients. Selecting no familiars can direct the camp's recovery to the player. Coins, consumables, feed, and temporary beast gear disappear at run end, so spend them for the current route. Board bonuses can reward either avoiding or heavily using camps, items, coins, feed, and gear; read the chosen scoring conditions before committing.

## Scoring and Degrees
Score considers optional board bonuses, survival, remaining HP, roster size, restrictions, Kin Gambits, combo counts, and later Degrees. Degrees increase enemy health and damage. Third-degree clears are required for top-end rewards and ranking eligibility. A high score also improves Remnant and familiar-experience returns.

## Familiar leveling
Familiars reach rank 25. Experience depends on clear success, score, roster size, board sync, and experience feed. Use a board whose rank sync is appropriate: repeatedly placing a high-rank familiar into a low-sync board wastes growth potential. Bring fewer familiars when focused experience matters more than coverage.

- [ ] Inspect every enemy before engaging.
- [ ] Re-select horns after every encounter.
- [ ] Use Snarl while learning and Challenge when the player should hold the enemy.
- [ ] Spend run-only resources instead of carrying them past the finish.
- [ ] Separate a first clear from a restricted high-score or Degree attempt.`,
  },
  {
    ...common, slug: "beastmaster-gear-and-upgrades", parentSlug: "beastmaster", type: "article", category: "Beastmaster", title: "Beastmaster Gear, Upgrades, and Stats",
    summary: "Leveling equipment, level-50 Crucible gear, upgrade currency, accessories, food, and practical stat priorities.", level: "1–50", tags: ["beastmaster", "gear", "remnants", "materia", "food", "best in slot"], order: 46, references: beastReferences,
    content: `## Equipment identity
Beastmaster uses **Strength**, striking armor, and slaying accessories, with a one-handed axe and compatible shield. Job quests repeatedly award a weapon, shield, and armor coffer. Equip those rewards as soon as they become available instead of carrying level-1 starter pieces into the Crucible.

## Just reached level 50: go here first
1. Complete **A Beastmaster's Path** and open its item-level-90 coffer while on Beastmaster. Equip the Beastmaster's Hand Axe, Hoplon, Horns, Furs, Armguards, Slops, and Boots.
2. Go to the **Kornago Merchant in Central Shroud (X:21.9, Y:22.6)**, beside the Crucible entrance. This is the upgrade NPC for the entire Beastmaster set.
3. Run the **Third Board of the Unbroken** to begin earning Bright Remnants of Resilience. The level-30 and level-40 boards award Faded Remnants, which the same merchant converts at **2 Faded to 1 Bright**.
4. Continue the level-50 Beastmaster quests and clear the **First Master's Board** and **Second Master's Board** as they unlock. These are the duties that advance the intended gear path and award more Bright Remnants.
5. Upgrade in the practical order **axe and shield → body and legs → head, hands, and feet**. If an upgrade is already affordable, taking it immediately is normally better than saving while struggling against the next board.
6. Fill the accessory slots with the temporary Poetics/Coil set below, then replace the earring with Beastmaster's Earrings after completing its Crucible achievement.

## Leveling checkpoints
| Level | Practical gear source |
| --- | --- |
| 1–29 | Job-quest weapons and coffers plus level-appropriate striking/slaying pieces |
| 30 | Beast Tamer equipment from Into the Crucible before the First Board |
| 40 | Beastwarden equipment from Gobsmacked before the Second Board |
| 50 story | Beastmaster weapon, shield, and item-level-90 coffer from A Beastmaster's Path |
| 50 Crucible | Upgrade the Beastmaster set through Crucible rewards toward later-board item-level requirements |

## Level-50 upgrade ladder
| Stage | Item level | Bright Remnants for the seven-piece stage | Gate |
| --- | --- | --- | --- |
| Base Beastmaster set | 90 | Quest reward | A Beastmaster's Path |
| Beastmaster set +1 | 100 | 74 | A Beastmaster's Path |
| Beastmaster set +2 | 110 | 88 | Free for All |
| Beastmaster set +3 | 120 | 102 | Free for All |
| Beastmaster set +4 | 130 | 116 | Mastery Rematch |
| Guttler and Kornago Hoplon | 135 | 20 axe + 16 shield after +4 | Mastery Rematch |

Reaching +4 across the axe, shield, and five armor pieces costs **380 Bright Remnants** from the base set. Converting the +4 axe and shield into the item-level-135 Guttler and Kornago Hoplon adds **36**, for **416 Bright Remnants total**. Weekly Crucible Challenge Log objectives also award Remnants, so claim them before repeatedly farming a board without the weekly bonus.

## Which duties are actually required?
| Duty or activity | Why run it | Required for the intended best set? |
| --- | --- | --- |
| Third Board of the Unbroken | Bright Remnants and progression toward the Master's Boards | Yes |
| First Master's Board | Bright Remnants, quest/upgrade progression, and endgame achievements | Yes |
| Second Master's Board | Bright Remnants and final Crucible achievements | Yes |
| First and Second Boards | Story clears, familiar ranks, and Faded Remnants that convert to Bright | Required for progression, but not the main level-50 farm |
| Final Coil of Bahamut – Turn 1 | Dreadwyrm accessory drops, especially the Fending choker and a temporary Fending earring | Only for accessory min-maxing; not required for Beastmaster armor or weapons |
| Any other Coil turn, alliance raid, trial, or dungeon | No piece required by the current Beastmaster endgame set | No |

**Coil is not a prerequisite for the Beastmaster job set.** If farming Final Coil Turn 1, use an unrestricted high-level party when practical. Its loot pool is large, so the desired accessory may take repeated clears. A Poetics accessory is an acceptable substitute if the difference is not worth the farm.

## Current Patch 7.56 practical best-in-slot route
| Slot | Long-term target | Interim or alternate source |
| --- | --- | --- |
| Axe and shield | Item-level-135 achievement weapons: Beastliege set from **Friend to the Fierce V** or the identical-stat Guttler Unleashed/Augmented Kornago set from **Crucible Master** | Upgrade the quest axe and shield through +4, then Guttler/Kornago Hoplon |
| Head, body, hands, legs, feet | Beastmaster job armor +4 | Use each earlier job-armor stage while upgrading; do not farm Coil armor for the finished Crucible set |
| Earrings | Beastmaster's Earrings from **Unbroken Endgame**: clear the first three boards and both Master's Boards under the third degree | Dreadwyrm Earring of Fending from Final Coil Turn 1 |
| Necklace | Dreadwyrm Choker of Fending from Final Coil Turn 1 | An Augmented Ironworks Strength accessory is the convenient Poetics substitute |
| Bracelet | Augmented Ironworks Bracelet of Slaying | A suitable item-level-130 Dreadwyrm Strength bracelet if already owned |
| Rings | Augmented Ironworks Ring of Slaying plus Dreadwyrm Ring of Slaying from Final Coil Turn 1 | Two suitable item-level-130 Strength rings while farming |

Achievement weapons have item level 135, five materia slots, and stronger Crucible bonuses than the normal relic pair. The two achievement weapon routes have identical base stats, so use whichever achievement is completed first. **Friend to the Fierce V** requires every familiar at beast rank 25; **Crucible Master** requires Legendary rank on all three regular boards and both Master's Boards.

## Why the job set matters
The level-50 Beastmaster set gains Crucible-specific Strength and Vitality that remain fully effective through level and item-level sync, plus unusually strong defenses. Ordinary Ironworks or raid armor can bridge an early gap, but it is not the finished left-side set. Upgraded Beastmaster armor is the intended long-term solution for the Master's Boards; accessories are the primary place to use strong outside pieces.

## Remnants and upgrades
Crucible clears award Bright and Faded Remnants used for job-gear upgrades; Faded Remnants exchange into Bright at the current vendor rate. Weekly Challenge Log rewards contribute to progression. Upgrade the pieces that help meet the next board's item-level and survival requirement rather than spending currency only for appearance rewards.

## Stats, materia, and food
Use **Strength → Critical Hit → Direct Hit → Determination → Skill Speed to comfort** as the current baseline. Strength, item level, and the Beastmaster set's Crucible bonuses matter more than small substat swaps. Familiar interactions can still move theorycrafted substat recommendations as Patch 7.56 testing matures, so keep valuable Fending and Slaying accessories rather than discarding them immediately. Use materia only on pieces that will not lose it to sync. Rock-fisted Popoto Stew is the current high-end food reference, while inexpensive Vegetable Soup provides a similar practical benefit at level 50.

- [ ] Equip both axe and shield upgrades from every job milestone.
- [ ] Fill every accessory slot with current slaying equipment.
- [ ] Visit the Kornago Merchant at Central Shroud (X:21.9, Y:22.6).
- [ ] Complete the weekly Crucible Challenge Log entries before open-ended farming.
- [ ] Farm Final Coil Turn 1 only if pursuing the Dreadwyrm accessory improvements.
- [ ] Upgrade job armor before attempting the item-level-120 and 135 Master's Boards.
- [ ] Keep a durable progression set even if a lower-defense piece has attractive substats.
- [ ] Recheck food, repairs, familiar ranks, and roster before blaming a board mechanic.`,
  },
  {
    ...common, slug: "limited-job-collection-routes", parentSlug: "limited-jobs", type: "article", category: "Limited Jobs", title: "Efficient Spell and Familiar Collection Routes",
    summary: "Group Blue Mage spells by duty and Beastmaster familiars by region so one trip or clear advances several collection goals.", level: "1–80", tags: ["route", "spell farm", "familiar capture", "dungeons", "coordinates"], order: 30, references: [...blueReferences, ...beastReferences],
    content: `## Use the interactive directories
Open a spellbook or bestiary page, switch to **Missing only**, and type a zone or duty name. Mark entries complete as they are learned or captured. Progress is kept in this browser; it is personal local guide state and is not sent to the portal database.

## Blue Mage priority route
1. Learn a fast tag such as **Flying Sardine**, a heal, and basic area damage.
2. Collect open-world utility needed for later farms: Sticky Tongue, Toad Oil, Bristle, Whistle, and compatible elemental fillers.
3. Build the **Hydro Pull → Ram's Voice → Ultravibration** farming set as their levels and sources become available.
4. Complete job-requested spells before each ten-level quest milestone.
5. Farm same-duty clusters with a premade group and delay the kill until every desired enemy action is seen.

### High-value multi-spell clusters
| Route | Examples to check together |
| --- | --- |
| Pharos Sirius family | Flying Frenzy, Song of Torment, Sonic Boom, and Aetheric Mimicry sources |
| The Great Gubal Library family | The Look, Abyssal Transfixion, Magic Hammer, Level 5 Death, and Condensed Libra sources |
| Saint Mocianne's Arboretum family | Avail, Devour, and Feculent Flood sources |
| The Peaks | Tail Screw, Alpine Draft, Whistle, Launcher, and Ultravibration open-world targets |
| Amh Araeng | Schiltron and Rehydration targets |

The directory lists alternate sources; the spells in a cluster may belong to normal and Hard variants or different enemies. Search the exact duty text and read every row before entering.

## Beastmaster regional sweep
Capture open-world familiars in level order while moving through the dense ARR regions. A practical geographic pass is **Central Shroud → Middle/Lower/Western La Noscea → Central/Western/Southern Thanalan**, then the remaining Shroud and La Noscea zones. Central Shroud and Middle La Noscea contain the largest early concentrations; the bestiary filters expose their exact coordinates.

### Duty pairs and later captures
- **Cutter's Cry:** Antling from the first boss and Chimera from the final boss.
- **The Lost City of Amdapor:** Damselfly and the other listed duty familiar can be planned in the same unlock/farm session.
- Queue duty captures only after meeting their minimum Beastmaster level and confirming the exact enemy or section.
- Compare quest-gourd alternatives before repeating a long duty.

## Group-session checklist
- [ ] Filter the relevant directory to Missing only.
- [ ] List every target in the zone or duty before travel.
- [ ] Confirm level, exact enemy, required cast/capture condition, and gourd alternative.
- [ ] Keep targets alive until the spell cast or capture attempt completes.
- [ ] Verify the spellbook or bestiary entry before leaving.
- [ ] Use a new filter for the next zone rather than relying on memory.`,
  },
];
