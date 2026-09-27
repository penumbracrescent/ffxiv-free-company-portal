import { ActionRowBuilder, EmbedBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { CraftingActionsRegistry, CrafterStats, Simulation } from "@ffxiv-teamcraft/simulator";

const JOBS = { Carpenter: 0, Blacksmith: 1, Armorer: 2, Goldsmith: 3, Leatherworker: 4, Weaver: 5, Alchemist: 6, Culinarian: 7 };
const JOB_ALIASES = { Woodworking: "Carpenter", Smithing: "Blacksmith", Armorcraft: "Armorer", Goldsmithing: "Goldsmith", Leatherworking: "Leatherworker", Clothcraft: "Weaver", Alchemy: "Alchemist", Cooking: "Culinarian" };
function normalizeJob(job) { return JOB_ALIASES[job] || job; }
const ACTION_NAMES = ["MuscleMemory", "Reflect", "TrainedEye", "Veneration", "Innovation", "GreatStrides", "WasteNotII", "WasteNot", "Manipulation", "TrainedPerfection", "BasicTouch", "StandardTouch", "AdvancedTouch", "RefinedTouch", "PrudentTouch", "PreparatoryTouch", "FocusedTouch", "TrainedFinesse", "ByregotsBlessing", "DelicateSynthesis", "Groundwork", "PrudentSynthesis", "FocusedSynthesis", "CarefulSynthesis", "BasicSynthesis", "Observe", "FinalAppraisal", "MastersMend", "ImmaculateMend"];
const ACTIONS = new Map(CraftingActionsRegistry.ALL_ACTIONS.map((entry) => [entry.name, entry.action]));
const DISPLAY = { BasicSynthesis: "Basic Synthesis", CarefulSynthesis: "Careful Synthesis", PrudentSynthesis: "Prudent Synthesis", MuscleMemory: "Muscle Memory", BasicTouch: "Basic Touch", StandardTouch: "Standard Touch", AdvancedTouch: "Advanced Touch", ByregotsBlessing: "Byregot's Blessing", PrudentTouch: "Prudent Touch", PreparatoryTouch: "Preparatory Touch", TrainedFinesse: "Trained Finesse", RefinedTouch: "Refined Touch", TrainedPerfection: "Trained Perfection", MastersMend: "Master's Mend", ImmaculateMend: "Immaculate Mend", WasteNot: "Waste Not", WasteNotII: "Waste Not II", GreatStrides: "Great Strides", DelicateSynthesis: "Delicate Synthesis" };
const SOLVE_COOLDOWN_MS = 8000;
const lastSolveByUser = new Map();

export async function ensureCrafterProfiles(pool) {
  await pool.query("create table if not exists portal_crafter_profiles(discord_user_id text not null,craft_job text not null check(craft_job in ('Carpenter','Blacksmith','Armorer','Goldsmith','Leatherworker','Weaver','Alchemist','Culinarian')),level integer not null check(level between 1 and 100),craftsmanship integer not null check(craftsmanship between 0 and 99999),control integer not null check(control between 0 and 99999),cp integer not null check(cp between 0 and 9999),specialist boolean not null default false,preferred_food_item_id bigint references portal_crafting_items(id) on delete set null,preferred_food_hq boolean not null default true,preferred_medicine_item_id bigint references portal_crafting_items(id) on delete set null,preferred_medicine_hq boolean not null default true,updated_at timestamptz not null default now(),primary key(discord_user_id,craft_job));");
}

export async function handleCraftMacroAutocomplete(interaction, pool) {
  const query = String(interaction.options.getFocused() || "").trim();
  if (query.length < 2) {
    await interaction.respond([]);
    return;
  }
  const rows = await pool.query("select distinct on(i.id) i.id::text value,i.name from portal_crafting_items i join portal_crafting_recipes r on r.output_item_id=i.id where i.source_kind='xivapi' and i.name ilike('%'||$1||'%') and r.durability>0 order by i.id,r.preferred desc limit 25", [query]);
  await interaction.respond(rows.rows.map((row) => ({ name: String(row.name).slice(0, 100), value: row.value })));
}

async function recipe(pool, itemId) {
  const result = await pool.query("select r.id::int,i.name,r.craft_job job,r.recipe_level::int \"recipeLevel\",r.class_job_level::int level,r.durability::int,r.difficulty::int,r.quality::int,r.conditions_flag::int \"conditionsFlag\",r.progress_divider::int \"progressDivider\",r.quality_divider::int \"qualityDivider\",r.progress_modifier::int \"progressModifier\",r.quality_modifier::int \"qualityModifier\",coalesce(r.required_craftsmanship,0)::int \"requiredCraftsmanship\",coalesce(r.required_control,0)::int \"requiredControl\",coalesce(r.required_quality,0)::int \"requiredQuality\",coalesce(r.stars,0)::int,r.can_hq \"canHq\",r.is_expert expert,r.is_collectable collectable from portal_crafting_recipes r join portal_crafting_items i on i.id=r.output_item_id where r.output_item_id=$1 and r.source_kind='xivapi' and r.durability>0 and r.difficulty>0 and r.progress_divider>0 and r.quality_divider>0 order by r.preferred desc,r.xivapi_id limit 1", [itemId]);
  if (result.rows[0]) result.rows[0].job = normalizeJob(result.rows[0].job);
  return result.rows[0] || null;
}

async function profile(pool, discordUserId, job) {
  const result = await pool.query("select p.level::int,p.craftsmanship::int,p.control::int,p.cp::int,p.specialist,p.preferred_food_hq,p.preferred_medicine_hq,fc.bonuses food_bonuses,fi.name food_name,mc.bonuses medicine_bonuses,mi.name medicine_name from portal_crafter_profiles p left join portal_crafting_consumables fc on fc.item_id=p.preferred_food_item_id left join portal_crafting_items fi on fi.id=fc.item_id left join portal_crafting_consumables mc on mc.item_id=p.preferred_medicine_item_id left join portal_crafting_items mi on mi.id=mc.item_id where p.discord_user_id=$1 and p.craft_job=$2", [discordUserId, job]);
  return result.rows[0] || null;
}

function input(id, label, value, placeholder) {
  const field = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder(placeholder);
  if (value !== null && value !== undefined) field.setValue(String(value));
  return new ActionRowBuilder().addComponents(field);
}

export async function handleCraftMacroCommand(interaction, pool) {
  await ensureCrafterProfiles(pool);
  const itemId = Number(interaction.options.getString("recipe", true));
  const goal = interaction.options.getString("goal") || "max";
  const craft = await recipe(pool, itemId);
  if (!craft) {
    await interaction.reply({ content: "That recipe is not simulation-ready yet. Try another result after the catalog sync completes.", flags: MessageFlags.Ephemeral });
    return;
  }
  const saved = await profile(pool, interaction.user.id, craft.job);
  const modal = new ModalBuilder().setCustomId("fae:craftmacro:" + itemId + ":" + goal).setTitle(String(craft.name).slice(0, 45));
  modal.addComponents(
    input("level", craft.job + " level (saved)", saved?.level ?? 100, "1-100"),
    input("craftsmanship", "Craftsmanship (saved)", saved?.craftsmanship ?? null, "Enter current Craftsmanship"),
    input("control", "Control (saved)", saved?.control ?? null, "Enter current Control"),
    input("cp", "CP (saved)", saved?.cp ?? null, "Enter current CP")
  );
  await interaction.showModal(modal);
}

function integer(interaction, id, min, max) {
  const value = Number.parseInt(interaction.fields.getTextInputValue(id), 10);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(id + " must be between " + min + " and " + max + ".");
  return value;
}

function makeCraft(row) {
  return { id: String(row.id), job: JOBS[row.job] ?? 0, rlvl: row.recipeLevel, lvl: row.level, durability: row.durability, quality: row.quality, progress: row.difficulty, stars: row.stars, hq: row.canHq ? 1 : 0, expert: row.expert, controlReq: row.requiredControl, craftsmanshipReq: row.requiredCraftsmanship, requiredQuality: row.requiredQuality, conditionsFlag: row.conditionsFlag, progressDivider: row.progressDivider, qualityDivider: row.qualityDivider, progressModifier: row.progressModifier, qualityModifier: row.qualityModifier, ingredients: [] };
}

function applyBonuses(base, choices) {
  const next = { ...base };
  for (const choice of choices) {
    for (const bonus of choice?.bonuses || []) {
      const hq = choice.hq;
      const value = Number(hq ? bonus.valueHq : bonus.value) || 0;
      const cap = Number(hq ? bonus.maxHq : bonus.max) || 0;
      const amount = bonus.relative ? Math.min(Math.floor(base[bonus.stat] * value / 100), cap) : value;
      if (["craftsmanship", "control", "cp"].includes(bonus.stat)) next[bonus.stat] += amount;
    }
  }
  return next;
}

function savedConsumables(saved) {
  return [
    saved?.food_bonuses ? { name: saved.food_name, bonuses: saved.food_bonuses, hq: saved.preferred_food_hq } : null,
    saved?.medicine_bonuses ? { name: saved.medicine_name, bonuses: saved.medicine_bonuses, hq: saved.preferred_medicine_hq } : null
  ].filter(Boolean);
}

function simulate(craft, stats, names) {
  const levels = Array(8).fill(stats.level);
  const crafter = new CrafterStats(craft.job, stats.craftsmanship, stats.control, stats.cp, Boolean(stats.specialist), false, stats.level, levels);
  return new Simulation(craft, names.map((name) => ACTIONS.get(name)).filter(Boolean), crafter).run(true, 100, true).simulation;
}

function stateKey(sim) {
  return [Math.round(sim.progression), Math.round(sim.quality), sim.durability, sim.availableCP, ...sim.buffs.map((buff) => buff.buff + ":" + buff.duration + ":" + buff.stacks).sort()].join("|");
}

function solve(craft, stats, target, deadlineAt = Date.now() + 15000) {
  if (stats.craftsmanship < (craft.craftsmanshipReq || 0) || stats.control < (craft.controlReq || 0)) return null;
  const candidates = ACTION_NAMES.filter((name) => ACTIONS.get(name)?.getLevelRequirement().level <= stats.level && (target > 0 || !name.includes("Touch") && !["Reflect", "Innovation", "GreatStrides", "ByregotsBlessing", "TrainedFinesse"].includes(name)));
  let beam = [{ names: [], sim: simulate(craft, stats, []), score: 0 }];
  let best = null;

  search: for (let depth = 0; depth < 45 && Date.now() < deadlineAt; depth += 1) {
    const next = new Map();
    for (const node of beam) {
      for (const name of candidates) {
        if (Date.now() >= deadlineAt) break search;
        if (node.sim.progression >= craft.progress) continue;
        const names = [...node.names, name];
        const sim = simulate(craft, stats, names);
        const last = sim.lastStep;
        if (!last || last.skipped || last.success === false) continue;
        if (sim.progression >= craft.progress) {
          if (!best || sim.quality > best.sim.quality || (sim.quality === best.sim.quality && names.length < best.names.length)) best = { names, sim };
          if (target === 0 || sim.quality >= target) break search;
          continue;
        }
        const quality = target ? Math.min(sim.quality / target, 1) : 1;
        const progress = Math.min(sim.progression / craft.progress, 1);
        const score = quality * 7600 + progress * (quality > 0.82 ? 4200 : 2100) + sim.durability * 3 + sim.availableCP * 0.4 - depth * 4;
        const key = stateKey(sim);
        const current = next.get(key);
        if (!current || score > current.score) next.set(key, { names, sim, score });
      }
    }
    beam = [...next.values()].sort((a, b) => b.score - a.score).slice(0, 300);
    if (!beam.length) break;
  }
  return best;
}

function consumableLabel(choice) {
  return choice.name + (choice.hq ? " HQ" : "");
}

async function recommendations(pool, craft, baseStats, target, baseline) {
  const rows = await pool.query("select c.id::int,i.name,i.can_be_hq \"canBeHq\",c.consumable_type type,c.bonuses from portal_crafting_consumables c join portal_crafting_items i on i.id=c.item_id where c.bonuses @> '[{\"stat\":\"craftsmanship\"}]'::jsonb or c.bonuses @> '[{\"stat\":\"control\"}]'::jsonb or c.bonuses @> '[{\"stat\":\"cp\"}]'::jsonb order by i.item_level desc nulls last,i.name asc limit 60");
  const score = (choice) => {
    const boosted = applyBonuses(baseStats, [{ ...choice, hq: Boolean(choice.canBeHq) }]);
    const craftsmanship = boosted.craftsmanship - baseStats.craftsmanship;
    const control = boosted.control - baseStats.control;
    const cp = boosted.cp - baseStats.cp;
    return target > 0 ? craftsmanship + control * 1.35 + cp * 10 : craftsmanship * 1.5 + control * 0.15 + cp * 10;
  };
  const foods = rows.rows.filter((row) => row.type === "food").sort((a, b) => score(b) - score(a)).slice(0, 4);
  const medicines = rows.rows.filter((row) => row.type === "medicine").sort((a, b) => score(b) - score(a)).slice(0, 4);
  const candidates = [
    ...foods.map((food) => [food]),
    ...medicines.map((medicine) => [medicine]),
    ...foods.flatMap((food) => medicines.map((medicine) => [food, medicine]))
  ];
  const deadline = Date.now() + 3000;
  const results = [];
  for (const items of candidates) {
    if (Date.now() >= deadline) break;
    const choices = items.map((item) => ({ ...item, hq: Boolean(item.canBeHq) }));
    const found = solve(craft, applyBonuses(baseStats, choices), target, deadline);
    if (!found) continue;
    if (baseline && (target === 0 || found.sim.quality <= baseline.sim.quality)) continue;
    results.push({ choices, found });
  }
  results.sort((a, b) => {
    if (!baseline && target === 0 && a.choices.length !== b.choices.length) return a.choices.length - b.choices.length;
    return b.found.sim.quality - a.found.sim.quality || a.choices.length - b.choices.length;
  });
  const unique = new Map();
  for (const result of results) {
    const label = result.choices.map(consumableLabel).join(" + ");
    if (!unique.has(label)) unique.set(label, result);
  }
  return [...unique.values()].slice(0, 3);
}

function macros(names) {
  const lines = names.map((name) => "/ac \"" + (DISPLAY[name] || name.replace(/([a-z])([A-Z])/g, "$1 $2")) + "\" <wait." + Math.max(2, Math.round(ACTIONS.get(name)?.getWaitDuration() || 3)) + ">");
  const chunks = [];
  for (let index = 0; index < lines.length; index += 15) chunks.push(lines.slice(index, index + 15).join("\n"));
  return chunks;
}

export async function handleCraftMacroModal(interaction, pool) {
  if (!interaction.isModalSubmit() || !interaction.customId.startsWith("fae:craftmacro:")) return false;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const previous = Number(lastSolveByUser.get(interaction.user.id) || 0);
  const remaining = SOLVE_COOLDOWN_MS - (Date.now() - previous);
  if (remaining > 0) {
    await interaction.editReply({ content: "Please wait " + Math.ceil(remaining / 1000) + " seconds before generating another macro." });
    return true;
  }
  lastSolveByUser.set(interaction.user.id, Date.now());

  try {
    await ensureCrafterProfiles(pool);
    const parts = interaction.customId.split(":");
    const itemId = Number(parts[2]);
    const goal = parts[3] || "max";
    const craftRow = await recipe(pool, itemId);
    if (!craftRow) throw new Error("That recipe is no longer available.");

    const entered = {
      level: integer(interaction, "level", 1, 100),
      craftsmanship: integer(interaction, "craftsmanship", 0, 99999),
      control: integer(interaction, "control", 0, 99999),
      cp: integer(interaction, "cp", 0, 9999)
    };
    const saved = await profile(pool, interaction.user.id, craftRow.job);
    const baseStats = { ...entered, specialist: Boolean(saved?.specialist) };

    await pool.query("insert into portal_crafter_profiles(discord_user_id,craft_job,level,craftsmanship,control,cp,updated_at) values($1,$2,$3,$4,$5,$6,now()) on conflict(discord_user_id,craft_job) do update set level=excluded.level,craftsmanship=excluded.craftsmanship,control=excluded.control,cp=excluded.cp,updated_at=now()", [interaction.user.id, craftRow.job, entered.level, entered.craftsmanship, entered.control, entered.cp]);

    const selectedConsumables = savedConsumables(saved);
    const effectiveStats = applyBonuses(baseStats, selectedConsumables);
    const craft = makeCraft(craftRow);
    const target = goal === "complete" ? 0 : craft.quality;
    let found = solve(craft, effectiveStats, target);
    let macroConsumables = selectedConsumables;
    const suggested = await recommendations(pool, craft, baseStats, target, found);

    if (!found) {
      const viable = suggested[0];
      if (viable) {
        found = viable.found;
        macroConsumables = viable.choices;
      }
    }

    if (!found) {
      const preferenceText = selectedConsumables.length ? " Saved food/medicine were included." : "";
      await interaction.editReply({ content: "The calculator could not find a deterministic macro for **" + craftRow.name + "** with those stats or the available crafting consumables." + preferenceText + " Your " + craftRow.job + " profile was saved. Try the website calculator for more comparisons." });
      return true;
    }

    const chunks = macros(found.names);
    const recommendationWasRequired = macroConsumables !== selectedConsumables;
    const consumableText = macroConsumables.length ? "\n" + (recommendationWasRequired ? "Use with this macro: " : "Using saved consumables: ") + macroConsumables.map(consumableLabel).join(" + ") : "";
    const expertText = craftRow.expert ? "\nWarning: Expert recipes cannot be guaranteed by a fixed macro; test it with Trial Synthesis." : "";
    const description = found.names.length + " steps | " + craftRow.job + " profile saved" + consumableText + "\nProgress " + Math.round(found.sim.progression) + "/" + craft.progress + " | " + (craftRow.collectable ? "Collectability " + Math.floor(found.sim.quality / 10) : "Quality " + Math.round(found.sim.quality) + "/" + (target || "not targeted")) + " | " + found.sim.availableCP + " CP remaining" + expertText;
    const card = new EmbedBuilder().setColor(0x9333ea).setTitle(craftRow.name + " macro").setDescription(description);
    if (suggested.length) card.addFields({ name: recommendationWasRequired ? "Consumables for this macro" : "Consumables that can improve quality", value: suggested.map((option, index) => (index + 1) + ". " + option.choices.map(consumableLabel).join(" + ") + " — " + (craftRow.collectable ? "collectability " + Math.floor(option.found.sim.quality / 10) : "quality " + Math.round(option.found.sim.quality))).join("\n") });
    chunks.forEach((chunk, index) => card.addFields({ name: "Macro " + (index + 1) + " of " + chunks.length, value: "```\n" + chunk + "\n```" }));
    await interaction.editReply({ embeds: [card] });
  } catch (error) {
    await interaction.editReply({ content: error instanceof Error ? error.message : "The macro could not be generated.", embeds: [] });
  }
  return true;
}
