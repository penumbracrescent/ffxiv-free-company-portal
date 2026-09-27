export type CraftingProjectType = "standard_request" | "workshop_project";
export type CraftingProjectStatus = "draft" | "active" | "completed" | "cancelled" | "archived";
export type CraftingPhaseStatus = "provisional" | "active" | "ready" | "completed";
export type CraftingContributionQuality = "nq" | "hq" | "not_applicable";
export type CraftingClaimStatus = "active" | "completed" | "released" | "cancelled";
export type CraftingWorkshopResult = "normal" | "excellent" | "outstanding";

export type CraftingActor = {
  characterId: number | null;
  characterName: string | null;
  discordUserId: string | null;
  isOfficer: boolean;
};

export type CraftingItemSource = {
  type: "gathering" | "vendor" | "other";
  name: string | null;
  location: string | null;
  coordinates: { x: number; y: number } | null;
};

export type CraftingItem = {
  id: number;
  name: string;
  iconUrl: string | null;
  canBeHq: boolean;
  isRaw: boolean;
  level: number | null;
  itemLevel: number | null;
  sources?: CraftingItemSource[];
};

export type CraftingRecipeIngredient = {
  recipeId: number;
  itemId: number;
  quantity: number;
};

export type CraftingRecipe = {
  id: number;
  outputItemId: number;
  outputQuantity: number;
  preferred: boolean;
  ingredients: CraftingRecipeIngredient[];
};

export type CraftingRequirementRow = {
  itemId: number;
  itemName: string;
  iconUrl: string | null;
  canBeHq: boolean;
  level: number | null;
  itemLevel: number | null;
  required: number;
  contributed: number;
  contributedNq: number;
  contributedHq: number;
  remaining: number;
  claimed: number;
  unclaimed: number;
  surplus: number;
  craftCount: number;
  outputQuantity: number;
  isRaw: boolean;
  sources: CraftingItemSource[];
  depth: number;
  parentItemId: number | null;
  cycleBlocked: boolean;
};

export type CraftingPhaseReadiness = {
  directRequired: number;
  directContributed: number;
  completeRows: number;
  totalRows: number;
  ready: boolean;
};