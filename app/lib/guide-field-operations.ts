import type { BuiltInGuide, GuideReference } from "./guide-library";
import data from "./field-operation-data.json";

type Row = Record<string, unknown>;
const clean = (value: unknown) => String(value ?? "").replaceAll("|", " / ").replaceAll("\n", " ").trim() || "—";
const table = (headers: string[], body: unknown[][]) => "| " + headers.join(" | ") + " |\n| " + headers.map(() => "---").join(" | ") + " |\n" + body.map((row) => "| " + row.map(clean).join(" | ") + " |").join("\n");
const md = (...parts: string[]) => parts.join("\n");
const rows = (key: "logosActions" | "logograms" | "lostActions" | "forgottenFragments") => data[key] as Row[];
const ref = (label: string, url: string): GuideReference => ({ label, url });
const eurekaRefs = [
  ref("Official Eureka and Baldesion Arsenal introduction", "https://na.finalfantasyxiv.com/lodestone/topics/detail/95df41997b344e4804fdb639a7961a967392d9d0"),
  ref("Logos Actions directory", data.sources.logosActions),
  ref("Logogram acquisition directory", data.sources.logograms),
];
const bozjaRefs = [ref("Lost Actions directory", data.sources.lostActions), ref("Forgotten Fragment acquisition directory", data.sources.forgottenFragments)];
const occultRefs = [
  ref("Official Patch 7.25 notes", "https://na.finalfantasyxiv.com/lodestone/topics/detail/6e4b5a23048ddb2569b12f8567baf7e8a2f370d9/"),
  ref("Official Patch 7.55 notes", "https://na.finalfantasyxiv.com/lodestone/topics/detail/f892390a6ec7a958222c739d2a79822899786240"),
];
const common = { type: "article" as const, expansion: "Multiple", audience: "Combat", imageUrl: "/guides/field-operations.svg", verifiedPatch: data.verifiedPatch, verifiedOn: data.verifiedOn };
function guide(slug: string, parentSlug: string, category: string, title: string, summary: string, order: number, content: string, references: GuideReference[], level = "70–100"): BuiltInGuide {
  return { ...common, slug, parentSlug, category, title, summary, order, content, references, level, tags: [category.toLowerCase(), "field operations", "complete guide"] };
}

const logos = rows("logosActions");
const lost = rows("lostActions");
const logosGuides = [[1, 28], [29, 56]].map(([from, to], index) => guide(
  "eureka-logos-action-directory-" + String(from).padStart(3, "0") + "-" + String(to).padStart(3, "0"),
  "eureka-field-guide", "Eureka Systems", "Logos Action Directory: " + from + "–" + to,
  "Exact role restrictions, timing, uses, and effects for Logos Actions " + from + " through " + to + ".", 32 + index,
  md(
    "## Complete action directory",
    "Registering Logos Actions with Drake advances Pyros weapon and Elemental Armor requirements. The **Acquired** column identifies eligible jobs or roles; it is not the Logogram recipe. Use the Logogram Acquisition guide for the source family and mneme pool.",
    "",
    table(["No.", "Action", "Eligible roles", "Cast / recast", "Range / radius", "Uses", "Effect"], logos.slice(from - 1, to).map((entry) => [entry.index, entry.name, entry.acquired, clean(entry.cast) + " / " + clean(entry.recast), entry.rangeRadius, entry.uses, entry.description])),
    "",
    "## Loadout rules",
    "- [ ] Keep an appropriate Wisdom active; replacing it ends the previous Wisdom.",
    "- [ ] Carry Spirit of the Remembered where death would remove you from the run.",
    "- [ ] Assign Perception, Sacrifice, Dispel, Bravery, and support tools across the group.",
    "- [ ] Store duplicate plates when the run calls for swaps between encounters.",
    "- [ ] Follow the organizer's required Baldesion Arsenal plate list even when a solo setup has higher personal damage."
  ), eurekaRefs, "70",
));

