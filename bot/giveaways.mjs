import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { createCipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { normalizeRank } from "./giveaway-rules.mjs";
import { PORTAL_URL } from "./installation-config.mjs";

const ACTIVE_CONTEST_STATUSES = ["submissions_open", "submissions_closed", "voting_open", "voting_closed"];
const RESULTS_RECONCILE_RUN = Date.now().toString(36);
let resultsArtifactsReconciled = false;

function ballotSecret(){const value=String(process.env.PRIVACY_SUPPRESSION_SECRET||process.env.AUTH_SECRET||"").trim();if(!value)throw new Error("The privacy-protection secret is required for contest ballots.");return createHash("sha256").update(`giveaway-ballot:${value}`).digest();}
function giveawayVoterKey(giveawayId,discordUserId){return createHmac("sha256",ballotSecret()).update(`${giveawayId}:${discordUserId}`).digest("hex");}
function encryptGiveawayDiscordId(discordUserId){const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",ballotSecret(),iv),body=Buffer.concat([cipher.update(discordUserId,"utf8"),cipher.final()]);return[iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),body.toString("base64url")].join(".");}

export async function ensureGiveawayBotTables(pool) {
  await pool.query(`
    create table if not exists portal_giveaway_discord_artifacts (
      id bigserial primary key,
      giveaway_id bigint not null references portal_giveaways(id) on delete cascade,
      submission_id bigint references portal_giveaway_submissions(id) on delete cascade,
      artifact_kind text not null,
      channel_id text not null,
      message_id text not null,
      active boolean not null default true,
      last_synced_at timestamptz,
      delete_after timestamptz,
      last_error text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create unique index if not exists portal_giveaway_discord_artifacts_identity_idx
      on portal_giveaway_discord_artifacts (giveaway_id, coalesce(submission_id, 0), artifact_kind);
    create table if not exists portal_giveaway_discord_jobs (
      id bigserial primary key,
      giveaway_id bigint references portal_giveaways(id) on delete cascade,
      submission_id bigint references portal_giveaway_submissions(id) on delete cascade,
      job_kind text not null,
      dedupe_key text not null unique,
      payload jsonb not null default '{}'::jsonb,
      status text not null default 'pending' check (status in ('pending','processing','completed','failed','cancelled')),
      attempts integer not null default 0,
      run_after timestamptz not null default now(),
      last_error text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      completed_at timestamptz
    );
    create index if not exists portal_giveaway_jobs_due_idx on portal_giveaway_discord_jobs(status, run_after, id);
    alter table portal_giveaway_results add column if not exists claim_deadline timestamptz;
    alter table portal_giveaway_results add column if not exists display_placement integer;
    alter table portal_giveaway_votes add column if not exists rank_choice integer;
    alter table portal_giveaways add column if not exists ballot_privacy_mode text not null default 'private';
    alter table portal_giveaway_votes add column if not exists voter_key text;
    alter table portal_giveaway_votes add column if not exists voter_discord_ciphertext text;
    alter table portal_giveaway_votes add column if not exists voter_label text;
    alter table portal_giveaway_votes alter column voter_character_id drop not null;
    alter table portal_giveaway_votes alter column voter_discord_user_id drop not null;
    create unique index if not exists portal_giveaway_votes_voter_key_submission_idx on portal_giveaway_votes(giveaway_id,voter_key,submission_id) where voter_key is not null;
  `);
}

async function strictMember(pool, discordUserId) {
  const result = await pool.query(`
    select c.id::int, c.character_name
    from portal_discord_links dl
    join portal_characters c on c.id=dl.character_id
    join portal_discord_member_snapshots s on s.discord_user_id=dl.discord_user_id
    where dl.discord_user_id=$1 and c.active=true and c.fc_membership_status='current' and s.present_in_guild=true
      and exists(select 1 from portal_fc_verification verification where verification.id=1 and verification.status='verified')
    limit 1;`, [discordUserId]);
  return result.rows[0] || null;
}

async function giveawayData(pool, giveawayId) {
  const result = await pool.query(`
    select g.*, p.prize_name, p.quantity as prize_quantity, p.donor_display as prize_donor, p.image_filename as prize_image_filename, p.image_mime_type as prize_image_mime_type, p.image_data as prize_image_data,
      (select count(*)::int from portal_giveaway_entries e where e.giveaway_id=g.id and e.status in ('entered','claimed')) entry_count,
      (select count(*)::int from portal_giveaway_entries e where e.giveaway_id=g.id and e.status='claimed') claimed_count,
      (select count(*)::int from portal_giveaway_submissions s where s.giveaway_id=g.id and s.status in ('active','finalized')) submission_count
    from portal_giveaways g
    left join lateral(select * from portal_giveaway_prizes where giveaway_id=g.id order by id limit 1)p on true
    where g.id=$1;`, [giveawayId]);
  return result.rows[0] || null;
}

const GIVEAWAYS_URL=new URL("?view=giveaways",PORTAL_URL).toString();

function disclosurePayload(g,closed=false){
  const end=g.submission_closes_at?` Submissions close <t:${Math.floor(new Date(g.submission_closes_at).getTime()/1000)}:F>.`:"";
  const description=closed
    ? `Automatic contest enrollment from this channel has ended for **${g.title}**. New image posts are no longer added to this contest.`
    : `Eligible FC members: qualifying image posts in this channel are automatically entered into **${g.title}** during its submission period. The first ${g.max_photos||4} images per entry are accepted in attachment order.${end} Manage your entry on the portal: ${GIVEAWAYS_URL}`;
  return {embeds:[new EmbedBuilder().setColor(closed?0x64748b:0x9333ea).setTitle(closed?"Contest Auto-Enrollment Closed":"Contest Auto-Enrollment Is Active").setDescription(description).setFooter({text:g.is_test?"TEST notice - shared test channel only":"Website entries and contest history remain authoritative"}).setTimestamp()]};
}

function prizeImageFile(g) {
  if (!g.prize_image_data) return null;
  const filenameExt = String(g.prize_image_filename || "").split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  const mimeExt = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp" }[String(g.prize_image_mime_type || "").toLowerCase()];
  const ext = mimeExt || filenameExt || "png";
  return { attachment: g.prize_image_data, name: `giveaway-prize-${g.id}.${ext}` };
}

function openingPayload(g) {
  const labels = { random: "Random Giveaway", fcfs: "First Come, First Served", contest: "Contest", challenge: "Challenge", objective: "Objective Competition" };
  const embed = new EmbedBuilder().setColor(0x9333ea).setTitle(g.title).setDescription(g.description || "A new FC reward event is available.")
    .addFields(
      { name: "Type", value: labels[g.kind] || g.kind, inline: true },
      { name: "Prize", value: `${g.prize_name || "Prize"}${Number(g.prize_quantity || 1) > 1 ? ` x${g.prize_quantity}` : ""}`, inline: true },
      { name: g.kind === "contest" ? "Submissions" : "Entries", value: String(g.kind === "contest" ? g.submission_count : g.entry_count), inline: true }
    ).setFooter({ text: `${g.is_test ? "TEST - disposable" : "Eligibility: current FC member and present in the FC Discord"} · FFXIV materials in uploads © SQUARE ENIX` }).setTimestamp();
  if (g.rules) embed.addFields({ name: "Rules", value: String(g.rules).slice(0, 1024) });
  if (g.prize_donor) embed.addFields({ name: "Donated by", value: String(g.prize_donor).slice(0, 1024) });
  const prizeFile = prizeImageFile(g);
  if (prizeFile) embed.setImage(`attachment://${prizeFile.name}`);
  const components = [];
  if (g.kind === "random" || g.kind === "challenge") components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`cotf_giveaway_enter:${g.id}`).setLabel("Enter / Withdraw").setStyle(ButtonStyle.Primary)));
  if (g.kind === "fcfs" && g.status === "open" && Number(g.claimed_count || 0) < Number(g.prize_quantity || 0)) components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`cotf_giveaway_claim:${g.id}`).setLabel("Claim").setStyle(ButtonStyle.Success)));
  return { embeds: [embed], components, ...(prizeFile ? { files: [prizeFile] } : {}) };
}

