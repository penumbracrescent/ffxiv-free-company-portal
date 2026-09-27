"use client";

import { useEffect, useMemo, useState } from "react";

type RosterChange = { id: number; type: "added" | "removed"; character: string; world: string; detectedAt: string; manual: boolean };
type AutomationItem = { id: string; kind: string; title: string; scheduledAt: string };
type Props = { fcVerified: boolean; canManageBackups: boolean; characterCount: number; reviewCount: number; pendingActionCount: number; failedActionCount: number; completedActionCount: number; warningCount: number; failedSyncCount: number; latestFailedSync: string | null; recentChanges: RosterChange[]; upcomingAutomations: AutomationItem[] };

const categories = [
  { id: "overview", label: "Overview", icon: "Home", description: "Health, attention items, and recent membership changes." },
  { id: "members", label: "Members & FC", icon: "FC", description: "Characters, roles, join dates, roster reviews, and mounts." },
  { id: "discord", label: "Discord", icon: "Bot", description: "Bot settings, commands, scheduled posts, and action queues." },
  { id: "content", label: "Portal Content", icon: "Site", description: "Announcements, public pages, branding, and portal settings." },
  { id: "system", label: "System & Data", icon: "Sync", description: "Verification, sync health, activity, privacy, and backups." }
] as const;

const toolCategories: Record<string, string> = {
  "officer-join-dates":"members", "officer-character-rename-review":"members", "officer-alt-character-claims":"members", "officer-discord-roster-overview":"members", "officer-discord-roster-scan":"members", "officer-discord-roster-review":"members", "officer-mount-management":"members", "officer-role-settings":"members", "officer-character-manager":"members",
  "officer-discord-command-administration":"discord", "officer-discord-automation":"discord", "officer-test-mount-win":"discord", "officer-discord-bot-settings":"discord", "officer-discord-scan-status":"discord", "officer-discord-scheduled-posts":"discord", "officer-discord-duty-catalog":"discord", "officer-discord-events":"discord", "officer-discord-action-queue":"discord",
  "officer-branding":"content", "officer-public-content":"content", "officer-announcements":"content", "officer-portal-settings":"content",
  "officer-activity-log":"system", "officer-anime-sync":"system", "officer-sync-status":"system", "officer-backups":"system", "officer-privacy":"system", "officer-admin-settings":"system"
};

function formatWhen(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(date); }

