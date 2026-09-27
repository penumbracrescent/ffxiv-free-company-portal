import { getAchievementGuideLinks, type AchievementGuideLink } from "./achievement-guide-links";

export type CollectionAcquisitionSource = {
  type: string;
  text: string;
  relatedType: string | null;
  relatedId: number | null;
};

const detailed = (slug: string, title: string): AchievementGuideLink => ({ slug, title, depth: "detailed" });
export const KNOWN_COLLECTION_SOURCE_TYPES = ["Achievement", "Bozja", "Chaotic Raid", "Cosmic Exploration", "Crafting", "Deep Dungeon", "Dungeon", "Eureka", "Event", "FATE", "Gathering", "Gold Saucer", "Hunts", "Island Sanctuary", "Occult Crescent", "Other", "Premium", "Purchase", "PvP", "Quest", "Raid", "Skybuilders", "Treasure Hunt", "Trial", "Tribal", "V&C Dungeon", "Venture", "Voyages", "Wondrous Tails"] as const;
const SOCIETY_GUIDES = new Map([
  ["amalj", "society-amaljaa"], ["sylph", "society-sylph"], ["kobold", "society-kobold"], ["sahagin", "society-sahagin"], ["ixal", "society-ixal"],
  ["vanu", "society-vanu-vanu"], ["vath", "society-vath"], ["moogle", "society-moogle"], ["kojin", "society-kojin"], ["ananta", "society-ananta"],
  ["namazu", "society-namazu-crafting"], ["pixie", "society-pixie"], ["dwarf", "society-dwarf"], ["qitari", "society-qitari"], ["arkasodara", "society-arkasodara"],
  ["loporrit", "society-loporrit"], ["omicron", "society-omicron"], ["pelupelu", "society-pelupelu"], ["yok huy", "society-yok-huy"], ["mamool ja", "society-mamool-ja"],
]);

export function getCollectionSourceGuideLinks(source: CollectionAcquisitionSource): AchievementGuideLink[] {
  const sourceType = String(source.type || "").trim().toLowerCase();
  const relatedType = String(source.relatedType || source.type).trim().toLowerCase();
  const relatedId = Number(source.relatedId || 0);
  if (relatedType === "achievement" && relatedId > 0) return getAchievementGuideLinks(relatedId);

  const value = `${source.type} ${source.text} ${source.relatedType || ""}`.toLowerCase();
  if (sourceType === "cosmic exploration") return [detailed("cosmic-exploration", "Cosmic Exploration")];
  if (sourceType === "skybuilders") return [detailed("ishgard-restoration", "Ishgardian Restoration")];
  if (sourceType === "wondrous tails") return [detailed("wondrous-tails-faux-hollows-rewards", "Wondrous Tails & Faux Hollows Rewards")];
  if (["dungeon", "raid", "chaotic raid"].includes(sourceType)) return [detailed("duty-drop-collection-rewards", "Dungeon, Raid & Chaotic Raid Collection Drops")];
  if (sourceType === "fate") return [detailed("fate-bicolor-collection-rewards", "FATE, Bicolor Gemstone & Voucher Rewards")];
  if (sourceType === "venture") return [detailed("retainer-venture-minion-rewards", "Retainer Exploration Venture Minions")];
  if (sourceType === "voyages") return [detailed("fc-voyage-collection-rewards", "FC Airship & Submersible Voyage Rewards")];
  if (["crafting", "gathering"].includes(sourceType) || /gardening/.test(value)) return [detailed("crafted-gathered-gardening-rewards", "Crafted, Gathered & Gardening Collections")];
  if (/island sanctuary|seafarer.?s cowr|islander.?s cowr/.test(value)) return [detailed("island-sanctuary-collection-rewards", "Island Sanctuary Mount & Minion Rewards")];
  if (/\bpvp\b|frontline|rival wings|crystalline conflict|wolf marks?|trophy crystals?|series malmstone/.test(value)) return [detailed("pvp-collection-rewards", "PvP Mount & Minion Reward Route")];
  if (/sil.?dihn|silkie|squeaky clean|dig deep/.test(value)) return [detailed("variant-criterion-sildihn-subterrane", "The Sil'dihn Subterrane Complete Guide")];
  if (/mount rokkon|mononopeke|burabura|shishioji|shishu coin/.test(value)) return [detailed("variant-criterion-mount-rokkon", "Mount Rokkon Complete Guide")];
  if (/aloalo|spectral statice|good-willed hunting|quaqua/.test(value)) return [detailed("variant-criterion-aloalo-island", "Aloalo Island Complete Guide")];
  if (/merchant.?s tale|corvosi|royal magicked carpet|genie of the lamp|literary cannon/.test(value)) return [detailed("variant-criterion-merchants-tale", "The Merchant's Tale Complete Guide")];
  if (sourceType === "v&c dungeon" || /variant dungeon|criterion/.test(value)) return [detailed("variant-criterion-collection-rewards", "Variant & Criterion Collection Rewards")];
  if (/deep dungeon|palace of the dead|heaven-on-high|eureka orthos|pilgrim.?s traverse|accursed hoard|trimmed sack/.test(value)) return [detailed("deep-dungeon-collection-rewards", "Deep Dungeon Mount & Minion Rewards")];
  if (/treasure hunt|treasure map|aquapolis|uznair|lyhe ghiah|excitatron|gymnasion|cenote|vault oneiron/.test(value)) return [detailed("treasure-dungeon-collection-rewards", "Treasure Map Mount & Minion Rewards")];
  if (/\beureka\b|bozja|zadnor|delubrum|dalriada|castrum lacus|occult crescent|south horn|north horn|forked tower|field operation/.test(value)) return [detailed("field-operation-collection-rewards", "Field Operation Collection Rewards")];
  if (/\bhunts?\b|elite marks?|allied seals?|centurio seals?|sacks? of nuts/.test(value)) return [detailed("hunt-collection-rewards", "Hunt Currency Mount & Minion Rewards")];
  if (/gold saucer|\bmgp\b|cactpot|gate:|triple triad|verminion|chocobo racing/.test(value)) return [detailed("gold-saucer-collection-rewards", "Gold Saucer Mount & Minion Rewards")];
  if (/tribal|allied societ|beast tribe/.test(value)) {
    for (const [name, slug] of SOCIETY_GUIDES) if (value.includes(name)) return [detailed(slug, "Allied Society Reward Guide")];
    return [detailed("tribal-quests", "Allied Society Quest & Reward Guides")];
  }
  if (/extreme|\btrial\b|totem/.test(value)) return [detailed("trial-mount-series", "Extreme Trial Mount Series & Meta-Mounts")];
  return [];
}

export type CollectionSourceNotice = { label: string; detail: string; tone: "warning" | "info" };

export function getCollectionSourceNotice(source: CollectionAcquisitionSource): CollectionSourceNotice | null {
  const sourceType = String(source.type || "").trim().toLowerCase();
  const value = `${source.type} ${source.text}`.toLowerCase();
  if (sourceType === "premium") return { label: "External purchase", detail: "Verify the account, platform, product, and current store availability before purchasing.", tone: "info" };
  if (sourceType === "event") return { label: "Limited-time source", detail: "Confirm that the named event is currently active and that this reward is available during its present run.", tone: "warning" };
  if (/legacy campaign|final fantasy xiv 1\.0|legacy reward/.test(value)) return { label: "Legacy source", detail: "This historical reward may no longer be obtainable on a current character.", tone: "warning" };
  return null;
}
