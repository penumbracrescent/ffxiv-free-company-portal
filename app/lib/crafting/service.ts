import { Client } from "pg";
import { calculateCraftingRequirements } from "./calculator";
import { rankCraftingCatalogItems } from "./catalog-search";
import type { CraftingActor, CraftingClaimStatus, CraftingContributionQuality, CraftingItem, CraftingItemSource, CraftingPhaseReadiness, CraftingProjectStatus, CraftingProjectType, CraftingRequirementRow, CraftingWorkshopResult } from "./types";

type ProjectSummary = { id: number; title: string; projectType: CraftingProjectType; status: CraftingProjectStatus; currentPhaseNumber: number | null; dueAt: string | null; leadName: string | null; templateName: string | null; phaseCount: number; };
type PhaseMaterial = { id: number; itemId: number; itemName: string; iconUrl: string | null; canBeHq: boolean; level: number | null; itemLevel: number | null; actualQuantity: number; baseQuantity: number; workshopBatchQuantity: number; baseBatchCount: number; reducedBatchCount: number; sortOrder: number; };
type ProjectPhase = { id: number; phaseNumber: number; title: string; description: string | null; status: string; progressResult: string; materials: PhaseMaterial[]; readiness: CraftingPhaseReadiness; };

type Dashboard = {
  templates: Array<{ id: number; name: string; category: string; description: string | null; isDevelopmentFixture: boolean }>;
  leadOptions: Array<{ id: number; name: string }>;
  projects: ProjectSummary[];
  selectedProject: null | { id: number; title: string; status: CraftingProjectStatus; notes: string | null; dueAt: string | null; leadName: string | null; currentPhaseNumber: number | null; phases: ProjectPhase[]; selectedPhase: ProjectPhase; requirements: CraftingRequirementRow[]; discordPost: null | { targetChannelKind: "crafting" | "test"; channelId: string | null; messageId: string | null; lastRefreshedAt: string | null; lastError: string | null }; contributions: Array<{ id: number; itemName: string; quantity: number; quality: string; contributorName: string; note: string | null; createdAt: string }>; claims: Array<{ id: number; itemName: string; quantity: number; claimantName: string; claimantCharacterId: number; status: string; createdAt: string }>; contributors: Array<{ name: string; total: number }>; activity: Array<{ actionType: string; actorName: string | null; createdAt: string; metadata: Record<string, unknown> }> };
};

function clientForCrafting() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  return new Client({ connectionString });
}

function toInt(value: unknown) { return Number.parseInt(String(value ?? ""), 10); }
function validPositive(value: unknown) { const number = toInt(value); return Number.isFinite(number) && number > 0 ? number : null; }

async function getCalculationContext(client: Client, projectId: number, phaseId: number) {
  /* Only load the portion of the recipe graph needed by this phase. Once
     the full XIVAPI catalog is present, loading every item on every page
     view would make the workshop unnecessarily slow. */
  const materialResult = await client.query<{ id: number; item_id: number; actual_quantity: number }>(
    `select id::int, item_id::int, actual_quantity from portal_crafting_project_materials where project_phase_id = $1 order by sort_order, id;`,
    [phaseId]
  );
  const topLevelItemIds = materialResult.rows.map((row) => row.item_id);
  const dependencyResult = topLevelItemIds.length
    ? await client.query<{ item_id: number }>(`
        with recursive needed(item_id, path, depth) as (
          select seed.item_id, array[seed.item_id]::bigint[], 0
          from unnest($1::bigint[]) as seed(item_id)
          union all
          select ingredient.item_id, needed.path || ingredient.item_id, needed.depth + 1
          from needed
          join portal_crafting_recipes recipe on recipe.output_item_id = needed.item_id
          join portal_crafting_recipe_ingredients ingredient on ingredient.recipe_id = recipe.id
          where needed.depth < 16 and not ingredient.item_id = any(needed.path)
        )
        select distinct item_id::int from needed;`, [topLevelItemIds])
    : { rows: [] as Array<{ item_id: number }> };
  const catalogItemIds = dependencyResult.rows.map((row) => row.item_id);
  // A node-postgres Client can only execute one query at a time.
  const catalogResult = await client.query<{ id: number; name: string; icon_url: string | null; can_be_hq: boolean; is_raw: boolean; level: number | null; item_level: number | null }>(
    `select id::int, name, icon_url, can_be_hq, is_raw,
      nullif(level_equip, 0)::int as level,
      nullif(item_level, 0)::int as item_level
     from portal_crafting_items where id = any($1::bigint[]) order by name;`, [catalogItemIds]);
  const recipeResult = await client.query<{ id: number; output_item_id: number; output_quantity: number; preferred: boolean }>(
    `select id::int, output_item_id::int, output_quantity, preferred from portal_crafting_recipes where output_item_id = any($1::bigint[]);`, [catalogItemIds]);
  const sourceResult = await client.query<{ item_id: number; type: CraftingItemSource["type"]; name: string | null; location: string | null; details: { x?: unknown; y?: unknown } | null }>(
    `select item_id::int, source_type as type, source_name as name, location_name as location, details
     from portal_crafting_item_sources where item_id = any($1::bigint[]) order by source_type, source_name, location_name;`, [catalogItemIds]);
  const contributionResult = await client.query<{ item_id: number; total: number; nq: number; hq: number }>(`select item_id::int, sum(quantity)::int as total,
    sum(case when quality = 'nq' then quantity else 0 end)::int as nq,
    sum(case when quality = 'hq' then quantity else 0 end)::int as hq
    from portal_crafting_contributions where project_phase_id = $1 and reversed_at is null group by item_id;`, [phaseId]);
  const claimResult = await client.query<{ item_id: number; total: number }>(`select item_id::int, sum(quantity)::int as total from portal_crafting_claims where project_phase_id = $1 and status = 'active' group by item_id;`, [phaseId]);
  const overrideResult = await client.query<{ item_id: number; recipe_id: number }>(`select item_id::int, recipe_id::int from portal_crafting_project_recipe_overrides where project_id = $1;`, [projectId]);
  const recipeIds = recipeResult.rows.map((row) => row.id);
  const ingredientResult = recipeIds.length
    ? await client.query<{ recipe_id: number; item_id: number; quantity: number }>(
        `select recipe_id::int, item_id::int, quantity from portal_crafting_recipe_ingredients where recipe_id = any($1::bigint[]);`, [recipeIds])
    : { rows: [] as Array<{ recipe_id: number; item_id: number; quantity: number }> };
  const ingredientByRecipe = new Map<number, Array<{ recipeId: number; itemId: number; quantity: number }>>();
  for (const row of ingredientResult.rows) {
    const rows = ingredientByRecipe.get(row.recipe_id) ?? [];
    rows.push({ recipeId: row.recipe_id, itemId: row.item_id, quantity: row.quantity });
    ingredientByRecipe.set(row.recipe_id, rows);
  }
  const sourcesByItem = new Map<number, CraftingItemSource[]>();
  for (const source of sourceResult.rows) {
    const sources = sourcesByItem.get(source.item_id) ?? [];
    const x = Number(source.details?.x);
    const y = Number(source.details?.y);
    sources.push({ type: source.type, name: source.name, location: source.location, coordinates: Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null });
    sourcesByItem.set(source.item_id, sources);
  }
  const items: CraftingItem[] = catalogResult.rows.map((row) => ({ id: row.id, name: row.name, iconUrl: row.icon_url, canBeHq: row.can_be_hq, isRaw: row.is_raw, level: row.level, itemLevel: row.item_level, sources: sourcesByItem.get(row.id) ?? [] }));
  const recipes = recipeResult.rows.map((row) => ({ id: row.id, outputItemId: row.output_item_id, outputQuantity: row.output_quantity, preferred: row.preferred, ingredients: ingredientByRecipe.get(row.id) ?? [] }));
  const contributions = new Map(contributionResult.rows.map((row) => [row.item_id, { total: Number(row.total), nq: Number(row.nq), hq: Number(row.hq) }]));
  const claims = new Map(claimResult.rows.map((row) => [row.item_id, Number(row.total)]));
  const overrides = new Map(overrideResult.rows.map((row) => [row.item_id, row.recipe_id]));
  return {
    materials: materialResult.rows,
    requirements: calculateCraftingRequirements({ topLevel: materialResult.rows.map((row) => ({ itemId: row.item_id, quantity: row.actual_quantity })), items, recipes, contributionsByItem: contributions, claimsByItem: claims, recipeOverrides: overrides }),
    itemById: new Map(items.map((item) => [item.id, item])),
    contributions
  };
}