export default function OfficerControlCenter(props: Props) {
  const [activeCategory,setActiveCategory]=useState("overview");
  const [query,setQuery]=useState("");
  const attentionCount=props.reviewCount+props.pendingActionCount+props.failedActionCount+props.warningCount+(props.fcVerified?0:1);
  const category=query.trim()?"all":activeCategory;
  const systemAttention=props.warningCount+(props.fcVerified?0:1);
  const categoryMarkers:Record<string,{tone:"success"|"warning"|"danger";label:string}[]>={
    overview:[...(props.failedActionCount+props.failedSyncCount?[{tone:"danger" as const,label:`${props.failedActionCount+props.failedSyncCount} failed`}]:[]),...(attentionCount-props.failedActionCount?[{tone:"warning" as const,label:`${attentionCount-props.failedActionCount} attention`}]:[]),...(!attentionCount&&!props.failedSyncCount?[{tone:"success" as const,label:"Clear"}]:[])],
    members:[{tone:"success",label:`${props.characterCount} active`},...(props.reviewCount?[{tone:"warning" as const,label:`${props.reviewCount} review${props.reviewCount===1?"":"s"}`}]:[])],
    discord:[...(props.failedActionCount?[{tone:"danger" as const,label:`${props.failedActionCount} failed`}]:[]),...(props.pendingActionCount?[{tone:"warning" as const,label:`${props.pendingActionCount} pending`}]:[]),...(props.completedActionCount?[{tone:"success" as const,label:`${props.completedActionCount} complete`}]:[]),...(!props.failedActionCount&&!props.pendingActionCount&&!props.completedActionCount?[{tone:"success" as const,label:"Clear"}]:[])],
    content:[{tone:"success",label:"Ready"}],
    system:[...(props.failedSyncCount?[{tone:"danger" as const,label:`${props.failedSyncCount} failed`}]:[]),...(systemAttention?[{tone:"warning" as const,label:`${systemAttention} attention`}]:[]),...(!props.failedSyncCount&&!systemAttention?[{tone:"success" as const,label:"Healthy"}]:[])]
  };

  useEffect(()=>{
    function revealLinkedTool(){
      const id=decodeURIComponent(window.location.hash.slice(1));
      const linkedCategory=toolCategories[id];
      if(!linkedCategory)return;
      setQuery("");
      setActiveCategory(linkedCategory);
      window.setTimeout(()=>{const tool=document.getElementById(id) as HTMLDetailsElement|null;if(tool){tool.hidden=false;tool.open=true;}},0);
    }
    revealLinkedTool();
    window.addEventListener("hashchange",revealLinkedTool);
    return()=>window.removeEventListener("hashchange",revealLinkedTool);
  },[]);

  useEffect(()=>{
    const officerArea=document.getElementById("officers"); if(!officerArea)return;
    const search=query.trim().toLocaleLowerCase();
    const tools=Array.from(officerArea.querySelectorAll<HTMLElement>(":scope > details[id^='officer-']"));
    for(const tool of tools){const categoryMatch=category==="all"||(category!=="overview"&&toolCategories[tool.id]===category);const searchMatch=!search||(tool.querySelector("summary")?.textContent||"").toLocaleLowerCase().includes(search);tool.hidden=category==="overview"||!categoryMatch||!searchMatch;}
  },[category,query]);

  const visibleLabel=useMemo(()=>categories.find(item=>item.id===activeCategory)?.label||"Tools",[activeCategory]);
  function showCategory(id:string){setQuery("");setActiveCategory(id);}
  function openTool(id:string){setQuery("");setActiveCategory(toolCategories[id]||"system");window.setTimeout(()=>{const tool=document.getElementById(id) as HTMLDetailsElement|null;if(!tool)return;tool.hidden=false;tool.open=true;tool.scrollIntoView({behavior:"smooth",block:"start"});},0);}

  return <div className="officer-control-center">
    <div className="officer-command-bar"><div><span className={attentionCount?"tag warning":"tag success"}>{attentionCount?`${attentionCount} need attention`:"All clear"}</span><h3>Officer Command Center</h3><p>Start with current FC activity, then open only the group of tools you need.</p></div><label className="officer-tool-search"><span>Find an officer tool</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search settings, roster, Discord..."/></label></div>
    <nav className="officer-category-nav" aria-label="Officer tool categories">{categories.map(item=><button key={item.id} type="button" className={activeCategory===item.id&&!query?"active":""} onClick={()=>showCategory(item.id)}><span className="officer-category-icon" aria-hidden="true">{item.icon}</span><strong>{item.label}</strong><small>{item.description}</small><span className="officer-category-markers">{categoryMarkers[item.id].map(marker=><span key={`${marker.tone}-${marker.label}`} className={`officer-notification-marker ${marker.tone}`}>{marker.label}</span>)}</span></button>)}</nav>
    {activeCategory==="overview"&&!query?<div className="officer-overview">
      <div className="officer-health-grid">
        <button type="button" onClick={()=>openTool("officer-sync-status")}><span className={props.fcVerified?"status-dot success":"status-dot warning"}/><small>FC ownership</small><strong>{props.fcVerified?"Verified":"Verification required"}</strong></button>
        <button type="button" onClick={()=>openTool("officer-character-manager")}><span className="status-dot success"/><small>Characters</small><strong>{props.characterCount}</strong></button>
        <button type="button" onClick={()=>openTool("officer-discord-roster-review")}><span className={props.reviewCount?"status-dot warning":"status-dot success"}/><small>Roster reviews</small><strong>{props.reviewCount}</strong></button>
        <button type="button" onClick={()=>openTool("officer-discord-action-queue")}><span className={props.failedActionCount?"status-dot danger":props.pendingActionCount?"status-dot warning":"status-dot success"}/><small>Discord actions</small><strong>{props.failedActionCount?`${props.failedActionCount} failed`:`${props.pendingActionCount} pending`}</strong></button>
      </div>
      <div className="officer-overview-panels">
        <section className="officer-overview-panel officer-quick-actions"><header><span className="tag">Shortcuts</span><h3>Quick actions</h3><p>Jump directly to common officer work.</p></header><div>
          <button type="button" onClick={()=>openTool("officer-sync-status")}><strong>Run FC roster scan</strong><small>Verify ownership or queue an immediate comparison.</small></button>
          <button type="button" onClick={()=>openTool("officer-discord-roster-review")}><strong>Review roster changes</strong><small>Resolve Discord and FC membership differences.</small></button>
          <button type="button" onClick={()=>openTool("officer-discord-scheduled-posts")}><strong>Schedule Discord post</strong><small>Create announcements and reminders.</small></button>
          <button type="button" onClick={()=>openTool(props.canManageBackups?"officer-backups":"officer-activity-log")}><strong>{props.canManageBackups?"Create a backup":"Open activity log"}</strong><small>{props.canManageBackups?"Build a portable recovery archive.":"Review recent portal and worker activity."}</small></button>
        </div></section>
        <section className="officer-overview-panel officer-system-health"><header><span className="tag">Live status</span><h3>System health</h3><p>Current services and attention items.</p></header><div>
          <button type="button" onClick={()=>openTool("officer-sync-status")}><span className={props.fcVerified?"status-dot success":"status-dot warning"}/><span><strong>FC ownership</strong><small>{props.fcVerified?"Verified and protected":"Verification required"}</small></span></button>
          <button type="button" onClick={()=>openTool("officer-sync-status")}><span className={props.failedSyncCount?"status-dot danger":"status-dot success"}/><span><strong>Background worker</strong><small>{props.failedSyncCount?`${props.failedSyncCount} recent failure${props.failedSyncCount===1?"":"s"}${props.latestFailedSync?` · ${props.latestFailedSync}`:""}`:"Recent jobs completed normally"}</small></span></button>
          <button type="button" onClick={()=>openTool("officer-discord-action-queue")}><span className={props.failedActionCount?"status-dot danger":props.pendingActionCount?"status-dot warning":"status-dot success"}/><span><strong>Discord delivery</strong><small>{props.failedActionCount?`${props.failedActionCount} failed action${props.failedActionCount===1?"":"s"}`:props.pendingActionCount?`${props.pendingActionCount} action${props.pendingActionCount===1?"":"s"} waiting`:"Queue is clear"}</small></span></button>
          <button type="button" onClick={()=>openTool("officer-sync-status")}><span className={props.warningCount?"status-dot warning":"status-dot success"}/><span><strong>Catalog sources</strong><small>{props.warningCount?`${props.warningCount} mapping warning${props.warningCount===1?"":"s"}`:"Source mappings are current"}</small></span></button>
        </div></section>
        <section className="officer-overview-panel officer-upcoming-automation"><header><span className="tag">Schedule</span><h3>Upcoming automation</h3><p>The next automatic roster and Discord work.</p></header>{props.upcomingAutomations.length?<div>{props.upcomingAutomations.map(item=><button type="button" key={item.id} onClick={()=>openTool(item.kind==="FC roster"?"officer-discord-scan-status":"officer-discord-scheduled-posts")}><span><strong>{item.title}</strong><small>{item.kind}</small></span><time dateTime={item.scheduledAt}>{formatWhen(item.scheduledAt)}</time></button>)}</div>:<p className="muted">No scheduled automation is waiting.</p>}</section>
      </div>
      <section className="officer-recent-roster" aria-labelledby="recent-fc-changes-heading"><header><div><span className="tag">FC Roster</span><h3 id="recent-fc-changes-heading">Recent joins and departures</h3><p>The latest confirmed Lodestone roster changes remain visible at a glance.</p></div><button className="button secondary" type="button" onClick={()=>openTool("officer-sync-status")}>Open Sync Status</button></header>
      {props.recentChanges.length?<div className="officer-roster-change-list">{props.recentChanges.map(change=><article key={change.id} className={change.type}><span className="roster-change-icon" aria-hidden="true">{change.type==="added"?"+":"-"}</span><div><strong>{change.character}</strong><small>{change.world} / {formatWhen(change.detectedAt)}{change.manual?" / Manual scan":""}</small></div><span className={change.type==="added"?"tag success":"tag warning"}>{change.type==="added"?"Joined":"Left"}</span></article>)}</div>:<p className="muted">No FC roster changes have been recorded yet.</p>}</section>
    </div>:<div className="officer-category-heading"><span className="eyebrow">Officer tools</span><h3>{query?`Search results for "${query}"`:visibleLabel}</h3><p>Select a card to open its controls.</p></div>}
  </div>;
}
