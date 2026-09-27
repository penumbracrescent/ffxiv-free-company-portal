export type AchievementGuideDepth = "detailed" | "category";
export type AchievementGuideLink = { slug: string; title: string; depth: AchievementGuideDepth };

// Relationships are curated by stable FFXIV achievement ID. This keeps title
// inheritance exact and prevents similar achievement names from receiving an
// unrelated guide after a catalog update.
const ACHIEVEMENT_GUIDES = new Map<number, AchievementGuideLink[]>();
const link = (slug: string, title: string, depth: AchievementGuideDepth = "detailed"): AchievementGuideLink => ({ slug, title, depth });
const register = (ids: number[], guide: AchievementGuideLink) => {
  for (const id of ids) {
    const current = ACHIEVEMENT_GUIDES.get(id) || [];
    if (!current.some((candidate) => candidate.slug === guide.slug)) ACHIEVEMENT_GUIDES.set(id, [...current, guide]);
  }
};

register([866], link("society-amaljaa", "Amalj'aa Allied Society"));
register([870], link("society-sylph", "Sylph Allied Society"));
register([907], link("society-kobold", "Kobold Allied Society"));
register([911], link("society-sahagin", "Sahagin Allied Society"));
register([1025], link("society-ixal", "Ixal / Ehcatl Nine Allied Society"));
register([1026], link("arr-allied-society-finale", "ARR Allied Society Finale"));
register([1398], link("society-vanu-vanu", "Vanu Vanu Allied Society"));
register([1498], link("society-vath", "Vath Allied Society"));
register([1621], link("society-moogle", "Moogle Allied Society"));
register([1627], link("societies-level-50", "Level 50–60 Allied Societies"));
register([2000], link("society-kojin", "Kojin of the Blue Allied Society"));
register([2017], link("society-ananta", "Ananta Allied Society"));
register([2102], link("society-namazu-crafting", "Namazu Allied Society"));
register([2235], link("societies-level-60", "Level 60–70 Allied Societies"));
register([2439], link("society-pixie", "Pixie Allied Society"));
register([2600], link("society-qitari", "Qitari Allied Society"));
register([2641], link("society-dwarf", "Dwarf Allied Society"));
register([3058], link("society-arkasodara", "Arkasodara Allied Society"));
register([3126], link("society-omicron", "Omicron Allied Society"));
register([3191], link("society-loporrit", "Loporrit Allied Society"));
register([3591], link("society-pelupelu", "Pelupelu Allied Society"));
register([3624], link("society-mamool-ja", "Mamool Ja Allied Society"));
register([3777], link("society-yok-huy", "Yok Huy Allied Society"));

register(
  [1655, 1658, 1660, 1663, 1666, 1952, 2049, 2051, 2055, 2056, 3176, 3178, 3183, 3184, 3809, 3811, 3815, 3816],
  link("deep-dungeon-title-journey", "Deep Dungeon Achievement & Title Journey"),
);
register(
  [264, 270, 276, 1033, 1331, 2245, 2521, 2537, 2562, 2563, 2564, 2565, 2566, 2658, 2754, 2755, 2756, 2758, 2759, 2817, 2833, 2834, 3266, 3267, 3268, 3269, 3377, 3378, 3379, 3734, 3912, 3974, 3975, 3976, 3983, 3984, 3985],
  link("fisher-title-journey", "Fisher Achievement & Title Journey"),
);
register(
  [968, 973, 978, 981, 985, 989, 1917, 1918, 1920, 1921, 2352, 2355, 2996, 2999, 3533, 3536],
  link("hunt-title-journey", "Hunt Achievement & Title Journey"),
);
register(
  [882, 1019, 1548, 1551, 1555, 1944, 1947, 1951, 1980, 1983, 1987, 2132, 2135, 2139, 2401, 2404, 2408, 2740, 2743, 2747, 3012, 3015, 3019, 3210, 3213, 3217, 3549, 3552, 3556, 3779, 3782, 3786],
  link("treasure-hunt-title-journey", "Treasure Hunt Achievement & Title Journey"),
);
register(
  [1083, 1088, 1089, 1091, 1092, 1094, 1095, 1099, 1101, 1102, 1110, 1114, 1117, 1120, 1124, 1128, 1383, 1384, 2181, 2182, 2417, 2800, 2819, 3407],
  link("gold-saucer-title-journey", "Gold Saucer Achievement & Title Journey"),
);

