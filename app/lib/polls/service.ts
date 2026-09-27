import { randomInt } from "node:crypto";
import type { Client } from "pg";
import { decryptPollDiscordId, encryptPollDiscordId, pollVoterKey } from "./identity";
import { ensurePollTables } from "./schema";
import type { PollActor, PollBallotDetail, PollChoice, PollDashboard, PollRecord, PollType } from "./types";

export async function getPollEligibility(client:Client,discordUserId:string|null){
  if(!discordUserId)return{eligible:false,reason:"Sign in with a linked Discord account to vote.",character:null};
  const result=await client.query(`select c.id::int,c.character_name,c.world from portal_discord_links dl join portal_characters c on c.id=dl.character_id join portal_discord_member_snapshots s on s.discord_user_id=dl.discord_user_id where dl.discord_user_id=$1 and c.active=true and c.fc_membership_status='current' and s.present_in_guild=true and exists(select 1 from portal_fc_verification verification where verification.id=1 and verification.status='verified') limit 1`,[discordUserId]);
  const row=result.rows[0];
  return row?{eligible:true,reason:null,character:{id:Number(row.id),characterName:String(row.character_name),world:String(row.world)}}:{eligible:false,reason:"Voting requires current FC membership and current presence in the FC Discord.",character:null};
}

async function audit(client:Client,pollId:number|null,actionType:string,actor:PollActor,details:Record<string,unknown>={}){
  await client.query(`insert into portal_poll_audit(poll_id,action_type,actor_discord_user_id,actor_character_id,actor_label,details) values($1,$2,$3,$4,$5,$6::jsonb)`,[pollId,actionType,actor.discordUserId,actor.characterId,actor.actorLabel,JSON.stringify(details)]);
}

export async function queuePollDiscordJob(client:Client,pollId:number,jobKind:string,suffix:string,runAfter:string|Date=new Date(),payload:Record<string,unknown>={}){
  const dedupe=`poll:${pollId}:${jobKind}:${suffix}`;
  await client.query(`insert into portal_poll_discord_jobs(poll_id,job_kind,dedupe_key,payload,run_after) values($1,$2,$3,$4::jsonb,$5) on conflict(dedupe_key) do update set payload=excluded.payload,status='pending',run_after=excluded.run_after,last_error=null,updated_at=now()`,[pollId,jobKind,dedupe,JSON.stringify(payload),runAfter instanceof Date?runAfter.toISOString():runAfter]);
}

function normalizedOptions(input:any){
  const pollType=String(input.pollType||"") as PollType;
  if(pollType==="yes_no")return[{label:"Yes",description:""},{label:"No",description:""},...(input.abstainEnabled?[{label:"Abstain",description:""}]:[])];
  if(pollType==="rating")return[1,2,3,4,5].map(value=>({label:String(value),description:value===1?"Lowest rating":value===5?"Highest rating":""}));
  return(Array.isArray(input.options)?input.options:[]).map((option:any)=>({label:String(option.label||"").trim(),description:String(option.description||"").trim(),imageFilename:option.imageFilename||null,imageMimeType:option.imageMimeType||null,imageData:option.imageData||null,existingChoiceId:Number(option.existingChoiceId)||null})).filter((option:any)=>option.label);
}

