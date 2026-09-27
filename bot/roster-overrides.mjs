export const validOverrideName = name => /^[\p{L}][\p{L}'’-]* [\p{L}][\p{L}'’-]*$/u.test(name) && name.length <= 64;
export const sameMembership = (row,member) => Number.isFinite(member.joinedTimestamp) &&
  (row.membership_joined_at ? new Date(row.membership_joined_at).getTime() === member.joinedTimestamp
    : member.joinedTimestamp <= new Date(row.created_at).getTime());
export function createRosterOverrides({ pool, bot, settings, isAdmin, primaryAdmin, notify, findCharacter, verify, welcomePost, welcomeGreeting = async () => false, completeOnboarding, audit, isFcVerified = async () => true }) {
  async function ensure() {
    await pool.query(`create table if not exists portal_discord_roster_overrides (
      id bigserial primary key, guild_id text not null, discord_user_id text not null,
      character_name text not null, normalized_name text not null,
      status text not null default 'pending', approved_by text, approved_at timestamptz,
      due_at timestamptz, worker_request_id bigint, last_error text,
      granted_role_id text, role_added boolean not null default false, access_ended_at timestamptz,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      unique(guild_id,discord_user_id,normalized_name));
      create unique index if not exists portal_roster_override_active_name on portal_discord_roster_overrides(guild_id,normalized_name) where status in ('approved','review');
      create unique index if not exists portal_roster_override_active_user on portal_discord_roster_overrides(guild_id,discord_user_id) where status in ('approved','review');`);
    await pool.query("alter table portal_discord_roster_overrides add column if not exists membership_joined_at timestamptz;");
    await pool.query("alter table portal_discord_roster_overrides add column if not exists access_deadline_at timestamptz;");
    await pool.query("alter table portal_discord_roster_overrides add column if not exists check_deadline_at timestamptz;");
    await pool.query("alter table portal_discord_roster_overrides add column if not exists converted_guest_role_id text;");
    await pool.query("alter table portal_discord_roster_overrides add column if not exists retry_after timestamptz;");
  }
  async function retire(row,status) {
    await pool.query("update portal_discord_roster_overrides set status=$2,normalized_name=character_name || ':closed:' || id,updated_at=now() where id=$1",[row.id,status]);
  }
  async function onJoin(member) {
    await pool.query(`update portal_discord_roster_overrides set status='superseded',normalized_name=character_name || ':closed:' || id,updated_at=now()
      where guild_id=$1 and discord_user_id=$2 and membership_joined_at is distinct from $3::timestamptz`,
      [member.guild.id,member.id,new Date(member.joinedTimestamp).toISOString()]);
  }
  async function onLeave(member) {
    await pool.query(`update portal_discord_roster_overrides set status='left',normalized_name=character_name || ':closed:' || id,updated_at=now()
      where guild_id=$1 and discord_user_id=$2`,[member.guild.id,member.id]);
  }
  async function expire(row,member,db=pool) {
    if (!sameMembership(row,member) || row.access_ended_at) return;
    const linked=(await db.query("select 1 from portal_discord_links l join portal_characters c on c.id=l.character_id where l.discord_user_id=$1 and c.active=true and c.fc_membership_status='current' limit 1",[row.discord_user_id])).rows.length;
    if (row.role_added && row.granted_role_id && !linked) await member.roles.remove(row.granted_role_id,"Provisional FC approval expired");
    if (row.converted_guest_role_id) await member.roles.remove(row.converted_guest_role_id,"Cancelled guest access cleanup");
    await db.query("update portal_discord_roster_overrides set access_ended_at=now() where id=$1",[row.id]);
  }
  async function alert(row,message,suffix) {
    const admin = await primaryAdmin();
    await notify({ content: `${admin ? '<@'+admin+'> ' : ''}<@${row.discord_user_id}> — ${row.character_name}: ${message}`,
      allowedMentions: { users: [admin].filter(Boolean) },
      ...(["review","error","grant-error"].includes(suffix) ? {components:[{type:1,components:[
        {type:2,style:1,label:"Retry roster check",custom_id:`cotf_roster_override:${row.id}:retry`},
        {type:2,style:2,label:"Close request",custom_id:`cotf_roster_override:${row.id}:close`}
      ]}]} : {}) }, `roster-override:${row.id}:${suffix}:${row.worker_request_id || row.approved_at || ""}`,true);
  }
  async function offer(member,submitted) {
    if (!await isFcVerified()) return;
    const name = String(submitted).trim().replace(/\s+/g," ");
    if (!validOverrideName(name)) return;
    if (!(await settings()).officer_log_channel_id) return;
    await onJoin(member);
    await pool.query(`update portal_discord_roster_overrides set status='expired',normalized_name=character_name || ':closed:' || id
      where guild_id=$1 and discord_user_id=$2 and status='pending' and created_at<now()-interval '7 days'`,[member.guild.id,member.id]);
    const row = (await pool.query(`insert into portal_discord_roster_overrides(guild_id,discord_user_id,character_name,normalized_name,membership_joined_at)
      values($1,$2,$3,$4,$5) on conflict(guild_id,discord_user_id,normalized_name) do nothing returning *`,
      [member.guild.id,member.id,name,name.toLowerCase(),new Date(member.joinedTimestamp).toISOString()])).rows[0];
    if (!row) return;
    await notify({ content: `Character awaiting roster: **${name}**, Discord <@${member.id}>.
An administrator can approve Discord access with a recheck after 24 hours. Access stays active while the fresh scan runs, for at most one additional hour. If verification fails, only the override-granted role expires; nobody is kicked. This does not create a roster entry or grant website membership.`,
      allowedMentions: { parse: [] },
      components: [{ type:1, components:[{ type:2,style:1,label:"Approve pending roster (24h recheck)",custom_id:`cotf_roster_override:${row.id}` }] }]
    },`roster-override:${row.id}:offer`,true);
  }
  async function protectedAccess(guild,user,joinedTimestamp) {
    // Never kick someone because an administrator-approved recheck is unresolved.
    // This does not retain access: process() expires only the override-granted role.
    if (!Number.isFinite(joinedTimestamp)) return false;
    return Boolean((await pool.query("select 1 from portal_discord_roster_overrides where guild_id=$1 and discord_user_id=$2 and membership_joined_at=$3 and status in ('approved','review') limit 1",[guild,user,new Date(joinedTimestamp).toISOString()])).rows.length);
  }
  async function handle(interaction) {
    await interaction.deferReply({flags:64});
    if (!await isFcVerified()) { await interaction.editReply("Free Company ownership verification is still pending. Roster overrides are paused."); return; }
    const config = await settings();
    if (!await isAdmin(interaction.user.id) || interaction.guildId !== config.guild_id || interaction.channelId !== config.officer_log_channel_id) {
      await interaction.editReply("Only a configured portal administrator may approve this from the bot-log channel."); return;
    }
    const id = interaction.customId.split(":")[1];
    const action = interaction.customId.split(":")[2] || "approve";
    if (!/^\d+$/.test(id)) { await interaction.editReply("Invalid approval."); return; }
    const client = await pool.connect();
    let row;
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock(73019425)");
      row = (await client.query("select * from portal_discord_roster_overrides where id=$1 for update",[id])).rows[0];
      if (!row || row.guild_id !== interaction.guildId) throw new Error("Invalid approval.");
      const member = await interaction.guild.members.fetch(row.discord_user_id);
      if (!sameMembership(row,member)) throw new Error("This request belongs to an earlier server membership. Submit verification again.");
      if (["retry","close"].includes(action)) {
        if (!["review","approved"].includes(row.status)) throw new Error("This request is already closed.");
        if (action==="retry") {
          if(row.status==="approved" && !row.last_error) throw new Error("A roster check is already scheduled.");
          await client.query("update portal_discord_roster_overrides set status='approved',due_at=now(),check_deadline_at=now()+interval '1 hour',worker_request_id=null,last_error=null,retry_after=null,updated_at=now() where id=$1",[id]);
        } else {
          await expire(row,member,client);
          await client.query("update portal_discord_roster_overrides set status='closed',normalized_name=character_name || ':closed:' || id,updated_at=now() where id=$1",[id]);
        }
        await client.query("commit");
        await audit({member,submittedCharacterName:row.character_name,attemptType:"admin_roster_override_"+action,result:"success",reason:"Administrator "+action+" request.",details:{approvedBy:interaction.user.id,overrideId:id}});
        await interaction.editReply(action==="retry" ? "Fresh roster check queued. This does not extend provisional access or replace any corrected character link." : "Request closed. A new verification submission can generate a fresh approval.");
        return;
      }
      if (action!=="approve" || row.status !== "pending" || Date.now()-new Date(row.created_at).getTime()>7*86400000)
        throw new Error("This approval has already been handled or expired.");
      if (member.user.bot) throw new Error("Bot accounts cannot be approved.");
      if ((await pool.query("select 1 from portal_discord_links where discord_user_id=$1 and character_id is not null",[member.id])).rows.length)
        throw new Error("This account already has a character link. Use the existing link-management tools.");
      if (await findCharacter(row.character_name)) throw new Error("The character is now on the roster. Ask the member to verify normally so conflict checks run.");
      if ((await pool.query(`select 1 from portal_discord_links l join portal_characters c on c.id=l.character_id
        where l.discord_user_id<>$1 and regexp_replace(lower(c.character_name),'[^a-z0-9]+','','g')=regexp_replace(lower($2),'[^a-z0-9]+','','g') limit 1`,
        [member.id,row.character_name])).rows.length) throw new Error("Another Discord account already claims this name. Resolve the character-link conflict first.");
      if (!config.verified_role_id) throw new Error("Configure the verified Discord role first.");
      await client.query("update portal_discord_roster_overrides set status='approved',approved_by=$2,approved_at=now(),due_at=now()+interval '24 hours',granted_role_id=$3,role_added=$4,updated_at=now() where id=$1",[id,interaction.user.id,config.verified_role_id,!member.roles.cache.has(config.verified_role_id)]);
      await client.query("update portal_discord_roster_overrides set access_deadline_at=due_at+interval '1 hour',membership_joined_at=$2 where id=$1",[id,new Date(member.joinedTimestamp).toISOString()]);
      await client.query("update portal_discord_roster_overrides set check_deadline_at=access_deadline_at where id=$1",[id]);
      await client.query("update portal_discord_roster_overrides set converted_guest_role_id=$2 where id=$1",
        [id,config.temp_access_role_id && member.roles.cache.has(config.temp_access_role_id) ? config.temp_access_role_id : null]);
      // Cancel guest/onboarding expiry atomically with approval, before any Discord API call.
      await client.query(`update portal_discord_guest_access set status='verified',processed_at=now(),last_error=null,updated_at=now()
        where guild_id=$1 and discord_user_id=$2 and status in ('pending','guest')`, [row.guild_id,row.discord_user_id]);
      await client.query("commit");
      // Keep approval and deadline durable even if Discord permission updates fail.
      try {
        await completeOnboarding(member);
        if (member.manageable) await member.setNickname(row.character_name,"Administrator approved character name");
        else if (member.displayName !== row.character_name) throw new Error("The bot cannot assign the approved character nickname to this member.");
        await member.roles.add(config.verified_role_id,"Administrator approved pending FC roster");
        if (config.temp_access_role_id) await member.roles.remove(config.temp_access_role_id,"Administrator approved pending FC roster");
        if (config.unverified_role_id) await member.roles.remove(config.unverified_role_id,"Administrator approved pending FC roster");
        await welcomeGreeting(member,row.character_name);
        await audit({member,submittedCharacterName:row.character_name,attemptType:"admin_roster_override",result:"success",
          reason:"Provisional Discord approval; roster recheck scheduled in 24 hours.",details:{approvedBy:interaction.user.id,overrideId:id}});
        await alert(row,"approved by <@"+interaction.user.id+">. Recheck scheduled in 24 hours.","approved");
        await interaction.editReply("Approved. Recheck scheduled in 24 hours. Website membership still requires a current roster link.");
      } catch(error) {
        await pool.query("update portal_discord_roster_overrides set last_error=$2 where id=$1",[id,error.message]);
        await alert(row,"approval saved, but Discord updates were incomplete. Check bot permissions and member roles. Recheck remains scheduled.","grant-error");
        await interaction.editReply("Approval saved, but Discord updates were incomplete. Check permissions and roles; the recheck remains scheduled.");
      }
    } catch(error) {
      await client.query("rollback");
      await interaction.editReply(error.code==="23505" ? "Another active approval claims this character or account. Review it first." : error.message);
    } finally { client.release(); }
  }
  let running=false;
  async function process() {
    if (running) return;
    if (!await isFcVerified()) return;
    running=true;
    let client;
    try {
      client=await pool.connect();
      if (!(await client.query("select pg_try_advisory_lock(73019425) as locked")).rows[0].locked) return;
      const due=await pool.query("select * from portal_discord_roster_overrides where status='approved' and due_at<=now() and (retry_after is null or retry_after<=now()) order by due_at limit 25");
      for (const row of due.rows) {
        let member;
        try {
          const guild=await bot.guilds.fetch(row.guild_id);
          try { member=await guild.members.fetch(row.discord_user_id); }
          catch(error) { if(error.code!==10007) throw error; }
          if(!member) {
            await retire(row,"left"); continue;
          }
          if (!sameMembership(row,member)) { await retire(row,"superseded"); continue; }
          const existing=(await pool.query("select character_id,match_source from portal_discord_links where discord_user_id=$1 and character_id is not null",[row.discord_user_id])).rows[0];
          if (existing && existing.match_source!=="roster_override_recheck") {
            await alert(row,"a newer character link already exists. The delayed request was closed without changing that link or roles.","superseded");
            await retire(row,"superseded"); continue;
          }
          const graceOver=Date.now() >= new Date(row.access_deadline_at || new Date(row.due_at).getTime()+3600000).getTime();
          const checkOver=Date.now() >= new Date(row.check_deadline_at || row.access_deadline_at || new Date(row.due_at).getTime()+3600000).getTime();
          if (graceOver) await expire(row,member);
          if (!row.worker_request_id) {
            if (checkOver) {
              await expire(row,member);
              await alert(row,"roster refresh did not start before the bounded access deadline. Retry or close this request.","review");
              await pool.query("update portal_discord_roster_overrides set status='review',updated_at=now() where id=$1",[row.id]);
              continue;
            }
            const queued=await pool.query("insert into portal_worker_requests(request_type,requested_by) values('fc_roster_scan','Discord provisional verification') on conflict do nothing returning id");
            const request=queued.rows[0] || (await pool.query("select id from portal_worker_requests where request_type='fc_roster_scan' and status='pending' order by id limit 1")).rows[0];
            if (request) await pool.query("update portal_discord_roster_overrides set worker_request_id=$2 where id=$1",[row.id,request.id]);
            continue;
          }
          const request=(await pool.query("select status from portal_worker_requests where id=$1",[row.worker_request_id])).rows[0];
          if (request && ["pending","running"].includes(request.status)) {
            if (!checkOver) continue;
            await expire(row,member);
            await alert(row,"roster refresh has not finished. Provisional access expired; admin review needed.","review");
          } else if (!request || request.status!=="completed") {
            await expire(row,member);
            await alert(row,"roster refresh failed. Provisional access expired; admin review needed.","review");
          } else {
            const result=await verify({member,submittedCharacterName:row.character_name,attemptType:"roster_override_recheck",matchSource:"roster_override_recheck"});
            if(result.ok) {
              if (!await welcomePost(member,result.character)) throw new Error("Verified, but the welcome image could not be posted. Will retry.");
              await retire(row,"completed");
              await alert(row,"successfully verified against the refreshed FC roster.","completed"); continue;
            }
            await expire(row,member);
            await alert(row,"still unverified after the 24-hour recheck. Provisional access expired; review name, roster, and character links.","review");
          }
          await pool.query("update portal_discord_roster_overrides set status='review',updated_at=now() where id=$1",[row.id]);
        } catch(error) {
          await pool.query("update portal_discord_roster_overrides set last_error=$2,retry_after=now()+interval '5 minutes' where id=$1",[row.id,error.message]);
          if (member && Date.now() >= new Date(row.access_deadline_at || new Date(row.due_at).getTime()+3600000).getTime()) {
            try { await expire(row,member); } catch(cleanupError) { console.error("[roster-override] Access cleanup failed:",cleanupError.message); }
          }
          await alert(row,"recheck encountered an error and will retry. Admin review may be needed.","error");
        }
      }
    } finally {
      if(client) { await client.query("select pg_advisory_unlock(73019425)").catch(()=>{}); client.release(); }
      running=false;
    }
  }
  function start() {
    const tick=()=>process().catch(error=>console.error("[roster-override]",error.message));
    tick(); setInterval(tick,60000);
  }
  return {ensure,offer,handle,protectedAccess,start,process,onJoin,onLeave};
}