register([2675, 2679, 2683, 2684, 2685, 2686, 2693, 2877, 2878, 2879, 2880, 2881, 2882], link("bozja-field-guide", "Bozja & Zadnor"));
register([2682, 2766, 2876], link("bozja-raids-notes", "Castrum, Delubrum, Dalriada & Field Notes"));
register([3663, 3667, 3681, 3685, 3689, 4001, 4005, 4019, 4020, 4021], link("occult-crescent-guide", "Occult Crescent"));
register([3674, 3677, 4016, 4018], link("occult-phantom-jobs", "Phantom Jobs, Mastery, Records & Currency"));
register([3671, 4009, 4010, 4013], link("occult-forked-towers", "Forked Towers: Blood, Magic & Extreme"));

register([3375], link("blessed-resplendent-tools", "Blessed & Resplendent Achievement Tools"));

register([2208, 2211, 2450, 2727, 3318], link("blue-mage-title-journey", "Blue Mage & Masked Carnivale Title Journey"));
register([3156, 3340, 3350, 3428, 3899], link("criterion-variant-title-journey", "Variant & Criterion Title Journey"));
register([3156], link("variant-criterion-sildihn-subterrane", "The Sil'dihn Subterrane Complete Guide"));
register([3340], link("variant-criterion-mount-rokkon", "Mount Rokkon Complete Guide"));
register([3350], link("variant-criterion-aloalo-island", "Aloalo Island Complete Guide"));
register([3898, 3899], link("variant-criterion-merchants-tale", "The Merchant's Tale Complete Guide"));

export type AchievementGuideContext = {
  achievementId: number | null;
  typeName?: string | null;
  categoryName?: string | null;
};

const TYPE_GUIDES = new Map<string, AchievementGuideLink>([
  ["Battle", link("battle-duty-title-journey", "Battle, Raid, Trial & Duty Title Journey", "category")],
  ["PvP", link("pvp-title-journey", "PvP Achievement & Title Journey", "category")],
  ["Quests", link("quest-title-journey", "Quest Achievement & Title Journey", "category")],
  ["Character", link("character-title-journey", "Character Achievement & Title Journey", "category")],
  ["Crafting & Gathering", link("crafting-gathering-title-journey", "Crafting & Gathering Title Journey", "category")],
  ["Items", link("item-collection-title-journey", "Item Collection & Relic Title Journey", "category")],
  ["Exploration", link("exploration-title-journey", "Exploration & Sightseeing Title Journey", "category")],
  ["Grand Company", link("grand-company-title-journey", "Grand Company Title Journey", "category")],
  ["Legacy", link("legacy-title-reference", "Legacy Achievement & Title Reference", "category")],
]);

export function getAchievementGuideLinks(context: AchievementGuideContext | number | null): AchievementGuideLink[] {
  let normalized: AchievementGuideContext;
  if (context === null) normalized = { achievementId: null };
  else if (typeof context === "number") normalized = { achievementId: context };
  else normalized = context;
  if (!normalized.achievementId) return [];
  const exact = ACHIEVEMENT_GUIDES.get(normalized.achievementId) || [];
  let fallback: AchievementGuideLink;
  if (normalized.categoryName === "Relic Weapons" || normalized.categoryName === "Zodiac Weapons") {
    fallback = link("combat-relics", "Combat Relic Weapons", "category");
  } else {
    fallback = TYPE_GUIDES.get(String(normalized.typeName || "")) || link("achievement-title-journeys", "Achievement & Title Journeys", "category");
  }
  return [...exact, ...(exact.some((guide) => guide.slug === fallback.slug) ? [] : [fallback])].map((guide) => ({ ...guide }));
}

export const CURATED_ACHIEVEMENT_GUIDE_IDS = [...ACHIEVEMENT_GUIDES.keys()];