function validatedPollValues(input:any,options:any[],requireFutureOpening=false){
  const pollType=String(input.pollType||"") as PollType;
  if(!["single","multiple","yes_no","ranked","rating","image"].includes(pollType))throw new Error("Choose a valid poll type.");
  const question=String(input.question||"").trim(),description=String(input.description||"").trim();
  if(!question||question.length>240)throw new Error("Enter a poll question of 240 characters or fewer.");
  if(description.length>1500)throw new Error("Poll details must be 1,500 characters or fewer.");
  if(options.length<2||options.length>25)throw new Error("Polls require between 2 and 25 choices.");
  if(pollType==="image"&&options.length>10)throw new Error("Image polls support no more than 10 choices.");
  if(new Set(options.map((option:any)=>option.label.toLowerCase())).size!==options.length)throw new Error("Poll choices must be unique.");
  const channelId=String(input.channelId||"").trim(),channelName=String(input.channelName||"").trim();
  if(!/^\d{15,22}$/.test(channelId))throw new Error("Choose a writable Discord channel.");
  const opensAt=input.opensAt?new Date(input.opensAt):null,closesAt=new Date(input.closesAt);
  if(!Number.isFinite(closesAt.getTime())||closesAt.getTime()<=Date.now())throw new Error("Closing time must be in the future.");
  if(opensAt&&(!Number.isFinite(opensAt.getTime())||opensAt.getTime()>=closesAt.getTime()))throw new Error("Opening time must be before closing time.");
  if(requireFutureOpening&&(!opensAt||opensAt.getTime()<=Date.now()))throw new Error("A scheduled poll can only be edited before its future opening time.");
  const privacyMode=["public","private","anonymous"].includes(input.privacyMode)?input.privacyMode:"private";
  const resultsVisibility=["hidden_until_close","live","officer_only_until_close"].includes(input.resultsVisibility)?input.resultsVisibility:"hidden_until_close";
  const maxSelections=pollType==="multiple"?Math.max(1,Math.min(options.length,Number(input.maxSelections)||1)):1;
  const winnerCount=pollType==="multiple"?Math.max(1,Math.min(options.length,Number(input.winnerCount)||maxSelections)):1;
  const minSelections=pollType==="multiple"&&input.minSelections!==null&&input.minSelections!==undefined&&input.minSelections!==""?Math.floor(Number(input.minSelections)):null;
  if(minSelections!==null&&(!Number.isFinite(minSelections)||minSelections<1||minSelections>maxSelections))throw new Error("Minimum selections must be between 1 and the maximum selections allowed.");
  const rankDepth=pollType==="ranked"?Math.max(1,Math.min(3,options.length,Number(input.rankDepth)||3)):1;
  const reminders=(Array.isArray(input.reminders)?input.reminders:[]).map(Number).filter((value:number)=>Number.isInteger(value)&&value>0&&value<=10080);
  return{pollType,question,description,channelId,channelName,opensAt,closesAt,privacyMode,resultsVisibility,maxSelections,winnerCount,minSelections,rankDepth,reminders};
}

export async function createPoll(client:Client,actor:PollActor,input:any){
  if(!actor.isOfficer)throw new Error("Officer access is required to create polls.");
  await ensurePollTables(client);
  const options=normalizedOptions(input);
  const {pollType,question,description,channelId,channelName,opensAt,closesAt,privacyMode,resultsVisibility,maxSelections,winnerCount,minSelections,rankDepth,reminders}=validatedPollValues(input,options);
  if(pollType==="image"&&options.some((option:any)=>!option.imageData))throw new Error("Every image-poll choice requires an image.");
  const status=opensAt&&opensAt.getTime()>Date.now()?"scheduled":"open";
  await client.query("begin");
  try{
    const result=await client.query(`insert into portal_polls(status,poll_type,question,description,privacy_mode,results_visibility,max_selections,rank_depth,abstain_enabled,quorum_minimum,officer_voting_enabled,is_test,opens_at,closes_at,target_channel_id,target_channel_name,reminder_minutes,post_results,created_by_discord_user_id,created_by,min_selections,winner_count) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) returning id::int`,[status,pollType,question,description,privacyMode,resultsVisibility,maxSelections,rankDepth,Boolean(input.abstainEnabled),input.quorumMinimum?Math.max(1,Number(input.quorumMinimum)):null,input.officerVotingEnabled!==false,Boolean(input.isTest),opensAt?.toISOString()||null,closesAt.toISOString(),channelId,channelName,reminders,Boolean(input.postResults),actor.discordUserId,actor.actorLabel,minSelections,winnerCount]);
    const pollId=Number(result.rows[0].id);
    for(let index=0;index<options.length;index++){
      const option=options[index];
      await client.query(`insert into portal_poll_choices(poll_id,label,description,sort_order,image_filename,image_mime_type,image_data) values($1,$2,$3,$4,$5,$6,$7)`,[pollId,option.label,option.description,index+1,option.imageFilename,option.imageMimeType,option.imageData]);
    }
    await queuePollDiscordJob(client,pollId,"sync_opening","initial",opensAt?.toISOString()||new Date());
    for(const minutes of reminders){const at=new Date(closesAt.getTime()-minutes*60000);if(at.getTime()>Date.now()&&(!opensAt||at.getTime()>opensAt.getTime()))await queuePollDiscordJob(client,pollId,"reminder",String(minutes),at,{minutes});}
    await audit(client,pollId,"poll_created",actor,{pollType,privacyMode,resultsVisibility,channelId,scheduled:status==="scheduled"});
    await client.query("commit");return pollId;
  }catch(error){await client.query("rollback");throw error;}
}

