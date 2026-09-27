"use server";

import { Buffer } from "node:buffer";
import { Client } from "pg";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { ensureGiveawayTables } from "./schema";
import { changeGiveawayStatus, claimFcfs, createGiveaway, deleteGiveawayDraft, deleteTestGiveaway, updateGiveawayDraft, drawRandomGiveaway, enterGiveaway, finalizeContest, getGiveawayEligibility, saveContestSubmission, manageContestSubmission, queueGiveawayDiscordJob, requestDeleteGiveaway, toggleContestVote, resolveContestPlacement, saveObjectiveScore, savePrizeInventoryItem, archivePrizeInventoryItem, saveGiveawayTemplate, archiveGiveawayTemplate, saveTemplateFromGiveaway, createDraftFromTemplate } from "./service";
import type { GiveawayActor } from "./types";

type Session = { user?: { name?: string|null; email?: string|null; groups?: string[]; discordUserId?: string|null } } | null;

async function db() { const client=new Client({connectionString:process.env.DATABASE_URL}); await client.connect(); return client; }
function groups(session:Session){ return Array.isArray(session?.user?.groups)?session!.user!.groups!.map(String):[]; }
function officer(session:Session){ return groups(session).some(group=>["admins","guild officers"].includes(group.toLowerCase())); }
async function actorFor(client:Client,session:Session):Promise<GiveawayActor>{
  const discordUserId=String(session?.user?.discordUserId||"").trim()||null;
  const eligible=await getGiveawayEligibility(client,discordUserId);
  return {discordUserId,characterId:eligible.character?.id||null,characterName:eligible.character?.characterName||null,isOfficer:officer(session),actorLabel:eligible.character?.characterName||session?.user?.email||session?.user?.name||"Unknown user"};
}
function bool(form:FormData,key:string){return form.get(key)==="on"||form.get(key)==="true";}
function number(form:FormData,key:string,fallback:number,min:number,max:number){const value=Number(form.get(key)||fallback);return Number.isFinite(value)?Math.min(max,Math.max(min,Math.floor(value))):fallback;}
function text(form:FormData,key:string){return String(form.get(key)||"").trim();}
const PORTAL_TIME_ZONE="America/Chicago";
function timeZoneOffsetMs(at:Date){
  const zone=new Intl.DateTimeFormat("en-US",{timeZone:PORTAL_TIME_ZONE,timeZoneName:"longOffset"}).formatToParts(at).find(part=>part.type==="timeZoneName")?.value||"GMT+00:00";
  const match=/GMT([+-])(\d{2}):?(\d{2})/.exec(zone);if(!match)return 0;
  const minutes=Number(match[2])*60+Number(match[3]);return(match[1]==="-"?-1:1)*minutes*60000;
}
function dateValue(form:FormData,key:string){
  const value=text(form,key);if(!value)return null;
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);if(!match)throw new Error(`Invalid ${key} date/time.`);
  const wall=Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]),Number(match[4]),Number(match[5]),Number(match[6]||0));
  let parsed=new Date(wall-timeZoneOffsetMs(new Date(wall)));parsed=new Date(wall-timeZoneOffsetMs(parsed));
  const parts=new Map(new Intl.DateTimeFormat("en-US",{timeZone:PORTAL_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(parsed).filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
  if(parts.get("year")!==match[1]||parts.get("month")!==match[2]||parts.get("day")!==match[3]||parts.get("hour")!==match[4]||parts.get("minute")!==match[5]||parts.get("second")!==(match[6]||"00"))throw new Error(`The ${key} time does not exist in Central time because of daylight saving time.`);
  return parsed.toISOString();
}


async function giveawayInput(formData:FormData){
  const prizePhotoValue=formData.get("prizePhoto");const prizePhoto=prizePhotoValue instanceof File&&prizePhotoValue.size>0?prizePhotoValue:null;
  if(prizePhoto&&!["image/jpeg","image/png","image/gif","image/webp"].includes(prizePhoto.type.toLowerCase()))throw new Error("Prize artwork must be a JPG, PNG, GIF, or WebP image.");
  if(prizePhoto&&prizePhoto.size>10*1024*1024)throw new Error("Prize artwork must be 10 MB or smaller.");
  const prizeImageData=prizePhoto?Buffer.from(await prizePhoto.arrayBuffer()):null;
  const kind=text(formData,"kind")||"random";const winnerMode=kind==="fcfs"?"fcfs":["contest","objective"].includes(kind)?(text(formData,"winnerMode")||"member_vote"):"random";
  return{kind,title:text(formData,"title"),description:text(formData,"description"),rules:text(formData,"rules"),theme:text(formData,"theme"),winnerMode,visibilityMode:text(formData,"visibilityMode")==="anonymous"?"anonymous":"public",ballotPrivacyMode:["public","anonymous"].includes(text(formData,"ballotPrivacyMode"))?text(formData,"ballotPrivacyMode"):"private",liveTotalsVisible:bool(formData,"liveTotalsVisible"),isTest:bool(formData,"isTest"),opensAt:dateValue(formData,"opensAt"),closesAt:dateValue(formData,"closesAt"),submissionOpensAt:dateValue(formData,"submissionOpensAt"),submissionClosesAt:dateValue(formData,"submissionClosesAt"),votingOpensAt:dateValue(formData,"votingOpensAt"),votingClosesAt:dateValue(formData,"votingClosesAt"),winnerCount:number(formData,"winnerCount",1,1,100),alternateCount:number(formData,"alternateCount",0,0,100),votesAllowed:number(formData,"votesAllowed",1,1,3),placementCount:number(formData,"placementCount",1,1,20),maxPhotos:number(formData,"maxPhotos",4,1,10),maxEntriesPerMember:number(formData,"maxEntriesPerMember",1,1,10),cooldownPolicy:text(formData,"cooldownPolicy")||"none",claimPeriodEnabled:bool(formData,"claimPeriodEnabled"),claimWindowHours:number(formData,"claimWindowHours",72,1,8760),tiePolicy:text(formData,"tiePolicy")||"random",qualificationInstructions:text(formData,"qualificationInstructions"),objectiveMetricLabel:text(formData,"objectiveMetricLabel"),objectiveDirection:text(formData,"objectiveDirection")==="lowest"?"lowest":"highest",evidenceRequired:bool(formData,"evidenceRequired"),postOpening:bool(formData,"postOpening"),remindersEnabled:bool(formData,"remindersEnabled"),reminderMinutes:text(formData,"reminderMinutes").split(",").map(v=>Number(v.trim())).filter(v=>Number.isFinite(v)&&v>0),postVotingOpen:bool(formData,"postVotingOpen"),discordContestGallery:bool(formData,"discordContestGallery"),discordVotingEnabled:bool(formData,"discordVotingEnabled"),postResults:bool(formData,"postResults"),discordAutoEnroll:bool(formData,"discordAutoEnroll"),discordSourceChannelId:text(formData,"discordSourceChannelId"),inventoryItemId:formData.get("inventoryItemId")?number(formData,"inventoryItemId",0,1,2147483647):null,prizeName:text(formData,"prizeName"),prizeQuantity:number(formData,"prizeQuantity",1,1,10000),prizeCategory:text(formData,"prizeCategory")||"in_game",prizeDonor:text(formData,"prizeDonor"),prizeNotes:text(formData,"prizeNotes"),prizeImageFilename:prizePhoto?.name||null,prizeImageMimeType:prizePhoto?.type||null,prizeImageData};
}

export async function createGiveawayAction(formData:FormData){
  const session=await auth() as Session;const client=await db();
  try{const giveawayId=await createGiveaway(client,await actorFor(client,session),await giveawayInput(formData));revalidatePath("/");return{giveawayId};}
  finally{await client.end();}
}
export async function updateGiveawayDraftAction(formData:FormData){
  const session=await auth() as Session;const client=await db();
  try{const giveawayId=number(formData,"giveawayId",0,1,2147483647);await updateGiveawayDraft(client,await actorFor(client,session),giveawayId,await giveawayInput(formData));revalidatePath("/");return{giveawayId};}
  finally{await client.end();}
}
export async function deleteGiveawayDraftAction(formData:FormData){
  const session=await auth() as Session;const client=await db();
  try{await deleteGiveawayDraft(client,await actorFor(client,session),number(formData,"giveawayId",0,1,2147483647));revalidatePath("/");}
  finally{await client.end();}
}

export async function changeGiveawayStatusAction(formData:FormData){const session=await auth() as Session;const client=await db();try{await changeGiveawayStatus(client,await actorFor(client,session),number(formData,"giveawayId",0,1,2147483647),text(formData,"nextStatus"));}finally{await client.end();}revalidatePath("/");}
export async function enterGiveawayAction(formData:FormData){const session=await auth() as Session;const client=await db();try{await enterGiveaway(client,await actorFor(client,session),number(formData,"giveawayId",0,1,2147483647),false);}finally{await client.end();}revalidatePath("/");}
export async function withdrawGiveawayAction(formData:FormData){const session=await auth() as Session;const client=await db();try{await enterGiveaway(client,await actorFor(client,session),number(formData,"giveawayId",0,1,2147483647),true);}finally{await client.end();}revalidatePath("/");}
export async function claimFcfsAction(formData:FormData){
  const session=await auth() as Session;const client=await db();
  try{
    await claimFcfs(client,await actorFor(client,session),number(formData,"giveawayId",0,1,2147483647));
    revalidatePath("/");return{ok:true,message:"Claim recorded."};
  }catch(error){
    const message=error instanceof Error?error.message:"That prize could not be claimed.";
    const expected=/already claimed|already entered|available prizes|not open|prize position|winner cooldown|not eligible|current FC|Discord/i.test(message);
    return{ok:false,message:expected?message:"That prize could not be claimed. Refresh the page and try again."};
  }finally{await client.end();}
}
export async function drawGiveawayAction(formData:FormData){const session=await auth() as Session;const client=await db();try{await drawRandomGiveaway(client,await actorFor(client,session),number(formData,"giveawayId",0,1,2147483647));}finally{await client.end();}revalidatePath("/");}
export async function finalizeContestAction(formData:FormData){const session=await auth() as Session;const client=await db();try{await finalizeContest(client,await actorFor(client,session),number(formData,"giveawayId",0,1,2147483647));}finally{await client.end();}revalidatePath("/");}
export async function toggleContestVoteAction(formData:FormData){const session=await auth() as Session;const client=await db();try{await toggleContestVote(client,await actorFor(client,session),number(formData,"giveawayId",0,1,2147483647),number(formData,"submissionId",0,1,2147483647),"website",formData.get("rankChoice")?number(formData,"rankChoice",1,1,3):null);}finally{await client.end();}revalidatePath("/");}
export async function deleteGiveawayAction(formData:FormData){
  const session=await auth() as Session;const client=await db();
  try{await requestDeleteGiveaway(client,await actorFor(client,session),number(formData,"giveawayId",0,1,2147483647));revalidatePath("/");}
  finally{await client.end();}
}

export async function deleteTestGiveawayAction(formData:FormData){const session=await auth() as Session;const client=await db();try{await deleteTestGiveaway(client,await actorFor(client,session),number(formData,"giveawayId",0,1,2147483647));}finally{await client.end();}revalidatePath("/");}

export async function saveContestSubmissionAction(formData:FormData){const session=await auth() as Session;const client=await db();try{if(formData.get("contentRights")!=="on")throw new Error("Confirm that you have permission to submit and display this entry.");const raw=formData.getAll("photos").filter((value):value is File=>value instanceof File&&value.size>0);const files=[];for(const file of raw){files.push({name:file.name,type:file.type||"application/octet-stream",data:Buffer.from(await file.arrayBuffer())});}await saveContestSubmission(client,await actorFor(client,session),number(formData,"giveawayId",0,1,2147483647),text(formData,"title"),text(formData,"description"),files);}finally{await client.end();}revalidatePath("/");}

export async function manageContestSubmissionAction(formData:FormData){const session=await auth() as Session;const client=await db();try{const action=text(formData,"submissionAction") as "remove_image"|"move_up"|"move_down"|"withdraw"|"disqualify";if(!["remove_image","move_up","move_down","withdraw","disqualify"].includes(action))throw new Error("Choose a valid submission action.");await manageContestSubmission(client,await actorFor(client,session),number(formData,"giveawayId",0,1,2147483647),number(formData,"submissionId",0,1,2147483647),action,formData.get("imageId")?number(formData,"imageId",0,1,2147483647):null,text(formData,"reason"));}finally{await client.end();}revalidatePath("/");}
export async function cleanContestDiscordPostsAction(formData:FormData){const session=await auth() as Session;const client=await db();try{await ensureGiveawayTables(client);const actor=await actorFor(client,session);if(!actor.isOfficer)throw new Error("Officer access is required.");const giveawayId=number(formData,"giveawayId",0,1,2147483647);const exists=await client.query(`select 1 from portal_giveaways where id=$1 and kind='contest';`,[giveawayId]);if(!exists.rows.length)throw new Error("Contest not found.");await queueGiveawayDiscordJob(client,giveawayId,"delete_contest_posts",String(Date.now()));await client.query(`insert into portal_giveaway_audit(giveaway_id,action_type,actor_discord_user_id,actor_character_id,actor_label,details) values($1,'contest_discord_cleanup_requested',$2,$3,$4,'{}');`,[giveawayId,actor.discordUserId,actor.characterId,actor.actorLabel]);}finally{await client.end();}revalidatePath("/");}

export async function refreshGiveawayDiscordAction(formData:FormData){
  const session=await auth() as Session;const client=await db();try{
    await ensureGiveawayTables(client);const actor=await actorFor(client,session);if(!actor.isOfficer)throw new Error("Officer access is required.");
    const giveawayId=number(formData,"giveawayId",0,1,2147483647),refreshType=text(formData,"refreshType");
    const giveaway=(await client.query(`select kind,status,discord_auto_enroll from portal_giveaways where id=$1;`,[giveawayId])).rows[0];if(!giveaway)throw new Error("Giveaway or contest not found.");
    const allowed=new Set(["opening","results"]);if(giveaway.kind==="contest")allowed.add("contest");if(giveaway.kind==="contest"&&giveaway.discord_auto_enroll)allowed.add("disclosure");if(!allowed.has(refreshType))throw new Error("Choose a valid Discord post to refresh.");
    const jobKind=refreshType==="opening"?"sync_opening":refreshType==="results"?"sync_results":refreshType==="contest"?"sync_contest":giveaway.status==="submissions_open"?"sync_disclosure_open":"sync_disclosure_closed";
    await queueGiveawayDiscordJob(client,giveawayId,jobKind,`manual-${Date.now()}`);
    await client.query(`insert into portal_giveaway_audit(giveaway_id,action_type,actor_discord_user_id,actor_character_id,actor_label,details) values($1,'discord_refresh_requested',$2,$3,$4,$5::jsonb);`,[giveawayId,actor.discordUserId,actor.characterId,actor.actorLabel,JSON.stringify({refreshType,jobKind})]);
  }finally{await client.end();}revalidatePath("/");
}

export async function manageGiveawayResultAction(formData:FormData){
  const session=await auth() as Session;const client=await db();
  try{
    await ensureGiveawayTables(client);const actor=await actorFor(client,session);if(!actor.isOfficer)throw new Error("Officer access is required.");
    const resultId=number(formData,"resultId",0,1,2147483647),action=text(formData,"resultAction"),reason=text(formData,"reason");if(!["claimed","forfeit","promote"].includes(action))throw new Error("Choose a valid result action.");
    await client.query("begin");
    const result=(await client.query(`select r.*,g.id giveaway_id,g.kind giveaway_kind,g.post_results,g.post_opening,g.closes_at from portal_giveaway_results r join portal_giveaways g on g.id=r.giveaway_id where r.id=$1 for update of r,g;`,[resultId])).rows[0];if(!result)throw new Error("Result not found.");
    const artifactKinds=(await client.query(`select artifact_kind from portal_giveaway_discord_artifacts where giveaway_id=$1 and active=true and artifact_kind in ('opening','results');`,[result.giveaway_id])).rows.map(row=>String(row.artifact_kind));const hasOpeningPost=Boolean(result.post_opening)||artifactKinds.includes("opening"),hasResultsPost=Boolean(result.post_results)||artifactKinds.includes("results");
    if(action==="claimed"){
      const eligible=await client.query(`select 1 from portal_giveaway_results r join portal_characters c on c.id=r.character_id join portal_discord_links dl on dl.character_id=c.id join portal_discord_member_snapshots s on s.discord_user_id=dl.discord_user_id where r.id=$1 and c.active=true and c.fc_membership_status='current' and s.present_in_guild=true and exists(select 1 from portal_fc_verification verification where verification.id=1 and verification.status='verified') limit 1;`,[resultId]);if(!eligible.rows.length)throw new Error("The winner is no longer eligible to claim this prize.");
      await client.query(`update portal_giveaway_results set claim_status='claimed' where id=$1;`,[resultId]);
    }else{
      if(!reason)throw new Error("A reason is required for forfeiture or replacement.");
      if(action==="promote"&&result.giveaway_kind==="fcfs")throw new Error("First-come giveaways reopen the forfeited prize instead of promoting an alternate.");
      await client.query(`update portal_giveaway_results set claim_status='forfeited',replacement_reason=$2 where id=$1;`,[resultId,reason]);
      if(action==="promote"){
        const alt=(await client.query(`select * from portal_giveaway_results where giveaway_id=$1 and result_kind='alternate' and claim_status='not_required' order by placement limit 1 for update;`,[result.giveaway_id])).rows[0];if(!alt)throw new Error("No unused alternate is available.");
        await client.query(`update portal_giveaway_results set placement=1000000+id,public=false where id=$1;`,[resultId]);
        await client.query(`update portal_giveaway_results set result_kind=$6,placement=$2,display_placement=coalesce($7,$2),public=true,claim_status=$3,claim_deadline=$4,replacement_reason=$5 where id=$1;`,[alt.id,result.placement,result.claim_status==='awaiting'?'awaiting':'not_required',result.claim_deadline,reason,result.result_kind,result.display_placement]);
        await client.query(`update portal_giveaway_results set claim_status='replaced' where id=$1;`,[resultId]);
      }else if(result.giveaway_kind==="fcfs"&&result.result_kind==="fcfs"){
        await client.query(`update portal_giveaway_entries set status='withdrawn',invalidated_at=now(),invalidation_reason=$3 where giveaway_id=$1 and character_id=$2 and status='claimed';`,[result.giveaway_id,result.character_id,`FCFS result forfeited: ${reason}`]);
        const reopened=(await client.query(`update portal_giveaways set status=case when closes_at is null or closes_at>now() then 'open' else 'completed' end,updated_at=now() where id=$1 returning status;`,[result.giveaway_id])).rows[0]?.status==="open";
        if(reopened&&hasOpeningPost)await queueGiveawayDiscordJob(client,result.giveaway_id,"sync_opening",`forfeit-reopen-${resultId}-${Date.now()}`);
      }
    }
    await client.query(`insert into portal_giveaway_audit(giveaway_id,action_type,actor_discord_user_id,actor_character_id,actor_label,details) values($1,$2,$3,$4,$5,$6::jsonb);`,[result.giveaway_id,`result_${action}`,actor.discordUserId,actor.characterId,actor.actorLabel,JSON.stringify({resultId,reason})]);
    if(hasResultsPost)await client.query(`insert into portal_giveaway_discord_jobs(giveaway_id,job_kind,dedupe_key,payload) values($1,'sync_results',$2,'{}') on conflict(dedupe_key) do nothing;`,[result.giveaway_id,`giveaway:${result.giveaway_id}:results:${Date.now()}`]);
    await client.query("commit");revalidatePath("/");return{ok:true};
  }catch(error){await client.query("rollback").catch(()=>{});throw error;}
  finally{await client.end();}
}

export async function resolveContestPlacementAction(formData:FormData){const session=await auth() as Session;const client=await db();try{await resolveContestPlacement(client,await actorFor(client,session),number(formData,"giveawayId",0,1,2147483647),number(formData,"submissionId",0,1,2147483647));}finally{await client.end();}revalidatePath("/");}
export async function saveObjectiveScoreAction(formData:FormData){const session=await auth() as Session;const client=await db();try{await saveObjectiveScore(client,await actorFor(client,session),number(formData,"giveawayId",0,1,2147483647),number(formData,"submissionId",0,1,2147483647),Number(formData.get("score")),text(formData,"evidence"),bool(formData,"verified"));}finally{await client.end();}revalidatePath("/");}
export async function savePrizeInventoryAction(formData:FormData){const session=await auth() as Session;const client=await db();try{await savePrizeInventoryItem(client,await actorFor(client,session),{name:text(formData,"name"),category:text(formData,"category")||"in_game",donor:text(formData,"donor"),quantity:number(formData,"quantity",0,0,100000),notes:text(formData,"notes")});}finally{await client.end();}revalidatePath("/");}
export async function archivePrizeInventoryAction(formData:FormData){const session=await auth() as Session;const client=await db();try{await archivePrizeInventoryItem(client,await actorFor(client,session),number(formData,"id",0,1,2147483647));}finally{await client.end();}revalidatePath("/");}
export async function saveGiveawayTemplateAction(formData:FormData){const session=await auth() as Session;const client=await db();try{const payload=JSON.parse(text(formData,"payload")||"{}");await saveGiveawayTemplate(client,await actorFor(client,session),text(formData,"name"),payload);}finally{await client.end();}revalidatePath("/");}
export async function archiveGiveawayTemplateAction(formData:FormData){const session=await auth() as Session;const client=await db();try{await archiveGiveawayTemplate(client,await actorFor(client,session),number(formData,"id",0,1,2147483647));}finally{await client.end();}revalidatePath("/");}
export async function saveTemplateFromGiveawayAction(formData:FormData){const session=await auth() as Session;const client=await db();try{await saveTemplateFromGiveaway(client,await actorFor(client,session),number(formData,"giveawayId",0,1,2147483647),text(formData,"name"));}finally{await client.end();}revalidatePath("/");}
export async function createDraftFromTemplateAction(formData:FormData){const session=await auth() as Session;const client=await db();try{await createDraftFromTemplate(client,await actorFor(client,session),number(formData,"templateId",0,1,2147483647));}finally{await client.end();}revalidatePath("/");}