async function submissionPayload(pool, g, submission) {
  const images = await pool.query(`select id::int, filename, mime_type, image_data from portal_giveaway_submission_images where submission_id=$1 order by sort_order,id limit 4;`, [submission.id]);
  const title = g.visibility_mode === "anonymous" && !["voting_closed", "completed"].includes(g.status) ? `Entry #${submission.id}` : submission.character_name_snapshot;
  const info = new EmbedBuilder().setColor(0x7e22ce).setTitle(submission.title || title).setDescription(submission.description || "Contest submission")
    .addFields({ name: "Contestant", value: title }, { name: "Contest", value: g.title }).setFooter({text:"FFXIV materials in uploads © SQUARE ENIX"}).setTimestamp(submission.created_at);
  const files = images.rows.map((row, index) => ({ attachment: row.image_data, name: `contest-${submission.id}-${index}.${String(row.filename).split(".").pop() || "png"}` }));
  const embeds = [info, ...files.map((file, index) => new EmbedBuilder().setColor(0x7e22ce).setTitle(`Photo ${index + 1}`).setImage(`attachment://${file.name}`).setFooter({text:"FFXIV materials in uploads © SQUARE ENIX"}))];
  const components = g.status === "voting_open" && g.discord_voting_enabled && ["member_vote","ranked_vote"].includes(g.winner_mode)
    ? [new ActionRowBuilder().addComponents(...(g.winner_mode==="ranked_vote"?Array.from({length:Math.min(3,Number(g.votes_allowed||1))},(_,index)=>new ButtonBuilder().setCustomId(`cotf_giveaway_vote:${g.id}:${submission.id}:${index+1}`).setLabel(`Rank ${index+1}`).setStyle(ButtonStyle.Primary)):[new ButtonBuilder().setCustomId(`cotf_giveaway_vote:${g.id}:${submission.id}`).setLabel("Vote / Remove Vote").setStyle(ButtonStyle.Primary)]))]
    : [];
  return { embeds, components, files };
}
async function resultsPayload(pool, g) {
  const rows = await pool.query(`select r.character_name_snapshot, coalesce(r.display_placement,r.placement) placement, r.result_kind, r.claim_status, coalesce(c.portrait_url,c.avatar_url) as winner_portrait_url from portal_giveaway_results r left join portal_characters c on c.id=r.character_id where r.giveaway_id=$1 and r.public=true and r.claim_status not in ('forfeited','replaced') order by case when r.result_kind='winner' then 0 when r.result_kind='placement' then 1 when r.result_kind='fcfs' then 2 else 3 end,r.placement;`, [g.id]);
  const lines = rows.rows.map(r => `${r.result_kind === "alternate" ? "Alternate" : `#${r.placement}`} - **${r.character_name_snapshot}**${r.claim_status === "awaiting" ? " (awaiting claim)" : ""}`);
  const embed = new EmbedBuilder().setColor(0xa855f7).setTitle(`${g.title} - Results`).setDescription(lines.join("\n") || "No eligible winners were recorded.")
    .addFields({ name: "Prize", value: g.prize_name || "Prize" }).setTimestamp();
  if (g.prize_donor) embed.addFields({ name: "Donated by", value: String(g.prize_donor).slice(0, 1024) });
const portraitRows = rows.rows.filter(row => /^https?:\/\//i.test(String(row.winner_portrait_url || "")));
  const portraitEmbeds = portraitRows.slice(0, 9).map(row => new EmbedBuilder()
    .setColor(0xa855f7)
    .setTitle(`${row.result_kind === "alternate" ? "Alternate" : `#${row.placement}`} - ${row.character_name_snapshot}`)
    .setImage(row.winner_portrait_url).setFooter({text:"FFXIV materials © SQUARE ENIX"}));
  if (portraitRows.length > portraitEmbeds.length) embed.setFooter({ text: `Showing ${portraitEmbeds.length} of ${portraitRows.length} winner portraits.` });
  const prizeFile = prizeImageFile(g);
  if (prizeFile) embed.setThumbnail(`attachment://${prizeFile.name}`);
  return { embeds: [embed, ...portraitEmbeds], components: [], ...(prizeFile ? { files: [prizeFile] } : {}) };
}

async function syncArtifact({ pool, bot, giveawayId, submissionId = null, artifactKind, channelId, payload, deleteAfter = null }) {
  if (!channelId) throw new Error(`No Discord channel is configured for ${artifactKind}.`);
  const channel = await bot.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.() || !channel.messages?.fetch) throw new Error(`Discord channel ${channelId} is unavailable or not writable.`);
  await pool.query(`select pg_advisory_lock(hashtext($1));`, [`giveaway-artifact:${giveawayId}:${submissionId || 0}:${artifactKind}`]);
  try {
    const existing = await pool.query(`select * from portal_giveaway_discord_artifacts where giveaway_id=$1 and submission_id is not distinct from $2 and artifact_kind=$3 limit 1;`, [giveawayId, submissionId, artifactKind]);
    let message = existing.rows[0] ? await channel.messages.fetch(existing.rows[0].message_id).catch(() => null) : null;
    message = message ? await message.edit({ ...payload, attachments: [] }) : await channel.send(payload);
    if (existing.rows[0]) await pool.query(`update portal_giveaway_discord_artifacts set channel_id=$2,message_id=$3,active=true,last_synced_at=now(),delete_after=$4,last_error=null,updated_at=now() where id=$1;`, [existing.rows[0].id, channelId, message.id, deleteAfter]);
    else await pool.query(`insert into portal_giveaway_discord_artifacts(giveaway_id,submission_id,artifact_kind,channel_id,message_id,last_synced_at,delete_after) values($1,$2,$3,$4,$5,now(),$6);`, [giveawayId, submissionId, artifactKind, channelId, message.id, deleteAfter]);
  } finally {
    await pool.query(`select pg_advisory_unlock(hashtext($1));`, [`giveaway-artifact:${giveawayId}:${submissionId || 0}:${artifactKind}`]);
  }
}

async function deleteContestArtifacts(pool, bot, giveawayId, submissionId = null) {
  const artifacts = await pool.query(`select * from portal_giveaway_discord_artifacts where giveaway_id=$1 and active=true and artifact_kind in ('contest_header','contestant') and ($2::bigint is null or submission_id=$2);`, [giveawayId, submissionId]);
  for (const artifact of artifacts.rows) { const channel=await bot.channels.fetch(artifact.channel_id).catch(()=>null);const message=channel?.isTextBased?.()&&channel.messages?.fetch?await channel.messages.fetch(artifact.message_id).catch(()=>null):null;if(message)await message.delete().catch(()=>null);await pool.query(`update portal_giveaway_discord_artifacts set active=false,updated_at=now() where id=$1;`,[artifact.id]); }
}

async function deleteArtifacts(pool, bot, giveawayId, includeResults = true) {
  const artifacts = await pool.query(`select * from portal_giveaway_discord_artifacts where giveaway_id=$1 and active=true and ($2::boolean or artifact_kind<>'results');`, [giveawayId, includeResults]);
  for (const artifact of artifacts.rows) {
    const channel = await bot.channels.fetch(artifact.channel_id).catch(() => null);
    const message = channel?.isTextBased?.() && channel.messages?.fetch ? await channel.messages.fetch(artifact.message_id).catch(() => null) : null;
    if (message) await message.delete().catch(() => null);
    await pool.query(`update portal_giveaway_discord_artifacts set active=false,updated_at=now() where id=$1;`, [artifact.id]);
  }
}

async function pickJob(pool) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query(`select * from portal_giveaway_discord_jobs where status='pending' and run_after<=now() order by id for update skip locked limit 1;`);
    if (!result.rows[0]) { await client.query("commit"); return null; }
    await client.query(`update portal_giveaway_discord_jobs set status='processing',attempts=attempts+1,updated_at=now() where id=$1;`, [result.rows[0].id]);
    await client.query("commit"); return result.rows[0];
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}

async function processExpiredGiveawayClaims(pool){
  const due=await pool.query(`select r.id::int from portal_giveaway_results r where r.claim_status='awaiting' and r.claim_deadline is not null and r.claim_deadline<=now() order by r.claim_deadline,r.id limit 50;`);
  for(const item of due.rows){const client=await pool.connect();try{await client.query("begin");const row=(await client.query(`select r.*,coalesce(r.display_placement,r.placement) effective_placement,g.kind,g.claim_window_hours,g.post_results,g.post_opening,g.closes_at from portal_giveaway_results r join portal_giveaways g on g.id=r.giveaway_id where r.id=$1 for update of r,g;`,[item.id])).rows[0];if(!row||row.claim_status!=="awaiting"){await client.query("commit");continue;}const reason="Claim window expired automatically.";
    if(row.kind==="fcfs"&&row.result_kind==="fcfs"){await client.query(`update portal_giveaway_results set claim_status='forfeited',public=false,replacement_reason=$2 where id=$1;`,[row.id,reason]);await client.query(`update portal_giveaway_entries set status='withdrawn',invalidated_at=now(),invalidation_reason=$3 where giveaway_id=$1 and character_id=$2 and status='claimed';`,[row.giveaway_id,row.character_id,reason]);await client.query(`update portal_giveaways set status=case when closes_at is null or closes_at>now() then 'open' else 'completed' end,updated_at=now() where id=$1;`,[row.giveaway_id]);}
    else{const alt=(await client.query(`select * from portal_giveaway_results where giveaway_id=$1 and result_kind='alternate' and claim_status='not_required' order by placement limit 1 for update;`,[row.giveaway_id])).rows[0];if(alt){await client.query(`update portal_giveaway_results set claim_status='replaced',public=false,placement=1000000+id,replacement_reason=$2 where id=$1;`,[row.id,reason]);await client.query(`update portal_giveaway_results set result_kind=$2,placement=$3,display_placement=$6,public=true,claim_status='awaiting',claim_deadline=now()+($4::text||' hours')::interval,replacement_reason=$5 where id=$1;`,[alt.id,row.result_kind,row.placement,row.claim_window_hours||72,reason,row.effective_placement]);}else await client.query(`update portal_giveaway_results set claim_status='forfeited',public=false,replacement_reason=$2 where id=$1;`,[row.id,reason]);const pending=Number((await client.query(`select count(*) from portal_giveaway_results where giveaway_id=$1 and claim_status='awaiting';`,[row.giveaway_id])).rows[0].count);if(!pending)await client.query(`update portal_giveaways set status='completed',updated_at=now() where id=$1;`,[row.giveaway_id]);}
    await client.query(`insert into portal_giveaway_audit(giveaway_id,action_type,actor_label,details) values($1,'claim_expired','Giveaway automation',$2::jsonb);`,[row.giveaway_id,JSON.stringify({resultId:row.id,reason})]);if(row.post_results)await client.query(`insert into portal_giveaway_discord_jobs(giveaway_id,job_kind,dedupe_key) values($1,'sync_results',$2) on conflict(dedupe_key) do nothing;`,[row.giveaway_id,`giveaway:${row.giveaway_id}:0:sync_results:claim-expired-${row.id}`]);if(row.kind==="fcfs"&&row.post_opening)await client.query(`insert into portal_giveaway_discord_jobs(giveaway_id,job_kind,dedupe_key) values($1,'sync_opening',$2) on conflict(dedupe_key) do nothing;`,[row.giveaway_id,`giveaway:${row.giveaway_id}:0:sync_opening:claim-expired-${row.id}`]);await client.query("commit");}catch(error){await client.query("rollback").catch(()=>null);console.error("[cotf-bot] Expired giveaway claim processing failed:",error);}finally{client.release();}}
}

export async function maintainGiveawayLifecycle(pool) {
  await processExpiredGiveawayClaims(pool);
  const opened=await pool.query(`update portal_giveaways set status=case when kind in ('contest','objective') then 'submissions_open' else 'open' end,material_rules_locked_at=coalesce(material_rules_locked_at,now()),updated_at=now() where status='scheduled' and coalesce(submission_opens_at,opens_at)<=now() returning id,post_opening,discord_auto_enroll;`);
  for(const g of opened.rows){if(g.post_opening)await pool.query(`insert into portal_giveaway_discord_jobs(giveaway_id,job_kind,dedupe_key) values($1,'sync_opening',$2) on conflict(dedupe_key) do nothing;`,[g.id,`giveaway:${g.id}:0:sync_opening:auto-open`]);if(g.discord_auto_enroll)await pool.query(`insert into portal_giveaway_discord_jobs(giveaway_id,job_kind,dedupe_key) values($1,'sync_disclosure_open',$2) on conflict(dedupe_key) do nothing;`,[g.id,`giveaway:${g.id}:0:sync_disclosure_open:auto-open`]);}
  const closed=await pool.query(`update portal_giveaways set status='submissions_closed',updated_at=now() where status='submissions_open' and submission_closes_at is not null and submission_closes_at<=now() returning id,discord_auto_enroll;`);
  for(const g of closed.rows)if(g.discord_auto_enroll)await pool.query(`insert into portal_giveaway_discord_jobs(giveaway_id,job_kind,dedupe_key) values($1,'sync_disclosure_closed',$2) on conflict(dedupe_key) do nothing;`,[g.id,`giveaway:${g.id}:0:sync_disclosure_closed:auto-close`]);
  const voting = await pool.query(`update portal_giveaways set status='voting_open',updated_at=now() where status in ('submissions_open','submissions_closed') and voting_opens_at is not null and voting_opens_at<=now() returning id,post_voting_open,discord_contest_gallery,discord_auto_enroll;`);
  for(const g of voting.rows){if(g.post_voting_open||g.discord_contest_gallery)await pool.query(`insert into portal_giveaway_discord_jobs(giveaway_id,job_kind,dedupe_key) values($1,'sync_contest',$2) on conflict(dedupe_key) do nothing;`,[g.id,`giveaway:${g.id}:0:sync_contest:auto-voting-open`]);if(g.discord_auto_enroll)await pool.query(`insert into portal_giveaway_discord_jobs(giveaway_id,job_kind,dedupe_key) values($1,'sync_disclosure_closed',$2) on conflict(dedupe_key) do nothing;`,[g.id,`giveaway:${g.id}:0:sync_disclosure_closed:auto-voting-open`]);}
  await pool.query(`update portal_giveaways set status='voting_closed',updated_at=now() where status='voting_open' and voting_closes_at is not null and voting_closes_at<=now();`);
  await pool.query(`insert into portal_giveaway_discord_jobs(giveaway_id,job_kind,dedupe_key,payload,run_after)
    select g.id,'sync_reminder','giveaway:'||g.id||':0:sync_reminder:'||m::text,jsonb_build_object('minutes',m),target_at-(m::text||' minutes')::interval
    from portal_giveaways g cross join lateral unnest(g.reminder_minutes)m
    cross join lateral (select coalesce(case when g.kind in ('contest','objective') then g.submission_closes_at else g.closes_at end,g.voting_closes_at) target_at)t
    where g.reminders_enabled=true and g.status not in ('draft','completed','cancelled','no_eligible_entries') and target_at is not null and target_at>now()
    on conflict(dedupe_key) do nothing;`);
}
export async function processGiveawayJobs({ pool, bot, getSettings }) {
  if(!resultsArtifactsReconciled){
    await pool.query(`insert into portal_giveaway_discord_jobs(giveaway_id,job_kind,dedupe_key) select distinct a.giveaway_id,'sync_results','giveaway:'||a.giveaway_id||':0:sync_results:startup-'||$1::text from portal_giveaway_discord_artifacts a where a.active=true and a.artifact_kind='results' on conflict(dedupe_key) do nothing;`,[RESULTS_RECONCILE_RUN]);
    resultsArtifactsReconciled=true;
  }
  await maintainGiveawayLifecycle(pool);
  const expired = await pool.query(`select distinct giveaway_id from portal_giveaway_discord_artifacts where active=true and delete_after is not null and delete_after<=now() and artifact_kind<>'results';`);
  for (const row of expired.rows) await deleteArtifacts(pool, bot, row.giveaway_id, false);
  for (let count = 0; count < 5; count += 1) {
    const job = await pickJob(pool); if (!job) break;
    try {
      const settings = await getSettings({ fresh: true });
      const g = job.giveaway_id ? await giveawayData(pool, job.giveaway_id) : null;
      if (!g && job.job_kind !== "delete_all") throw new Error("Giveaway no longer exists.");
      const testChannel = g?.is_test ? settings.test_channel_id : null;
      if (job.job_kind === "delete_submission") {
        await deleteContestArtifacts(pool, bot, job.giveaway_id, job.submission_id);
      } else if (job.job_kind === "delete_contest_posts") {
        await deleteContestArtifacts(pool, bot, job.giveaway_id);
      } else if (job.job_kind === "delete_all") {
        await deleteArtifacts(pool, bot, job.giveaway_id, true);
        if (job.payload?.deleteAnyGiveawayAfter) { await pool.query(`delete from portal_giveaways where id=$1;`, [job.giveaway_id]); continue; }
        if (job.payload?.deleteGiveawayAfter) { await pool.query(`delete from portal_giveaways where id=$1 and is_test=true;`, [job.giveaway_id]); continue; }
      } else if(job.job_kind==="sync_disclosure_open"||job.job_kind==="sync_disclosure_closed"){
        await syncArtifact({pool,bot,giveawayId:g.id,artifactKind:"auto_enroll_notice",channelId:testChannel||g.discord_source_channel_id,payload:disclosurePayload(g,job.job_kind==="sync_disclosure_closed")});
      } else if (job.job_kind === "sync_opening") {
        await syncArtifact({ pool, bot, giveawayId:g.id, artifactKind:"opening", channelId:testChannel || settings.giveaway_channel_id, payload:openingPayload(g) });
      } else if (job.job_kind === "sync_reminder") {
        const payload=openingPayload(g);
        payload.embeds[0].setTitle(`Reminder: ${g.title}`).setDescription(`${job.payload?.minutes || "Soon"} minutes remain.\n\n${g.description || ""}`);
        await syncArtifact({ pool, bot, giveawayId:g.id, artifactKind:`reminder_${job.payload?.minutes || job.id}`, channelId:testChannel || settings.giveaway_channel_id, payload });
      } else if (job.job_kind === "sync_results") {
        await syncArtifact({ pool, bot, giveawayId:g.id, artifactKind:"results", channelId:testChannel || settings.giveaway_channel_id, payload:await resultsPayload(pool,g) });
      } else if (job.job_kind === "sync_contest") {
        const cleanup = new Date(Date.now() + Number(g.discord_cleanup_after_days || 30) * 86400000);
        await syncArtifact({ pool, bot, giveawayId:g.id, artifactKind:"contest_header", channelId:testChannel || settings.contestants_channel_id, payload:openingPayload(g), deleteAfter:cleanup });
        const submissions = await pool.query(`select * from portal_giveaway_submissions where giveaway_id=$1 and status in ('active','finalized') order by id;`, [g.id]);
        for (const s of submissions.rows) await syncArtifact({ pool, bot, giveawayId:g.id,submissionId:s.id,artifactKind:"contestant",channelId:testChannel || settings.contestants_channel_id,payload:await submissionPayload(pool,g,s),deleteAfter:cleanup });
      } else if (job.job_kind === "sync_submission") {
        const s = (await pool.query(`select * from portal_giveaway_submissions where id=$1 and giveaway_id=$2;`, [job.submission_id,g.id])).rows[0];
        if (s) await syncArtifact({pool,bot,giveawayId:g.id,submissionId:s.id,artifactKind:"contestant",channelId:testChannel || settings.contestants_channel_id,payload:await submissionPayload(pool,g,s),deleteAfter:new Date(Date.now()+Number(g.discord_cleanup_after_days||30)*86400000)});
      }
      await pool.query(`update portal_giveaway_discord_jobs set status='completed',completed_at=now(),last_error=null,updated_at=now() where id=$1;`, [job.id]);
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0,1000) : "Giveaway Discord job failed.";
      await pool.query(`update portal_giveaway_discord_jobs set status=case when attempts>=5 then 'failed' else 'pending' end,run_after=now()+interval '2 minutes',last_error=$2,updated_at=now() where id=$1;`, [job.id,message]);
      console.error("[cotf-bot] Giveaway Discord job failed:", message);
    }
  }
}