export async function editScheduledPoll(client:Client,actor:PollActor,pollId:number,input:any){
  if(!actor.isOfficer)throw new Error("Officer access is required to edit polls.");
  await ensurePollTables(client);await client.query("begin");
  try{
    const current=(await client.query(`select * from portal_polls where id=$1 for update`,[pollId])).rows[0];
    if(!current)throw new Error("Poll not found.");
    if(current.status!=="scheduled"||!current.opens_at||new Date(current.opens_at).getTime()<=Date.now())throw new Error("This poll can no longer be edited because its opening time has arrived.");
    const options=normalizedOptions(input);
    for(const option of options){if(!option.imageData&&option.existingChoiceId){const existing=(await client.query(`select image_filename,image_mime_type,image_data from portal_poll_choices where id=$1 and poll_id=$2`,[option.existingChoiceId,pollId])).rows[0];if(existing?.image_data){option.imageFilename=existing.image_filename;option.imageMimeType=existing.image_mime_type;option.imageData=existing.image_data;}}}
    const values=validatedPollValues(input,options,true);
    if(values.pollType==="image"&&options.some((option:any)=>!option.imageData))throw new Error("Every image-poll choice requires an image.");
    await client.query(`update portal_polls set poll_type=$2,question=$3,description=$4,privacy_mode=$5,results_visibility=$6,max_selections=$7,min_selections=$8,rank_depth=$9,abstain_enabled=$10,quorum_minimum=$11,officer_voting_enabled=$12,opens_at=$13,closes_at=$14,target_channel_id=$15,target_channel_name=$16,reminder_minutes=$17,post_results=$18,winner_count=$19,updated_at=now() where id=$1`,[pollId,values.pollType,values.question,values.description,values.privacyMode,values.resultsVisibility,values.maxSelections,values.minSelections,values.rankDepth,Boolean(input.abstainEnabled),input.quorumMinimum?Math.max(1,Number(input.quorumMinimum)):null,input.officerVotingEnabled!==false,values.opensAt!.toISOString(),values.closesAt.toISOString(),values.channelId,values.channelName,values.reminders,Boolean(input.postResults),values.winnerCount]);
    await client.query(`delete from portal_poll_choices where poll_id=$1`,[pollId]);
    for(let index=0;index<options.length;index++){const option=options[index];await client.query(`insert into portal_poll_choices(poll_id,label,description,sort_order,image_filename,image_mime_type,image_data) values($1,$2,$3,$4,$5,$6,$7)`,[pollId,option.label,option.description,index+1,option.imageFilename,option.imageMimeType,option.imageData]);}
    await client.query(`update portal_poll_discord_jobs set status='cancelled',updated_at=now() where poll_id=$1 and status in ('pending','failed')`,[pollId]);
    const suffix=`edit-${Date.now()}`;await queuePollDiscordJob(client,pollId,"sync_opening",suffix,values.opensAt!);
    for(const minutes of values.reminders){const at=new Date(values.closesAt.getTime()-minutes*60000);if(at.getTime()>values.opensAt!.getTime())await queuePollDiscordJob(client,pollId,"reminder",`${suffix}-${minutes}`,at,{minutes});}
    await audit(client,pollId,"scheduled_poll_edited",actor,{channelId:values.channelId,opensAt:values.opensAt!.toISOString(),closesAt:values.closesAt.toISOString()});
    await client.query("commit");
  }catch(error){await client.query("rollback");throw error;}
}

async function ballotIdentity(client:Client,pollId:number,discordUserId:string){
  const key=pollVoterKey(pollId,discordUserId);
  return{key,ciphertext:encryptPollDiscordId(discordUserId)};
}

