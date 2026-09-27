import { randomInt } from "node:crypto";
import type { Client } from "pg";
import { ensureGiveawayTables } from "./schema";
import { encryptGiveawayDiscordId, giveawayVoterKey } from "./identity";
import type { GiveawayActor, GiveawayBallotDetail, GiveawayDashboard, GiveawayRecord, GiveawaySubmission } from "./types";

export async function getGiveawayEligibility(client: Client, discordUserId: string | null) {
  if (!discordUserId) return { eligible: false, reason: "Sign in with a linked Discord account to participate.", character: null };
  const result = await client.query(
    `select c.id::int, c.character_name, c.world
     from portal_discord_links dl
     join portal_characters c on c.id = dl.character_id
     join portal_discord_member_snapshots s on s.discord_user_id = dl.discord_user_id
     where dl.discord_user_id = $1
       and c.active = true
       and c.fc_membership_status = 'current'
       and s.present_in_guild = true
       and exists(select 1 from portal_fc_verification verification where verification.id=1 and verification.status='verified')
     limit 1;`,
    [discordUserId]
  );
  const character = result.rows[0] || null;
  return character
    ? { eligible: true, reason: null, character: { id: Number(character.id), characterName: String(character.character_name), world: String(character.world) } }
    : { eligible: false, reason: "Participation requires both current FC membership and current presence in the FC Discord.", character: null };
}

async function audit(client: Client, giveawayId: number | null, actionType: string, actor: GiveawayActor, details: Record<string, unknown> = {}) {
  await client.query(
    `insert into portal_giveaway_audit (giveaway_id, action_type, actor_discord_user_id, actor_character_id, actor_label, details)
     values ($1,$2,$3,$4,$5,$6::jsonb);`,
    [giveawayId, actionType, actor.discordUserId, actor.characterId, actor.actorLabel, JSON.stringify(details)]
  );
}

export async function queueGiveawayDiscordJob(client: Client, giveawayId: number, jobKind: string, suffix = "current", payload: Record<string, unknown> = {}, submissionId: number | null = null) {
  const dedupe = `giveaway:${giveawayId}:${submissionId || 0}:${jobKind}:${suffix}`;
  await client.query(
    `insert into portal_giveaway_discord_jobs (giveaway_id, submission_id, job_kind, dedupe_key, payload)
     values ($1,$2,$3,$4,$5::jsonb)
     on conflict (dedupe_key) do update set payload=excluded.payload, status='pending', run_after=now(), last_error=null, updated_at=now();`,
    [giveawayId, submissionId, jobKind, dedupe, JSON.stringify(payload)]
  );
}

function normalizeRecord(row: any): GiveawayRecord {
  return {
    id: Number(row.id), kind: row.kind, status: row.status, title: row.title, description: row.description || "", rules: row.rules || "",
    theme: row.theme, winnerMode: row.winner_mode, visibilityMode: row.visibility_mode, ballotPrivacyMode: row.ballot_privacy_mode||"private", liveTotalsVisible:Boolean(row.live_totals_visible), isTest: Boolean(row.is_test),
    opensAt: row.opens_at, closesAt: row.closes_at, submissionOpensAt: row.submission_opens_at, submissionClosesAt: row.submission_closes_at,
    votingOpensAt: row.voting_opens_at, votingClosesAt: row.voting_closes_at, winnerCount: Number(row.winner_count), alternateCount: Number(row.alternate_count),
    votesAllowed: Number(row.votes_allowed), placementCount: Number(row.placement_count), maxPhotos: Number(row.max_photos), maxEntriesPerMember: Number(row.max_entries_per_member),
    cooldownPolicy: row.cooldown_policy, claimPeriodEnabled: Boolean(row.claim_period_enabled), claimWindowHours: row.claim_window_hours === null ? null : Number(row.claim_window_hours),
    tiePolicy: row.tie_policy, qualificationInstructions: row.qualification_instructions || "", objectiveMetricLabel: row.objective_metric_label || "", objectiveDirection: row.objective_direction === "lowest" ? "lowest" : "highest", evidenceRequired: Boolean(row.evidence_required), postOpening: Boolean(row.post_opening), remindersEnabled: Boolean(row.reminders_enabled), reminderMinutes: Array.isArray(row.reminder_minutes)?row.reminder_minutes.map(Number):[], postVotingOpen: Boolean(row.post_voting_open),
    discordContestGallery: Boolean(row.discord_contest_gallery), discordVotingEnabled: Boolean(row.discord_voting_enabled), postResults: Boolean(row.post_results),
    discordAutoEnroll: Boolean(row.discord_auto_enroll), discordSourceChannelId: row.discord_source_channel_id,
    prizeName: row.prize_name || "Prize", prizeQuantity: Number(row.prize_quantity || 1), prizeCategory: row.prize_category || "in_game", prizeDonor: row.prize_donor || null, hasPrizeImage: Boolean(row.has_prize_image),
    entryCount: Number(row.entry_count || 0), submissionCount: Number(row.submission_count || 0), viewerEntered: Boolean(row.viewer_entered), viewerVotesUsed: Number(row.viewer_votes_used || 0),
    remainingQuantity: Math.max(0, Number(row.prize_quantity || 1) - Number(row.claim_count || 0)), submissions: [], ballots:[], results: [], createdAt: row.created_at
  };
}