async function loadProjectDetail(client: Client, projectId: number, selectedPhaseNumber?: number): Promise<Dashboard["selectedProject"]> {
  const project = await client.query<{ id: number; title: string; status: CraftingProjectStatus; notes: string | null; due_at: string | null; current_phase_number: number | null; lead_name: string | null }>(`
    select p.id::int, p.title, p.status, p.notes, p.due_at::text, p.current_phase_number,
      coalesce(lead.character_name, lead.display_name) as lead_name
    from portal_crafting_projects p left join portal_characters lead on lead.id = p.lead_character_id where p.id = $1 limit 1;`, [projectId]);
  const projectRow = project.rows[0];
  if (!projectRow) return null;
  const discordPostResult = await client.query<{ target_channel_kind: "crafting" | "test"; channel_id: string | null; message_id: string | null; last_refreshed_at: string | null; last_error: string | null }>(`select target_channel_kind, channel_id, message_id, last_refreshed_at::text, last_error from portal_crafting_project_discord_posts where project_id=$1 limit 1;`, [projectId]);
  const phaseRows = await client.query<{ id: number; phase_number: number; title: string; description: string | null; status: string; progress_result: string }>(`select id::int, phase_number, title, description, status, progress_result from portal_crafting_project_phases where project_id = $1 order by phase_number;`, [projectId]);
  if (!phaseRows.rows.length) return null;
  const materialRows = await client.query<{ id: number; project_phase_id: number; item_id: number; name: string; icon_url: string | null; can_be_hq: boolean; level: number | null; item_level: number | null; actual_quantity: number; base_quantity: number; workshop_batch_quantity: number; base_batch_count: number; reduced_batch_count: number; sort_order: number }>(`
    select pm.id::int, pm.project_phase_id::int, pm.item_id::int, i.name, i.icon_url, i.can_be_hq,
      nullif(i.level_equip, 0)::int as level,
      nullif(i.item_level, 0)::int as item_level,
      pm.actual_quantity, pm.base_quantity, pm.workshop_batch_quantity, pm.base_batch_count, pm.reduced_batch_count, pm.sort_order
    from portal_crafting_project_materials pm join portal_crafting_items i on i.id = pm.item_id
    where pm.project_phase_id = any($1::bigint[]) order by pm.sort_order, i.name;`, [phaseRows.rows.map((phase) => phase.id)]);
  const contributionsByPhase = await client.query<{ project_phase_id: number; project_material_id: number | null; quantity: number }>(`select project_phase_id::int, project_material_id::int, sum(quantity)::int as quantity from portal_crafting_contributions where project_id = $1 and reversed_at is null group by project_phase_id, project_material_id;`, [projectId]);
  const phaseMaterialMap = new Map<number, PhaseMaterial[]>();
  for (const material of materialRows.rows) {
    const rows = phaseMaterialMap.get(material.project_phase_id) ?? [];
    rows.push({ id: material.id, itemId: material.item_id, itemName: material.name, iconUrl: material.icon_url, canBeHq: material.can_be_hq, level: material.level, itemLevel: material.item_level, actualQuantity: material.actual_quantity, baseQuantity: material.base_quantity, workshopBatchQuantity: material.workshop_batch_quantity, baseBatchCount: material.base_batch_count, reducedBatchCount: material.reduced_batch_count, sortOrder: material.sort_order });
    phaseMaterialMap.set(material.project_phase_id, rows);
  }
  const directContributed = new Map<number, number>();
  for (const row of contributionsByPhase.rows) if (row.project_material_id) directContributed.set(row.project_material_id, Number(row.quantity));
  const phases: ProjectPhase[] = phaseRows.rows.map((phase) => {
    const materials = phaseMaterialMap.get(phase.id) ?? [];
    const completeRows = materials.filter((material) => (directContributed.get(material.id) ?? 0) >= material.actualQuantity).length;
    return { id: phase.id, phaseNumber: phase.phase_number, title: phase.title, description: phase.description, status: phase.status, progressResult: phase.progress_result, materials,
      readiness: { directRequired: materials.reduce((sum, material) => sum + material.actualQuantity, 0), directContributed: materials.reduce((sum, material) => sum + Math.min(material.actualQuantity, directContributed.get(material.id) ?? 0), 0), completeRows, totalRows: materials.length, ready: materials.length > 0 && completeRows === materials.length } };
  });
  const selectedPhase = phases.find((phase) => phase.phaseNumber === selectedPhaseNumber) ?? phases.find((phase) => phase.phaseNumber === projectRow.current_phase_number) ?? phases[0];
  const context = await getCalculationContext(client, projectId, selectedPhase.id);
  const contributionResult = await client.query<{ id: number; item_name: string; quantity: number; quality: string; contributor_name: string; note: string | null; created_at: string }>(`select c.id::int, i.name as item_name, c.quantity, c.quality, c.contributor_name_snapshot as contributor_name, c.note, c.created_at::text from portal_crafting_contributions c join portal_crafting_items i on i.id = c.item_id where c.project_phase_id = $1 and c.reversed_at is null order by c.created_at desc limit 30;`, [selectedPhase.id]);
  const claimResult = await client.query<{ id: number; item_name: string; quantity: number; claimant_name: string; claimant_character_id: number; status: string; created_at: string }>(`select c.id::int, i.name as item_name, c.quantity, c.claimant_name_snapshot as claimant_name, c.claimant_character_id::int, c.status, c.created_at::text from portal_crafting_claims c join portal_crafting_items i on i.id = c.item_id where c.project_phase_id = $1 order by c.created_at desc;`, [selectedPhase.id]);
  const contributorResult = await client.query<{ name: string; total: number }>(`select contributor_name_snapshot as name, sum(quantity)::int as total from portal_crafting_contributions where project_id = $1 and reversed_at is null group by contributor_name_snapshot order by total desc, name limit 12;`, [projectId]);
  const activityResult = await client.query<{ action_type: string; actor_name_snapshot: string | null; created_at: string; metadata: Record<string, unknown> }>(`select action_type, actor_name_snapshot, created_at::text, metadata from portal_crafting_activity where project_id = $1 order by created_at desc limit 30;`, [projectId]);
  const discordPostRow = discordPostResult.rows[0] ?? null;
  return { id: projectRow.id, title: projectRow.title, status: projectRow.status, notes: projectRow.notes, dueAt: projectRow.due_at, leadName: projectRow.lead_name, currentPhaseNumber: projectRow.current_phase_number, phases, selectedPhase, requirements: context.requirements, discordPost: discordPostRow ? { targetChannelKind: discordPostRow.target_channel_kind, channelId: discordPostRow.channel_id, messageId: discordPostRow.message_id, lastRefreshedAt: discordPostRow.last_refreshed_at, lastError: discordPostRow.last_error } : null, contributions: contributionResult.rows.map((row) => ({ id: row.id, itemName: row.item_name, quantity: row.quantity, quality: row.quality, contributorName: row.contributor_name, note: row.note, createdAt: row.created_at })), claims: claimResult.rows.map((row) => ({ id: row.id, itemName: row.item_name, quantity: row.quantity, claimantName: row.claimant_name, claimantCharacterId: row.claimant_character_id, status: row.status, createdAt: row.created_at })), contributors: contributorResult.rows.map((row) => ({ name: row.name, total: Number(row.total) })), activity: activityResult.rows.map((row) => ({ actionType: row.action_type, actorName: row.actor_name_snapshot, createdAt: row.created_at, metadata: row.metadata ?? {} })) };
}