const logogramGuide = guide("eureka-logogram-acquisition-directory", "eureka-field-guide", "Eureka Systems", "Logogram Acquisition and Mneme Directory", "Every Logogram family with its Pyros/Hydatos sources and the mnemes it can appraise into.", 34,
  md(
    "## From Logogram to Logos Action",
    "Take Logograms to **Drake** beside the Logos Manipulator in Pyros or Hydatos. Appraisal converts each Logogram into one random mneme from that family's pool. Combine one to three mnemes at the Logos Manipulator to discover and create Logos Actions. Register each new action with Drake before discarding duplicates.",
    "",
    table(["Logogram", "Where to obtain it", "Possible mnemes"], rows("logograms").map((entry) => [entry.name, entry.acquisition, entry.mnemes])),
    "",
    "## Efficient collection plan",
    "- [ ] Farm sprites only during their required weather and at a safe elemental level.",
    "- [ ] Use bunny coffers, lockboxes, NMs, and the market board for families that are slow to target.",
    "- [ ] Appraise in batches, then compare missing Action Log entries before combining mnemes.",
    "- [ ] Preserve rare mnemes for Perception, Sacrifice, Spirit of the Remembered, Double Edge, and assigned plates.",
    "- [ ] Register 10, 20, and 30 unique actions for weapons; Elemental Armor later requires 50 and then all 56."
  ), eurekaRefs, "70");

const lostGuides = [[1, 50], [51, 99]].map(([from, to], index) => guide(
  "bozja-lost-action-directory-" + String(from).padStart(3, "0") + "-" + String(to).padStart(3, "0"),
  "bozja-field-guide", "Bozja Systems", "Lost Action Directory: " + from + "–" + to,
  "Complete effects, roles, uses, holster weight, and timings for Lost Actions " + from + " through " + to + ".", 32 + index,
  md(
    "## Complete action directory",
    "Lost Actions are stored in the Lost Finds Cache, moved into the capacity-limited holster, and assigned to duty-action slots where applicable. Item-related entries are consumed directly. **Weight** matters when assembling a run kit; **uses** are consumed until restocked.",
    "",
    table(["No.", "Category", "Action", "Eligible roles", "Cast / recast", "Uses / weight", "Effect"], lost.slice(from - 1, to).map((entry) => [entry.index, entry.category, entry.name, entry.acquired, clean(entry.cast) + " / " + clean(entry.recast), clean(entry.uses) + " / " + clean(entry.weight), entry.description])),
    "",
    "## Selection rules",
    "- [ ] Activate an appropriate Essence before choosing short-duration actions.",
    "- [ ] Carry required utility: Perception for traps, Dispel for removable buffs, and suitable recovery.",
    "- [ ] Balance holster weight against replacement uses for long duties.",
    "- [ ] Bring damage amplification for farm groups; unboosted jobs make old large duties unnecessarily slow.",
    "- [ ] Treat Pure Essences and rare fragments as organized-raid resources unless the plan calls for them."
  ), bozjaRefs, "71–80",
));

const fragmentGuide = guide("bozja-forgotten-fragment-directory", "bozja-field-guide", "Bozja Systems", "Forgotten Fragment Acquisition Directory", "All 36 Forgotten Fragment families, their precise acquisition routes, rank bands, and possible Lost Actions.", 34,
  md(
    "## Appraisal workflow",
    "Forgotten Fragments drop from named enemy ranks, skirmishes, critical engagements, quests, raids, clusters, and selected vendors. Appraise them at a Lost Finds appraiser; each appraisal yields one random action from that fragment's pool.",
    "",
    table(["Rank band", "Fragment", "Acquisition sources", "Possible Lost Actions"], rows("forgottenFragments").map((entry) => [entry.rankBand, entry.name, entry.acquisition, entry.actions])),
    "",
    "## Farming plan",
    "- [ ] Filter by the action needed, then farm only fragments whose pool contains it.",
    "- [ ] Prefer clusters or direct duty rewards when the open-world route is contested.",
    "- [ ] Appraise before entry and move sufficient uses into the holster.",
    "- [ ] Keep raid-only Pure Essence and recovery fragments for organized Savage runs.",
    "- [ ] Share surplus tradable fragments instead of obscuring missing families."
  ), bozjaRefs, "71–80");