export async function getGiveawayDashboard(client: Client, viewerDiscordId: string | null, isOfficer: boolean): Promise<GiveawayDashboard> {
  await ensureGiveawayTables(client);
  const eligibility = await getGiveawayEligibility(client, viewerDiscordId);
  const eligibleCountResult = await client.query(`select count(*)::int as count from portal_discord_links dl join portal_characters c on c.id=dl.character_id join portal_discord_member_snapshots s on s.discord_user_id=dl.discord_user_id where c.active=true and c.fc_membership_status='current' and s.present_in_guild=true and exists(select 1 from portal_fc_verification verification where verification.id=1 and verification.status='verified');`);
  const result = await client.query(
    `select g.*, p.prize_name, p.quantity as prize_quantity, p.category as prize_category, p.donor_display as prize_donor, (p.image_data is not null) as has_prize_image,
       (select count(*) from portal_giveaway_entries e where e.giveaway_id=g.id and e.status in ('entered','claimed')) as entry_count,
       (select count(*) from portal_giveaway_entries e where e.giveaway_id=g.id and e.status='claimed') as claim_count,
       (select count(*) from portal_giveaway_submissions s where s.giveaway_id=g.id and s.status in ('active','finalized')) as submission_count,
       exists(select 1 from portal_giveaway_entries e where e.giveaway_id=g.id and e.discord_user_id=$1 and e.status in ('entered','claimed')) as viewer_entered,
       (select count(*) from portal_giveaway_votes v where v.giveaway_id=g.id and v.voter_discord_user_id=$1) as viewer_votes_used
     from portal_giveaways g
     left join lateral (select * from portal_giveaway_prizes where giveaway_id=g.id order by id limit 1) p on true
     where (g.is_test=false or $2::boolean) and coalesce(g.delete_pending,false)=false
     order by coalesce(g.opens_at,g.submission_opens_at,g.created_at) desc, g.id desc;`,
    [viewerDiscordId || "", isOfficer]
  );
  const records = result.rows.map(normalizeRecord);
  for (const record of records) {
    if (record.kind === "contest" || record.kind === "objective") {
      const voterKey=viewerDiscordId?giveawayVoterKey(record.id,viewerDiscordId):"";
      record.viewerVotesUsed=viewerDiscordId?Number((await client.query(`select count(*)::int count from portal_giveaway_votes where giveaway_id=$1 and (voter_key=$2 or (voter_key is null and voter_discord_user_id=$3));`,[record.id,voterKey,viewerDiscordId])).rows[0]?.count||0):0;
      const submissions = await client.query(
        `select s.id::int, s.character_id::int, s.character_name_snapshot, s.discord_user_id, s.title, s.description, s.status,
           gp.review_status as gallery_review_status,
           case when g.live_totals_visible or g.status in ('voting_closed','awaiting_claim','completed') or $3::boolean then (select count(*)::int from portal_giveaway_votes vc where vc.submission_id=s.id) else null end as vote_count,
           exists(select 1 from portal_giveaway_votes vv where vv.submission_id=s.id and (vv.voter_key=$4 or (vv.voter_key is null and vv.voter_discord_user_id=$2))) as viewer_voted,
           (select vv.rank_choice from portal_giveaway_votes vv where vv.submission_id=s.id and (vv.voter_key=$4 or (vv.voter_key is null and vv.voter_discord_user_id=$2)) limit 1) as viewer_rank,
           case when g.live_totals_visible or g.status in ('voting_closed','awaiting_claim','completed') or $3::boolean then case when g.winner_mode='ranked_vote' then (select coalesce(sum(g.votes_allowed-coalesce(vs.rank_choice,g.votes_allowed)+1),0)::int from portal_giveaway_votes vs where vs.submission_id=s.id) else (select count(*)::int from portal_giveaway_votes vs where vs.submission_id=s.id) end else null end as vote_score,
           (select os.score from portal_giveaway_objective_scores os where os.submission_id=s.id) as objective_score,
           coalesce((select os.evidence from portal_giveaway_objective_scores os where os.submission_id=s.id),'') as objective_evidence,
           coalesce((select os.verified from portal_giveaway_objective_scores os where os.submission_id=s.id),false) as objective_verified,
           s.discord_user_id=$2 as is_viewer,
           coalesce(json_agg(json_build_object('id',i.id::int,'filename',i.filename,'sortOrder',i.sort_order) order by i.sort_order,i.id) filter(where i.id is not null),'[]') images
         from portal_giveaway_submissions s join portal_giveaways g on g.id=s.giveaway_id
         left join portal_community_gallery_posts gp on gp.id=s.gallery_post_id
         left join portal_giveaway_submission_images i on i.submission_id=s.id
         where s.giveaway_id=$1 and s.status in ('active','finalized')
         group by s.id,g.live_totals_visible,g.status,g.visibility_mode,gp.review_status,g.winner_mode,g.votes_allowed
         order by s.created_at,s.id;`,
        [record.id, viewerDiscordId || "", isOfficer, voterKey]
      );
      record.submissions = submissions.rows.map((row: any): GiveawaySubmission => ({ id:Number(row.id), characterId:Number(row.character_id), characterName:String(row.character_name_snapshot), discordUserId:String(row.discord_user_id), title:row.title||"", description:row.description||"", status:row.status, galleryReviewStatus:row.gallery_review_status, images:Array.isArray(row.images)?row.images:[], voteCount:row.vote_count===null?null:Number(row.vote_count), viewerVoted:Boolean(row.viewer_voted), viewerRank:row.viewer_rank===null?null:Number(row.viewer_rank), voteScore:row.vote_score===null?null:Number(row.vote_score), objectiveScore:row.objective_score===null?null:Number(row.objective_score), objectiveEvidence:row.objective_evidence||"", objectiveVerified:Boolean(row.objective_verified), isViewer:Boolean(row.is_viewer) }));
      const identitiesAllowed=(record.ballotPrivacyMode==="private"&&isOfficer)||(record.ballotPrivacyMode==="public"&&eligibility.eligible&&["voting_closed","awaiting_claim","completed"].includes(record.status));
      if(identitiesAllowed){const ballots=await client.query(`select min(v.id)::int id,coalesce(max(v.voter_label),max(c.character_name),'Discord member') voter_label,max(v.source) source,max(v.updated_at) updated_at,string_agg(case when v.rank_choice is not null then v.rank_choice||'. '||coalesce(nullif(s.title,''),s.character_name_snapshot) else coalesce(nullif(s.title,''),s.character_name_snapshot) end,', ' order by coalesce(v.rank_choice,999),s.id) selections from portal_giveaway_votes v left join portal_characters c on c.id=v.voter_character_id join portal_giveaway_submissions s on s.id=v.submission_id where v.giveaway_id=$1 group by coalesce(v.voter_key,'legacy-character-'||v.voter_character_id::text) order by max(v.updated_at) desc;`,[record.id]);record.ballots=ballots.rows.map((row:any):GiveawayBallotDetail=>({id:Number(row.id),voterLabel:row.voter_label,selections:row.selections?String(row.selections).split(", "):[],submittedAt:row.updated_at,source:row.source}));}
    }
    const results = await client.query(`select id::int, coalesce(display_placement,placement) placement, result_kind, character_name_snapshot, claim_status, claim_deadline, public from portal_giveaway_results where giveaway_id=$1 and (public=true or $2::boolean) order by case when result_kind='winner' then 0 when result_kind='placement' then 1 else 2 end, placement;`, [record.id,isOfficer]);
    record.results = results.rows.map((row:any)=>({ id:Number(row.id), placement:Number(row.placement), resultKind:row.result_kind, characterName:row.character_name_snapshot, claimStatus:row.claim_status, claimDeadline:row.claim_deadline, public:Boolean(row.public) }));
  }
  const activeStatuses = new Set(["open","submissions_open","submissions_closed","voting_open","voting_closed","awaiting_claim"]);
  return {
    active: records.filter(r=>!r.isTest&&activeStatuses.has(r.status)),
    upcoming: records.filter(r=>!r.isTest&&["draft","scheduled"].includes(r.status)),
    history: records.filter(r=>!r.isTest&&["completed","cancelled","no_eligible_entries"].includes(r.status)),
    tests: isOfficer?records.filter(r=>r.isTest):[],
    eligibleMemberCount:Number(eligibleCountResult.rows[0]?.count||0), viewerEligible:eligibility.eligible, viewerEligibilityReason:eligibility.reason,
    prizeInventory: isOfficer?(await client.query(`select id::int,name,category,donor_display,quantity_available::int,notes from portal_giveaway_prize_inventory where active=true order by lower(name);`)).rows.map((row:any)=>({id:Number(row.id),name:row.name,category:row.category,donor:row.donor_display,quantityAvailable:Number(row.quantity_available),notes:row.notes||""})):[],
    templates: isOfficer?(await client.query(`select id::int,name,payload from portal_giveaway_templates where active=true order by lower(name);`)).rows.map((row:any)=>({id:Number(row.id),name:row.name,payload:row.payload||{}})):[],
    audit: isOfficer?(await client.query(`select a.id::int,a.giveaway_id::int,g.title giveaway_title,a.action_type,a.actor_label,a.details,a.created_at from portal_giveaway_audit a left join portal_giveaways g on g.id=a.giveaway_id order by a.created_at desc,a.id desc limit 200;`)).rows.map((row:any)=>({id:Number(row.id),giveawayId:row.giveaway_id===null?null:Number(row.giveaway_id),giveawayTitle:row.giveaway_title||null,actionType:row.action_type,actorLabel:row.actor_label||null,details:row.details||{},createdAt:row.created_at})):[]
  };
}