export async function getCraftingWorkshopDashboard(input: { projectId?: number; phaseNumber?: number; }): Promise<Dashboard> {
  const client = clientForCrafting(); await client.connect();
  try {
    await reconcileCraftingProjectProgress(client);
    const templates = await client.query<{ id: number; name: string; category: string; description: string | null; isDevelopmentFixture: boolean }>(`select id::int, name, category, description, is_development_fixture as "isDevelopmentFixture" from portal_crafting_workshop_templates where active = true order by is_development_fixture, category, name;`);
    const projects = await client.query<ProjectSummary>(`select p.id::int, p.title, p.project_type as "projectType", p.status, p.current_phase_number as "currentPhaseNumber", p.due_at::text as "dueAt", coalesce(lead.character_name, lead.display_name) as "leadName", t.name as "templateName", count(ph.id)::int as "phaseCount" from portal_crafting_projects p left join portal_crafting_workshop_templates t on t.id=p.template_id left join portal_characters lead on lead.id=p.lead_character_id left join portal_crafting_project_phases ph on ph.project_id=p.id where p.status in ('draft','active','completed') group by p.id, lead.character_name, lead.display_name, t.name order by case p.status when 'active' then 0 when 'draft' then 1 else 2 end, p.updated_at desc;`);
    const leadOptions = await client.query<{ id: number; name: string }>(`select id::int, coalesce(character_name, display_name) as name from portal_characters where active=true and fc_membership_status='current' order by character_name;`);
    const selectedId = input.projectId && projects.rows.some((project) => project.id === input.projectId) ? input.projectId : projects.rows[0]?.id;
    return { templates: templates.rows, leadOptions: leadOptions.rows, projects: projects.rows, selectedProject: selectedId ? await loadProjectDetail(client, selectedId, input.phaseNumber) : null };
  } finally { await client.end(); }
}
function requireLinkedActor(actor: CraftingActor) {
  if (!actor.characterId || !actor.characterName || !actor.discordUserId) throw new Error("Crafting contributions and claims require a Discord-linked active FC character.");
}
async function insertActivity(client: Client, projectId: number, phaseId: number | null, actor: CraftingActor, actionType: string, metadata: Record<string, unknown>) {
  await client.query(`insert into portal_crafting_activity (project_id, project_phase_id, action_type, actor_character_id, actor_discord_user_id, actor_name_snapshot, metadata) values ($1,$2,$3,$4,$5,$6,$7::jsonb);`, [projectId, phaseId, actionType, actor.characterId, actor.discordUserId, actor.characterName, JSON.stringify(metadata)]);
}