const castrum = guide("bozja-castrum-lacus-litore-complete", "bozja-field-guide", "Bozja Systems", "Castrum Lacus Litore Complete Run Guide", "Entry, simultaneous opening bosses, prisoner routes, Adrammelech, Dawon, Lyon, rewards, and failure recovery.", 40,
  md(
    "## Entry and preparation",
    "Unlock Castrum through the Southern Front story at Resistance rank 10 and register when the special engagement appears. The duty supports up to 48 players and scales for smaller groups. Enter with an Essence, damage actions, recovery, and Lost Death if the group uses it on eligible prisoner enemies. The initial timer is 20 minutes and successful objectives add time.",
    "",
    "## Grand Gates: Brionac and 4th Legion Helldiver",
    "Split the raid into balanced **top** and **bottom** groups before either pull. Both encounters must engage close together. When one side finishes, it handles spawning adds while the other completes its boss. Announce percentages if one side is far ahead.",
    "",
    "## Albeleo and the six prisoner routes",
    "Defeat Albeleo and its adds, then immediately divide into six assigned branches. Northwest, southwest, northeast, and southeast are upstairs; west and east remain on the ground floor. Each route searches its cells and kills the executioner before the prisoner dies. Stuns and eligible death effects buy time. Saved prisoners determine personal reward coffers.",
    "",
    "## Adrammelech",
    "Read the elemental orbs before they resolve. Only three elemental patterns appear in an instance, but combinations change. Identify the safe relationship between active elements rather than following the crowd late. Mitigate raidwides and keep targeted damage away from stacks.",
    "",
    "## Dawon and Lyon",
    "Dawon uses pounce, crossfire, and arena-denial patterns. Assigned players enter Lyon's separate encounter while the main raid controls Dawon. Follow the organizer's Lyon assignment and never enter unasked.",
    "",
    "## Completion checklist",
    "- [ ] Loot every personal coffer before moving on.",
    "- [ ] Assign all six prisoner routes before the rescue begins.",
    "- [ ] Retain an Essence and useful actions through the final encounter.",
    "- [ ] Use coins, fragments, notes, and relic materials according to the current vendor or quest step.",
    "- [ ] Rebalance a failed opening split before the next registration."
  ), [...bozjaRefs, ref("Castrum Lacus Litore encounter reference", "https://ffxiv.consolegameswiki.com/wiki/Castrum_Lacus_Litore")], "80");

const delubrum = guide("bozja-delubrum-reginae-complete", "bozja-field-guide", "Bozja Systems", "Delubrum Reginae Complete Run Guide", "Every normal-mode encounter, Twice-come Ruin, traps, personal loot, relic drops, and Lost Action preparation.", 41,
  md(
    "## Entry and loadout",
    "Unlock Delubrum through the post-Castrum story and queue from Gangos. Bring an Essence and offensive actions; the duty is balanced around Lost Action use. Carry Lost Perception for hallway traps and recovery appropriate to the job.",
    "",
    "## Twice-come Ruin",
    "Avoidable failures apply Once-come Ruin, then Twice-come Ruin. Another failure converts the sequence into Doom. Stop attacking when necessary and solve the mechanic; healing cannot compensate for the final Doom.",
    "",
    "## Trinity Seeker and Dahu",
    "Trinity Seeker changes weapons. Read the weapon before resolving arcs, knockbacks, and movement patterns; use barricades when the blade pattern calls for them. Dahu is a shorter encounter with charges and large area attacks. Loot both personal coffers.",
    "",
    "## Queen's Guard",
    "The four guards teach mechanics that return later: knight sword/shield tells, warrior bombs, soldier forced movement, and gunner shots. Read the active guard and resolve paired mechanics in sequence.",
    "",
    "## Bozjan Phantom and Trinity Avowed",
    "Use Lost Perception before trapped halls. The Phantom combines marching restrictions with arena attacks. Trinity Avowed assigns temperature stacks: fire and ice mechanics adjust the gauge in opposite directions. Match the incoming element to the adjustment required.",
    "",
    "## The Queen",
    "The final encounter recombines guard mechanics. Chess pieces move according to facing and number of squares; stand where they will not finish. Sword and shield omens require out or in movement while later combinations overlap charges and guard attacks.",
    "",
    "## Rewards and checklist",
    "The Queen's coffer supplies relic materials for applicable active steps, coins, notes, and possible collection rewards. Delubrum uses personal loot.",
    "- [ ] Equip an Essence before the first pull.",
    "- [ ] Carry enough action uses for the full run.",
    "- [ ] Prioritize avoiding the second Ruin stack over uptime.",
    "- [ ] Use Perception before teammates enter an unchecked hallway.",
    "- [ ] Verify the relic quest is active before repeat clears."
  ), [...bozjaRefs, ref("Delubrum Reginae encounter reference", "https://ffxiv.consolegameswiki.com/wiki/Delubrum_Reginae")], "80");