export async function savePollBallot(client:Client,actor:PollActor,pollId:number,selections:Array<{choiceId:number;rank?:number|null}>,source:"website"|"discord"="website"){
  await ensurePollTables(client);
  if(!actor.discordUserId)throw new Error("A linked Discord account is required.");
  const eligibility=await getPollEligibility(client,actor.discordUserId);if(!eligibility.eligible||!eligibility.character)throw new Error(eligibility.reason||"You are not eligible to vote.");
  await client.query("begin");
  try{
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`,[`poll-vote:${pollId}:${actor.discordUserId}`]);
    const poll=(await client.query(`select * from portal_polls where id=$1 for update`,[pollId])).rows[0];
    if(!poll||poll.status!=="open"||new Date(poll.closes_at).getTime()<=Date.now())throw new Error("This poll is not open for voting.");
    if(actor.isOfficer&&!poll.officer_voting_enabled)throw new Error("Officer voting is disabled for this poll.");
    const valid=(await client.query(`select id::int from portal_poll_choices where poll_id=$1`,[pollId])).rows.map(row=>Number(row.id));
    const unique=[...new Map(selections.map(item=>[Number(item.choiceId),{choiceId:Number(item.choiceId),rank:item.rank==null?null:Number(item.rank)}])).values()];
    if(!unique.length||unique.some(item=>!valid.includes(item.choiceId)))throw new Error("Choose a valid poll option.");
    if(poll.poll_type==="multiple"&&unique.length>Number(poll.max_selections))throw new Error(`Choose no more than ${poll.max_selections} options.`);
    if(poll.poll_type==="multiple"&&poll.min_selections!==null&&unique.length<Number(poll.min_selections))throw new Error(`Choose at least ${poll.min_selections} options before submitting.`);
    if(!["multiple","ranked"].includes(poll.poll_type)&&unique.length!==1)throw new Error("Choose exactly one option.");
    if(poll.poll_type==="ranked"){
      if(unique.length!==Number(poll.rank_depth))throw new Error(`Rank exactly ${poll.rank_depth} choices.`);
      const ranks=unique.map(item=>item.rank).sort();if(ranks.some((rank,index)=>rank!==index+1))throw new Error("Each ranked position must be used exactly once.");
    }
    const identity=await ballotIdentity(client,pollId,actor.discordUserId),anonymous=poll.privacy_mode==="anonymous";
    const ballot=(await client.query(`insert into portal_poll_ballots(poll_id,voter_key,voter_discord_user_id,voter_discord_ciphertext,voter_character_id,voter_label,voter_is_officer,source,counted,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,true,now()) on conflict(poll_id,voter_key) do update set voter_discord_user_id=excluded.voter_discord_user_id,voter_discord_ciphertext=excluded.voter_discord_ciphertext,voter_character_id=excluded.voter_character_id,voter_label=excluded.voter_label,voter_is_officer=excluded.voter_is_officer,source=excluded.source,counted=true,invalidated_at=null,invalidation_reason=null,updated_at=now() returning id::int`,[pollId,identity.key,anonymous?null:actor.discordUserId,anonymous?identity.ciphertext:null,anonymous?null:eligibility.character.id,anonymous?null:(actor.characterName||eligibility.character.characterName),actor.isOfficer,source])).rows[0];
    await client.query(`delete from portal_poll_ballot_choices where ballot_id=$1`,[ballot.id]);
    for(const item of unique)await client.query(`insert into portal_poll_ballot_choices(ballot_id,choice_id,rank_choice) values($1,$2,$3)`,[ballot.id,item.choiceId,item.rank]);
    await client.query(`update portal_polls set material_locked_at=coalesce(material_locked_at,now()),updated_at=now() where id=$1`,[pollId]);
    await queuePollDiscordJob(client,pollId,"sync_opening",`vote-${Date.now()}`);
    await client.query("commit");
  }catch(error){await client.query("rollback");throw error;}
}

async function revalidateBallots(client:Client,pollId:number){
  const ballots=(await client.query(`select id::int,voter_discord_user_id,voter_discord_ciphertext from portal_poll_ballots where poll_id=$1 and counted=true`,[pollId])).rows;
  for(const ballot of ballots){const discordId=ballot.voter_discord_user_id||decryptPollDiscordId(ballot.voter_discord_ciphertext);const eligible=discordId?(await getPollEligibility(client,discordId)).eligible:false;if(!eligible)await client.query(`update portal_poll_ballots set counted=false,invalidated_at=now(),invalidation_reason='No longer a current FC and Discord member',updated_at=now() where id=$1`,[ballot.id]);}
}

async function resultRows(client:Client,poll:any){
  return(await client.query(`select c.id::int,c.label,count(bc.ballot_id) filter(where b.counted=true)::int vote_count,coalesce(sum(case when bc.rank_choice is not null then $2-bc.rank_choice+1 else 1 end) filter(where b.counted=true),0)::int score from portal_poll_choices c left join portal_poll_ballot_choices bc on bc.choice_id=c.id left join portal_poll_ballots b on b.id=bc.ballot_id where c.poll_id=$1 group by c.id order by c.sort_order,c.id`,[poll.id,Number(poll.rank_depth)])).rows;
}

function pollCutoffOutcome(results:any[],poll:any){
  const metric=poll.poll_type==="ranked"?"score":"vote_count";
  const ranked=[...results].sort((left:any,right:any)=>Number(right[metric])-Number(left[metric])||Number(left.id)-Number(right.id));
  const winnerCount=Math.max(1,Math.min(Number(poll.winner_count)||1,ranked.length));
  const highest=Number(ranked[0]?.[metric]||0);
  if(highest<=0)return{ranked,guaranteed:[] as any[],tied:[] as any[],remaining:winnerCount,needsResolution:true,noVotes:true};
  const cutoff=Number(ranked[winnerCount-1]?.[metric]||0);
  const guaranteed=ranked.filter((row:any)=>Number(row[metric])>cutoff);
  const tied=ranked.filter((row:any)=>Number(row[metric])===cutoff);
  const remaining=winnerCount-guaranteed.length;
  return{ranked,guaranteed,tied,remaining,needsResolution:tied.length>remaining,noVotes:false};
}

async function replacePollWinners(client:Client,pollId:number,winners:any[],tieResolvedIds:Set<number>=new Set()){
  await client.query(`delete from portal_poll_winners where poll_id=$1`,[pollId]);
  for(let index=0;index<winners.length;index++){
    const choiceId=Number(winners[index].id??winners[index]);
    await client.query(`insert into portal_poll_winners(poll_id,choice_id,placement,selected_by_tie_resolution) values($1,$2,$3,$4)`,[pollId,choiceId,index+1,tieResolvedIds.has(choiceId)]);
  }
  await client.query(`update portal_polls set winner_choice_id=$2 where id=$1`,[pollId,winners.length?Number(winners[0].id??winners[0]):null]);
}

export async function finalizePoll(client:Client,pollId:number,actor:PollActor|null=null){
  await ensurePollTables(client);await client.query("begin");
  try{
    const poll=(await client.query(`select * from portal_polls where id=$1 for update`,[pollId])).rows[0];if(!poll)throw new Error("Poll not found.");if(["closed","cancelled"].includes(poll.status)){await client.query("commit");return poll.status;}
    await revalidateBallots(client,pollId);
    const count=Number((await client.query(`select count(*)::int count from portal_poll_ballots where poll_id=$1 and counted=true`,[pollId])).rows[0]?.count||0);
    if(poll.quorum_minimum&&count<Number(poll.quorum_minimum)){
      await replacePollWinners(client,pollId,[]);
      await client.query(`update portal_polls set status='closed',winner_choice_id=null,resolution_note=$2,updated_at=now() where id=$1`,[pollId,`Quorum not met (${count}/${poll.quorum_minimum})`]);
      if(poll.post_results)await queuePollDiscordJob(client,pollId,"sync_results",`quorum-${Date.now()}`);
      if(actor)await audit(client,pollId,"poll_closed_without_quorum",actor,{count,required:Number(poll.quorum_minimum)});
      await client.query("commit");return"closed";
    }
    if(poll.poll_type==="rating"){
      await replacePollWinners(client,pollId,[]);
      await client.query(`update portal_polls set status='closed',winner_choice_id=null,resolution_note='Rating poll completed',updated_at=now() where id=$1`,[pollId]);if(poll.post_results)await queuePollDiscordJob(client,pollId,"sync_results",`rating-${Date.now()}`);await client.query("commit");return"closed";
    }
    const outcome=pollCutoffOutcome(await resultRows(client,poll),poll);
    if(outcome.noVotes){await replacePollWinners(client,pollId,[]);await client.query(`update portal_polls set status='closed',resolution_note='No result — no counted ballots',updated_at=now() where id=$1`,[pollId]);if(poll.post_results)await queuePollDiscordJob(client,pollId,"sync_results",`no-votes-${Date.now()}`);if(actor)await audit(client,pollId,"poll_closed_without_ballots",actor);await client.query("commit");return"closed";}
    if(outcome.needsResolution){await replacePollWinners(client,pollId,outcome.guaranteed);await client.query(`update portal_polls set status='awaiting_tie',resolution_note=$2,updated_at=now() where id=$1`,[pollId,`Tie at the winning cutoff requires ${outcome.remaining} more selection${outcome.remaining===1?"":"s"}`]);await queuePollDiscordJob(client,pollId,"tie_alert",`cutoff-${Date.now()}`);if(actor)await audit(client,pollId,"poll_awaiting_tie",actor,{choiceIds:outcome.tied.map((row:any)=>row.id),remainingSlots:outcome.remaining});await client.query("commit");return"awaiting_tie";}
    const winners=[...outcome.guaranteed,...outcome.tied].slice(0,Number(poll.winner_count)||1);
    await replacePollWinners(client,pollId,winners);
    await client.query(`update portal_polls set status='closed',resolution_note='Winners determined from counted ballots',updated_at=now() where id=$1`,[pollId]);if(poll.post_results)await queuePollDiscordJob(client,pollId,"sync_results",`closed-${Date.now()}`);if(actor)await audit(client,pollId,"poll_closed",actor,{winnerChoiceIds:winners.map((row:any)=>row.id)});await client.query("commit");return"closed";
  }catch(error){await client.query("rollback");throw error;}
}

export async function requestPollEarlyEnd(client:Client,actor:PollActor,pollId:number){
  if(!actor.isOfficer)throw new Error("Officer access is required.");await ensurePollTables(client);await client.query("begin");
  try{
    const poll=(await client.query(`select status from portal_polls where id=$1 for update`,[pollId])).rows[0];
    if(!poll)throw new Error("Poll not found.");
    if(poll.status!=="open")throw new Error("Only an active poll can be ended early.");
    await client.query(`update portal_polls set closes_at=now(),resolution_note='Early ending requested by an officer',updated_at=now() where id=$1`,[pollId]);
    await client.query(`update portal_poll_discord_jobs set status='cancelled',updated_at=now() where poll_id=$1 and job_kind='reminder' and status in ('pending','failed')`,[pollId]);
    await audit(client,pollId,"poll_early_end_requested",actor);
    await client.query("commit");
  }catch(error){await client.query("rollback");throw error;}
}

export async function cancelPoll(client:Client,actor:PollActor,pollId:number){if(!actor.isOfficer)throw new Error("Officer access is required.");await ensurePollTables(client);const wasAwaitingTie=Boolean((await client.query(`select 1 from portal_polls where id=$1 and status='awaiting_tie'`,[pollId])).rows[0]);await client.query(`update portal_polls set status='cancelled',updated_at=now() where id=$1 and status not in ('closed','cancelled')`,[pollId]);await client.query(`update portal_poll_discord_jobs set status='cancelled',updated_at=now() where poll_id=$1 and status='pending'`,[pollId]);await queuePollDiscordJob(client,pollId,"sync_opening",`cancel-${Date.now()}`);if(wasAwaitingTie)await queuePollDiscordJob(client,pollId,"tie_alert",`cancel-${Date.now()}`);await audit(client,pollId,"poll_cancelled",actor);}

export async function deleteTestPoll(client:Client,actor:PollActor,pollId:number){
  if(!actor.isOfficer)throw new Error("Officer access is required.");await ensurePollTables(client);await client.query("begin");
  try{const poll=(await client.query(`select is_test from portal_polls where id=$1 for update`,[pollId])).rows[0];if(!poll?.is_test)throw new Error("Only disposable test polls can be deleted.");await client.query(`update portal_poll_discord_jobs set status='cancelled',updated_at=now() where poll_id=$1 and status in ('pending','failed')`,[pollId]);await queuePollDiscordJob(client,pollId,"delete_artifacts",`delete-${Date.now()}`,new Date(),{deletePoll:true});await audit(client,pollId,"test_poll_deletion_requested",actor);await client.query("commit");}catch(error){await client.query("rollback");throw error;}
}

export async function resolvePollTie(client:Client,actor:PollActor,pollId:number,mode:"extend"|"officer"|"random",choiceId:number|null,newClosesAt:string|null){
  if(!actor.isOfficer)throw new Error("Officer access is required.");await ensurePollTables(client);await client.query("begin");
  try{const poll=(await client.query(`select * from portal_polls where id=$1 for update`,[pollId])).rows[0];if(!poll||poll.status!=="awaiting_tie")throw new Error("This poll is not awaiting tie resolution.");const outcome=pollCutoffOutcome(await resultRows(client,poll),poll);
    if(mode==="extend"){const close=newClosesAt?new Date(newClosesAt):null;if(!close||!Number.isFinite(close.getTime())||close.getTime()<=Date.now())throw new Error("Choose a future closing time.");await replacePollWinners(client,pollId,[]);await client.query(`update portal_polls set status='open',closes_at=$2,resolution_note='Voting extended after a tie',extension_count=extension_count+1,updated_at=now() where id=$1`,[pollId,close.toISOString()]);await client.query(`update portal_poll_discord_jobs set status='cancelled',updated_at=now() where poll_id=$1 and job_kind='reminder' and status in ('pending','failed')`,[pollId]);for(const minutes of(Array.isArray(poll.reminder_minutes)?poll.reminder_minutes:[])){const at=new Date(close.getTime()-Number(minutes)*60000);if(at.getTime()>Date.now())await queuePollDiscordJob(client,pollId,"reminder",`extension-${Number(poll.extension_count)+1}-${minutes}`,at,{minutes});}await queuePollDiscordJob(client,pollId,"sync_opening",`extend-${Date.now()}`);await queuePollDiscordJob(client,pollId,"tie_alert",`extended-${Date.now()}`);await audit(client,pollId,"poll_extended",actor,{closesAt:close.toISOString()});}
    else{
      if(outcome.noVotes||!outcome.tied.length)throw new Error("There are no tied choices to resolve.");
      const prior=(await client.query(`select choice_id::int from portal_poll_winners where poll_id=$1 and selected_by_tie_resolution=true order by placement`,[pollId])).rows.map((row:any)=>Number(row.choice_id));
      const available=outcome.tied.filter((row:any)=>!prior.includes(Number(row.id)));
      let selected=[...prior];
      if(mode==="random"){while(selected.length<outcome.remaining&&available.length){const index=randomInt(available.length);selected.push(Number(available.splice(index,1)[0].id));}}
      else{const requested=Number(choiceId);if(!available.some((row:any)=>Number(row.id)===requested))throw new Error("Choose one of the tied options.");selected.push(requested);}
      const selectedSet=new Set(selected),resolved=selected.length>=outcome.remaining,winners=[...outcome.guaranteed,...selected.slice(0,outcome.remaining).map(id=>outcome.tied.find((row:any)=>Number(row.id)===id))].filter(Boolean);
      await replacePollWinners(client,pollId,winners,selectedSet);
      await client.query(`update portal_polls set status=$2,resolution_note=$3,updated_at=now() where id=$1`,[pollId,resolved?"closed":"awaiting_tie",resolved?(mode==="random"?"Winning cutoff randomly resolved":"Winning cutoff resolved by an officer"):`Officer selected a tied choice; ${outcome.remaining-selected.length} winner slot${outcome.remaining-selected.length===1?"":"s"} remain`]);
      if(resolved&&poll.post_results)await queuePollDiscordJob(client,pollId,"sync_results",`${mode}-${Date.now()}`);
      await queuePollDiscordJob(client,pollId,"tie_alert",`${resolved?"resolved":"progress"}-${Date.now()}`);
      await audit(client,pollId,mode==="random"?"poll_tie_randomly_resolved":"poll_tie_officer_resolved",actor,{choiceId:mode==="officer"?Number(choiceId):null,winnerChoiceIds:winners.map((row:any)=>row.id),tiedChoiceIds:outcome.tied.map((row:any)=>row.id),resolved});
    }
    await client.query("commit");
  }catch(error){await client.query("rollback");throw error;}
}

function normalizePoll(row:any):PollRecord{return{id:Number(row.id),status:row.status,pollType:row.poll_type,question:row.question,description:row.description||"",privacyMode:row.privacy_mode,resultsVisibility:row.results_visibility,maxSelections:Number(row.max_selections),winnerCount:Number(row.winner_count||1),minSelections:row.min_selections===null||row.min_selections===undefined?null:Number(row.min_selections),rankDepth:Number(row.rank_depth),abstainEnabled:Boolean(row.abstain_enabled),quorumMinimum:row.quorum_minimum===null?null:Number(row.quorum_minimum),officerVotingEnabled:Boolean(row.officer_voting_enabled),isTest:Boolean(row.is_test),opensAt:row.opens_at,closesAt:row.closes_at,channelId:row.target_channel_id,channelName:row.target_channel_name||row.target_channel_id,reminders:Array.isArray(row.reminder_minutes)?row.reminder_minutes.map(Number):[],postResults:Boolean(row.post_results),voteCount:Number(row.vote_count||0),viewerHasBallot:Boolean(row.viewer_has_ballot),viewerSelections:[],viewerRanks:{},choices:[],ballots:[],winnerChoiceId:row.winner_choice_id===null?null:Number(row.winner_choice_id),winnerChoiceIds:[],resolutionNote:row.resolution_note||null,extensionCount:Number(row.extension_count||0),materialLockedAt:row.material_locked_at||null,createdBy:row.created_by,createdAt:row.created_at};}

export async function getPollDashboard(client:Client,viewerDiscordId:string|null,isOfficer:boolean):Promise<PollDashboard>{
  await ensurePollTables(client);const eligibility=await getPollEligibility(client,viewerDiscordId),rows=(await client.query(`select p.*,(select count(*)::int from portal_poll_ballots b where b.poll_id=p.id and b.counted=true) vote_count,false viewer_has_ballot from portal_polls p where(p.is_test=false or $1::boolean) order by coalesce(p.opens_at,p.created_at) desc,p.id desc`,[isOfficer])).rows,records=rows.map(normalizePoll);
  for(const record of records){const winners=(await client.query(`select choice_id::int from portal_poll_winners where poll_id=$1 order by placement`,[record.id])).rows.map((row:any)=>Number(row.choice_id));record.winnerChoiceIds=winners.length?winners:(record.winnerChoiceId?[record.winnerChoiceId]:[]);const voterKey=viewerDiscordId?pollVoterKey(record.id,viewerDiscordId):"";const viewerBallot=voterKey?(await client.query(`select id::int from portal_poll_ballots where poll_id=$1 and voter_key=$2 and counted=true`,[record.id,voterKey])).rows[0]:null;record.viewerHasBallot=Boolean(viewerBallot);if(viewerBallot){const ownChoices=(await client.query(`select choice_id::int,rank_choice::int from portal_poll_ballot_choices where ballot_id=$1 order by coalesce(rank_choice,999),choice_id`,[viewerBallot.id])).rows;record.viewerSelections=ownChoices.map(row=>Number(row.choice_id));record.viewerRanks=Object.fromEntries(ownChoices.filter(row=>row.rank_choice!==null).map(row=>[Number(row.rank_choice),Number(row.choice_id)]));}
    const closed=["closed","awaiting_tie","cancelled"].includes(record.status),showResults=closed||record.resultsVisibility==="live"||(record.privacyMode==="public"&&eligibility.eligible)||(isOfficer&&record.resultsVisibility==="officer_only_until_close")||isOfficer;
    const choices=await client.query(`select c.id::int,c.label,c.description,c.sort_order,(c.image_data is not null) has_image,case when $2::boolean then count(bc.ballot_id) filter(where b.counted=true)::int else null end vote_count,case when $2::boolean then coalesce(sum(case when bc.rank_choice is not null then $3-bc.rank_choice+1 else 1 end) filter(where b.counted=true),0)::int else null end score from portal_poll_choices c left join portal_poll_ballot_choices bc on bc.choice_id=c.id left join portal_poll_ballots b on b.id=bc.ballot_id where c.poll_id=$1 group by c.id order by c.sort_order,c.id`,[record.id,showResults,record.rankDepth]);record.choices=choices.rows.map((row:any):PollChoice=>({id:Number(row.id),label:row.label,description:row.description||"",sortOrder:Number(row.sort_order),hasImage:Boolean(row.has_image),voteCount:row.vote_count===null?null:Number(row.vote_count),score:row.score===null?null:Number(row.score),averageRating:null,viewerSelected:record.viewerSelections.includes(Number(row.id)),viewerRank:Object.entries(record.viewerRanks).find(([,choiceId])=>Number(choiceId)===Number(row.id))?.[0]?Number(Object.entries(record.viewerRanks).find(([,choiceId])=>Number(choiceId)===Number(row.id))![0]):null}));
    const identitiesAllowed=(record.privacyMode==="private"&&isOfficer)||(record.privacyMode==="public"&&eligibility.eligible&&showResults);if(identitiesAllowed){const ballots=await client.query(`select b.id::int,coalesce(case when lower(coalesce(b.voter_label,'')) in ('true','false') then vc.character_name else nullif(b.voter_label,'') end,vc.character_name,'Discord member') voter_label,b.source,b.counted,b.invalidation_reason,b.updated_at,string_agg(case when bc.rank_choice is not null then bc.rank_choice||'. '||c.label else c.label end,', ' order by coalesce(bc.rank_choice,999),c.sort_order) selections from portal_poll_ballots b left join portal_characters vc on vc.id=b.voter_character_id left join portal_poll_ballot_choices bc on bc.ballot_id=b.id left join portal_poll_choices c on c.id=bc.choice_id where b.poll_id=$1 group by b.id,vc.character_name order by b.updated_at desc`,[record.id]);record.ballots=ballots.rows.map((row:any):PollBallotDetail=>({id:Number(row.id),voterLabel:row.voter_label,selections:row.selections?String(row.selections).split(", "):[],submittedAt:row.updated_at,source:row.source,counted:Boolean(row.counted),invalidationReason:row.invalidation_reason}));}
  }
  return{active:records.filter(record=>!record.isTest&&["open","awaiting_tie"].includes(record.status)),upcoming:records.filter(record=>!record.isTest&&["draft","scheduled"].includes(record.status)),history:records.filter(record=>!record.isTest&&["closed","cancelled"].includes(record.status)),tests:isOfficer?records.filter(record=>record.isTest):[],audit:isOfficer?(await client.query(`select a.id::int,a.poll_id::int,p.question poll_question,a.action_type,a.actor_label,a.details,a.created_at from portal_poll_audit a left join portal_polls p on p.id=a.poll_id order by a.created_at desc,a.id desc limit 200`)).rows.map((row:any)=>({id:Number(row.id),pollId:row.poll_id===null?null:Number(row.poll_id),pollQuestion:row.poll_question||null,actionType:row.action_type,actorLabel:row.actor_label||null,details:row.details||{},createdAt:row.created_at})):[],viewerEligible:eligibility.eligible,viewerEligibilityReason:eligibility.reason};
}