export async function createGiveaway(client: Client, actor: GiveawayActor, input: Record<string, any>) {
  if (!actor.isOfficer) throw new Error("Officer access is required.");
  await ensureGiveawayTables(client);
  const title=String(input.title||"").trim(), prizeName=String(input.prizeName||"").trim();
  if(!title||!prizeName) throw new Error("Title and prize are required.");
  if(input.discordAutoEnroll)input.visibilityMode="public";
  if(input.discordAutoEnroll && input.kind!=="contest") throw new Error("Discord Glamours auto-enrollment is available only for contests.");if(input.discordAutoEnroll && !input.discordSourceChannelId) throw new Error("Configure the Glamours Gallery Channel ID in Officer Area before enabling auto-enrollment.");
  await client.query("begin");
  try {
    if(input.discordAutoEnroll){ const conflict=await client.query(`select id from portal_giveaways where discord_auto_enroll=true and discord_source_channel_id=$1 and status in ('scheduled','submissions_open') limit 1;`,[input.discordSourceChannelId]); if(conflict.rows.length) throw new Error("That Discord source channel already has an active auto-enrollment contest."); }
    const result=await client.query(`insert into portal_giveaways (kind,status,title,description,rules,theme,winner_mode,visibility_mode,is_test,opens_at,closes_at,submission_opens_at,submission_closes_at,voting_opens_at,voting_closes_at,winner_count,alternate_count,votes_allowed,placement_count,max_photos,max_entries_per_member,cooldown_policy,claim_period_enabled,claim_window_hours,tie_policy,qualification_instructions,objective_metric_label,objective_direction,evidence_required,post_opening,reminders_enabled,reminder_minutes,post_voting_open,discord_contest_gallery,discord_voting_enabled,post_results,discord_auto_enroll,discord_source_channel_id,created_by)
      values($1,'draft',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38) returning id::int;`,
      [input.kind,title,input.description||"",input.rules||"",input.theme||null,input.winnerMode,input.visibilityMode,input.isTest,input.opensAt||null,input.closesAt||null,input.submissionOpensAt||null,input.submissionClosesAt||null,input.votingOpensAt||null,input.votingClosesAt||null,input.winnerCount,input.alternateCount,input.votesAllowed,input.placementCount,input.maxPhotos,input.maxEntriesPerMember,input.cooldownPolicy,input.claimPeriodEnabled,input.claimPeriodEnabled?input.claimWindowHours:null,input.tiePolicy,input.qualificationInstructions||"",input.objectiveMetricLabel||"",input.objectiveDirection||"highest",Boolean(input.evidenceRequired),input.postOpening,input.remindersEnabled,input.reminderMinutes||[],input.postVotingOpen,input.discordContestGallery,input.discordVotingEnabled,input.postResults,input.discordAutoEnroll,input.discordSourceChannelId||null,actor.actorLabel]);
    const id=Number(result.rows[0].id);
    await client.query(`update portal_giveaways set ballot_privacy_mode=$2,live_totals_visible=$3 where id=$1;`,[id,input.ballotPrivacyMode||"private",Boolean(input.liveTotalsVisible)]);
    const startsAt=["contest","objective"].includes(input.kind)?input.submissionOpensAt:input.opensAt;let initialStatus="draft";
    if(startsAt){
      const opensNow=new Date(startsAt).getTime()<=Date.now();initialStatus=opensNow?(["contest","objective"].includes(input.kind)?"submissions_open":"open"):"scheduled";
      await client.query(`update portal_giveaways set status=$2,material_rules_locked_at=case when $2 in ('open','submissions_open') then now() else null end,updated_at=now() where id=$1;`,[id,initialStatus]);
      if(opensNow&&input.postOpening)await queueGiveawayDiscordJob(client,id,"sync_opening","created-open");
      if(opensNow&&input.kind==="contest"&&input.discordAutoEnroll)await queueGiveawayDiscordJob(client,id,"sync_disclosure_open","created-open");
    }
    if(input.inventoryItemId){const reserved=await client.query(`update portal_giveaway_prize_inventory set quantity_available=quantity_available-$2,updated_at=now() where id=$1 and active=true and quantity_available>=$2 returning id;`,[input.inventoryItemId,input.prizeQuantity]);if(!reserved.rows.length)throw new Error("The selected inventory prize does not have enough available quantity.");}
    await client.query(`insert into portal_giveaway_prizes(giveaway_id,inventory_item_id,prize_name,quantity,category,donor_display,notes,image_filename,image_mime_type,image_data) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10);`,[id,input.inventoryItemId||null,prizeName,input.prizeQuantity,input.prizeCategory,input.prizeDonor||null,input.prizeNotes||null,input.prizeImageFilename||null,input.prizeImageMimeType||null,input.prizeImageData||null]);
    await audit(client,id,"created",actor,{kind:input.kind,isTest:input.isTest,initialStatus});
    await client.query("commit"); return id;
  } catch(error){ await client.query("rollback"); throw error; }
}


export async function updateGiveawayDraft(client:Client,actor:GiveawayActor,giveawayId:number,input:Record<string,any>){
  if(!actor.isOfficer)throw new Error("Officer access is required.");
  await ensureGiveawayTables(client);
  const title=String(input.title||"").trim(),prizeName=String(input.prizeName||"").trim();
  if(!title||!prizeName)throw new Error("Title and prize are required.");
  if(input.discordAutoEnroll)input.visibilityMode="public";
  if(input.discordAutoEnroll&&input.kind!=="contest")throw new Error("Discord Glamours auto-enrollment is available only for contests.");
  if(input.discordAutoEnroll&&!input.discordSourceChannelId)throw new Error("Configure the Glamours Gallery Channel ID in Officer Area before enabling auto-enrollment.");
  await client.query("begin");
  try{
    const current=(await client.query(`select status from portal_giveaways where id=$1 for update;`,[giveawayId])).rows[0];
    if(!current)throw new Error("Draft not found.");
    if(current.status!=="draft")throw new Error("Only drafts can be resumed and edited.");
    if(input.discordAutoEnroll){
      const conflict=await client.query(`select id from portal_giveaways where id<>$1 and discord_auto_enroll=true and discord_source_channel_id=$2 and status in ('scheduled','submissions_open') limit 1;`,[giveawayId,input.discordSourceChannelId]);
      if(conflict.rows.length)throw new Error("That Discord source channel already has an active auto-enrollment contest.");
    }
    await client.query(`update portal_giveaways set kind=$2,status='draft',title=$3,description=$4,rules=$5,theme=$6,winner_mode=$7,visibility_mode=$8,is_test=$9,opens_at=$10,closes_at=$11,submission_opens_at=$12,submission_closes_at=$13,voting_opens_at=$14,voting_closes_at=$15,winner_count=$16,alternate_count=$17,votes_allowed=$18,placement_count=$19,max_photos=$20,max_entries_per_member=$21,cooldown_policy=$22,claim_period_enabled=$23,claim_window_hours=$24,tie_policy=$25,qualification_instructions=$26,objective_metric_label=$27,objective_direction=$28,evidence_required=$29,post_opening=$30,reminders_enabled=$31,reminder_minutes=$32,post_voting_open=$33,discord_contest_gallery=$34,discord_voting_enabled=$35,post_results=$36,discord_auto_enroll=$37,discord_source_channel_id=$38,ballot_privacy_mode=$39,live_totals_visible=$40,updated_at=now() where id=$1;`,
      [giveawayId,input.kind,title,input.description||"",input.rules||"",input.theme||null,input.winnerMode,input.visibilityMode,input.isTest,input.opensAt||null,input.closesAt||null,input.submissionOpensAt||null,input.submissionClosesAt||null,input.votingOpensAt||null,input.votingClosesAt||null,input.winnerCount,input.alternateCount,input.votesAllowed,input.placementCount,input.maxPhotos,input.maxEntriesPerMember,input.cooldownPolicy,input.claimPeriodEnabled,input.claimPeriodEnabled?input.claimWindowHours:null,input.tiePolicy,input.qualificationInstructions||"",input.objectiveMetricLabel||"",input.objectiveDirection||"highest",Boolean(input.evidenceRequired),input.postOpening,input.remindersEnabled,input.reminderMinutes||[],input.postVotingOpen,input.discordContestGallery,input.discordVotingEnabled,input.postResults,input.discordAutoEnroll,input.discordSourceChannelId||null,input.ballotPrivacyMode||"private",Boolean(input.liveTotalsVisible)]);
    const priorPrize=(await client.query(`select inventory_item_id,quantity from portal_giveaway_prizes where giveaway_id=$1 for update;`,[giveawayId])).rows[0];if(priorPrize?.inventory_item_id)await client.query(`update portal_giveaway_prize_inventory set quantity_available=quantity_available+$2,updated_at=now() where id=$1;`,[priorPrize.inventory_item_id,priorPrize.quantity]);if(input.inventoryItemId){const reserved=await client.query(`update portal_giveaway_prize_inventory set quantity_available=quantity_available-$2,updated_at=now() where id=$1 and active=true and quantity_available>=$2 returning id;`,[input.inventoryItemId,input.prizeQuantity]);if(!reserved.rows.length)throw new Error("The selected inventory prize does not have enough available quantity.");}
    await client.query(`update portal_giveaway_prizes set inventory_item_id=$10,prize_name=$2,quantity=$3,category=$4,donor_display=$5,notes=$6,image_filename=case when $7::text is null then image_filename else $7 end,image_mime_type=case when $8::text is null then image_mime_type else $8 end,image_data=case when $9::bytea is null then image_data else $9 end where giveaway_id=$1;`,
      [giveawayId,prizeName,input.prizeQuantity,input.prizeCategory,input.prizeDonor||null,input.prizeNotes||null,input.prizeImageFilename||null,input.prizeImageMimeType||null,input.prizeImageData||null,input.inventoryItemId||null]);
    const startsAt=["contest","objective"].includes(input.kind)?input.submissionOpensAt:input.opensAt;let nextStatus="draft";
    if(startsAt){
      const opensNow=new Date(startsAt).getTime()<=Date.now();nextStatus=opensNow?(["contest","objective"].includes(input.kind)?"submissions_open":"open"):"scheduled";
      await client.query(`update portal_giveaways set status=$2,material_rules_locked_at=case when $2 in ('open','submissions_open') then now() else null end,updated_at=now() where id=$1;`,[giveawayId,nextStatus]);
      if(opensNow&&input.postOpening)await queueGiveawayDiscordJob(client,giveawayId,"sync_opening","draft-resumed-open");
      if(opensNow&&input.kind==="contest"&&input.discordAutoEnroll)await queueGiveawayDiscordJob(client,giveawayId,"sync_disclosure_open","draft-resumed-open");
    }
    await audit(client,giveawayId,"draft_updated",actor,{kind:input.kind,isTest:input.isTest,nextStatus});
    await client.query("commit");return giveawayId;
  }catch(error){await client.query("rollback");throw error;}
}