const dalriada = guide("bozja-dalriada-complete", "bozja-field-guide", "Bozja Systems", "The Dalriada Complete Run Guide", "Rank requirements, simultaneous routes, hallway controls, every boss, rewards, field notes, and recovery planning.", 42,
  md(
    "## Entry",
    "Reach Resistance rank 25, complete **March of the Bloody Queen**, and register when the Dalriada appears in Zadnor. It supports up to 48 players, applies Echo to significantly undersized groups, begins with 20 minutes, and adds time after encounters.",
    "",
    "## Sartauvoir and lower gauntlet",
    "Assign a balanced hoverbike group for Sartauvoir while the remainder handles the lower sequence. Pull together. Sartauvoir's clock tiles require the slow or reverse pattern, while phoenix lines, crosses, meteors, and cleaves overlap. The lower group resolves Blackburn memory panels, Augur meteor soaks, and paired-beast knockback/orb patterns. Send fewer than eight upward when the raid is small.",
    "",
    "## 4th-make Cuchulainn",
    "Read forced-march and misdirection icons before movement locks. Use transformation puddles for Fleshy Necromass, spread Fell Flow cones, and move through ordered Ambient Pulsation rows.",
    "",
    "## Hallway control",
    "Split left and right while four assigned players remain on control-room floor panels. They keep electrified floors disabled and call lasers. Corridor groups avoid gates/knockbacks, defeat enemies, and press endpoint switches together.",
    "",
    "## Saunion and Dawon",
    "Separate the bosses so their tether does not empower them. Read Saunion's moving halo/cross patterns with Dawon's leap order, point-blank, donut, and conal attacks. Their HP is effectively shared.",
    "",
    "## Diablo Armament",
    "Move through alternating lasers and then into the previous safe lane as trails explode. Trace Diabolic Gate images, get inside Ultimate Pseudoterror, destroy tethered Aetheric Boom orbs before collision, and stop all movement/actions for Acceleration Bomb. Advanced Death IV is lethal.",
    "",
    "- [ ] Confirm top/bottom and hallway/control assignments.",
    "- [ ] Keep an Essence and useful Lost Actions active.",
    "- [ ] Loot every personal coffer.",
    "- [ ] Exchange Mythril and Platinum coins only after checking the desired reward.",
    "- [ ] Record missing field notes by exact encounter."
  ), [...bozjaRefs, ref("Dalriada encounter reference", "https://ffxiv.consolegameswiki.com/wiki/The_Dalriada")], "80");

const blood = guide("occult-forked-tower-blood-complete", "occult-crescent-guide", "Occult Crescent", "Forked Tower: Blood Complete Preparation Guide", "Entrance, mandatory phantom jobs, resurrection, traps, four bosses, secret rooms, support, and rewards.", 40,
  md(
    "## Entry and roster",
    "Unlock the South Horn tower through **Past and Crescent** and enter during the required auroral conditions. Boss scaling begins from 24 players and mechanics require at least 24. Build six assigned parties, max required phantom jobs, repair gear, and follow organizer calls.",
    "",
    "## Resurrection and jobs",
    "Normal resurrection is restricted. Phantom White Mage/Chemist recovery and healer limit break are finite; repeated deaths eventually cause Resurrection Denied. Required assignments include thieves for traps/locks, rangers for remote disarming, dispellers, crowd control, and raid mitigation.",
    "",
    "## Boss progression",
    table(["Encounter", "Core responsibility"], [
      ["Demon Tablet", "Respect the divided arena, assigned half, fall hazards, and changing geometry"],
      ["Dead Stars", "Stay with the assigned boss/debuff group and cleanse hot/cold states correctly"],
      ["Marble Dragon", "Resolve water/ice chains, towers, golems, sprites, Wicked Water freezes, and gaol rescues"],
      ["Magitaur", "Remain inside assigned squares; resolve axe spreads and lance stacks without lighting another section"],
    ]),
    "",
    "Avoidable hits apply Thrice-come Ruin; the third stack becomes Doom. Wait for thieves/rangers to reveal or disarm traps. Binding locks require assigned groups. Secret nooks and the observatory puzzle add personal coffers and enable outside support.",
    "",
    "## Rewards and checklist",
    "A full route with personal coffers yields Sanguinite; the outside Sanguine Recluse enables an additional final coffer.",
    "- [ ] Use the organizer-approved job and phantom job.",
    "- [ ] Load shared waymarks and read party assignments.",
    "- [ ] Confirm raise, trap, dispel, mitigation, and crowd-control coverage.",
    "- [ ] Loot each personal coffer before teleporting.",
    "- [ ] Use the organizer's current position sheet for exact high-end strategies."
  ), [...occultRefs, ref("Forked Tower: Blood reference", "https://ffxiv.consolegameswiki.com/wiki/The_Forked_Tower:_Blood")], "100");