async function queueCraftingDiscordRefresh(client: Client, projectId: number, actor: CraftingActor) {
  const post = await client.query<{ project_id: number }>(`select project_id::int from portal_crafting_project_discord_posts where project_id=$1 limit 1;`, [projectId]);
  if (!post.rows[0]) return;
  const queueKey = `__crafting_project_${projectId}__`;
  await client.query(`
    insert into portal_discord_action_queue
      (discord_user_id, action_type, action_payload, status, requested_by, requested_at, updated_at)
    values ($1, 'refresh_crafting_project', $2::jsonb, 'pending', $3, now(), now())
    on conflict (discord_user_id, action_type) where status='pending'
    do update set action_payload=excluded.action_payload, requested_by=excluded.requested_by, requested_at=now(), updated_at=now();`,
    [queueKey, JSON.stringify({ projectId }), actor.characterName || 'Crafting portal']
  );
}

function optionalCraftingDiscordTarget(formData: FormData): "crafting" | "test" | null {
  const targetChannelKind = String(formData.get("discordTargetChannelKind") ?? formData.get("targetChannelKind") ?? "none");
  if (targetChannelKind === "none" || !targetChannelKind) return null;
  if (targetChannelKind !== "crafting" && targetChannelKind !== "test") throw new Error("Choose the Crafting Channel, Test Channel, or no Discord post.");
  return targetChannelKind as "crafting" | "test";
}

async function requestCraftingDiscordPost(client: Client, projectId: number, actor: CraftingActor, targetChannelKind: "crafting" | "test") {
  await client.query(`
    insert into portal_crafting_project_discord_posts
      (project_id, target_channel_kind, posted_by_character_id, posted_by_discord_user_id, updated_at)
    values ($1,$2,$3,$4,now())
    on conflict (project_id) do update set
      target_channel_kind=excluded.target_channel_kind,
      channel_id=null,
      message_id=null,
      posted_by_character_id=excluded.posted_by_character_id,
      posted_by_discord_user_id=excluded.posted_by_discord_user_id,
      last_error=null,
      updated_at=now();`, [projectId, targetChannelKind, actor.characterId, actor.discordUserId]);
  await insertActivity(client, projectId, null, actor, "discord_post_requested", { targetChannelKind });
  await queueCraftingDiscordRefresh(client, projectId, actor);
}
export async function publishCraftingProjectToDiscord(actor: CraftingActor, formData: FormData) {
  if (!actor.isOfficer) throw new Error("Officer access is required to post a crafting project to Discord.");
  const projectId = validPositive(formData.get("projectId"));
  const targetChannelKind = optionalCraftingDiscordTarget(formData);
  if (!projectId || !targetChannelKind) throw new Error("Choose the Crafting Channel or Test Channel.");
  const client = clientForCrafting(); await client.connect();
  try {
    await client.query("begin");
    const project = await client.query<{ id: number }>(`select id::int from portal_crafting_projects where id=$1 and status in ('draft','active','completed') for update;`, [projectId]);
    if (!project.rows[0]) throw new Error("That crafting project could not be found.");
    await requestCraftingDiscordPost(client, projectId, actor, targetChannelKind);
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; } finally { await client.end(); }
}
async function advanceReadyCraftingPhase(client: Client, projectId: number, actor: CraftingActor | null) {
  const projectResult = await client.query<{ status: CraftingProjectStatus; current_phase_number: number | null }>(`select status, current_phase_number from portal_crafting_projects where id=$1 for update;`, [projectId]);
  const project = projectResult.rows[0];
  if (!project || project.status !== "active" || !project.current_phase_number) return false;
  const phaseResult = await client.query<{ id: number; phase_number: number; status: string }>(`select id::int, phase_number, status from portal_crafting_project_phases where project_id=$1 and phase_number=$2 for update;`, [projectId, project.current_phase_number]);
  const phase = phaseResult.rows[0];
  if (!phase || phase.status !== "active") return false;
  const readiness = await client.query<{ material_count: number; complete_count: number }>(`
    select count(pm.id)::int as material_count,
      count(pm.id) filter (where coalesce(contributed.quantity, 0) >= pm.actual_quantity)::int as complete_count
    from portal_crafting_project_materials pm
    left join (select project_material_id, sum(quantity)::int as quantity from portal_crafting_contributions where project_phase_id=$1 and reversed_at is null and project_material_id is not null group by project_material_id) contributed on contributed.project_material_id=pm.id
    where pm.project_phase_id=$1;`, [phase.id]);
  const summary = readiness.rows[0];
  if (!summary || summary.material_count === 0 || summary.complete_count !== summary.material_count) return false;
  const systemActor: CraftingActor = actor ?? { characterId: null, characterName: null, discordUserId: null, isOfficer: true };
  await client.query(`update portal_crafting_project_phases set status='ready' where id=$1 and status='active';`, [phase.id]);
  await insertActivity(client, projectId, phase.id, systemActor, "phase_ready", { phaseNumber: phase.phase_number });
  await client.query(`update portal_crafting_project_phases set status='completed', completed_at=now() where id=$1;`, [phase.id]);
  await insertActivity(client, projectId, phase.id, systemActor, "phase_completed", { phaseNumber: phase.phase_number });
  const nextResult = await client.query<{ id: number; phase_number: number }>(`select id::int, phase_number from portal_crafting_project_phases where project_id=$1 and phase_number>$2 and status='provisional' order by phase_number limit 1 for update;`, [projectId, phase.phase_number]);
  const next = nextResult.rows[0];
  if (next) {
    await client.query(`update portal_crafting_project_phases set status='active', activated_at=coalesce(activated_at, now()) where id=$1;`, [next.id]);
    await client.query(`update portal_crafting_projects set current_phase_number=$1, updated_at=now() where id=$2;`, [next.phase_number, projectId]);
    await insertActivity(client, projectId, next.id, systemActor, "phase_activated", { phaseNumber: next.phase_number });
  } else {
    await client.query(`update portal_crafting_projects set status='completed', completed_at=now(), updated_at=now() where id=$1;`, [projectId]);
    await insertActivity(client, projectId, phase.id, systemActor, "project_completed", { finalPhaseNumber: phase.phase_number });
  }
  await queueCraftingDiscordRefresh(client, projectId, systemActor);
  return true;
}

