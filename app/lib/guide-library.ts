import { EXPANDED_GUIDES } from "./guide-expansions";
import { TITLE_FAMILY_GUIDES } from "./guide-title-families";
import { COLLECTION_REWARD_GUIDES } from "./guide-collection-rewards";
import { LIMITED_JOB_GUIDES } from "./guide-limited-jobs";
import { FIELD_OPERATION_GUIDES } from "./guide-field-operations";
import { VARIANT_CRITERION_GUIDES } from "./guide-variant-criterion";
import { GATHERING_ACHIEVEMENT_TOOL_GUIDES } from "./guide-gathering-achievement-tools";

export type GuideReference = { label: string; url: string };

export type BuiltInGuide = {
  slug: string;
  parentSlug: string | null;
  type: "collection" | "article";
  category: string;
  title: string;
  summary: string;
  content?: string;
  expansion?: string;
  level?: string;
  audience?: string;
  tags: string[];
  imageUrl?: string;
  references?: GuideReference[];
  verifiedPatch?: string;
  verifiedOn?: string;
  order: number;
};

const official = (label: string, url: string): GuideReference => ({ label, url });
export const GUIDE_LIBRARY_PATCH = "7.56";
export const GUIDE_LIBRARY_VERIFIED_ON = "2026-09-26";

type SocietySpec = {
  slug: string;
  parentSlug: "societies-level-50" | "societies-level-60" | "societies-level-70" | "societies-level-80" | "societies-level-90";
  title: string;
  expansion: string;
  level: string;
  discipline: "Combat" | "Crafting" | "Gathering" | "Crafting & Gathering";
  unlock: string;
  base: string;
  rankQuests: string[];
  daily: string[];
  rewards: string[];
  order: number;
};

type SocietyDetail = { vendor: string; currency: string; pacing: string; stock: string[] };

const ARR_ALLIED_SOCIETY_SLUGS = new Set([
  "society-amaljaa",
  "society-sylph",
  "society-kobold",
  "society-sahagin",
  "society-ixal",
]);

const ARR_ALLIED_CHAIN = `## After every ARR society is capped — Call of the Wild
This final step is shared by **Amalj'aa, Sylph, Kobold, Sahagin, and Ixal**. It does not unlock from finishing only this society.

### Requirements
- [ ] Be a level 50 Disciple of War or Magic.
- [ ] Complete every main story quest for all five ARR societies: Trusted for the four combat societies and Sworn for Ixal.
- [ ] The original society unlocks require the level-41 MSQ **In Pursuit of the Past**; the official crossover unlock lists the completed society stories, rather than an additional later MSQ, as its prerequisite.

### Complete the full intersocietal chain
- [ ] **Call of the Wild** — accept the version offered at your current Grand Company: Trachraet at Maelstrom Command, Scarlet at the Adders' Nest, or Mimio Mio at the Hall of Flames. The three versions are alternatives; complete only your Grand Company's version.
- [ ] **Little Sylphs Lost** — continue with Gavin in New Gridania.
- [ ] **Clutching at Straws** — continue with Voyce in Little Solace.
- [ ] **Digging for Answers** — continue with Novv at Novv's Nursery.
- [ ] **Rattled in Ehcatl** — continue with Skaetswys at the 789th Order Dig.
- [ ] **Ash Not What Your Brotherhood Can Do for You** — continue with Tataramu at Ehcatl.
- [ ] **Friends Forever** — finish with Hamujj Gah at the Ring of Ash.

### What the finale unlocks
- All five ARR societies advance to **Allied** reputation together.
- **Friends Forever** awards the **Sable Death Mask** and completes the **Sore Thumb** achievement, whose title is **The Negotiator**.
- Reopen every society vendor after the finale. Allied stock adds **Wind-up Founder**, **Wind-up Violet**, **Wind-up Kobolder**, **Wind-up Sea Devil**, and **Wind-up Dezul Qualan**; each belongs to its corresponding society vendor and costs gil rather than society currency.
- Allied rank does not add another daily reputation grind. Its lasting unlocks are the finale rewards and the new vendor stock.`;

function alliedSocietyFinale(spec: SocietySpec) {
  return ARR_ALLIED_SOCIETY_SLUGS.has(spec.slug) ? `\n\n${ARR_ALLIED_CHAIN}` : "";
}

const SOCIETY_DETAILS: Record<string, SocietyDetail> = {
  "society-amaljaa": { vendor: "Amalj'aa Vendor, Ring of Ash (X:23.3, Y:14.1)", currency: "Steel Amalj'ok", pacing: "Neutral → Recognized (150) → Friendly (360) → Trusted (510) → Allied", stock: ["Recognized: expanded dyes and crafting materials.", "Trusted: Wind-up Amalj'aa (25,000 gil), Drake Horn (120,000 gil), Amalj'aa Supply Carriage, Pavis Shield, and framer's kit.", "Allied: Wind-up Founder (25,000 gil).", "Trusted is the society cap; Allied requires the ARR intersocietal finale after all five ARR societies are capped."] },
  "society-sylph": { vendor: "Sylphic Vendor, Little Solace (X:22.3, Y:26.3)", currency: "Sylphic Goldleaf", pacing: "Neutral → Recognized (150) → Friendly (360) → Trusted (510) → Allied", stock: ["Friendly: Flibbertigibbet Orchestrion Roll (3 Goldleaf).", "Trusted: Wind-up Sylph (25,000 gil), Laurel Goobbue Horn (120,000 gil), lamp furnishings, and framer's kit.", "Allied: Wind-up Violet (25,000 gil).", "Trusted is the society cap; Allied requires the ARR intersocietal finale."] },
  "society-kobold": { vendor: "Kobold Vendor, 789th Order Dig (X:21.6, Y:17.8)", currency: "Titan Cobaltpiece", pacing: "Neutral → Recognized (150) → Friendly (360) → Trusted (510) → Allied", stock: ["Recognized: expanded dye and material stock.", "Trusted: Wind-up Kobold (25,000 gil), Bomb Palanquin Horn (120,000 gil), Automaton Digger, Kobold Furnace, and framer's kit.", "Allied: Wind-up Kobolder (25,000 gil).", "Trusted is the society cap; Allied requires the ARR intersocietal finale."] },
  "society-sahagin": { vendor: "Sahagin Vendor, Novv's Nursery (X:16.9, Y:22.4)", currency: "Rainbowtide Psashp", pacing: "Neutral → Recognized (150) → Friendly (360) → Trusted (510) → Allied", stock: ["Recognized/Friendly: expanded dyes, materials, and furnishings.", "Trusted: Wind-up Sahagin (25,000 gil), Cavalry Elbst Horn (120,000 gil), Living Arch, Living Lamp, Hanging Larder, and framer's kit.", "Allied: Wind-up Sea Devil (25,000 gil).", "Trusted is the society cap; Allied requires the ARR intersocietal finale."] },
  "society-ixal": { vendor: "Ixali Vendor, Ehcatl (X:24.9, Y:22.7)", currency: "Ixali Oaknot", pacing: "Neutral → Recognized (150) → Friendly (360) → Trusted (510) → Respected (720) → Honored (990) → Sworn (1,320) → Allied", stock: ["Respected: crafting and gathering materia plus old endgame materials.", "Sworn: Wind-up Ixal (25,000 gil), Direwolf Whistle (120,000 gil), Ixali Shelter/Banner, Ehcatl Smithing Gloves, sealant, and framer's kit.", "Allied: Wind-up Dezul Qualan (25,000 gil).", "Ixal alone continues through Sworn; Allied requires the ARR intersocietal finale."] },
  "society-vanu-vanu": { vendor: "Luna Vanu, Ok' Gundu Nakki", currency: "Vanu Whitebone", pacing: "Neutral → Recognized → Friendly → Trusted → Respected → Honored → Sworn → Bloodsworn", stock: ["Recognized: Coming Home orchestrion (3) and Cookfire furnishing (gil).", "Trusted: Wind-up Gundu (30,000 gil).", "Sworn: Wind-up Zundu (30,000 gil) and Sanuwa Horn (200,000 gil).", "Bloodsworn: Vanu attire and framer's kit; Allied adds Zundu attire."] },
  "society-vath": { vendor: "Vath Stickpeddler, Loth ast Vath", currency: "Black Copper Gil", pacing: "Friendly → Trusted → Respected → Honored → Sworn → Bloodsworn", stock: ["Trusted: Wind-up Vath (30,000 gil).", "Honored: Gnathic Lamp Tree.", "Sworn: Wind-up Gnath (30,000 gil) and Kongamato Whistle (200,000 gil).", "Bloodsworn: Vath/Gnath attire and framer's kit; Allied adds Gnath thorax glamour."] },
  "society-moogle": { vendor: "Mogmul Mogbelly, Bahrr Lehs (X:15.9, Y:28.5)", currency: "Carved Kupo Nut", pacing: "Friendly → Trusted → Respected → Honored → Sworn → Bloodsworn", stock: ["Recognized/Friendly: Mogsofa and Dragon Floor Lamp.", "Honored: Moogle Slippers (100,000 gil).", "Sworn: Wind-up Dragonet (30,000 gil) and Cloud Mallow Seeds (200,000 gil).", "Bloodsworn: framer's kit; Allied adds Ohl Deeh (30,000 gil)."] },
  "society-kojin": { vendor: "Shikitahe, Tamamizu", currency: "Kojin Sango", pacing: "Friendly → Trusted → Respected → Honored → Sworn → Bloodsworn", stock: ["Trusted/Respected: minion and furnishing tiers.", "Honored: orchestrion and emote-related rewards.", "Sworn/Bloodsworn: Striped Ray mount, Kojin attire, and framer's kit.", "Allied: Redback minion and Zephyrous Zabuton."] },
  "society-ananta": { vendor: "Madhura, Castellum Velodyna", currency: "Ananta Dreamstaff", pacing: "Friendly → Trusted → Respected → Honored → Sworn → Bloodsworn", stock: ["Friendly: False Nails and initial furnishings.", "Trusted/Respected: Ananta minion, emote/music, and furnishings.", "Sworn/Bloodsworn: Marid and True Griffin mounts plus framer's kit.", "Allied: Qalyana minion and metalwork rewards."] },
  "society-namazu-crafting": { vendor: "Gyosho, Dhoro Iloh (X:5.8, Y:23.4)", currency: "Namazu Koban", pacing: "Friendly → Trusted → Respected → Honored → Sworn → Bloodsworn", stock: ["Friendly: Stuffed Namazu (5) and Steamed Bun (3).", "Trusted: Attendee #777 (7). Respected: housing permits (1).", "Honored: Yol Dance (8) and orchestrion (3). Sworn: Oroniri Cloth (7) and Effigy (8).", "Bloodsworn: Mikoshi Flute (20), framer's kit (6), and Bell; Allied adds float (8) and mask (7)."] },
  "society-pixie": { vendor: "Jul Oul, Lydha Lran (X:12.5, Y:32.8)", currency: "Fae Fancy", pacing: "Friendly → Trusted → Respected → Honored → Sworn → Bloodsworn", stock: ["Trusted: Macaron Cushion (3).", "Respected: Stuffed Porxie (5). Honored: Wind-up Pixie (8).", "Sworn: Portly Porxie Horn (18).", "Bloodsworn: Il Mheg Flower Lamp (8), Garden's Gates roll (6), and framer's kit (6)."] },
  "society-dwarf": { vendor: "Mizutt, Watt's Anvil (X:9.4, Y:13.1)", currency: "Hammered Frogment", pacing: "Friendly → Trusted → Respected → Honored → Sworn → Bloodsworn", stock: ["Trusted: Lalinator 5.H0 (8). Respected: Ironfrog Keeper (5).", "Honored: Dwarven Floor Lamp (2) and Watt's Anvil roll (6).", "Sworn: Rolling Tankard key (18).", "Bloodsworn: Lali Hop (8), Watt's Sketches (3), and framer's kit (6)."] },
  "society-qitari": { vendor: "Yuqurl Manl, Hopl's Stopple (X:37.2, Y:17.2)", currency: "Qitari Compliment", pacing: "Friendly → Trusted → Respected → Honored → Sworn → Bloodsworn", stock: ["Trusted: Behelmeted Serpent of Ronka (8). Respected: Aged Oak Log (5).", "Honored: Hopl's Dropple roll (6).", "Sworn: Ronkan Flute/Great Vessel mount (18).", "Bloodsworn: Behatted Serpent (8) and framer's kit (6)."] },
  "society-arkasodara": { vendor: "Ghanta, Svarna (X:20.4, Y:28.4)", currency: "Arkasodara Pana", pacing: "Friendly → Trusted → Respected → Honored → Sworn → Bloodsworn", stock: ["Trusted: Wind-up Arkasodara (8).", "Respected: Stuffed Cinduruva (4) and Gajasura Card (6). Honored: stuffed Minduruva/Sanduruva (4 each).", "Sworn: Hippo Cart Horn (18).", "Bloodsworn: Hippo Ridin' roll (6) and framer's kit (6)."] },
  "society-loporrit": { vendor: "Coiningway, Hoper's Hold (X:17.4, Y:15.8)", currency: "Loporrit Carat", pacing: "Friendly → Trusted → Respected → Honored → Sworn → Bloodsworn", stock: ["Trusted: Rainbow Hopping Rug (2). Respected: Findingway (8).", "Honored: Battle 1 orchestrion (6).", "Sworn: Moon-hopper key (18).", "Bloodsworn: Dreamwalker roll (6), four housing permits (1 each), and framer's kit (6)."] },
  "society-omicron": { vendor: "N-0598, Last Dregs (X:27.7, Y:24.7)", currency: "Omicron Omnitoken", pacing: "Friendly → Trusted → Respected → Honored → Sworn → Bloodsworn", stock: ["Trusted: N-7000 Card (6). Respected: Lumini (8).", "Honored: Dragonstar aux Marrons (5).", "Sworn: Miw Miisv Horn (18).", "Bloodsworn: Cradle of Hope roll (6) and framer's kit (6)."] },
  "society-pelupelu": { vendor: "Pavli, Dock Poga (X:37.0, Y:16.0)", currency: "Pelu Pelplume", pacing: "Friendly → Trusted → Respected → Honored → Sworn → Bloodsworn", stock: ["Friendly onward: battle materia XI/XII as listed by Pavli.", "Sworn: Pelupelu Framer's Kit (6).", "Bloodsworn: Pelubill Calot (9).", "Reopen Pavli after every rank story; Dawntrail stock is split across rank filters."] },
  "society-yok-huy": { vendor: "Rarkorgor, Urqopacha (X:31.2, Y:37.2)", currency: "Yok Huy Ward", pacing: "Friendly → Trusted → Respected → Honored → Sworn → Bloodsworn", stock: ["Friendly: Mason's Abrasive (1) and crafter materia XI/XII.", "Trusted: Snowline Rollick roll (6). Respected: Wind-up Yok Huy (8).", "Honored: Yok Huy Lantern (6). Sworn: Vurgar the Loyal Horn (18).", "Bloodsworn: Fahrafahr Card (8) and framer's kit (6)."] },
  "society-mamool-ja": { vendor: "Veerul Ja, Gok Golma (X:33.3, Y:36.0)", currency: "Mamool Ja Nanook", pacing: "Friendly → Trusted → Respected → Honored → Sworn → Bloodsworn", stock: ["Friendly: gatherer materia XI/XII.", "Trusted: Branchbearer Horn (18). Respected: Home at Heart roll (6).", "Honored: Ja Tiika Leafkin (8). Sworn: Tiika Selvaas (5).", "Bloodsworn: Blue Leafkin Card (6) and framer's kit (6)."] },
};

const societyGuide = (spec: SocietySpec): BuiltInGuide => ({
  slug: spec.slug,
  parentSlug: spec.parentSlug,
  type: "article",
  category: "Allied Society",
  title: spec.title,
  summary: `Complete ${spec.title} unlock, daily-task, reputation-rank, vendor, mount, and minion guide.`,
  expansion: spec.expansion,
  level: spec.level,
  audience: spec.discipline,
  tags: [spec.title.toLowerCase(), "allied society", "daily", "reputation"],
  imageUrl: "/guides/allied-society-bases.svg",
  order: spec.order,
  content: `## Unlock and base
${spec.unlock}

**Daily-quest base:** ${spec.base}

**Currency and vendor:** ${SOCIETY_DETAILS[spec.slug].currency}, exchanged with **${SOCIETY_DETAILS[spec.slug].vendor}**.

**Rank path:** ${SOCIETY_DETAILS[spec.slug].pacing}.

## Rank-story checklist
Reputation stops at the end of each rank. Complete the blue story quest before doing more dailies:
${spec.rankQuests.map((quest) => `- [ ] ${quest}`).join("\n")}

## What the daily quests ask you to do
${spec.daily.map((task) => `- ${task}`).join("\n")}

### Quality and quest-item rules
- Accept and turn in on the job receiving experience; synced quests lock their objectives to that job.
- Use the quest journal's **Map** button for the current marked search area. Quest-only enemies and nodes may not exist before acceptance.
- A required HQ item has the HQ icon in the duty list. If no HQ icon appears, normal quality is accepted. Modern gathered quest items have no HQ variant.
- Crafting objectives are under Crafting Log → Special Recipes → Allied Society Quests. Use supplied materials first; never buy an ordinary item with a similar name.
- For special combat objectives, use the supplied key item, mount action, emote, or duty action when instructed. Killing the target normally may not count.

## Vendor and reputation rewards
${SOCIETY_DETAILS[spec.slug].stock.map((reward) => `- ${reward}`).join("\n")}

Vendor stock expands immediately after the corresponding rank story. If a mount, minion, furnishing, or orchestrion roll is missing, finish that rank quest and reopen the vendor. Society currency has a cap, so spend before completing dailies that would overfill it.
${alliedSocietyFinale(spec)}

## Daily routine and troubleshooting
- [ ] Check Character → Reputation and confirm this society is not waiting on a rank quest.
- [ ] Confirm at least three of the account-wide twelve daily allowances remain.
- [ ] Accept all three local quests on the intended job, then group objectives by map area.
- [ ] Turn in on the same eligible job and check the vendor after every rank increase.
- **No quests:** daily set already completed, allowances committed elsewhere, or a capped rank story is waiting.
- **Objective absent:** use the accepting job and journal map; then check Key Items and Duty Actions.
- **Reward absent:** complete the blue rank quest, not only the final daily that filled the bar.`,
  references: [
    official("Allied Society quest and reward directory", "https://ffxiv.consolegameswiki.com/wiki/Allied_Society_Quests"),
    ...(ARR_ALLIED_SOCIETY_SLUGS.has(spec.slug)
      ? [official("Official Patch 2.35 ARR allied quest requirements and sequence", "https://na.finalfantasyxiv.com/lodestone/topics/detail/2952cde08127ad3911220b2b5744330af2f11d85")]
      : []),
  ],
});

