import type { BuiltInGuide } from "./guide-library";

const official = (label: string, url: string) => ({ label, url });

export const COLLECTION_REWARD_GUIDES: BuiltInGuide[] = [
  { slug: "collection-reward-journeys", parentSlug: null, type: "collection", category: "Collections", title: "Mount & Minion Reward Journeys", summary: "Practical routes for collection rewards whose unlocks, currencies, duties, or availability need more explanation than a source label.", expansion: "Multiple", level: "1–100", audience: "All players", tags: ["mounts", "minions", "rewards", "collections"], imageUrl: "/guides/relic-stage-route.svg", order: 90 },
  { slug: "trial-mount-series", parentSlug: "collection-reward-journeys", type: "article", category: "Mount Collection", title: "Extreme Trial Mount Series & Meta-Mounts", summary: "Farm each expansion's Extreme trial mounts, use totems safely, and unlock the series-completion mount without missing a prerequisite.", expansion: "Multiple", level: "50–100", audience: "Combat", tags: ["extreme trials", "mounts", "totems", "kirin", "firebird", "kamuy", "gwiber", "lynx"], imageUrl: "/guides/field-operations.svg", order: 10,
    content: `## Choose the series before the duty
Use **Collections → Mounts** and the Party Tracker to select one expansion set. The familiar series are ARR extreme primals, Heavensward lanners, Stormblood kamuy, Shadowbringers gwibers, Endwalker lynxes, and the current Dawntrail wing series. The exact tracker card and live Duty Finder description take precedence when a later patch adds another member.

## Unlock and farm safely
- [ ] Complete the normal trial and every blue quest required for its Extreme version.
- [ ] Confirm the mount is enabled in the selected Party Tracker set.
- [ ] Build a full unsynced group only when the duty permits it; current fights may still require level sync and normal mechanics.
- [ ] Agree on loot order, minimum clear count, and whether the party stays until everyone wins.
- [ ] Keep every duty-specific totem until the exchange vendor actually offers the whistle.

Extreme clears can award the whistle directly. Many older whistles are also exchanged for **99 matching totems**, but that exchange is commonly introduced in a later patch rather than on the trial's first day. Never discard totems because a vendor currently lacks the item.

## Meta-mount checklist
The final series mount is normally unlocked through a quest after obtaining the required trial mounts; it is not a random drop from the last Extreme. Register every whistle, reopen the Mount Guide, then find the series quest in the expansion's endgame hub. Store or summon each mount if the quest does not immediately recognize completion.

Use the tracker to compare missing mounts across the party and schedule the duty that helps the most members. A mount marked Owned follows the latest successful Lodestone collection scan; verify newly registered whistles in game while waiting for the next worker pass.`, references: [official("Official Shadowbringers Extreme totem exchange example", "https://na.finalfantasyxiv.com/lodestone/topics/detail/1cc2ab61c569bf2d07deeb95d7fb407013d3d9df"), official("Official Stormblood Extreme totem exchange example", "https://na.finalfantasyxiv.com/lodestone/topics/detail/70df23d56f34c6616e72133cdf7baed4c601a293")] },
  { slug: "island-sanctuary-collection-rewards", parentSlug: "collection-reward-journeys", type: "article", category: "Lifestyle Collection", title: "Island Sanctuary Mount & Minion Rewards", summary: "Advance sanctuary rank, currencies, workshop milestones, and island achievements in the right order for collection rewards.", expansion: "Endwalker", level: "1 after Endwalker", audience: "All players", tags: ["island sanctuary", "seafarer's cowries", "islander's cowries", "workshop", "mounts", "minions"], imageUrl: "/guides/crafting.svg", order: 20,
    content: `## Unlock and progression gates
Complete **Endwalker**, then accept the island unlock from the Clueless Crier in Old Sharlayan. Island activities use their own tools, materials, experience, rank, and currencies; normal crafter or gatherer levels are not required. Follow every island vision before grinding because ranks alone do not open features whose construction or quest step is unfinished.

## Reward route
1. Gather enough local materials to craft the current tools and renovate the Cozy Cabin.
2. Build and upgrade workshops and granaries whenever a vision permits it.
3. Keep crops and pasture leavings flowing because workshop recipes and favors consume them.
4. Schedule workshop handicrafts for seafarer's cowries instead of selling random single crafts.
5. Check the Horrendous Hoarder and related island vendors after every rank and vision.
6. Open the island achievement category for mounts or minions tied to cumulative production and activity goals.

Separate **vendor purchases**, **rank/quest awards**, and **achievement rewards**. A tracker source naming cowries points to the island shop; a source naming an achievement requires completing and then claiming that achievement's reward. Do not spend the last cowries needed for facility upgrades merely because a collectible becomes visible.

## Collection-day checklist
- [ ] Claim completed workshop cycles and granary expeditions.
- [ ] Collect crops and pasture leavings before reaching storage caps.
- [ ] Complete the active vision and inspect every new vendor tab.
- [ ] Register purchased whistles or minions immediately.
- [ ] Let the next ownership scan confirm the result.

Releasing a minion to roam on the island is decorative and does not create ownership. You must already possess and register that minion before it can be selected.`, references: [official("Official Island Sanctuary play guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/island_sanctuary/")] },
  { slug: "pvp-collection-rewards", parentSlug: "collection-reward-journeys", type: "article", category: "PvP Collection", title: "PvP Mount & Minion Reward Route", summary: "Separate Series Malmstones, currencies, achievements, and ranked or legacy rewards before committing to a PvP collection goal.", expansion: "Multiple", level: "30+", audience: "Combat", tags: ["pvp", "series malmstones", "trophy crystals", "wolf marks", "frontline", "rival wings", "crystalline conflict"], imageUrl: "/guides/field-operations.svg", order: 30,
    content: `## Identify the reward path first
PvP collection cards can refer to four different systems: **Series Malmstones**, Wolf Mark or Trophy Crystal vendors, match/win achievements, and seasonal or historical ranked rewards. These are not interchangeable. Read the acquisition text and availability before queueing.

## Current Series routine
- Open Character → PvP Profile → Series Malmstones and note the reward level.
- Earn Series EXP through eligible PvP duties; custom matches do not grant normal progression or achievement credit.
- Claim each reached malmstone from the profile rather than expecting delivery by mail.
- Claim uncollected rewards before the following Series ends. Series level resets when the Series changes, while currencies follow their own rules.

Wolf Marks and Trophy Crystals are exchanged at Wolves' Den Pier. Check all vendor categories before spending because gear, portrait, mount, and minion stock can be separated. Achievement rewards require the named mode and counter: Frontline, Rival Wings, and Crystalline Conflict wins do not substitute for one another.

## Availability safety
Treat old Feast, ranked-season, collaboration, or expired Series rewards as historical unless the live vendor or PvP Profile currently exposes them. The collection tracker may retain unavailable entries so the catalog remains complete; it is not a promise that every reward can still be earned.

For an FC session, choose one mode, verify every participant has it unlocked, and check the relevant achievement after the first match. This prevents hours of progress in the wrong queue.`, references: [official("Official PvP system and Series Malmstones guide", "https://na.finalfantasyxiv.com/lodestone/playguide/pvpguide/system/"), official("Official Crystalline Conflict rewards guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/crystallineconflict/")] },
  { slug: "hunt-collection-rewards", parentSlug: "collection-reward-journeys", type: "article", category: "Hunt Collection", title: "Hunt Currency Mount & Minion Rewards", summary: "Unlock each Hunt generation, earn the correct seals or nuts, and distinguish vendor purchases from long achievement rewards.", expansion: "Multiple", level: "50–100", audience: "Combat", tags: ["hunts", "allied seals", "centurio seals", "sacks of nuts", "mounts", "minions"], imageUrl: "/guides/field-operations.svg", order: 40,
    content: `## Match the expansion to its currency
ARR Hunt bills and marks use Allied Seals; Heavensward and Stormblood Clan Hunts use Centurio Seals; later Hunt systems use Sacks of Nuts. Unlock each generation's blue quest before farming or the correct shop and bills may remain hidden.

Collection rewards then follow one of three routes:
1. **Direct vendor item** — buy the whistle or minion from the appropriate Hunt vendor.
2. **Indirect exchange** — buy logs or certificates, then trade those with a second NPC named by the acquisition card.
3. **Achievement reward** — complete the exact B-, A-, or S-rank counter and claim the reward from Achievements.

## Efficient routine
- [ ] Join an organized train or party and follow the conductor's instance and pull calls.
- [ ] Verify the mark belongs to the expansion named by the achievement.
- [ ] Stay alive, in range, and contributing through the defeat.
- [ ] Check currency caps before a train and spend before rewards overflow.
- [ ] Reopen the vendor after completing each expansion's Hunt unlock chain.

Weekly elite bills are steady currency but cannot replace a large A/S-rank achievement grind. Likewise, possessing enough currency does not bypass a shop unlocked by a later quest. Use the Hunt journey for spawn and credit behavior, and this collection route for purchase planning.

[[hunt-title-journey|Open the Hunt Achievement & Title Journey]]`, references: [official("Official Shadowbringers Hunt unlock and Sacks of Nuts exchange", "https://na.finalfantasyxiv.com/lodestone/topics/detail/330f2b280067d69d85b17831c66712a499e97484")] },
  { slug: "variant-criterion-collection-rewards", parentSlug: "collection-reward-journeys", type: "article", category: "Duty Collection", title: "Variant & Criterion Collection Rewards", summary: "Track route records, duty drops, criterion tokens, achievements, and Savage clears across the V&C dungeon series.", expansion: "Multiple", level: "90–100", audience: "Combat", tags: ["variant dungeon", "criterion dungeon", "savage", "sil'dihn", "mount rokkon", "aloalo"], imageUrl: "/guides/field-operations.svg", order: 50,
    content: `## Pick the exact duty family and mode
**Variant** is scalable story exploration. The three Endwalker families then split into fixed four-player **Criterion** and **Criterion (Savage)**. **The Merchant's Tale** instead adds flexible **Advanced** between Variant and its fixed-party Criterion, with no separate Savage duty. A reward naming one mode cannot be earned in another.

## Complete duty guides
- [[variant-criterion-sildihn-subterrane|The Sil'dihn Subterrane — routes, Silkie, Sil'dihn Throne, Criterion and Savage]]
- [[variant-criterion-mount-rokkon|Mount Rokkon — routes, Burabura Chochin, Shishioji, Criterion and Savage]]
- [[variant-criterion-aloalo-island|Aloalo Island — routes, Spectral Statice, Quaqua, Criterion and Savage]]
- [[variant-criterion-merchants-tale|The Merchant's Tale — 13 routes, Advanced, Royal Magicked Carpet, Genie of the Lamp and Criterion]]

## Variant route
- [ ] Equip two useful Variant Actions for the chosen role.
- [ ] Read newly discovered records before repeating a route.
- [ ] Change doors, interactions, boss conditions, and dialogue choices deliberately.
- [ ] Use the duty's route diagram to identify the missing numbered ending.
- [ ] Claim any achievement reward after all required records are registered.

## Hard-mode route
For standard Criterion, form one tank, one healer, and two DPS. Practice Criterion mechanics before scheduling an Endwalker Savage version. Merchant's Tale Advanced supports a smaller flexible group, but Another Merchant's Tale returns to the fixed light-party structure. Keep tokens until you have checked Trisassant's current exchange categories in Old Sharlayan. Some collectibles are direct drops, some are token exchanges, and some are achievement rewards.

When organizing the FC, record whether the event targets route completion, token farming, or Savage progression. Mixing those goals produces the wrong party composition and expectations. The card's related achievement link is the authority for a completion reward.

[[criterion-variant-title-journey|Open the Variant & Criterion Achievement Journey]]`, references: [official("Official Patch 6.25 V&C Dungeon rules and exchange", "https://na.finalfantasyxiv.com/lodestone/topics/detail/2627bf0e00e90852aa6cdc821f337ea9b2c12277")] },
  { slug: "deep-dungeon-collection-rewards", parentSlug: "collection-reward-journeys", type: "article", category: "Duty Collection", title: "Deep Dungeon Mount & Minion Rewards", summary: "Plan story clears, Accursed Hoard appraisal, currency exchanges, and achievement rewards across every deep dungeon.", expansion: "Multiple", level: "17–100", audience: "Combat", tags: ["deep dungeon", "accursed hoard", "sacks", "aetherpool", "mounts", "minions"], imageUrl: "/guides/field-operations.svg", order: 60,
    content: `## Find the actual reward source
Deep-dungeon collectibles may come from a floor clear or quest, an Accursed Hoard appraisal tier, an aetherpool or dungeon-currency exchange, or an achievement. Each dungeon keeps separate levels, save slots, aetherpool, inventories, and appraisal NPCs.

## Hoard farming loop
Use the dungeon's Intuition-type item, watch the navigation map for the buried-hoard indicator, then stand still on the location until it appears. The treasure is not secured merely by uncovering it: reach a valid save/exit point and leave with the hoard, then speak with that dungeon's appraisal NPC. Bronze, silver, gold, and later tier names have different reward pools, so farming the wrong floor band cannot produce the desired collectible.

## Exchange and clear safety
- [ ] Confirm the card names the correct deep dungeon and sack/hoard tier.
- [ ] Preserve enough aetherpool strength to continue using important saves before exchanging it.
- [ ] Keep inventory space for appraised items and register collectibles promptly.
- [ ] For a clear or solo achievement, use the required party size and starting floor.
- [ ] Never delete the other save while recovering a challenge or fixed-party run.

Appraisal rewards are random; a guide cannot guarantee a number of sacks. Plan repeated floor blocks that also build aetherpool and achievement progress. For a newly released dungeon, trust its live information window and official patch notes over inherited rules from an older one.

[[deep-dungeon-title-journey|Open the Deep Dungeon Achievement & Title Journey]]`, references: [official("Official Palace of the Dead and Accursed Hoard guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/deepdungeon/"), official("Official Heaven-on-High guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/deepdungeon2/"), official("Official Patch 7.35 deep-dungeon reward example", "https://na.finalfantasyxiv.com/lodestone/topics/detail/9d2cad7a1028016719060b5ae3caeb5e369c89e9")] },
  { slug: "treasure-dungeon-collection-rewards", parentSlug: "collection-reward-journeys", type: "article", category: "Treasure Collection", title: "Treasure Map Mount & Minion Rewards", summary: "Choose the correct map and portal dungeon, organize owner order, and distinguish direct drops from crafted marketboard rewards.", expansion: "Multiple", level: "40–100", audience: "All players", tags: ["treasure maps", "portal dungeons", "aquapolis", "uznair", "lyhe ghiah", "mounts", "minions"], imageUrl: "/guides/field-operations.svg", order: 70,
    content: `## Start with the destination, not the reward name
Complete **Treasures and Tribulations** in Wineport to learn Decipher and Dig. Then match the collectible's source to the exact timeworn map and portal-dungeon generation. Surface coffers, standard door dungeons, roulette dungeons, and special thief-style maps have different loot pools.

## Party route
- [ ] Gather or purchase the correct map; do not decipher it until ready to use its key-item slot.
- [ ] Form the party and agree on map-owner order, Need/Greed rules, and crafted-material handling.
- [ ] Teleport together, Dig at the owner's location, defeat the timed surface encounter, and open the coffer.
- [ ] Enter any portal promptly and keep the owner connected.
- [ ] Continue through doors or roulette stages until ejection or the final chamber.

Some collectibles drop directly. Others require rare materials from the dungeon and a crafted item, which may also be tradable on the marketboard. The tracker can therefore show Treasure Hunt, Crafting, or Marketboard for related rewards without contradiction.

Portal entry and advancement are random. Never promise a reward or final chamber after a fixed number of maps. Batch maps by expansion, keep repair and inventory space, and treat duplicate materials according to the party's agreed rules.

[[treasure-hunt-title-journey|Open the Treasure Hunt Achievement & Title Journey]]`, references: [official("Official Treasure Hunt unlock and rules", "https://na.finalfantasyxiv.com/lodestone/topics/detail/03843d6bf7ba69adc37d7955ff7af43f3c43828a"), official("Official Hidden Canals progression example", "https://na.finalfantasyxiv.com/lodestone/topics/detail/0fb8eb032b56225a89c9246591e7886c6c12cec3")] },
  { slug: "field-operation-collection-rewards", parentSlug: "collection-reward-journeys", type: "article", category: "Exploration Collection", title: "Eureka, Bozja & Occult Crescent Collection Rewards", summary: "Route mounts and minions through lockboxes, encounters, raids, records, currencies, and field-operation achievements.", expansion: "Stormblood–Dawntrail", level: "70–100", audience: "Combat", tags: ["eureka", "bozja", "zadnor", "occult crescent", "lockboxes", "mounts", "minions"], imageUrl: "/guides/field-operations.svg", order: 80,
    content: `## Identify the operation and reward channel
Field-operation collectibles can be encounter drops, lockbox appraisals, cluster or local-currency exchanges, raid rewards, record completion, achievement rewards, or tradable items. Unlocking the zone does not unlock every source inside it.

**Eureka:** progress Anemos → Pagos → Pyros → Hydatos, raise elemental level, unlock aetherytes, and use each zone's lockbox or crystal systems. Baldesion Arsenal rewards require its own organized entry and preparation.

**Bozja/Zadnor:** advance Resistance rank and story, unlock Castrum Lacus Litore, Delubrum Reginae, and the Dalriada, then build usable essence/lost-action loadouts. Field Notes and duels are separate collection projects.

**Occult Crescent:** advance knowledge and story gates, level phantom jobs independently, follow encounter/weather access, and distinguish South/North Horn currencies, records, towers, and weapon materials.

## Safe farming checklist
- [ ] Read the card for the exact zone, encounter, lockbox, raid, record, or currency.
- [ ] Carry the operation's expected actions or support loadout.
- [ ] Join the correct instance and organized group for raid or tower content.
- [ ] Appraise or exchange rewards before assuming a drop registered automatically.
- [ ] Check whether a tradable reward is cheaper through the marketboard than repeated RNG farming.

[[eureka-field-guide|Eureka guide]] · [[bozja-field-guide|Bozja & Zadnor guide]] · [[occult-crescent-guide|Occult Crescent guide]]`, references: [official("Official field-operation feature directory", "https://na.finalfantasyxiv.com/lodestone/playguide/")] },
  { slug: "gold-saucer-collection-rewards", parentSlug: "collection-reward-journeys", type: "article", category: "Gold Saucer Collection", title: "Gold Saucer Mount & Minion Rewards", summary: "Earn and spend MGP efficiently, find the correct prize counter, and separate shop rewards from activity achievements.", expansion: "Multiple", level: "15+", audience: "All players", tags: ["gold saucer", "mgp", "mounts", "minions", "gates", "triple triad", "verminion"], imageUrl: "/guides/relic-stage-route.svg", order: 90,
    content: `## Unlock and classify the card
Unlock the Manderville Gold Saucer from the Well-Heeled Youth in Ul'dah after reaching the envoy stage of the MSQ. Collection rewards then come from direct MGP or gil purchases, activity-specific vendors, prize exchanges, or achievements.

The main Prize Claim counter is not the only shop. The Minion Trader, Triple Triad area, Chocobo Square, and limited-event attendants can hold different stock. If a card says **Achievement**, open its achievement link; having enough MGP will not purchase it.

## Reliable MGP routine
- [ ] Complete the weekly Gold Saucer Challenge Log categories that match activities you enjoy.
- [ ] Submit Fashion Report for its weekly rewards.
- [ ] Buy Mini Cactpot daily and Jumbo Cactpot entries before the weekly draw.
- [ ] Join convenient GATEs and use waiting time for Triple Triad, racing, or minigames.
- [ ] Check current event bonuses before doing a long MGP farm.

Save toward one target at a time and keep a reserve when a time-limited event shop is active. MGP cannot normally be converted back to gil, and spending it does not reduce achievements that count total MGP earned.

Before purchase, confirm the character does not already own the whistle or minion; the portal can lag until the next successful Lodestone scan. Register the item immediately, then allow the worker to update ownership.

[[gold-saucer-title-journey|Open the Gold Saucer Achievement & Title Journey]]`, references: [official("Official Gold Saucer guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/goldsaucer/"), official("Official Gold Saucer prize shops", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/goldsaucer/shops/")] },
  { slug: "duty-drop-collection-rewards", parentSlug: "collection-reward-journeys", type: "article", category: "Duty Collection", title: "Dungeon, Raid & Chaotic Raid Collection Drops", summary: "Farm duty-specific minions and mounts while respecting loot eligibility, weekly restrictions, and difficulty-specific reward tables.", expansion: "Multiple", level: "15–100", audience: "Combat", tags: ["dungeon", "raid", "chaotic raid", "loot", "minions", "mounts"], imageUrl: "/guides/field-operations.svg", order: 100,
    content: `## Confirm the exact duty and difficulty
Collection rewards belong to a specific duty version. Normal, Hard, Extreme, Savage, Alliance, Criterion, and Chaotic entries with similar names have separate loot tables. Open the card's source and queue the exact duty before organizing a farm.

## Dungeon and normal-raid routine
- [ ] Verify the reward comes from the final coffer, a named boss, or a post-duty exchange.
- [ ] Use an unrestricted party only when level sync and minimum item level are not required.
- [ ] Agree whether everyone will roll normally or remain until each member wins.
- [ ] Keep inventory and minion/mount guide space available before opening the last coffer.
- [ ] Register the item immediately and let the next Lodestone scan confirm ownership.

Minion drops are often unrestricted after older weekly gates are removed, but random drops remain random. Running with fewer eligible rollers can improve the practical chance without changing the underlying drop rate.

## Savage and Chaotic cautions
Check the live Raid Finder and duty information for weekly eligibility before every session. A weekly token, direct coffer, demimateria exchange, and achievement reward are different paths. Clearing the wrong floor or spending the wrong token will not advance the card.

For current high-end content, build the event around progression first and collection farming second. Do not advertise a farm until the group can clear consistently. Older content may be unsynced, but mechanics that cause instant failure can still require assignments.

When a card also lists Crafting or Marketboard, the duty may drop a material rather than the finished collectible. Check both sources before committing to repeated clears.`, references: [official("Official Duty Finder and gameplay feature directory", "https://na.finalfantasyxiv.com/lodestone/playguide/")] },
  { slug: "wondrous-tails-faux-hollows-rewards", parentSlug: "collection-reward-journeys", type: "article", category: "Weekly Collection", title: "Wondrous Tails & Faux Hollows Collection Rewards", summary: "Plan weekly seals, certificates, Unreal clears, retellings, and Faux Leaf purchases for mounts and minions.", expansion: "Heavensward–Current", level: "60–100", audience: "Combat", tags: ["wondrous tails", "faux hollows", "faux leaves", "khloe certificates", "unreal"], imageUrl: "/guides/relic-stage-route.svg", order: 110,
    content: `## Separate Khloe's two systems
**Wondrous Tails** fills a weekly journal with seals and awards a choice based on completed lines. **Faux Hollows** unlocks after the current Unreal trial and awards Faux Leaves through its board. Their shops may display some similar collection goals, but journals, certificates, leaves, and weekly attempts are separate.

## Wondrous Tails route
- [ ] Collect the current journal from Khloe in Idyllshire.
- [ ] Complete nine eligible duties before the journal expires.
- [ ] Use retry points deliberately to replace inconvenient duties or attempt Second Chance shuffles before placing the last seal.
- [ ] Turn in on the job that should receive experience and choose the required certificate/reward tier.
- [ ] Keep certificates until the desired collectible is visible in the current exchange.

Line rewards depend on the randomized seal layout; no route guarantees a Gold Certificate. Treat certificate collectibles as long-term goals rather than weekly promises.

## Faux Hollows route
Clear the current Unreal trial, then play Faux Hollows. Eleven panel flips are available per play. Finding a retelling can grant one additional Unreal clear and board during that weekly cycle. Exchange Faux Leaves with the Faux Commander in Idyllshire only after confirming the card's price and ownership.

The active Unreal duty changes over time. Old guides should not be used to infer the current fight, item level, or weekly availability; use the live Raid Finder entry. Claim and register the collectible before the worker's next ownership scan.`, references: [official("Official Patch 5.3 Faux Hollows and Wondrous Tails rules", "https://na.finalfantasyxiv.com/lodestone/topics/detail/dec171b9aa6a9b86ea8c3229b193f6c354e4dc8e")] },
  { slug: "fate-bicolor-collection-rewards", parentSlug: "collection-reward-journeys", type: "article", category: "Open-world Collection", title: "FATE, Bicolor Gemstone & Voucher Rewards", summary: "Unlock Shared FATE stock, farm special encounter tokens, and convert gemstones or vouchers into collection rewards.", expansion: "Multiple", level: "1–100", audience: "Combat", tags: ["fate", "bicolor gemstones", "shared fate", "vouchers", "special fate"], imageUrl: "/guides/field-operations.svg", order: 120,
    content: `## Identify which FATE path the card uses
There are three common routes: a direct rare FATE drop, a token from a named multi-stage special FATE, or a Bicolor Gemstone purchase gated by Shared FATE rank. Gemstone vouchers add another exchange layer and must not be confused with ordinary gemstones.

## Shared FATE route
Open Travel → Shared FATE and select the expansion and zone. Complete FATEs with enough contribution to earn gemstones and raise that zone's rank. Vendor stock expands only when its stated regional progress is met; having sufficient currency does not bypass the rank gate.

- [ ] Unlock flight and aetherytes before joining a zone circuit.
- [ ] Join a party for reliable contribution on crowded encounters.
- [ ] Complete every zone required for regional/global gemstone-vendor stock.
- [ ] Watch the gemstone cap and spend before rewards overflow.
- [ ] Confirm whether the target costs gemstones directly or vouchers bought from another vendor.

## Special FATE route
Named world FATE chains can have long respawn windows, weather or prerequisite stages, multiple instances, and limited participation space. Follow the correct world/instance call, wait for the organizer's pull, and remain alive and active through completion. The token amount depends on contribution, so one clear may not provide the card's required total.

Register the exchanged whistle or minion immediately. A FATE achievement and a FATE-token vendor reward are independent even when they come from the same encounter.`, references: [official("Official Dawntrail Shared FATE and Bicolor Gemstone rules", "https://na.finalfantasyxiv.com/lodestone/topics/detail/c807875c5f8f7529887c86d2955f709eae0231ef")] },
  { slug: "retainer-venture-minion-rewards", parentSlug: "collection-reward-journeys", type: "article", category: "Retainer Collection", title: "Retainer Exploration Venture Minions", summary: "Assign the correct retainer discipline and exploration rank, meet level and gear gates, and manage long-duration minion attempts.", expansion: "Multiple", level: "17–100", audience: "All players", tags: ["retainer", "venture", "field exploration", "highland exploration", "woodland exploration", "waterside exploration"], imageUrl: "/guides/crafting.svg", order: 130,
    content: `## Match the minion to the retainer
Field Exploration belongs to a combat retainer. Highland belongs to miner, Woodland to botanist, and Waterside to fisher. The acquisition card names the exact exploration rank; Quick Exploration or a normal one-hour procurement venture does not substitute for it.

## Preparation
- [ ] Unlock retainers through the main scenario and ventures through **An Ill-conceived Venture**.
- [ ] Assign the needed class or job and level that retainer high enough for the named exploration.
- [ ] Equip appropriate retainer gear and verify the venture window does not show an unmet requirement.
- [ ] Keep Venture currency available and choose the exact numbered exploration entry.
- [ ] Reassign the same exploration after collection when the minion does not appear.

Exploration rewards are random and the long duration makes these background projects. Use multiple retainers of useful disciplines when possible, but do not reset a leveled retainer casually: changing its class can discard progression or require rebuilding equipment.

Gear rules and exploration ranks change as level caps rise. Trust the live venture window's required level and attributes. The Companion App may handle some retainer actions, but exploration and quick exploration assignment restrictions differ from ordinary ventures; use the in-game retainer interface when the desired entry is unavailable.

Many venture minions are tradable. Compare the marketboard price against the time and retainer setup required, while keeping the venture route available for self-found collection goals.`, references: [official("Official Patch 5.4 retainer exploration changes", "https://na.finalfantasyxiv.com/lodestone/topics/detail/230f6e0af3536f9a40654d783c8c2f1094131070"), official("Official Patch 7.0 Companion App venture restrictions", "https://na.finalfantasyxiv.com/lodestone/topics/detail/d7db61f938f9cea65e4c5cd261918edb036b3004")] },
  { slug: "fc-voyage-collection-rewards", parentSlug: "collection-reward-journeys", type: "article", category: "Free Company Collection", title: "FC Airship & Submersible Voyage Rewards", summary: "Unlock workshop voyages, chart sectors, tune vessel stats, and distinguish direct collectibles from voyage-material crafts.", expansion: "Heavensward–Current", level: "FC housing required", audience: "Free Company", tags: ["airship", "submersible", "voyages", "company workshop", "sectors", "minions"], imageUrl: "/guides/crafting.svg", order: 140,
    content: `## Access and permissions
Exploratory voyages require an FC estate with a company workshop and a registered vessel. Only members granted the relevant workshop/voyage permissions should deploy, repair, register, or alter vessels. Keep an officer record of current routes and parts before changing a shared build.

## Collection reward types
The tracker may name a sector as a direct minion source, a Spoils Collector exchange, or a crafted minion whose material comes from one or more voyage sectors. These require different plans. A sector discovery does not guarantee its rare item on the next trip.

## Route workflow
- [ ] Confirm the exact Sea and sector letters shown by the acquisition card.
- [ ] Verify the vessel has sufficient rank, range, and surveillance for the route.
- [ ] Chart prerequisite sectors until the target destination becomes selectable.
- [ ] Load repair materials and ceruleum fuel before dispatch.
- [ ] Record the return time and avoid overriding another officer's planned route.
- [ ] On return, inspect the voyage log and store rare materials in an agreed FC location.

Airship and submersible parts trade speed, range, retrieval, surveillance, and favor. The best leveling or gil route may not be the best rare-minion route. Tune only after deciding the goal, and preserve the previous build so it can be restored.

For crafted collectibles, use the card's Crafting source to identify the finished recipe after obtaining the voyage material. Direct voyage rewards can usually be registered immediately; shared FC loot ownership should follow the community's published rules.`, references: [official("Official Company Workshop and exploratory voyage introduction", "https://na.finalfantasyxiv.com/lodestone/topics/detail/464263b3ce6026cdf98a49bf8f98c204c6199e5a")] },
  { slug: "crafted-gathered-gardening-rewards", parentSlug: "collection-reward-journeys", type: "article", category: "Profession Collection", title: "Crafted, Gathered & Gardening Collections", summary: "Trace finished collectibles back through recipes, rare materials, fishing, crossbreeding, voyages, duties, and marketboard alternatives.", expansion: "Multiple", level: "1–100", audience: "Crafting & Gathering", tags: ["crafting", "gathering", "gardening", "fishing", "crossbreeding", "minions"], imageUrl: "/guides/crafting.svg", order: 150,
    content: `## Read the whole source chain
A card marked Crafting may require a rare duty, treasure-map, voyage, or gathering material before the recipe can be completed. A Gathered by Fisher minion may depend on a specific hole, bait, weather, time window, folklore book, or intuition chain. Gardening rewards can require crossbreeding rather than planting a purchasable seed directly.

## Crafting route
- [ ] Look up the finished item in the Crafting Log and confirm the required specialist/master recipe unlock.
- [ ] Expand every ingredient and mark untradeable or time-gated materials first.
- [ ] Compare self-crafting cost with the marketboard before consuming rare materials.
- [ ] Confirm whether quality matters; most registered collectible items only need the finished item.

## Gathering and fishing route
Unlock the correct regional folklore or gathering access, equip enough perception/gathering, and follow the live Gathering or Fishing Log. For fish, verify bait, mooch chain, weather, time, and Collect status independently. A similarly named fish or node item will not satisfy the recipe.

## Gardening route
Use an estate or apartment flowerpot only when the seed supports it; crossbreeding requires outdoor garden patches. Arrange parent seeds in the intended alternating pattern, use appropriate soil, tend the plants, and harvest only when the cross attempt has completed. Crossbreed results are probabilistic, so preserve extra parent seeds.

Tradable crafted, gathered, and gardening collectibles remain valid marketboard alternatives. The guide explains acquisition planning; the card's current market price and exact source remain authoritative.`, references: [official("Official crafting, gathering, housing and gameplay guide directory", "https://na.finalfantasyxiv.com/lodestone/playguide/")] },
];