export async function deleteGiveawayDraft(client:Client,actor:GiveawayActor,giveawayId:number){
  if(!actor.isOfficer)throw new Error("Officer access is required.");
  await ensureGiveawayTables(client);await client.query("begin");
  try{
    const draft=(await client.query(`select status,title from portal_giveaways where id=$1 for update;`,[giveawayId])).rows[0];
    if(!draft)throw new Error("Draft not found.");
    if(draft.status!=="draft")throw new Error("Only drafts can be deleted with this control.");
    await client.query(`update portal_giveaway_prize_inventory i set quantity_available=i.quantity_available+p.quantity,updated_at=now() from portal_giveaway_prizes p where p.giveaway_id=$1 and p.inventory_item_id=i.id;`,[giveawayId]);
    await client.query(`delete from portal_giveaways where id=$1;`,[giveawayId]);
    await audit(client,null,"draft_deleted",actor,{deletedGiveawayId:giveawayId,title:draft.title});
    await client.query("commit");
  }catch(error){await client.query("rollback");throw error;}
}

export async function changeGiveawayStatus(client: Client, actor: GiveawayActor, giveawayId: number, nextStatus: string) {
  if(!actor.isOfficer) throw new Error("Officer access is required.");
  await ensureGiveawayTables(client);
  const allowed=new Set(["scheduled","open","submissions_open","submissions_closed","voting_open","voting_closed","completed","cancelled"]); if(!allowed.has(nextStatus)) throw new Error("Choose a valid status.");
  await client.query("begin"); try {
    const current=await client.query(`select * from portal_giveaways where id=$1 for update;`,[giveawayId]); if(!current.rows.length) throw new Error("Giveaway not found.");
    if(nextStatus==="voting_open") await client.query(`update portal_giveaway_submissions set frozen_at=coalesce(frozen_at,now()),status=case when status='active' then 'finalized' else status end where giveaway_id=$1;`,[giveawayId]);
    await client.query(`update portal_giveaways set status=$2, material_rules_locked_at=case when $2 in ('open','submissions_open') then coalesce(material_rules_locked_at,now()) else material_rules_locked_at end, updated_at=now() where id=$1;`,[giveawayId,nextStatus]);
    await audit(client,giveawayId,`status_${nextStatus}`,actor,{previous:current.rows[0].status});
    const g=current.rows[0];
    if((nextStatus==="open"||nextStatus==="submissions_open")&&g.post_opening) await queueGiveawayDiscordJob(client,giveawayId,"sync_opening",nextStatus);
    if(nextStatus==="submissions_open"&&g.discord_auto_enroll) await queueGiveawayDiscordJob(client,giveawayId,"sync_disclosure_open",nextStatus);
    if(["submissions_closed","voting_open","voting_closed","completed","cancelled"].includes(nextStatus)&&g.discord_auto_enroll) await queueGiveawayDiscordJob(client,giveawayId,"sync_disclosure_closed",nextStatus);
    if(nextStatus==="voting_open"&&(g.post_voting_open||g.discord_contest_gallery)) await queueGiveawayDiscordJob(client,giveawayId,"sync_contest",nextStatus);
    if(nextStatus==="completed"&&g.post_results) await queueGiveawayDiscordJob(client,giveawayId,"sync_results",String(Date.now()));
    await client.query("commit");
  }catch(error){await client.query("rollback");throw error;}
}

async function assertCooldownEligible(client:Client,giveaway:any,characterId:number){
  if(giveaway.cooldown_policy==="none") return;
  if(giveaway.cooldown_policy==="last_winner"){
    const prior=await client.query(`select r.character_id from portal_giveaway_results r join portal_giveaways g on g.id=r.giveaway_id where g.id<>$1 and g.is_test=false and g.delete_pending=false and g.status='completed' and r.result_kind in ('winner','placement','fcfs') and r.claim_status not in ('forfeited','replaced') and r.placement=1 order by r.selected_at desc limit 1;`,[giveaway.id]);
    if(Number(prior.rows[0]?.character_id||0)===characterId) throw new Error("The immediately previous winner is not eligible for this giveaway."); return;
  }
  const days=Number(String(giveaway.cooldown_policy).split("_")[0]);
  const recent=await client.query(`select 1 from portal_giveaway_results r join portal_giveaways g on g.id=r.giveaway_id where r.character_id=$1 and g.is_test=false and g.delete_pending=false and r.result_kind in ('winner','placement','fcfs') and r.claim_status not in ('forfeited','replaced') and r.selected_at>=now()-($2::text||' days')::interval limit 1;`,[characterId,days]);
  if(recent.rows.length) throw new Error(`A ${days}-day winner cooldown applies to this giveaway.`);
}

export async function enterGiveaway(client:Client,actor:GiveawayActor,giveawayId:number,withdraw=false){
  await ensureGiveawayTables(client); const eligibility=await getGiveawayEligibility(client,actor.discordUserId); if(!eligibility.eligible||!eligibility.character) throw new Error(eligibility.reason||"Not eligible.");
  const g=await client.query(`select * from portal_giveaways where id=$1;`,[giveawayId]); const giveaway=g.rows[0]; if(!giveaway||!['random','challenge'].includes(giveaway.kind)||giveaway.status!=='open') throw new Error("This giveaway is not accepting entries.");
  if(withdraw){await client.query(`update portal_giveaway_entries set status='withdrawn' where giveaway_id=$1 and character_id=$2 and status='entered';`,[giveawayId,eligibility.character.id]);await audit(client,giveawayId,"entry_withdrawn",actor);return;}
  await assertCooldownEligible(client,giveaway,eligibility.character.id);
  await client.query(`insert into portal_giveaway_entries(giveaway_id,character_id,discord_user_id,character_name_snapshot,status) values($1,$2,$3,$4,'entered') on conflict(giveaway_id,character_id) do update set status='entered',discord_user_id=excluded.discord_user_id,character_name_snapshot=excluded.character_name_snapshot,entered_at=now(),invalidated_at=null,invalidation_reason=null;`,[giveawayId,eligibility.character.id,actor.discordUserId,eligibility.character.characterName]);
  await audit(client,giveawayId,"entry_recorded",actor);
}

export async function claimFcfs(client:Client,actor:GiveawayActor,giveawayId:number){
  await ensureGiveawayTables(client); await client.query("begin"); try{
    const g=(await client.query(`select g.*,p.quantity from portal_giveaways g join portal_giveaway_prizes p on p.giveaway_id=g.id where g.id=$1 for update of g,p;`,[giveawayId])).rows[0]; if(!g||g.kind!=="fcfs"||g.status!=="open") throw new Error("This first-come giveaway is not open.");
    const eligibility=await getGiveawayEligibility(client,actor.discordUserId);if(!eligibility.eligible||!eligibility.character)throw new Error(eligibility.reason||"Not eligible."); await assertCooldownEligible(client,g,eligibility.character.id);
    const priorClaim=await client.query(`select 1 from portal_giveaway_entries where giveaway_id=$1 and character_id=$2 and status='claimed' limit 1;`,[giveawayId,eligibility.character.id]);if(priorClaim.rows.length)throw new Error("You have already claimed a prize from this giveaway.");
    const count=Number((await client.query(`select count(*) from portal_giveaway_entries where giveaway_id=$1 and status='claimed';`,[giveawayId])).rows[0].count); if(count>=Number(g.quantity))throw new Error("All available prizes have already been claimed.");
    const recorded=await client.query(`insert into portal_giveaway_entries(giveaway_id,character_id,discord_user_id,character_name_snapshot,status,claimed_at) values($1,$2,$3,$4,'claimed',now()) on conflict(giveaway_id,character_id) do nothing returning id;`,[giveawayId,eligibility.character.id,actor.discordUserId,eligibility.character.characterName]);if(!recorded.rows.length)throw new Error("You have already claimed or entered this giveaway.");
    const slot=(await client.query(`select slots.position::int from generate_series(1,$2::int) as slots(position) where not exists(select 1 from portal_giveaway_results r where r.giveaway_id=$1 and r.result_kind='fcfs' and r.placement=slots.position and r.claim_status<>'forfeited') order by slots.position limit 1;`,[giveawayId,Number(g.quantity)])).rows[0];if(!slot)throw new Error("No available prize position could be reserved.");const placement=Number(slot.position);
    const savedResult=await client.query(`insert into portal_giveaway_results(giveaway_id,character_id,character_name_snapshot,placement,result_kind,claim_status,claim_deadline,selected_by,selection_method) values($1,$2,$3,$4,'fcfs',$5,case when $7::boolean then now()+($8::text||' hours')::interval else null end,$6,'atomic FCFS claim') on conflict(giveaway_id,result_kind,placement) do update set character_id=excluded.character_id,character_name_snapshot=excluded.character_name_snapshot,claim_status=excluded.claim_status,claim_deadline=excluded.claim_deadline,selected_by=excluded.selected_by,selection_method=excluded.selection_method,selected_at=now(),replacement_reason=null where portal_giveaway_results.claim_status='forfeited' returning id;`,[giveawayId,eligibility.character.id,eligibility.character.characterName,placement,g.claim_period_enabled?'awaiting':'not_required',actor.actorLabel,g.claim_period_enabled,g.claim_window_hours||72]);if(!savedResult.rows.length)throw new Error("That prize position was claimed before this request completed.");
    const activeAfter=count+1;await audit(client,giveawayId,"fcfs_claimed",actor,{position:placement}); if(activeAfter>=Number(g.quantity)){await client.query(`update portal_giveaways set status=case when claim_period_enabled then 'awaiting_claim' else 'completed' end,updated_at=now() where id=$1;`,[giveawayId]);} if(g.post_results)await queueGiveawayDiscordJob(client,giveawayId,"sync_results",`fcfs-${placement}-${Date.now()}`); await client.query("commit"); return placement;
  }catch(error){await client.query("rollback");throw error;}
}

