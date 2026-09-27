import type { CraftingActor, CraftingItemSource, CraftingRequirementRow } from "../../lib/crafting/types";
import CraftingCatalogRequestCreator from "./CraftingCatalogRequestCreator";

type Action = (formData: FormData) => Promise<void>;

type Props = {
  data: Awaited<ReturnType<typeof import("../../lib/crafting/service").getCraftingWorkshopDashboard>>;
  actor: CraftingActor;
  createProjectAction: Action;
  createCatalogProjectAction: Action;
  contributeAction: Action;
  phaseProgressAction: Action;
  postDiscordAction: Action;
  claimAction: Action;
  releaseClaimAction: Action;
  deleteProjectAction: Action;
};

function projectHref(projectId: number, phaseNumber?: number) {
  const params = new URLSearchParams({ view: "crafting", craftProject: String(projectId) });
  if (phaseNumber) params.set("craftPhase", String(phaseNumber));
  return `/?${params.toString()}#crafting-workshop`;
}

function dateLabel(value: string | null) {
  if (!value) return "No due date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No due date" : date.toLocaleDateString();
}

function itemLevelLabel(level: number | null, itemLevel: number | null) {
  const parts: string[] = [];
  if (level) parts.push(`Lv. ${level}`);
  if (itemLevel) parts.push(`iLvl ${itemLevel}`);
  return parts.join(" | ");
}

function craftingSourceLabel(type: string, name: string | null) {
  const raw = name || type || "Source";
  if (type !== "gathering") return raw;
  const labels: Record<string, string> = {
    Harvesting: "Botanist - Harvesting",
    Logging: "Botanist - Logging",
    Mining: "Miner - Mining",
    Quarrying: "Miner - Quarrying"
  };
  return labels[raw] || raw;
}

function craftingSourceSummary(sources: Array<{ type: string; name: string | null; location: string | null }>) {
  const gatheringRoles: Record<string, string> = {
    Harvesting: "Botanist",
    Logging: "Botanist",
    Mining: "Miner",
    Quarrying: "Miner"
  };
  const roles = new Map<string, Map<string, string[]>>();
  const otherSources = new Map<string, { name: string; locations: string[] }>();
  for (const source of sources) {
    const name = source.name || source.type || "Source";
    const location = source.location || "";
    const role = source.type === "gathering" ? gatheringRoles[name] : null;
    if (role) {
      const actions = roles.get(role) ?? new Map<string, string[]>();
      const locations = actions.get(name) ?? [];
      if (location && !locations.includes(location)) locations.push(location);
      actions.set(name, locations);
      roles.set(role, actions);
      continue;
    }
    const key = `${source.type}:${name}`;
    const group = otherSources.get(key) ?? { name: craftingSourceLabel(source.type, source.name), locations: [] };
    if (location && !group.locations.includes(location)) group.locations.push(location);
    otherSources.set(key, group);
  }
  const roleSummary = [...roles.entries()].map(([role, actions]) => {
    const locations = [...actions.values()].flat().filter((location, index, values) => values.indexOf(location) === index);
    return `${role}: ${locations.length ? locations.join(", ") : "location unavailable"}`;
  });
  const otherSummary = [...otherSources.values()].map((source) => `${source.name}: ${source.locations.length ? source.locations.join(", ") : "location unavailable"}`);
  return [...roleSummary, ...otherSummary].join(" | ");
}
function coordinateSummary(sources: CraftingItemSource[]) {
  return sources
    .filter((source) => source.coordinates)
    .map((source) => {
      const vendor = source.name?.replace(/^Vendor:\s*/, "") || "Vendor";
      return `${vendor} (X: ${source.coordinates!.x}, Y: ${source.coordinates!.y})`;
    })
    .join(" | ");
}
type SourcePlanGroup = { name: string; rows: Array<{ row: CraftingRequirementRow; sources: CraftingItemSource[] }> };
function sourcePlanCategory(source: CraftingItemSource) {
  if (source.type === "vendor") return "Vendors";
  if (source.type === "gathering") {
    if (source.name === "Harvesting" || source.name === "Logging") return "Botanist";
    if (source.name === "Mining" || source.name === "Quarrying") return "Miner";
    return "Gathering";
  }
  return source.name?.toLowerCase().startsWith("monster drop:") ? "Monster drops" : "Other sources";
}
function sourcePlanGroups(rows: CraftingRequirementRow[]): SourcePlanGroup[] {
  const order = ["Botanist", "Miner", "Vendors", "Monster drops", "Gathering", "Other sources", "Unresolved sources"];
  const groups = new Map<string, SourcePlanGroup>();
  for (const row of rows) {
    if (!row.isRaw || row.remaining <= 0) continue;
    const categories = new Map<string, CraftingItemSource[]>();
    for (const source of row.sources) { const category = sourcePlanCategory(source); const entries = categories.get(category) ?? []; entries.push(source); categories.set(category, entries); }
    if (!categories.size) categories.set("Unresolved sources", []);
    for (const [name, sources] of categories) { const group = groups.get(name) ?? { name, rows: [] }; group.rows.push({ row, sources }); groups.set(name, group); }
  }
  return order.map((name) => groups.get(name)).filter((group): group is SourcePlanGroup => Boolean(group));
}
function progressResultLabel(result: string) {
  if (result === "excellent") return "Excellent (one-third reduction)";
  if (result === "outstanding") return "Outstanding (two-thirds reduction)";
  return "Normal (no reduction)";
}

