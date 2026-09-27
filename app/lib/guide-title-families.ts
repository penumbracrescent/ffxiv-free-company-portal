type Reference = { label: string; url: string };

const article = (
  slug: string,
  title: string,
  summary: string,
  audience: string,
  tags: string[],
  content: string,
  references: Reference[],
  order: number,
) => ({ slug, parentSlug: "achievement-title-journeys", type: "article" as const, category: "Title Journey", title, summary, expansion: "Multiple", level: "1–100", audience, tags, imageUrl: "/guides/relic-stage-route.svg", content, references, order });

export const TITLE_FAMILY_GUIDES = [
  article("battle-duty-title-journey", "Battle, Raid, Trial & Duty Title Journey", "Plan completion, repeat-clear, role, raid, trial, Ultimate, and encounter-specific title achievements without confusing clear conditions.", "Combat", ["battle", "raid", "trial", "ultimate", "duty", "role"],
  `## Read the condition literally
Battle titles can require one clear, many clears, a particular role, minimum item level, level sync, a full premade composition, or a special encounter condition. Open the achievement card and identify the duty, difficulty, role, and counter before forming a party.

## Build the route
- [ ] Unlock the exact normal, Extreme, Savage, Unreal, or Ultimate duty.
- [ ] Finish any required quest chain and verify the duty appears in the correct finder.
- [ ] For repeat clears, confirm one completion advances the counter before scheduling a farm.
- [ ] For role achievements, enter and finish on the required tank, healer, melee, physical-ranged, or magical-ranged job.
- [ ] For synchronized or minimum-item-level conditions, set the finder options before entry; an unrestricted clear may not count.

## Raid and Ultimate projects
Current high-end duties should be learned from current encounter resources and the group's agreed strategy. The portal guide manages prerequisites, achievement wording, and project safety; it does not replace mechanic diagrams or a raid leader. Use a static or scheduled progression group for multi-phase content, declare the intended title condition, and record the clear only after the in-game achievement counter changes.

## Counter safety
Dungeon, trial, and raid counters may share similar names while tracking different duty sets or eras. Roulettes help only when the selected result qualifies. A clear after the weekly reward is already claimed can still count unless the achievement explicitly says otherwise. Historical or removed duties remain in the catalog, so confirm Availability before recruiting.

## Practical weekly plan
Pair one progression duty with one repeat-clear farm. Keep repaired gear, food, and required consumables ready; stop a farm when concentration drops. For time-limited Unreal or seasonal duties, verify the current rotation first. Never advertise a reward or title until the achievement itself confirms completion.`,
  [{label:"Official Duty Finder guide",url:"https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/contents_finder/"},{label:"Official Raid Finder guide",url:"https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/raidfinder/"}], 100),

  article("blue-mage-title-journey", "Blue Mage & Masked Carnivale Title Journey", "Prepare spell sets and fulfill Masked Carnivale feat conditions for Blue Mage achievements without invalidating the run.", "Combat", ["blue mage", "masked carnivale", "perfect blue", "pure azure", "blue mage log"],
  `## Unlock the complete Blue Mage toolkit
Finish **Out of the Blue**, level Blue Mage to the stage requirement, complete its job quests, and learn the spells needed for the chosen act. Blue Mage is a limited job with a separate active-spell loadout; owning a spell does nothing until it is selected among the active actions.

## Carnivale title method
The basic stage-count achievement only requires qualifying clears. Feat titles such as **Perfect Blue**, **The Celestium's Finest**, **Pure Azure**, and **Going for Gold** add precise performance restrictions. Open the weekly target or stage information and read every feat before entering.

- [ ] Build and save a spell set for the specific stage.
- [ ] Include the required damage types, interrupt, cleanse, healing, mitigation, movement, and MP recovery.
- [ ] Check whether the feat limits time, damage taken, healing, vulnerabilities, deaths, or elemental actions.
- [ ] Clear each act under the same valid attempt; a clean final act cannot repair a failed earlier condition.
- [ ] Wait for the results screen and achievement update before changing the set.

## Blue Mage Log
Log achievements require the indicated duties with a qualifying Blue Mage party and the game's stated sync/party conditions. Register with Undersized Party disabled when required. A solo unrestricted spell-learning run is not automatically a Blue Mage Log clear.

## Failure review
If a feat fails, change one variable at a time: spell coverage, burst window, add order, interrupt timing, or avoidable damage. Do not assume a current level cap trivializes a Carnivale condition; scoring rules still apply. Patch changes can alter spell potency and preferred rotations, so the live Blue Magic Spellbook and stage condition are authoritative.`,
  [{label:"Official Blue Mage and Masked Carnivale introduction",url:"https://na.finalfantasyxiv.com/lodestone/topics/detail/5d15fa928de6c3194b6dfde3e5ab7ceb271d9b1f"},{label:"Official Blue Mage Log introduction",url:"https://na.finalfantasyxiv.com/lodestone/topics/detail/c8640b7f57d04db1acf5434d9812b102c455cb79"}], 110),

  article("criterion-variant-title-journey", "Variant & Criterion Title Journey", "Separate route records, Criterion clears, Savage clears, and composite achievements across the V&C dungeon series.", "Combat", ["variant dungeon", "criterion dungeon", "savage", "sil'dihn", "mount rokkon", "aloalo"],
  `## Modes and goals
Variant is flexible story exploration with route records and selectable Variant Actions. The Endwalker families add fixed four-player Criterion and Criterion (Savage). Merchant's Tale instead uses Variant, flexible Advanced, and fixed four-player Criterion, with no separate Savage duty. A clear only satisfies the achievement that names its exact mode.

## Variant route project
- [ ] Read newly unlocked records after each run; records provide clues for alternate branches.
- [ ] Change doors, interactions, dialogue choices, and encounter actions deliberately rather than repeating one route.
- [ ] Use role-appropriate Variant Actions to cover healing, mitigation, raising, or damage.
- [ ] Keep a route checklist and confirm the record number after the duty.

## Criterion and Savage
Form one tank, one healer, and two DPS unless the live finder states otherwise. Learn the normal Criterion mechanics first, assign mitigation and raises, then schedule Savage only after the party can clear consistently. Savage removes much of the recovery margin; a practice clear in another mode is preparation, not title credit.

The titles for Another Sil'dihn Subterrane, Another Mount Rokkon, and Another Aloalo Island require the named Savage clear. **Criterion Core** requires all three source achievements. **Another Merchant's Tale** awards **Literary Cannon** from its Criterion clear; its Advanced clear is a separate achievement.

Use the four linked complete dungeon guides for every route, mount, currency, unlock, and progression checklist:
- [[variant-criterion-sildihn-subterrane|Sil'dihn Subterrane]]
- [[variant-criterion-mount-rokkon|Mount Rokkon]]
- [[variant-criterion-aloalo-island|Aloalo Island]]
- [[variant-criterion-merchants-tale|The Merchant's Tale]]

## Release maintenance
V&C labels and finder tabs can change between patches. The card's exact duty name and the live V&C Dungeon Finder override old menu wording. Before recruiting, publish the mode, progression point, loot plan, and whether the objective is first clear, route completion, or Savage title.`,
  [{label:"Official Variant and Criterion introduction",url:"https://na.finalfantasyxiv.com/lodestone/topics/detail/0210a35806ead4c80482b12a3edd9eb5e4db5bb0"},{label:"Official current V&C finder changes",url:"https://na.finalfantasyxiv.com/lodestone/topics/detail/06944d892fd98cc00b2a28ff77edbafa4f7eef54"}], 120),

  article("pvp-title-journey", "PvP Achievement & Title Journey", "Track Crystalline Conflict, Frontline, Rival Wings, Wolves' Den, and historical ranked titles with explicit seasonal safeguards.", "Combat", ["pvp", "crystalline conflict", "frontline", "rival wings", "ranked", "season"],
  `## Verify availability first
PvP titles are the most maintenance-sensitive collection family. Some count ordinary participation or victories indefinitely; others belong to a past Feast season, a current Crystalline Conflict season, ranking placement, or a temporarily unavailable mode. The catalog preserves history, so never treat a visible Ranked PvP card as currently earnable without checking the live season announcement and standings.

## Separate the modes
- **Crystalline Conflict:** five-player crystal-push matches with casual and ranked queues. Only ranked play affects current rank.
- **Frontline:** large three-team campaigns whose map rotates. Achievement wording may require a specific campaign or Grand Company result.
- **Rival Wings:** two-team objective play using towers, cores, ceruleum, and machina.
- **Wolves' Den / historical Feast:** many entries are legacy or tied to retired rules.

## Safe progression
- [ ] Unlock PvP through the Grand Company quest and configure the separate PvP hotbar.
- [ ] Read the current PvP job guide after every balance patch.
- [ ] Confirm whether the achievement counts matches, wins, mode-specific wins, rank, or end-of-season placement.
- [ ] Use Quick Chat and objective markers; do not rely on PvE rotations or attributes.
- [ ] Check the achievement counter after changing modes.

## Ranked titles
Rank, credit thresholds, promotion/demotion rules, party restrictions, season length, and reward delivery can change. The live Crystalline Conflict page and season announcement are authoritative. The guide deliberately avoids promising a static rank threshold for a future season.

Play to complete matches properly. Abandonment and inactivity can trigger escalating penalties, and win trading or match manipulation is never an acceptable title route.`,
  [{label:"Official PvP system guide",url:"https://na.finalfantasyxiv.com/lodestone/playguide/pvpguide/system/"},{label:"Official Crystalline Conflict guide",url:"https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/crystallineconflict/"},{label:"Official Frontline guide",url:"https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/frontline/"}], 130),

  article("quest-title-journey", "Quest Achievement & Title Journey", "Trace MSQ, side-story, job, role, allied-society, seasonal, and levequest title prerequisites safely.", "All players", ["quest", "main scenario", "job quest", "role quest", "seasonal", "levequest"],
  `## Start from the source achievement
Quest titles are often awarded by the last quest in a chain rather than the first unlock. Search the title card's achievement name, then use the Journal's completed-quest search and the map's blue-quest markers to identify the missing prerequisite.

## Common families
- **Main Scenario:** progress in release order; post-expansion patch quests can be required even when the title is categorized under an earlier expansion.
- **Job and role quests:** use the required job/role and complete its prior level chain. Role-capstone quests may require every role series.
- **Side stories:** raids, trials, societies, deliveries, and feature unlocks can begin in another zone after MSQ gates.
- **Seasonal quests:** confirm the event is currently running. Old event achievements remain historical.
- **Levequests:** check the exact leve type, region, and counter; allowances regenerate over time and should not be wasted on the wrong category.

## Missing-quest checklist
- [ ] Confirm required level, job, MSQ, and prior quest.
- [ ] Remove hidden map filters and inspect the named starting settlement.
- [ ] Check whether the quest was already completed under Character → Journal.
- [ ] Finish any required duty and return for the follow-up conversation.
- [ ] Claim the achievement or reward after the final cutscene if the game requires it.

The portal does not reconstruct every quest dependency from title text. Its card gives the achievement requirement, while the guide explains how to audit a chain without replaying unrelated content. Exact Allied Society cards continue to open their dedicated society guide instead of this general route.`,
  [{label:"Official quest database",url:"https://na.finalfantasyxiv.com/lodestone/playguide/db/quest/"},{label:"Official Lodestone achievement history",url:"https://na.finalfantasyxiv.com/lodestone/my/achievement/"}], 140),

  article("character-title-journey", "Character Achievement & Title Journey", "Organize commendation, role, level, currency, inventory, companion, and long general-character counters.", "All players", ["character", "commendation", "leveling", "companion", "general"],
  `## Character titles are account-behavior projects
The Character category contains broad counters that advance through normal play, role-specific milestones, commendations, companion activity, currency, and other systems. Begin by reading the exact verb: receive, complete, earn, defeat, or attain. Similar names can track different actions.

## Turn passive counters into plans
- [ ] Pin one long background counter and one finite objective.
- [ ] Confirm which job, role, companion, or content type must be active when credit is awarded.
- [ ] Use roulettes and scheduled FC events only when their duties qualify.
- [ ] Check the counter after one controlled test rather than assuming all historical activity was eligible.

## Commendations
Commendation titles depend on commendations received from other players. They cannot be forced or traded reliably. Play supportively, communicate briefly, learn the duty, and finish without pressuring party members. Mentor eligibility and commendation achievements may use different thresholds, so follow the card rather than a remembered unlock.

## Level and role milestones
When an achievement requires multiple jobs or roles, create a checklist by role and finish job quests as you level. A level boost or experience gain may satisfy level requirements while leaving required quests or systems incomplete.

## Integrity and privacy
Do not automate participation, idle through duties, or manipulate other players for counters. Character achievement ownership remains private in the portal and updates from the last successful Lodestone scan. If the source history is private, the prior known-good state is retained rather than declaring the character missing everything.`,
  [{label:"Official game manual — achievements and character logs",url:"https://na.finalfantasyxiv.com/game_manual/view/"},{label:"Official Lodestone achievement history",url:"https://na.finalfantasyxiv.com/lodestone/my/achievement/"}], 150),

  article("crafting-gathering-title-journey", "Crafting & Gathering Title Journey", "Plan class logs, quality and quantity counters, collectables, restoration, deliveries, cosmic scores, and profession milestones.", "Crafting & Gathering", ["crafting", "gathering", "collectables", "restoration", "cosmic exploration", "quality"],
  `## Identify the counting rule
Profession achievements may count unique log entries, total crafts/gathers, high-quality items, collectables, expert recipes, restoration submissions, or current cosmic scores. Repeating one easy item helps a quantity counter but never substitutes for a unique-entry requirement.

## Crafter route
- [ ] Unlock the recipe book or master book required by blank Crafting Log entries.
- [ ] Separate ordinary HQ achievements from collectability; collectable recipes use a rating instead of HQ.
- [ ] Batch inexpensive qualifying recipes for total-count goals only after one test advances the counter.
- [ ] For expert crafts, use current gear, food, medicine, specialist status when useful, and a tested manual plan.

## Gatherer route
Miner and botanist discovery titles require personally gathering unique log entries. Fisher uses its dedicated journey guide. Timed, legendary, folklore, hidden, or regional entries require their live Gathering Log conditions; buying the item does not record discovery.

## Restoration, deliveries, and cosmic projects
Historical Ishgardian Restoration phase achievements may no longer be obtainable. Current Custom Deliveries use a weekly shared allowance. Cosmic scores and tool mastery belong to the named exploration site and profession. Confirm Availability and current phase before preparing a large batch.

## Efficient project order
First unlock every log and exchange, then clear unique entries, then run quantity counters while producing useful collectables or saleable items. Keep a material budget and inventory plan. Claim achievement rewards after completion, and use the dedicated profession relic guide when the card links there.`,
  [{label:"Official crafting and gathering logs in the game manual",url:"https://na.finalfantasyxiv.com/game_manual/view/"},{label:"Official Collectable Appraiser database",url:"https://na.finalfantasyxiv.com/lodestone/playguide/db/shop/?category2=collectables"},{label:"Official Ishgardian Restoration guide",url:"https://na.finalfantasyxiv.com/lodestone/ishgardian_restoration/"}], 160),

  article("item-collection-title-journey", "Item Collection & Relic Title Journey", "Audit stable collection requirements for relics, currency, materia, desynthesis, gear, and miscellaneous item achievements.", "All players", ["items", "relic", "materia", "desynthesis", "currency", "collection"],
  `## Determine whether the item must be owned, obtained, used, or exchanged
Item achievements use different triggers. Possessing an item is not always enough: the game may require obtaining it through a system, completing an exchange, affixing materia, desynthesizing, recording it in a log, or finishing the quest that awards it.

## Relic projects
If the category is Relic Weapons or Zodiac Weapons, the card opens the combat relic collection. Choose the expansion and follow every stage in order. Keep intermediate weapons, maintain a usable second weapon for turn-ins, verify replicas before discarding originals, and confirm the active quest before farming currency or duty drops.

## Other item families
- **Materia:** use the exact melding or extraction action and item-level condition stated.
- **Desynthesis:** level the relevant class skill and process qualifying items; vendor sale or discard does not count.
- **Currency:** distinguish earned, held, and spent totals. Currency caps can waste progress.
- **General collections:** identify whether items are unique unlocks, inventory objects, registered appearances, or achievement rewards.

## Safe acquisition plan
- [ ] Test one item and verify the counter.
- [ ] Check market-board eligibility before assuming an item can be purchased.
- [ ] Reserve inventory, armoury, saddlebag, and currency space.
- [ ] Do not destroy a stage item until the next NPC exchange is visible.
- [ ] Confirm time-limited or legacy availability before spending gil.

The title catalog links through the achievement, not item-name text, so similarly named rewards cannot grant false ownership. When an achievement also awards a mount, minion, or item, the card lists that reward independently.`,
  [{label:"Official item database",url:"https://na.finalfantasyxiv.com/lodestone/playguide/db/item/"},{label:"Official Zodiac quest database",url:"https://na.finalfantasyxiv.com/lodestone/playguide/db/quest/?category2=3"}], 170),

  article("exploration-title-journey", "Exploration & Sightseeing Title Journey", "Complete regional discovery, sightseeing vistas, duty exploration, and map-based title achievements with weather and emote checks.", "All players", ["exploration", "sightseeing log", "vista", "map", "weather"],
  `## Separate map discovery from sightseeing
Regional exploration normally advances by entering named map areas or uncovering locations. Sightseeing requires the correct vista position and may additionally require time, weather, and an emote. Standing at the coordinates under the wrong conditions does not count.

## Sightseeing routine
- [ ] Unlock the Sightseeing Log and the expansion section being attempted.
- [ ] Read the live log hint and confirm zone, nearest aetheryte, time window, weather, and emote.
- [ ] Reach the exact vista marker; some require jumping, flying, or a route from another elevation.
- [ ] Face the intended scene and use the specified emote.
- [ ] Confirm the log entry appears before leaving.

ARR vistas can use narrower weather/time combinations and demanding jumping routes. Later expansions commonly expose a visible sightseeing marker, but still require correct positioning. Use local time only for scheduling; the game condition follows Eorzea time where stated.

## Duty and regional exploration
Duty exploration achievements require the named instance or exploration mode, not merely unlocking it. For zone-map goals, remove map fog systematically and enter subareas rather than flying over them. New Game+, World Visit, and Data Center Travel do not replace a Home World-specific condition if the achievement names one.

## Patch safety
Coordinates are navigation aids, not stable identity. If a patch changes collision, flight, weather, or an emote requirement, the in-game Sightseeing Log is authoritative. Mark completed entries in the log and use the portal only to organize remaining title achievements.`,
  [{label:"Official game manual — Sightseeing and exploration logs",url:"https://na.finalfantasyxiv.com/game_manual/view/"},{label:"Official Play Guide",url:"https://na.finalfantasyxiv.com/lodestone/playguide/"}], 180),

  article("grand-company-title-journey", "Grand Company Title Journey", "Plan rank, supply, leve, seal, squadron, and company-specific achievements without losing progress after a transfer.", "All players", ["grand company", "rank", "seals", "supply", "squadron"],
  `## Confirm the company named by the achievement
Many Grand Company titles have parallel Maelstrom, Twin Adder, and Immortal Flames versions. Credit belongs to the specific company and activity named on the card. Similar progress in another company does not automatically complete every parallel achievement.

## Core route
- [ ] Join the intended Grand Company and unlock hunting logs, supply/provisioning, expert delivery, and company leves as they become available.
- [ ] Advance rank whenever the personnel officer offers the promotion requirement.
- [ ] Spend seals before reaching the cap, but distinguish achievements that count seals earned from those that require purchases.
- [ ] Unlock Adventurer Squadrons and command missions before planning squadron-specific titles.
- [ ] Test one leve, delivery, or command mission to confirm the correct counter.

## Transfers
Changing Grand Companies can preserve some historical accomplishments while suspending access to company-specific rank, currency, gear, or squadron features until re-earned or restored under game rules. Finish a near-complete title before transferring and capture the achievement counter first. Never assume rank text or seals carry identically.

## Efficient overlap
Turn in daily requested crafting/gathering items, use dungeon gear for expert delivery, complete the company hunting log while leveling, and schedule squadron missions around real-world completion timers. Company leves consume shared allowances, so verify the category before accepting many.

The portal treats each achievement's stable ID independently even when three companies use nearly identical visible names. This prevents one company's title from being inferred from another's text.`,
  [{label:"Official Grand Company quest database",url:"https://na.finalfantasyxiv.com/lodestone/playguide/db/quest/?category2=2"},{label:"Official game manual",url:"https://na.finalfantasyxiv.com/game_manual/view/"}], 190),

  article("legacy-title-reference", "Legacy Achievement & Title Reference", "Explain retired 1.x, seasonal, ranked, and discontinued titles without presenting them as obtainable goals.", "All players", ["legacy", "discontinued", "historical", "unobtainable", "1.x"],
  `## Historical record, not an acquisition promise
Legacy titles remain in the catalog so the portal represents the complete game history. Many were awarded under version 1.x systems, retired seasonal events, old PvP seasons, discontinued currencies, removed duties, or requirements that no longer exist.

## How to read a legacy card
- **Owned:** the linked character's public Lodestone history contains the original achievement.
- **Missing:** the achievement is not in the last successful history; this does not mean it can still be earned.
- **Legacy/Time-limited/Ranked PvP:** the availability label takes priority over the old requirement text.
- **Unknown:** verify current official announcements before treating the goal as active.

## Safe research process
- [ ] Check the achievement's patch and category.
- [ ] Look for a current official event, restoration phase, duty, or PvP season announcement.
- [ ] Do not buy items, change Grand Companies, or schedule a group based only on an archived description.
- [ ] Preserve the card as collection history when no current route exists.

The portal will not invent replacement methods. Reissued rewards do not necessarily reissue the original achievement or title, and an Online Store item does not prove its historic achievement is obtainable. If Square Enix officially restores a route, update Availability and add a dedicated guide after verifying the live implementation.

Legacy ownership is still private personal data in this portal. It is derived from the same last-known-good achievement history and is never used for FC rankings or Discord announcements.`,
  [{label:"Official Lodestone achievement history",url:"https://na.finalfantasyxiv.com/lodestone/my/achievement/"},{label:"Official FINAL FANTASY XIV news",url:"https://na.finalfantasyxiv.com/lodestone/news/"}], 200),
];