async function reconcileCraftingProjectProgress(client: Client) {
  await client.query("begin");
  try {
    const activeProjects = await client.query<{ id: number }>(`select id::int from portal_crafting_projects where status='active' order by id for update;`);
    for (const project of activeProjects.rows) while (await advanceReadyCraftingPhase(client, project.id, null)) { /* advance every already-complete phase */ }
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; }
}
export async function createDevelopmentWorkshopProject(actor: CraftingActor, formData: FormData) {
  if (!actor.isOfficer) throw new Error("Only officers can create workshop projects.");
  const templateId = validPositive(formData.get("templateId"));
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  const leadCharacterId = validPositive(formData.get("leadCharacterId"));
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000) || null;
  const dueValue = String(formData.get("dueAt") ?? "").trim();
  const discordTargetChannelKind = optionalCraftingDiscordTarget(formData);
  if (!templateId || !title) throw new Error("Choose a workshop template and enter a project title.");
  const client = clientForCrafting(); await client.connect();
  try {
    await client.query("begin");
    const template = await client.query<{ id: number; is_development_fixture: boolean }>(`select id::int, is_development_fixture from portal_crafting_workshop_templates where id=$1 and active=true limit 1 for share;`, [templateId]);
    if (!template.rows[0]) throw new Error("That workshop template is unavailable.");
    const phaseTemplates = await client.query<{ id: number; phase_number: number; title: string; description: string | null }>(`select id::int, phase_number, title, description from portal_crafting_workshop_template_phases where template_id=$1 order by phase_number;`, [templateId]);
    if (!phaseTemplates.rows.length) throw new Error("The template has no phases.");
    const project = await client.query<{ id: number }>(`insert into portal_crafting_projects (project_type, template_id, title, status, lead_character_id, created_by_character_id, created_by_discord_user_id, notes, due_at, current_phase_number) values ('workshop_project',$1,$2,'active',$3,$4,$5,$6,nullif($7,'')::timestamptz,1) returning id::int;`, [templateId, title, leadCharacterId, actor.characterId, actor.discordUserId, notes, dueValue]);
    const projectId = project.rows[0].id;
    for (const phaseTemplate of phaseTemplates.rows) {
      const phase = await client.query<{ id: number }>(`insert into portal_crafting_project_phases (project_id,template_phase_id,phase_number,title,description,status,activated_at) values ($1,$2,$3,$4,$5,$6,case when $3=1 then now() else null end) returning id::int;`, [projectId, phaseTemplate.id, phaseTemplate.phase_number, phaseTemplate.title, phaseTemplate.description, phaseTemplate.phase_number === 1 ? "active" : "provisional"]);
      const materials = await client.query<{ item_id: number; base_quantity: number; workshop_batch_quantity: number; base_batch_count: number; sort_order: number }>(`select item_id::int, base_quantity, workshop_batch_quantity, base_batch_count, sort_order from portal_crafting_workshop_template_materials where template_phase_id=$1 order by sort_order;`, [phaseTemplate.id]);
      for (const material of materials.rows) await client.query(`insert into portal_crafting_project_materials (project_phase_id,item_id,base_quantity,actual_quantity,workshop_batch_quantity,base_batch_count,sort_order) values ($1,$2,$3,$3,$4,$5,$6);`, [phase.rows[0].id, material.item_id, material.base_quantity, material.workshop_batch_quantity, material.base_batch_count, material.sort_order]);
    }
    await insertActivity(client, projectId, null, actor, "project_created", { templateId, fixture: template.rows[0].is_development_fixture });
    if (discordTargetChannelKind) await requestCraftingDiscordPost(client, projectId, actor, discordTargetChannelKind);
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; } finally { await client.end(); }
}