export default function CraftingWorkshopView({ data, actor, createProjectAction, createCatalogProjectAction, contributeAction, phaseProgressAction, postDiscordAction, claimAction, releaseClaimAction, deleteProjectAction }: Props) {
  const project = data.selectedProject;
  const hasOfficialTemplates = data.templates.some((template) => !template.isDevelopmentFixture);
  const previousPhase = project
    ? project.phases.find((phase) => phase.phaseNumber === project.selectedPhase.phaseNumber - 1) ?? null
    : null;

  return (
    <div id="crafting-workshop" className="crafting-workshop">
      <div className="crafting-intro panel">
        <div>
          <span className="tag">Workshop planning</span>
          <h3>Company Workshop Projects</h3>
          <p>Plan materials together, contribute finished items or raw materials, and reserve work without reducing the actual remaining requirement.</p>
        </div>
        <span className="crafting-fixture-note">{hasOfficialTemplates ? "Official Company Workshop plans ready" : "Catalog-ready | workshop plans import on the next worker run"}</span>
      </div>

      {actor.isOfficer ? (
        <details className="crafting-create-panel">
          <summary><span><strong>Start a workshop project</strong><small>{hasOfficialTemplates ? "Choose an official Company Workshop plan. The stages and quantities come from the current FFXIV data." : "The testing fixture is available while the worker imports the official Company Workshop plans."}</small></span><span className="tracker-collapsible-toggle">Open</span></summary>
          <form className="crafting-form" action={createProjectAction}>
            <label><span>Workshop plan</span><select name="templateId" required defaultValue=""><option value="" disabled>Choose a workshop plan</option>{hasOfficialTemplates ? <optgroup label="Official Company Workshop plans">{data.templates.filter((template) => !template.isDevelopmentFixture).map((template) => <option key={template.id} value={template.id}>{template.name} | {template.category}</option>)}</optgroup> : null}{data.templates.filter((template) => template.isDevelopmentFixture).map((template) => <option key={template.id} value={template.id}>{template.name} | testing fixture</option>)}</select></label>
            <label><span>Project title</span><input name="title" required maxLength={120} placeholder={hasOfficialTemplates ? "Example: Bronco-type Airship Hull" : "Example: FC workshop test frame"} /></label>
            <label><span>Project lead</span><select name="leadCharacterId" defaultValue=""><option value="">No lead assigned</option>{data.leadOptions.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select></label>
            <label><span>Due date (optional)</span><input name="dueAt" type="date" /></label>
            <label><span>Discord post (optional)</span><select name="discordTargetChannelKind" defaultValue="none"><option value="none">Do not post yet</option><option value="crafting">Crafting Channel</option><option value="test">Test Channel</option></select></label>
            <label className="full"><span>Planning notes</span><textarea name="notes" maxLength={2000} placeholder="Visible to the FC on this project." /></label>
            <div className="form-actions"><button className="button primary" type="submit">Create Workshop Project</button></div>
          </form>
        </details>
      ) : null}

      {actor.isOfficer ? <CraftingCatalogRequestCreator createProjectAction={createCatalogProjectAction} leadOptions={data.leadOptions} /> : null}

      <div className="crafting-project-grid">
        <aside className="crafting-project-list panel">
          <div className="crafting-subheading"><div><span className="tag">Active board</span><h3>Workshop Projects</h3></div></div>
          {data.projects.length ? data.projects.map((summary) => <a className={project?.id === summary.id ? "crafting-project-card selected" : "crafting-project-card"} key={summary.id} href={projectHref(summary.id)}>
            <strong>{summary.title}</strong><span>{summary.projectType === "standard_request" ? "Catalog crafting request" : summary.templateName ?? "Workshop project"}</span><small><b>{summary.status}</b> | Phase {summary.currentPhaseNumber ?? "-"} of {summary.phaseCount} | {summary.leadName ?? "No lead"}</small>
          </a>) : <p className="crafting-empty">No workshop projects exist yet. Officers can create an official workshop plan, a catalog crafting request, or use the clearly labeled testing fixture.</p>}
        </aside>

        {project ? <section className="crafting-project-detail panel">
          <div className="crafting-project-header">
            <div><span className="tag">{project.status}</span><h3>{project.title}</h3><p>{project.notes || "No planning notes yet."}</p></div>
            <div className="crafting-meta"><span>Lead <b>{project.leadName || "Unassigned"}</b></span><span>{dateLabel(project.dueAt)}</span></div>
          </div>
          {actor.isOfficer ? <details className="crafting-delete-panel">
            <summary><span><strong>Project controls</strong><small>Delete only when this project was created in error or is no longer needed.</small></span><span className="tracker-collapsible-toggle">Open</span></summary>
            <form action={deleteProjectAction}><input type="hidden" name="projectId" value={project.id}/><label><span>Type DELETE to permanently remove this project and its contributions, claims, and activity.</span><input name="confirmation" required autoComplete="off" placeholder="DELETE" /></label><button className="danger-button" type="submit">Delete Project</button></form>
          </details> : null}
          {actor.isOfficer ? <details className="crafting-create-panel crafting-discord-post-panel">
            <summary><span><strong>Discord project post</strong><small>{project.discordPost?.messageId ? `Posting to ${project.discordPost.targetChannelKind === "test" ? "the Test Channel" : "the Crafting Channel"}. Updates are automatic.` : "Create one persistent Discord message for this project."}</small></span><span className="tracker-collapsible-toggle">Open</span></summary>
            <form className="crafting-discord-post-form" action={postDiscordAction}>
              <input type="hidden" name="projectId" value={project.id}/>
              <label><span>Post to</span><select name="targetChannelKind" defaultValue={project.discordPost?.targetChannelKind ?? "crafting"}><option value="crafting">Crafting Channel</option><option value="test">Test Channel</option></select></label>
              <button className="button primary" type="submit">{project.discordPost?.messageId ? "Move / Repost Project" : "Post Project to Discord"}</button>
            </form>
            {project.discordPost?.lastError ? <p className="crafting-discord-post-error">Last bot error: {project.discordPost.lastError}</p> : null}
          </details> : null}
          <div className="crafting-phase-tabs" aria-label="Workshop phases">{project.phases.map((phase) => <a key={phase.id} href={projectHref(project.id, phase.phaseNumber)} className={phase.id === project.selectedPhase.id ? "selected" : ""}><span>Phase {phase.phaseNumber}</span><b>{phase.title.replace(/^Phase \d+ . /, "")}</b><small>{phase.status === "completed" ? `${phase.status} | ${progressResultLabel(phase.progressResult)}` : phase.status}</small></a>)}</div>
          <div className="crafting-phase-heading"><div><span className="tag">{project.selectedPhase.status}</span><h3>{project.selectedPhase.title}</h3><p>{project.selectedPhase.description}</p></div><div className={project.selectedPhase.readiness.ready ? "crafting-readiness ready" : "crafting-readiness"}><b>{project.selectedPhase.readiness.completeRows}/{project.selectedPhase.readiness.totalRows}</b><span>top materials complete</span></div></div>

          {previousPhase && project.selectedPhase.status === "active" ? (
            actor.characterId ? <details className="crafting-create-panel crafting-phase-progress-panel">
              <summary><span><strong>Record previous phase result</strong><small>{previousPhase.title} is complete. Record the result shown in-game before anyone reserves or contributes to this stage.</small></span><span className="tracker-collapsible-toggle">Open</span></summary>
              <div className="crafting-phase-progress-body">
                <p><b>Current result:</b> {progressResultLabel(previousPhase.progressResult)}. Normal keeps this phase at full materials; Excellent reduces each requirement by one-third; Outstanding reduces each requirement by two-thirds.</p>
                <form className="crafting-phase-progress-actions" action={phaseProgressAction}>
                  <input type="hidden" name="projectId" value={project.id}/><input type="hidden" name="sourcePhaseId" value={previousPhase.id}/><input type="hidden" name="targetPhaseId" value={project.selectedPhase.id}/>
                  <button className={previousPhase.progressResult === "normal" ? "button primary" : "button secondary"} type="submit" name="result" value="normal">Record Normal</button>
                  <button className={previousPhase.progressResult === "excellent" ? "button primary" : "button secondary"} type="submit" name="result" value="excellent">Record Excellent</button>
                  <button className={previousPhase.progressResult === "outstanding" ? "button primary" : "button secondary"} type="submit" name="result" value="outstanding">Record Outstanding</button>
                </form>
              </div>
            </details> : <p className="crafting-access-note">Link a current FC character through Discord before recording the completed phase result.</p>
          ) : null}

          <section className="crafting-requirements">
            <div className="crafting-subheading"><div><span className="tag">Phase requirements</span><h3>Workshop Requirements</h3><p>Top-level materials for this phase. Claims reserve work but do not lower the actual requirement.</p></div></div>
            <div className="crafting-requirement-list">
              {project.selectedPhase.materials.map((material) => {
                const row = project.requirements.find((requirement) => requirement.itemId === material.itemId);
                if (!row) return null;
                const level = itemLevelLabel(material.level, material.itemLevel);
                return <details className="crafting-material-row" key={material.id}>
                  <summary><div>{row.iconUrl ? <img src={row.iconUrl} alt="" /> : null}<span><strong>{material.itemName}</strong><small>{level ? `${level} | ` : ""}Batch {material.workshopBatchQuantity} x {material.baseBatchCount} | reductions: {material.reducedBatchCount}</small></span></div><div className="crafting-counts"><span><b>{row.required}</b> required</span><span><b>{row.contributed}</b> contributed</span><span><b>{row.remaining}</b> remaining</span><span><b>{row.claimed}</b> claimed</span></div></summary>
                  <div className="crafting-material-body">
                    <p>{row.canBeHq ? `NQ ${row.contributedNq} | HQ ${row.contributedHq}` : "Quality does not apply to this material."}{row.surplus ? ` | ${row.surplus} recorded above this phase's requirement.` : ""}</p>
                    {actor.characterId ? <div className="crafting-action-forms">
                      <form action={contributeAction}><input type="hidden" name="projectId" value={project.id}/><input type="hidden" name="phaseId" value={project.selectedPhase.id}/><input type="hidden" name="projectMaterialId" value={material.id}/><input type="hidden" name="itemId" value={material.itemId}/><label><span>Contribute</span><input type="number" name="quantity" min="1" max={Math.max(1, row.remaining)} required/></label>{row.canBeHq ? <label><span>Quality</span><select name="quality" defaultValue="nq"><option value="nq">NQ</option><option value="hq">HQ</option></select></label> : <input type="hidden" name="quality" value="not_applicable"/>}<button className="button primary" type="submit">Add contribution</button></form>
                      <form action={claimAction}><input type="hidden" name="projectId" value={project.id}/><input type="hidden" name="phaseId" value={project.selectedPhase.id}/><input type="hidden" name="projectMaterialId" value={material.id}/><input type="hidden" name="itemId" value={material.itemId}/><label><span>Claim</span><input type="number" name="quantity" min="1" max={Math.max(1, row.unclaimed)} required/></label><button className="button secondary" type="submit">Reserve material</button></form>
                    </div> : <p className="crafting-access-note">Link a current FC character through Discord before contributing or claiming materials.</p>}
                  </div>
                </details>;
              })}
            </div>
          </section>

          <section className="crafting-source-plan">
            <div className="crafting-subheading"><div><span className="tag">Source-aware plan</span><h3>Gathering and Shopping Plan</h3><p>Remaining raw materials are grouped by how they can be obtained. A material can appear in more than one group when it has multiple valid sources.</p></div></div>
            <div className="crafting-source-plan-grid">{sourcePlanGroups(project.requirements).map((group) => <details className="crafting-source-group" key={group.name} open><summary><span>{group.name}</span><b>{group.rows.length} material{group.rows.length === 1 ? "" : "s"}</b></summary>{group.rows.map(({ row, sources }) => { const level = itemLevelLabel(row.level, row.itemLevel); const coordinates = group.name === "Vendors" ? coordinateSummary(sources) : ""; return <div className="crafting-source-plan-row" key={`${group.name}-${row.itemId}`}><span><strong>{row.itemName}{level ? <small> | {level}</small> : null}</strong><small>{sources.length ? craftingSourceSummary(sources) : "No source details have been imported for this material yet."}</small>{coordinates ? <small className="crafting-source-coordinates">Coordinates: {coordinates}</small> : null}</span><b>{row.remaining} remaining</b></div>; })}</details>)}</div>
          </section>
          <section className="crafting-consolidated">
            <div className="crafting-subheading"><div><span className="tag">Dependency-aware list</span><h3>Consolidated Shopping List</h3><p>Contributions to a crafted intermediate lower the raw materials beneath it. Shared ingredients are shown as one total.</p></div></div>
            <div className="crafting-tree-list">{project.requirements.map((row) => {
              const topMaterial = project.selectedPhase.materials.find((material) => material.itemId === row.itemId);
              const level = itemLevelLabel(row.level, row.itemLevel);
              return <details className="crafting-tree-row" key={`${row.itemId}-${row.depth}`} style={{ marginLeft: `${Math.min(row.depth, 4) * 18}px` }}>
                <summary><span className="crafting-tree-name">{row.depth ? "->" : "*"} {row.itemName}{level ? <small className="crafting-item-level"> | {level}</small> : null}{row.cycleBlocked ? " (recipe loop blocked)" : ""}</span><span><b>{row.required}</b> needed | <b>{row.remaining}</b> remaining | <b>{row.unclaimed}</b> unclaimed</span></summary>
                <div className="crafting-material-body"><p>{row.isRaw ? "Raw material" : `Crafted item | ${row.craftCount} craft${row.craftCount === 1 ? "" : "s"} still needed (yield ${row.outputQuantity}).`}</p>{row.isRaw && row.sources.length ? <p className="crafting-source-detail">{craftingSourceSummary(row.sources)}</p> : row.isRaw ? <p className="crafting-source-detail">No source details have been imported for this material yet.</p> : null}{actor.characterId && !topMaterial ? <div className="crafting-action-forms"><form action={contributeAction}><input type="hidden" name="projectId" value={project.id}/><input type="hidden" name="phaseId" value={project.selectedPhase.id}/><input type="hidden" name="itemId" value={row.itemId}/><label><span>Contribute</span><input type="number" name="quantity" min="1" max={Math.max(1, row.remaining)} required/></label>{row.canBeHq ? <label><span>Quality</span><select name="quality" defaultValue="nq"><option value="nq">NQ</option><option value="hq">HQ</option></select></label> : <input type="hidden" name="quality" value="not_applicable"/>}<button className="button primary" type="submit">Add</button></form><form action={claimAction}><input type="hidden" name="projectId" value={project.id}/><input type="hidden" name="phaseId" value={project.selectedPhase.id}/><input type="hidden" name="itemId" value={row.itemId}/><label><span>Claim</span><input type="number" name="quantity" min="1" max={Math.max(1, row.unclaimed)} required/></label><button className="button secondary" type="submit">Reserve</button></form></div> : null}</div>
              </details>;
            })}</div>
          </section>

          <section className="crafting-history-grid">
            <div className="panel"><span className="tag">Your reservations</span><h3>Claims</h3>{project.claims.length ? project.claims.map((claim) => <div className="crafting-history-row" key={claim.id}><span><strong>{claim.quantity}x {claim.itemName}</strong><small>{claim.claimantName} | {claim.status}</small></span>{actor.characterId === claim.claimantCharacterId && claim.status === "active" ? <form action={releaseClaimAction}><input type="hidden" name="claimId" value={claim.id}/><input type="hidden" name="projectId" value={project.id}/><button className="button secondary" type="submit">Release</button></form> : null}</div>) : <p className="crafting-empty">No active material claims.</p>}</div>
            <div className="panel"><span className="tag">Recent contributions</span><h3>Contributors</h3>{project.contributors.length ? project.contributors.map((contributor) => <div className="crafting-history-row" key={contributor.name}><span><strong>{contributor.total}x contributed</strong><small>{contributor.name}</small></span></div>) : <p className="crafting-empty">No contributions recorded.</p>}</div>
            <div className="panel"><span className="tag">Project activity</span><h3>Activity</h3>{project.activity.length ? project.activity.map((activity, index) => <div className="crafting-history-row" key={`${activity.actionType}-${activity.createdAt}-${index}`}><span><strong>{activity.actionType.replace(/_/g, " ")}</strong><small>{activity.actorName || "System"} | {dateLabel(activity.createdAt)}</small></span></div>) : <p className="crafting-empty">No project activity yet.</p>}</div>
          </section>
        </section> : <section className="crafting-project-detail panel"><p className="crafting-empty">Choose a project to view its materials and activity.</p></section>}
      </div>
    </div>
  );
}