async function cooldownAllowed(client, g, characterId) {
  if (g.cooldown_policy === "none") return;
  if (g.cooldown_policy === "last_winner") {
    const prior = await client.query(`select r.character_id from portal_giveaway_results r join portal_giveaways gg on gg.id=r.giveaway_id where gg.id<>$1 and gg.is_test=false and gg.delete_pending=false and gg.status='completed' and r.result_kind in ('winner','placement','fcfs') and r.claim_status not in ('forfeited','replaced') and r.placement=1 order by r.selected_at desc limit 1;`, [g.id]);
    if (Number(prior.rows[0]?.character_id || 0) === Number(characterId)) throw new Error("The immediately previous winner is not eligible for this giveaway."); return;
  }
  const days = Number(String(g.cooldown_policy).split("_")[0]);
  const recent = await client.query(`select 1 from portal_giveaway_results r join portal_giveaways gg on gg.id=r.giveaway_id where r.character_id=$1 and gg.is_test=false and gg.delete_pending=false and r.result_kind in ('winner','placement','fcfs') and r.claim_status not in ('forfeited','replaced') and r.selected_at>=now()-($2::text||' days')::interval limit 1;`, [characterId,days]);
  if (recent.rows.length) throw new Error(`A ${days}-day winner cooldown applies.`);
}