export async function drawRandomGiveaway(client:Client,actor:GiveawayActor,giveawayId:number){
  if(!actor.isOfficer)throw new Error("Officer access is required."); await ensureGiveawayTables(client); await client.query("begin"); try{
    const g=(await client.query(`select * from portal_giveaways where id=$1 for update;`,[giveawayId])).rows[0];if(!g||!["random","challenge"].includes(g.kind))throw new Error("This is not a random giveaway.");if(!["open","scheduled"].includes(g.status))throw new Error("This giveaway cannot be drawn in its current state.");
    const entries=await client.query(`select e.*,c.active,c.fc_membership_status,s.present_in_guild from portal_giveaway_entries e join portal_characters c on c.id=e.character_id join portal_discord_member_snapshots s on s.discord_user_id=e.discord_user_id where e.giveaway_id=$1 and e.status='entered' and c.active=true and c.fc_membership_status='current' and s.present_in_guild=true and exists(select 1 from portal_fc_verification verification where verification.id=1 and verification.status='verified') order by e.id for update;`,[giveawayId]);
    const eligible=[]; for(const row of entries.rows){try{await assertCooldownEligible(client,g,Number(row.character_id));eligible.push(row);}catch{await client.query(`update portal_giveaway_entries set status='ineligible',invalidated_at=now(),invalidation_reason='Winner cooldown' where id=$1;`,[row.id]);}}
    if(!eligible.length){await client.query(`update portal_giveaways set status='no_eligible_entries',updated_at=now() where id=$1;`,[giveawayId]);await audit(client,giveawayId,"draw_no_eligible_entries",actor,{entrantCount:entries.rows.length});await client.query("commit");return;}
    const pool=[...eligible],ordered=[]; while(pool.length){ordered.push(pool.splice(randomInt(pool.length),1)[0]);}
    const winnerCount=Math.min(Number(g.winner_count),ordered.length), alternateCount=Math.min(Number(g.alternate_count),Math.max(0,ordered.length-winnerCount)); let placement=1;
    for(const row of ordered.slice(0,winnerCount)){await client.query(`insert into portal_giveaway_results(giveaway_id,character_id,character_name_snapshot,placement,result_kind,public,claim_status,claim_deadline,selected_by,selection_method) values($1,$2,$3,$4,'winner',true,$5,case when $6::boolean then now()+($7::text||' hours')::interval else null end,$8,'crypto.randomInt ordered draw');`,[giveawayId,row.character_id,row.character_name_snapshot,placement++,g.claim_period_enabled?'awaiting':'not_required',g.claim_period_enabled,g.claim_window_hours||0,actor.actorLabel]);}
    let alt=1;for(const row of ordered.slice(winnerCount,winnerCount+alternateCount)){await client.query(`insert into portal_giveaway_results(giveaway_id,character_id,character_name_snapshot,placement,result_kind,public,claim_status,selected_by,selection_method) values($1,$2,$3,$4,'alternate',false,'not_required',$5,'crypto.randomInt ordered draw');`,[giveawayId,row.character_id,row.character_name_snapshot,alt++,actor.actorLabel]);}
    await client.query(`update portal_giveaways set status=case when claim_period_enabled then 'awaiting_claim' else 'completed' end,updated_at=now() where id=$1;`,[giveawayId]);await audit(client,giveawayId,"random_draw_completed",actor,{eligibleEntrants:eligible.length,winners:winnerCount,alternates:alternateCount,method:"crypto.randomInt"});if(g.post_results)await queueGiveawayDiscordJob(client,giveawayId,"sync_results",String(Date.now()));await client.query("commit");
  }catch(error){await client.query("rollback");throw error;}
}

export async function saveContestSubmission(client:Client,actor:GiveawayActor,giveawayId:number,title:string,description:string,files:Array<{name:string;type:string;data:Buffer}>){
  await ensureGiveawayTables(client);const eligibility=await getGiveawayEligibility(client,actor.discordUserId);if(!eligibility.eligible||!eligibility.character)throw new Error(eligibility.reason||"Not eligible.");await client.query("begin");try{
    const g=(await client.query(`select * from portal_giveaways where id=$1 for update;`,[giveawayId])).rows[0];if(!g||!["contest","objective"].includes(g.kind)||g.status!=="submissions_open")throw new Error("Contest submissions are not open.");
    const result=await client.query(`insert into portal_giveaway_submissions(giveaway_id,character_id,discord_user_id,character_name_snapshot,title,description,source_kind) values($1,$2,$3,$4,$5,$6,'website') on conflict(giveaway_id,character_id,entry_number) do update set title=excluded.title,description=excluded.description,status='active',updated_at=now() returning id::int,gallery_post_id;`,[giveawayId,eligibility.character.id,actor.discordUserId,eligibility.character.characterName,title,description]);const submissionId=Number(result.rows[0].id);
    const existing=Number((await client.query(`select count(*) from portal_giveaway_submission_images where submission_id=$1;`,[submissionId])).rows[0].count);const accepted=files.slice(0,Math.max(0,Number(g.max_photos)-existing));for(let i=0;i<accepted.length;i++){const f=accepted[i];if(!f.type.startsWith("image/"))throw new Error("Contest photos must be images.");if(f.data.length>10*1024*1024)throw new Error("Each image must be 10 MB or smaller.");await client.query(`insert into portal_giveaway_submission_images(submission_id,source_attachment_id,filename,mime_type,image_data,image_size,sort_order) values($1,$2,$3,$4,$5,$6,$7) on conflict do nothing;`,[submissionId,`website:${Date.now()}:${i}:${f.name}`,f.name,f.type,f.data,f.data.length,(existing+i+1)*10]);}
    let galleryPostId=result.rows[0].gallery_post_id?Number(result.rows[0].gallery_post_id):null;if(!galleryPostId){const gp=await client.query(`insert into portal_community_gallery_posts(category,source_channel_id,source_message_id,discord_user_id,discord_display_name,caption,posted_at,review_status) values('glamour','website-contest',$1,$2,$3,$4,now(),'pending') returning id::int;`,[`contest:${giveawayId}:submission:${submissionId}`,actor.discordUserId,eligibility.character.characterName,[title,description].filter(Boolean).join("  -  ")]);galleryPostId=Number(gp.rows[0].id);await client.query(`update portal_giveaway_submissions set gallery_post_id=$2 where id=$1;`,[submissionId,galleryPostId]);}
    await client.query(`delete from portal_community_gallery_images where post_id=$1;`,[galleryPostId]);await client.query(`insert into portal_community_gallery_images(post_id,source_attachment_id,filename,mime_type,image_data,image_size) select $2,'contest-image:'||id,filename,mime_type,image_data,image_size from portal_giveaway_submission_images where submission_id=$1 order by sort_order,id;`,[submissionId,galleryPostId]);
    await audit(client,giveawayId,"submission_saved",actor,{submissionId,acceptedImages:accepted.length,rejectedImages:Math.max(0,files.length-accepted.length)});if(g.discord_contest_gallery)await queueGiveawayDiscordJob(client,giveawayId,"sync_submission",String(Date.now()),{},submissionId);await client.query("commit");return{accepted:accepted.length,rejected:Math.max(0,files.length-accepted.length)};
  }catch(error){await client.query("rollback");throw error;}
}

