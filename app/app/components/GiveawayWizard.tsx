"use client";

import { useEffect, useRef, useState } from "react";
import { createGiveawayAction, updateGiveawayDraftAction } from "../../lib/giveaways/actions";
import type { GiveawayPrizeInventoryItem, GiveawayRecord } from "../../lib/giveaways/types";

type Props = {
  sharedTestChannelConfigured: boolean;
  glamourSourceChannelId: string | null;
  giveawayChannelConfigured: boolean;
  contestantsChannelConfigured: boolean;
  prizeInventory: GiveawayPrizeInventoryItem[];
};

type Review = {
  title: string;
  type: string;
  prize: string;
  quantity: string;
  schedule: string;
  discord: string[];
  scheduled: boolean;
};

const TYPE_LABELS: Record<string,string> = {
  random: "Random Giveaway",
  fcfs: "First Come, First Served",
  contest: "Standard Contest",
  glamour: "Glamour Contest",
  challenge: "Challenge Giveaway",
  objective: "Objective Competition",
};
const STEP_LABELS = ["Basics", "Rules & winners", "Schedule & Discord", "Review"];
function dateTimeValue(value:string|null|undefined){
  if(!value)return "";
  const parts=new Map(new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(value)).filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}T${parts.get("hour")}:${parts.get("minute")}`;
}


export default function GiveawayWizard({ sharedTestChannelConfigured, glamourSourceChannelId, giveawayChannelConfigured, contestantsChannelConfigured, prizeInventory }: Props) {
  const [open,setOpen]=useState(false);
  const [editingDraft,setEditingDraft]=useState<GiveawayRecord|null>(null);
  const [step,setStep]=useState(1);
  const [setupKind,setSetupKind]=useState("random");
  const [claimEnabled,setClaimEnabled]=useState(false);
  const [remindersEnabled,setRemindersEnabled]=useState(false);
  const [inventoryItemId,setInventoryItemId]=useState<number|null>(null);
  const [review,setReview]=useState<Review|null>(null);
  const [saving,setSaving]=useState(false);
  const [submitError,setSubmitError]=useState("");
  const formRef=useRef<HTMLFormElement>(null);
  const closeRef=useRef<HTMLButtonElement>(null);
  const dirtyRef=useRef(false);
  const isContest=setupKind==="contest"||setupKind==="glamour"||setupKind==="objective";
  const isGlamour=setupKind==="glamour";
  const isFcfs=setupKind==="fcfs";


  useEffect(()=>{
    const resume=(event:Event)=>{
      const draft=(event as CustomEvent<GiveawayRecord>).detail;if(!draft||draft.status!=="draft")return;
      setEditingDraft(draft);setSetupKind(draft.kind==="contest"&&draft.discordAutoEnroll?"glamour":draft.kind);
      setClaimEnabled(draft.claimPeriodEnabled);setRemindersEnabled(draft.remindersEnabled);setReview(null);setSubmitError("");setStep(1);dirtyRef.current=false;setOpen(true);
    };
    window.addEventListener("cotf:resume-giveaway-draft",resume);
    return()=>window.removeEventListener("cotf:resume-giveaway-draft",resume);
  },[]);

  useEffect(()=>{
    if(!open)return;
    const prior=document.body.style.overflow;
    document.body.style.overflow="hidden";
    closeRef.current?.focus();
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")requestClose();};
    window.addEventListener("keydown",onKey);
    return()=>{document.body.style.overflow=prior;window.removeEventListener("keydown",onKey);};
  },[open]);

  function requestClose(){
    if(dirtyRef.current&&!window.confirm("Close this setup? Unsaved giveaway details will be lost."))return;
    setOpen(false);setStep(1);setReview(null);setEditingDraft(null);setInventoryItemId(null);dirtyRef.current=false;
  }
  function validateStep(){
    const section=formRef.current?.querySelector<HTMLElement>(`[data-wizard-step="${step}"]`);
    const fields=section?.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>("input, select, textarea")||[];
    for(const field of fields){if(!field.checkValidity()){field.reportValidity();field.focus();return false;}}
    return true;
  }
  function buildReview(){
    if(!formRef.current)return;
    const data=new FormData(formRef.current);
    const value=(name:string)=>String(data.get(name)||"").trim();
    const schedule=isContest
      ? [value("submissionOpensAt")&&`Submissions ${value("submissionOpensAt")}`,value("submissionClosesAt")&&`to ${value("submissionClosesAt")}`,value("votingOpensAt")&&`Voting ${value("votingOpensAt")}`,value("votingClosesAt")&&`to ${value("votingClosesAt")}`].filter(Boolean).join(" · ")
      : [value("opensAt")&&`Opens ${value("opensAt")}`,value("closesAt")&&`Closes ${value("closesAt")}`].filter(Boolean).join(" · ");
    const discord=[data.has("isTest")?"Shared test channel":null,data.has("postOpening")?"Opening announcement":null,data.has("remindersEnabled")?"Reminders":null,data.has("postVotingOpen")?"Voting announcement":null,data.has("discordContestGallery")?"Contestant gallery":null,data.has("discordVotingEnabled")?"Discord voting":null,data.has("discordAutoEnroll")?"Glamours auto-enrollment":null,data.has("postResults")?"Results post":null].filter(Boolean) as string[];
    setReview({title:value("title")||"Untitled draft",type:TYPE_LABELS[setupKind],prize:value("prizeName")||"Not set",quantity:value("prizeQuantity")||"1",schedule:schedule||"No automatic schedule set",discord,scheduled:Boolean(schedule)});
  }
  function next(){if(!validateStep())return;if(step===3)buildReview();setStep(value=>Math.min(4,value+1));}
  function previous(){setStep(value=>Math.max(1,value-1));}
  async function submitGiveaway(formData:FormData){
    setSaving(true);setSubmitError("");
    try{
      if(editingDraft)await updateGiveawayDraftAction(formData);else await createGiveawayAction(formData);dirtyRef.current=false;formRef.current?.reset();setOpen(false);setStep(1);setReview(null);setEditingDraft(null);setSetupKind("random");setInventoryItemId(null);setClaimEnabled(false);setRemindersEnabled(false);
    }catch(error){setSubmitError(error instanceof Error?error.message:"The giveaway could not be saved.");}
    finally{setSaving(false);}
  }

  return <>
    <div className="giveaway-wizard-launch">
      <div><span className="tag">Officer Setup</span><h3>Create Giveaway or Contest</h3><p>Use the guided setup to create a website draft and choose exactly what Discord should publish.</p></div>
      <button type="button" className="button primary" onClick={()=>{setEditingDraft(null);setSetupKind("random");setClaimEnabled(false);setRemindersEnabled(false);setReview(null);setSubmitError("");setStep(1);dirtyRef.current=false;setOpen(true);}}>Create New</button>
    </div>
    {open?<div className="giveaway-wizard-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)requestClose();}}>
      <section className="giveaway-wizard" role="dialog" aria-modal="true" aria-labelledby="giveaway-wizard-title">
        <header className="giveaway-wizard-header"><div><p className="eyebrow">Officer Setup · Step {step} of 4</p><h3 id="giveaway-wizard-title">{editingDraft?"Edit Giveaway Draft":"Create Giveaway or Contest"}</h3></div><button ref={closeRef} type="button" className="button secondary" onClick={requestClose}>Close</button></header>
        <nav className="giveaway-wizard-progress" aria-label="Giveaway setup progress">{STEP_LABELS.map((label,index)=><button key={label} type="button" className={step===index+1?"active":step>index+1?"complete":""} aria-current={step===index+1?"step":undefined} onClick={()=>{if(index+1<step)setStep(index+1);}}><span>{index+1}</span>{label}</button>)}</nav>
        <form key={editingDraft?.id||"new"} ref={formRef} action={submitGiveaway} className="giveaway-wizard-form" onChange={()=>{dirtyRef.current=true;}}>
          {editingDraft?<input type="hidden" name="giveawayId" value={editingDraft.id}/>:null}
          <input type="hidden" name="kind" value={setupKind==="glamour"?"contest":setupKind}/>
          <input type="hidden" name="discordSourceChannelId" value={glamourSourceChannelId||""}/>
          {inventoryItemId?<input type="hidden" name="inventoryItemId" value={inventoryItemId}/>:null}

          <section data-wizard-step="1" hidden={step!==1} className="giveaway-wizard-step">
            <div className="giveaway-wizard-intro"><h4>Basics</h4><p>Start with what members will see and what they can win.</p></div>
            <div className="giveaway-wizard-grid">
              <label><span>Type</span><select value={setupKind} onChange={event=>{setSetupKind(event.target.value);setClaimEnabled(false);}}><option value="random">Random Giveaway</option><option value="fcfs">First Come, First Served</option><option value="contest">Standard Contest</option><option value="glamour">Glamour Contest</option><option value="challenge">Challenge Giveaway</option><option value="objective">Objective Competition</option></select></label>
              <label><span>Title</span><input name="title" required defaultValue={editingDraft?.title||""} placeholder="Give the event a clear name"/></label>
              <label><span>Prize</span><input name="prizeName" required defaultValue={editingDraft?.prizeName||""} placeholder="What will the winner receive?"/></label>
              <label><span>Prize quantity</span><input name="prizeQuantity" type="number" min="1" defaultValue={editingDraft?.prizeQuantity||1}/></label>
              <label><span>Prize category</span><select name="prizeCategory" defaultValue={editingDraft?.prizeCategory||"in_game"}><option value="in_game">In-game</option><option value="premium">Premium</option><option value="game_time">Game Time</option><option value="special">Special / Custom</option></select></label>
              <label><span>Prize donor shown publicly (optional)</span><input name="prizeDonor" defaultValue={editingDraft?.prizeDonor||""} placeholder="Free Company or a member name"/></label>
              <label className="full"><span>Prize photo (optional)</span><input name="prizePhoto" type="file" accept="image/jpeg,image/png,image/gif,image/webp"/><small>JPG, PNG, GIF, or WebP · maximum 10 MB</small></label>
              <label className="full"><span>Description</span><textarea name="description" rows={4} defaultValue={editingDraft?.description||""} placeholder="Tell members what this event is about."/></label>
            </div>
          </section>

          <section data-wizard-step="2" hidden={step!==2} className="giveaway-wizard-step">
            <div className="giveaway-wizard-intro"><h4>Rules and winner setup</h4><p>Only settings that apply to {TYPE_LABELS[setupKind].toLowerCase()} are shown.</p></div>
            <div className="giveaway-wizard-grid">
              <label className="full"><span>Rules</span><textarea name="rules" rows={5} defaultValue={editingDraft?.rules||""} placeholder="One rule per line works well."/></label>
              <label><span>Prior-winner eligibility</span><select name="cooldownPolicy" defaultValue={editingDraft?.cooldownPolicy||"none"}><option value="none">No prior-winner restriction</option><option value="last_winner">Exclude the previous giveaway's #1 winner</option><option value="7_days">Exclude winners from the last 7 days</option><option value="14_days">Exclude winners from the last 14 days</option><option value="30_days">Exclude winners from the last 30 days</option><option value="60_days">Exclude winners from the last 60 days</option><option value="90_days">Exclude winners from the last 90 days</option></select><small>Applied when entries are drawn, FCFS prizes are claimed, or contest results are finalized.</small></label>
              {isFcfs?<div className="giveaway-wizard-note"><strong>First-come setup</strong><p>The prize quantity determines how many successful claims are available. Winner and voting controls are not needed.</p></div>:null}
              {!isContest&&!isFcfs?<><label><span>Winners</span><input name="winnerCount" type="number" min="1" defaultValue={editingDraft?.winnerCount||1}/></label><label><span>Alternates</span><input name="alternateCount" type="number" min="0" defaultValue={editingDraft?.alternateCount||0}/></label><label><span>Entries per member</span><input name="maxEntriesPerMember" type="number" min="1" max="10" defaultValue={editingDraft?.maxEntriesPerMember||1}/></label></>:null}
              {isContest?<><label><span>Theme</span><input name="theme" defaultValue={editingDraft?.theme||""} placeholder={isGlamour?"Glamour theme":"Contest theme"}/></label><label><span>Winner method</span><select name="winnerMode" defaultValue={editingDraft?.winnerMode||(setupKind==="objective"?"objective":"member_vote")}><option value="member_vote">Member Vote</option><option value="ranked_vote">Ranked Member Vote</option><option value="officer_vote">Officer / Judge Vote</option><option value="random_submission">Random Valid Submission</option><option value="objective">Objective Result</option></select></label>{isGlamour?<label><span>Contestant visibility</span><input type="hidden" name="visibilityMode" value="public"/><strong>Named / public</strong><small>Glamour names stay attached to their submitted character photos.</small></label>:<label><span>Contestant visibility</span><select name="visibilityMode" defaultValue={editingDraft?.visibilityMode||"public"}><option value="public">Named / public</option><option value="anonymous">Anonymous until results</option></select><small>Controls whether member names appear beside entries.</small></label>}<label><span>Vote privacy</span><select name="ballotPrivacyMode" defaultValue={editingDraft?.ballotPrivacyMode||"private"}><option value="private">Private — officers only</option><option value="anonymous">Anonymous — identities hidden</option><option value="public">Public after results</option></select><small>Private is the default. Voters can always review their own choices.</small></label><label className="check full"><input name="liveTotalsVisible" type="checkbox" defaultChecked={editingDraft?.liveTotalsVisible||false}/><span>Show live aggregate vote totals while voting</span></label><label><span>Placements (prize ranks)</span><input name="placementCount" type="number" min="1" defaultValue={editingDraft?.placementCount||1}/></label><label><span>Alternates</span><input name="alternateCount" type="number" min="0" defaultValue={editingDraft?.alternateCount||0}/></label><label><span>Votes allowed</span><select name="votesAllowed" defaultValue={String(editingDraft?.votesAllowed||1)}><option value="1">Up to 1</option><option value="2">Up to 2</option><option value="3">Up to 3</option></select></label><label><span>Entries per member</span><input name="maxEntriesPerMember" type="number" min="1" max="10" defaultValue={editingDraft?.maxEntriesPerMember||1}/></label><label><span>Maximum photos</span><input name="maxPhotos" type="number" min="1" max="10" defaultValue={editingDraft?.maxPhotos||4}/></label><label><span>Tie policy</span><select name="tiePolicy" defaultValue={editingDraft?.tiePolicy||"random"}><option value="random">Secure random among tied</option><option value="officer">Officer deciding vote</option><option value="manual">Manual resolution</option><option value="runoff">Runoff with officer resolution</option><option value="shared">Shared placement</option></select></label></>:null}
              {setupKind==="challenge"?<label className="full"><span>Qualification instructions</span><textarea name="qualificationInstructions" rows={3} defaultValue={editingDraft?.qualificationInstructions||""} placeholder="What must a member complete or prove before the draw?"/></label>:null}{setupKind==="objective"?<><label><span>Objective metric</span><input name="objectiveMetricLabel" required defaultValue={editingDraft?.objectiveMetricLabel||""} placeholder="Clear time, points, items gathered…"/></label><label><span>Winning direction</span><select name="objectiveDirection" defaultValue={editingDraft?.objectiveDirection||"highest"}><option value="highest">Highest score wins</option><option value="lowest">Lowest score wins</option></select></label><label className="check full"><input name="evidenceRequired" type="checkbox" defaultChecked={editingDraft?.evidenceRequired||false}/><span>Require evidence for objective scores</span></label></>:null}{!isFcfs?<><label className="check full"><input name="claimPeriodEnabled" type="checkbox" checked={claimEnabled} onChange={event=>setClaimEnabled(event.target.checked)}/><span>Require winners to claim their prize</span></label>{claimEnabled?<label><span>Claim window (hours)</span><input name="claimWindowHours" type="number" min="1" defaultValue={editingDraft?.claimWindowHours||72}/></label>:null}</>:null}
            </div>
          </section>

          <section data-wizard-step="3" hidden={step!==3} className="giveaway-wizard-step">
            <div className="giveaway-wizard-intro"><h4>Schedule and Discord</h4><p>Leave dates blank for a manually managed draft. Discord output remains optional.</p></div>
            <div className="giveaway-wizard-grid">
              {isContest?<><label><span>Submissions open</span><input name="submissionOpensAt" type="datetime-local" defaultValue={dateTimeValue(editingDraft?.submissionOpensAt)}/></label><label><span>Submissions close</span><input name="submissionClosesAt" type="datetime-local" defaultValue={dateTimeValue(editingDraft?.submissionClosesAt)}/></label><label><span>Voting opens</span><input name="votingOpensAt" type="datetime-local" defaultValue={dateTimeValue(editingDraft?.votingOpensAt)}/></label><label><span>Voting closes</span><input name="votingClosesAt" type="datetime-local" defaultValue={dateTimeValue(editingDraft?.votingClosesAt)}/></label></>:<><label><span>Open time</span><input name="opensAt" type="datetime-local" defaultValue={dateTimeValue(editingDraft?.opensAt)}/></label><label><span>Close time</span><input name="closesAt" type="datetime-local" defaultValue={dateTimeValue(editingDraft?.closesAt)}/></label></>}
              <div className="giveaway-wizard-divider full"><span>Discord publishing</span></div>
              <label className="check"><input name="isTest" type="checkbox" defaultChecked={editingDraft?.isTest||false}/><span>Test · use shared Test Channel</span></label>
              <label className="check"><input name="postOpening" type="checkbox" defaultChecked={editingDraft?.postOpening||false}/><span>Post opening announcement</span></label>
              <label className="check"><input name="remindersEnabled" type="checkbox" checked={remindersEnabled} onChange={event=>setRemindersEnabled(event.target.checked)}/><span>Enable reminders</span></label>
              {remindersEnabled?<label><span>Reminder minutes</span><input name="reminderMinutes" defaultValue={(editingDraft?.reminderMinutes||[]).join(", ")} placeholder="1440, 60"/><small>Example: one day and one hour before closing</small></label>:null}
              <label className="check"><input name="postResults" type="checkbox" defaultChecked={editingDraft?editingDraft.postResults:true}/><span>Post winner/results</span></label>
              {isContest?<><label className="check"><input name="postVotingOpen" type="checkbox" defaultChecked={editingDraft?.postVotingOpen||false}/><span>Post voting-open announcement</span></label><label className="check"><input name="discordContestGallery" type="checkbox" defaultChecked={editingDraft?.discordContestGallery||false}/><span>Create Discord contestant gallery</span></label><label className="check"><input name="discordVotingEnabled" type="checkbox" defaultChecked={editingDraft?.discordVotingEnabled||false}/><span>Enable Discord voting</span></label></>:null}
              {isGlamour?<label className="check full glamour-option"><input name="discordAutoEnroll" type="checkbox" defaultChecked={editingDraft?.discordAutoEnroll||false}/><span><strong>Auto-enroll Glamours channel photos</strong><small>Uses the Glamours channel selected in Officer Area settings.</small></span></label>:null}
              <div className="full giveaway-config-checks"><span className={sharedTestChannelConfigured?"ok":"missing"}>Shared test channel: {sharedTestChannelConfigured?"configured":"missing"}</span><span className={giveawayChannelConfigured?"ok":"missing"}>Giveaway channel: {giveawayChannelConfigured?"configured":"missing"}</span>{isContest?<span className={contestantsChannelConfigured?"ok":"missing"}>Contestants channel: {contestantsChannelConfigured?"configured":"missing"}</span>:null}{isGlamour?<span className={glamourSourceChannelId?"ok":"missing"}>Glamours channel: {glamourSourceChannelId?"configured":"missing"}</span>:null}</div>
            </div>
          </section>

          <section data-wizard-step="4" hidden={step!==4} className="giveaway-wizard-step">
            <div className="giveaway-wizard-intro"><h4>Review draft</h4><p>Confirm the important details before the website creates the draft.</p></div>
            <div className="giveaway-review-card"><div><span>Type</span><strong>{review?.type}</strong></div><div><span>Title</span><strong>{review?.title}</strong></div><div><span>Prize</span><strong>{review?.prize} × {review?.quantity}</strong></div><div><span>Schedule</span><strong>{review?.schedule}</strong></div><div className="full"><span>Discord output</span><strong>{review?.discord.length?(review?.discord||[]).join(" · "):"Website only"}</strong></div></div>
            <div className="giveaway-wizard-note review-note"><strong>{review?.scheduled?"This schedules the giveaway.":editingDraft?"This updates the draft.":"This creates a draft."}</strong><p>{review?.scheduled?"It will open automatically at the selected Central time. A start time that has already arrived is queued immediately.":"You can review it on the website and use officer controls before opening or publishing it."}</p></div>{submitError?<p className="giveaway-wizard-error" role="alert">{submitError}</p>:null}
          </section>

          <footer className="giveaway-wizard-footer"><button type="button" className="button secondary" onClick={step===1?requestClose:previous}>{step===1?"Cancel":"Previous"}</button><span>Step {step} of 4</span>{step<4?<button key={`wizard-next-${step}`} type="button" className="button primary" onClick={event=>{event.preventDefault();next();}}>Next</button>:<button key="wizard-submit" type="submit" className="button primary" disabled={saving}>{saving?"Saving…":review?.scheduled?"Schedule Giveaway":editingDraft?"Save Draft":"Create Draft"}</button>}</footer>
        </form>
      </section>
    </div>:null}
  </>;
}