export async function handleGiveawayInteraction(interaction, pool) {
  if (!interaction.isButton() || !interaction.customId.startsWith("cotf_giveaway_")) return false;
  await interaction.deferReply({ ephemeral: true });
  const [action, giveawayValue, submissionValue, rankValue] = interaction.customId.split(":");
  const giveawayId = Number(giveawayValue), submissionId = Number(submissionValue || 0);
  const client = await pool.connect();
  let removeClaimButton = false;
  try {
    await client.query("begin");
    const member = await strictMember(client, interaction.user.id); if (!member) throw new Error("Participation requires current FC membership and current presence in the FC Discord.");
    const g = (await client.query(`select g.*,p.quantity from portal_giveaways g left join lateral(select quantity from portal_giveaway_prizes where giveaway_id=g.id order by id limit 1)p on true where g.id=$1 for update of g;`, [giveawayId])).rows[0]; if (!g) throw new Error("This giveaway is no longer available.");
    if (action === "cotf_giveaway_enter") {
      if (!['random','challenge'].includes(g.kind) || g.status !== 'open') throw new Error("Entries are not open."); await cooldownAllowed(client,g,member.id);
      const existing = await client.query(`select status from portal_giveaway_entries where giveaway_id=$1 and character_id=$2;`, [giveawayId,member.id]);
      if (existing.rows[0]?.status === 'entered') { await client.query(`update portal_giveaway_entries set status='withdrawn' where giveaway_id=$1 and character_id=$2;`,[giveawayId,member.id]); await interaction.editReply("Your entry was withdrawn."); }
      else { await client.query(`insert into portal_giveaway_entries(giveaway_id,character_id,discord_user_id,character_name_snapshot,status) values($1,$2,$3,$4,'entered') on conflict(giveaway_id,character_id) do update set status='entered',discord_user_id=excluded.discord_user_id,character_name_snapshot=excluded.character_name_snapshot,entered_at=now();`,[giveawayId,member.id,interaction.user.id,member.character_name]); await interaction.editReply("You are entered. Good luck!"); }
    } else if (action === "cotf_giveaway_claim") {
      if (g.kind !== 'fcfs' || g.status !== 'open') throw new Error("Claims are not open."); await cooldownAllowed(client,g,member.id);
      const count=Number((await client.query(`select count(*) from portal_giveaway_entries where giveaway_id=$1 and status='claimed';`,[giveawayId])).rows[0].count); if(count>=Number(g.quantity||0)) throw new Error("All prizes have been claimed.");
      const inserted=await client.query(`insert into portal_giveaway_entries(giveaway_id,character_id,discord_user_id,character_name_snapshot,status,claimed_at) values($1,$2,$3,$4,'claimed',now()) on conflict(giveaway_id,character_id) do nothing returning id;`,[giveawayId,member.id,interaction.user.id,member.character_name]); if(!inserted.rows.length) throw new Error("You already claimed or entered this giveaway.");
      const slot=(await client.query(`select slots.position::int from generate_series(1,$2::int) as slots(position) where not exists(select 1 from portal_giveaway_results r where r.giveaway_id=$1 and r.result_kind='fcfs' and r.placement=slots.position and r.claim_status<>'forfeited') order by slots.position limit 1;`,[giveawayId,Number(g.quantity)])).rows[0];if(!slot)throw new Error("No available prize position could be reserved.");const place=Number(slot.position);
      const savedResult=await client.query(`insert into portal_giveaway_results(giveaway_id,character_id,character_name_snapshot,placement,result_kind,claim_status,claim_deadline,selected_by,selection_method) values($1,$2,$3,$4,'fcfs',$5,case when $7::boolean then now()+($8::text||' hours')::interval else null end,$6,'atomic Discord FCFS claim') on conflict(giveaway_id,result_kind,placement) do update set character_id=excluded.character_id,character_name_snapshot=excluded.character_name_snapshot,claim_status=excluded.claim_status,claim_deadline=excluded.claim_deadline,selected_by=excluded.selected_by,selection_method=excluded.selection_method,selected_at=now(),replacement_reason=null where portal_giveaway_results.claim_status='forfeited' returning id;`,[giveawayId,member.id,member.character_name,place,g.claim_period_enabled?'awaiting':'not_required',interaction.user.id,g.claim_period_enabled,g.claim_window_hours||72]);if(!savedResult.rows.length)throw new Error("That prize position was claimed before this request completed.");
      const activeAfter=count+1;if(activeAfter>=Number(g.quantity)) { await client.query(`update portal_giveaways set status=case when claim_period_enabled then 'awaiting_claim' else 'completed' end,updated_at=now() where id=$1;`,[giveawayId]); removeClaimButton = true; }
      if(g.post_results) await client.query(`insert into portal_giveaway_discord_jobs(giveaway_id,job_kind,dedupe_key) values($1,'sync_results',$2) on conflict(dedupe_key) do nothing;`,[giveawayId,`giveaway:${giveawayId}:0:sync_results:fcfs-${place}-${Date.now()}`]); await interaction.editReply(`Claim recorded. You were claim #${place}.`);
    } else if (action === "cotf_giveaway_vote") {
      if (g.status !== 'voting_open' || !g.discord_voting_enabled || !["member_vote","ranked_vote"].includes(g.winner_mode)) throw new Error("Member voting through Discord is not open.");
      await client.query(`select pg_advisory_xact_lock(hashtext($1));`,[`giveaway-vote:${giveawayId}:${member.id}`]); const s=(await client.query(`select * from portal_giveaway_submissions where id=$1 and giveaway_id=$2 and status in ('active','finalized');`,[submissionId,giveawayId])).rows[0];if(!s)throw new Error("Submission not found.");if(Number(s.character_id)===Number(member.id))throw new Error("You cannot vote for your own entry.");
      const rankChoice=g.winner_mode==="ranked_vote"?normalizeRank(rankValue,g.votes_allowed):null;
      const voterKey=giveawayVoterKey(giveawayId,interaction.user.id),anonymous=g.ballot_privacy_mode==="anonymous";
      if(g.winner_mode==="ranked_vote"){
        if(!rankChoice)throw new Error("Choose a valid rank.");
        await client.query(`delete from portal_giveaway_votes where giveaway_id=$1 and (voter_key=$2 or (voter_key is null and voter_discord_user_id=$3)) and rank_choice=$4 and submission_id<>$5;`,[giveawayId,voterKey,interaction.user.id,rankChoice,submissionId]);
      }
      const existing=await client.query(`select id from portal_giveaway_votes where giveaway_id=$1 and (voter_key=$2 or (voter_key is null and voter_discord_user_id=$3)) and submission_id=$4;`,[giveawayId,voterKey,interaction.user.id,submissionId]);
      if(existing.rows.length){
        await client.query(`delete from portal_giveaway_votes where id=$1;`,[existing.rows[0].id]);
        await interaction.editReply("Your vote was removed.");
      }else{
        const used=Number((await client.query(`select count(*) from portal_giveaway_votes where giveaway_id=$1 and (voter_key=$2 or (voter_key is null and voter_discord_user_id=$3));`,[giveawayId,voterKey,interaction.user.id])).rows[0].count);
        if(used>=Number(g.votes_allowed))throw new Error(`You have used all ${g.votes_allowed} votes.`);
        await client.query(`insert into portal_giveaway_votes(giveaway_id,submission_id,voter_character_id,voter_discord_user_id,voter_key,voter_discord_ciphertext,voter_label,source,rank_choice) values($1,$2,$3,$4,$5,$6,$7,'discord',$8);`,[giveawayId,submissionId,anonymous?null:member.id,anonymous?null:interaction.user.id,voterKey,anonymous?encryptGiveawayDiscordId(interaction.user.id):null,anonymous?null:member.character_name,rankChoice]);
        await interaction.editReply(`Vote recorded (${used+1}/${g.votes_allowed}).`);
      }
    } else throw new Error("Unknown giveaway action.");
    const anonymousVote=action==="cotf_giveaway_vote"&&g.ballot_privacy_mode==="anonymous";
    await client.query(`insert into portal_giveaway_audit(giveaway_id,action_type,actor_discord_user_id,actor_character_id,actor_label,details) values($1,$2,$3,$4,$5,$6::jsonb);`,[giveawayId,action,anonymousVote?null:interaction.user.id,anonymousVote?null:member.id,anonymousVote?"Anonymous voter":member.character_name,JSON.stringify(anonymousVote?{source:'discord'}:{source:'discord',submissionId:submissionId||null})]);
    await client.query("commit");
    if (removeClaimButton && interaction.message?.editable) await interaction.message.edit({ components: [] }).catch(() => null);
    return true;
  } catch(error) { await client.query("rollback"); const message=error instanceof Error?error.message:"That action could not be completed."; if(action==="cotf_giveaway_claim"&&interaction.message?.editable&&["Claims are not open.","All prizes have been claimed."].includes(message))await interaction.message.edit({components:[]}).catch(()=>null); await interaction.editReply(message); return true; } finally { client.release(); }
}