export async function manageContestSubmission(client:Client,actor:GiveawayActor,giveawayId:number,submissionId:number,action:"remove_image"|"move_up"|"move_down"|"withdraw"|"disqualify",imageId:number|null=null,reason=""){
  await ensureGiveawayTables(client);const eligibility=await getGiveawayEligibility(client,actor.discordUserId);if(!eligibility.eligible||!eligibility.character)throw new Error(eligibility.reason||"Not eligible.");await client.query("begin");try{
    const row=(await client.query(`select s.*,g.status giveaway_status,g.discord_contest_gallery from portal_giveaway_submissions s join portal_giveaways g on g.id=s.giveaway_id where s.id=$1 and s.giveaway_id=$2 for update;`,[submissionId,giveawayId])).rows[0];if(!row)throw new Error("Submission not found.");if(row.giveaway_status!=="submissions_open")throw new Error("Contest entries are frozen because submissions are not open.");if(Number(row.character_id)!==eligibility.character.id&&!actor.isOfficer)throw new Error("You can only manage your own contest entry.");
    if(action==="disqualify"){if(!actor.isOfficer)throw new Error("Officer access is required.");if(!reason.trim())throw new Error("A reason is required to disqualify an entry.");await client.query(`update portal_giveaway_submissions set status='disqualified',disqualified_reason=$2,updated_at=now() where id=$1;`,[submissionId,reason.trim()]);}
    else if(action==="withdraw"){await client.query(`update portal_giveaway_submissions set status='withdrawn',updated_at=now() where id=$1;`,[submissionId]);}
    else {const images=(await client.query(`select id::int from portal_giveaway_submission_images where submission_id=$1 order by sort_order,id for update;`,[submissionId])).rows.map((r:any)=>Number(r.id));const index=images.indexOf(Number(imageId));if(index<0)throw new Error("Contest image not found.");if(action==="remove_image")images.splice(index,1);else if(action==="move_up"&&index>0)[images[index-1],images[index]]=[images[index],images[index-1]];else if(action==="move_down"&&index<images.length-1)[images[index+1],images[index]]=[images[index],images[index+1]];if(action==="remove_image")await client.query(`delete from portal_giveaway_submission_images where id=$1 and submission_id=$2;`,[imageId,submissionId]);for(let i=0;i<images.length;i++)await client.query(`update portal_giveaway_submission_images set sort_order=$2 where id=$1;`,[images[i],(i+1)*10]);}
    if(row.gallery_post_id){await client.query(`delete from portal_community_gallery_images where post_id=$1;`,[row.gallery_post_id]);await client.query(`insert into portal_community_gallery_images(post_id,source_attachment_id,filename,mime_type,image_data,image_size) select $2,'contest-image:'||id,filename,mime_type,image_data,image_size from portal_giveaway_submission_images where submission_id=$1 order by sort_order,id;`,[submissionId,row.gallery_post_id]);}
    await audit(client,giveawayId,`submission_${action}`,actor,{submissionId,imageId,reason:reason.trim()||null});await queueGiveawayDiscordJob(client,giveawayId,action==="withdraw"||action==="disqualify"?"delete_submission":"sync_submission",String(Date.now()),{},submissionId);await client.query("commit");
  }catch(error){await client.query("rollback");throw error;}
}

export async function toggleContestVote(client:Client,actor:GiveawayActor,giveawayId:number,submissionId:number,source:"website"|"discord"="website",rankChoice:number|null=null){
  await ensureGiveawayTables(client);const eligibility=await getGiveawayEligibility(client,actor.discordUserId);if(!eligibility.eligible||!eligibility.character||!actor.discordUserId)throw new Error(eligibility.reason||"Not eligible.");await client.query("begin");try{
    const voterKey=giveawayVoterKey(giveawayId,actor.discordUserId);
    await client.query(`select pg_advisory_xact_lock(hashtext($1));`,[`giveaway-vote:${giveawayId}:${voterKey}`]);
    const g=(await client.query(`select * from portal_giveaways where id=$1;`,[giveawayId])).rows[0];if(!g||g.status!=="voting_open")throw new Error("Voting is not open.");if(g.winner_mode==="officer_vote"&&!actor.isOfficer)throw new Error("This contest uses officer/judge voting.");if(!["member_vote","ranked_vote","officer_vote"].includes(g.winner_mode))throw new Error("This contest is not using direct voting.");
    const mine=`giveaway_id=$1 and (voter_key=$2 or (voter_key is null and voter_discord_user_id=$3))`;
    if(g.winner_mode==="ranked_vote"){if(!rankChoice||rankChoice<1||rankChoice>Number(g.votes_allowed))throw new Error("Choose a valid rank.");await client.query(`delete from portal_giveaway_votes where ${mine} and rank_choice=$4 and submission_id<>$5;`,[giveawayId,voterKey,actor.discordUserId,rankChoice,submissionId]);}
    const s=(await client.query(`select * from portal_giveaway_submissions where id=$1 and giveaway_id=$2 and status in ('active','finalized');`,[submissionId,giveawayId])).rows[0];if(!s)throw new Error("Submission not found.");if(Number(s.character_id)===eligibility.character.id)throw new Error("You cannot vote for your own entry.");
    const existing=await client.query(`select id from portal_giveaway_votes where submission_id=$4 and ${mine};`,[giveawayId,voterKey,actor.discordUserId,submissionId]);
    const anonymous=g.ballot_privacy_mode==="anonymous",auditActor=anonymous?{...actor,discordUserId:null,characterId:null,characterName:null,actorLabel:"Anonymous voter"}:actor;
    if(existing.rows.length){await client.query(`delete from portal_giveaway_votes where id=$1;`,[existing.rows[0].id]);await audit(client,giveawayId,"vote_removed",auditActor,anonymous?{source}:{submissionId,source});}
    else{const used=Number((await client.query(`select count(*) from portal_giveaway_votes where ${mine};`,[giveawayId,voterKey,actor.discordUserId])).rows[0].count);if(used>=Number(g.votes_allowed))throw new Error(`You have used all ${g.votes_allowed} available votes.`);await client.query(`insert into portal_giveaway_votes(giveaway_id,submission_id,voter_character_id,voter_discord_user_id,voter_key,voter_discord_ciphertext,voter_label,source,rank_choice) values($1,$2,$3,$4,$5,$6,$7,$8,$9);`,[giveawayId,submissionId,anonymous?null:eligibility.character.id,anonymous?null:actor.discordUserId,voterKey,anonymous?encryptGiveawayDiscordId(actor.discordUserId):null,anonymous?null:eligibility.character.characterName,source,g.winner_mode==="ranked_vote"?rankChoice:null]);await audit(client,giveawayId,"vote_saved",auditActor,anonymous?{source}:{submissionId,source,rankChoice});}
    const total=Number((await client.query(`select count(*) from portal_giveaway_votes where ${mine};`,[giveawayId,voterKey,actor.discordUserId])).rows[0].count);await client.query("commit");return{used:total,allowed:Number(g.votes_allowed)};
  }catch(error){await client.query("rollback");throw error;}
}