const ALLIED_SOCIETY_GUIDES: BuiltInGuide[] = [
  societyGuide({ slug: "society-amaljaa", parentSlug: "societies-level-50", title: "Amalj'aa", expansion: "A Realm Reborn", level: "43–50", discipline: "Combat", order: 1,
    unlock: "Complete MSQ **In Pursuit of the Past**, then accept **Peace for Thanalan** from Swift in Ul'dah – Steps of Nald (X:8.4, Y:8.9). Follow it to Commander Gisilbehrt and the Ring of Ash, then complete **Brotherhood of Ash** from Hamujj Gah to open the Neutral daily pool.",
    base: "Ring of Ash, Southern Thanalan (X:23.1, Y:14.3).",
    rankQuests: ["Neutral unlock — Peace for Thanalan → Brotherhood of Ash.", "Recognized — Ranger Rescue.", "Friendly — An Eye on the Inside.", "Trusted — Martial Perfection.", "Allied — complete all five ARR society stories, then the Grand Company intersocietal chain beginning with Call of the Wild."],
    daily: ["Neutral (level 43): fight Zanr'ak targets, recover marked supplies, extinguish or activate beacons, and use quest items on specified enemies around southern Thanalan.", "Recognized (level 46): work deeper in Zanr'ak and Zahar'ak; weaken targets before using water or restraint items when the duty text says to capture or douse rather than kill.", "Friendly (level 48): assault the marked Zahar'ak objectives and rescue captives; use the journal map because ordinary Amalj'aa of a similar name do not count.", "ARR rule: every newly unlocked quest giver offers a separate three-quest pool. For fastest progress, take the highest-rank giver's three quests; all society dailies share the account-wide twelve allowances."],
    rewards: ["Recognized expands dyes and material stock.", "Trusted unlocks Wind-up Amalj'aa, Drake mount, Supply Carriage, Pavis Shield, and portrait framing.", "Allied unlocks Wind-up Founder after the five-society finale."] }),
  societyGuide({ slug: "society-sylph", parentSlug: "societies-level-50", title: "Sylphs", expansion: "A Realm Reborn", level: "42–50", discipline: "Combat", order: 2,
    unlock: "Complete MSQ **In Pursuit of the Past**, accept **Seeking Solace** from Vorsaile Heuloix in New Gridania (X:9.7, Y:11.1), then complete **Voyce of Concern** from Olmxio at Little Solace to unlock Neutral dailies.",
    base: "Little Solace, East Shroud (X:22.4, Y:26.4).",
    rankQuests: ["Neutral unlock — Seeking Solace → Voyce of Concern.", "Recognized — Pilfered Podlings.", "Friendly — Idle Hands.", "Trusted — Feathers and Folly.", "Allied — complete every ARR society story and the Call of the Wild intersocietal chain."],
    daily: ["Neutral (level 42): retrieve ritual objects, use invisibility or disguise effects when supplied, feed or calm creatures, and clear marked imperial or touched-sylph threats.", "Recognized (level 45): enter the Sylphlands for rescues and podling recovery; follow the duty-list order because interaction points can remain inactive until the prior step.", "Friendly (level 48): tackle the deepest Sylphlands objectives from Moxia; use supplied items on the named target and return any carried podling before teleporting.", "Only three quests per giver appear each day. The highest-rank giver yields the strongest reputation rate; lower-rank pools remain optional."],
    rewards: ["Friendly unlocks the Flibbertigibbet orchestrion roll.", "Trusted unlocks Wind-up Sylph, Laurel Goobbue mount, lamp furnishings, and portrait framing.", "Allied unlocks Wind-up Violet."] }),
  societyGuide({ slug: "society-kobold", parentSlug: "societies-level-50", title: "Kobolds", expansion: "A Realm Reborn", level: "41–50", discipline: "Combat", order: 3,
    unlock: "Complete MSQ **In Pursuit of the Past**, accept **Highway Robbery** from Trachraet in Limsa Lominsa Upper Decks (X:12.7, Y:12.8), then complete **How Low Can You Go** from 789th Order Pickman Gi Gu at the Dig.",
    base: "789th Order Dig, Outer La Noscea (X:21.0, Y:18.0).",
    rankQuests: ["Neutral unlock — Highway Robbery → How Low Can You Go.", "Recognized — No-good Zo Ga's Ambition.", "Friendly — The Kobold and the Beautiful.", "Trusted — Revenge of the Furred.", "Allied — complete all ARR society stories and the Grand Company intersocietal chain."],
    daily: ["Neutral (level 41): sabotage 59th/59x Order supplies, collect ore, place smart bombs, and fight marked kobolds around Camp Overlook.", "Recognized (level 44): enter U'Ghamaro for bombs, machinery, and alchemical materials; a quest item may need to be placed before the enemy or object becomes valid.", "Friendly (level 48): recover crystalline saltpeter and other deep-mine materials, defend Ba Go's devices, and defeat only the exact order/rank named.", "Each unlocked giver retains a three-quest pool. Take the newest giver's set when optimizing the 150/360/510 reputation thresholds."],
    rewards: ["Trusted unlocks Wind-up Kobold, Bomb Palanquin mount, Automaton Digger, Kobold Furnace, and portrait framing.", "Allied unlocks Wind-up Kobolder."] }),
  societyGuide({ slug: "society-sahagin", parentSlug: "societies-level-50", title: "Sahagin", expansion: "A Realm Reborn", level: "44–50", discipline: "Combat", order: 4,
    unlock: "Complete MSQ **In Pursuit of the Past**, accept **They Came from the Deep** from R'ashaht Rhiki in Limsa Lominsa Upper Decks (X:13.1, Y:12.8), then complete **Clutch and Kin** from Novv in Western La Noscea.",
    base: "Novv's Nursery, Western La Noscea (X:16.0, Y:22.0).",
    rankQuests: ["Neutral unlock — They Came from the Deep → Clutch and Kin.", "Recognized — The Scarlet Bloodletter.", "Friendly — Watching the Spawn.", "Trusted — Like Clutchfather, Like Son.", "Allied — cap all five ARR societies and complete the intersocietal chain."],
    daily: ["Neutral (level 44): fight Serpent's Tongue/Sapsa targets, recover nursery provisions, and use supplied bait or tools at the marked western La Noscea coast.", "Recognized (level 46): work farther into Sapsa Spawning Grounds; interact with clutch marks and designated spawn before fighting guardians.", "Friendly (level 48): handle the deepest spawning-ground objectives and Silverfin threats; present Novv's Clutchmark when the quest asks for parley rather than attacking.", "As with the other ARR combat societies, prioritize the newest quest giver's three quests for the best reputation per allowance."],
    rewards: ["Trusted unlocks Wind-up Sahagin, Cavalry Elbst mount, living furnishings, Hanging Larder, and portrait framing.", "Allied unlocks Wind-up Sea Devil."] }),
  societyGuide({ slug: "society-ixal", parentSlug: "societies-level-50", title: "Ixal / Ehcatl Nine", expansion: "A Realm Reborn", level: "1–50", discipline: "Crafting", order: 5,
    unlock: "Complete MSQ **In Pursuit of the Past**, accept **A Bad Bladder** from Scarlet in New Gridania (X:9.9, Y:11.4) on any class, then complete **Reaching for Cloud Nine** from Sezul Totoloc on a crafter. This awards the required Ehcatl Wristgloves and opens Neutral dailies.",
    base: "Ehcatl, North Shroud (X:24.0, Y:22.0).",
    rankQuests: ["Neutral unlock — A Bad Bladder → Reaching for Cloud Nine.", "Recognized — A Designer Job.", "Friendly — The Boy from Gridania.", "Trusted — Lathe to the Party.", "Respected — Standing at the Helm.", "Honored — Never Be Royal.", "Sworn — Spread Your Wings and Soar.", "Allied — That's Ixal, Folks, after all five ARR society stories and the intersocietal finale."],
    daily: ["Equip **Ehcatl Wristgloves** before every synthesis. The recipe is under Crafting Log → Special Recipes → Allied Society; ordinary market items never substitute.", "Obtain quest materials, speak to the named workshop supervisor for the timed Facility Access buff, and synthesize without leaving the zone. On failure or timeout, speak to that supervisor for replacement materials.", "Gathering objectives can request exact fish, branches, logs, rocks, or clusters before the craft. Bring the named items back, then use the issued component materials at the local facility.", "Deliverance is a separate daily turn-in with its own quota. Check Duty → Timers before crafting; abandoning it consumes that day's opportunity.", "Rank bands unlock at crafter levels 1, 3, 6, 10, 15, 16, and 18. A requested HQ result must meet the quality icon; if synthesis fails, replacement quest materials are free."],
    rewards: ["Respected begins Oaknot material and materia exchanges.", "Sworn unlocks Wind-up Ixal, Direwolf mount, Ixali furnishings, Ehcatl Smithing Gloves, Quick-hardening Sealant, and portrait framing.", "Allied unlocks Wind-up Dezul Qualan."] }),
  societyGuide({ slug: "society-vanu-vanu", parentSlug: "societies-level-50", title: "Vanu Vanu", expansion: "Heavensward", level: "50–60", discipline: "Combat", order: 10,
    unlock: "After **A Difference of Opinion**, accept **Three Beaks to the Wind** from Sonu Vanu, Sea of Clouds (X:11.7, Y:14.8). Follow its marked conversations and combat objectives to establish Ok' Gundu Nakki and unlock the initial daily pool.",
    base: "Ok' Gundu Nakki, Sea of Clouds (around X:6.5, Y:14.4).",
    rankQuests: ["Neutral unlock — Three Beaks to the Wind.", "Recognized — A Tribal Reunion.", "Friendly — Linu's Lovely Bones.", "Trusted — In the Skycage over the Sea.", "Respected — Fishing for Friendship.", "Honored — Sundrop the Beat.", "Sworn — Nest Side Story.", "Bloodsworn — The Nest of Honor."],
    daily: ["Fight Vundu/Gundu enemies in the marked floating-island area or weaken a target before using the supplied item.", "Ride the supplied sanuwa and use its mount action on marked targets; ordinary attacks do not count.", "Collect marked provisions or interact with destination points while avoiding nearby aggressive enemies."],
    rewards: ["Trusted: Vanu/Vundu minion stock expands.", "Honored: Sundrop Dance becomes available through the rank story.", "Sworn: Sanuwa mount and Zundu minion.", "Bloodsworn: Vanu attire and portrait-framing rewards; Allied crossover adds further glamour."] }),
  societyGuide({ slug: "society-vath", parentSlug: "societies-level-50", title: "Vath", expansion: "Heavensward", level: "50–60", discipline: "Combat", order: 20,
    unlock: "After **Lord of the Hive**, accept **The Naming of Vath** from the Vath Storyteller, Dravanian Forelands (around X:24.0, Y:19.7).",
    base: "Vath home settlement, Dravanian Forelands (around X:23.7, Y:19.1).",
    rankQuests: ["Friendly — The Naming of Vath.", "Trusted — Adventurers Don't Get Cold Feet.", "Respected — An Acquired Taste.", "Honored — Your Enemy and Mine.", "Sworn — Resistance Is Futile.", "Bloodsworn — A Symbiotic Friendship."],
    daily: ["Defeat Gnath or local wildlife named in the duty list; several targets share similar models, so use the journal map.", "Use supplied smoke, bait, or tools at marked locations before fighting the spawned target.", "Gather quest-only objects and report to the named Vath adventurer."],
    rewards: ["Trusted: Vath minion.", "Sworn: Gnath minion and Kongamato mount.", "Bloodsworn: Vath attire and portrait-framing rewards.", "Allied crossover: additional Vath/Gnath glamour."] }),
  societyGuide({ slug: "society-kojin", parentSlug: "societies-level-60", title: "Kojin of the Blue", expansion: "Stormblood", level: "60–70", discipline: "Combat", order: 10,
    unlock: "After **Tide Goes In, Imperials Go Out**, accept **Heaven-sent** from the Vexed Villager, Ruby Sea (X:6.8, Y:13.3).",
    base: "Tamamizu, Ruby Sea (around X:29.3, Y:16.8).",
    rankQuests: ["Friendly — Heaven-sent.", "Trusted — Under Wraps.", "Respected — The Value of Silence.", "Honored — Misdelivered.", "Sworn — A Test of Courage.", "Bloodsworn — True-blue."],
    daily: ["Fight Confederacy threats, sea creatures, or Red Kojin at the marked Ruby Sea location.", "Swim/dive to quest destinations; use underwater currents and Tamamizu's aetheryte to shorten routes.", "Use supplied treasure-sensing or interaction items before defeating spawned guardians."],
    rewards: ["Respected: Kojin minion stock expands.", "Honored: furnishings and orchestrion rewards.", "Sworn: Kojin attire.", "Bloodsworn: Striped Ray mount, emote/prayer reward, and portrait frame.", "Allied: Redback minion and Zephyrous Zabuton."] }),
  societyGuide({ slug: "society-ananta", parentSlug: "societies-level-60", title: "Ananta", expansion: "Stormblood", level: "60–70", discipline: "Combat", order: 20,
    unlock: "Complete the Fringes side chains **The Hidden Truth** and **The Rose Blooms Twice**, then accept **Brooding Broodmother** from M'rahz Nunh (X:30.2, Y:25.7).",
    base: "Castellum Velodyna, Fringes (around X:21.7, Y:26.2).",
    rankQuests: ["Friendly — Brooding Broodmother.", "Trusted — Griffins Rampant.", "Respected — Chance of Gales.", "Honored — It Can Be Cruel Sometimes.", "Sworn — Schism between Sisters.", "Bloodsworn — Celebratory Smorgasbord."],
    daily: ["Defeat imperial remnants, Qalyana, or local beasts in the marked Fringes area.", "Use supplied enchanted items on weakened or specified targets instead of simply killing them.", "Escort, recover, or inspect marked supplies around Velodyna and nearby settlements."],
    rewards: ["Friendly: False Nails and furnishings begin appearing.", "Trusted: Ananta minion.", "Respected: emote and music rewards.", "Sworn: Marid mount.", "Bloodsworn: True Griffin mount and portrait frame.", "Allied: Qalyana minion and metalwork rewards."] }),
  societyGuide({ slug: "society-pixie", parentSlug: "societies-level-70", title: "Pixies", expansion: "Shadowbringers", level: "70–80", discipline: "Combat", order: 10,
    unlock: "After **The Wheel Turns**, accept **Manic Pixie Dream Realm** from the Pink Pixie, Crystarium (X:13.1, Y:15.3).",
    base: "Lydha Lran, Il Mheg (around X:12.4, Y:32.9); rank stories develop Lyhe Mheg.",
    rankQuests: ["Friendly — Manic Pixie Dream Realm.", "Trusted — Sustenance for the Soul.", "Respected — The Heart's Oasis.", "Honored — A Cry from the Ashes.", "Sworn — As the Heart Bids.", "Bloodsworn — Forever and a Dream."],
    daily: ["Fight dream creatures or local fae threats in the marked Il Mheg area.", "Use the quest-specific transformation, emote, or item at marked destinations.", "Enter Lyhe Mheg when the objective explicitly names the dream realm rather than searching the overworld."],
    rewards: ["Trusted: cushion/furnishing stock.", "Respected: stuffed furnishings.", "Honored: Pixie minion.", "Sworn: Portly Porxie mount.", "Bloodsworn: lamp, orchestrion, and portrait frame."] }),
  societyGuide({ slug: "society-arkasodara", parentSlug: "societies-level-80", title: "Arkasodara", expansion: "Endwalker", level: "80–90", discipline: "Combat", order: 10,
    unlock: "Complete both Thavnair sidequest chains ending in **A Budding Adventure**, then accept **Hippos Born to Run** from Kancana (X:25.3, Y:31.2).",
    base: "Svarna, Thavnair (around X:20.4, Y:28.4).",
    rankQuests: ["Friendly — Hippos Born to Run.", "Trusted — A Pachyderm's Promptitude.", "Respected — Hippo Healing.", "Honored — Defiant Ogul, Deified!", "Sworn — Leader to Leader.", "Bloodsworn — The Hippo Riders."],
    daily: ["Fight marked Thavnair creatures or bandits, sometimes after using a supplied lure or disguise.", "Ride the quest hippo cart and use its duty action at delivery/obstacle targets.", "Collect or deliver quest cargo at the exact settlement marker."],
    rewards: ["Trusted: Arkasodara minion.", "Respected/Honored: cards and stuffed furnishings.", "Sworn: Hippo Cart mount.", "Bloodsworn: orchestrion and portrait frame."] }),
  societyGuide({ slug: "society-pelupelu", parentSlug: "societies-level-90", title: "Pelupelu", expansion: "Dawntrail", level: "90–100", discipline: "Combat", order: 10,
    unlock: "After the required Dawntrail MSQ, accept **An Intrepid New Enterprise** from the Blue-garbed Pelu, Tuliyollal (around X:14.0, Y:13.0).",
    base: "Dock Poga, Kozama'uka (around X:37.2, Y:16.8).",
    rankQuests: ["Friendly — An Intrepid New Enterprise.", "Trusted — A Tentative First Tour.", "Respected — Earthenshire Awaits.", "Honored — Recruitment Drive.", "Sworn — A Guest From Across the Salt.", "Bloodsworn — Partners in Pel."],
    daily: ["Protect tour routes by defeating the exact local monsters shown in the journal map.", "Use supplied tour, camera, food, or trade items at highlighted destinations.", "Escort or demonstrate attractions; read the duty-list order because visiting the right place out of sequence may not count."],
    rewards: ["Friendly: Ohokaliy-related stock.", "Trusted: Pelupelu minion and music.", "Respected: Punutiy reward tier.", "Honored: Pelupack.", "Sworn: portrait frame.", "Bloodsworn: Pelubill Calot and final vendor tier."] }),

  societyGuide({ slug: "society-moogle", parentSlug: "societies-level-50", title: "Moogle", expansion: "Heavensward", level: "50–60", discipline: "Crafting", order: 30,
    unlock: "After **Moglin's Judgment**, complete Mogleo's chain: **A Pebble for Your Thoughts → Spineless Wadjets → Far from Home → A Nutty Initiation**. Complete Mogloo's chain: **Protecting the Pom → Save the Pomguard → An Urgent Message → A Moogle's Intuition → An Uneasy Feeling → Trouble at Zenith**. After **He Who Would Not Be Denied**, start with the Unflinching Temple Knight in the Pillars (X:11.5, Y:11.0) and complete **Into the Mists → Bitter Is the Night → Scouting and Maiming → Finders Keepers → These Things Take Time → An Unwelcome Surprise → A Meter Too Far → Thar Be Dragons → Laying the First Brick**. Then accept **Tricks and Stones** from the Seething Stonemason, Churning Mists (X:27.2, Y:34.5) on a level-50 crafter.",
    base: "Bahrr Lehs, Churning Mists (around X:15.7, Y:28.8).",
    rankQuests: ["Neutral — Tricks and Stones.", "Recognized — The Milk of Moogle Kindness.", "Friendly — Trying Times.", "Trusted — A Crystalline Solution.", "Respected — The Tools Make the Moogle.", "Honored — A Monumental Task.", "Sworn — Piecing Together the Past (Moogle Dance).", "Bloodsworn — The Zenith of Craftsmanship."],
    daily: ["Craft the active Special Recipe with supplied kupo materials; the recipe normally accepts NQ unless the duty list shows an HQ icon.", "Some quests add a nearby interaction or delivery after synthesis—keep the finished quest item.", "Use Trial Synthesis if undergeared; main hand, off hand, and chest provide the largest early stat gains."],
    rewards: ["Recognized: Mogsofa and lamp rewards begin.", "Honored: Moogle slippers.", "Sworn: Moogle Dance, Dragonet minion, and Cloud Mallow mount.", "Bloodsworn: portrait frame.", "Allied: Ohl Deeh minion."] }),
  societyGuide({ slug: "society-namazu-crafting", parentSlug: "societies-level-60", title: "Namazu", expansion: "Stormblood", level: "60–70", discipline: "Crafting & Gathering", order: 30,
    unlock: "Complete Kurobana's Yanxia chain and Gyorin's Azim Steppe chain, then accept the Namazu society unlock leading to **One Size Fits All**.",
    base: "Dhoro Iloh, Azim Steppe (around X:5.8, Y:23.4).",
    rankQuests: ["Friendly — Something Fishy This Way Comes → One Size Fits All.", "Trusted — Big, Big Fish.", "Respected — Waiting for Gyodo.", "Honored — Out of the Frypan.", "Sworn — Into the Fire.", "Bloodsworn — Disciples of Creation (Namazu Bell)."],
    daily: ["Craft the exact Special Recipe on the accepting crafter using supplied materials.", "Miner, botanist, and fisher quests use quest-only nodes, bait, and marked locations on the accepting gatherer.", "If the quest combines a craft/gather and field delivery, do not discard the quest item.", "No HQ is required unless the objective explicitly displays HQ; modern gathered quest items have no HQ variant."],
    rewards: ["Trusted: Attendee #777 minion.", "Respected: housing permits.", "Honored: Yol Dance and music.", "Sworn: materials and furnishings.", "Bloodsworn: Mikoshi mount, bell, and frame.", "Allied: Namazu mask and float."] }),
  societyGuide({ slug: "society-dwarf", parentSlug: "societies-level-70", title: "Dwarves", expansion: "Shadowbringers", level: "70–80", discipline: "Crafting", order: 20,
    unlock: "Complete Ronitt's Kholusia sidequest chain, then accept **It's Dwarfin' Time** from the Affable Townsdwarf (X:15.7, Y:30.3).",
    base: "Watt's Anvil, Lakeland (around X:9.1, Y:12.9).",
    rankQuests: ["Friendly — It's Dwarfin' Time.", "Trusted — A Piss-up in a Brewery.", "Respected — I Heard You Like Tanks.", "Honored — Tanking Is Hard.", "Sworn — Chief Concerns.", "Bloodsworn — Tanks for the Memory."],
    daily: ["Craft the quest recipe with supplied prototype parts under Special Recipes.", "Deliver or test the completed component where the duty list marks; some quests are not finished at the crafting table.", "The quest is synced and must be completed on the crafter that accepted it."],
    rewards: ["Trusted: Lalinator minion.", "Honored: orchestrion rewards.", "Sworn: Rolling Tankard mount.", "Bloodsworn: Lali Hop emote and portrait frame."] }),
  societyGuide({ slug: "society-loporrit", parentSlug: "societies-level-80", title: "Loporrits", expansion: "Endwalker", level: "80–90", discipline: "Crafting", order: 20,
    unlock: "Finish Dreamingway's Mare Lamentorum sidequests, then accept **Must Be Dreaming(way)** from Dreamingway in Old Sharlayan (X:11.7, Y:10.9).",
    base: "Hoper's Hold, Mare Lamentorum (around X:17.4, Y:16.0).",
    rankQuests: ["Friendly — Must Be Dreaming(way).", "Trusted — The Incredible Machines.", "Respected — Too Few Cooks.", "Honored — Teamwork Makes the Dream Work.", "Sworn — A Million Malms Away.", "Bloodsworn — Dreams Come True (unlocks Ear Wiggle)."],
    daily: ["Craft the performance/venue item shown in Special Recipes with supplied materials.", "Use the completed item or interact with the marked venue object when instructed.", "NQ is normally accepted; obey an HQ icon if the duty list explicitly shows one."],
    rewards: ["Trusted: rug/furnishing stock.", "Respected: Findingway minion.", "Honored: orchestrion rewards.", "Sworn: Moon-hopper mount.", "Bloodsworn: Ear Wiggle emote, permits, music, and portrait frame."] }),
  societyGuide({ slug: "society-yok-huy", parentSlug: "societies-level-90", title: "Yok Huy", expansion: "Dawntrail", level: "90–100", discipline: "Crafting", order: 20,
    unlock: "After Dawntrail and the **Brains and Brawn** side chain, accept **Frosty Neighbors** from Fahrafahr, Urqopacha (X:32.1, Y:34.3).",
    base: "Worlar's Echo, Urqopacha (around X:30.5, Y:34.2).",
    rankQuests: ["Friendly — Frosty Neighbors.", "Trusted — Still as Stone.", "Respected — Buried Memories.", "Honored — The Pact.", "Sworn — Forged in Corn.", "Bloodsworn — With High Spirits."],
    daily: ["Craft the quest-specific memorial, food, or community item under Special Recipes.", "Use supplied ingredients; similar market items do not substitute.", "Deliver on the accepting class. HQ is required only if the duty list displays the HQ icon."],
    rewards: ["Trusted: orchestrion reward tier.", "Respected: Yok Huy minion.", "Honored: lantern furnishing.", "Sworn: Vurgar Loyal mount.", "Bloodsworn: portrait frame and card."] }),

  societyGuide({ slug: "society-qitari", parentSlug: "societies-level-70", title: "Qitari", expansion: "Shadowbringers", level: "70–80", discipline: "Gathering", order: 30,
    unlock: "Complete the Rak'tika Great Serpent/Ronkan sidequest chains, then accept **The Stewards of Note** from the Concerned Mother (around X:21.0, Y:27.6).",
    base: "Hopkins' Stop, Rak'tika Greatwood (around X:37.2, Y:17.5).",
    rankQuests: ["Friendly — The Stewards of Note.", "Trusted — Wisdom of the Night, then choose one First Stela interpretation.", "Respected — Delving Deeper, then choose one Second Stela interpretation.", "Honored — A Chilling Fate, then choose one Third Stela interpretation.", "Sworn — What Ails the Forest → History's No Mystery.", "Bloodsworn — Glory Be to the Scree. Interpretation choices change story/settlement presentation, not mechanical rewards."],
    daily: ["Mine or harvest quest-only relics at the highlighted excavation area.", "Use appraisal/collectability actions only when the duty list displays a rating.", "Return on the accepting gatherer; switching disciplines can hide the quest nodes."],
    rewards: ["Trusted: Behelmeted Serpent minion.", "Honored: orchestrion reward.", "Sworn: Great Vessel of Ronka mount.", "Bloodsworn: Behatted Serpent minion and portrait frame."] }),
  societyGuide({ slug: "society-omicron", parentSlug: "societies-level-80", title: "Omicron", expansion: "Endwalker", level: "80–90", discipline: "Gathering", order: 30,
    unlock: "Finish Endwalker and the Stigma Dreamscape chain, then accept **The Café at the End of the Universe** from Jammingway, Ultima Thule (X:25.4, Y:26.3).",
    base: "Last Dregs, Ultima Thule (around X:27.7, Y:24.4).",
    rankQuests: ["Friendly — The Café at the End of the Universe.", "Trusted — The Restaurant at the End of the Universe.", "Respected — So Long, and Thanks for All the Fish.", "Honored — And Another Thing...", "Sworn — The Hitchhiker's Guide to the Galaxy.", "Bloodsworn sequence — Mostly Harmless → Life, the Universe and Everything."],
    daily: ["Gather quest-only ingredients from marked Ultima Thule nodes on miner/botanist.", "For fisher objectives, enable Collect when instructed and use the named bait/hole.", "No gathered HQ requirement exists; satisfy quantity and any displayed collectability threshold."],
    rewards: ["Trusted: card reward tier.", "Respected: Lumini minion.", "Honored: food/furnishing stock.", "Sworn: Miw Miisv mount.", "Bloodsworn: orchestrion and portrait frame."] }),
  societyGuide({ slug: "society-mamool-ja", parentSlug: "societies-level-90", title: "Mamool Ja", expansion: "Dawntrail", level: "90–100", discipline: "Gathering", order: 30,
    unlock: "Complete both Yak T'el side chains that merge into **One Forest**, then accept **Cultivating Hope** from Gotoll Ja (X:35.6, Y:32.0).",
    base: "Gok Golma, Yak T'el (around X:33.2, Y:36.0).",
    rankQuests: ["Friendly — Cultivating Hope.", "Trusted — Doppro Tradition.", "Respected — A Hoobigo's Return.", "Honored — The Boon of Boonewa.", "Sworn — A New Yak T'el.", "Bloodsworn — The Pride of Mamook."],
    daily: ["Quest nodes are not in the normal Gathering Log; select the journal objective and use Map.", "Gather the quest-only seed, soil, plant, or water item on the class that accepted the quest.", "No HQ variant is required. Meet any displayed collectability and exact quantity before leaving the area."],
    rewards: ["Trusted: Branchbearer minion.", "Respected: orchestrion reward.", "Honored: Ja Tiika Leafkin minion.", "Sworn: Tiika Selvaas mount.", "Bloodsworn: portrait frame and card."] }),
];