export async function autoEnrollGiveawaySubmission({ message, pool }) {
  if (!message || message.author?.bot) return false;
  const client=await pool.connect();let acceptedCount=0,rejected=0,remaining=0,maxPhotos=0;
  try {
    await client.query("begin");
    const contests=await client.query(`select * from portal_giveaways where discord_auto_enroll=true and discord_source_channel_id=$1 and status='submissions_open' order by id limit 2;`,[message.channelId]);
    if(!contests.rows.length){await client.query("rollback");return false;}if(contests.rows.length>1){await client.query("rollback");console.error('[cotf-bot] Multiple active auto-enrollment contests share a source channel; skipped.');return false;}
    const g=contests.rows[0],member=await strictMember(client,message.author.id);if(!member){await client.query("rollback");return false;}maxPhotos=Number(g.max_photos);
    await client.query(`select pg_advisory_xact_lock(hashtext($1));`,[`giveaway-submission:${g.id}:${member.id}`]);
    const gallery=(await client.query(`select id from portal_community_gallery_posts where source_message_id=$1 limit 1;`,[message.id])).rows[0];if(!gallery){await client.query("rollback");return false;}
    const images=await client.query(`select * from portal_community_gallery_images where post_id=$1 order by id;`,[gallery.id]);if(!images.rows.length){await client.query("rollback");return false;}
    let submission=(await client.query(`select id::int from portal_giveaway_submissions where giveaway_id=$1 and character_id=$2 and entry_number=1 for update;`,[g.id,member.id])).rows[0];
    if(!submission){submission=(await client.query(`insert into portal_giveaway_submissions(giveaway_id,character_id,discord_user_id,character_name_snapshot,title,description,source_kind,source_message_id,gallery_post_id) values($1,$2,$3,$4,'',$5,'discord',$6,$7) returning id::int;`,[g.id,member.id,message.author.id,member.character_name,String(message.content||'').trim(),message.id,gallery.id])).rows[0];}
    else if(String(message.content||'').trim())await client.query(`update portal_giveaway_submissions set description=$2,updated_at=now() where id=$1;`,[submission.id,String(message.content).trim()]);
    const existing=Number((await client.query(`select count(*) from portal_giveaway_submission_images where submission_id=$1;`,[submission.id])).rows[0].count);remaining=Math.max(0,maxPhotos-existing);const accepted=images.rows.slice(0,remaining);acceptedCount=accepted.length;rejected=images.rows.length-accepted.length;
    for(let i=0;i<accepted.length;i++){const image=accepted[i];await client.query(`insert into portal_giveaway_submission_images(submission_id,source_attachment_id,filename,mime_type,image_data,image_size,sort_order) values($1,$2,$3,$4,$5,$6,$7) on conflict do nothing;`,[submission.id,`discord:${message.id}:${image.source_attachment_id}`,image.filename,image.mime_type,image.image_data,image.image_size,(existing+i+1)*10]);}
    await client.query(`insert into portal_giveaway_discord_jobs(giveaway_id,submission_id,job_kind,dedupe_key) values($1,$2,'sync_submission',$3) on conflict(dedupe_key) do update set status='pending',run_after=now(),last_error=null,updated_at=now();`,[g.id,submission.id,`giveaway:${g.id}:${submission.id}:sync_submission:${message.id}`]);await client.query("commit");
  }catch(error){await client.query("rollback").catch(()=>null);throw error;}finally{client.release();}
  if(acceptedCount)await message.react('\u2705').catch(()=>null);if(rejected>0)await message.reply(remaining>0?`Contest entry accepted with ${acceptedCount} new image(s); ${rejected} extra image(s) were not included because the ${maxPhotos}-photo limit was reached.`:`Your contest entry already has the maximum ${maxPhotos} photos, so these images were not added. Manage the entry on the website if you want to replace photos.`).catch(()=>null);return acceptedCount>0;
}