export async function createCatalogCraftingRequest(actor: CraftingActor, formData: FormData) {
  if (!actor.isOfficer) throw new Error("Only officers can create catalog crafting requests.");
  const itemId = validPositive(formData.get("itemId"));
  const quantity = validPositive(formData.get("quantity"));
  const suppliedTitle = String(formData.get("title") ?? "").trim().slice(0, 120);
  const leadCharacterId = validPositive(formData.get("leadCharacterId"));
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000) || null;
  const dueValue = String(formData.get("dueAt") ?? "").trim();
  const discordTargetChannelKind = optionalCraftingDiscordTarget(formData);
  if (!itemId || !quantity) throw new Error("Choose a catalog item and enter a quantity.");

  const client = clientForCrafting(); await client.connect();
  try {
    await client.query("begin");
    const item = await client.query<{ id: number; name: string }>(
      `select i.id::int, i.name from portal_crafting_items i where i.id=$1 and i.source_kind='xivapi' and exists (select 1 from portal_crafting_recipes r where r.output_item_id=i.id and r.source_kind='xivapi' and nullif(trim(coalesce(r.craft_job, '')), '') is not null) limit 1 for share;`,
      [itemId]
    );
    if (!item.rows[0]) throw new Error("That real FFXIV catalog item is unavailable.");
    const title = suppliedTitle || `${quantity}× ${item.rows[0].name}`;
    const project = await client.query<{ id: number }>(`
      insert into portal_crafting_projects
        (project_type, title, status, lead_character_id, created_by_character_id, created_by_discord_user_id, notes, due_at, current_phase_number)
      values ('standard_request',$1,'active',$2,$3,$4,$5,nullif($6,'')::timestamptz,1)
      returning id::int;`, [title, leadCharacterId, actor.characterId, actor.discordUserId, notes, dueValue]);
    const projectId = project.rows[0].id;
    const phase = await client.query<{ id: number }>(`
      insert into portal_crafting_project_phases
        (project_id, phase_number, title, description, status, activated_at)
      values ($1,1,'Requested materials','Single-phase catalog crafting request.','active',now())
      returning id::int;`, [projectId]);
    await client.query(`
      insert into portal_crafting_project_materials
        (project_phase_id, item_id, base_quantity, actual_quantity, workshop_batch_quantity, base_batch_count, sort_order)
      values ($1,$2,$3,$3,1,$3,10);`, [phase.rows[0].id, itemId, quantity]);
    await insertActivity(client, projectId, phase.rows[0].id, actor, "catalog_request_created", { itemId, quantity, itemName: item.rows[0].name });
    if (discordTargetChannelKind) await requestCraftingDiscordPost(client, projectId, actor, discordTargetChannelKind);
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; } finally { await client.end(); }
}
export async function recordPreviousPhaseProgress(actor: CraftingActor, formData: FormData) {
  requireLinkedActor(actor);
  const projectId = validPositive(formData.get("projectId"));
  const sourcePhaseId = validPositive(formData.get("sourcePhaseId"));
  const targetPhaseId = validPositive(formData.get("targetPhaseId"));
  const result = String(formData.get("result") ?? "") as CraftingWorkshopResult;
  if (!projectId || !sourcePhaseId || !targetPhaseId || !["normal", "excellent", "outstanding"].includes(result)) {
    throw new Error("Choose a valid in-game phase result.");
  }

  const client = clientForCrafting(); await client.connect();
  try {
    await client.query("begin");
    const phases = await client.query<{ id: number; phase_number: number; status: string }>(
      `select id::int, phase_number, status from portal_crafting_project_phases where project_id=$1 and id = any($2::bigint[]) order by phase_number for update;`,
      [projectId, [sourcePhaseId, targetPhaseId]]
    );
    const source = phases.rows.find((phase) => phase.id === sourcePhaseId);
    const target = phases.rows.find((phase) => phase.id === targetPhaseId);
    if (!source || !target || source.status !== "completed" || target.status !== "active" || target.phase_number !== source.phase_number + 1) {
      throw new Error("Phase progress can only be recorded for the completed stage immediately before the active stage.");
    }
    const used = await client.query<{ used: boolean }>(
      `select exists(
        select 1 from portal_crafting_contributions where project_phase_id=$1 and reversed_at is null
        union all
        select 1 from portal_crafting_claims where project_phase_id=$1 and status='active'
      ) as used;`, [targetPhaseId]
    );
    if (used.rows[0]?.used) throw new Error("The next phase already has contributions or active reservations, so its result cannot be changed here.");

    const reductionFactor = result === "excellent" ? 1 : result === "outstanding" ? 2 : 0;
    await client.query(`update portal_crafting_project_phases set progress_result=$1 where id=$2;`, [result, sourcePhaseId]);
    await client.query(`
      update portal_crafting_project_materials
      set
        reduced_batch_count = floor((base_batch_count * $1)::numeric / 3)::int,
        actual_quantity = greatest(1, base_quantity - (workshop_batch_quantity * floor((base_batch_count * $1)::numeric / 3)::int))
      where project_phase_id=$2;`, [reductionFactor, targetPhaseId]);
    await insertActivity(client, projectId, targetPhaseId, actor, "previous_phase_progress_recorded", {
      sourcePhaseId, targetPhaseId, result,
      reduction: result === "normal" ? "none" : result === "excellent" ? "one-third" : "two-thirds"
    });
    await queueCraftingDiscordRefresh(client, projectId, actor);
    await advanceReadyCraftingPhase(client, projectId, actor);
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; } finally { await client.end(); }
}
export async function recordCraftingContribution(actor: CraftingActor, formData: FormData) {
  requireLinkedActor(actor);
  const projectId = validPositive(formData.get("projectId")); const phaseId = validPositive(formData.get("phaseId")); const itemId = validPositive(formData.get("itemId")); const quantity = validPositive(formData.get("quantity")); const projectMaterialId = validPositive(formData.get("projectMaterialId"));
  const quality = String(formData.get("quality") ?? "not_applicable") as CraftingContributionQuality;
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;
  if (!projectId || !phaseId || !itemId || !quantity || !["nq","hq","not_applicable"].includes(quality)) throw new Error("Enter a valid material contribution.");
  const client = clientForCrafting(); await client.connect();
  try {
    await client.query("begin");
    const status = await client.query<{ status: string; phase_status: string }>(`select p.status, ph.status as phase_status from portal_crafting_projects p join portal_crafting_project_phases ph on ph.project_id=p.id where p.id=$1 and ph.id=$2 for update;`, [projectId, phaseId]);
    if (!status.rows[0] || status.rows[0].status !== "active" || status.rows[0].phase_status !== "active") throw new Error("This workshop phase is not accepting contributions.");
    const context = await getCalculationContext(client, projectId, phaseId);
    const item = context.itemById.get(itemId); const requirement = context.requirements.find((row) => row.itemId === itemId);
    if (!item || !requirement) throw new Error("That material is not part of this phase.");
    if (projectMaterialId) {
      const material = context.materials.find((row) => row.id === projectMaterialId && row.item_id === itemId);
      if (!material) throw new Error("The selected top-level material does not match this phase.");
    }
    if (!actor.isOfficer && quantity > requirement.remaining) throw new Error(`Only ${requirement.remaining} of that material is still needed.`);
    const normalizedQuality: CraftingContributionQuality = item.canBeHq ? quality : "not_applicable";
    await client.query(`insert into portal_crafting_contributions (project_id,project_phase_id,project_material_id,item_id,contributor_character_id,contributor_discord_user_id,contributor_name_snapshot,quantity,quality,note) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10);`, [projectId, phaseId, projectMaterialId, itemId, actor.characterId, actor.discordUserId, actor.characterName, quantity, normalizedQuality, note]);
    await insertActivity(client, projectId, phaseId, actor, "contribution_added", { itemId, quantity, quality: normalizedQuality });
    await queueCraftingDiscordRefresh(client, projectId, actor);
    await advanceReadyCraftingPhase(client, projectId, actor);
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; } finally { await client.end(); }
}

