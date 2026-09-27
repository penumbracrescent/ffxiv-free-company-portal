import type { CraftingItem, CraftingRecipe, CraftingRequirementRow } from "./types";

type CalculationInput = {
  topLevel: Array<{ itemId: number; quantity: number }>;
  items: CraftingItem[];
  recipes: CraftingRecipe[];
  contributionsByItem?: Map<number, { total: number; nq: number; hq: number }>;
  claimsByItem?: Map<number, number>;
  recipeOverrides?: Map<number, number>;
  maxDepth?: number;
};

/**
 * A contribution to a crafted intermediate is subtracted before its recipe is
 * expanded. Demand is aggregated per item before a recipe is expanded, so a
 * shared ingredient remains one consolidated row instead of duplicated trees.
 * Claims are deliberately excluded from this calculation: they reserve work,
 * but never reduce the material still required.
 */
export function calculateCraftingRequirements(input: CalculationInput): CraftingRequirementRow[] {
  const items = new Map(input.items.map((item) => [item.id, item]));
  const recipesByOutput = new Map<number, CraftingRecipe[]>();
  for (const recipe of input.recipes) {
    const candidates = recipesByOutput.get(recipe.outputItemId) ?? [];
    candidates.push(recipe);
    recipesByOutput.set(recipe.outputItemId, candidates);
  }
  const chooseRecipe = (itemId: number) => {
    const candidates = recipesByOutput.get(itemId) ?? [];
    const selectedId = input.recipeOverrides?.get(itemId);
    return candidates.find((recipe) => recipe.id === selectedId)
      ?? candidates.find((recipe) => recipe.preferred)
      ?? candidates[0]
      ?? null;
  };
  const hasCycle = (itemId: number, ancestors = new Set<number>()): boolean => {
    const item = items.get(itemId); const recipe = chooseRecipe(itemId);
    if (!item || item.isRaw || !recipe) return false;
    if (ancestors.has(itemId)) return true;
    const next = new Set(ancestors); next.add(itemId);
    return recipe.ingredients.some((ingredient) => hasCycle(ingredient.itemId, next));
  };

  const demand = new Map<number, number>();
  const expandedNet = new Map<number, number>();
  const depthByItem = new Map<number, number>();
  const parentByItem = new Map<number, number | null>();
  const cycleBlocked = new Set<number>();
  const pending = new Set<number>();
  const queue: number[] = [];
  const schedule = (itemId: number) => { if (!pending.has(itemId)) { pending.add(itemId); queue.push(itemId); } };
  for (const top of input.topLevel) {
    if (top.quantity <= 0) continue;
    demand.set(top.itemId, (demand.get(top.itemId) ?? 0) + top.quantity);
    depthByItem.set(top.itemId, 0); parentByItem.set(top.itemId, null); schedule(top.itemId);
  }

  const maxDepth = input.maxDepth ?? 16;
  while (queue.length) {
    const itemId = queue.shift()!; pending.delete(itemId);
    const item = items.get(itemId); const recipe = chooseRecipe(itemId);
    if (!item || !recipe || item.isRaw) continue;
    const depth = depthByItem.get(itemId) ?? 0;
    if (depth >= maxDepth || hasCycle(itemId)) { cycleBlocked.add(itemId); continue; }
    const contributed = input.contributionsByItem?.get(itemId)?.total ?? 0;
    const netDemand = Math.max(0, (demand.get(itemId) ?? 0) - contributed);
    const priorNetDemand = expandedNet.get(itemId) ?? 0;
    if (netDemand <= priorNetDemand) continue;
    const priorCrafts = Math.ceil(priorNetDemand / Math.max(1, recipe.outputQuantity));
    const nextCrafts = Math.ceil(netDemand / Math.max(1, recipe.outputQuantity));
    expandedNet.set(itemId, netDemand);
    const additionalCrafts = nextCrafts - priorCrafts;
    if (!additionalCrafts) continue;
    for (const ingredient of recipe.ingredients) {
      demand.set(ingredient.itemId, (demand.get(ingredient.itemId) ?? 0) + additionalCrafts * ingredient.quantity);
      const nextDepth = depth + 1;
      if (!depthByItem.has(ingredient.itemId) || nextDepth < depthByItem.get(ingredient.itemId)!) {
        depthByItem.set(ingredient.itemId, nextDepth);
        parentByItem.set(ingredient.itemId, itemId);
      }
      schedule(ingredient.itemId);
    }
  }

  return [...demand.entries()].map(([itemId, required]) => {
    const item = items.get(itemId)!;
    const contribution = input.contributionsByItem?.get(itemId) ?? { total: 0, nq: 0, hq: 0 };
    const claimed = input.claimsByItem?.get(itemId) ?? 0;
    const remaining = Math.max(0, required - contribution.total);
    const recipe = chooseRecipe(itemId);
    return {
      itemId, itemName: item.name, iconUrl: item.iconUrl, canBeHq: item.canBeHq, level: item.level, itemLevel: item.itemLevel, sources: item.sources ?? [],
      required, contributed: contribution.total, contributedNq: contribution.nq, contributedHq: contribution.hq,
      remaining, claimed, unclaimed: Math.max(0, remaining - claimed), surplus: Math.max(0, contribution.total - required),
      craftCount: recipe ? Math.ceil(remaining / Math.max(1, recipe.outputQuantity)) : 0,
      outputQuantity: recipe?.outputQuantity ?? 1, isRaw: item.isRaw || !recipe,
      depth: depthByItem.get(itemId) ?? 0, parentItemId: parentByItem.get(itemId) ?? null, cycleBlocked: cycleBlocked.has(itemId)
    } satisfies CraftingRequirementRow;
  }).sort((a, b) => a.depth - b.depth || a.itemName.localeCompare(b.itemName));
}