export async function mirrorAutoEnrolledGiveawaySource({message,pool,deleted=false}){
  if(!message?.id)return false;const client=await pool.connect();try{await client.query("begin");const row=(await client.query(`select s.id::int submission_id,s.giveaway_id::int,g.max_photos,g.status,s.gallery_post_id from portal_giveaway_submissions s join portal_giveaways g on g.id=s.giveaway_id where s.source_kind='discord' and s.source_message_id=$1 for update of s;`,[message.id])).rows[0];if(!row){await client.query("rollback");return false;}if(row.status!=="submissions_open"){await client.query("rollback");return false;}if(deleted){await client.query(`update portal_giveaway_submissions set status='withdrawn',updated_at=now() where id=$1;`,[row.submission_id]);await client.query(`insert into portal_giveaway_discord_jobs(giveaway_id,submission_id,job_kind,dedupe_key) values($1,$2,'delete_submission',$3) on conflict(dedupe_key) do update set status='pending',run_after=now(),updated_at=now();`,[row.giveaway_id,row.submission_id,`giveaway:${row.giveaway_id}:${row.submission_id}:delete_submission:source-${message.id}`]);await client.query(`insert into portal_giveaway_audit(giveaway_id,action_type,actor_label,details) values($1,'auto_enroll_source_deleted','Discord source mirror',$2::jsonb);`,[row.giveaway_id,JSON.stringify({submissionId:row.submission_id,messageId:message.id})]);await client.query("commit");return true;}
    const gallery=(await client.query(`select id from portal_community_gallery_posts where source_message_id=$1;`,[message.id])).rows[0];if(!gallery){await client.query("rollback");return false;}await client.query(`update portal_giveaway_submissions set description=$2,status='active',gallery_post_id=$3,updated_at=now() where id=$1;`,[row.submission_id,String(message.content||'').trim(),gallery.id]);await client.query(`delete from portal_giveaway_submission_images where submission_id=$1 and source_attachment_id like $2;`,[row.submission_id,`discord:${message.id}:%`]);await client.query(`insert into portal_giveaway_submission_images(submission_id,source_attachment_id,filename,mime_type,image_data,image_size,sort_order) select $1,'discord:'||$2||':'||source_attachment_id,filename,mime_type,image_data,image_size,row_number() over(order by id)*10 from portal_community_gallery_images where post_id=$3 order by id limit $4;`,[row.submission_id,message.id,gallery.id,Number(row.max_photos)]);await client.query(`insert into portal_giveaway_discord_jobs(giveaway_id,submission_id,job_kind,dedupe_key) values($1,$2,'sync_submission',$3) on conflict(dedupe_key) do update set status='pending',run_after=now(),updated_at=now();`,[row.giveaway_id,row.submission_id,`giveaway:${row.giveaway_id}:${row.submission_id}:sync_submission:source-edit-${message.id}`]);await client.query(`insert into portal_giveaway_audit(giveaway_id,action_type,actor_label,details) values($1,'auto_enroll_source_updated','Discord source mirror',$2::jsonb);`,[row.giveaway_id,JSON.stringify({submissionId:row.submission_id,messageId:message.id})]);await client.query("commit");return true;
  }catch(error){await client.query("rollback").catch(()=>null);throw error;}finally{client.release();}
}