export async function finalizeContest(client:Client,actor:GiveawayActor,giveawayId:number){
  if(!actor.isOfficer)throw new Error("Officer access is required.");await ensureGiveawayTables(client);await client.query("begin");try{
    const g=(await client.query(`select * from portal_giveaways where id=$1 for update;`,[giveawayId])).rows[0];
    if(!g||!["contest","objective"].includes(g.kind)||!["voting_open","voting_closed","submissions_closed"].includes(g.status))throw new Error("This contest is not ready to finalize.");
    const eligible=await client.query(`select s.id::int,s.character_id::int,s.character_name_snapshot,case when g.winner_mode='objective' then coalesce(os.score,0) when g.winner_mode='ranked_vote' then coalesce(sum(g.votes_allowed-coalesce(v.rank_choice,g.votes_allowed)+1),0) else count(v.id) end votes from portal_giveaway_submissions s join portal_giveaways g on g.id=s.giveaway_id join portal_characters c on c.id=s.character_id join portal_discord_member_snapshots dms on dms.discord_user_id=s.discord_user_id left join portal_giveaway_votes v on v.submission_id=s.id left join portal_giveaway_objective_scores os on os.submission_id=s.id where s.giveaway_id=$1 and s.status in ('active','finalized') and c.active=true and c.fc_membership_status='current' and dms.present_in_guild=true and exists(select 1 from portal_fc_verification verification where verification.id=1 and verification.status='verified') and (g.winner_mode<>'objective' or os.verified=true) group by s.id,g.winner_mode,g.votes_allowed,os.score order by votes desc,s.id;`,[giveawayId]);
    if(!eligible.rows.length)throw new Error("No currently eligible contest submissions exist.");
    const cooldownEligible=[];for(const row of eligible.rows){try{await assertCooldownEligible(client,g,Number(row.character_id));cooldownEligible.push(row);}catch{}}
    if(!cooldownEligible.length)throw new Error("No contest submissions remain eligible after applying the prior-winner rule.");
    let ranked=[...cooldownEligible];if(g.winner_mode==="objective")ranked.sort((a:any,b:any)=>g.objective_direction==="lowest"?Number(a.votes)-Number(b.votes):Number(b.votes)-Number(a.votes));
    if(g.winner_mode==="random_submission"){const shuffled=[];while(ranked.length)shuffled.push(ranked.splice(randomInt(ranked.length),1)[0]);ranked=shuffled;}
    if(!["member_vote","ranked_vote","officer_vote","random_submission","objective"].includes(g.winner_mode))throw new Error("Choose a supported contest winner method.");
    const selectedIds=new Set<number>();let internalPlacement=1,displayPlacement=1,index=0;
    while(displayPlacement<=Number(g.placement_count)&&index<ranked.length){
      const score=Number(ranked[index].votes);let tied=[ranked[index]];
      if(["member_vote","ranked_vote","officer_vote"].includes(g.winner_mode))tied=ranked.slice(index).filter((r:any)=>Number(r.votes)===score);
      if(tied.length>1&&["officer","manual","runoff"].includes(g.tie_policy))throw new Error(`Placement ${displayPlacement} is tied and requires the configured officer/runoff resolution before finalization.`);
      const selectedGroup=tied.length>1&&g.tie_policy==="shared"?tied:[tied.length>1&&g.tie_policy==="random"?tied[randomInt(tied.length)]:ranked[index]];
      if(selectedGroup.length===1){const chosenIndex=ranked.indexOf(selectedGroup[0]);if(chosenIndex>index)[ranked[index],ranked[chosenIndex]]=[ranked[chosenIndex],ranked[index]];}
      for(const selected of selectedGroup){
        await client.query(`insert into portal_giveaway_results(giveaway_id,character_id,submission_id,character_name_snapshot,placement,display_placement,result_kind,claim_status,claim_deadline,selected_by,selection_method) values($1,$2,$3,$4,$5,$6,'placement',$7,case when $8::boolean then now()+($9::text||' hours')::interval else null end,$10,$11);`,[giveawayId,selected.character_id,selected.id,selected.character_name_snapshot,internalPlacement++,displayPlacement,g.claim_period_enabled?'awaiting':'not_required',g.claim_period_enabled,g.claim_window_hours||0,actor.actorLabel,g.winner_mode==="random_submission"?"crypto.randomInt among eligible submissions":`${g.winner_mode}; ${score} points; tie policy ${g.tie_policy}`]);
        selectedIds.add(Number(selected.id));
      }
      index+=g.tie_policy==="shared"?tied.length:1;displayPlacement++;
    }    let altPlacement=1;for(const alternate of ranked.filter((row:any)=>!selectedIds.has(Number(row.id))).slice(0,Number(g.alternate_count||0))){await client.query(`insert into portal_giveaway_results(giveaway_id,character_id,submission_id,character_name_snapshot,placement,result_kind,public,claim_status,selected_by,selection_method) values($1,$2,$3,$4,$5,'alternate',false,'not_required',$6,$7);`,[giveawayId,alternate.character_id,alternate.id,alternate.character_name_snapshot,altPlacement++,actor.actorLabel,`${g.winner_mode} alternate order`]);}
    await client.query(`update portal_giveaways set status=case when claim_period_enabled then 'awaiting_claim' else 'completed' end,updated_at=now() where id=$1;`,[giveawayId]);await audit(client,giveawayId,"contest_finalized",actor,{placements:displayPlacement-1,tiePolicy:g.tie_policy,winnerMode:g.winner_mode,eligibleSubmissions:eligible.rows.length});if(g.post_results)await queueGiveawayDiscordJob(client,giveawayId,"sync_results",String(Date.now()));await client.query("commit");
  }catch(error){await client.query("rollback");throw error;}
}
export async function requestDeleteGiveaway(client:Client,actor:GiveawayActor,giveawayId:number){
  if(!actor.isOfficer)throw new Error("Officer access is required.");
  await ensureGiveawayTables(client);await client.query("begin");
  try{
    const giveaway=(await client.query(`select id,status,title,is_test,delete_pending from portal_giveaways where id=$1 for update;`,[giveawayId])).rows[0];
    if(!giveaway)throw new Error("Giveaway not found.");
    if(giveaway.is_test)throw new Error("Use the test-giveaway delete control for test records.");
    if(giveaway.status==="draft")throw new Error("Use Delete Draft while this record is still a draft.");
    if(giveaway.delete_pending){await client.query("commit");return;}
    if(giveaway.status!=="completed"){await client.query(`update portal_giveaway_prize_inventory i set quantity_available=i.quantity_available+p.quantity,updated_at=now() from portal_giveaway_prizes p where p.giveaway_id=$1 and p.inventory_item_id=i.id;`,[giveawayId]);await client.query(`update portal_giveaway_prizes set inventory_item_id=null where giveaway_id=$1;`,[giveawayId]);}
    await queueGiveawayDiscordJob(client,giveawayId,"delete_all",`permanent-${Date.now()}`,{deleteAnyGiveawayAfter:true});
    await client.query(`update portal_giveaways set delete_pending=true,status='cancelled',updated_at=now() where id=$1;`,[giveawayId]);
    await audit(client,giveawayId,"permanent_delete_requested",actor,{previousStatus:giveaway.status,title:giveaway.title});
    await client.query("commit");
  }catch(error){await client.query("rollback");throw error;}
}

export async function deleteTestGiveaway(client:Client,actor:GiveawayActor,giveawayId:number){if(!actor.isOfficer)throw new Error("Officer access is required.");await ensureGiveawayTables(client);await client.query("begin");try{const g=(await client.query(`select is_test from portal_giveaways where id=$1 for update;`,[giveawayId])).rows[0];if(!g?.is_test)throw new Error("Only test giveaways can be deleted.");await client.query(`update portal_giveaway_prize_inventory i set quantity_available=i.quantity_available+p.quantity,updated_at=now() from portal_giveaway_prizes p where p.giveaway_id=$1 and p.inventory_item_id=i.id;`,[giveawayId]);await client.query(`update portal_giveaway_prizes set inventory_item_id=null where giveaway_id=$1;`,[giveawayId]);await queueGiveawayDiscordJob(client,giveawayId,"delete_all",String(Date.now()));await client.query(`update portal_giveaway_discord_jobs set payload=payload||jsonb_build_object('deleteGiveawayAfter',true) where giveaway_id=$1 and job_kind='delete_all' and status='pending';`,[giveawayId]);await client.query(`update portal_giveaways set delete_pending=true,status='cancelled',updated_at=now() where id=$1;`,[giveawayId]);await audit(client,giveawayId,"test_delete_requested",actor);await client.query("commit");}catch(error){await client.query("rollback");throw error;}}


export async function resolveContestPlacement(client:Client,actor:GiveawayActor,giveawayId:number,submissionId:number){
  if(!actor.isOfficer)throw new Error("Officer access is required.");await ensureGiveawayTables(client);await client.query("begin");
  try{
    const g=(await client.query(`select * from portal_giveaways where id=$1 for update;`,[giveawayId])).rows[0];if(!g||!["contest","objective"].includes(g.kind)||!["voting_open","voting_closed","submissions_closed"].includes(g.status))throw new Error("This contest is not awaiting an officer tie decision.");
    const s=(await client.query(`select s.* from portal_giveaway_submissions s join portal_characters c on c.id=s.character_id join portal_discord_member_snapshots d on d.discord_user_id=s.discord_user_id where s.id=$1 and s.giveaway_id=$2 and s.status in ('active','finalized') and c.active=true and c.fc_membership_status='current' and d.present_in_guild=true and exists(select 1 from portal_fc_verification verification where verification.id=1 and verification.status='verified');`,[submissionId,giveawayId])).rows[0];if(!s)throw new Error("That tied entry is no longer eligible.");
    const prior=await client.query(`select 1 from portal_giveaway_results where giveaway_id=$1 and submission_id=$2 and claim_status not in ('forfeited','replaced');`,[giveawayId,submissionId]);if(prior.rows.length)throw new Error("That entry already has a placement.");
    const placement=Number((await client.query(`select coalesce(max(placement),0)+1 placement from portal_giveaway_results where giveaway_id=$1 and result_kind='placement';`,[giveawayId])).rows[0].placement);if(placement>Number(g.placement_count))throw new Error("All configured placements have already been filled.");
    await client.query(`insert into portal_giveaway_results(giveaway_id,character_id,submission_id,character_name_snapshot,placement,display_placement,result_kind,claim_status,claim_deadline,selected_by,selection_method) values($1,$2,$3,$4,$5,$5,'placement',$6,case when $7::boolean then now()+($8::text||' hours')::interval else null end,$9,$10);`,[giveawayId,s.character_id,s.id,s.character_name_snapshot,placement,g.claim_period_enabled?'awaiting':'not_required',g.claim_period_enabled,g.claim_window_hours||0,actor.actorLabel,`officer tie resolution (${g.tie_policy})`]);
    const done=placement>=Number(g.placement_count);if(done)await client.query(`update portal_giveaways set status=case when claim_period_enabled then 'awaiting_claim' else 'completed' end,updated_at=now() where id=$1;`,[giveawayId]);
    await audit(client,giveawayId,"tie_resolved",actor,{submissionId,placement,tiePolicy:g.tie_policy,completed:done});if(done&&g.post_results)await queueGiveawayDiscordJob(client,giveawayId,"sync_results",`tie-${Date.now()}`);await client.query("commit");
  }catch(error){await client.query("rollback");throw error;}
}