const GUIDE_DEFINITIONS: BuiltInGuide[] = [
  { slug: "treasure-map-identification", parentSlug: null, type: "article", category: "Treasure Maps", title: "Treasure Map Identification Guide", summary: "Use the Discord map reader, correct its filters, confirm a known coordinate, and safely teach future matches.", expansion: "Multiple", level: "1–100", audience: "All players", tags: ["treasure map", "discord", "coordinates", "map reader", "party size"], imageUrl: "/guides/field-operations.svg", order: 5,
    content: `## What the map reader does
Post a clear screenshot of a deciphered treasure-map card in the configured public map channel. The bot first verifies that the image has the expected parchment card, title area, player-count badge, and marked map region. It reads the zone and recommended party size, then compares only the known locations that fit those filters. Images posted elsewhere are processed only through the private map-identification command.

## Reading the result
**Map Matched** means one known location cleared the automatic confidence threshold. The reply includes the zone, coordinates, recommended party size, and confidence. **Map Needs Confirmation** means the card was recognized but the top candidates were too close or a filter was uncertain. The listed coordinates are ranked suggestions, not a promise that the first result is correct.

## Confirm or correct
- Use **Confirm / Choose Location** when the zone and player count are correct. Pick the coordinate that matches the in-game map; the complete known coordinate list remains available even when only the best four appear in the message.
- Use **Correct Filters / Rescan** only when the detected zone, player count, or map family is wrong. Supply the corrected filter and let the bot rank the matching catalog again.
- Manual coordinate entry appears only when the selected filter combination has no catalog coordinate to choose.

## Learning and officer approval
A member confirmation resolves the current request, but it does not immediately become training data. An officer must approve the confirmed result before its normalized fingerprint can influence future matches. This two-step safeguard prevents an accidental click, joke response, or poor screenshot from teaching the system the wrong location.

## Better screenshots
- Fill most of the image with the full map card while keeping all four edges visible.
- Keep the zone title in the upper-left, player badge in the lower-left, and red X unobstructed.
- Avoid heavy compression, glare, filters, overlays, or a cursor covering the title.
- If the first image fails, crop closer to the card and repost it rather than repeatedly confirming a weak guess.

Raw uploaded image data is cached for no more than fifteen minutes. Approved matching information is a derived fingerprint rather than a permanent copy of the screenshot. Map coordinates and catalog coverage can be incomplete, so use the in-game map and **Dig** feedback as the final check.`,
    references: [official("Official FINAL FANTASY XIV Materials Usage License", "https://support.na.square-enix.com/rule.php?id=5382&la=1&tag=authc")] },
  { slug: "arr-allied-society-finale", parentSlug: "societies-level-50", type: "article", category: "Allied Societies", title: "ARR Allied Society Finale", summary: "Complete Call of the Wild and the full intersocietal quest chain to earn Sore Thumb, The Negotiator, and every Allied-rank vendor unlock.", expansion: "A Realm Reborn", level: "50", audience: "Combat", tags: ["call of the wild", "friends forever", "sore thumb", "the negotiator", "allied"], imageUrl: "/guides/crafting.svg", order: 6,
    content: ARR_ALLIED_CHAIN,
    references: [official("Official ARR intersocietal quest announcement", "https://na.finalfantasyxiv.com/lodestone/topics/detail/7abb5df7a7357d6ae6d1985b5e0be9392116682e")] },
  { slug: "relics", parentSlug: null, type: "collection", category: "Equipment", title: "Relic Weapons & Tools", summary: "Expansion-by-expansion paths for combat relics and profession tools.", tags: ["relic", "weapon", "tool"], imageUrl: "/guides/relics.svg", order: 10 },
  { slug: "combat-relics", parentSlug: "relics", type: "collection", category: "Combat Relics", title: "Combat Relic Weapons", summary: "Choose a relic by level and expansion, then follow its unlocks, currencies, stages, and replica rules.", tags: ["combat", "weapon"], imageUrl: "/guides/relic-stage-route.svg", order: 10 },
  { slug: "zodiac-weapons", parentSlug: "combat-relics", type: "collection", category: "Combat Relic", title: "Level 50: Zodiac Weapons", summary: "The complete A Realm Reborn relic workspace, split into detailed stages from the first broken weapon through Zeta.", expansion: "A Realm Reborn", level: "50", audience: "Combat", tags: ["zodiac", "atma", "animus", "novus", "nexus", "zeta"], imageUrl: "/guides/relics.svg", order: 10,
    content: `## Before you begin
Complete the level 50 job quests and 2.0 story, then start **The Weaponsmith of Legend** in Vesper Bay. Keep the relic equipped when a quest asks for it.

## The complete path
- **Relic and Zenith:** build the job weapon, clear its trials, and enhance it with Thavnairian Mist.
- **Atma:** complete FATEs in the twelve named zones with Zenith equipped.
- **Animus:** complete nine books of enemies, dungeons, FATEs, and leves.
- **Novus:** obtain a Sphere Scroll, gather Alexandrite, and meld materia.
- **Nexus:** earn light from duties and ask the quest NPC to report progress.
- **Zodiac and Zeta:** complete four item quests, supply crafted items, and finish the final light stage.

> Use unrestricted parties for old duties unless the quest requires a synced clear. Confirm a replica exists before discarding an intermediate relic.

## What carries forward
A completed Zeta unlocks replicas and can be traded to skip the opening crystal stage of one Anima weapon.`, references: [official("Official Zodiac quest database", "https://na.finalfantasyxiv.com/lodestone/playguide/db/quest/?category2=3")] },
  { slug: "anima-weapons", parentSlug: "combat-relics", type: "collection", category: "Combat Relic", title: "Level 60: Anima Weapons", summary: "A stage-by-stage Heavensward relic workspace covering crystals, Poetics, crafted items, light, stats, and replicas.", expansion: "Heavensward", level: "60", audience: "Combat", tags: ["anima", "poetics", "crystal sand"], imageUrl: "/guides/relics.svg", order: 20 },
  { slug: "anima-complete-route", parentSlug: "anima-weapons", type: "article", category: "Anima Walkthrough", title: "Complete Route & Material Totals", summary: "The complete Anima route in one page, from Animated through Lux.", expansion: "Heavensward", level: "60", audience: "Combat", tags: ["anima", "route", "materials"], imageUrl: "/guides/relics.svg", order: 10,
    content: `## Unlock and starting NPCs
- [ ] Finish the Heavensward main-scenario quest **Heavensward**.
- [ ] Accept **An Unexpected Proposal** from **Rowena**, Idyllshire (X:5.7, Y:5.5), then meet **Ardashir** and Gerolt in Alpha Quadrant, Azys Lla (X:7.4, Y:11.5).
- [ ] Keep a second weapon for the job; several turn-ins require the Anima weapon unequipped.

## 1. Soul without Life — Animated weapon
Choose one route:
- [ ] **Crystal route:** complete FATEs in all six Heavensward field zones until each luminous crystal drops: Wind/Sea of Clouds, Fire/Azys Lla, Lightning/Churning Mists, Ice/Coerthas Western Highlands, Earth/Dravanian Forelands, Water/Dravanian Hinterlands. The quest may be completed on any job.
- [ ] **Zeta route:** surrender one completed Zodiac Zeta to the Syndony NPC to receive Astral and Umbral Nodules. Confirm Zeta replicas are unlocked first; the original is destroyed.
- [ ] Give the six crystals or both nodules to Ardashir for the item-level 170 Animated weapon.

## 2. Toughening Up — Awoken weapon
Equip the Animated weapon for every final boss and clear in this order:
- [ ] Snowcloak.
- [ ] Sastasha (Hard).
- [ ] The Sunken Temple of Qarn (Hard).
- [ ] Keeper of the Lake.
- [ ] Wanderer's Palace (Hard).
- [ ] Amdapor Keep (Hard).
- [ ] The Dusk Vigil.
- [ ] Sohm Al.
- [ ] The Aery.
- [ ] The Vault.
- [ ] Speak to Ardashir, then complete the requested open-world enemies/conversations and receive the Awoken weapon.

## 3. Coming into Its Own — item-level 210
Speak with **Cristiana**, Revenant's Toll after Ardashir sends you. Obtain:
- [ ] 10 Unidentifiable Bone + 4 HQ Adamantite Francesca → Enchanted Rubber.
- [ ] 10 Unidentifiable Shell + 4 HQ Titanium Alloy Mirror → Fast-drying Carboncoat.
- [ ] 10 Unidentifiable Ore + 4 HQ Dispelling Arrow → Divine Water.
- [ ] 10 Unidentifiable Seeds + 4 HQ Kingcake → Fast-acting Allagan Catalyst.

Unidentifiable items can be bought with Poetics, allied-society currency, or exchanged from Alexander Gordias tokens. Crafted items can be made or purchased and must be HQ. Deliver all four materials and the Awoken weapon to Gerolt in Azys Lla.

## 4. Finding Your Voice — Hyperconductive
- [ ] Obtain 5 **Aether Oils**. The direct route is 350 Poetics each (1,750 total); the weekly Crystal Tower quest is an alternative.
- [ ] Give the oils and Anima weapon to Ardashir for item level 230.

## 5. A Dream Fulfilled — Reconditioned
- [ ] Speak with Ardashir, then **Ulan** in Idyllshire.
- [ ] Obtain **Crystal Sand** through Ulan's exchange menu and matching **Umbrite** for 75 Poetics each.
- [ ] Convert one Crystal Sand + one Umbrite into treated sand and allocate the displayed points. Expect roughly 57–60 pairs because later conversions can bonus.
- [ ] Continue until all 240 attribute points are assigned; return to Ardashir for item level 240.

Common Crystal Sand exchanges use crafter/gatherer scrip items, materia, primal items, leves, or other listed pairs. Check Ulan's live menu and choose the cheapest currency already available to the character.

## 6. Future Proof — Sharpened
- [ ] Obtain 50 **Singing Clusters**.
- [ ] Buy them for 40 Poetics each, complete the daily quest for one, and/or complete the weekly quest for eighteen.
- [ ] Deliver all 50 with the Reconditioned weapon for item level 260.

## 7. Born Again Anima — density and three dungeons
- [ ] With the weapon available, clear Lost City of Amdapor (Hard) for the magicked bauble.
- [ ] Clear Great Gubal Library (Hard) for the ancient magicked poppet.
- [ ] Clear Sohm Al (Hard) for spectral magma.
- [ ] Activate the Processing/Verification Nodes, then collect **2,000 aetheric density** from qualifying duties with the weapon equipped at completion.

Alexander: The Eyes of the Creator (Savage), often called A9S, is a common unrestricted farm because it clears quickly with a small party. Any listed qualifying activity works; temporary bonuses change efficiency.

## 8. Some Assembly Required and Best Friends Forever
- [ ] Obtain 15 **Pneumite**: 100 Poetics each, 4,000 Company Seals each, or alternate treasure/raid/scrip sources.
- [ ] Load them into the Processing Node for the Newborn Soulstone.
- [ ] Complete the three requested trials—Containment Bay S1T7, P1T6, and Z1T9—then finish the quest conversations.
- [ ] Buy the final **Archaic Enchanted Ink** for 500 Poetics when requested and complete the victory-lap duties with the weapon.
- [ ] Return to Ardashir/Gerolt for the item-level 275 Lux weapon.

## Per-weapon shopping summary
- 40 Unidentifiable items and 16 HQ crafts.
- 5 Aether Oil.
- Roughly 57–60 Crystal Sand and equal Umbrite.
- 50 Singing Clusters.
- 15 Pneumite.
- 1 Archaic Enchanted Ink.

## Replicas and repeat weapons
- [ ] After a stage is accepted, inspect the **Restoration Node** in Azys Lla for unlocked replicas.
- [ ] Do not discard a functional stage until its replica appears.
- [ ] One-time story quests stay complete; repeat weapons start through Ardashir's repeatable options and still pay the per-weapon materials.

## Troubleshooting
- **Dungeon did not count:** weapon was not equipped at the final boss or duties were completed out of the required order.
- **Crystal will not drop:** verify the correct Heavensward zone; the active job does not need to match the relic.
- **Cannot hand in weapon:** equip another weapon and move the Anima item into inventory/Armoury Chest.
- **No density message:** finish the Born Again Anima setup through the Verification Node before farming.`, references: [official("Complete Anima quest requirements", "https://ffxiv.consolegameswiki.com/wiki/Anima_Weapons/Quest")] },
  { slug: "eurekan-weapons", parentSlug: "combat-relics", type: "collection", category: "Combat Relic", title: "Level 70: Eurekan Weapons", summary: "A four-zone workspace for crystals, kettle light, Logos Actions, stats, and Physeos.", expansion: "Stormblood", level: "70", audience: "Combat", tags: ["eureka", "anemos", "pagos", "pyros", "hydatos"], imageUrl: "/guides/field-operations.svg", order: 30 },
  { slug: "eurekan-complete-route", parentSlug: "eurekan-weapons", type: "article", category: "Eurekan Walkthrough", title: "Complete Four-Zone Route", summary: "All weapon stages and zone gates from Anemos through Hydatos and Physeos.", expansion: "Stormblood", level: "70", audience: "Combat", tags: ["eureka", "route", "crystals"], imageUrl: "/guides/field-operations.svg", order: 10,
    content: `## Before the first crystal
- [ ] Finish Stormblood and the chosen job's level-70 job quest.
- [ ] Accept **And We Shall Call It Eureka** from **Galiena**, Rhalgr's Reach (X:9.8, Y:12.5), then enter through **Rodney** in Kugane.
- [ ] Put the job's **Antiquated** weapon in inventory. If it was discarded, buy another from a Calamity Salvager for 1,000 gil.

Only Stormblood jobs have Eurekan weapons. Each weapon is independent, but elemental level, story access, Logos discoveries, and Baldesion Arsenal access are shared.

## Anemos weapon — 1,300 Protean and 3 feathers
- [ ] Trade the Antiquated weapon and **100 Protean Crystals** to Gerolt for the starter upgrade.
- [ ] Trade **400 Protean Crystals** for +1.
- [ ] Trade **800 Protean Crystals** for +2.
- [ ] On the matching job, trade **3 Pazuzu's Feathers** for the Anemos weapon.

Notorious monsters award Anemos Crystals; Gerolt converts each into several Protean Crystals. Equal-or-higher elemental enemies can also drop Protean Crystals. Gold credit on **Wail in the Willows** awards 3 feathers, or the Expedition Birdwatcher sells each for 300 Protean Crystals. Finishing any Anemos weapon unlocks its replicas from Staelhundr.

## Pagos weapon — kettle light, crystals, and Louhi
- [ ] Reach elemental level 25, accept Gerolt's kettle step, and have at least one Anemos weapon.
- [ ] Fill the kettle with vitiated aether from suitable enemies and notorious monsters; convert full charges at the **Crystal Forge (X:6.0, Y:21.5)**. The kettle holds only 9 charges.
- [ ] Spend **5 Frosted Protean Crystals** for Pagos.
- [ ] Spend **10 Frosted Protean Crystals + 500 Pagos Crystals** for Pagos +1.
- [ ] Spend **16 Frosted Protean Crystals + 5 Louhi's Ice** for Elemental.

Gold credit on **Louhi on Ice** awards 2 Louhi's Ice; the birdwatcher also sells each for 50 Pagos Crystals. Total: **31 Frosted Protean, 500 Pagos Crystals, and 5 Louhi's Ice**.

## Pyros weapon — Logos gates
- [ ] Appraise logograms and register **10 unique Logos Actions**; spend **150 Pyros Crystals** for Elemental +1.
- [ ] Register **20 unique actions**; spend **200 Pyros Crystals** for Elemental +2.
- [ ] Register **30 unique actions**; spend **300 Pyros Crystals + 5 Penthesilea's Flames** for Pyros.

Gold credit on **Lost Epic** awards 3 flames, or buy each for 50 Pyros Crystals. Total: **650 Pyros Crystals, 5 flames, and 30 unique actions**. After obtaining a Pyros weapon, the Mark II Crystal Forge (X:22.3, Y:6.0) can convert new kettle light into Smoldering Protean Crystals for optional random substat rolls.

## Hydatos weapon — final appearance
- [ ] Spend **50 Hydatos Crystals** for Hydatos.
- [ ] Spend **100 Hydatos Crystals** for Hydatos +1.
- [ ] Spend **100 Hydatos Crystals** for the base Eureka stage.
- [ ] Spend **100 Hydatos Crystals + 5 Crystalline Scales** for the Eureka weapon.

Hydatos notorious monsters award crystals. Gold credit on **Crystalline Provenance** awards 3 scales; unlike earlier boss items, scales are not sold by the birdwatcher. Total: **350 Hydatos Crystals and 5 scales**. This Eureka stage is the completed glamour appearance.

## Optional Physeos endpoint
- [ ] Unlock and organize for the Baldesion Arsenal; do not enter an assigned portal without the group's approval.
- [ ] Collect **100 Eureka Fragments** from Arsenal bosses and trade them with the Eureka weapon for Physeos.

A full clear awards 28 fragments, so one weapon needs at least four successful full runs. Physeos looks the same as Eureka but gains a large elemental bonus inside Eureka and the Arsenal.

## Troubleshooting
- **Gerolt has no upgrade:** carry the immediately previous weapon, use the matching job for the Anemos hand-in, and finish that zone's story requirement.
- **No kettle light:** obtain the kettle first and fight level-appropriate targets; empty it before its 9-charge cap.
- **Pyros option locked:** the Logos gate counts unique actions registered in the log, not actions currently carried.
- **Only want glamour:** stop at Eureka. Physeos matters for Eureka combat, not its appearance.`, references: [official("Official Eureka guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/eureka/"), official("Complete Eurekan weapon material table", "https://ffxiv.consolegameswiki.com/wiki/Eurekan_Weapons")] },
  { slug: "resistance-weapons", parentSlug: "combat-relics", type: "collection", category: "Combat Relic", title: "Level 80: Resistance Weapons", summary: "A stage-by-stage Save the Queen workspace covering every gate, memory source, raid, stat step, and replica.", expansion: "Shadowbringers", level: "80", audience: "Combat", tags: ["bozja", "zadnor", "resistance", "memories"], imageUrl: "/guides/field-operations.svg", order: 40 },
  { slug: "resistance-complete-route", parentSlug: "resistance-weapons", type: "article", category: "Resistance Walkthrough", title: "Complete Resistance Route", summary: "All shared and repeatable stages from the base Resistance weapon through Blade's.", expansion: "Shadowbringers", level: "80", audience: "Combat", tags: ["bozja", "route", "memories"], imageUrl: "/guides/field-operations.svg", order: 10,
    content: `## Unlock the base weapon
- [ ] Finish Shadowbringers through **Vows of Virtue, Deeds of Cruelty** and the Return to Ivalice alliance-raid storyline.
- [ ] Accept **Hail to the Queen** in Kugane and follow the chain through Gangos.
- [ ] Complete **Resistance Is (Not) Futile** with **Zlatan**, Gangos (X:6.1, Y:4.9). The first weapon is free; later base weapons cost 4 Thavnairian Scalepowders (1,000 Poetics total).

## Augmented Resistance — 60 memories
Complete A Sober Proposal from Stressed Soldier (5.6,5.4), then **For Want of a Memory** from Zlatan.
- [ ] 20 Tortured Memories: Southern Entrenchment in Bozja, or guaranteed FATEs in Coerthas Western Highlands/Sea of Clouds.
- [ ] 20 Sorrowful Memories: Old Bozja, or FATEs in Dravanian Forelands/Churning Mists.
- [ ] 20 Harrowing Memories: Alermuc Climb, or FATEs in Dravanian Hinterlands/Azys Lla.

The weapon/job need not be equipped for drops. Deliver all 60 to Zlatan.

## Recollection — bitter memories
- [ ] Accept **The Will to Resist**.
- [ ] Obtain 6 Bitter Memories from level-60 dungeons, Duty Roulette: Leveling's daily reward, or Bozjan activities.
- [ ] Deliver them with the Augmented weapon for Recollection.

## Law's Order — one-time raid memories, then artifacts
- [ ] Progress Bozja story through Castrum Lacus Litore and unlock Delubrum Reginae.
- [ ] **Change of Arms:** obtain 15 Loathsome Memories from Crystal Tower alliance raids or qualifying Bozjan critical engagements.
- [ ] Complete Delubrum Reginae and the weapon quest to receive Law's Order.
- [ ] **The Resistance Remembers** is one-time: obtain 18 Haunting Memories from Shadow of Mhach raids or Gyr Abania FATEs, and 18 Vexatious Memories from Return to Ivalice raids or Far East FATEs.
- [ ] Obtain 15 Timeworn Artifacts from Delubrum Reginae or Palace of the Dead for Augmented Law's Order.

## Blade's weapon — Zadnor collections
Unlock Zadnor and accept the one-time collection chain:
- [ ] 30 Compact Axles and 30 Compact Springs: Zadnor zone 1 skirmishes/CEs or Alexander raids.
- [ ] 30 A Day in the Life: Battles for the Realm and 30 Beyond the Rift: Zadnor zone 2 or Omega raids.
- [ ] 30 Bleak Memories and 30 Lurid Memories: Zadnor zone 3 or Eden normal raids.

After those account-wide steps:
- [ ] Collect 15 **Raw Emotions** per weapon from Dalriada, Delubrum Reginae, level-70 dungeons, or deeper Palace of the Dead floors.
- [ ] Deliver them through Zlatan/Gerolt for the item-level 535 Blade's weapon.

## Efficiency and repeat weapons
- [ ] Finish Bozja story/rank while gathering the first 60 memories so later duties are already unlocked.
- [ ] One-time 18+18 and Zadnor 30-item collections never repeat on later weapons.
- [ ] Repeat weapons still require their base powders, 60 colored memories, 6 bitter, 15 loathsome, 15 timeworn artifacts, and 15 raw emotions.
- [ ] Equip an essence and useful Lost Actions in Castrum, Delubrum, and Dalriada; these dramatically reduce run time.

## Troubleshooting
- **Memory does not drop:** confirm the quest is active and the zone/raid belongs to that exact color.
- **Castrum/Delubrum unavailable:** raise Resistance rank and finish the current Bozja story quest.
- **Weapon cannot be submitted:** equip a spare weapon and move the Resistance weapon into inventory/Armoury Chest.
- **Later weapon asks for one-time items:** verify the original one-time quest was completely turned in, not merely accepted.`, references: [official("Resistance memory stage data", "https://ffxiv.consolegameswiki.com/wiki/Augmented_Resistance_Weapons/Quest"), official("Resistance one-time memory data", "https://ffxiv.consolegameswiki.com/wiki/The_Resistance_Remembers")] },
  { slug: "manderville-weapons", parentSlug: "combat-relics", type: "collection", category: "Combat Relic", title: "Level 90: Manderville Weapons", summary: "A complete Endwalker relic workspace with Hildibrand prerequisites, every exchange, stat choices, and replicas.", expansion: "Endwalker", level: "90", audience: "Combat", tags: ["manderville", "hildibrand", "tomestones"], imageUrl: "/guides/relics.svg", order: 50 },
  { slug: "manderville-complete-route", parentSlug: "manderville-weapons", type: "article", category: "Manderville Walkthrough", title: "Complete Quest & Tomestone Route", summary: "Every Manderville stage, prerequisite quest, material exchange, and hand-in rule.", expansion: "Endwalker", level: "90", audience: "Combat", tags: ["manderville", "route", "tomestones"], imageUrl: "/guides/relics.svg", order: 10,
    content: `## Prerequisites
- [ ] Finish the Endwalker main scenario.
- [ ] Complete the entire Hildibrand chain from **The Rise and Fall of Gentlemen** through **The Imperfect Gentleman**.
- [ ] Reach level 90 on the job receiving the weapon and keep another weapon available for turn-ins.

## Stage 1 — Manderville, item level 615
- [ ] Accept **Make It a Manderville** from the **House Manderville Manservant**, Radz-at-Han (X:11.8, Y:11.2).
- [ ] Buy 3 **Manderium Meteorites** from **Jubrunnah (12.2,10.9)** for 500 Poetics each.
- [ ] Deliver them to the House Manderville Artisan (12.0,7.2).

## Stage 2 — Amazing, item level 630
- [ ] Continue the Somehow Further Hildibrand story through the stage's prerequisite quest.
- [ ] Accept **Well-oiled** from Gerolt/the Artisan.
- [ ] Buy 3 **Complementary Chondrites** from Jubrunnah for 500 Poetics each and deliver them.

## Stage 3 — Majestic, item level 645
- [ ] Continue the Hildibrand story through the next prerequisite.
- [ ] Accept **A Spirited Reforging**.
- [ ] Buy 3 **Amplifying Achondrites** from Jubrunnah for 500 Poetics each and deliver them.
- [ ] Choose the weapon's displayed secondary-stat distribution when prompted; this does not change its appearance.

## Stage 4 — Mandervillous, item level 665
- [ ] Finish the Endwalker Hildibrand finale.
- [ ] Accept **Resonating with Perfection**.
- [ ] Buy 3 **Cosmic Crystallites** from Jubrunnah for 500 Poetics each and deliver them.

## Additional jobs
- [ ] Start **Make Another Manderville** from the House Manderville Artisan (12.0,7.2).
- [ ] Pay 1,500 Poetics for each stage, or 6,000 Poetics for a complete weapon from base through Mandervillous.
- [ ] Repeat the four material hand-ins; Hildibrand story quests remain complete account-wide for the character.

## Troubleshooting
- **Quest absent:** the matching Hildibrand chapter is incomplete; inspect completed quests under Sidequests → Hildibrand.
- **Vendor item missing:** accept the weapon-stage quest first.
- **Cannot turn in:** switch to the correct job, unequip the relic with a spare weapon, and keep it in inventory/Armoury Chest.
- **Old guide names another currency:** legacy capped currencies were consolidated; Jubrunnah's live price is authoritative.`, references: [official("Manderville quest and material stages", "https://ffxiv.consolegameswiki.com/wiki/Manderville_Weapons/Quest")] },
  { slug: "phantom-weapons", parentSlug: "combat-relics", type: "collection", category: "Combat Relic", title: "Level 100: Phantom Weapons", summary: "A current-patch Dawntrail workspace covering each quest, duty drop, Horn currency, and job-specific repeat.", expansion: "Dawntrail", level: "100", audience: "Combat", tags: ["phantom", "occult crescent", "Dawntrail"], imageUrl: "/guides/field-operations.svg", order: 60 },
  { slug: "phantom-complete-route", parentSlug: "phantom-weapons", type: "article", category: "Phantom Walkthrough", title: "Current Complete Route", summary: "Every released Phantom weapon stage and its exact qualifying sources.", expansion: "Dawntrail", level: "100", audience: "Combat", tags: ["phantom", "route", "occult crescent"], imageUrl: "/guides/field-operations.svg", order: 10,
    content: `## Prerequisites and village
- [ ] Finish Dawntrail and the Occult Crescent story through **Unfamiliar Territory**.
- [ ] Reach level 100 on the intended job.
- [ ] In Phantom Village, complete the one-time **Arcane Artistry** and **Forging the Phantasmal** chain from **Lydirceil (X:6.6, Y:7.1)**.

## Penumbrae — six demiatma types
- [ ] Accept the weapon quest and collect 3 each of all six demiatma varieties.
- [ ] Demiatma are personal random drops from FATEs and Critical Encounters in South Horn. The relic does not need to be equipped unless the quest text says otherwise.
- [ ] Turn all eighteen in through Lydirceil/Gerolt and receive the job's Phantom Weapon Penumbrae.
- [ ] Later base weapons are purchased from **Dodokkuli (6.7,7.1)** after the one-time unlock.

## Obscurum — 1,200 Crystal Paste
Accept **In Pursuit of Perfection** from Lydirceil.
- [ ] Turn in 100 Crystal Paste.
- [ ] Turn in 200 more.
- [ ] Turn in 300 more.
- [ ] Turn in 600 more.

Paste can be stockpiled without overcapping and does not require the relic/job equipped. Repeatable sources include: Leveling Roulette 20; Expert or Level Cap roulette 15; South Horn Critical Encounters 5; Dawntrail FATEs 3; AAC Heavyweight normal 8 each; Savage 10/11/11/18; Hell on Rails Extreme 9; Merchant's Tale 14–17; and Pilgrim's Traverse floors scaling from 10 to 26.

## Umbrae — Waning Arcanite
- [ ] Complete the next Phantom/Occult story prerequisite.
- [ ] Buy 3 **Waning Arcanite** from **Ermina**, Phantom Village (X:6.9, Y:7.3), for 500 Allagan Tomestones of Mathematics each.
- [ ] Give the three arcanite and matching Phantom Weapon Umbrae/Penumbrae stage to Dodokkuli as directed.

## North Horn dispeller stage
Accept **Phantoms to Fillet** from Lydirceil.
- [ ] Collect 100 Phantom Dispellers α from North Horn FATEs/CEs or High-level Dungeon roulette.
- [ ] Collect 100 Phantom Dispellers β from North Horn FATEs/CEs or Trial roulette.
- [ ] Collect 100 Phantom Dispellers γ from North Horn FATEs/CEs or Normal Raid roulette.
- [ ] Deliver all three sets to Gerolt and complete the testing dialogue.

Forked Tower: Blood and Forked Tower: Magic do not award these dispellers. The quest cannot be abandoned from the journal; speak with Lydirceil if cancellation is necessary.

## Efficiency
- [ ] Accept the active weapon quest before farming any currency that is quest-gated.
- [ ] Combine roulette rewards with ordinary leveling/tomestone goals.
- [ ] For South/North Horn, equip useful phantom jobs and join a party so encounter credit is reliable.
- [ ] Keep regular inventory space for paste, demiatma, and dispellers.

## Troubleshooting
- **No demiatma/dispeller:** verify the correct Horn and exclude Forked Tower encounters.
- **Paste missing after duty:** ensure In Pursuit of Perfection is active; it need not be the relic job.
- **Arcanite absent from vendor:** complete the stage prerequisite and carry the matching weapon.
- **Quest cannot be abandoned:** use Lydirceil's dialogue option.`, references: [official("Current Phantom weapon stages", "https://ffxiv.consolegameswiki.com/wiki?curid=273362"), official("Phantom Obscurum paste sources", "https://ffxiv.consolegameswiki.com/wiki/Phantom_Weapons_Obscurum/Quest"), official("Official patch 7.5 notes", "https://na.finalfantasyxiv.com/lodestone/topics/detail/07320affa7e0fcd9685afcbe54fbf55405b6d822")] },
  { slug: "relic-tools", parentSlug: "relics", type: "collection", category: "Profession Relics", title: "Crafter & Gatherer Relics", summary: "Tool projects, relic-style profession armor, augmented scrip sets, and the practical gearing path for every expansion.", expansion: "Multiple", level: "50–100", audience: "Crafting & Gathering", tags: ["tool", "armor", "skysteel", "splendorous", "cosmic"], imageUrl: "/guides/crafting.svg", order: 20 },
  { slug: "relic-tools-overview", parentSlug: "relic-tools", type: "article", category: "Profession Relics", title: "Relic Tool Projects", summary: "Complete Skysteel, Splendorous, and Cosmic tool routes, including materials, collectability, and upgrade checks.", expansion: "Multiple", level: "80–100", audience: "Crafting & Gathering", tags: ["tool", "skysteel", "splendorous", "cosmic"], imageUrl: "/guides/crafting.svg", order: 10,
    content: `## Choose the line
- **Skysteel/Skybuilders' Tools:** level 80, Foundation and the Diadem; five upgrades after the prototype.
- **Splendorous Tools:** level 90, Crystarium; six stages built from scrip materials and collectables.
- **Cosmic Tools:** level 10–100 scaling missions across Cosmic Exploration; progress is class-specific.

## Skysteel unlock
- [ ] Complete Shadowbringers, unlock the Firmament, and complete **Mislaid Plans** in Foundation's Skysteel Manufactory.
- [ ] Open the rewarded Skysteel Prototype Coffer while on the intended class.
- [ ] Buy later prototypes from **Denys**, Foundation (X:8.0, Y:10.0), for 80,000 gil each.

### Crafter Skysteel route
- [ ] Equip the prototype and craft 20 first-tier HQ items; exchange with Denys for +1.
- [ ] Equip +1 and craft the second prescribed batch for Dragonsung.
- [ ] Continue the new collectable recipes for Augmented Dragonsung and Skysung, meeting Denys's rating; required special materials come from scrip exchange/Enie.
- [ ] Complete **The Tools of Tomorrow** through **Nimie** and the one-time **Oddness in the End** story.
- [ ] For the final Skybuilders' stage, complete the tool-specific expert recipes, exchange enough collectability for the required delicate parts, and turn them in through Emeny/Spanner.

### Miner and botanist Skysteel route
- [ ] Equip the current relic whenever gathering its oddly specific items.
- [ ] Complete each normal gathering batch and hidden-item batch shown by Denys.
- [ ] Skysung requires 600 fourth-tier items plus 200 hidden items, exchanged for 60 highly viscous gobbiegoo.
- [ ] Final Skybuilders' stage requires collectables worth 250 oddly delicate parts plus 750 Diadem items worth 25 inconceivably delicate parts.

### Fisher Skysteel route
- [ ] Equip the relic rod, buy the stage's special bait, and fish only at the named holes.
- [ ] Use Patience and the hookset matching the target tug; exchanges count fish/collectability rather than ordinary inventory value.
- [ ] Recheck the current quest after every upgrade because bait, hole, and fish change.

## Splendorous unlock
- [ ] Finish Endwalker, **The Crystalline Mean**, and unlock Mowen's Boutique of Splendors in Eulmore through **Mowen (11.4,10.7)**.
- [ ] Accept **An Original Improvement** from **Chora-Zoi**, Crystarium (X:7.8, Y:11.4), on a level 90 crafter/gatherer.
- [ ] Receive the first tool; repeat tools are obtained through Chora-Zoi's class-specific repeatable quest.

### Crafter Splendorous loop
- [ ] Equip the current Splendorous tool.
- [ ] Buy the stage's **Select** material with Purple Crafters' Scrips.
- [ ] Craft the exact collectable in Special Recipes and exchange it for tool components. Higher collectability awards more components.
- [ ] Repeat for Augmented Splendorous, Crystalline, Chora-Zoi's Crystalline, Brilliant, and Vrandtic Visionary stages.
- [ ] The final two stages are expert recipes and prohibit Trained Eye; use the special conditions and test one craft before batching.

### Gatherer Splendorous loop
- [ ] Equip the relic and gather/fish the stage's named collectable.
- [ ] Use collectability actions and exchange high-tier results for more components per item.
- [ ] For fisher, buy the exact Select Bait and use the stated fishing hole; identical tug strength does not guarantee the target.

## Cosmic tools
Use the Cosmic Exploration walkthrough in this library. Tool data is earned per class through stellar missions; Researchingway/exotablet displays the next threshold. Finish one class first, then repeat. Final tools unlock tool-mastery missions on Auxesia.

## Safe-upgrade rules
- [ ] Never discard the current relic; upgrades require it equipped or in inventory.
- [ ] Keep a normal tool for turn-in moments that require unequipping.
- [ ] Verify replica/previous-stage purchase options before removing an appearance.
- [ ] Buy only the current stage's scrip material; similarly named Select/Oddly items are not interchangeable.

## Troubleshooting
- **Recipe absent:** accept the stage quest on that class and look under Special Recipes.
- **Craft/gather does not count:** equip the current relic before starting the synthesis or gathering attempt.
- **Exchange gives too few parts:** raise collectability into the next displayed reward tier.
- **Second tool unavailable:** complete the one-time story step, buy/accept the new base tool on the desired class, then take its repeatable quest.`, references: [official("Skysteel stage requirements", "https://ffxiv.consolegameswiki.com/wiki/Skysteel_Tools"), official("Splendorous stage requirements", "https://ffxiv.consolegameswiki.com/wiki/Splendorous_Tools"), official("Official Cosmic Exploration guide", "https://na.finalfantasyxiv.com/lodestone/cosmic_exploration/")] },
  { slug: "profession-relic-gear", parentSlug: "relic-tools", type: "article", category: "Profession Relics", title: "Relic Armor, Scrip Gear & Augmentation", summary: "What profession relic armor actually exists, what is only artifact or scrip gear, and how to obtain and augment each useful set.", expansion: "Multiple", level: "50–100", audience: "Crafting & Gathering", tags: ["armor", "artifact gear", "scrip gear", "augmentation"], imageUrl: "/guides/crafting.svg", order: 20,
    content: `## First: tools and armor use different systems
Crafter and gatherer **tools** have named relic questlines: Skysteel/Skybuilders, Splendorous, and Cosmic. Armor does not have one uninterrupted relic quest comparable to a combat weapon. What players often call “crafter/gatherer relic armor” is one of three things:

- **Class artifact gear:** job-specific sets earned from class quests or bought with scrips.
- **Scrip gear:** expansion-capped sets bought ready-made, sometimes with a separate augmentation exchange.
- **Restoration or field reward appearances:** glamour sets tied to Ishgardian Restoration, achievements, or vendors; these are not upgraded as a relic chain.

This distinction matters: do not spend time searching for a quest that upgrades an old body piece through every expansion. Each level cap replaces the gearing ladder.

## Level 50 — class artifact and Artisan/Forager era
- [ ] Finish each crafter or gatherer class quest through level 50 for its original class-specific artifact appearance.
- [ ] Use Grand Company, vendor, crafted, or early scrip catch-up equipment to bridge into Heavensward.
- [ ] Treat Artisan and Forager pieces primarily as historical glamour unless deliberately doing old-content progression at level.

## Levels 60, 70, 80, 90, and 100 — the repeatable pattern
At each cap:
- [ ] Finish the profession's class/role quest needed to open its current vendors and actions.
- [ ] Unlock the expansion's collectable and scrip exchange.
- [ ] Buy the current **universal scrip set** when it is the economical catch-up option, or craft/purchase the current crafted set when melding is needed.
- [ ] If the set is augmentable, buy only the exact augmentation material named by that vendor and exchange the original piece plus material at the matching augmentation NPC.
- [ ] Replace main hand and off hand first when progress, control, gathering, or perception prevents reliable crafts/gathers; replace chest and legs next for the largest armor-stat gains.

Artifact sets are class-specific and consume much more Armoury Chest space. Universal crafted and scrip sets work across all crafters or all gatherers and are normally the practical choice while leveling several professions.

## When crafted gear is better than scrip gear
- Choose **scrip gear** for immediate, inexpensive catch-up with no materia planning.
- Choose **crafted gear** when current expert crafts, high collectability breakpoints, or endgame nodes require melded CP/GP, craftsmanship/control, or gathering/perception.
- Do not pentameld a transition set just before the next major crafted tier unless the content you are doing actually needs it.

## Restoration and glamour sets
Ishgardian Restoration, Kupo of Fortune, Fêtes, achievements, and allied-society vendors award profession-themed clothing. These can look like work uniforms or artifact armor but generally do not form a stat-upgrade chain. Check the item level and “All Classes”/job restrictions before treating a reward as working gear.

## Safe purchase checklist
- [ ] Compare the proposed piece to equipped gear with the item-detail comparison window.
- [ ] Confirm whether it is **Disciple of the Hand**, **Disciple of the Land**, or one specific class.
- [ ] Check whether augmentation exists before spending materia or glamouring the base piece.
- [ ] Preserve a normal tool while advancing a relic tool; several exchanges require the relic to be unequipped.
- [ ] Use the glamour dresser or armoire when supported instead of carrying every obsolete artifact set.

## Common naming traps
- “Artifact” describes job identity gear; it does not guarantee an upgrade quest.
- “Augmented” usually means a one-time vendor exchange, not a multi-stage relic.
- “Skybuilder,” “Splendorous,” and “Cosmic” identify tool projects; similarly themed armor rewards are separate.
- Old guides may use retired scrip colors. Read the current Scrip Exchange categories before purchasing tokens.`, references: [official("Official crafting and gathering gear database", "https://na.finalfantasyxiv.com/lodestone/playguide/db/item/?category2=3"), official("Official collectables and scrip guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/collectables/")] },
  { slug: "profession-relic-preparation", parentSlug: "relic-tools", type: "article", category: "Profession Relics", title: "Materials, Gear Checks & Batch Planning", summary: "Prepare every class, test collectability tiers, and avoid wasting scrips or quest-only materials.", expansion: "Multiple", level: "80–100", audience: "Crafting & Gathering", tags: ["preparation", "materials", "collectability"], imageUrl: "/guides/crafting.svg", order: 30,
    content: `## Before accepting a tool project
- [ ] Pick one class and finish its full tool first; progress and quest-only materials are class-specific.
- [ ] Keep the current relic in the Armoury Chest and a second usable tool in inventory.
- [ ] Unlock collectables, current scrip exchanges, and the associated zone/project.
- [ ] Repair, extract spiritbonded materia, clear inventory, and stock crystals and cordials.

## Crafter batch method
- [ ] Buy only enough stage material for **one** test craft.
- [ ] Equip the required relic and open the quest recipe under Special Recipes.
- [ ] Use Trial Synthesis when available and record the displayed collectability breakpoints.
- [ ] Complete one real item, verify the exchange value, then calculate the remaining batch from the actual tier achieved.
- [ ] Favor a reliable middle tier over a macro that occasionally fails the top tier and destroys expensive materials.

## Gatherer batch method
- [ ] Confirm the relic is equipped before opening the node or casting.
- [ ] Use the Collectable Log or quest journal for the exact zone, node, bait, and minimum rating.
- [ ] Spend GP on the appraisal sequence that reliably reaches the best exchange tier your stats support.
- [ ] Use Hi-Cordials between nodes and stop after the required component total—not after an arbitrary item count.

## Multi-class planning
Quest stories are usually one-time account/character unlocks, while each additional tool has its own repeatable stage quest. Keep a small worksheet or checklist by class. Never buy a full batch of similarly named “Select,” “Oddly,” or “Connoisseur” materials until that class's active quest displays the same item name.`, references: [official("Skysteel tools", "https://ffxiv.consolegameswiki.com/wiki/Skysteel_Tools"), official("Splendorous tools", "https://ffxiv.consolegameswiki.com/wiki/Splendorous_Tools"), official("Official Cosmic Exploration", "https://na.finalfantasyxiv.com/lodestone/cosmic_exploration/")] },

  { slug: "tribal-quests", parentSlug: null, type: "collection", category: "Daily Progression", title: "Allied Society (Tribal) Quests", summary: "Daily reputation guides from level 50 through 100, separated by combat, crafting, and gathering.", tags: ["tribal", "allied society", "daily", "reputation"], imageUrl: "/guides/tribal-quests.svg", order: 20 },
  { slug: "tribal-combat", parentSlug: "tribal-quests", type: "collection", category: "Allied Societies", title: "Combat Societies by Level", summary: "Choose an individual combat society for unlocks, rank quests, daily objectives, vendors, mounts, and minions.", expansion: "Multiple", level: "50–100", audience: "Combat", tags: ["combat", "daily"], imageUrl: "/guides/tribal-quests.svg", order: 10 },
  { slug: "tribal-combat-overview", parentSlug: "tribal-combat", type: "article", category: "Allied Societies", title: "Combat Society Overview & Allowances", summary: "Level brackets, daily allowance rules, job sync, rank gates, and expansion crossover quests.", expansion: "Multiple", level: "50–100", audience: "Combat", tags: ["combat", "daily", "overview"], imageUrl: "/guides/tribal-quests.svg", order: 5,
    content: `## Allowance and quest rules
- Twelve allowances are issued daily at 7:00 a.m. Pacific; accepted quests keep their allowance until completed or abandoned.
- Most societies offer three synced quests per day. Accept and turn in on the combat job receiving experience.
- Finish the blue rank-up story quest whenever reputation caps; daily reputation cannot advance until it is completed.
- ARR societies stop at Trusted until their shared intersocietal chain; later societies progress to Bloodsworn.

## ARR combat societies
All require the level-41 MSQ **In Pursuit of the Past**.
- [ ] **Amalj'aa:** accept **Peace for Thanalan** from Swift, Ul'dah Steps of Nald (8.4,8.9). Dailies are at Ring of Ash, Southern Thanalan (23,14).
- [ ] **Sylph:** accept **Seeking Solace** from Vorsaile Heuloix, New Gridania (9.7,11.1). Dailies are at Little Solace, East Shroud (22,26).
- [ ] **Kobold:** accept **Highway Robbery** from Trachraet, Limsa Upper Decks (12.7,12.8). Dailies are at 789th Order Dig, Outer La Noscea (21,18).
- [ ] **Sahagin:** accept **They Came from the Deep** from R'ashaht Rhiki, Limsa Upper Decks (13.1,12.8). Dailies are at Novv's Nursery, Western La Noscea (17,21).

## Heavensward, levels 50–60
- [ ] **Vanu Vanu:** after The Black Storm, accept **Three Beaks to the Wind** from Sonu Vanu at Ok' Zundu, Sea of Clouds (11.7,14.8).
- [ ] **Vath:** after Lord of the Hive, accept **The Naming of Vath** from the Vath Storyteller, Dravanian Forelands (24.0,19.7).

## Stormblood, levels 60–70
- [ ] **Kojin:** after Tide Goes In, Imperials Go Out, accept **Heaven-sent** from the Vexed Villager, Ruby Sea (6.8,13.3).
- [ ] **Ananta:** complete The Hidden Truth/Black Rose side chain, then accept **Brooding Broodmother** from M'rahz Nunh, Fringes (30.2,25.7).

## Shadowbringers, levels 70–80
- [ ] **Pixies:** after The Wheel Turns, accept **Manic Pixie Dream Realm** from the Pink Pixie, Crystarium (13.1,15.2). Dailies move into Lyhe Mheg.

## Endwalker, levels 80–90
- [ ] **Arkasodara:** complete the Steppe Child and What's in a Parent side chains, then accept **Hippos Born to Run** from Kancana, Thavnair (25.3,31.2).

## Dawntrail, levels 90–100
- [ ] **Pelupelu:** after the required Dawntrail MSQ, accept **An Intrepid New Enterprise** from the Blue-garbed Pelu, Tuliyollal (14.0,13.0).

## Daily routine
- [ ] Open Reputation and choose the society/job that is still inside its level bracket.
- [ ] Accept three quests on that job and verify the map zone before teleporting.
- [ ] Use the supplied mount, key item, emote, or duty action; ordinary attacks often do not advance special objectives.
- [ ] Turn in on the same eligible job, spend society currency before its cap, then complete any new rank quest.

## Intersocietal quests
Max every society in the same expansion and complete all their main quests to unlock that expansion's crossover chain where available. ARR also requires Ixal; Stormblood requires Namazu; Endwalker requires Loporrit and Omicron; Dawntrail requires Mamool Ja and Yok Huy.

## Troubleshooting
- **No blue unlock:** finish the named MSQ and any prerequisite side chain.
- **Quest gives little/no experience:** the job is above the society's synced range; move to the next expansion.
- **Objective cannot be used:** switch back to the job that accepted it and check Key Items/Duty Actions.
- **No daily quests:** three were already accepted/completed today, reputation is waiting on a rank quest, or all twelve allowances are committed.`, references: [official("All society unlocks and locations", "https://ffxiv.consolegameswiki.com/wiki/Allied_Society_Quests")] },
  { slug: "tribal-crafting", parentSlug: "tribal-quests", type: "collection", category: "Allied Societies", title: "Crafting Societies by Level", summary: "Choose an individual crafting society for exact unlocks, recipes, rank quests, vendor rewards, mounts, and minions.", expansion: "Multiple", level: "1–100", audience: "Crafting", tags: ["ixal", "moogle", "namazu", "dwarf", "loporrit"], imageUrl: "/guides/crafting.svg", order: 20 },
  { slug: "tribal-crafting-overview", parentSlug: "tribal-crafting", type: "article", category: "Allied Societies", title: "Crafting Society Overview & Daily Recipe Rules", summary: "The full level route, special-recipe handling, quality rules, and leveling preparation.", expansion: "Multiple", level: "1–100", audience: "Crafting", tags: ["crafting", "daily", "overview"], imageUrl: "/guides/crafting.svg", order: 5,
    content: `## Unlock route by level
- [ ] **Ixal (1–50):** accept **A Bad Bladder** from Scarlet, New Gridania (9.9,11.4); camp at Ehcatl, North Shroud (24,22). Some quests require Ehcatl Smithing Gloves and may add combat/gathering steps.
- [ ] **Moogle (50–60):** complete the long Churning Mists Moogle sidequest chain beginning with A Pebble for Your Thoughts and ending with Tricks and Stones; dailies are at Bahrr Lehs.
- [ ] **Namazu (60–70, crafting/gathering):** complete the Kurobana and Gyorin side chains, then accept **Something Fishy This Way Comes** from the Floundering Namazu, Azim Steppe (17.4,37.5).
- [ ] **Dwarves (70–80):** complete the Ronitt side chain in Kholusia, then accept **It's Dwarfin' Time** from the Affable Townsdwarf (15.7,30.3).
- [ ] **Loporrits (80–90):** finish Dreamingway's Mare Lamentorum side chain and accept **Must Be Dreaming(way)** on a level-80 crafter.
- [ ] **Yok Huy (90–100):** accept **Frosty Neighbors** from Fahrafahr, Urqopacha (32.1,34.3); dailies are at Worlar's Echo (30.5,34.2).

## Complete a daily craft
- [ ] Accept on the crafter receiving experience.
- [ ] Open Crafting Log → Special Recipes → Allied Society Quests and select the active quest.
- [ ] Use the provided key material; supply any crystals/common material named by the recipe.
- [ ] Meet the requested quality/collectability. If an Ixal status or gloves are required, keep them active/equipped through synthesis.
- [ ] Turn in on the eligible crafting class before changing jobs.

## Leveling preparation
- Keep main hand, off hand, and chest near the job's level; these dominate progress/control.
- Carry crystals and repair before accepting multiple quests.
- Use Trial Synthesis when a recipe is close to the job's capability.
- Rank-up quests do not consume an additional daily allowance; complete them immediately.

## Troubleshooting
- **Recipe missing:** accept the quest on a crafter and check Special Recipes, not the normal recipe-level list.
- **Synthesis button disabled:** equip the required Ixal gloves/status or switch to the accepting class.
- **Key ingredient missing:** reread the quest and speak with its supplier; abandoning removes quest-only materials.
- **Moogle/Namazu/Dwarf unlock absent:** finish the entire prerequisite sidequest chain, not only its first quest.`, references: [official("All crafting-society unlocks", "https://ffxiv.consolegameswiki.com/wiki/Allied_Society_Quests")] },
  { slug: "tribal-gathering", parentSlug: "tribal-quests", type: "collection", category: "Allied Societies", title: "Gathering Societies by Level", summary: "Choose an individual gathering society for exact unlocks, quest nodes, rank stories, mounts, minions, and vendor stock.", expansion: "Multiple", level: "60–100", audience: "Gathering", tags: ["namazu", "qitari", "omicron", "gathering"], imageUrl: "/guides/crafting.svg", order: 30 },
  { slug: "tribal-gathering-overview", parentSlug: "tribal-gathering", type: "article", category: "Allied Societies", title: "Gathering Society Overview & Quest-Node Rules", summary: "The complete level route for miner, botanist, and fisher plus collectability and quest-item troubleshooting.", expansion: "Multiple", level: "60–100", audience: "Gathering", tags: ["gathering", "daily", "overview"], imageUrl: "/guides/crafting.svg", order: 5,
    content: `## Unlock route
- [ ] **Namazu (60–70):** complete Kurobana's Yanxia chain and Gyorin's Azim Steppe chain, then **Something Fishy This Way Comes** from Floundering Namazu (17.4,37.5).
- [ ] **Qitari (70–80):** complete the Rak'tika Great Serpent/Ronkan side chain and accept **The Stewards of Note** / **A Steward for Every Occasion** chain from the concerned Qitari near Fanow.
- [ ] **Omicron (80–90):** finish Endwalker and Stigma Dreamscape's quest chain, then accept **The Café at the End of the Universe** from Jammingway, Ultima Thule (25.4,26.3).
- [ ] **Mamool Ja (90–100):** accept **Cultivating Hope** from Gotoll Ja, Yak T'el (35.6,32.0).

## Miner/botanist daily
- [ ] Accept on the gatherer receiving experience and activate the quest's supplied action/status.
- [ ] Travel to the highlighted search area; quest nodes exist only while the daily is active.
- [ ] Gather the exact key item. If collectability is displayed, use appraisal actions and reach its minimum before collecting.
- [ ] Turn in on the accepting gatherer.

## Fisher daily
- [ ] Read the required fishing hole and use the quest-provided bait from inventory or the Bait window.
- [ ] Match tug strength with Precision/Powerful Hookset when Patience is used.
- [ ] Keep every requested fish until the counter completes; ordinary versions caught outside the quest usually do not count.

## Branching Qitari story
Qitari rank quests ask the player to choose interpretations of Ronkan history. The choice changes settlement presentation/dialogue but does not block reputation rewards. Choose the preferred story rather than searching for a mechanically correct answer.

## Troubleshooting
- **Nodes absent:** switch to the class that accepted the quest and confirm the search area/quest status.
- **Fish absent:** verify special bait, hole, and time/weather instruction in the journal.
- **Collectable rejected:** it is below the marked threshold or was gathered without the quest status.
- **Unlock quest missing:** complete both the expansion MSQ requirement and the full named sidequest chain.`, references: [official("All gathering-society unlocks", "https://ffxiv.consolegameswiki.com/wiki/Allied_Society_Quests")] },

  { slug: "crafting-gathering", parentSlug: null, type: "collection", category: "Professions", title: "Crafting & Gathering Progression", summary: "Restoration projects, collectables, custom deliveries, and cooperative profession content.", tags: ["crafting", "gathering", "collectables"], imageUrl: "/guides/crafting.svg", order: 30 },
  { slug: "ishgard-restoration", parentSlug: "crafting-gathering", type: "collection", category: "Large-scale Projects", title: "Ishgardian Restoration", summary: "The Firmament crafting loop and Diadem gathering loop as permanent leveling and reward content.", expansion: "Shadowbringers", level: "20–80", audience: "Crafting & Gathering", tags: ["firmament", "diadem", "skybuilders"], imageUrl: "/guides/crafting.svg", order: 10 },
  { slug: "firmament-crafting", parentSlug: "ishgard-restoration", type: "article", category: "Ishgardian Restoration", title: "Firmament Crafting", summary: "A complete unlock, recipe-tier, collectability, expert-craft, Kupo, and Fête walkthrough.", expansion: "Shadowbringers", level: "20–80", audience: "Crafting", tags: ["firmament", "restoration", "expert recipes"], imageUrl: "/guides/ishgard-restoration-route.svg", order: 10,
    content: `## Unlock checklist
- [ ] Finish the Heavensward main-scenario quest **Litany of Peace**.
- [ ] In Foundation, inspect the **Recruitment Notice** at (X:9.7, Y:11.5) and accept **Towards the Firmament**.
- [ ] Speak with **Thomelin** in the Brume at Foundation (X:14.2, Y:12.5), then follow Francel into the Firmament and complete the quest.
- [ ] Switch to a level 20 or higher crafter and speak with **Potkin**, the Restoration appraiser, in the Firmament (X:12.2, Y:14.6). This adds the restoration recipes to Crafting Log → Special Recipes → Ishgard Restoration.

> The historical competitive reconstruction phases are over. The permanent recipes, experience, Skybuilders' Scrips, score achievements, Kupo of Fortune, Diadem, and Fêtes still work.

## Important Firmament locations
- **Potkin (12.2,14.6):** submits crafted collectables, displays minimum collectability, awards experience/scrips/score, and stamps Kupo vouchers.
- **Enie (12.0,14.0):** spends Skybuilders' Scrips on gear, dyes, emotes, minions, mounts, furnishings, and materials.
- **Lizbeth (12.2,14.6):** exchanges a completed five-stamp voucher for a Kupo card and lets you scratch one prize panel.
- **Aurvael and Flotpassant (10.8,14.0):** Diadem entry and material appraisal.
- **Skybuilders' Board (11.4,14.1):** shows past restoration progress and local information.

## Choose the correct recipe tier
Open the restoration section for the crafter you are leveling. The recipe's level and the item name must match the materials exactly.
- **Level 20 recipe:** intended for early leveling; use Grade 4 level-20 approved materials.
- **Level 40 recipe:** the next leveling tier.
- **Level 60 recipe:** use after reaching 60 and replacing weak gear.
- **Level 70 recipe:** the final ordinary leveling tier before the level-80 recipes.
- **Level 80 recipe:** repeatable scrip and Skyward Score craft.
- **Level 80 expert recipe:** achievement/score challenge with expert-only conditions; it is not the recommended leveling craft.

> Names such as **Grade 4 Skybuilders' Iron Ore** and **Approved Grade 4 Skybuilders' Iron Ore** are different states of the same Diadem material. Flotpassant must inspect gathered materials before a crafter can use them.

## One complete crafting cycle
- [ ] At Potkin, inspect the target recipe and note its minimum and higher collectability breakpoints.
- [ ] Obtain the ordinary vendor/world material and every **Approved Grade 4 Skybuilders'** ingredient listed by the recipe.
- [ ] Open Crafting Log → Special Recipes → Ishgard Restoration and confirm **Collectable Synthesis** is shown on the recipe.
- [ ] Craft one test item. Quality becomes collectability; durability reaching zero before progress is complete fails the craft.
- [ ] Confirm the result meets Potkin's lowest threshold before mass-crafting.
- [ ] Turn the finished collectable in to Potkin while on the crafter that should receive the experience.
- [ ] Recheck gear after each ten-level band; do not continue an old recipe after its experience has become inefficient.

## Reliable ordinary-craft priorities
1. Keep **Inner Quiet** active through quality actions.
2. Use durability recovery or preservation before durability becomes critical.
3. Finish progress only after reaching the desired collectability tier.
4. If a test craft misses the lowest tier, upgrade the main hand/off hand and chest/legs first, repair, eat crafting food, or move down one recipe tier.

The exact action sequence changes with level and gear, so the guide uses goals rather than a macro that may fail on another character. The Calculations window in the crafting log shows whether the next action can finish progress.

## Expert recipes — what changes
Expert recipes add special conditions and are meant to be solved manually. Start only with level-appropriate gear, food, medicine, and fully repaired equipment.
- **Centered:** increased action success rate; good for riskier actions.
- **Sturdy:** reduces durability loss.
- **Pliant:** halves CP cost; prioritize expensive buffs or recovery.
- **Malleable:** increases progress gains.
- **Primed:** extends the duration of the next status applied.
- **Good/Excellent:** increases quality; avoid wasting these on progress.

- [ ] Build enough progress that a known finishing action can complete the craft.
- [ ] Preserve durability and CP while raising quality during favorable conditions.
- [ ] Do not press a finishing action until both collectability and completion are secure.

## Kupo of Fortune
- [ ] Look for the stamp icon beside eligible Potkin submissions.
- [ ] Submit five eligible crafts to fill one voucher. A character can hold up to ten completed Kupo cards.
- [ ] Speak with **Lizbeth (12.2,14.6)** and exchange the voucher.
- [ ] Review the current prize list before scratching. The single panel on the left offers a narrower middle-prize pool; the three panels on the right can include first through consolation prize.

## Fêtes — the five-event chain
When the Firmament announces a Fête, switch to any crafter or gatherer and go to the marked event area. No crafting rotation is required; use the duty actions and prompts.
- [ ] **A Twist of Fête:** copy the emotes demonstrated by the NPC.
- [ ] **Made of Softer Stuff:** collect and deliver stuffed toys with the event action.
- [ ] **Shear-a-Yak:** use the event action on the target and deliver the gathered bundles.
- [ ] **Toy Hunter:** locate and interact with the correct toy boxes.
- [ ] **Presents of Mind:** carry presents to the indicated recipients.

Gold credit is based on completing enough event objectives. Stay through the full chain; later events begin shortly after the previous one. Fête Presents can contain tradeable rewards and Fête Tokens are spent at the local prize vendor.

## Troubleshooting
- **Recipe missing:** speak to Potkin on a level 20+ crafter and check Special Recipes, not the normal level tab.
- **Material cannot be selected:** it is probably unapproved Diadem material; visit Flotpassant.
- **Turn-in is grey:** confirm the item is the current restoration recipe, is a collectable, and meets Potkin's first rating.
- **No experience gained:** the crafter may be at or above the recipe's useful range or the item may have been submitted on a different class.
- **Cannot enter the Firmament:** return to the Home World; this feature is not available while visiting another World.`, references: [official("Official Ishgardian Restoration guide", "https://eu.finalfantasyxiv.com/lodestone/ishgardian_restoration/"), official("Towards the Firmament quest details", "https://ffxiv.consolegameswiki.com/wiki/Towards_the_Firmament")] },
  { slug: "diadem-gathering", parentSlug: "ishgard-restoration", type: "article", category: "Ishgardian Restoration", title: "Diadem Gathering", summary: "A complete miner, botanist, fisher, auger, appraisal, and island-route walkthrough.", expansion: "Shadowbringers", level: "10–80", audience: "Gathering", tags: ["diadem", "skybuilders", "miner", "botanist", "fisher"], imageUrl: "/guides/ishgard-restoration-route.svg", order: 20,
    content: `## Unlock and enter
- [ ] Complete **Towards the Firmament** and enter the Firmament on your Home World.
- [ ] Speak with **Augebert**, then continue the nearby Firmament tutorial markers until they lead to **Aurvael (X:10.8, Y:14.0)**.
- [ ] Equip miner, botanist, or fisher at level 10 or higher and speak with Aurvael to unlock the current Diadem.
- [ ] Repair, empty several inventory rows, choose the gathering class, and enter through Aurvael. Flight is available immediately; there are no aether currents.

> The duty lasts up to three hours, but you can leave from Duty Information at any time. Items are kept when leaving normally.

## Before gathering: choose a target
Open the restoration recipe your crafter will make and write down its exact ingredients. Gathering random high-level materials is useful for experience and scrips but may not supply the recipe you chose.
- **Grade 4 level 20 materials:** appear on the lowest item row in each node variation.
- **Grade 4 level 60 materials:** the next row.
- **Grade 4 level 80 materials:** the third row.
- **Grade 4 Artisanal materials:** the fourth row; used by expert recipes and scoring pursuits.
- Older Grade 2/3 artisanal items can still appear but are not substitutes for Grade 4 recipes.

## Miner and botanist route rules
- Nodes have five integrity and appear along two continuous island circuits.
- **Miner nodes advance clockwise. Botanist nodes advance counter-clockwise.** Fully gathering a node causes the next node on that route to appear.
- Six nodes from a route remain available at once, so skipping too many can make the path look empty.
- Mount immediately after a node and follow the outer island ring; use Truth of Mountains/Forests and the minimap rather than waiting in one place.

### Starting route landmarks
- **West → northwest:** begin near (9.8,16.7); the bonus-integrity miner chain reaches roughly (16.9,11.4).
- **Northwest → north:** begin near (18.2,9.9); continue toward (26.0,7.1).
- **North → northeast:** begin near (27.2,8.5); continue toward (35.5,15.3).
- **Northeast → southeast:** begin near (35.1,16.3); continue toward (33.9,27.9).
- **Southeast → south:** begin near (32.7,28.7); continue toward (22.1,34.0).
- **South → west:** continue around the lower and western islands back toward the starting pavilion.

These coordinates are route anchors, not the only nodes. Botanist follows the same island circuit in reverse.

## Aetheromatic auger
- [ ] Gather normally to fill the duty-specific auger gauge.
- [ ] Select **Aetheromatic Auger** from Duty Actions, target a Diadem monster, and fire. Ordinary combat actions do not work here.
- [ ] Collect the monster's special crafting material. Different monster families drop different items, so compare the drop name with the target recipe.
- [ ] Repeat after the gauge refills; do not leave with a full gauge unless none of the monster drops are needed.

## Weather-only and rare nodes
Umbral weather temporarily reveals special nodes. When the weather changes, stop the ordinary circuit and use the gathering log/minimap to reach the matching node before it ends. These materials are mainly for achievements, score, and advanced recipes; they are not required for basic leveling.

## Fisher route
- [ ] Bring **Signature Skyballs** from the Diadem provisioner for ordinary skyfishing; keep Versatile Lures only as a fallback.
- [ ] Choose a cloudtop: Blustery, Windswept, Calm, or Swirling. Each has its own catch table.
- [ ] Use Patience/Precision or Powerful Hookset according to tug strength when targeting a particular fish.
- [ ] During special weather, move to the matching weather fishing location for rare fish.
- [ ] After leaving, fish that are crafting containers may need to be desynthesized; inspect their tooltip before selling or discarding them.

## Leave, appraise, and use the materials
- [ ] Exit through Duty Information when inventory is nearly full or the target quantity is reached.
- [ ] Speak with **Flotpassant (10.8,14.0)** beside Aurvael.
- [ ] Submit gathered stacks for inspection. Appraisal changes them into **Approved** materials and awards Skybuilders' Scrips and gathering experience.
- [ ] Keep approved materials for restoration recipes or sell the approved versions. Uninspected items cannot be used by the recipes.
- [ ] Spend scrips with **Enie (12.0,14.0)**.

## Efficiency and safety checklist
- [ ] Favor gathering-yield bonuses when the node offers the exact target item; favor integrity bonuses when every item is useful.
- [ ] Use Cordials and GP skills on bonus nodes instead of immediately on entry.
- [ ] Keep at least one free inventory row so auger drops are not lost.
- [ ] Appraise before placing materials on a retainer or the market board.
- [ ] Check the crafting recipe again after appraisal—the word **Approved** must appear in both places.

## Troubleshooting
- **Aurvael will not admit you:** use a level 10+ gatherer and make sure you are on your Home World.
- **No nodes appear:** turn on the class detection action, fly to a route anchor, and finish a nearby node so the circuit advances.
- **Auger is unavailable:** it is a Duty Action and needs charge from gathering; it is not placed in the normal Actions menu.
- **Craft says materials are missing:** raw items were not inspected, or their Grade/level differs from the recipe.
- **Fisher catches seem wrong:** verify the cloudtop name, bait, and current Diadem weather.`, references: [official("Official Diadem and appraisal guide", "https://eu.finalfantasyxiv.com/lodestone/ishgardian_restoration/"), official("Diadem routes and mechanics", "https://ffxiv.consolegameswiki.com/wiki/Diadem")] },
  { slug: "cosmic-exploration", parentSlug: "crafting-gathering", type: "collection", category: "Large-scale Projects", title: "Cosmic Exploration", summary: "Cooperative crafting and gathering across Sinus Ardorum, Phaenna, Oizys, and Auxesia.", expansion: "Dawntrail", level: "100", audience: "Crafting & Gathering", tags: ["cosmic", "sinus ardorum", "phaenna", "oizys", "auxesia"], imageUrl: "/guides/cosmic.svg", order: 20 },
  { slug: "cosmic-getting-started", parentSlug: "cosmic-exploration", type: "article", category: "Cosmic Exploration", title: "Getting Started & Mission Loop", summary: "Unlocks, stellar missions, projects, mech operations, cosmic tools, and a first-session route.", expansion: "Dawntrail", level: "100", audience: "Crafting & Gathering", tags: ["stellar missions", "cosmic tools", "mech ops"], imageUrl: "/guides/cosmic.svg", order: 10,
    content: `## Unlock the first expedition
- [ ] Complete Endwalker's main-scenario quest **Endwalker**.
- [ ] Equip any level 10+ Disciple of the Hand or Land and accept **A Cosmic Homecoming** from **Namingway**, Old Sharlayan (X:12.6, Y:13.6).
- [ ] Follow the quest to Bestways Burrow and Sinus Ardorum; complete every tutorial prompt until the **exotablet** and stellar missions are available.
- [ ] For later travel, use the Bestways Burrow aetheryte, **Drivingway** in Mare Lamentorum (X:21.9, Y:13.2), or **Cruisingway** on an expedition map.

## Sinus Ardorum service route
- **Cruisingway (20.6,19.5):** travel between unlocked destinations.
- **Alerot (22.4,20.3):** lunar credits, mech-op pilot applications, and local transport.
- **Mesouaidonque (21.8,21.8):** spends cosmocredits on shared rewards.
- **Orbitingway (21.8,21.1):** Cosmic Fortune roulettes.
- **Researchingway (21.1,21.8):** cosmic-tool progress and upgrades.
- **Starward Standings stela (21.2,21.1):** contribution information when rankings are active.

## What is stored where
- **Cosmopouch:** mission-only ingredients and finished items. They do not consume normal inventory space and disappear or reset as the mission specifies.
- **Cosmic Crafting Log:** the only valid crafting recipes for an active crafter mission.
- **Stellar Reduction:** the gatherer mission action that converts mission collectables; use it from the mission widget.
- **Exotablet:** accepts missions, tracks class rating, stellar successes, projects, tool progress, alerts, and rewards.

## Complete one stellar mission
- [ ] Repair and select the class whose rating/tool you want to advance; progress is recorded per class.
- [ ] Open the exotablet, choose a mission that is currently available, and read its time, weather, location, quantity, and scoring rules before accepting.
- [ ] Accept only one mission at a time. Use the **Mission in Progress** widget to open its pouch/log/reduction action.
- [ ] Craft or gather the requested mission item. For timed gathering, teleport or use the Cosmoliner before accepting if the target is far away.
- [ ] Continue beyond the bronze threshold when time/resources allow; silver and gold pay more and gold can unlock sequential missions.
- [ ] Submit or complete from the mission widget before the timer expires.
- [ ] Reopen the exotablet and claim/check class, tool, success, and project progress.

## Mission types
- **Basic:** always-available foundation missions; use these to learn a class and unlock higher ranks.
- **Sequential:** gold on a named prerequisite reveals a follow-up. Gold the follow-up to continue chains where another step exists.
- **Time-restricted:** appears only during the listed Eorzea-time window. Move into position first.
- **Weather-restricted:** appears only during the destination's special weather. The mission list marks the weather requirement.
- **Critical:** begins during a red alert. Two demanded-class gauges appear; repeat either demanded mission to fill them and earn contributor bonuses.
- **EX/EX+:** stricter techniques, routing, or stats. Read the mission-specific instructions instead of assuming an ordinary recipe rotation.

## Crafter scoring routine
1. Open the Cosmic Crafting Log from the active mission; ordinary recipes do not count.
2. Read whether score comes from quantity, collectability, condition use, or a special duty action.
3. Make one test craft and observe the score gain before committing resources/time.
4. Protect durability and CP, use favorable conditions for quality, and finish only after reaching the intended threshold.
5. If bronze is unreliable, improve gear/food or clear lower-rank missions first; abandoning repeated failures wastes more time than ranking up.

## Miner and botanist routine
1. Pin the mission target and use the highlighted search area.
2. Read whether the item needs ordinary gathering, a chain, a special condition, or Stellar Reduction.
3. Save GP for the score condition—yield, collectability, or integrity—not merely the first node.
4. Use the mission widget to reduce/submit before the timer ends.

## Fisher routine
1. Confirm fishing hole, bait or mission action, tug requirement, and whether a mooch chain is named.
2. Use the supplied mission bait/action; normal bait that catches similar fish will not necessarily count.
3. Preserve GP for Patience and the correct Hookset when collectability or a specific tug is required.
4. Leave enough time to reduce/submit the catch.

## Red alerts and critical missions
- [ ] Read the two demanded classes at the top of the screen.
- [ ] Switch to a demanded class you can complete reliably.
- [ ] Repeat its critical mission; every completion advances the matching server-wide gauge.
- [ ] Stay until the alert resolves so contributor bonuses are awarded.

## Mech operations
- **Pilot:** buy/exchange the destination's pilot application through Alerot, apply from the exotablet during the entry window, and follow the mech's duty actions. Five applicants are selected; an unselected application is returned and selection odds improve for later attempts.
- **Ground support:** go to the marked operation area and choose **Join Event**. Ground players help the pilots, receive experience/currency, and gain a temporary bonus for later stellar missions.

## Cosmic tools
- [ ] Choose one class first; every crafter and gatherer has independent tool data and stages.
- [ ] Complete missions on that same class and inspect its data at Researchingway/exotablet.
- [ ] Upgrade when the class reaches the displayed requirement. Do not discard the current tool unless the upgrade interface explicitly consumes/replaces it.
- [ ] After one full tool, repeat the same process for another class. On Auxesia, completed final tools unlock class-specific tool-mastery missions.

## Daily and long-term checks
- [ ] Open **Stellar Successes** each day; daily successes reset, standard successes accumulate.
- [ ] Check the destination project gauge and join projects/critical events when active.
- [ ] Spend cosmocredits and destination credits before assuming they share a cap or vendor.
- [ ] Check Cosmic Fortune prizes before spending destination credits.

## Troubleshooting
- **Mission item is absent:** open the pouch/log from Mission in Progress; it may not exist in normal inventory or the normal crafting log.
- **Mission is listed but locked:** clear its prerequisite mission at Gold, raise the class mission rank, or wait for the required time/weather.
- **No tool progress:** verify the mission was completed on the same class as the tool.
- **Cannot reach another destination:** finish its blue development-initiative quest in the previous destination, then use Cruisingway.
- **No critical mission:** critical missions require an active red alert; ordinary missions do not start one on demand.`, references: [official("Official Cosmic Exploration guide", "https://na.finalfantasyxiv.com/lodestone/cosmic_exploration/")] },
  { slug: "cosmic-destinations", parentSlug: "cosmic-exploration", type: "article", category: "Cosmic Exploration", title: "Destinations & Patch Progression", summary: "Exact unlock handoffs, travel NPCs, currency services, and unique systems for every expedition.", expansion: "Dawntrail", level: "100", audience: "Crafting & Gathering", tags: ["sinus ardorum", "phaenna", "oizys", "auxesia"], imageUrl: "/guides/cosmic-route.svg", order: 20,
    content: `## Released destinations
- **Sinus Ardorum:** the lunar starting expedition from patch 7.21.
- **Phaenna:** the second destination from patch 7.31.
- **Oizys:** the patch 7.41 expedition.
- **Auxesia:** the patch 7.51 destination and newest location represented here.

## Unlock and travel chain
- [ ] **Sinus Ardorum:** accept A Cosmic Homecoming from Namingway, Old Sharlayan (12.6,13.6). Cruisingway is at (20.6,19.5); Alerot at (22.4,20.3); shared vendor at (21.8,21.8); Orbitingway at (21.8,21.1).
- [ ] **Phaenna:** after the Sinus story, accept the development initiative from **Searchingway**, Sinus Ardorum (20.4,20.0). Cruisingway is at (27.0,13.9); Alerot at (27.8,13.1); vendor at (28.6,13.4); Orbitingway at (28.6,12.7).
- [ ] **Oizys:** after the Phaenna story, accept the next initiative from **Searchingway**, Phaenna (27.2,13.8). Cruisingway is at (17.3,22.8); Alerot at (17.5,23.8); Orbitingway at (18.3,24.5); artifact appraiser **Kaede** is at (17.3,24.1).
- [ ] **Auxesia:** after the Oizys story, accept the next initiative from **Searchingway**, Oizys (17.1,22.8). Cruisingway is at (28.8,29.3); Alerot at (27.1,29.4); Orbitingway at (27.2,28.4); Kaede at (27.5,29.4).

## Destination currencies
- **Cosmocredits** are the shared reward currency and are spent with the destination's general vendor.
- **Lunar/Phaenna/Oizys/Auxesia credits** are local. Use them with Alerot for pilot applications or Orbitingway for local Cosmic Fortunes.
- **Exploration tokens** from qualifying EX+ missions are destination-specific and exchange for that destination's special reward.

## Oizys and Auxesia artifact search
- [ ] Earn dronebits through Gold-rated class A, EX/EX+, or provisional missions.
- [ ] Exchange enough dronebits with **Kaede** for a drone module.
- [ ] Use the reconnaissance drone; located artifacts appear on the map.
- [ ] Inspect the field markers to collect unappraised ancient records.
- [ ] Return the records to Kaede for appraisal.

## Auxesia endgame additions
Completing a class's final cosmic tool unlocks its tool-mastery missions on Auxesia. These are score attacks rather than ordinary pass/fail missions. Each class has its own points, high scores, milestones, achievements, and possible titles.

## After a patch
Read the official patch topic, complete its blue unlock quest, then inspect the local stellar mission list.

> Cosmic Exploration is the umbrella system. Sinus Ardorum is its first destination, not another name for the entire feature. Tool progress connects the system, but mission lists, credits, projects, and local unlocks remain destination-specific.`, references: [official("Official Cosmic Exploration systems and coordinates", "https://na.finalfantasyxiv.com/lodestone/cosmic_exploration/"), official("Sinus Ardorum — 7.21", "https://na.finalfantasyxiv.com/lodestone/topics/detail/6f824223a7e10da7b9b7dfc84f626d10d4df88b3/"), official("Phaenna — 7.31", "https://na.finalfantasyxiv.com/lodestone/topics/detail/c04270777c63cabaa29d718eed4be4c1fca86c27/"), official("Oizys — 7.41", "https://na.finalfantasyxiv.com/lodestone/topics/detail/0de7befbbcefe67d1af77dcbe1bae937b916b67e"), official("Auxesia — 7.51", "https://na.finalfantasyxiv.com/lodestone/topics/detail/c46881a31a2c90d0965493c921b434eca09113f8")] },
  { slug: "collectables-scrips", parentSlug: "crafting-gathering", type: "collection", category: "Progression Systems", title: "Collectables, Scrips & Folklore", summary: "A complete profession progression library covering unlocks, production, appraisal, currencies, master recipes, and folklore.", expansion: "Multiple", level: "50–100", audience: "Crafting & Gathering", tags: ["collectables", "scrips", "folklore"], imageUrl: "/guides/collectables-route.svg", order: 30 },
  { slug: "collectables-workflow", parentSlug: "collectables-scrips", type: "article", category: "Collectables", title: "Complete Production & Turn-in Workflow", summary: "The full crafted, miner, botanist, and fisher collectable loop with rating tiers and troubleshooting.", expansion: "Multiple", level: "50–100", audience: "Crafting & Gathering", tags: ["collectables", "appraisal", "turn-ins"], imageUrl: "/guides/collectables-route.svg", order: 20,
    content: `## Unlock Rowena's system
- [ ] Finish the Heavensward MSQ **The Better Half**.
- [ ] As any level-50 crafter or gatherer, accept **Inscrutable Tastes** from **Morgayne**, Foundation (X:10.1, Y:10.4).
- [ ] Deliver her letter to **Lydirlona** in Revenant's Toll. This unlocks Collect, Collectable Appraisers, and the first Scrip Exchanges.
- [ ] At level 60, complete **Go West, Craftsman** from Lydirlona to open the Idyllshire appraiser.

Later expansion inventories unlock through short blue quests or conversations in their endgame hubs. Once a tier is unlocked, its goods appear at Scrip Exchanges throughout the game; you do not need to return to the original city every time.

## Crafted collectables
Modern collectable recipes are inherently collectable—there is no Collectable Synthesis toggle to activate.
1. Open Crafting Log → Special Recipes → Collectables and select the requested item.
2. Acquire the exact collectable recipe materials. A similarly named normal recipe will not turn in.
3. Craft normally; quality actions raise **collectability** instead of HQ chance.
4. Meet at least the first rating shown in the Collectable Appraiser window. Higher tiers award more scrips and experience.
5. Keep the item collectable. Using **Lower Quality** converts it into a normal item and permanently removes turn-in eligibility.

Use Trial Synthesis to validate a rotation without consuming materials. If the top tier is unreliable, improve Control/CP, repair gear, eat suitable food, and use a rotation that reaches the rating before spending all durability.

## Miner and botanist collectables
1. Open Timers → Rowena's House of Splendors to identify the requested item and its location.
2. Use the Gathering Log to find the node; folklore items may appear only in an Eorzea-time window.
3. At the node, use the collectable appraisal actions to raise collectability while preserving integrity.
4. Collect only after reaching the desired reward tier. Save GP for Scrutiny, Meticulous Prospector/Meticulous Woodsman, and integrity restoration as appropriate.

The displayed item chance and collectability prediction are more useful than a memorized rotation: node bonuses, stats, and level change the best sequence.

## Fisher collectables
- Activate **Collect** before catching the fish; the buff remains on until canceled.
- Verify bait, fishing hole, time, weather, and any mooch chain in the Fishing Log.
- Collectability is driven mainly by fish size. Patience actions and the correct hookset improve the chance of a qualifying catch.
- If a fish arrives as a normal item, Collect was not active when it was caught and the appraiser cannot accept it.

## Appraise and spend
- **Collectable Appraiser:** accepts eligible crafted, gathered, and caught items shown in the current list.
- **Scrip Exchange:** sells current and legacy gear, materia, materials, bait, master recipe books, and regional folklore tomes.
- **Regional folklore tomes:** permanently reveal that expansion/region's legendary gathering entries after use.
- **Master recipe books:** permanently add advanced crafting recipes after use.

Currency colors rotate as expansions advance. Read the reward and vendor tab in game rather than following an old guide that names a retired endgame color. The current capped tier is for current-level rewards; older tiers remain useful for books, materials, and leveling gear.

## Timed-node route
- [ ] Learn and use the correct folklore tome.
- [ ] Confirm the gathering-log entry, Eorzea time, zone, and nearest aetheryte.
- [ ] Set an in-game alarm several Eorzea minutes early.
- [ ] Arrive with repaired gear, enough GP, and free inventory space.
- [ ] Favor the requested collectability tier over gathering extra low-value copies.

## What does and does not use allowances
Ordinary Rowena collectables are repeatable while listed and have no weekly allowance. **Custom Deliveries** use 12 weekly allowances. Studium, Wachumeq, and allied-society quests are separate story/quest systems even when they award crafting or gathering experience.

## Troubleshooting
- **Item is greyed out:** wrong recipe, insufficient collectability, normal-quality conversion, wrong appraiser tier, or the item is no longer requested.
- **Recipe or node missing:** complete the regional unlock and use the required master/folklore book.
- **No collectability on a crafted item:** choose the recipe under Special Recipes → Collectables.
- **Gathered item never appears:** verify folklore ownership, Eorzea time, and that the log points to the correct expansion's zone.`, references: [official("Official Collectable Appraiser database", "https://na.finalfantasyxiv.com/lodestone/playguide/db/shop/?category2=collectables"), official("Collectables unlocks and expansion tiers", "https://ffxiv.consolegameswiki.com/wiki/Collector%27s_Standard"), official("Inscrutable Tastes quest details", "https://ffxiv.consolegameswiki.com/wiki/Inscrutable_Tastes")] },
  { slug: "collectables-unlock-directory", parentSlug: "collectables-scrips", type: "article", category: "Collectables", title: "Unlock & Vendor Directory", summary: "Every expansion's appraiser and Scrip Exchange unlock in one ordered checklist.", expansion: "Multiple", level: "50–100", audience: "Crafting & Gathering", tags: ["unlock", "appraiser", "scrip exchange"], imageUrl: "/guides/crafting.svg", order: 10,
    content: `## Base system
- [ ] Finish the Heavensward MSQ **The Better Half**.
- [ ] Accept **Inscrutable Tastes** from Morgayne, Foundation (X:10.1, Y:10.4), as a level-50 crafter or gatherer.
- [ ] Deliver the letter to Lydirlona in Revenant's Toll to unlock Collect, original appraisers, and Scrip Exchanges.
- [ ] At level 56, complete **No Longer a Collectable** from Lydirlona to unlock Aetherial Reduction.

## Expansion exchange unlocks
Complete each row once. Its inventory then becomes available at Scrip Exchange NPCs throughout the game.
- [ ] **Heavensward, level 60:** **Go West, Craftsman** from Lydirlona → Idyllshire services.
- [ ] **Stormblood, level 60:** **Reach Long and Prosper** from Galiena → Rhalgr's Reach services.
- [ ] **Shadowbringers, level 70:** **The Boutique Always Wins** from Mowen → Eulmore services.
- [ ] **Endwalker, level 80:** **Expanding House of Splendors** from Ofpilona → Radz-at-Han services.
- [ ] **Dawntrail, level 90:** **Dawn of a New Deal** from Rhodina → Solution Nine services.

The later unlocks are short conversations and may not remain in the journal. If the newest vendor tab is absent, return to that expansion's named NPC after meeting its MSQ and level requirements.

## Counter directory
- **Collectable Appraiser:** accepts currently requested items that meet the minimum rating.
- **Scrip Exchange:** sells profession gear, materia, manuals, bait, materials, and unlock books.
- **Splendors Vendor:** sells special materials and goods opened through the same regional progression.

## Verify the unlock
- [ ] Open Timers → Rowena's House of Splendors and confirm requested items appear.
- [ ] Speak to any Scrip Exchange and confirm the highest expansion tab.
- [ ] Open Currency → Other and confirm crafter/gatherer balances.
- [ ] Check inventory and Key Items before rebuying a permanent book.

## Missing unlock
- **Blue quest absent:** finish the named expansion story requirement and raise one Hand/Land class to the quest level.
- **Newest tab missing:** complete that expansion's exchange conversation.
- **Book says already acquired:** inspect the crafting or gathering log; the unlock is permanent.
- **Custom Delivery client missing:** those clients have separate story prerequisites in the Custom Deliveries library.`, references: [official("Collectables and exchange unlock table", "https://ffxiv.consolegameswiki.com/wiki/Custom_Deliveries"), official("Inscrutable Tastes", "https://ffxiv.consolegameswiki.com/wiki/Inscrutable_Tastes")] },
  { slug: "scrips-books-folklore", parentSlug: "collectables-scrips", type: "article", category: "Collectables", title: "Scrip Spending, Master Recipes & Folklore", summary: "A priority guide for currencies, books, legendary nodes, gear, materia, and permanent unlocks.", expansion: "Multiple", level: "50–100", audience: "Crafting & Gathering", tags: ["scrips", "master recipes", "folklore", "legendary nodes"], imageUrl: "/guides/crafting.svg", order: 30,
    content: `## Buy permanent unlocks first
Scrip caps make unspent currency wasteful. Before temporary gear or materia, buy missing permanent books for content you intend to use.

### Crafters
- [ ] Buy and use Master Recipe books for each crafting class.
- [ ] Verify new entries under Crafting Log → Special Recipes → Master Recipes.
- [ ] Prioritize books containing current crafts, food, medicine, gear, housing, or requested collectables.

### Gatherers
- [ ] Buy and use every Regional Folklore tome needed for the expansion and region.
- [ ] Verify entries under Gathering Log → Regional Folklore.
- [ ] Set alarms for legendary-node Eorzea-time windows and record the nearest aetheryte.

## Spending priority
1. Prevent capping with a needed permanent unlock.
2. Buy current tools/gear only when they improve rating or gathering thresholds.
3. Buy materia after choosing the target gear set.
4. Buy recipe materials, bait, manuals, or tokens for a specific project.
5. Convert excess legacy currency into useful materials.

Currency colors change roles as expansions advance. In Dawntrail, leveling/non-cap deliveries commonly award Purple scrips and level-cap activity awards Orange. Read the live vendor tab instead of trusting an older color guide.

## Legendary-node checklist
- [ ] Learn the correct folklore tome.
- [ ] Select the item in Gathering Log and confirm zone and active Eorzea time.
- [ ] Set an alarm early enough to teleport and mount.
- [ ] Arrive with repaired gear, enough GP, food if needed, and open inventory.
- [ ] Meet displayed node bonuses and use collectability actions for collectable targets.

## Master-recipe checklist
- [ ] Confirm the book was used on this character.
- [ ] Check intermediate materials and folklore ingredients.
- [ ] Use Trial Synthesis for an unfamiliar high-difficulty craft.
- [ ] Check craftsmanship, control, and CP before buying materials.
- [ ] Save a macro only after testing it with the exact recipe and gear.

## Common mistakes
- Leaving a purchased book unused in inventory.
- Buying the wrong expansion or region's folklore tome.
- Spending everything on temporary gear before permanent recipes/nodes.
- Arriving at a timed node without enough GP.
- Following an old scrip-color recommendation without checking the current exchange.`, references: [official("Official Scrip Exchange database", "https://na.finalfantasyxiv.com/lodestone/playguide/db/shop/?category2=collectables"), official("Collectables vendor progression", "https://ffxiv.consolegameswiki.com/wiki/Collector%27s_Standard")] },
  { slug: "custom-deliveries", parentSlug: "crafting-gathering", type: "collection", category: "Weekly Progression", title: "Custom Deliveries", summary: "A complete weekly library for every client, discipline, satisfaction story, bonus, and reward.", expansion: "Multiple", level: "60–100", audience: "Crafting & Gathering", tags: ["custom deliveries", "weekly", "scrips"], imageUrl: "/guides/custom-deliveries-route.svg", order: 40 },
  { slug: "custom-deliveries-directory", parentSlug: "custom-deliveries", type: "article", category: "Custom Deliveries", title: "Every Client & Unlock Requirement", summary: "All clients from Zhloe through Tiisol Ja, with quest names, coordinates, prerequisites, and rank rules.", expansion: "Multiple", level: "60–100", audience: "Crafting & Gathering", tags: ["clients", "unlock", "satisfaction"], imageUrl: "/guides/custom-deliveries-route.svg", order: 10,
    content: `## Rules that govern every client
- You receive **12 allowances per week** across the entire account and may give **up to 6** items to one client.
- Allowances reset Tuesday at 12:00 a.m. Pacific and do not carry over.
- Higher collectability gives more experience and scrips. A gold bonus marker on a requested category increases its reward.
- New clients need 3 satisfaction deliveries to reach rank 2, then 6 for each later rank; reaching rank 5 therefore takes at least four weekly resets.

Open **Timers → Custom Deliveries** before crafting. It shows each client's current request, bonus, remaining personal allowance, and your global allowance.

## Client unlock directory
### Heavensward and Stormblood
- **Zhloe Aliapoh** — level 55, Idyllshire (X:4.6, Y:6.7). Accept **Arms Wide Open** from Geimlona (X:5.8, Y:7.0) after A Great New Nation and Inscrutable Tastes.
- **M'naago** — level 60, Rhalgr's Reach (X:14.6, Y:9.4). Accept **None Forgotten, None Forsaken** from Galiena (X:9.8, Y:12.5) after Return of the Bull and Reach Long and Prosper.
- **Kurenai** — level 62, Ruby Sea (X:28.3, Y:15.3, Z:-1.2). Accept **The Seaweed Is Always Greener** from the Kojin Hireling in Kugane (X:10.1, Y:9.9) after Forever and Ever Apart.
- **Adkiragh** — level 66, Idyllshire (X:4.9, Y:6.6). Accept **Between a Rock and the Hard Place** from Geimlona after Arms Wide Open and the prerequisite Idyllshire quest chain.

### Shadowbringers
- **Kai-Shirr** — level 70, Eulmore (X:11.7, Y:11.7). Complete **Oh, Beehive Yourself** after opening Eulmore's collectables branch.
- **Ehll Tou** — level 70, the Firmament (X:13.5, Y:11.2). Complete **O Crafter, My Crafter** after progressing the Ishgardian Restoration side story.
- **Count Charlemend** — level 70, the Firmament (X:9.4, Y:8.7). Accept **You Can Count on It** from Francel after the required Firmament stories.

### Endwalker
- **Ameliance** — level 80, Old Sharlayan (X:12.6, Y:9.7). Accept **Of Mothers and Merchants** from the Well-dressed Attendant after Endwalker and Inscrutable Tastes.
- **Anden** — level 80, Il Mheg (X:17.0, Y:34.0). Accept **That's So Anden** from the Supplicant Sheep, Crystarium (X:9.3, Y:11.3), after Endwalker.
- **Margrat** — level 80, Labyrinthos (X:20.4, Y:20.1). Accept **A Request of One's Own** from Theopauldin, Old Sharlayan (X:13.8, Y:15.0), after Going Haam.

### Dawntrail
- **Nitowikwe** — level 90, Shaaloani (X:14.3, Y:19.3). Accept **Laying New Tracks** from the Railroad Employee, Tuliyollal (X:14.1, Y:12.1), after The Warmth of Family.
- **Tiisol Ja** — level 90, Tuliyollal (X:15.1, Y:12.0). Accept **Taco Time** from Hhuki (X:13.7, Y:12.1) after The Promise of Tomorrow.

All clients also require the collectables system from **Inscrutable Tastes**. A missing blue quest usually means one of the named MSQ or side-story prerequisites is incomplete.

## Six-delivery workflow
- [ ] Choose the client and the crafter/gatherer that should receive experience.
- [ ] Read the exact requested item and reward tiers in Timers.
- [ ] For crafting, buy that client's unique material from the nearby material supplier, then craft under Special Recipes → Custom Deliveries.
- [ ] For mining/botany, gather the client-specific collectable at the logged location.
- [ ] For fishing, activate Collect and use the listed bait/hole; fish size determines collectability.
- [ ] Make one test item before producing all six.
- [ ] Deliver the highest tier you can reach reliably, checking the bonus request before committing the week's allowances.

Delivery items are client-specific. Similar item names and materials from a different client are not substitutes.

## Choosing where to spend the week
While stories are incomplete, giving six deliveries to one client advances that client's satisfaction efficiently. Once stories are complete, prioritize:
1. a gold-bonus category you can reach at the top tier;
2. the job that most needs experience;
3. the scrip color/material you currently need;
4. any unfinished achievement or client story.

Most rank-5 clients allow glamour changes when a shirt icon appears beside their satisfaction hearts. Glamour prisms and normal race/gender/equipment restrictions apply.

## Troubleshooting
- **Cannot deliver:** wrong client item, insufficient collectability, no allowances, or delivery made on a class below the client's requirement.
- **Cannot find material:** use the supplier near that client; ordinary market materials with a similar name will not work.
- **Top tier is inconsistent:** repair gear, use food, improve Control/Perception, or deliver to an older client with lower requirements.
- **Client vanished from Timers:** unlock quest not finished on this character, or the relevant expansion/side-story prerequisite is incomplete.`, references: [official("Official Custom Delivery recipe database", "https://na.finalfantasyxiv.com/lodestone/playguide/db/recipe/?category2=1&category3=c6"), official("Complete Custom Delivery client and unlock table", "https://ffxiv.consolegameswiki.com/wiki/Custom_Deliveries")] },

  { slug: "field-operations", parentSlug: null, type: "collection", category: "Exploration", title: "Field Operations & Exploratory Zones", summary: "Independent levels, special actions, large-scale encounters, and relic connections for Eureka, Bozja, and the Occult Crescent.", tags: ["field operations", "eureka", "bozja", "occult crescent"], imageUrl: "/guides/field-operation-route.svg", order: 40 },
  { slug: "eureka-field-guide", parentSlug: "field-operations", type: "collection", category: "Field Operation", title: "The Forbidden Land, Eureka", summary: "Zone routes, elemental systems, Logos Actions, notorious monsters, gear, and Baldesion Arsenal preparation.", expansion: "Stormblood", level: "70", audience: "Combat", tags: ["eureka", "anemos", "pagos", "pyros", "hydatos", "baldesion arsenal"], imageUrl: "/guides/field-operations.svg", order: 10 },
  { slug: "eureka-field-complete", parentSlug: "eureka-field-guide", type: "article", category: "Field Operation", title: "Complete Eureka Zone Route", summary: "The full Anemos-to-Hydatos route, level gates, crystal totals, NM etiquette, and Arsenal preparation.", expansion: "Stormblood", level: "70", audience: "Combat", tags: ["eureka", "complete route"], imageUrl: "/guides/field-operations.svg", order: 10,
    content: `## Unlock and survival rules
- [ ] Finish Stormblood and accept **And We Shall Call It Eureka** from **Galiena**, Rhalgr's Reach (X:9.8, Y:12.5); travel through Rodney in Kugane.
- [ ] Finish the level-70 job quest and retrieve the job's Antiquated weapon/armor from the Calamity Salvager if needed.
- Elemental level is separate from job level. Death at higher elemental levels can remove experience; wait for a raise instead of returning.
- Rotate the Magia Board toward the enemy's weakness for damage or toward the enemy's element for defense. Attune to every aetheryte as its level requirement is met.

## Anemos — elemental levels 1–20
- [ ] Complete the Eureka challenge-log enemy categories weekly; fight enemies at or slightly above your elemental level.
- [ ] Join notorious-monster trains. The instance tracker/shout chat supplies spawn coordinates and pull times.
- [ ] Complete Krile's elemental-level story quests at 1, 3, 5, 9, 13, and 17; quest markers may not remain on the map, so record her clue.
- [ ] Convert Anemos Crystals to Protean Crystals with Gerolt as needed.
- [ ] Weapon totals: 100 Protean for +1, 400 for +2, 800 for the third step, then 3 Pazuzu's Feathers for Anemos. Feathers come from Wail in the Willows or the birdwatcher exchange.
- [ ] Reach elemental 17 and complete the final story objective to unlock Pagos.

## Pagos — elemental levels 20–35
- [ ] Complete Krile's Pagos quests and unlock additional aetherytes before crossing dangerous routes.
- [ ] At elemental 25, accept Gerolt's kettle quest. Earn vitiated aether from NMs/appropriate enemies; convert full charges at the **Crystal Forge (X:6.0, Y:21.5)**.
- [ ] Do not overcap: the kettle holds nine charges.
- [ ] Weapon: 5 Frosted Protean Crystals → Pagos; then 10 Frosted + 500 Pagos Crystals → Pagos +1; then 16 Frosted + 5 Louhi's Ice → Elemental.
- [ ] Louhi's Ice drops from Louhi on Ice or costs 50 Pagos Crystals each at the birdwatcher.

## Pyros — elemental levels 35–50
- [ ] Follow Krile's story and unlock logogram appraisal.
- [ ] Obtain logograms from sprite/mob/NM sources, have Drake appraise them, and combine remembered mnemes in the Logos Manipulator.
- [ ] Register enough unique Logos Actions to unlock each weapon upgrade. Actions are consumed when loaded; keep extras for difficult content.
- [ ] Weapon sequence uses Pyros Crystals for Elemental +1, Elemental +2, and Pyros, with 5 Penthesilea's Flames for the final Pyros step. Flames come from Lost Epic or birdwatcher exchange.
- [ ] Optional substat rolls use additional light/crystals after the weapon is complete.

## Hydatos — elemental levels 50–60
- [ ] Complete Krile's final Eureka story, gather Hydatos Crystals from NMs, and obtain 5 Crystalline Scales from Provenance Watcher or the birdwatcher.
- [ ] Upgrade through Hydatos, Hydatos +1, and Eureka. The final Physeos enhancement additionally requires 100 Eureka Fragments from Baldesion Arsenal and grants elemental bonuses inside Eureka.

## Notorious-monster etiquette
- [ ] Join a party for reliable credit; shout “LFG” with location.
- [ ] When spawning an NM, announce it and a reasonable pull time. Do not assume every instance uses the same tracker.
- [ ] Raise nearby players and call coordinates as zone then X/Y.
- [ ] Use the Eureka Potion vendor consumables and an appropriate Logos defensive/recovery action in Pyros/Hydatos.

## Baldesion Arsenal preparation
- [ ] Finish Hydatos story and join an organized run; entry portals and support FATE timing are coordinated.
- [ ] Bring two useful Logos Actions, elemental armor if available, Eurekan Potions, food, and remembered reraiser/sacrifice tools requested by leadership.
- [ ] Resurrection is restricted. Do not enter an assigned portal or start a boss without the organizer.

## Troubleshooting
- **Story marker missing:** return to Krile and reread her last location clue; Eureka objectives often omit map markers.
- **No kettle light:** accept Gerolt's level-25 kettle step and fight appropriate Pagos enemies/NMs.
- **Cannot use aetheryte:** raise elemental level to that aetheryte's requirement.
- **Weapon option absent:** carry the immediately previous weapon and complete the zone's Gerolt/story prerequisite.`, references: [official("Official Eureka guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/eureka/"), official("Eurekan weapon material totals", "https://ffxiv.consolegameswiki.com/wiki/Eurekan_Weapons")] },
  { slug: "bozja-field-guide", parentSlug: "field-operations", type: "collection", category: "Field Operation", title: "Bozja, Delubrum & Zadnor", summary: "Southern Front and Zadnor routes, lost actions, fragments, raids, duels, honors, notes, and relic connections.", expansion: "Shadowbringers", level: "80", audience: "Combat", tags: ["bozja", "zadnor", "delubrum", "dalriada"], imageUrl: "/guides/field-operations.svg", order: 20 },
  { slug: "bozja-field-complete", parentSlug: "bozja-field-guide", type: "article", category: "Field Operation", title: "Complete Southern Front & Zadnor Route", summary: "All rank gates, story raids, mettle systems, duels, honors, and field-note troubleshooting.", expansion: "Shadowbringers", level: "80", audience: "Combat", tags: ["bozja", "complete route"], imageUrl: "/guides/field-operations.svg", order: 10,
    content: `## Unlock checklist
- [ ] Finish Shadowbringers through **Vows of Virtue, Deeds of Cruelty**.
- [ ] Complete the Return to Ivalice alliance-raid story through **The Orbonne Monastery** and its closing quest.
- [ ] Accept **Hail to the Queen** from **Keiten**, Kugane (X:12.2, Y:12.3), then complete the solo instance and Gangos introduction.
- [ ] Complete the first Resistance weapon quest and **Where Eagles Nest** to enter the Bozjan Southern Front.

Jobs level 71 or higher can enter and are synced to level 80. Jobs below 80 earn normal experience, making skirmish chains useful for leveling while progressing the field operation.

## The three systems on the HUD
- **Resistance rank:** permanent access progression. Earn mettle, speak to the Resistance Commander at the displayed threshold, and rank up to open sectors and story.
- **Mettle:** field-operation experience. Being incapacitated costs mettle; returning to camp without a raise costs more. A death cannot lower your Resistance rank.
- **Lost Finds:** appraised fragments unlock consumable Lost Actions. Move actions from the Lost Finds Cache into the limited-capacity holster before leaving camp.

Do not hoard unidentified fragments. Appraise a batch, learn which actions they contain, and build role-appropriate loadouts. An essence lasts until leaving the instance or changing job and is the largest basic performance increase available.

## Southern Front route — ranks 1–15
### Sector 1
- [ ] Follow skirmishes around the Southern Entrenchment and complete the introductory story.
- [ ] Appraise basic fragments and equip an essence plus damage, healing, or mitigation appropriate to the job.
- [ ] Attune to each aetheryte as its sector opens.

### Sector 2
- [ ] Continue north as rank requirements permit; complete story objectives rather than farming only the easiest southern FATEs.
- [ ] Register for critical engagements from the on-screen prompt. Selection is not guaranteed when oversubscribed.
- [ ] Spend Bozjan Clusters at the quartermaster only after deciding whether mounts, actions, and other rewards are priorities.

### Sector 3 and Castrum Lacus Litore
- [ ] Reach **Resistance rank 10** and finish the available story to unlock Castrum.
- [ ] When Castrum appears, register through the Resistance Recruitment window. It is a multi-party critical engagement, not a Duty Finder raid.
- [ ] Split groups between the opening encounters, rescue prisoners promptly for better rewards, and follow party assignments through the final bosses.
- [ ] Finish Castrum and the following Gangos quests to advance the Save the Queen story.

## Skirmishes, critical engagements, and duels
- **Skirmishes** are open FATE-style encounters. Contribution affects rewards; arrive before completion and join a party when possible.
- **Critical engagements** are instanced arena battles. Register during the preparation window, then use Ready if selected.
- **Duels** invite qualifying players after particular critical engagements. Qualification requires clearing the prerequisite encounter without being hit by avoidable vulnerability mechanics—not simply surviving.

Before accepting a duel, look up its exact mechanics and prepare the required Lost Actions. If selected but unprepared, declining preserves the instance's time and lets another qualified player attempt it.

## Delubrum Reginae
- [ ] Complete **A Sign of What's to Come** and the related Gangos quests after Castrum to unlock Delubrum Reginae.
- [ ] Queue through its Gangos entrance. Normal mode advances story and several Resistance weapon steps.
- [ ] Bring a suitable essence, damage actions, and recovery. Traps and twice-come-ruin mechanics punish repeated mistakes even when ordinary resurrection is available.
- [ ] Treat **Delubrum Reginae (Savage)** as separate organized alliance content. Join a community run and follow its assigned actions, roles, and voice instructions.

## Zadnor route — ranks 15–25
- [ ] Complete the Delubrum story and **A New Playing Field** to enter Zadnor.
- [ ] Progress through all three sectors, ranking up and completing each story marker as it appears.
- [ ] Farm skirmishes and critical engagements for mettle, fragments, field notes, and relic one-time collections.
- [ ] Reach **rank 25**, complete **March of the Bloody Queen**, and enter **the Dalriada** when its special engagement appears.

The Dalriada allows up to 48 players and is Zadnor's story finale. At the opening, assigned groups must handle simultaneous routes; later encounters reward correct Lost Action use and clear party responsibilities.

## Resistance honors after rank 25
After rank 25 and March of the Bloody Queen, speak with the Resistance Councilor in Zadnor (X:35.7, Y:34.9).
- Exchange **20,000,000 mettle** for 3 Proofs of Mettle.
- Spend proofs on Suns of Fortitude (maximum HP), Valor (damage), or Succor (healing).
- Each ray can reach rank 10; proof costs rise as its rank increases.

Honors are permanent in Save the Queen areas and are not lost on death. Damage is generally the best farming investment; organized groups may ask tanks or healers to prioritize survivability/support.

## Field-note completion
Field notes come from specified skirmishes, critical engagements, duels, Castrum, and the Dalriada. Check the note's Collection entry before repeating random encounters. Some rare notes have a guaranteed duel source and a lower-probability group source.

## Safe farming checklist
- [ ] Repair gear and free inventory space before entering.
- [ ] Carry an essence and at least one useful action; do not save every consumable forever.
- [ ] Join a party and use return/aetherytes instead of crossing hostile ranks alone.
- [ ] Wait for a raise after death unless the instance is closing.
- [ ] Keep the active Resistance weapon quest accepted before farming its drops.

## Troubleshooting
- **Castrum/Dalriada never appears:** meet the rank/story requirement and remain in an active instance; the engagement is periodic.
- **Fragment cannot be used:** appraise it first, then move the learned action from cache to holster.
- **No relic drop:** confirm the correct active quest and qualifying encounter/duty.
- **Zadnor quest missing:** finish Delubrum Reginae and every intervening Gangos story quest.
- **Duel invite missing:** the prerequisite critical engagement must be cleared without avoidable vulnerability hits.`, references: [official("Official Save the Queen quest database", "https://na.finalfantasyxiv.com/lodestone/playguide/db/quest/?category2=7"), official("Zadnor ranks, Dalriada, and Resistance Honors", "https://ffxiv.consolegameswiki.com/wiki/Zadnor"), official("Resistance weapon material route", "https://ffxiv.consolegameswiki.com/wiki/Resistance_Weapons")] },
  { slug: "occult-crescent-guide", parentSlug: "field-operations", type: "collection", category: "Field Operation", title: "Occult Crescent", summary: "South and North Horn routes, phantom jobs, records, currencies, towers, gear, and relic connections.", expansion: "Dawntrail", level: "100", audience: "Combat", tags: ["occult crescent", "phantom jobs", "phantom weapons"], imageUrl: "/guides/field-operations.svg", order: 30 },
  { slug: "occult-crescent-complete", parentSlug: "occult-crescent-guide", type: "article", category: "Field Operation", title: "Complete South & North Horn Route", summary: "The full knowledge-level route, phantom jobs, encounters, currencies, records, towers, and current endgame.", expansion: "Dawntrail", level: "100", audience: "Combat", tags: ["occult crescent", "complete route"], imageUrl: "/guides/field-operations.svg", order: 10,
    content: `## Unlock and enter
- [ ] Finish the Dawntrail main-scenario quest **Dawntrail** on a level-100 combat job.
- [ ] Accept **One Last Hurrah** from the **Expedition Messenger**, Tuliyollal (X:17.1, Y:11.8).
- [ ] Continue **The Phantom Village** from Ketenramm (X:7.0, Y:6.9), then **Unfamiliar Territory** from the Archive (X:6.1, Y:6.4).
- [ ] Enter by speaking with **Jeffroy**, Phantom Village (X:4.5, Y:6.6). For a party or alliance, its leader initiates entry.

Only level-100 Disciples of War or Magic may change into combat jobs inside. Mounts work immediately and cannot fly. **Occult Return** returns directly to base camp.

## Knowledge level and survival
Knowledge is separate field experience earned from enemies, quests, FATEs, and critical encounters.
- Fighting above your knowledge level deals less damage and causes you to take more, but awards more knowledge when successful.
- Above knowledge level 5, returning to camp or leaving while incapacitated removes knowledge and can lower the level.
- Wait for a raise whenever practical. Party before fighting chains and carry the recovery tools your phantom job supports.
- The current cap is **40**. South Horn syncs players to 20, but capped players can still earn knowledge there for later progression.

## Phantom jobs
Phantom jobs supplement—not replace—the equipped combat job.
- [ ] Complete **New Job, Old Tricks** from Ketenramm, South Horn (X:38.3, Y:7.4), to begin the phantom-job system.
- [ ] Obtain additional jobs from soul shards sold on the isle or dropped by critical encounters and other content.
- [ ] Select Phantom Job Details on the Occult Crescent HUD to change jobs outside combat.
- [ ] Earn phantom EXP while that phantom job is active to unlock its actions and traits.
- [ ] Master multiple phantom jobs. Each mastery strengthens the persistent Phantom Mastery effect; Freelancer levels as other jobs are mastered.

Build for the activity rather than a tier list: defensive and resurrection tools are valuable for dangerous chains, support combinations matter in towers, and damage tools speed ordinary farming. Put the current phantom action on the duty-action panel/hotbar before leaving camp.

## South Horn — knowledge 1–20
- [ ] Follow every quest and archive/investigation prompt; some later story requires specified Occult Record entries.
- [ ] Complete field-operation Challenge Log entries and FATE chains for steady knowledge and phantom EXP.
- [ ] Register for critical encounters and remain inside their marked arena before the start.
- [ ] Hunt soul shards and Occult Record notes while completing zone objectives.
- [ ] Open personal treasure coffers when they appear; they are visible only to their owner.

FATEs and critical encounters do not scale their mechanics to your knowledge level, so learn the telegraphs rather than expecting raw levels to bypass them. Some critical encounters require defeating particular wild enemies before they can trigger.

## The Forked Tower: Blood
This South Horn operation is organized large-scale content. Before joining:
- [ ] Finish its local unlock quest and meet the displayed knowledge requirement.
- [ ] Join a scheduled or clearly led group.
- [ ] Equip the requested phantom job and understand its assigned actions.
- [ ] Carry the group's required entry resource and follow its portal/entry instructions.

Do not improvise a tower loadout after entry. Group composition and phantom-action coverage are part of the encounter design.

## North Horn — knowledge 20–40
- [ ] Finish the South Horn story required by the North Horn quest chain.
- [ ] Raise knowledge toward 40 through North Horn FATEs, critical encounters, quests, enemies, and Challenge Log objectives.
- [ ] Unlock its new phantom jobs and masteries, Occult Record entries, riding map, camps, and local systems as quests expose them.
- [ ] Spend **Enlightenment silver obols** (mainly FATEs/critical encounters) and **gold obols** (mainly wild enemies) with the expedition antiquarian at North Horn (X:39.3, Y:38.6).
- [ ] Exchange and upgrade Occult Crescent gear with the expedition armorer at North Horn (X:39.5, Y:39.0). South Horn gear can be exchanged for a corresponding North Horn tier.

North and South use different local currencies. Read the HUD before planning a purchase.

## Treasure and record loop
- Normal treasure coffers can appear after enemies and events and are personal.
- Fortune carrots reveal happy bunnies that lead to treasure; once another player claims a reward, search for a different sign.
- Occult Record entries come from story, notes, encounters, and exploration. If a quest will not advance, inspect the record for the named missing entry rather than repeating unrelated FATEs.
- Knowledge crystals in North Horn resonate with particular phantom actions and grant party effects; coordinate who activates them.

## The Forked Tower: Magic
Normal mode requires **knowledge level 40** and its North Horn unlock quest. Completion of the Tower of Blood is not required.
- It opens during **Auroral Mirage** through an aetherial node and admits up to 48 players.
- No cipher is required. If more than 48 board, selection is random by party; unsuccessful eligible players gain future priority.
- A preformed alliance of at least 24 creates an exclusive instance and triggers the weather after five minutes when requirements are met.
- Jobs and phantom jobs may be changed outside combat inside the tower.
- Using Occult Return or returning after incapacitation removes you from the tower.

Normal mode has no resurrection restriction, but coordinated phantom roles still matter.

## The Forked Tower: Magic (Extreme)
- [ ] Reach knowledge 40 and complete its separate North Horn unlock quest.
- [ ] Form a pre-made alliance of **12–48 players** across at least three parties.
- [ ] Have the alliance leader enter through Jeffroy in the Phantom Village.
- [ ] Follow the organizer's job, phantom-job, mitigation, and communication assignments.

Extreme is not a spontaneous field queue. Its private instance, short initial timer, and multi-party mechanics require an organized group.

## Phantom weapon connection
Phantom weapons begin through their level-100 quests in the Phantom Village and continue across the field-operation patches. Keep the quest for the chosen job active, use that same job when the quest requires it, and verify each stage's objective before farming. Patch 7.55 adds the final two enhancement stages and requires a variety of duties rather than only island currency.

## Troubleshooting
- **Cannot enter:** finish Dawntrail and the opening quest chain; all party members must be eligible and present.
- **Phantom job will not level:** Freelancer advances through mastering other phantom jobs; other jobs need to be active when phantom EXP is awarded.
- **Story is blocked:** read the current quest objective and Occult Record requirements; missing notes can gate later quests.
- **Lost knowledge:** returning or leaving while incapacitated above level 5 applies the penalty—wait for a raise.
- **Tower node did not select the party:** everyone must stand on the node and have the unlock; failed eligible entries build priority.
- **North Horn vendor lacks an item:** verify local story, knowledge level, currency type, and any required record/achievement.`, references: [official("Official South Horn systems and unlocks — Patch 7.25", "https://na.finalfantasyxiv.com/lodestone/topics/detail/6e4b5a23048ddb2569b12f8567baf7e8a2f370d9/"), official("Official North Horn, knowledge 40, and Tower of Magic — Patch 7.55", "https://na.finalfantasyxiv.com/lodestone/topics/detail/f892390a6ec7a958222c739d2a79822899786240"), official("Official Patch 7.5 Occult Crescent adjustments", "https://na.finalfantasyxiv.com/lodestone/topics/detail/07320affa7e0fcd9685afcbe54fbf55405b6d822")] },
  { slug: "zodiac-relic-zenith-atma", parentSlug: "zodiac-weapons", type: "article", category: "Zodiac Walkthrough", title: "1. Relic, Zenith & Atma", summary: "Prerequisites, job-specific broken weapons and crafted bases, required duties, and all twelve Atma zones.", expansion: "A Realm Reborn", level: "50", audience: "Combat", tags: ["relic reborn", "zenith", "atma"], imageUrl: "/guides/relics.svg", order: 10,
    content: `## Before accepting anything
- [ ] Finish **The Ultimate Weapon** main-scenario quest.
- [ ] Finish every ARR class and job quest through level 50 for the chosen job.
- [ ] Unlock Amdapor Keep through **Ghosts of Amdapor**.
- [ ] Keep at least 135 Poetics available: 15 for Quenching Oil, 60 for the first Zenith, and 60 for three Thavnairian Mists used during the base quest.

## One-time introduction — The Weaponsmith of Legend
- [ ] Accept from **Nedrick Ironheart**, Vesper Bay, Western Thanalan (X:12, Y:14).
- [ ] Speak with **Rowena**, Revenant's Toll, Mor Dhona (X:22, Y:6).
- [ ] Speak with **Gerolt**, Hyrstmill, North Shroud (X:30, Y:20). Future jobs begin directly with A Relic Reborn here.

## A Relic Reborn — broken weapon
Accept from **Gerolt** at North Shroud (X:30, Y:20), then recover the job's broken weapon:
- [ ] Paladin — Zahar'ak, Southern Thanalan (X:30, Y:19).
- [ ] Warrior — U'Ghamaro Mines, Outer La Noscea (X:23, Y:10).
- [ ] Dragoon — Natalan, Coerthas Central Highlands (X:34, Y:21).
- [ ] Monk — Zahar'ak, Southern Thanalan (X:32, Y:18).
- [ ] Ninja — Sapsa Spawning Grounds, Western La Noscea (X:16, Y:17).
- [ ] Bard — Natalan, Coerthas Central Highlands (X:35.4, Y:22.2).
- [ ] Black Mage — U'Ghamaro Mines, Outer La Noscea (X:23, Y:10).
- [ ] Summoner — Sylphlands, East Shroud (X:25, Y:19).
- [ ] White Mage — U'Ghamaro Mines, Outer La Noscea (X:24.3, Y:6.4).
- [ ] Scholar — Sapsa Spawning Grounds, Western La Noscea (X:16, Y:17).

## A Relic Reborn — crafted weapon and materia
Buy the completed item or craft it; normal quality is allowed. It must have the exact two Grade III materia melds.
- [ ] Paladin — Aeolian Scimitar + 2 Battledance III.
- [ ] Warrior — Barbarian's Bardiche + 2 Battledance III.
- [ ] Dragoon — Champion's Lance + 2 Savage Aim III.
- [ ] Monk — Wildling's Cesti + 2 Savage Aim III.
- [ ] Ninja — Vamper's Knives + 2 Heavens' Eye III.
- [ ] Bard — Longarm's Composite Bow + 2 Heavens' Eye III.
- [ ] Black Mage — Sanguine Scepter + 2 Savage Might III.
- [ ] Summoner — Erudite's Picatrix of Casting + 2 Savage Might III.
- [ ] White Mage — Madman's Whispering Rod + 2 Quicktongue III.
- [ ] Scholar — Erudite's Picatrix of Healing + 2 Quicktongue III.

> Market Board listings may already contain materia. Inspect the item before buying and confirm both melds match exactly.

## A Relic Reborn — duty and hunt sequence
- [ ] As the relic job, enter **A Relic Reborn: The Chimera** at Coerthas Central Highlands (X:32.1, Y:7.2), defeat Dhorme Chimera, and return the Alumina Salts to Gerolt.
- [ ] Speak with Rowena in Mor Dhona; complete **Amdapor Keep** (normal, not Hard and not Lost City) for the Amdapor Glyph, then return it to Rowena and take the literature to Gerolt.
- [ ] With the unfinished weapon equipped, defeat the 24 stronghold enemies shown in the quest tracker: three named groups of eight in Zahar'ak, U'Ghamaro, Natalan, Sapsa, or Sylphlands according to job.
- [ ] Complete **A Relic Reborn: The Hydra** from the entrance at Eastern Thanalan's Halatali area with the unfinished weapon equipped.
- [ ] Complete **The Bowl of Embers (Hard)**, **The Howling Eye (Hard)**, and **The Navel (Hard)** in that order with the unfinished weapon equipped.
- [ ] Buy **Radz-at-Han Quenching Oil** from Auriana, Revenant's Toll (X:22.7, Y:6.6), for 15 Poetics and deliver it to Gerolt for the item-level 80 relic.

## Zenith — no quest required
- [ ] Buy 3 **Thavnairian Mist** from Auriana for 20 Poetics each. Paladin uses two on Curtana and one on Holy Shield.
- [ ] Unequip the relic, interact with the **Furnace**, Hyrstmill (X:30, Y:20), and create the item-level 90 Zenith.

## Up in Arms — all twelve Atma
Speak to Gerolt with Zenith equipped, then Jalzahn at Hyrstmill (X:29.5, Y:19.6). Any successful FATE in each zone can drop its Atma while any Zenith relic is equipped. Atma use normal inventory slots.
- [ ] Atma of the Lion — Outer La Noscea.
- [ ] Atma of the Water-bearer — Upper La Noscea.
- [ ] Atma of the Ram — Middle La Noscea.
- [ ] Atma of the Crab — Western La Noscea.
- [ ] Atma of the Fish — Lower La Noscea.
- [ ] Atma of the Bull — Eastern Thanalan.
- [ ] Atma of the Scales — Central Thanalan.
- [ ] Atma of the Twins — Western Thanalan.
- [ ] Atma of the Scorpion — Southern Thanalan.
- [ ] Atma of the Archer — North Shroud.
- [ ] Atma of the Goat — East Shroud.
- [ ] Atma of the Maiden — Central Shroud.
- [ ] Unequip Zenith and give it plus all twelve Atma to **Jalzahn**, North Shroud (X:29.5, Y:19.6).

> The quest moves to completed history after Jalzahn explains it, so the journal will not count Atma for you. A successful FATE is required; party membership and rating do not change the drop chance.`,
    references: [official("Zodiac base quest data", "https://ffxiv.consolegameswiki.com/wiki/Zodiac_Weapons/Quest"), official("Atma stage data", "https://ffxiv.consolegameswiki.com/wiki/Atma_Zodiac_Weapons/Quest")]
  },
  { slug: "zodiac-animus-books", parentSlug: "zodiac-weapons", type: "article", category: "Zodiac Walkthrough", title: "2. Animus — All Nine Books", summary: "Every enemy group, duty, FATE, levequest, NPC, coordinate, and chain-FATE warning for Trials of the Braves.", expansion: "A Realm Reborn", level: "50", audience: "Combat", tags: ["animus", "trials of the braves", "books", "FATEs"], imageUrl: "/guides/relics.svg", order: 20,
    content: `## Rules before starting
- [ ] Equip the Atma weapon and speak with **Jalzahn**, Hyrstmill (X:29.5, Y:19.6), then Rowena and **G'jusana**, Mor Dhona (X:22.9, Y:7.3).
- [ ] Unlock leves at Camp Bluefog, Whitebrim Front, and Saint Coinach's Find.
- [ ] Reserve 900 Poetics. G'jusana sells one book at a time for 100.

> Only one book can be owned. Buying another destroys the current book. Keep the matching Atma weapon equipped when an enemy dies, a FATE completes, or the final dungeon boss dies.

## Book of Skyfire I
### Enemies — defeat 3 of each
- [ ] Daring Harrier — Mor Dhona, Fogfens (16.9,16.4); 5th Cohort Vanguard — Mor Dhona, Castrum Centri (10.6,15.1); 4th Cohort Hoplomachus — Western Thanalan, Imperial Outpost (10.5,6); Basilisk — Northern Thanalan, Bluefog (22.8,22.9); Zanr'ak Pugilist — Southern Thanalan (19,25).
- [ ] Milkroot Cluster — East Shroud, Sylphlands (24.2,16.8); Giant Logger — Coerthas Central, Boulder Downs (13,25); Synthetic Doblyn — Outer La Noscea, U'Ghamaro (23,8); Shoalspine Sahagin — Western La Noscea, Sapsa (17,15); 2nd Cohort Hoplomachus — Eastern La Noscea, Agelyss Wise (25,21).
### Duties, FATEs, and leves
- [ ] Dungeons: Tam-Tara Deepcroft; Stone Vigil; Lost City of Amdapor.
- [ ] FATEs: Giant Seps — Coerthas Central (8.6,12); Make It Rain — Outer La Noscea (25,18); The Enmity of My Enemy — East Shroud (27,21.6), after triggering The Enemy of My Enemy via Mianne Thousandmalm (28.2,20.3).
- [ ] Leves: Necrologos: Pale Oblation — Rurubana, Camp Bluefog (22,29); An Imp Mobile — Lodille, Whitebrim (11.9,16.8); The Awry Salvages — Eidhart, Saint Coinach's Find (30,12).

## Book of Skyfire II
- [ ] Enemies x3: Raging Harrier—Mor Dhona Fogfens (17,17); Biast—Coerthas Boulder Downs (16,30); Natalan Boldwing—Natalan (33,18); Shoaltooth Sahagin—Sapsa (17,17); Shelfscale Reaver—Halfstone (13,17).
- [ ] Enemies x3: U'Ghamaro Golem—Outer La Noscea (27.5,7.3); Dullahan—North Shroud Proud Creek (22.5,20); Sylpheed Sigh—East Shroud (29,17); Zahar'ak Archer—Southern Thanalan (25,21); Tempered Gladiator—Zanr'ak (21.5,19.6).
- [ ] Dungeons: Brayflox's Longstop; Wanderer's Palace; Copperbell Mines (Hard).
- [ ] FATEs: Heroes of the 2nd—Southern Thanalan (21,16); Breaching South Tidegate—Western La Noscea (18,22), after Gauging South Tidegate; Air Supply—North Shroud (19,20).
- [ ] Leves: Don't Forget to Cry—Camp Bluefog; Yellow Is the New Black—Whitebrim; The Museum Is Closed—Saint Coinach's Find.

## Book of Netherfire I
- [ ] Enemies x3: Hexing Harrier—Mor Dhona (16,15); Gigas Bonze—Mor Dhona (27,9); Giant Lugger—Coerthas (13,27); Wild Hog—South Shroud (29,24); Sylpheed Screech—East Shroud (28,15).
- [ ] Enemies x3: U'Ghamaro Roundsman—Outer La Noscea (23,7); Shelfclaw Reaver—Western La Noscea (13,17); 2nd Cohort Laquearius—Eastern La Noscea (29,20); Zahar'ak Fortune-teller—Southern Thanalan (29,19); Tempered Orator—Zanr'ak (21,20).
- [ ] Dungeons: Sunken Temple of Qarn; Haukke Manor (Hard); Halatali (Hard).
- [ ] FATEs: Another Notch on the Torch—Mor Dhona (31,5); Everything's Better—East Shroud (23,14); Return to Cinder—Southern Thanalan (24,26).
- [ ] Leves: Circling the Ceruleum—Camp Bluefog; If You Put It That Way—Whitebrim; One Big Problem Solved—Saint Coinach's Find.

## Book of Skyfall I
- [ ] Enemies x3: Mudpuppy—Mor Dhona (14,11); Lake Cobra—Mor Dhona (26,12); Giant Reader—Coerthas (12,25); Shelfscale Sahagin—Halfstone (17,19); Sea Wasp—Halfstone (14,17).
- [ ] Enemies x3: U'Ghamaro Quarryman—Outer La Noscea (23,7); 2nd Cohort Eques—Eastern La Noscea (29,21); Magitek Vanguard—Northern Thanalan (17,17); Amalj'aa Lancer—Zanr'ak (20,20); Sylphlands Sentinel—East Shroud (20,10).
- [ ] Dungeons: Copperbell Mines; Dzemael Darkhold; Brayflox's Longstop (Hard).
- [ ] FATEs: Bellyful—Coerthas (34,14); The King's Justice—Western La Noscea (14,34); Quartz Coupling—Eastern Thanalan (26,24).
- [ ] Leves: Circling the Ceruleum—Camp Bluefog; Necrologos: Whispers of the Gem—Whitebrim; Go Home to Mama—Saint Coinach's Find.

## Book of Skyfall II
- [ ] Enemies x3: Gigas Bhikkhu—Mor Dhona (33,14); 5th Cohort Hoplomachus—Mor Dhona (12,12); Natalan Watchwolf—Coerthas (31,17); Sylph Bonnet—East Shroud (26,13); Ked—South Shroud (31.6,24.3).
- [ ] Enemies x3: 4th Cohort Laquearius—Western Thanalan (10,6); Iron Tortoise—Zanr'ak (16,24); Shelfeye Reaver—Halfstone (13,17); Sapsa Shelfscale—Sapsa (14,14); U'Ghamaro Bedesman—Outer La Noscea (23,8).
- [ ] Dungeons: Thousand Maws of Toto-Rak; Amdapor Keep; Haukke Manor (Hard).
- [ ] FATEs: Black and Nburu—Mor Dhona (16,14); Breaching North Tidegate—Western La Noscea (21,19), after Gauging North Tidegate; Breaking Dawn—East Shroud (32,14).
- [ ] Leves: Someone's in the Doghouse—Camp Bluefog; Get Off Our Lake—Saint Coinach's Find; The Area's a Bit Sketchy—Whitebrim.

## Book of Netherfall I
- [ ] Enemies x3: Amalj'aa Brigand—Zanr'ak (20,21); 4th Cohort Secutor—Western Thanalan (9,6); 5th Cohort Laquearius—Mor Dhona (12,12); Gigas Sozu—Mor Dhona (29,14); Snow Wolf—Coerthas (16,31.6).
- [ ] Enemies x3: Sapsa Shelfclaw—Western La Noscea (14,15); U'Ghamaro Priest—Outer La Noscea (22,6); Violet Screech—East Shroud (24,14); Ixali Windtalon—North Shroud (19,19); Lesser Kalong—South Shroud (29,23).
- [ ] Dungeons: Cutter's Cry; Pharos Sirius; Lost City of Amdapor.
- [ ] FATEs: Rude Awakening—North Shroud (22,20); The Ceruleum Road—Northern Thanalan (21,29), start via Wary Merchant at Camp Bluefog; The Four Winds—Coerthas (34,20).
- [ ] Leves: Got a Gut Feeling about This—Whitebrim; Subduing the Subprime—Camp Bluefog; Who Writes History—Saint Coinach's Find.

## Book of Skywind I
- [ ] Enemies x3: Hippogryph—Mor Dhona (33,11); 5th Cohort Eques—Mor Dhona (12,12); Natalan Windtalon—Coerthas (34,22); Sapsa Elbst—Western La Noscea (17,15); Trenchtooth Sahagin—Halfstone (20,20).
- [ ] Enemies x3: Elite Roundsman—Outer La Noscea (25,8); 2nd Cohort Secutor—Eastern La Noscea (25,21); Ahriman—Northern Thanalan (24,21); Amalj'aa Thaumaturge—Zanr'ak (18,19); Sylpheed Snarl—East Shroud (28,17).
- [ ] Dungeons: Sastasha; Aurum Vale; Halatali (Hard).
- [ ] FATEs: Surprise—Upper La Noscea (26,18), camp it because NPCs can die quickly; In Spite of It All—Central Shroud (11,18); Good to Be Bud—Mor Dhona (13,12).
- [ ] Leves: Subduing the Subprime—Camp Bluefog; Someone's Got a Big Mouth—Whitebrim; Big, Bad Idea—Saint Coinach's Find.

## Book of Skywind II
- [ ] Enemies x3: Gigas Shramana—Mor Dhona (28,13); 5th Cohort Signifer—Mor Dhona (10,13); Watchwolf—North Shroud (19,19); Dreamtoad—East Shroud (26,18); Zahar'ak Battle Drake—Southern Thanalan (30,19).
- [ ] Enemies x3: Amalj'aa Archer—Zanr'ak (20,22); 4th Cohort Signifer—Western Thanalan (11,7); Elite Priest—Outer La Noscea (24,7); Sapsa Shelftooth—Western La Noscea (15,15); Natalan Fogcaller—Coerthas (32,18 / 34,20 / 34,23).
- [ ] Dungeons: Haukke Manor; Copperbell Mines (Hard); Brayflox's Longstop (Hard).
- [ ] FATEs: Taken—Southern Thanalan (18,20); Tower of Power—Coerthas (10.5,28.6), start via House Haillenarte Guard; What Gored Before—South Shroud (32,25).
- [ ] Leves: Necrologos: Pale Oblation—Camp Bluefog; The Bloodhounds of Coerthas—Whitebrim; Put Your Stomp on It—Saint Coinach's Find.

## Book of Skyearth I
- [ ] Enemies x3: Violet Sigh—East Shroud (24,13); Ixali Boldwing—North Shroud (21,20); Amalj'aa Scavenger—Zanr'ak (20,21); Zahar'ak Pugilist—Southern Thanalan (23,21); Axolotl—Sapsa (14,15).
- [ ] Enemies x3: Elite Quarryman—Outer La Noscea (24,7); 2nd Cohort Signifer—Eastern La Noscea (30,20); Natalan Swiftbeak—Coerthas (31,17); 5th Cohort Secutor—Mor Dhona (10,13); Hapalit—Mor Dhona (30,5).
- [ ] Dungeons: Halatali; Amdapor Keep; Pharos Sirius.
- [ ] FATEs: The Taste of Fear—Coerthas (4.8,21.8); The Big Bagoly Theory—Eastern Thanalan lower level (30,25); Schism—Outer La Noscea (25,16), speak with Storm Private (23,16) and destroy crates before the boss.
- [ ] Leves: Don't Forget to Cry—Camp Bluefog; Necrologos: The Liminal Ones—Saint Coinach's Find; No Big Whoop—Whitebrim.

## Turn-in
- [ ] After all nine books, unequip the Atma weapon and select **Relic Weapon Atma Enhancement** with Jalzahn at Hyrstmill (29.5,19.6).

> If a required FATE is absent, clear nearby FATEs. Map limits and overlapping spawn areas can block it. Chain FATE prerequisites must be completed successfully.`,
    references: [official("Trials of the Braves overview and book sources", "https://ffxiv.consolegameswiki.com/wiki/Animus_Zodiac_Weapons/Quest")]
  },
  { slug: "zodiac-novus", parentSlug: "zodiac-weapons", type: "article", category: "Zodiac Walkthrough", title: "3. Novus — Alexandrite & Materia", summary: "Sphere Scroll unlock, all Alexandrite sources, materia rules, stat choices, and the completed Novus turn-in.", expansion: "A Realm Reborn", level: "50", audience: "Combat", tags: ["novus", "alexandrite", "materia", "sphere scroll"], imageUrl: "/guides/relics.svg", order: 30,
    content: `## Prepare
- [ ] Finish the Animus stage and keep the Animus weapon in inventory or Armoury Chest.
- [ ] Reserve 75 Poetics for three Superior Enchanted Ink.
- [ ] Unlock **Decipher** and **Dig** through **Treasures and Tribulations** from **H'loonh**, Wineport, Eastern La Noscea (X:21, Y:21).
- [ ] Plan for 75 Alexandrite and substantially more than 75 materia because failed infusions destroy materia.

## Create the Sphere Scroll
- [ ] Equip Animus and accept **Celestial Radiance** from **Jalzahn**, Hyrstmill, North Shroud (X:29.5, Y:19.6).
- [ ] Speak with **Mutamix Bubblypots** and **Hubairtin** at the Bonfire, Central Thanalan (X:23, Y:13).
- [ ] Speak with Rowena in Revenant's Toll, then buy 3 **Superior Enchanted Ink** from **Auriana (22.7,6.6)** for 25 Poetics each.
- [ ] Give the inks to Hubairtin for the weapon-specific Sphere Scroll; accept **Star Light, Star Bright**.

## Obtain 75 Alexandrite
- **Mysterious Maps:** 5 guaranteed Alexandrite each. Obtain one from the daily **Morbid Motivation** after its requested roulette, or buy one from Auriana for 75 Poetics. Decipher, travel to the map picture, use Dig, defeat the spawned enemies, and open the chest.
- **Allied Seals:** buy Alexandrite from a Hunt Billmaster for 50 Allied Seals each.
- **FATEs:** a random drop from a Gold-rated FATE with any Animus weapon equipped.

> Mysterious Maps are unique. You can keep one deciphered, one in normal inventory, and one undeciphered in the chocobo saddlebag. Only the map owner receives its five Alexandrite.

## Choose materia stats
- **Direct Hit:** Heavens' Eye.
- **Skill Speed:** Quickarm.
- **Critical Hit:** Savage Aim.
- **Piety:** Piety.
- **Determination:** Savage Might.
- **Spell Speed:** Quicktongue.
- **Tenacity:** Battledance.

The glamour remains the same regardless of stats, and later equipment makes these values obsolete. For a low-cost glamour relic, compare market prices and use two or three inexpensive stats instead of forcing the historical best-in-slot distribution.

## Infuse the scroll
- [ ] Carry the Sphere Scroll, one Alexandrite, and matching materia.
- [ ] Start with Grade I. A normal weapon uses eleven successful infusions of a stat tier before the next materia grade becomes available; Curtana/Holy Shield split their 75 points.
- [ ] Continue through higher grades until the scroll has 75 successful infusions.
- [ ] Watch the success chance. Failed binding destroys only the materia—Alexandrite is retained.
- [ ] Do not exceed a stat's weapon-specific cap; switch to another permitted secondary stat when the interface blocks further points.

## Finish Novus
- [ ] Put the Animus weapon in inventory or Armoury Chest and take the completed scroll to **Jalzahn (29.5,19.6)**.
- [ ] Select the Novus enhancement and verify the item-level 110 weapon is received.

## Troubleshooting
- **Higher-grade materia unavailable:** the prior grade's infusion tier is incomplete.
- **Alexandrite absent after map:** open the chest after killing every spawned enemy and keep a normal inventory slot free.
- **Jalzahn will not finish:** confirm the scroll belongs to that exact weapon and shows all 75 successful points.
- **Wrong stats chosen:** obtain a fresh Sphere Scroll, ask Jalzahn to transfer the Novus record, then use Hubairtin to remove and replace points.`,
    references: [official("Novus quest, infusion, and Alexandrite data", "https://ffxiv.consolegameswiki.com/wiki/Novus_Zodiac_Weapons/Quest")]
  },
  { slug: "zodiac-nexus", parentSlug: "zodiac-weapons", type: "article", category: "Zodiac Walkthrough", title: "4. Nexus — Complete Light Farm", summary: "Soulglazing, light values, efficient duty choices, progress messages, and the Nexus conversion.", expansion: "A Realm Reborn", level: "50", audience: "Combat", tags: ["nexus", "light", "soulglaze"], imageUrl: "/guides/relics.svg", order: 40,
    content: `## Soulglaze the Novus
- [ ] Equip Novus and accept **Mmmmmm, Soulglazed Relics** from **Jalzahn**, Hyrstmill (X:29.5, Y:19.6).
- [ ] Complete the conversation with Gerolt/Jalzahn until the weapon receives its soulglaze.
- [ ] Keep the Novus equipped when the final boss or duty objective is completed. Changing to the relic after the clear is too late.

## Light target
The weapon needs **2,000 light**. Qualifying duties award a base value that can temporarily receive a bonus:
- **Feeble:** 8.
- **Gentle:** 16.
- **Bright:** 32.
- **Brilliant:** 48.
- **Blinding:** 96.
- **Newborn Star:** 128.

Bonuses rotate among duties on a roughly two-hour schedule. A fast duty with a bonus can outperform a higher-value duty with long queues or cutscenes.

## Practical solo route
- [ ] Open Duty Finder settings and enable **Unrestricted Party** for old content.
- [ ] Test a fast ARR trial or dungeon and read the light message after completion.
- [ ] If its current result is boosted, repeat it until the bonus changes; otherwise test another short qualifying duty.
- [ ] Keep Novus equipped for the final enemy. For jobs that cannot solo comfortably, use a party or a different qualifying duty.
- [ ] Ask Jalzahn to inspect the weapon periodically. The quest journal does not show an exact numeric total.

## Progress descriptions
Jalzahn's inspection advances through descriptive tiers rather than showing a number. Continue until the final message indicates the soul is fully attuned. Do not stop at a nearly complete description.

## Convert to Nexus
- [ ] With the fully attuned Novus available, return to Jalzahn at Hyrstmill.
- [ ] Unequip when the enhancement menu requires it and complete the conversion to item-level 115 Nexus.
- [ ] Confirm the next quest is available before discarding any appearance copy.

## Troubleshooting
- **No light message:** the weapon was not equipped at completion, was not soulglazed, or the activity is not qualifying.
- **Progress feels inconsistent:** light bonuses rotate; the same duty can award a different descriptor later.
- **Inspection cannot find weapon:** move it from a retainer/glamour dresser into inventory or Armoury Chest.`,
    references: [official("Nexus soulglaze and light data", "https://ffxiv.consolegameswiki.com/wiki/Nexus_Zodiac_Weapons/Quest")]
  },
  { slug: "zodiac-braves", parentSlug: "zodiac-weapons", type: "article", category: "Zodiac Walkthrough", title: "5. Zodiac Braves — Four Quest Ledger", summary: "All four repeatable item quests, dungeon drops, purchased materials, crafted turn-ins, and cost checklist.", expansion: "A Realm Reborn", level: "50", audience: "Combat", tags: ["zodiac braves", "dungeon drops", "crafted items"], imageUrl: "/guides/relics.svg", order: 50,
    content: `## Before accepting
- [ ] Finish Nexus and accept **Wherefore Art Thou, Zodiac** from Jalzahn/Gerolt in Hyrstmill.
- [ ] Reserve approximately **400,000 gil**, **80,000 Grand Company seals**, and **800 Poetics** for the fixed quest purchases.
- [ ] Unlock every ARR dungeon named below.
- [ ] Arrange access to the eight HQ crafted quest items—craft them or buy them on the Market Board.

You may hold all four quests together. Each dungeon item is a random personal quest drop from the final boss, so a clear may need repeating.

## A Ponze of Flesh — Papana
Accept from **Papana**, Revenant's Toll (X:22.9, Y:7.3).
- [ ] Dzemael Darkhold — Horn of the Beast.
- [ ] Brayflox's Longstop (Hard) — Gobmachine Bangplate.
- [ ] Halatali (Hard) — Narasimha Hide.
- [ ] Snowcloak — Sickle Fang.
- [ ] HQ **Perfect Firewood** (Carpenter) and HQ **Furnace Ring** (Goldsmith).
- [ ] **Bronze Lake Crystal**, 100,000 gil from the Junkmonger at Jijiroon's Trading Post, Upper La Noscea (26,26).

## Labor of Love — Guiding Star
Accept from **Guiding Star**, Revenant's Toll (X:21, Y:6).
- [ ] The Aurum Vale — Vale Bubo.
- [ ] Haukke Manor (Hard) — Voidweave.
- [ ] The Lost City of Amdapor — Amdapor Vellum.
- [ ] Sastasha (Hard) — Indigo Pearl.
- [ ] HQ **Perfect Pestle** (Blacksmith) and HQ **Perfect Mortar** (Armorer).
- [ ] **Allagan Resin**, 100,000 gil from the Merchant & Mender in Forgotten Springs, Southern Thanalan (15,29).

## A Treasured Mother — Brangwine
Accept from **Brangwine**, Revenant's Toll (X:22, Y:6.7).
- [ ] Amdapor Keep — Lost Treasure of Amdapor.
- [ ] Pharos Sirius — Lost Treasure of Pharos Sirius.
- [ ] The Tam-Tara Deepcroft (Hard) — Lost Treasure of the Tam-Tara Deepcroft.
- [ ] The Stone Vigil (Hard) — Lost Treasure of the Stone Vigil.
- [ ] HQ **Perfect Cloth** (Weaver) and HQ **Tailor-made Eel Pie** (Culinarian).
- [ ] **Brass Kettle**, 100,000 gil from the Tool Supplier & Mender in Hyrstmill, North Shroud (29,19).

## Method in His Malice — Adkin
Accept from **Adkin**, the Bonfire, Central Thanalan (X:23, Y:13).
- [ ] The Wanderer's Palace — Tonberry King Blood.
- [ ] Copperbell Mines (Hard) — Royal Gigant Blood.
- [ ] Hullbreaker Isle — Kraken Blood.
- [ ] The Sunken Temple of Qarn (Hard) — Vicegerent Blood.
- [ ] HQ **Perfect Vellum** (Leatherworker) and HQ **Perfect Pounce** (Alchemist).
- [ ] **Furite Sand**, 100,000 gil from the Merchant & Mender at Whitebrim Front, Coerthas Central Highlands (13,16).

> The quest tracker is authoritative for the item name and its duty. Check the item's acquisition text before queueing; several quest names and dungeon variants are easy to confuse.

## Shared purchased items
- [ ] Buy 4 **Bombard Cores**, one per quest, for 20,000 Company Seals each from your Grand Company quartermaster. Second Lieutenant rank is required.
- [ ] Buy 4 **Sacred Spring Waters**, one per quest, for 200 Poetics each from Auriana in Mor Dhona after Wherefore Art Thou, Zodiac.

The fixed total is 80,000 Company Seals, 800 Poetics, and 400,000 gil, before crafting/Market Board costs.

## Efficient clear order
- [ ] Accept all four quests first so every relevant dungeon can drop its item.
- [ ] Sort the sixteen duties by Duty Finder list and clear unrestricted where possible.
- [ ] After each final boss, verify the quest item appeared before marking it complete.
- [ ] Purchase/craft only the items currently shown by each active quest.
- [ ] Turn in all four completed quests, then return to Gerolt/Jalzahn with Nexus for the Zodiac Braves weapon.

## Troubleshooting
- **Item did not drop:** it is random; keep the correct quest active and repeat the exact normal/Hard dungeon.
- **Craft rejected:** it must be the exact item and **High Quality**.
- **Vendor material missing:** check the required currency/vendor category and confirm the related quest is active.
- **Weapon cannot be handed in:** remove it from equipment and make sure all four quest rewards were collected.`,
    references: [official("Zodiac Braves four-quest requirements", "https://ffxiv.consolegameswiki.com/wiki/Zodiac_Braves_Weapons/Quest")]
  },
  { slug: "zodiac-zeta", parentSlug: "zodiac-weapons", type: "article", category: "Zodiac Walkthrough", title: "6. Zeta — Twelve Mahatmas & Replicas", summary: "Mahatma purchase order, light completion, final awakening, replica unlocks, and safe storage rules.", expansion: "A Realm Reborn", level: "50", audience: "Combat", tags: ["zeta", "mahatma", "replica"], imageUrl: "/guides/relics.svg", order: 60,
    content: `## Unlock the final stage
- [ ] Finish the Zodiac Braves weapon and complete its follow-up conversations in Hyrstmill.
- [ ] Accept **Rise and Shine**, then speak with **Remon**, Swiftperch, Western La Noscea (X:34.3, Y:31.7).
- [ ] Keep at least 600 Poetics available for twelve Mahatmas at 50 Poetics each.

## Mahatma rules
Only one Mahatma can be attached at a time. Each needs **40 light** and uses the same qualifying-duty principle as Nexus.
- [ ] Buy and attach the first Mahatma from Remon.
- [ ] Run short qualifying duties with the Zodiac weapon equipped at final completion.
- [ ] Inspect the Mahatma with Remon. Continue until it is fully awakened.
- [ ] Exchange for the next Mahatma and repeat until all twelve are complete.

## Twelve-Mahatma tracker
- [ ] Mahatma of the Maiden.
- [ ] Mahatma of the Scorpion.
- [ ] Mahatma of the Water-bearer.
- [ ] Mahatma of the Goat.
- [ ] Mahatma of the Bull.
- [ ] Mahatma of the Ram.
- [ ] Mahatma of the Twins.
- [ ] Mahatma of the Lion.
- [ ] Mahatma of the Fish.
- [ ] Mahatma of the Archer.
- [ ] Mahatma of the Scales.
- [ ] Mahatma of the Crab.

> Remon's menu controls the actual order and attachment. Use this checklist to count completions, but always confirm the current Mahatma name in the weapon status before farming.

## Efficient light
Use unrestricted ARR duties that finish quickly for your job. Test a duty once to see its current light result; temporary bonuses make repetition efficient. The Zodiac weapon must remain equipped through the final boss.

## Final awakening
- [ ] After the twelfth Mahatma reports complete, return to Remon and finish his dialogue.
- [ ] Return to **Jalzahn**, Hyrstmill (X:29.5, Y:19.6), with the weapon unequipped when requested.
- [ ] Complete the final quest sequence and verify the item-level 135 Zodiac Zeta is in inventory/Armoury Chest.

## Replicas and safe disposal
- [ ] Complete Zeta and its replica-unlock conversation before discarding any stage.
- [ ] Buy replicas from the restoration node/NPC associated with Gerolt's Hyrstmill workshop.
- [ ] Confirm every desired appearance is listed. Glamour dresser storage and replicas are safer than retaining the functional relic solely for appearance.
- [ ] A completed Zeta may be surrendered during the Anima introduction to skip its six-crystal stage. This destroys the original functional Zeta, so confirm replicas first.

## Troubleshooting
- **No Mahatma light:** verify a Mahatma is attached and the Zodiac weapon is equipped at completion.
- **Remon offers nothing new:** the current Mahatma may not be fully awakened, or the preceding quest dialogue is incomplete.
- **Replica missing:** finish the Zeta quest and replica unlock on that character; owning only an intermediate stage is not enough.`,
    references: [official("Zeta Mahatma and replica progression", "https://ffxiv.consolegameswiki.com/wiki/Zodiac_Zeta_Weapons/Quest")]
  },

  { slug: "anima-opening-stages", parentSlug: "anima-weapons", type: "article", category: "Anima Walkthrough", title: "1–4. Animated, Awoken, Reconditioned Setup", summary: "Crystals or Zeta, the ten-dungeon route, unidentified materials, Aether Oils, and precise hand-ins.", expansion: "Heavensward", level: "60", audience: "Combat", tags: ["animated", "awoken", "unidentifiable", "aether oil"], imageUrl: "/guides/relics.svg", order: 20,
    content: `## Animated weapon
- [ ] Complete **An Unexpected Proposal** from Rowena in Idyllshire and meet Ardashir in Azys Lla.
- [ ] Gather one luminous crystal from FATEs in each Heavensward field zone, or surrender a completed Zodiac Zeta for Astral and Umbral Nodules. Zeta is destroyed; unlock replicas first.
- [ ] Open the weapon coffer/accept the reward on the intended job and keep a spare weapon for exchanges.

## Awoken weapon — ten dungeons in order
Equip the Animated weapon before each final boss: Snowcloak; Sastasha (Hard); Sunken Temple of Qarn (Hard); Keeper of the Lake; Wanderer's Palace (Hard); Amdapor Keep (Hard); Dusk Vigil; Sohm Al; Aery; Vault. Unsynced clears work. Complete the follow-up enemies and dialogue Ardashir lists.

## Coming into Its Own
Deliver four exchange packages to Cristiana in Revenant's Toll. Each needs 10 matching Unidentifiable items plus four **HQ** crafted items: Adamantite Francesca, Titanium Alloy Mirror, Dispelling Arrow, and Kingcake. Poetics and older allied-society currency are the safest repeatable sources. Verify HQ before buying.

## Hyperconductive
Buy or earn 5 Aether Oils. The direct cost is 350 Poetics each. Turn in with the current weapon unequipped when prompted.`, references: [official("Anima weapon quest route", "https://ffxiv.consolegameswiki.com/wiki/Anima_Weapons/Quest")] },
  { slug: "anima-sand-light-lux", parentSlug: "anima-weapons", type: "article", category: "Anima Walkthrough", title: "5–8. Crystal Sand, Light, Singing Clusters & Lux", summary: "Optimize stats, farm density, finish the victory lap, and unlock replicas safely.", expansion: "Heavensward", level: "60", audience: "Combat", tags: ["crystal sand", "umbrite", "aetheric density", "lux"], imageUrl: "/guides/relics.svg", order: 30,
    content: `## Crystal Sand and Umbrite
- [ ] Accept **A Dream Fulfilled**, obtain the Enhanced Anima Glass, and choose repeatable Crystal Sand exchanges from Ulan.
- [ ] Buy Umbrite with Poetics and convert one Sand plus one Umbrite into treated crystal sand.
- [ ] Allocate the displayed points to desired substats. Do not confirm a distribution copied from another job without checking its current stat caps.

## Aetheric density
Complete **Born Again Anima**, then run qualifying duties with the weapon equipped at completion. Use the glass to check progress. Alexander Savage floors and short unrestricted duties are common choices; temporary bonus windows can change the fastest route.

## Singing Clusters and victory lap
- [ ] Obtain 50 Singing Clusters through Poetics and the repeatable daily/weekly quests.
- [ ] Complete the three required level-60 trials with the weapon equipped.
- [ ] Finish the final duty sequence in **Best Friends Forever** and return to Ardashir/Gerolt for Lux.

## Replicas and additional jobs
Finish the Lux dialogue before checking the restoration node for replicas. A new job repeats the weapon-specific steps but not every one-time story unlock. Keep the active weapon and a spare equipped weapon separate so an exchange never appears to be missing.`, references: [official("Anima density and Lux stages", "https://ffxiv.consolegameswiki.com/wiki/Anima_Weapons/Quest")] },

  { slug: "eurekan-anemos-pagos", parentSlug: "eurekan-weapons", type: "article", category: "Eurekan Walkthrough", title: "1–2. Anemos & Pagos Weapons", summary: "Protean/Anemos totals, Pazuzu, kettle light, Frosted crystals, Pagos crystals, and Louhi.", expansion: "Stormblood", level: "70", audience: "Combat", tags: ["anemos", "pagos", "kettle"], imageUrl: "/guides/field-operations.svg", order: 20,
    content: `## Anemos
- [ ] Retrieve the job's Antiquated weapon and complete the Eureka introduction.
- [ ] Exchange Anemos Crystals from notorious monsters into Protean Crystals as needed.
- [ ] Upgrade with 100 Protean, then 400, then 800 Protean Crystals.
- [ ] Obtain 3 Pazuzu's Feathers from **Wail in the Willows** or the zone exchange and finish the Anemos weapon.

## Pagos
- [ ] Reach elemental level 25 and complete Gerolt's kettle quest.
- [ ] Earn vitiated aether from appropriate enemies/NMs and convert full charges at the Crystal Forge (X:6.0, Y:21.5). The kettle holds nine; convert before overcapping.
- [ ] Use 5 Frosted Protean Crystals for Pagos, then 10 Frosted plus 500 Pagos Crystals for Pagos +1.
- [ ] Use 16 Frosted plus 5 Louhi's Ice for the Elemental weapon. Louhi's Ice comes from Louhi on Ice or the birdwatcher exchange.

The current relic must be in inventory for Gerolt's upgrade option. Elemental story gates and weapon upgrades are separate; complete both before expecting the next zone.`, references: [official("Eurekan weapon totals", "https://ffxiv.consolegameswiki.com/wiki/Eurekan_Weapons")] },
  { slug: "eurekan-pyros-hydatos", parentSlug: "eurekan-weapons", type: "article", category: "Eurekan Walkthrough", title: "3–4. Pyros, Hydatos, Stats & Physeos", summary: "Logos registrations, boss materials, substat rolls, Arsenal fragments, and final replicas.", expansion: "Stormblood", level: "70", audience: "Combat", tags: ["pyros", "hydatos", "logos", "physeos"], imageUrl: "/guides/field-operations.svg", order: 30,
    content: `## Pyros
- [ ] Appraise logograms with Drake and combine mnemes at the Logos Manipulator.
- [ ] Register the number of unique Logos Actions displayed by Gerolt for each stage; merely owning logograms is not registration.
- [ ] Spend Pyros Crystals on Elemental +1 and +2, then add 5 Penthesilea's Flames for the Pyros weapon. Flames come from **Lost Epic** or exchange.
- [ ] Use additional light/crystals only if pursuing optional substat rolls; verify the desired distribution before replacing a roll.

## Hydatos and Physeos
- [ ] Gather Hydatos Crystals through notorious monsters and 5 Crystalline Scales from Provenance Watcher or exchange.
- [ ] Upgrade through Hydatos, Hydatos +1, and Eureka.
- [ ] Complete organized Baldesion Arsenal runs for 100 Eureka Fragments and exchange them for Physeos, which adds elemental bonuses inside Eureka.

Finish each zone's story and Gerolt step. If an upgrade is absent, check the immediately previous weapon, registered Logos count, and boss-material quantity rather than farming more generic crystals.`, references: [official("Eurekan weapon totals", "https://ffxiv.consolegameswiki.com/wiki/Eurekan_Weapons"), official("Official Eureka guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/eureka/")] },

  { slug: "resistance-memory-stages", parentSlug: "resistance-weapons", type: "article", category: "Resistance Walkthrough", title: "1–3. Base, Memories & Recollection", summary: "Thavnairian Scalepowder, three memory colors, six Bitter Memories, and every alternate source.", expansion: "Shadowbringers", level: "80", audience: "Combat", tags: ["memories", "recollection", "bozja"], imageUrl: "/guides/field-operations.svg", order: 20,
    content: `## Base Resistance weapon
- [ ] Complete the Ivalice raids, **Hail to the Queen**, and the Gangos introduction.
- [ ] Buy 4 Thavnairian Scalepowders from Auriana in Revenant's Toll for 250 Poetics each and deliver them during **Resistance Is (Not) Futile**.

## Augmented Resistance
Accept **For Want of a Memory** and collect 20 Tortured, 20 Sorrowful, and 20 Harrowing Memories. Qualifying Heavensward FATE zones provide guaranteed colors on gold credit; Bozjan enemies can also drop them. The quest may be farmed on another job, but the intended weapon is required for the hand-in.

## Recollection
Accept **The Will to Resist** and obtain 6 Bitter Memories from level-60 dungeons, Duty Roulette: Leveling's daily reward, or qualifying Bozjan sources. Equip/unequip exactly as Zlatan requests. Repeat weapons skip completed one-time story gates but still require their own memories.`, references: [official("Resistance weapon stages", "https://ffxiv.consolegameswiki.com/wiki/Resistance_Weapons")] },
  { slug: "resistance-raids-zadnor", parentSlug: "resistance-weapons", type: "article", category: "Resistance Walkthrough", title: "4–6. Raid Memories, Timeworn Artifacts & Blade's", summary: "One-time raid collections, Delubrum artifacts, Zadnor emotions, stat allocation, and replicas.", expansion: "Shadowbringers", level: "80", audience: "Combat", tags: ["delubrum", "zadnor", "timeworn", "raw emotions"], imageUrl: "/guides/field-operations.svg", order: 30,
    content: `## Law's Order prerequisites
- [ ] Complete Castrum Lacus Litore and the Gangos story.
- [ ] Finish the one-time **Change of Arms** collection and its alliance-raid/critical-engagement memory requirements before repeating later weapons.
- [ ] For **The Resistance Remembers**, collect the displayed 18-and-18 memories from specified Stormblood raids/FATE zones. This gate is completed once per character.

## Timeworn Artifacts
Collect 15 Timeworn Artifacts for each weapon. Delubrum Reginae is the direct repeatable route; Palace of the Dead is an alternate chance-based route. Keep the quest active before entry and bring an essence/lost actions so the party is not carrying an empty loadout.

## Zadnor and Blade's
- [ ] Complete the one-time Zadnor story and its three pairs of 30 regional items from skirmishes/critical engagements or specified raids.
- [ ] Collect 15 Raw Emotions for each final weapon from Dalriada, Delubrum Reginae, specified level-70 dungeons, or other listed sources.
- [ ] Allocate final substats with the quest interface, confirm the Blade's weapon, and complete replica dialogue before discarding appearances.

One-time tasks and per-weapon tasks coexist. If a repeat quest seems to demand an old collection again, verify which earlier quest remains unfinished in the journal.`, references: [official("Resistance weapon material route", "https://ffxiv.consolegameswiki.com/wiki/Resistance_Weapons")] },

  { slug: "manderville-four-stages", parentSlug: "manderville-weapons", type: "article", category: "Manderville Walkthrough", title: "All Four Weapons, Stats & Replicas", summary: "Exact prerequisite chain, 6,000-Poetics total, job repeats, stat selection, and safe glamour handling.", expansion: "Endwalker", level: "90", audience: "Combat", tags: ["manderville", "amazing", "majestic", "relic"], imageUrl: "/guides/relics.svg", order: 20,
    content: `## Prerequisite
Complete the Hildibrand adventures through Endwalker's **The Imperfect Gentleman**, then accept **Make It a Manderville** in Radz-at-Han. Each released weapon stage requires the next Hildibrand story segment; a missing relic quest usually means that comic sidequest chain is behind.

## Four exchanges per job
- [ ] Manderville: buy 3 Manderium Meteorites for 500 Poetics each.
- [ ] Amazing Manderville: buy 3 Complementary Chondrites for 500 Poetics each.
- [ ] Majestic Manderville: buy 3 Amplifying Achondrites for 500 Poetics each and choose the displayed substats.
- [ ] Mandervillous: buy 3 Cosmic Crystallites for 500 Poetics each and confirm final stats.

Total: **6,000 Poetics per completed weapon**. Materials are job-independent, but the active repeat quest and weapon hand-in are job-specific. Buy only the material for the active stage.

## Hand-in and replicas
Keep the current stage in inventory and equip a spare weapon before talking to Gerolt/Godbert. Confirm the final stat screen rather than assuming a copied distribution fits every job. Finish the stage dialogue to unlock its replica vendor entry before discarding an appearance.`, references: [official("Manderville weapon questline", "https://ffxiv.consolegameswiki.com/wiki/Manderville_Weapons")] },

  { slug: "phantom-paste-demiatma", parentSlug: "phantom-weapons", type: "article", category: "Phantom Walkthrough", title: "Paste, Demiatma & Dispeller Farming", summary: "Quest activation rules, qualifying duties, South/North Horn sources, exclusions, and repeat-job planning.", expansion: "Dawntrail", level: "100", audience: "Combat", tags: ["phantom paste", "demiatma", "dispeller"], imageUrl: "/guides/field-operations.svg", order: 20,
    content: `## Quest-gated drops
- [ ] Accept the weapon's current repeatable quest before farming. Drops and duty credit may not exist beforehand.
- [ ] For Phantom Obscurum paste, run the exact listed qualifying duties/roulette while the quest is active; the relic job generally does not need to run every eligible duty unless the objective says so.
- [ ] For Demiatma, farm the named South Horn FATEs/critical encounters or the listed alternate duties until each displayed set is complete.
- [ ] For Phantom Dispellers γ, farm North Horn FATEs/critical encounters or Normal Raid roulette until 100 are obtained.

Forked Tower: Blood and Forked Tower: Magic do **not** award the ordinary Horn dispeller objective. Do not infer that harder content automatically counts.

## Repeat weapons
Finish one weapon far enough to expose all account-wide story and vendor gates, then accept the repeat quest on the next job. Keep quest inventory space open and label which job owns each active weapon. If cancellation is blocked, speak with Lydirceil instead of trying to abandon it from the journal.`, references: [official("Current Phantom weapon stages", "https://ffxiv.consolegameswiki.com/wiki?curid=273362"), official("Official patch notes", "https://na.finalfantasyxiv.com/lodestone/special/patchnote_log/")] },

  { slug: "custom-deliveries-crafting", parentSlug: "custom-deliveries", type: "article", category: "Custom Deliveries", title: "Crafting Deliveries — Materials, Recipes & Quality", summary: "A complete six-craft workflow using client suppliers, Special Recipes, collectability tiers, and reliable rotations.", expansion: "Multiple", level: "60–100", audience: "Crafting", tags: ["custom deliveries", "crafting", "collectability"], imageUrl: "/guides/custom-deliveries-route.svg", order: 20,
    content: `## Prepare the request
- [ ] Open Timers → Custom Deliveries and select the client before buying anything.
- [ ] Record the exact requested item, minimum and higher collectability tiers, bonus icon, remaining client deliveries, and global allowance.
- [ ] Buy the client-specific base material from the nearby material supplier. It is intentionally inexpensive; a similarly named market item will not substitute.

## Craft one test item
- [ ] Open Crafting Log → Special Recipes → Custom Deliveries and choose the active client/item.
- [ ] Use Trial Synthesis with the exact class/gear if the recipe is not trivial.
- [ ] Craft **one** real item, then compare its rating with the Timers reward tiers before making the other five.
- [ ] Use food/medicine or a safer rotation if one failed quality action could drop the item below the intended tier.

Custom-delivery crafts are collectables: there is no separate HQ checkbox. Quality actions raise collectability; the item is accepted only at or above the displayed minimum. Do not use Collectable Synthesis as an old guide may instruct—the recipe itself produces the collectable.

## Efficient weekly batch
Make six only after the test succeeds. If another client has a starred bonus and this client is already rank 5, compare its scrip reward before spending allowances. Experience does not increase between every collectability point; aim for the highest displayed reward tier, not an unnecessarily perfect bar.

## Troubleshooting
- **Recipe absent:** client unlock or request not active, wrong crafting class, or looking outside Special Recipes.
- **Material rejected:** bought another client's similarly named material.
- **Cannot deliver:** below minimum rating, class below requirement, client already received six, or all twelve allowances are spent.
- **Macro fails:** gear/CP differs from the macro's assumptions; test manually and adjust before batching.`, references: [official("Official Custom Delivery recipes", "https://na.finalfantasyxiv.com/lodestone/playguide/db/recipe/?category2=1&category3=c6"), official("Custom Delivery rules", "https://ffxiv.consolegameswiki.com/wiki/Custom_Deliveries")] },
  { slug: "custom-deliveries-gathering", parentSlug: "custom-deliveries", type: "article", category: "Custom Deliveries", title: "Gathering & Fishing Deliveries", summary: "Exact miner, botanist, and fisher collection loops, appraisal priorities, bait rules, and rating troubleshooting.", expansion: "Multiple", level: "60–100", audience: "Gathering", tags: ["custom deliveries", "gathering", "fishing"], imageUrl: "/guides/custom-deliveries-route.svg", order: 30,
    content: `## Miner and botanist
- [ ] Select the client's item in Timers and open its gathering location from the item entry.
- [ ] Activate Collector's Glove/collectable mode where the current action set requires it, then use appraisal actions to reach a displayed reward tier before Collect.
- [ ] Gather one sample first. If GP cost is too high for six, use a reliable lower tier or wait for cordial recovery rather than collecting invalid items.

## Fisher
- [ ] Read the exact fishing hole in Timers, enable **Collect**, and use the named bait. **Metal Spinner** is the preferred reusable bait for many custom-delivery fish when the entry permits it.
- [ ] Fish size becomes collectability. Patience and the correct Precision/Powerful Hookset can improve consistency, but tug strength alone may identify several fish.
- [ ] Keep Collect enabled until six valid fish are secured; ordinary non-collectable catches cannot be converted afterward.

Gathered items do not have an HQ requirement. The collectability number is the only quality gate. A gold star increases the reward for that week's requested category.

## Troubleshooting
- **Node absent:** wrong gatherer, wrong expansion zone, or selected a similarly named item rather than the client's current request.
- **Fish arrives as normal item:** Collect was off when hooked.
- **Delivery rejected:** rating is below minimum or belongs to another client/request cycle.
- **Low experience:** the job is at/above the request's useful level range; choose a newer client.`, references: [official("Custom Delivery rules and fishing", "https://ffxiv.consolegameswiki.com/wiki/Custom_Deliveries")] },
  { slug: "custom-deliveries-weekly-plan", parentSlug: "custom-deliveries", type: "article", category: "Custom Deliveries", title: "Weekly Allowances, Rank Timing & Reward Plan", summary: "Plan all twelve deliveries, rank two clients in parallel, use bonuses, and know when glamour and final rewards unlock.", expansion: "Multiple", level: "60–100", audience: "Crafting & Gathering", tags: ["weekly", "allowances", "satisfaction"], imageUrl: "/guides/custom-deliveries-route.svg", order: 40,
    content: `## Weekly limits
- **12 total deliveries** per week across all clients.
- **6 maximum per client** per week.
- Reset is Tuesday at 12:00 a.m. Pacific; unused allowances do not carry over.

## Satisfaction timing
A new client needs 3 deliveries for rank 2, then 6 deliveries for each later rank. With the six-per-client cap, reaching rank 5 takes at least four weekly resets. Rank stories do not consume allowances; complete them immediately so the next deliveries count toward the new bar.

## Practical plan
- Story first: give six to one unfinished client and six to a second unfinished client each week.
- Experience first: use the newest eligible client on the job being leveled.
- Scrip first: compare gold-star bonuses and top-tier ratings before crafting.
- At rank 5, most clients expose a shirt icon for glamour customization; use glamour prisms and obey normal race/gender/equipment restrictions.

At lower levels, rewards include experience and the appropriate scrip currency. At cap, current clients provide endgame scrips; older clients remain useful for story, achievements, and easy weekly currency.`, references: [official("Complete client and allowance table", "https://ffxiv.consolegameswiki.com/wiki/Custom_Deliveries")] },

  { slug: "eureka-logos-gear", parentSlug: "eureka-field-guide", type: "article", category: "Eureka Systems", title: "Logos Actions, Elemental Armor & NM Preparation", summary: "Build Logos loadouts, unlock elemental gear, prepare efficient NM trains, and avoid expensive action mistakes.", expansion: "Stormblood", level: "70", audience: "Combat", tags: ["logos actions", "elemental armor", "notorious monsters"], imageUrl: "/guides/field-operations.svg", order: 20,
    content: `## Logos workflow
Farm or buy logograms, have Drake appraise them into mnemes, then combine recipes at the Logos Manipulator. Registering a new action advances Pyros weapon and armor requirements; merely carrying an appraised mnemonic does not. Loaded actions are consumable when replaced or when the instance rules remove them.

## Loadout roles
- Solo: sustain/defense plus damage.
- NM train: strong essence plus contribution-friendly damage or party support.
- Baldesion Arsenal: exactly the actions assigned by the organizer, including required sacrifice/reraise coverage.

## Elemental armor
Unlock the Pyros armor vendor through the required number of registered Logos Actions and exchange zone crystals for the job's set. Hydatos upgrades add elemental bonuses used inside Eureka. This armor is separate from the Eurekan weapon and is most valuable for Eureka/Arsenal farming and glamour.

## NM preparation
Use an instance tracker, join a party, record pull times, and spawn only enemies associated with the intended NM. Weather/time requirements can prevent a spawn even after sufficient kills. Never pull early because another player may be changing jobs or crossing a dangerous route.`, references: [official("Official Eureka guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/eureka/")] },
  { slug: "eureka-baldesion-arsenal", parentSlug: "eureka-field-guide", type: "article", category: "Eureka Systems", title: "Baldesion Arsenal Entry & Run Checklist", summary: "Portal rules, group preparation, restricted resurrection, support FATE timing, and fragment rewards.", expansion: "Stormblood", level: "70", audience: "Combat", tags: ["baldesion arsenal", "support fate", "eureka fragments"], imageUrl: "/guides/field-operations.svg", order: 30,
    content: `## Before the run
- [ ] Finish Hydatos story, reach elemental level 60, and unlock the Arsenal entry system.
- [ ] Join an organized community run; use its assigned portal, party, voice channel, and Logos loadout.
- [ ] Bring Eurekan Potions, food, repaired gear, elemental armor if available, and requested reraiser/sacrifice tools.

Resurrection is heavily restricted. Do not return after death without organizer instruction and never take an unassigned portal. Groups coordinate the support FATE outside the Arsenal to open/progress the internal run.

## Entry sequence and portals
Defeat **Ovni** with gold participation to receive Aetherially Primed. Unstable blue nodes appear first and are normally assigned by an organized run. Stable red nodes appear later for remaining assigned players. Taking an unassigned portal can remove a registered participant from the run, so wait for the organizer to call the portal and party.

The initial raid has up to 48 entrants. Eight additional players can join after the internal groups activate the elemental-room controls and the outside support group completes **The Baldesion Arsenal: Expedition Support**.

## Shared Logos responsibilities
| Responsibility | Typical action |
| --- | --- |
| Personal recovery | Spirit of the Remembered before dangerous progression |
| Trap detection | Perception L used only by assigned scouts |
| Emergency resurrection | Sacrifice L with the run's designated recovery plan |
| Raid damage | Bravery L and appropriate Wisdom effects |
| Enemy control | Dispel, Death, Feint, Paralyze, or organizer-specified utility |

Bring multiple prepared plates if the organizer calls for swaps. Do not trigger a detected trap, open a room, or cross an uncleared threshold. Traps can kill nearby players as well as the person who activates them.

## Boss and progression order
| Encounter | Core check |
| --- | --- |
| Art and Owain | Split groups, elemental spear rules, acceleration/bomb discipline, and synchronized kills |
| Raiden | Tank positioning, room-wide cleaves, rotating attacks, and trap-safe entry |
| Absolute Virtue | Elemental-room controls and the outside support FATE remove its lethal protection |
| Proto Ozma | Platform assignments, meteor placement, black-hole transitions, acceleration bombs, and disciplined movement |

The raid leader's platform and meteor assignments override a generic diagram. On Proto Ozma, never move a meteor through another platform and stop all movement/actions when Acceleration Bomb resolves.

## Death and recovery
Spirit of the Remembered is the first recovery layer. Sacrifice L and healer limit break 3 are limited group resources. Returning after a KO removes the player from the Arsenal, and re-entry requires another valid node. Wait for the designated resurrection caller rather than releasing immediately.

## Rewards and Physeos
Bosses award Eureka Fragments. A completed Eurekan weapon needs 100 fragments for Physeos, adding elemental bonuses within Eureka. Verify the fragment total and immediately previous weapon before the exchange.`, references: [official("Baldesion Arsenal", "https://ffxiv.consolegameswiki.com/wiki/The_Baldesion_Arsenal")] },

  { slug: "bozja-lost-actions", parentSlug: "bozja-field-guide", type: "article", category: "Bozja Systems", title: "Fragments, Essences, Lost Actions & Duels", summary: "Where actions come from, how to build a holster, qualify for duels, and stop entering encounters underpowered.", expansion: "Shadowbringers", level: "80", audience: "Combat", tags: ["lost actions", "fragments", "duels"], imageUrl: "/guides/field-operations.svg", order: 20,
    content: `## Fragment loop
Obtain forgotten fragments from their named enemy families, skirmishes, critical engagements, clusters, or market board. Appraise them at camp, then move learned actions from Lost Finds Cache into the capacity-limited holster.

Always use an appropriate essence. It persists until leaving/changing job and commonly contributes more than a single action. Add damage to speed farming, healing/mitigation for risky content, and role actions required by organized raids.

## Duel qualification
Clear the duel's prerequisite critical engagement without taking avoidable vulnerability mechanics. Survival alone is insufficient. If invited, use the preparation window for the exact resistance potion, essence, lost actions, dispels, and defensive tools the duel requires. Decline if unprepared so another qualified player can attempt it.

## Common failures
- Fragment will not activate: appraise it first.
- Action unavailable: it remains in cache, exceeds holster capacity, or job restrictions do not match.
- Essence vanished: changing job or leaving the instance removed it.
- No duel invite: avoidable damage was taken in the prerequisite encounter.`, references: [official("Bozjan lost actions", "https://ffxiv.consolegameswiki.com/wiki/Lost_Actions")] },
  { slug: "bozja-raids-notes", parentSlug: "bozja-field-guide", type: "article", category: "Bozja Systems", title: "Castrum, Delubrum, Dalriada & Field Notes", summary: "Unlock and complete all three large-scale duties, rescue objectives, relic drops, honors, and rare-note routes.", expansion: "Shadowbringers", level: "80", audience: "Combat", tags: ["castrum", "delubrum", "dalriada", "field notes"], imageUrl: "/guides/field-operations.svg", order: 30,
    content: `## Castrum Lacus Litore
Reach rank 10 and the matching Southern Front story. Register when its special engagement appears. Opening groups must split; rescue prisoners quickly because saved prisoners affect rewards. Complete Castrum and Gangos follow-ups to unlock the next story.

## Delubrum Reginae
Unlock through the post-Castrum Gangos chain and queue from Gangos. Bring an essence and actions. Twice-come-ruin mechanics punish repeated failures. Savage is separately organized alliance content and requires its group's assigned loadout.

## Dalriada
Reach rank 25, finish Zadnor story through March of the Bloody Queen, and register when the Dalriada appears. Split for simultaneous opening routes and follow party assignments.

## Field notes and honors
The Collection entry identifies each note's source. Rare notes may have a guaranteed duel and low-rate group source, so farm the correct encounter instead of random FATEs. After rank 25, exchange mettle for Proofs and invest in Valor, Fortitude, or Succor; honors are permanent inside Save the Queen areas.`, references: [official("Zadnor and Dalriada", "https://ffxiv.consolegameswiki.com/wiki/Zadnor")] },

  { slug: "occult-phantom-jobs", parentSlug: "occult-crescent-guide", type: "article", category: "Occult Crescent", title: "Phantom Jobs, Mastery, Records & Currency", summary: "Unlock and level phantom jobs, choose functional loadouts, complete records, and spend each Horn's currency correctly.", expansion: "Dawntrail", level: "100", audience: "Combat", tags: ["phantom jobs", "records", "obols"], imageUrl: "/guides/field-operations.svg", order: 20,
    content: `## Phantom jobs
Complete **New Job, Old Tricks**, obtain soul shards, and change phantom job from the field HUD outside combat. Phantom EXP unlocks actions/traits. Mastering jobs strengthens persistent Phantom Mastery; Freelancer advances through other masteries.

Build for the activity: sustain for solo chains, damage/support for FATEs, and the exact composition assigned for towers. Put the active phantom action on the duty-action bar before leaving camp.

## Records and treasure
Occult Record entries come from story, encounters, notes, and exploration. If a quest stalls, inspect the named missing record. Personal coffers are owner-only; fortune carrots reveal bunnies leading to treasure.

## North/South currency
South and North Horn use different local currencies. In North Horn, silver obols primarily come from FATEs/critical encounters and gold obols from wild enemies. Confirm the antiquarian/armorer currency icon before farming or exchanging gear.

## Phantom Physicking and Phantom Salvation
**Phantom Physicking III** requires 500 successful resurrections of other players in North Horn and awards the **Phantom Salvation** title. Use a phantom job/loadout with a resurrection action, join active encounter groups, and prioritize genuine recoveries without creating unsafe deaths. A cast that does not successfully return another player does not advance the counter. Keep the achievement pinned and verify its count after an encounter before repeating a route.`, references: [official("Official Occult Crescent guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/occult_crescent/")] },
  { slug: "occult-forked-towers", parentSlug: "occult-crescent-guide", type: "article", category: "Occult Crescent", title: "Forked Towers: Blood, Magic & Extreme", summary: "Entry requirements, party construction, weather/portal behavior, phantom assignments, and safe preparation.", expansion: "Dawntrail", level: "100", audience: "Combat", tags: ["forked tower", "blood", "magic", "extreme"], imageUrl: "/guides/field-operations.svg", order: 30,
    content: `## Tower of Blood
Finish its South Horn unlock and join an organized group. Carry the requested entry resource and equip the assigned phantom job/actions before entry. Portal handling and party balance are coordinated; do not take an unassigned place.

## Tower of Magic normal
Reach knowledge 40 and finish the North Horn unlock. It opens during Auroral Mirage and admits up to 48. More than 48 eligible players are selected by party, with priority for previously unsuccessful applicants. A preformed alliance of at least 24 can create an exclusive instance and trigger the weather after requirements are met.

## Extreme
Form a premade alliance of 12–48 across at least three parties and enter through Jeffroy after the separate unlock. The short preparation window, private instance, and multi-party mechanics require preassigned combat jobs, phantom jobs, mitigation, and communication.

Using Occult Return or returning after incapacitation removes a player from a tower. Confirm repair, food, actions, and organizer instructions before entry.`, references: [official("Official Occult Crescent guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/occult_crescent/")] },

  { slug: "mastercraft-supra-lucis", parentSlug: "relic-tools", type: "article", category: "Profession Relics", title: "Level 50 Mastercraft, Supra & Lucis Tools", summary: "The original crafter and gatherer tool progression, including class tools, Supra exchanges, Moonstones, and Lucis restoration.", expansion: "A Realm Reborn", level: "50", audience: "Crafting & Gathering", tags: ["supra", "lucis", "mastercraft", "moonstone"], imageUrl: "/guides/relic-stage-route.svg", order: 8,
    content: `## What this line is
Mastercraft → Supra → Lucis is the original level-50 profession tool progression. It is now primarily a glamour/collection project; modern catch-up gear is much faster for leveling.

## Crafter route
| Stage | Required work | Exchange warning |
|---|---|---|
| Class tool | Finish the level-50 class quest and retain its rewarded main hand | The class tool is consumed by the next exchange |
| Mastercraft/Supra preparation | Craft or exchange the exact class-specific high-level token items requested by Talan | Old recipes may require books and melded level-50 gear |
| Supra | Exchange the requested class tool/tokens at Talan in Mor Dhona | Supra replicas are not automatically available later; keep it if the appearance matters |
| Lucis | Trade the Supra tool, the exact class-specific crafted item, and 5 Moonstones | Crafted requirement and quality are class-specific; verify the live exchange window |

## Gatherer route
Miner and botanist must personally gather the untradeable requested items; fisher must personally catch the requested fish. The active tool/stats and old gathering conditions matter. Gathered quest items cannot simply be bought from another player.

## Moonstones
Lucis requires 5 Moonstones per tool. They can be obtained through Grand Company seal exchange and other legacy sources. Do not buy a large batch until the exchange window confirms the remaining amount for the selected class.

## Safe completion
- [ ] Take a screenshot or note of the exact Talan exchange before gathering/crafting.
- [ ] Keep the Supra appearance; obtaining Lucis does not make every prior tool freely repurchasable.
- [ ] Use modern gear to overpower old stat checks, but still obey class, quality, and untradeable-item requirements.

[[tools-profession-gear-caps|Compare profession armor and catch-up gear by level cap]]`, references: [official("Mastercraft and Lucis tool requirements", "https://ffxiv.consolegameswiki.com/wiki/Mastercraft_Tools"), official("Supra tool set", "https://ffxiv.consolegameswiki.com/wiki/Supra_Relic_Tools")] },

  { slug: "blessed-resplendent-tools", parentSlug: "relic-tools", type: "article", category: "Profession Relics", title: "Blessed & Resplendent Achievement Tools", summary: "Achievement-log tools and the demanding Resplendent expert-craft chain, clearly separated from quest relics.", expansion: "Multiple", level: "60–80", audience: "Crafting & Gathering", tags: ["blessed tools", "resplendent tools", "achievements", "expert recipes"], imageUrl: "/guides/relic-stage-route.svg", order: 9,
    content: `## Blessed tools
Blessed tools are achievement rewards for filling crafting, gathering, and fishing log categories—not an NPC upgrade quest.
- [ ] Open Achievements → Crafting & Gathering and pin the class's “I Made That,” “I Found That,” or fishing-log progression.
- [ ] Only entries that award the relevant log check count. Repeating one easy item does not replace missing unique entries.
- [ ] Claim the achievement reward after meeting its threshold; the glow appears during the associated craft/gather animation.

## Resplendent crafting tools
- [ ] Reach level 80, unlock the required master recipes and level-80 Scrip Exchange categories, and speak with **Limbeth** in Eulmore.
- [ ] Buy the class's Resplendent Material A with the displayed scrip currency.
- [ ] Craft Component A as a collectable and exchange qualifying results for Material B.
- [ ] Craft Component B and exchange for Material C.
- [ ] Complete the final Component C expert recipes and exchange the required final materials for the class tool.

| Component | Recipe behavior | Planning rule |
|---|---|---|
| A | Expert collectable | Test one; higher rating reduces total crafts |
| B | Harder expert collectable | Recheck conditions and durability; do not assume the A rotation works |
| C | Final expert collectable | Specialist/current gear strongly recommended; failed crafts waste prior-stage value |

## Resplendent gathering tools
Gatherer versions come from gathering-log achievements rather than the crafter component exchange. Open the exact MIN, BTN, or FSH achievement and use its counter as the authoritative checklist.

These tools are prestigious glamour/achievement projects. They are separate from [[relic-tools|Skysteel, Splendorous, and Cosmic tool quests]].`, references: [official("Resplendent tools", "https://ffxiv.consolegameswiki.com/wiki/Resplendent_Tools"), official("Official Blameless Tools achievement", "https://eu.finalfantasyxiv.com/lodestone/playguide/db/achievement/c297df36e8f/")] },

  { slug: "profession-gear-cap-directory", parentSlug: "relic-tools", type: "article", category: "Profession Equipment", title: "Level-Cap Gear & Vendor Directory", summary: "Where each expansion's scrip gear is unlocked, when crafted gear is better, and what can actually be augmented.", expansion: "Multiple", level: "50–100", audience: "Crafting & Gathering", tags: ["gear", "vendor", "scrip", "augmentation"], imageUrl: "/guides/crafting.svg", order: 40,
    content: `## Expansion-cap directory
| Level | Main hub | Unlock | Practical use |
|---|---|---|---|
| 50 | Mor Dhona / Foundation | Inscrutable Tastes | Historical artifact, Artisan/Forager, Supra/Lucis projects; use vendor/crafted catch-up for leveling |
| 60 | Idyllshire | Go West, Craftsman | Level-60 scrip catch-up and master-recipe access |
| 70 | Rhalgr's Reach | Reach Long and Prosper | Stormblood scrip gear/books; replace while entering Shadowbringers |
| 80 | Eulmore / Crystarium | The Boutique Always Wins | Scrip catch-up, Skysteel/Resplendent preparation, master recipes |
| 90 | Radz-at-Han | Expanding House of Splendors | Purple-scrip catch-up, Splendorous materials, Endwalker books |
| 100 | Solution Nine | Dawn of a New Deal | Current Orange-scrip exchanges, current books/materials, endgame gearing |

## Purchase order
1. Replace a main hand that blocks progress/control or gathering/perception requirements.
2. Replace off hand, chest, and legs for the largest remaining stat gains.
3. Add accessories when CP/GP or a node bonus is missed.
4. Buy master-recipe and folklore books before temporary pieces if the book gates the actual goal.

## Augmentation check
Not every scrip set has an upgrade. Open the adjacent enhancement/exchange NPC and inspect the exact original piece plus augmentation material. If no exchange exists, do not buy upgrade tokens based on another expansion's guide.

## Crafted versus scrip
Use scrip gear for inexpensive immediate readiness. Use current crafted gear when materia melds are needed for expert recipes, high collectability tiers, legendary-node bonuses, or current endgame production. Never pentameld an obsolete transition set without a measured breakpoint.

[[collectables-tier-50|Level 50–60]] · [[collectables-tier-60|Level 60–70]] · [[collectables-tier-70|Level 70–80]] · [[collectables-tier-80|Level 80–90]] · [[collectables-tier-90|Level 90–100]]`, references: [official("Official Collectables guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/collectables/"), official("Scrip Exchange unlock directory", "https://ffxiv.consolegameswiki.com/wiki/Scrip_Exchange")] },

  { slug: "custom-delivery-client-reference", parentSlug: "custom-deliveries", type: "article", category: "Custom Deliveries", title: "Client Location, Unlock & Glamour Table", summary: "A compact all-client reference for teleport planning, prerequisite diagnosis, and rank-5 glamour availability.", expansion: "Multiple", level: "60–100", audience: "Crafting & Gathering", tags: ["clients", "locations", "glamour", "patch"], imageUrl: "/guides/custom-deliveries-route.svg", order: 15,
    content: `## Client reference
| Client | Delivery location | Unlock quest | Glamour at rank 5 | Added |
|---|---|---|---|---|
| Zhloe | Idyllshire 4.6, 6.7 | Arms Wide Open | Yes | 3.55a |
| M'naago | Rhalgr's Reach 14.6, 9.4 | None Forgotten, None Forsaken | No | 4.1 |
| Kurenai | Ruby Sea 28.3, 15.3 | The Seaweed Is Always Greener | Yes | 4.3 |
| Adkiragh | Idyllshire 4.8, 6.6 | Between a Rock and the Hard Place | Yes | 4.5 |
| Kai-Shirr | Eulmore 12.2, 9.9 | Oh, Beehive Yourself | Yes | 5.1 |
| Ehll Tou | Firmament 13.5, 11.2 | O Crafter, My Crafter | Yes | 5.3 |
| Charlemend | Firmament 9.4, 8.7 | You Can Count on It | Yes | 5.5 |
| Ameliance | Old Sharlayan 15.6, 7.2 | Of Mothers and Merchants | Yes | 6.15 |
| Anden | Il Mheg 16.5, 33.8 | That's So Anden | Yes | 6.3 |
| Margrat | Labyrinthos 20.4, 20.1 | A Request of One's Own | Yes | 6.5 |
| Nitowikwe | Shaaloani 14.3, 19.3 | Laying New Tracks | Yes | 7.15 |
| Tiisol Ja | Tuliyollal 15.1, 12.0 | Taco Time | No | 7.51 |

Open Duty → Timers → Custom Deliveries for the current weekly requested items. Right-click a client and choose Show on Map. Request items rotate with satisfaction rank and weekly state, so the Timers panel—not a frozen item list—is the reliable exact source built into the game.

[[custom-deliveries-crafting|Crafting workflow]] · [[custom-deliveries-gathering|Gathering and fishing workflow]] · [[custom-deliveries-weekly-plan|Weekly allowance plan]]`, references: [official("Custom Delivery client table", "https://ffxiv.consolegameswiki.com/wiki/Custom_Deliveries")] },

  { slug: "field-operation-reward-index", parentSlug: "field-operations", type: "article", category: "Exploration Reference", title: "Progression, Death & Reward Comparison", summary: "Compare all three field operations before committing time, including levels, death penalties, actions, raids, and relic endpoints.", expansion: "Multiple", level: "70–100", audience: "Combat", tags: ["comparison", "death penalty", "rewards", "relic"], imageUrl: "/guides/field-operation-route.svg", order: 5,
    content: `## At-a-glance comparison
| System | Internal progression | Special loadout | Major operations | Relic endpoint |
|---|---|---|---|---|
| Eureka | Elemental level 1–60; loss possible at higher levels after returning dead | Logos Actions in Pyros/Hydatos | Baldesion Arsenal | Eurekan → Physeos |
| Save the Queen | Resistance rank 1–25; mettle loss on death/return but rank does not fall | Essences and Lost Actions | Castrum, Delubrum, Dalriada | Resistance → Blade's |
| Occult Crescent | Knowledge 1–40; knowledge loss after protected early levels | Phantom jobs/actions | Forked Tower: Blood and Magic | Phantom weapon stages |

## Choose the right guide
- [[eureka-field-guide|Eureka]] for elemental leveling, four distinct zones, NM trains, Logos, and Arsenal.
- [[bozja-field-guide|Bozja and Zadnor]] for skirmishes, critical engagements, flexible relic sources, raids, duels, and field notes.
- [[occult-crescent-guide|Occult Crescent]] for phantom-job mastery, records, two Horns, towers, and current Dawntrail progression.

Always wait for a raise when the system would penalize returning. Repair and clear inventory before entry, join a party for contribution, and carry the system's intended actions rather than saving every consumable indefinitely.`, references: [official("Official Eureka guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/eureka/"), official("Official Occult Crescent guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/occult_crescent/"), official("Save the Queen directory", "https://ffxiv.consolegameswiki.com/wiki/Save_the_Queen:_Blades_of_Gunnhildr")] },

  { slug: "allied-society-objective-index", parentSlug: "tribal-quests", type: "article", category: "Daily Progression", title: "Daily Objective & Quality Reference", summary: "How to resolve every recurring combat, crafting, gathering, HQ, collectability, mount-action, and quest-item pattern without an external lookup.", expansion: "Multiple", level: "50–100", audience: "Crafting & Gathering", tags: ["daily quests", "objectives", "hq", "quest items"], imageUrl: "/guides/allied-society-bases.svg", order: 5,
    content: `## Why the exact list changes
Each society randomly selects three dailies from the ranks you have unlocked. The duty list and journal map are therefore the exact source for today's enemy, item, quantity, and location. The patterns below explain how to complete every objective type without searching another website.

| Objective wording/icon | What it means | What commonly goes wrong |
|---|---|---|
| Slay named enemy | Kill the exact name inside the journal's highlighted area | Similar model or enemy outside the marked area does not count |
| Use item on weakened target | Lower HP, select target, then use Key Item | Killing normally skips required interaction |
| Mounted/duty action | Mount the supplied quest mount and place its special action on the duty bar | Personal mount or normal attacks do not count |
| Search destination | Interact with sparkling destination; spawned enemy/item is quest-only | Destination is hidden while on another job |
| Craft Special Recipe | Open Special Recipes → Allied Society and use supplied ingredient | Ordinary recipe or market item with same wording is rejected |
| HQ icon beside item | Deliver High Quality; the HQ symbol is explicit | Assuming every old crafting quest requires HQ |
| No HQ icon | Normal quality is accepted | Wasting time maximizing quality when no collectability tier exists |
| Gather quest item | Use Journal → Map; node exists only on accepting gatherer | Searching the normal Gathering Log |
| Collectability number | Use appraisal actions and meet minimum before Collect | Gathering enough items below threshold |
| Quest fish | Use named hole and supplied/specified bait; enable Collect if rating appears | Fishing nearby or with normal bait |

## Rank pools
After a rank story, its new daily pool joins earlier unlocked quests. This is why a Trusted society can still offer a Friendly task. The individual society page lists its base, rank stories, distinctive objective mechanics, and vendor rewards.

## Required-quality rule
Never infer HQ from an old guide. The live duty list shows an HQ icon when required. Modern gathered quest items do not have HQ variants. Crafted collectables use a numeric rating instead of HQ.

## Fast route
- [ ] Accept all three on the job receiving experience.
- [ ] Open each journal map once and group objectives by teleport/sub-zone.
- [ ] Put supplied items and duty actions on a temporary hotbar.
- [ ] Complete field objectives, craft last near the delivery NPC, then turn in on the accepting job.

[[societies-level-50|Level 50–60]] · [[societies-level-60|Level 60–70]] · [[societies-level-70|Level 70–80]] · [[societies-level-80|Level 80–90]] · [[societies-level-90|Level 90–100]]`, references: [official("Allied Society daily and quest-sync rules", "https://ffxiv.consolegameswiki.com/wiki/Allied_Society_Quests")] },

  { slug: "achievement-title-journeys", parentSlug: null, type: "collection", category: "Collections", title: "Achievement & Title Journeys", summary: "Long-form routes that turn large achievement and title goals into practical, ordered projects.", expansion: "Multiple", level: "1–100", audience: "All players", tags: ["achievements", "titles", "collections", "journey"], imageUrl: "/guides/relic-stage-route.svg", order: 95 },
  { slug: "achievement-hunting-journey", parentSlug: "achievement-title-journeys", type: "article", category: "Achievement Journey", title: "Build an Achievement Hunting Roadmap", summary: "Choose obtainable goals, batch overlapping requirements, and use the tracker without losing sight of time-limited or legacy restrictions.", expansion: "Multiple", level: "1–100", audience: "All players", tags: ["achievements", "points", "roadmap", "rewards"], imageUrl: "/guides/relic-stage-route.svg", order: 10,
    content: `## Start with a safe shortlist
Open **Collections → Achievements** and begin with Availability = Obtainable. Filter by one type or category, then use Missing after your Lodestone baseline has completed. Legacy, ranked PvP, and time-limited entries remain visible for historical context but should not be treated as current promises.

## Build the route in layers
1. **Story and unlock pass:** finish prerequisite MSQ, blue quests, travel, duties, and systems first.
2. **Automatic overlap:** pin achievements that advance during roulettes, crafting, gathering, hunts, FATEs, or society dailies you already plan to do.
3. **Finite projects:** complete exploration maps, sightseeing, logs, unique duties, and one-time collections.
4. **Long counters:** schedule repeatable wins, levequests, collectables, deep dungeons, field operations, or PvP last so they accumulate alongside other goals.

## Read each tracker card
- **How to earn** is the catalog requirement, not a guarantee that the content is currently available.
- **Points** contribute to the achievement-point total; direct rewards are listed separately.
- **Owned/Missing** is private to your linked current FC character and follows the latest successful Lodestone scan.
- A failed or private scan retains the previous known-good ownership instead of clearing it.

## Weekly planning checklist
- [ ] Pick one short completion, one background counter, and one social/group goal.
- [ ] Check limited-time events and ranked seasons before committing to an old requirement.
- [ ] Open the relevant long-form portal guide for relics, societies, field operations, crafting, or gathering.
- [ ] Claim in-game achievement rewards after completion; earning and claiming are separate for some rewards.

The tracker is the authoritative portal checklist. These guides explain routes and dependencies rather than copying thousands of individual catalog rows.`, references: [official("Official Lodestone achievement history", "https://na.finalfantasyxiv.com/lodestone/my/achievement/")] },
  { slug: "deep-dungeon-title-journey", parentSlug: "achievement-title-journeys", type: "article", category: "Battle Journey", title: "Deep Dungeon Achievement & Title Journey", summary: "Plan story clears, fixed-party climbs, solo titles, hoard discoveries, aetherpool, and safe save-slot progression across every deep dungeon.", expansion: "Multiple", level: "17–100", audience: "Combat", tags: ["deep dungeon", "palace of the dead", "heaven-on-high", "eureka orthos", "pilgrim's traverse", "necromancer"], imageUrl: "/guides/field-operations.svg", order: 30,
    content: `## Separate the four progression systems
Palace of the Dead, Heaven-on-High, Eureka Orthos, and Pilgrim's Traverse each keep their own level, aetherpool, inventory, and save data. Progress in one does not strengthen another. Open the matching deep-dungeon information screen before a serious run and verify both weapon and armor strength.

| Goal | Preparation | Completion rule |
|---|---|---|
| Story/title floors | Use matched or fixed entry where allowed | Clear the achievement's named floor or stone |
| Full party climb | Form a fixed party and preserve its save | A wipe beyond the challenge threshold invalidates that save |
| Solo title | Start and finish on one solo save | Party clears do not substitute for the solo achievement |
| Accursed Hoard | Carry Intuition-type detection items | Stand still on the revealed location until it is uncovered |
| Aetherpool weapon | Build spare aetherpool strength first | Exchanging strength can leave a save unable to re-enter |

## Before a solo attempt
- [ ] Unlock the full challenge floors and clear every required sidequest.
- [ ] Raise the dungeon's own arm and armor toward its practical cap before committing a save.
- [ ] Choose a job whose sustain, burst, crowd control, and movement you understand.
- [ ] Learn every dangerous enemy, patrol, floor effect, trap, and boss set in blocks rather than improvising at the end.
- [ ] Keep a second save slot available for aetherpool or practice recovery.

## Floor routine
Reveal a safe route, fight only the enemies needed to activate passage, and preserve emergency pomanders/protomanders for bad floor combinations. Never open a coffer while standing where a mimic, trap, or patrol can chain into the pull. On high floors, time is also a resource: avoid clearing the whole map unless the run needs experience, aetherpool, or hoard.

For hoard achievements, successful appraisal is not the discovery condition—the buried cache must first be uncovered during the run. For solo achievements, use the official score page after a completed or failed attempt to confirm that the game recorded the correct solo save.

## Failure safety
- A disconnected or wiped challenge save may become unusable; do not delete the other slot reflexively.
- Home World transfer and fixed-party changes can require disbanding the fixed-party registration before the data can be reused.
- Never exchange aetherpool gear while an active save is close to its entry requirement.
- New deep dungeons may use renamed items and stones, but the live information window overrides older terminology.`, references: [official("Official Palace of the Dead play guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/deepdungeon/"), official("Official Heaven-on-High play guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/deepdungeon2/"), official("Official Pilgrim's Traverse play guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/deepdungeon4/")] },
  { slug: "fisher-title-journey", parentSlug: "achievement-title-journeys", type: "article", category: "Gathering Journey", title: "Fisher Achievement & Title Journey", summary: "Organize fishing-log discovery, big fish, Ocean Fishing bonuses, restoration, and cosmic score titles without mixing incompatible counters.", expansion: "Multiple", level: "1–100", audience: "Gathering", tags: ["fishing", "big fish", "ocean fishing", "fishing log", "cosmic exploration"], imageUrl: "/guides/crafting.svg", order: 40,
    content: `## Identify which counter the card uses
Fisher titles come from several independent systems. A catch can advance the Fishing Log while doing nothing for a big-fish, Ocean Fishing, restoration, or cosmic score achievement. Pin the exact achievement and confirm its counter before preparing bait.

| Family | What advances it | Planning method |
|---|---|---|
| I Caught That / regional logs | First recorded catch of a unique fish | Clear blank Fishing Log entries by region |
| Big fish | Fish explicitly classified for the named expansion goal | Build a weather-and-time schedule |
| Ocean Fishing score | Voyage points on the named route | Prepare route bait and spectral-current actions |
| Ocean Fishing bonuses | Meet the voyage's named party/category condition | Coordinate targets; raw score alone is insufficient |
| Restoration | Submit the phase-specific artisanal fish | Historical phase availability must be checked |
| Cosmic Exploration | Earn the named class or mastery score | Use current mission and tool-mastery objectives |

## Fishing Log and big-fish route
- [ ] Unlock every expansion area, folklore book, and fishing system required by the blank entries.
- [ ] Read the live Fishing Log for hole, bait, time, weather, and mooch requirements.
- [ ] Make a short window list; do not camp a fish whose weather chain is not active.
- [ ] Use gathering food, current gear, Hi-Cordials, and appropriate Fisher actions without assuming they bypass an unavailable window.
- [ ] Mark the fish caught immediately, then move to the next active window.

Composite achievements such as **Fish Fear Me** or **I Came, I Saw, I Fished** require their named prerequisite achievements. The final title does not advance directly from one additional catch; complete each prerequisite chain shown on its card.

## Ocean Fishing
Check whether the achievement names the Indigo or Ruby route. Score titles require the stated single-voyage or cumulative score, while “What Did … Do to You?” achievements require a specific voyage bonus. Bring the route's useful bait, keep inventory space, use spectral-current opportunities, and coordinate category targets with the party. A high personal score cannot replace a missing group bonus.

## Long-project safety
Limited restoration phases and changing cosmic objectives need an availability check before grinding. The tracker retains historical achievements, so an old title card is not proof that its original phase can still be entered. For current goals, treat the in-game achievement counter and Fishing Log as authoritative when a patch changes bait, route, or reward behavior.`, references: [official("Official Ocean Fishing play guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/oceanfishing/"), official("Official Lodestone Fishing Log database", "https://na.finalfantasyxiv.com/lodestone/playguide/db/fishing/")] },
  { slug: "hunt-title-journey", parentSlug: "achievement-title-journeys", type: "article", category: "Battle Journey", title: "Hunt Achievement & Title Journey", summary: "Unlock each expansion's Hunt, distinguish B/A/S-rank credit, and turn long mark counters into safe train and spawn projects.", expansion: "Multiple", level: "50–100", audience: "Combat", tags: ["hunt", "elite marks", "hunt trains", "a rank", "s rank"], imageUrl: "/guides/field-operations.svg", order: 50,
    content: `## Unlock before counting
Complete your Grand Company's **Let the Hunt Begin** at level 50, then follow the expansion Hunt unlock chains. Unlocks govern bills and currencies; merely seeing an elite mark does not guarantee every associated reward system is open.

## Know the three title routes
- **B ranks:** always-active solo marks tied mainly to weekly elite bills. The bill matters for its currency reward.
- **A ranks:** timed open-world marks commonly handled by organized Hunt trains. Join the local community, follow the conductor, and wait for pull calls.
- **S ranks and higher:** conditionally spawned marks with larger community turnout. Learn the spawn condition only when volunteering as a spawner and never reset or early-pull another group's work.

The older **On Your Mark** achievements aggregate regional rank achievements; later titles use large direct A- or S-rank counters for a specific expansion. Read the card's description before joining a train so kills in the wrong expansion are not mistaken for progress.

## Credit-safe train routine
- [ ] Join a party before the train starts; contribution is more reliable as a group.
- [ ] Travel to the announced instance and location early without attacking.
- [ ] Use a job that can tag safely and avoid effects that move or reset the mark.
- [ ] Stay with the conductor's route and do not jump ahead to pull.
- [ ] Check the achievement counter after the first mark of the session.

## Long-counter planning
A- and S-rank titles are marathon achievements. Track them as a background project alongside tomestones, materia, seals/nuts, and weekly bills rather than forcing thousands of kills at once. Cross-world and data-center travel rules, instance congestion, and community conduct vary; the portal guide intentionally does not publish spawn timers or private relay information.

If a mark dies without credit, confirm you were in the correct zone instance, in range, alive, and contributing. A bill is not normally required for achievement credit on open-world A/S marks, but the live achievement counter is the final authority after any rule change.`, references: [official("Official Hunt introduction and rank rules", "https://na.finalfantasyxiv.com/lodestone/topics/detail/c96b9e090eb60d1ebd1b89e20e582d59335acd84"), official("Official Shadowbringers Hunt unlock example", "https://na.finalfantasyxiv.com/lodestone/topics/detail/330f2b280067d69d85b17831c66712a499e97484")] },
  { slug: "treasure-hunt-title-journey", parentSlug: "achievement-title-journeys", type: "article", category: "Battle Journey", title: "Treasure Hunt Achievement & Title Journey", summary: "Match maps to portal dungeons, organize parties, and separate entry, clear, and final-chamber title counters.", expansion: "Multiple", level: "40–100", audience: "All players", tags: ["treasure maps", "portal dungeon", "aquapolis", "uznair", "lyhe ghiah", "excitatron"], imageUrl: "/guides/field-operations.svg", order: 60,
    content: `## Unlock and prepare
Complete **Treasures and Tribulations** in Wineport to learn Decipher and Dig. A timeworn map becomes a treasure-map key item when deciphered; use its image and zone name to find the location, then Dig near the correct point. Opening the coffer starts a timed enemy encounter.

## Three different achievement counters
Portal-dungeon titles usually separate:
1. **Enter/raid the dungeon** a stated number of times.
2. **Repeat the dungeon** for a larger visit counter.
3. **Reach or clear the final chamber/stage** a stated number of times.

Entering does not count as a final-room clear. The portal itself is random, and door/roulette progression is also random, so final-chamber titles take substantially longer than entry titles.

## Map-to-project routine
- [ ] Confirm the map level and expansion correspond to the named portal dungeon.
- [ ] Form the intended party before opening the surface coffer.
- [ ] Agree on owner order, loot rules, and whether maps will be free-for-all or round-robin.
- [ ] Keep inventory space and repair before the first map.
- [ ] After a portal appears, enter promptly and keep the owner present.
- [ ] Check the exact achievement counter after the first successful entry and final room.

Different maps can lead to alternate portal dungeons within the same expansion. If the title names Aquapolis, Uznair, Lyhe Ghiah, Excitatron, Gymnasion, Cenote, or Vault Oneiron, a different destination does not advance that specific counter even when its rewards are useful.

## Solo and old-map cautions
Overleveling makes many surface encounters easy, but synced portal duties and random mechanics still benefit from a party. Historical maps remain obtainable in many cases, yet market price and party interest vary. Do not promise a portal or final room from a fixed number of maps; preserve the project as an RNG-based group journey and record progress through the achievement counter.`, references: [official("Official Treasure Hunt introduction", "https://na.finalfantasyxiv.com/lodestone/topics/detail/2cbef3fca243fc9099c206e3efa611a9d24b19f4"), official("Official Shifting Oubliettes rules", "https://na.finalfantasyxiv.com/lodestone/topics/detail/230f6e0af3536f9a40654d783c8c2f1094131070")] },
  { slug: "gold-saucer-title-journey", parentSlug: "achievement-title-journeys", type: "article", category: "Gold Saucer Journey", title: "Gold Saucer Achievement & Title Journey", summary: "Separate MGP, GATE, Triple Triad, racing, Verminion, mahjong, Cactpot, and event title projects into workable routines.", expansion: "Multiple", level: "15+", audience: "All players", tags: ["gold saucer", "mgp", "triple triad", "chocobo racing", "verminion", "mahjong"], imageUrl: "/guides/relic-stage-route.svg", order: 70,
    content: `## Treat the Saucer as several trackers
Gold Saucer titles do not share one universal progress bar. MGP earned, Cactpot winnings, GATE completions, Triple Triad cards/matches, chocobo races, Lord of Verminion wins, mahjong rating, and collaboration-event results advance independently.

| Project | Reliable routine | Important distinction |
|---|---|---|
| MGP earned | Challenge Log, Fashion Report, GATEs, daily/weekly activities | Spending MGP does not reduce earned counters |
| Cactpot | Three Mini tickets daily and up to three Jumbo tickets weekly | Achievement wording may require winnings, not participation |
| GATEs | Join from the announced GATE client | Named-GATE titles need that exact event |
| Triple Triad | Build card collection, NPC route, roulette/tournament plan | Open, Invitational, and standard tournaments count differently |
| Chocobo racing | Train, retire, cover, and improve pedigree | Participation, wins, rating, and breeding are separate |
| Verminion | Clear challenge unlocks before player RP matches | NPC/master wins do not replace RP requirements |
| Mahjong | Learn scoring before protecting rating | Rating titles can move backward after losses |

## Weekly route
- [ ] Complete the Gold Saucer Challenge Log categories that overlap the current title.
- [ ] Buy Mini Cactpot entries daily and Jumbo Cactpot entries before the weekly draw.
- [ ] Check the GATE schedule while doing other Saucer activities.
- [ ] Use duplicate Triple Triad cards for MGP and track missing unique cards separately.
- [ ] Schedule competitive or population-dependent goals instead of waiting in an empty queue.

Composite goals such as **How I Learned to Stop Worrying and Love the Saucer** require every named prerequisite achievement. Open each prerequisite card and finish the slowest population-, tournament-, or lottery-gated components alongside the repeatable ones.

## Availability warning
Collaboration events such as Blunderville can leave achievements visible after the event closes. The tracker preserves those records for history; confirm the event is currently active before beginning a title plan. Tournament schedules, GATE rotations, and weekly draw times are shown in the live Gold Saucer interface and should override an old static timetable.`, references: [official("Official Gold Saucer play guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/goldsaucer/"), official("Official Triple Triad guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/goldsaucer/tripletriad/"), official("Official Cactpot guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/goldsaucer/cactpot/"), official("Official Lord of Verminion guide", "https://na.finalfantasyxiv.com/lodestone/playguide/contentsguide/goldsaucer/lovm/")] },
  { slug: "title-hunting-journey", parentSlug: "achievement-title-journeys", type: "article", category: "Title Journey", title: "Build a Title Hunting Roadmap", summary: "Find title-awarding achievements, account for gender variants and placement, and organize rare, long, or retired goals.", expansion: "Multiple", level: "1–100", audience: "All players", tags: ["titles", "achievements", "prefix", "suffix", "roadmap"], imageUrl: "/guides/relic-stage-route.svg", order: 20,
    content: `## Use the title catalog first
Open **Collections → Titles** to search the displayed title, its alternate gender form, or the achievement that awards it. Each card links the title to its source achievement and shows the same personal Owned/Missing state as the Achievement tracker.

## Choose a title journey
- **Identity goal:** pick a title you want to display and work backward from its source achievement.
- **Expansion sweep:** filter by patch and finish obtainable titles from one era together.
- **System mastery:** group battle, crafting, gathering, exploration, quest, or PvP titles so unlocks and counters overlap.
- **Historical archive:** use Legacy and limited availability filters to understand retired titles without mixing them into an attainable checklist.

## Variant and placement notes
Titles can have separate male and female display text. The tracker preserves both forms under one stable title record so they never appear as two separate goals. Prefix titles appear before a character name; suffix titles appear after it. Ellipsis shown in source data is display punctuation, not another unlock requirement.

## Long-journey habits
- [ ] Verify the source achievement and availability before beginning a large grind.
- [ ] Follow linked portal guides for multi-stage systems such as relics, allied societies, field operations, and profession achievements.
- [ ] Pair repeat counters with roulettes, weekly objectives, and scheduled FC events.
- [ ] Recheck the in-game title list after earning the achievement; Lodestone synchronization can trail the in-game completion.

Titles and achievements intentionally share one ownership foundation. A title becomes Owned when its linked achievement is present in your last successful Lodestone history, with no public member comparison or Discord announcement.`, references: [official("Official Lodestone achievement history", "https://na.finalfantasyxiv.com/lodestone/my/achievement/")] },

  ...TITLE_FAMILY_GUIDES,
  ...COLLECTION_REWARD_GUIDES,
  ...ALLIED_SOCIETY_GUIDES,
  ...EXPANDED_GUIDES,
  ...LIMITED_JOB_GUIDES,
  ...FIELD_OPERATION_GUIDES,
  ...VARIANT_CRITERION_GUIDES,
  ...GATHERING_ACHIEVEMENT_TOOL_GUIDES,
];