const magic = guide("occult-forked-tower-magic-complete", "occult-crescent-guide", "Occult Crescent", "Forked Tower: Magic Complete Run Guide", "Normal entry, phantom utility, hidden coffers, four bosses, elemental weaknesses, and Index mechanics.", 41,
  md(
    "## Unlock and entry",
    "Reach knowledge level 40 and complete **In the Shadow of the Tower**. Normal mode scales from one entrant, though a balanced group is safer. Enter from the North Horn node during the auroral window with a leveled phantom job, food, and repaired gear.",
    "",
    "## Utility and exploration",
    "Phantom Thief reveals hidden coffers and opens locked doors before the final boss. Normal mode has laser floors and hidden coffers but no hidden explosive traps. Before the final boss, swap to the phantom job that should receive clear EXP.",
    "",
    "## Boss progression",
    table(["Encounter", "Core mechanic"], [
      ["Two-headed Aevis", "Blue/green assignment; breath, knockback, orb element, portal lines, and tankbusters"],
      ["Sword Dancer", "Rotating swords, inside/outside circles, ordered gashes, knockbacks, and facing lines"],
      ["Necrophobia", "Head elements/facing, fire circles, ice lines, lightning cones, and Dark Current"],
      ["The Index", "Glowing weapon, elemental sectors, rotating crystals, knockbacks, adds, and outer platforms"],
    ]),
    "",
    "Sword Dancer is weak to lightning, Necrophobia to ice, and the Index to fire/wind phantom actions. Walls and the central hole can cause fatal falls.",
    "",
    "- [ ] Loot each coffer before using the next sigil.",
    "- [ ] Search dead ends only until that section's hidden coffer is found.",
    "- [ ] Use elemental weaknesses deliberately.",
    "- [ ] Level the desired phantom job before the final boss dies.",
    "- [ ] Track 1, 5, 20, and 50 clears for achievements."
  ), [...occultRefs, ref("Forked Tower: Magic reference", "https://ffxiv.consolegameswiki.com/wiki/The_Forked_Tower:_Magic")], "100");

const magicExtreme = guide("occult-forked-tower-magic-extreme-complete", "occult-crescent-guide", "Occult Crescent", "Forked Tower: Magic (Extreme) Preparation Guide", "Premade entry, mandatory phantom jobs, restricted raises, traps, Thrice-come Ruin, bosses, and outside support.", 42,
  md(
    "## Premade entry",
    "All players need knowledge level 40 and **In the Shadow of the Tower**. Form at least three parties with 12 players before speaking with Jeffroy. The leader enters an Extreme North Horn instance; gather at (X:15.0, Y:29.9) during the setup window. The duty syncs to item level 700.",
    "",
    "## Resurrection and locking",
    "Players begin with three Resurrection Restricted stacks. Approved phantom raises or healer limit break consume one; after all are gone, another death cannot be recovered. The outside Hermetic Recluse puzzle can restore one stack to living players. Job changes are limited to the starting room except for the relevant Freelancer privilege.",
    "",
    "## Required functions",
    table(["Function", "Typical coverage"], [
      ["Dispel", "Time Mage or Necromancer on each side for Tower Barmuus"],
      ["Traps", "Ranger for remote disarm; Thief for detection, coffers, and locks"],
      ["Stun/buffs", "Bard coverage for Storm Generators and party support"],
      ["Mitigation", "Multiple Dancers plus Summoner or Blue Mage shields"],
      ["Recovery", "Assigned White Mages or Chemists"],
      ["Damage", "Mystic Knight, Samurai, Black Mage control, and elemental actions"],
    ]),
    "",
    "Boss identities match normal mode but add harder overlaps, side assignments, trash responsibilities, and fatal traps. Avoidable hits apply Thrice-come Ruin; the third causes Doom. Buff limits can discard important mitigation.",
    "",
    "- [ ] Use shared waymarks and the approved phantom job.",
    "- [ ] Confirm dispel, trap, stun, shield, recovery, and elemental coverage.",
    "- [ ] Remove unneeded buffs if warned about the status cap.",
    "- [ ] Never approach a trap before the route is declared safe.",
    "- [ ] Treat normal mode as study, not proof an Extreme roster is ready."
  ), [...occultRefs, ref("Forked Tower: Magic (Extreme) reference", "https://ffxiv.consolegameswiki.com/wiki/The_Forked_Tower:_Magic_(Extreme)")], "100");

export const FIELD_OPERATION_GUIDES: BuiltInGuide[] = [
  ...logosGuides, logogramGuide, ...lostGuides, fragmentGuide,
  castrum, delubrum, dalriada, blood, magic, magicExtreme,
];
