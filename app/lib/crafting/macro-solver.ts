import { CraftingActionsRegistry, CrafterStats, Simulation, type Craft, type CraftingAction } from "@ffxiv-teamcraft/simulator";

export type CalculatorStats = { level: number; craftsmanship: number; control: number; cp: number; specialist: boolean };
export type SolverResult = { actions: string[]; progress: number; quality: number; durability: number; cp: number; success: boolean; searchStopReason?: "time" | "target" | "exhausted" | "depth" };
export type SolverProgress = { percent: number; elapsedMs: number; depth: number; maxDepth: number; explored: number; bestQuality: number | null };

const JOBS: Record<string, number> = { Carpenter: 0, Blacksmith: 1, Armorer: 2, Goldsmith: 3, Leatherworker: 4, Weaver: 5, Alchemist: 6, Culinarian: 7 };
const ACTION_NAMES = ["MuscleMemory","Reflect","TrainedEye","Veneration","Innovation","GreatStrides","WasteNotII","WasteNot","Manipulation","TrainedPerfection","BasicTouch","StandardTouch","AdvancedTouch","RefinedTouch","PrudentTouch","PreparatoryTouch","FocusedTouch","TrainedFinesse","ByregotsBlessing","DelicateSynthesis","Groundwork","PrudentSynthesis","FocusedSynthesis","CarefulSynthesis","BasicSynthesis","Observe","FinalAppraisal","MastersMend","ImmaculateMend"];
const ACTIONS = new Map(CraftingActionsRegistry.ALL_ACTIONS.map((entry) => [entry.name, entry.action]));

export function makeCraft(recipe: any): Craft {
  return { id: String(recipe.id), job: JOBS[recipe.job] ?? 0, rlvl: recipe.recipeLevel, lvl: recipe.level, durability: recipe.durability,
    quality: recipe.quality, progress: recipe.difficulty, stars: recipe.stars, hq: recipe.canHq ? 1 : 0, expert: recipe.expert,
    controlReq: recipe.requiredControl, craftsmanshipReq: recipe.requiredCraftsmanship, requiredQuality: recipe.requiredQuality,
    conditionsFlag: recipe.conditionsFlag, progressDivider: recipe.progressDivider, qualityDivider: recipe.qualityDivider,
    progressModifier: recipe.progressModifier, qualityModifier: recipe.qualityModifier, ingredients: [] };
}

function crafter(job: number, stats: CalculatorStats) {
  const levels = Array(8).fill(stats.level) as [number,number,number,number,number,number,number,number];
  return new CrafterStats(job, stats.craftsmanship, stats.control, stats.cp, stats.specialist, false, stats.level, levels);
}

function simulate(craft: Craft, stats: CalculatorStats, names: string[]) {
  const actions = names.map((name) => ACTIONS.get(name)).filter(Boolean) as CraftingAction[];
  return new Simulation(craft, actions, crafter(craft.job, stats)).run(true, 100, true).simulation;
}

function stateKey(sim: Simulation) {
  return [Math.round(sim.progression),Math.round(sim.quality),sim.durability,sim.availableCP,...sim.buffs.map((b) => `${b.buff}:${b.duration}:${b.stacks}`).sort()].join("|");
}

function score(sim: Simulation, craft: Craft, targetQuality: number, depth: number) {
  const progress = Math.min(sim.progression / craft.progress, 1);
  const quality = targetQuality ? Math.min(sim.quality / targetQuality, 1) : 1;
  const finish = sim.progression >= craft.progress ? (sim.quality >= targetQuality ? 20000 : -20000) : 0;
  return finish + quality * 7600 + progress * (quality > .82 ? 4200 : 2100) + sim.durability * 3 + sim.availableCP * .4 - depth * 4;
}

export function solveCraft(craft: Craft, stats: CalculatorStats, targetQuality: number, deadlineAt = Date.now() + 1500): SolverResult | null {
  if (stats.craftsmanship < (craft.craftsmanshipReq || 0) || stats.control < (craft.controlReq || 0)) return null;
  const candidates = ACTION_NAMES.filter((name) => {
    const action = ACTIONS.get(name); if (!action) return false;
    return action.getLevelRequirement().level <= stats.level && (targetQuality > 0 || !name.includes("Touch") && !["Reflect","Innovation","GreatStrides","ByregotsBlessing","TrainedFinesse"].includes(name));
  });
  let beam: Array<{ names: string[]; sim: Simulation; score: number }> = [{ names: [], sim: simulate(craft, stats, []), score: 0 }];
  let best: { names: string[]; sim: Simulation } | null = null;
  search: for (let depth = 0; depth < 35 && Date.now() < deadlineAt; depth += 1) {
    const next = new Map<string, { names: string[]; sim: Simulation; score: number }>();
    for (const node of beam) for (const name of candidates) {
      if (Date.now() >= deadlineAt) break search;
      if (node.sim.progression >= craft.progress) continue;
      const names = [...node.names, name];
      const sim = simulate(craft, stats, names);
      const last = sim.lastStep;
      if (!last || last.skipped || last.success === false) continue;
      if (sim.progression >= craft.progress) {
        if (!best || sim.quality > best.sim.quality || (sim.quality === best.sim.quality && names.length < best.names.length)) {
          best = { names, sim };
        }
        if (targetQuality === 0 || sim.quality >= targetQuality) break search;
        continue;
      }
      const value = score(sim, craft, targetQuality, names.length);
      const key = stateKey(sim); const current = next.get(key);
      if (!current || value > current.score) next.set(key, { names, sim, score: value });
    }
    beam = [...next.values()].sort((a,b) => b.score-a.score).slice(0, 180);
    if (!beam.length) break;
  }
  if (!best) return null;
  return { actions: best.names, progress: Math.round(best.sim.progression), quality: Math.round(best.sim.quality), durability: best.sim.durability, cp: best.sim.availableCP, success: true };
}