const HIDDEN_GUIDE_SLUGS = new Set([
  "tribal-combat", "tribal-combat-overview",
  "tribal-crafting", "tribal-crafting-overview",
  "tribal-gathering", "tribal-gathering-overview",
  "collectables-workflow", "collectables-unlock-directory", "scrips-books-folklore",
  "custom-deliveries-directory", "custom-deliveries-crafting",
  "custom-deliveries-gathering", "custom-deliveries-weekly-plan",
  "custom-delivery-client-reference",
  "anima-complete-route", "anima-opening-stages", "anima-sand-light-lux",
  "eurekan-complete-route", "eurekan-anemos-pagos", "eurekan-pyros-hydatos",
  "resistance-complete-route", "resistance-memory-stages", "resistance-raids-zadnor",
  "manderville-complete-route", "manderville-four-stages",
  "phantom-complete-route", "phantom-paste-demiatma",
  "relic-tools-overview", "profession-relic-preparation",
  "profession-gear-cap-directory", "profession-relic-gear",
  "field-operation-reward-index",
  "eureka-field-complete", "bozja-field-complete", "occult-crescent-complete",
]);

export const BUILT_IN_GUIDES = GUIDE_DEFINITIONS.filter((guide) => !HIDDEN_GUIDE_SLUGS.has(guide.slug)).map((guide) => ({
  ...guide,
  verifiedPatch: guide.verifiedPatch || GUIDE_LIBRARY_PATCH,
  verifiedOn: guide.verifiedOn || GUIDE_LIBRARY_VERIFIED_ON,
}));