export async function createCraftingClaim(actor: CraftingActor, formData: FormData) {
  requireLinkedActor(actor);
  const projectId = validPositive(formData.get("projectId")); const phaseId = validPositive(formData.get("phaseId")); const itemId = validPositive(formData.get("itemId")); const quantity = validPositive(formData.get("quantity")); const projectMaterialId = validPositive(formData.get("projectMaterialId"));
  if (!projectId || !phaseId || !itemId || !quantity) throw new Error("Enter a valid material claim.");
  const client = clientForCrafting(); await client.connect();
  try {
    await client.query("begin");
    const status = await client.query<{ status: string; phase_status: string }>(`select p.status, ph.status as phase_status from portal_crafting_projects p join portal_crafting_project_phases ph on ph.project_id=p.id where p.id=$1 and ph.id=$2 for update;`, [projectId, phaseId]);
    if (!status.rows[0] || status.rows[0].status !== "active" || status.rows[0].phase_status !== "active") throw new Error("This workshop phase is not accepting claims.");
    const context = await getCalculationContext(client, projectId, phaseId); const requirement = context.requirements.find((row) => row.itemId === itemId);
    if (!requirement) throw new Error("That material is not part of this phase.");
    if (projectMaterialId && !context.materials.some((row) => row.id === projectMaterialId && row.item_id === itemId)) throw new Error("The selected top-level material does not match this phase.");
    if (!actor.isOfficer && quantity > requirement.unclaimed) throw new Error(`Only ${requirement.unclaimed} unclaimed of that material remains.`);
    await client.query(`insert into portal_crafting_claims (project_id,project_phase_id,project_material_id,item_id,claimant_character_id,claimant_discord_user_id,claimant_name_snapshot,quantity) values ($1,$2,$3,$4,$5,$6,$7,$8);`, [projectId, phaseId, projectMaterialId, itemId, actor.characterId, actor.discordUserId, actor.characterName, quantity]);
    await insertActivity(client, projectId, phaseId, actor, "claim_created", { itemId, quantity });
    await queueCraftingDiscordRefresh(client, projectId, actor);
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; } finally { await client.end(); }
}

export async function releaseCraftingClaim(actor: CraftingActor, formData: FormData) {
  requireLinkedActor(actor); const claimId = validPositive(formData.get("claimId")); if (!claimId) throw new Error("That claim is invalid.");
  const client = clientForCrafting(); await client.connect();
  try {
    await client.query("begin");
    const claim = await client.query<{ project_id: number; project_phase_id: number; item_id: number; claimant_character_id: number }>(`select project_id::int, project_phase_id::int, item_id::int, claimant_character_id::int from portal_crafting_claims where id=$1 and status='active' for update;`, [claimId]);
    if (!claim.rows[0]) throw new Error("That active claim could not be found.");
    if (!actor.isOfficer && claim.rows[0].claimant_character_id !== actor.characterId) throw new Error("You can only release your own material claims.");
    await client.query(`update portal_crafting_claims set status='released', released_at=now() where id=$1;`, [claimId]);
    await insertActivity(client, claim.rows[0].project_id, claim.rows[0].project_phase_id, actor, "claim_released", { claimId, itemId: claim.rows[0].item_id });
    await queueCraftingDiscordRefresh(client, claim.rows[0].project_id, actor);
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; } finally { await client.end(); }
}
export async function deleteCraftingWorkshopProject(actor: CraftingActor, formData: FormData) {
  if (!actor.isOfficer) throw new Error("Only officers can delete workshop projects.");
  const projectId = validPositive(formData.get("projectId"));
  if (!projectId || String(formData.get("confirmation") ?? "").trim().toUpperCase() !== "DELETE") throw new Error("Type DELETE to permanently remove this workshop project.");
  const client = clientForCrafting(); await client.connect();
  try {
    await client.query("begin");
    const project = await client.query<{ title: string }>(`delete from portal_crafting_projects where id=$1 returning title;`, [projectId]);
    if (!project.rows[0]) throw new Error("That workshop project could not be found.");
    await client.query("commit");
  } catch (error) { await client.query("rollback"); throw error; } finally { await client.end(); }
}
export type CraftingCatalogSearchItem = {
  id: number;
  name: string;
  category: string | null;
  level: number | null;
  itemLevel: number | null;
};