export async function solveCraftProgressive(
  craft: Craft,
  stats: CalculatorStats,
  targetQuality: number,
  options: { timeLimitMs?: number; maxDepth?: number; beamWidth?: number; incumbentActions?: string[]; onProgress?: (progress: SolverProgress) => void } = {}
): Promise<SolverResult | null> {
  if (stats.craftsmanship < (craft.craftsmanshipReq || 0) || stats.control < (craft.controlReq || 0)) return null;
  const timeLimitMs = Math.max(1000, options.timeLimitMs || 15000);
  const maxDepth = Math.max(1, options.maxDepth || 45);
  const beamWidth = Math.max(50, options.beamWidth || 700);
  const startedAt = Date.now();
  const deadlineAt = startedAt + timeLimitMs;
  const candidates = ACTION_NAMES.filter((name) => {
    const action = ACTIONS.get(name); if (!action) return false;
    return action.getLevelRequirement().level <= stats.level && (targetQuality > 0 || !name.includes("Touch") && !["Reflect","Innovation","GreatStrides","ByregotsBlessing","TrainedFinesse","TrainedEye"].includes(name));
  });
  let beam: Array<{ names: string[]; sim: Simulation; score: number }> = [{ names: [], sim: simulate(craft, stats, []), score: 0 }];
  const incumbentSim = options.incumbentActions?.length ? simulate(craft, stats, options.incumbentActions) : null;
  let best: { names: string[]; sim: Simulation } | null = incumbentSim && incumbentSim.progression >= craft.progress
    ? { names: [...(options.incumbentActions || [])], sim: incumbentSim }
    : null;
  let explored = 0;
  let lastYieldAt = Date.now();
  let searchStopReason: NonNullable<SolverResult["searchStopReason"]> = "depth";

  search: for (let depth = 0; depth < maxDepth; depth += 1) {
    if (Date.now() >= deadlineAt) { searchStopReason = "time"; break; }
    const next = new Map<string, { names: string[]; sim: Simulation; score: number }>();
    for (const node of beam) for (const name of candidates) {
      if (Date.now() >= deadlineAt) { searchStopReason = "time"; break search; }
      if (node.sim.progression >= craft.progress) continue;
      const names = [...node.names, name];
      const sim = simulate(craft, stats, names);
      explored += 1;
      const last = sim.lastStep;
      if (last && !last.skipped && last.success !== false) {
        if (sim.progression >= craft.progress) {
          if (!best || sim.quality > best.sim.quality || (sim.quality === best.sim.quality && names.length < best.names.length)) best = { names, sim };
          if (targetQuality === 0 || sim.quality >= targetQuality) { searchStopReason = "target"; break search; }
        } else {
          const value = score(sim, craft, targetQuality, names.length);
          const key = stateKey(sim); const current = next.get(key);
          if (!current || value > current.score) next.set(key, { names, sim, score: value });
        }
      }
      if (Date.now() - lastYieldAt >= 35) {
        const elapsedMs = Date.now() - startedAt;
        options.onProgress?.({ percent: Math.min(98, Math.max(elapsedMs / timeLimitMs, (depth + 1) / maxDepth * .8) * 100), elapsedMs, depth: depth + 1, maxDepth, explored, bestQuality: best ? Math.round(best.sim.quality) : null });
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        lastYieldAt = Date.now();
      }
    }
    beam = [...next.values()].sort((a,b) => b.score-a.score).slice(0, beamWidth);
    if (!beam.length) { searchStopReason = "exhausted"; break; }
  }
  const elapsedMs = Date.now() - startedAt;
  options.onProgress?.({ percent: 100, elapsedMs, depth: best?.names.length || 0, maxDepth, explored, bestQuality: best ? Math.round(best.sim.quality) : null });
  if (!best) return null;
  return { actions: best.names, progress: Math.round(best.sim.progression), quality: Math.round(best.sim.quality), durability: best.sim.durability, cp: best.sim.availableCP, success: true, searchStopReason };
}

const DISPLAY: Record<string,string> = { BasicSynthesis:"Basic Synthesis",CarefulSynthesis:"Careful Synthesis",PrudentSynthesis:"Prudent Synthesis",MuscleMemory:"Muscle Memory",BasicTouch:"Basic Touch",StandardTouch:"Standard Touch",AdvancedTouch:"Advanced Touch",ByregotsBlessing:"Byregot's Blessing",PrudentTouch:"Prudent Touch",PreparatoryTouch:"Preparatory Touch",TrainedFinesse:"Trained Finesse",RefinedTouch:"Refined Touch",TrainedPerfection:"Trained Perfection",MastersMend:"Master's Mend",ImmaculateMend:"Immaculate Mend",WasteNot:"Waste Not",WasteNotII:"Waste Not II",GreatStrides:"Great Strides",DelicateSynthesis:"Delicate Synthesis" };
export function macroChunks(actions: string[]) {
  const lines = actions.map((name) => `/ac "${DISPLAY[name] || name.replace(/([a-z])([A-Z])/g,"$1 $2")}" <wait.${Math.max(2, Math.round(ACTIONS.get(name)?.getWaitDuration() || 3))}>`);
  const chunks: string[] = []; for (let i=0;i<lines.length;i+=15) chunks.push(lines.slice(i,i+15).join("\n")); return chunks;
}