export async function saveObjectiveScore(client:Client,actor:GiveawayActor,giveawayId:number,submissionId:number,score:number,evidence:string,verified:boolean){
  if(!actor.isOfficer)throw new Error("Officer access is required.");if(!Number.isFinite(score))throw new Error("Enter a valid objective score.");await ensureGiveawayTables(client);
  const row=(await client.query(`select g.evidence_required from portal_giveaways g join portal_giveaway_submissions s on s.giveaway_id=g.id where g.id=$1 and s.id=$2 and g.kind in ('contest','objective');`,[giveawayId,submissionId])).rows[0];if(!row)throw new Error("Objective entry not found.");if(row.evidence_required&&!evidence.trim())throw new Error("Evidence is required for this objective.");
  await client.query(`insert into portal_giveaway_objective_scores(giveaway_id,submission_id,score,evidence,verified,verified_by,verified_at) values($1,$2,$3,$4,$5,$6,case when $5 then now() else null end) on conflict(giveaway_id,submission_id) do update set score=excluded.score,evidence=excluded.evidence,verified=excluded.verified,verified_by=excluded.verified_by,verified_at=excluded.verified_at;`,[giveawayId,submissionId,score,evidence.trim(),verified,actor.actorLabel]);await audit(client,giveawayId,"objective_score_saved",actor,{submissionId,score,verified});
}

export async function savePrizeInventoryItem(client:Client,actor:GiveawayActor,input:{id?:number;name:string;category:string;donor:string;quantity:number;notes:string}){
  if(!actor.isOfficer)throw new Error("Officer access is required.");await ensureGiveawayTables(client);if(!input.name.trim())throw new Error("Prize name is required.");
  if(input.id)await client.query(`update portal_giveaway_prize_inventory set name=$2,category=$3,donor_display=$4,quantity_available=$5,notes=$6,updated_at=now() where id=$1;`,[input.id,input.name.trim(),input.category,input.donor||null,input.quantity,input.notes]);
  else await client.query(`insert into portal_giveaway_prize_inventory(name,category,donor_display,quantity_available,notes) values($1,$2,$3,$4,$5) on conflict(lower(name)) where active=true do update set quantity_available=portal_giveaway_prize_inventory.quantity_available+excluded.quantity_available,category=excluded.category,donor_display=excluded.donor_display,notes=excluded.notes,updated_at=now();`,[input.name.trim(),input.category,input.donor||null,input.quantity,input.notes]);
  await audit(client,null,"prize_inventory_saved",actor,{name:input.name,quantity:input.quantity});
}
export async function archivePrizeInventoryItem(client:Client,actor:GiveawayActor,id:number){if(!actor.isOfficer)throw new Error("Officer access is required.");await ensureGiveawayTables(client);await client.query(`update portal_giveaway_prize_inventory set active=false,updated_at=now() where id=$1;`,[id]);await audit(client,null,"prize_inventory_archived",actor,{id});}
export async function saveGiveawayTemplate(client:Client,actor:GiveawayActor,name:string,payload:Record<string,unknown>){if(!actor.isOfficer)throw new Error("Officer access is required.");await ensureGiveawayTables(client);if(!name.trim())throw new Error("Template name is required.");await client.query(`insert into portal_giveaway_templates(name,payload) values($1,$2::jsonb) on conflict(name) do update set payload=excluded.payload,active=true,updated_at=now();`,[name.trim(),JSON.stringify(payload)]);await audit(client,null,"giveaway_template_saved",actor,{name:name.trim()});}
export async function archiveGiveawayTemplate(client:Client,actor:GiveawayActor,id:number){if(!actor.isOfficer)throw new Error("Officer access is required.");await ensureGiveawayTables(client);await client.query(`update portal_giveaway_templates set active=false,updated_at=now() where id=$1;`,[id]);await audit(client,null,"giveaway_template_archived",actor,{id});}
export async function saveTemplateFromGiveaway(client:Client,actor:GiveawayActor,giveawayId:number,name:string){
  if(!actor.isOfficer)throw new Error("Officer access is required.");await ensureGiveawayTables(client);const row=(await client.query(`select to_jsonb(g)-'id'-'status'-'is_test'-'delete_pending'-'created_at'-'updated_at'-'created_by'-'material_rules_locked_at' giveaway,(select to_jsonb(p)-'id'-'giveaway_id'-'image_data'-'created_at'-'updated_at' from portal_giveaway_prizes p where p.giveaway_id=g.id order by p.id limit 1) prize from portal_giveaways g where g.id=$1;`,[giveawayId])).rows[0];if(!row)throw new Error("Giveaway not found.");await saveGiveawayTemplate(client,actor,name,{giveaway:row.giveaway,prize:row.prize});
}
export async function createDraftFromTemplate(client:Client,actor:GiveawayActor,templateId:number){
  if(!actor.isOfficer)throw new Error("Officer access is required.");await ensureGiveawayTables(client);await client.query("begin");try{const t=(await client.query(`select * from portal_giveaway_templates where id=$1 and active=true for update;`,[templateId])).rows[0];if(!t)throw new Error("Template not found.");const g=t.payload?.giveaway||{},p=t.payload?.prize||{};const result=await client.query(`insert into portal_giveaways(kind,status,title,description,rules,theme,winner_mode,visibility_mode,winner_count,alternate_count,votes_allowed,placement_count,max_photos,max_entries_per_member,cooldown_policy,claim_period_enabled,claim_window_hours,tie_policy,qualification_instructions,objective_metric_label,objective_direction,evidence_required,post_opening,reminders_enabled,reminder_minutes,post_voting_open,discord_contest_gallery,discord_voting_enabled,post_results,discord_auto_enroll,discord_source_channel_id,created_by) values($1,'draft',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,false,null,$29) returning id::int;`,[g.kind||'random',`${g.title||t.name} (Copy)`,g.description||'',g.rules||'',g.theme||null,g.winner_mode||'random',g.visibility_mode||'public',g.winner_count||1,g.alternate_count||0,g.votes_allowed||1,g.placement_count||1,g.max_photos||4,g.max_entries_per_member||1,g.cooldown_policy||'none',Boolean(g.claim_period_enabled),g.claim_window_hours||null,g.tie_policy||'random',g.qualification_instructions||'',g.objective_metric_label||'',g.objective_direction||'highest',Boolean(g.evidence_required),Boolean(g.post_opening),Boolean(g.reminders_enabled),g.reminder_minutes||[],Boolean(g.post_voting_open),Boolean(g.discord_contest_gallery),Boolean(g.discord_voting_enabled),g.post_results!==false,actor.actorLabel]);const id=Number(result.rows[0].id);await client.query(`update portal_giveaways set ballot_privacy_mode=$2,live_totals_visible=$3 where id=$1;`,[id,["public","anonymous"].includes(g.ballot_privacy_mode)?g.ballot_privacy_mode:"private",Boolean(g.live_totals_visible)]);await client.query(`insert into portal_giveaway_prizes(giveaway_id,prize_name,quantity,category,donor_display,notes,status) values($1,$2,$3,$4,$5,$6,'reserved');`,[id,p.prize_name||'Prize',p.quantity||1,p.category||'in_game',p.donor_display||null,p.notes||null]);await audit(client,id,"draft_created_from_template",actor,{templateId,templateName:t.name});await client.query("commit");return id;}catch(error){await client.query("rollback");throw error;}
}