let craftingCatalogSearchCache: { loadedAt: number; items: CraftingCatalogSearchItem[] } | null = null;
const CRAFTING_CATALOG_SEARCH_CACHE_MS = 5 * 60 * 1000;

export async function searchCraftingCatalogItems(rawQuery: string): Promise<CraftingCatalogSearchItem[]> {
  const query = String(rawQuery ?? "").trim().slice(0, 80);
  if (query.length < 2) return [];
  const client = clientForCrafting();
  await client.connect();
  try {
    if (!craftingCatalogSearchCache || Date.now() - craftingCatalogSearchCache.loadedAt > CRAFTING_CATALOG_SEARCH_CACHE_MS) {
      const result = await client.query<CraftingCatalogSearchItem>(`
      select id::int, name, category, level, "itemLevel"
      from (
        select distinct on (i.id)
          i.id,
          i.name,
          r.craft_job as category,
          nullif(r.class_job_level, 0)::int as level,
          nullif(i.item_level, 0)::int as "itemLevel"
        from portal_crafting_items i
        join portal_crafting_recipes r
          on r.output_item_id=i.id
         and r.source_kind='xivapi'
         and nullif(trim(coalesce(r.craft_job, '')), '') is not null
        where i.source_kind='xivapi'
        order by i.id, r.preferred desc, r.xivapi_id nulls last
      ) craftable
      order by name asc;`);
      craftingCatalogSearchCache = { loadedAt: Date.now(), items: result.rows };
    }
    return rankCraftingCatalogItems(craftingCatalogSearchCache.items, query, 30);
  } finally {
    await client.end();
  }
}

export type CraftingCalculatorData = {
  recipe: {
    id: number; name: string; iconUrl: string | null; job: string; recipeLevel: number; level: number;
    durability: number; difficulty: number; quality: number; conditionsFlag: number; progressDivider: number;
    qualityDivider: number; progressModifier: number; qualityModifier: number; requiredCraftsmanship: number;
    requiredControl: number; requiredQuality: number; stars: number; canHq: boolean; expert: boolean; collectable: boolean;
  };
  consumables: Array<{ id: number; name: string; iconUrl: string | null; type: "food" | "medicine"; canBeHq: boolean; bonuses: Array<{ stat: "craftsmanship" | "control" | "cp"; relative: boolean; value: number; valueHq: number; max: number; maxHq: number }> }>;
};

const CRAFT_JOB_ALIASES: Record<string, string> = {
  Woodworking: "Carpenter", Smithing: "Blacksmith", Armorcraft: "Armorer", Goldsmithing: "Goldsmith",
  Leatherworking: "Leatherworker", Clothcraft: "Weaver", Alchemy: "Alchemist", Cooking: "Culinarian"
};

function normalizeCraftJob(job: unknown) {
  const value = String(job || "");
  return CRAFT_JOB_ALIASES[value] || value;
}

export async function getCraftingCalculatorData(itemId: number): Promise<CraftingCalculatorData | null> {
  if (!Number.isFinite(itemId) || itemId <= 0) return null;
  const client = clientForCrafting(); await client.connect();
  try {
    const recipe = await client.query(`select r.id::int, i.name, i.icon_url as "iconUrl", r.craft_job as job,
      r.recipe_level::int as "recipeLevel", r.class_job_level::int as level, r.durability::int, r.difficulty::int,
      r.quality::int, r.conditions_flag::int as "conditionsFlag", r.progress_divider::int as "progressDivider",
      r.quality_divider::int as "qualityDivider", r.progress_modifier::int as "progressModifier",
      r.quality_modifier::int as "qualityModifier", coalesce(r.required_craftsmanship,0)::int as "requiredCraftsmanship",
      coalesce(r.required_control,0)::int as "requiredControl", coalesce(r.required_quality,0)::int as "requiredQuality",
      coalesce(r.stars,0)::int as stars, r.can_hq as "canHq", r.is_expert as expert, r.is_collectable as collectable
      from portal_crafting_recipes r join portal_crafting_items i on i.id=r.output_item_id
      where r.output_item_id=$1 and r.source_kind='xivapi' and r.durability>0 and r.difficulty>0 and r.progress_divider>0 and r.quality_divider>0
      order by r.preferred desc, r.xivapi_id asc limit 1;`, [itemId]);
    if (!recipe.rows[0]) return null;
    const consumables = await client.query(`select i.id::int, i.name, i.icon_url as "iconUrl", c.consumable_type as type, i.can_be_hq as "canBeHq", c.bonuses
      from portal_crafting_consumables c join portal_crafting_items i on i.id=c.item_id
      where c.bonuses @> '[{"stat":"craftsmanship"}]'::jsonb or c.bonuses @> '[{"stat":"control"}]'::jsonb or c.bonuses @> '[{"stat":"cp"}]'::jsonb
      order by i.item_level desc nulls last, i.name asc;`);
    recipe.rows[0].job = normalizeCraftJob(recipe.rows[0].job);
    return { recipe: recipe.rows[0], consumables: consumables.rows } as CraftingCalculatorData;
  } finally { await client.end(); }
}
