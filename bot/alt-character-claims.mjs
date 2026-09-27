import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags,
  ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle
} from "discord.js";
import { createHmac, randomBytes } from "node:crypto";
import { DISCORD_COMMAND_NAME, GUILD_NAME, PORTAL_ACCENT_COLOR, PORTAL_URL } from "./installation-config.mjs";

export const WORLDS_BY_DATA_CENTER = {
  Aether:["Adamantoise","Cactuar","Faerie","Gilgamesh","Jenova","Midgardsormr","Sargatanas","Siren"],
  Crystal:["Balmung","Brynhildr","Coeurl","Diabolos","Goblin","Malboro","Mateus","Zalera"],
  Dynamis:["Cuchulainn","Golem","Halicarnassus","Kraken","Maduin","Marilith","Rafflesia","Seraph"],
  Primal:["Behemoth","Excalibur","Exodus","Famfrit","Hyperion","Lamia","Leviathan","Ultros"],
  Chaos:["Cerberus","Louisoix","Moogle","Omega","Phantom","Ragnarok","Sagittarius","Spriggan"],
  Light:["Alpha","Lich","Odin","Phoenix","Raiden","Shiva","Twintania","Zodiark"],
  Materia:["Bismarck","Ravana","Sephirot","Sophia","Zurvan"],
  Elemental:["Aegis","Atomos","Carbuncle","Garuda","Gungnir","Kujata","Tonberry","Typhon"],
  Gaia:["Alexander","Bahamut","Durandal","Fenrir","Ifrit","Ridill","Tiamat","Ultima"],
  Mana:["Anima","Asura","Chocobo","Hades","Ixion","Masamune","Pandaemonium","Titan"],
  Meteor:["Belias","Mandragora","Ramuh","Shinryu","Unicorn","Valefor","Yojimbo","Zeromus"]
};

const row=(...components)=>new ActionRowBuilder().addComponents(...components);
const card=(title,description)=>new EmbedBuilder().setColor(PORTAL_ACCENT_COLOR).setTitle(title).setDescription(description);
const updateInteraction=(interaction,payload)=>interaction.deferred||interaction.replied?interaction.editReply(payload):interaction.update(payload);
const clean=s=>String(s||"").replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();
export const normalizeVerificationCode=value=>String(value||"").trim().toUpperCase();
const codeDigest=(secret,code)=>createHmac("sha256",secret).update(normalizeVerificationCode(code)).digest("hex");
const profileUrl=id=>`https://na.finalfantasyxiv.com/lodestone/character/${id}/`;
let worldDirectoryCache={expiresAt:0,value:WORLDS_BY_DATA_CENTER};
export function parseLodestoneWorldDirectory(html){const parsed={};for(const block of String(html||"").split(/<li class="world-dcgroup__item">/i).slice(1)){const dc=clean(block.match(/world-dcgroup__header">([\s\S]*?)<\/h2>/i)?.[1]);if(!dc)continue;const worlds=[...block.matchAll(/world-list__world_name">[\s\S]*?<p>([\s\S]*?)<\/p>/gi)].map(match=>clean(match[1])).filter(Boolean);if(worlds.length)parsed[dc]=[...new Set(worlds)];}return parsed;}
async function getWorldDirectory(){if(worldDirectoryCache.expiresAt>Date.now())return worldDirectoryCache.value;try{const parsed=parseLodestoneWorldDirectory(await fetchText("https://na.finalfantasyxiv.com/lodestone/worldstatus/"));if(Object.keys(parsed).length>=4)worldDirectoryCache={expiresAt:Date.now()+6*60*60*1000,value:parsed};}catch{}return worldDirectoryCache.value;}

export async function ensureAltCharacterTables(db){
  await db.query(`alter table portal_discord_bot_settings add column if not exists alt_character_claims_enabled boolean not null default false, add column if not exists alt_character_default_limit integer not null default 1, add column if not exists alt_character_verification_mode text not null default 'code_or_officer', add column if not exists alt_character_code_expiry_minutes integer not null default 60;`);
  await db.query(`create table if not exists portal_alt_character_limits(discord_user_id text primary key,max_additional_characters integer not null check(max_additional_characters between 0 and 32),updated_by_discord_user_id text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());`);
  await db.query(`create table if not exists portal_alt_character_links(id bigserial primary key,discord_user_id text not null,character_id bigint not null references portal_characters(id) on delete cascade,is_primary boolean not null default false,verification_method text not null,verified_by_discord_user_id text,verified_at timestamptz not null default now(),active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(discord_user_id,character_id));`);
  await db.query(`create unique index if not exists portal_alt_character_one_owner_idx on portal_alt_character_links(character_id) where active=true;`);
  await db.query(`create or replace function portal_reject_duplicate_alt_character_link() returns trigger language plpgsql as $$ begin if new.active=false then return new; end if; perform pg_advisory_xact_lock(new.character_id::bigint); if exists(select 1 from portal_discord_links dl where dl.character_id=new.character_id) then raise exception 'Character % is already a Free Company membership anchor and cannot also be an additional character.',new.character_id using errcode='23505',constraint='portal_character_cross_owner'; end if; return new; end; $$; drop trigger if exists portal_alt_character_links_cross_owner on portal_alt_character_links; create trigger portal_alt_character_links_cross_owner before insert or update of character_id,discord_user_id,active on portal_alt_character_links for each row execute function portal_reject_duplicate_alt_character_link();`);
  await db.query(`update portal_alt_character_links acl set active=false,is_primary=false,updated_at=now() where acl.active=true and exists(select 1 from portal_discord_links dl where dl.character_id=acl.character_id);`);
  await db.query(`update portal_characters c set role='Alt' where exists(select 1 from portal_alt_character_links acl where acl.character_id=c.id and acl.active=true) and c.role<>'Alt';`);
  await db.query(`create table if not exists portal_alt_character_claims(id bigserial primary key,discord_user_id text not null,lodestone_character_id text not null,character_name text not null,world text not null,data_center text not null,status text not null default 'pending',code_digest text,code_expires_at timestamptz,officer_message_id text,officer_channel_id text,resolution_method text,resolved_by_discord_user_id text,resolved_at timestamptz,rejection_reason text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());`);
  await db.query(`create unique index if not exists portal_alt_character_pending_idx on portal_alt_character_claims(discord_user_id,lodestone_character_id) where status in ('pending','code_required');`);
  await db.query(`create index if not exists portal_alt_links_user_idx on portal_alt_character_links(discord_user_id,active);`);
}

async function fetchText(url){
  const response=await fetch(url,{headers:{"user-agent":"FC-Portal/1.0 (character claim verification)"},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`Lodestone returned HTTP ${response.status}.`);
  return response.text();
}
export async function searchLodestoneCharacter(name,world){
  const query=new URLSearchParams({q:name,worldname:world});
  const html=await fetchText(`https://na.finalfantasyxiv.com/lodestone/character/?${query}`);
  const candidates=[...html.matchAll(/href="\/lodestone\/character\/(\d+)\/"[\s\S]{0,1800}?entry__name[^>]*>([\s\S]*?)<\/[ap]>[\s\S]{0,1800}?entry__world[^>]*>([\s\S]*?)<\/[ap]>/gi)];
  const wanted=clean(name).toLowerCase(),wantedWorld=world.toLowerCase();
  for(const match of candidates){const foundName=clean(match[2]),foundWorld=clean(match[3]).replace(/[()]/g,"");if(foundName.toLowerCase()===wanted&&foundWorld.toLowerCase().includes(wantedWorld))return{id:match[1],name:foundName,world};}
  const fallback=[...html.matchAll(/\/lodestone\/character\/(\d+)\//g)].map(m=>m[1]);
  if(fallback.length===1)return{id:fallback[0],name:clean(name),world};
  return null;
}

export function createAltCharacterClaims({pool,bot,getSettings,isAdmin,isFcVerified=async()=>true}){
  const secret=String(process.env.PRIVACY_SUPPRESSION_SECRET||process.env.AUTH_SECRET||process.env.DISCORD_BOT_TOKEN||"");
  const isOfficer=async interaction=>Boolean(await isAdmin(interaction.user.id)||interaction.memberPermissions?.has("ManageGuild"));
  async function settings(){await ensureAltCharacterTables(pool);const result=await pool.query(`select guild_id,alt_character_claims_enabled,alt_character_default_limit,alt_character_verification_mode,alt_character_code_expiry_minutes,officer_log_channel_id from portal_discord_bot_settings where id=1`);return result.rows[0]||{};}
  async function anchor(userId){return(await pool.query(`select c.id,c.character_name,c.world,c.active,c.fc_membership_status from portal_discord_links dl join portal_characters c on c.id=dl.character_id where dl.discord_user_id=$1 limit 1`,[userId])).rows[0]||null;}
  function nicknameChoice(linked){return{embeds:[card("Additional character linked",`**${linked.character_name} · ${linked.world}** is linked and queued for collection scans. Your FC membership character remains the access anchor.\n\nWould you like to update your nickname in Discord? Your chosen Discord name will be used as the default character when you log in at [${PORTAL_URL}](${PORTAL_URL}).`)],components:[row(new ButtonBuilder().setCustomId(`altchar:nickname:${linked.characterId}`).setLabel("Yes, Update Nickname").setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId(`altchar:keep-nickname:${linked.characterId}`).setLabel("No, Keep Current Nickname").setStyle(ButtonStyle.Secondary))]};}
  async function expireStaleClaims(userId=null){const params=userId?[userId]:[];const expired=await pool.query(`update portal_alt_character_claims set status='expired',resolved_at=now(),rejection_reason='Required profile verification window expired',updated_at=now() where status='code_required' and code_expires_at is not null and code_expires_at<=now()${userId?" and discord_user_id=$1":""} returning *`,params);for(const claim of expired.rows)await finishOfficerMessage(claim,"Claim expired before the required profile-code verification.");await pool.query(`update portal_alt_character_claims set code_digest=null,code_expires_at=null,rejection_reason='Optional profile code expired; officer approval remains available',updated_at=now() where status='pending' and code_expires_at is not null and code_expires_at<=now()${userId?" and discord_user_id=$1":""}`,params);}
  async function capState(client,userId,lock=false){if(lock)await client.query(`select pg_advisory_xact_lock(hashtext($1))`,[`alt-character:${userId}`]);const s=(await client.query(`select s.alt_character_default_limit,coalesce(l.max_additional_characters,s.alt_character_default_limit) max_count from portal_discord_bot_settings s left join portal_alt_character_limits l on l.discord_user_id=$1 where s.id=1`,[userId])).rows[0]||{max_count:1};const counts=(await client.query(`select (select count(*) from portal_alt_character_links where discord_user_id=$1 and active=true)::int active,(select count(*) from portal_alt_character_claims where discord_user_id=$1 and status in('pending','code_required'))::int pending`,[userId])).rows[0];return{max:Number(s.max_count||0),active:Number(counts.active||0),pending:Number(counts.pending||0)};}
  async function command(interaction){
    await interaction.deferReply({flags:MessageFlags.Ephemeral});
    if(!await isFcVerified())return interaction.editReply({embeds:[card("Free Company verification pending","An officer must complete the Lodestone Free Company ownership check before additional-character claims can be used.")]});
    const s=await settings(),a=await anchor(interaction.user.id);
    if(!a?.active||a.fc_membership_status!=="current")return interaction.editReply({embeds:[card("Current FC verification required",`Additional characters are attached to a current ${GUILD_NAME} membership anchor. Complete the normal FC verification first.`)]});
    await expireStaleClaims(interaction.user.id);
    const links=(await pool.query(`select l.character_id::int,c.character_name,c.world,l.is_primary,l.verification_method from portal_alt_character_links l join portal_characters c on c.id=l.character_id where l.discord_user_id=$1 and l.active=true order by l.is_primary desc,lower(c.character_name)`,[interaction.user.id])).rows;
    const pending=(await pool.query(`select id::int,character_name,world,status,code_expires_at from portal_alt_character_claims where discord_user_id=$1 and status in('pending','code_required') order by created_at desc limit 25`,[interaction.user.id])).rows;
    const cap=await capState(pool,interaction.user.id);
    const lines=[`FC membership anchor: **${a.character_name} · ${a.world}**`,links.length?`Linked: ${links.map(x=>`**${x.character_name} · ${x.world}**`).join(", ")}`:"No additional characters are linked.",pending.length?`Pending: ${pending.map(x=>`**${x.character_name} · ${x.world}**`).join(", ")}`:"",`Capacity: ${cap.active} linked + ${cap.pending} pending of ${cap.max}`].filter(Boolean);
    if(!s.alt_character_claims_enabled)lines.push("New claims are disabled. Existing links remain available and can be removed below.");
    else if(cap.active+cap.pending>=cap.max)lines.push("The additional-character limit is currently reached. Cancel a pending request, remove a link, or ask an officer to adjust the limit.");
    else lines.push("Choose a data center below to add another character.");
    const components=[];
    if(links.length)components.push(row(new StringSelectMenuBuilder().setCustomId("altchar:unlink-select").setPlaceholder("Remove a linked character").addOptions(links.slice(0,25).map(x=>({label:`${x.character_name} · ${x.world}`,value:String(x.character_id),description:"Stops scans and removes this additional-character link"})))));
    if(pending.length)components.push(row(new StringSelectMenuBuilder().setCustomId("altchar:cancel-select").setPlaceholder("Cancel a pending character claim").addOptions(pending.map(x=>({label:`${x.character_name} · ${x.world}`,value:String(x.id),description:"Cancel this pending request"})))));
    if(s.alt_character_claims_enabled&&cap.active+cap.pending<cap.max){const directory=await getWorldDirectory();components.push(row(new StringSelectMenuBuilder().setCustomId("altchar:dc").setPlaceholder("Choose a data center").addOptions(Object.keys(directory).slice(0,25).map(value=>({label:value,value})))));}
    return interaction.editReply({embeds:[card("Additional characters",lines.join("\n\n"))],components});
  }
  async function sendOfficerClaim(claim,interaction,s){
    if(!s.officer_log_channel_id)return false;
    const channel=await bot.channels.fetch(s.officer_log_channel_id).catch(()=>null);if(!channel?.isTextBased())return;
    const message=await channel.send({embeds:[card("Additional character claim pending",`**Discord member:** <@${claim.discord_user_id}>\n**Character:** ${claim.character_name} · ${claim.world} (${claim.data_center})\n**Lodestone ID:** ${claim.lodestone_character_id}\n\nApprove immediately, reject, or require the member to complete profile-code verification.`)],components:[row(new ButtonBuilder().setCustomId(`altchar:approve:${claim.id}`).setLabel("Approve and Link").setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId(`altchar:reject:${claim.id}`).setLabel("Reject").setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId(`altchar:require-code:${claim.id}`).setLabel("Require Profile Code").setStyle(ButtonStyle.Secondary),new ButtonBuilder().setLabel("Open Lodestone Profile").setStyle(ButtonStyle.Link).setURL(profileUrl(claim.lodestone_character_id))) ]}).catch(()=>null);
    if(!message)return false;
    await pool.query(`update portal_alt_character_claims set officer_message_id=$1,officer_channel_id=$2 where id=$3`,[message.id,message.channelId,claim.id]);
    return true;
  }
  async function createClaim(interaction,id,dc,world){
    const s=await settings();if(!s.alt_character_claims_enabled)throw new Error("Additional-character claims were disabled while this panel was open.");
    if(s.alt_character_verification_mode==="officer_only"&&!s.officer_log_channel_id)throw new Error("Officer-only claims require an Officer Log Channel. Ask an officer to configure one first.");
    const a=await anchor(interaction.user.id);if(!a?.active||a.fc_membership_status!=="current")throw new Error("Current FC verification is required.");
    const html=await fetchText(profileUrl(id));const title=clean(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||"");const name=title.split(" | ")[0].replace(/FINAL FANTASY XIV.*$/i,"").trim()||`Character ${id}`;
    const code=`${DISCORD_COMMAND_NAME}-${randomBytes(2).toString("hex")}-${randomBytes(2).toString("hex")}`.toUpperCase();
    const codeAllowed=s.alt_character_verification_mode!=="officer_only";
    await expireStaleClaims(interaction.user.id);
    const client=await pool.connect();let claim;
    try{
      await client.query("begin");
      const pending=(await client.query(`select id from portal_alt_character_claims where discord_user_id=$1 and lodestone_character_id=$2 and status in('pending','code_required') limit 1`,[interaction.user.id,id])).rows[0];
      if(pending)throw new Error("You already have a pending claim for this character. Run the character command again to check or cancel the existing request.");
      const cap=await capState(client,interaction.user.id,true);
      if(cap.active+cap.pending>=cap.max)throw new Error(`Your limit of ${cap.max} additional character(s) has been reached.`);
      const existing=(await client.query(`select c.id,dl.discord_user_id direct_owner,acl.discord_user_id alt_owner from portal_characters c left join portal_discord_links dl on dl.character_id=c.id left join portal_alt_character_links acl on acl.character_id=c.id and acl.active=true where c.lodestone_character_id=$1 limit 1`,[id])).rows[0];
      if(existing?.direct_owner===interaction.user.id)throw new Error("That is already your FC membership character.");
      if(existing?.alt_owner===interaction.user.id)throw new Error("That additional character is already linked to your account.");
      if((existing?.direct_owner&&existing.direct_owner!==interaction.user.id)||(existing?.alt_owner&&existing.alt_owner!==interaction.user.id))throw new Error("That character is already linked to another Discord member.");
      claim=(await client.query(`insert into portal_alt_character_claims(discord_user_id,lodestone_character_id,character_name,world,data_center,status,code_digest,code_expires_at) values($1,$2,$3,$4,$5,'pending',$6,case when $7 then now()+make_interval(mins=>$8) else null end) on conflict(discord_user_id,lodestone_character_id) where status in('pending','code_required') do nothing returning *`,[interaction.user.id,id,name,world,dc,codeAllowed?codeDigest(secret,code):null,codeAllowed,Math.max(10,Math.min(1440,Number(s.alt_character_code_expiry_minutes||60)))])).rows[0];
      if(!claim)throw new Error("You already have a pending claim for this character. Run the character command again to check or cancel the existing request.");
      await client.query("commit");
    }catch(error){await client.query("rollback");throw error;}finally{client.release();}
    const officerMessageSent=await sendOfficerClaim(claim,interaction,s);
    if(!officerMessageSent&&s.alt_character_verification_mode==="officer_only"){
      await pool.query(`update portal_alt_character_claims set status='cancelled',resolved_at=now(),rejection_reason='Officer log delivery failed',updated_at=now() where id=$1 and status='pending'`,[claim.id]);
      throw new Error("The officer log could not receive this request. No claim was left pending; ask an officer to check the configured channel and bot permissions.");
    }
    const description=codeAllowed?`An officer can approve this claim now, or add the following one-time code anywhere in the public text of the Lodestone profile and press **Check Profile Code**. Matching is not case-sensitive.\n\n**${code}**\n\nThe code expires <t:${Math.floor(new Date(claim.code_expires_at).getTime()/1000)}:R>. Remove it after verification.`:"This installation requires officer approval. The request is now in the officer log.";
    await updateInteraction(interaction,{embeds:[card(`Claim requested: ${name}`,description)],components:[row(new ButtonBuilder().setCustomId(`altchar:check:${claim.id}`).setLabel("Check Profile Code").setStyle(ButtonStyle.Primary).setDisabled(!codeAllowed),new ButtonBuilder().setCustomId(`altchar:cancel:${claim.id}`).setLabel("Cancel Claim").setStyle(ButtonStyle.Secondary),new ButtonBuilder().setLabel("Open Lodestone Profile").setStyle(ButtonStyle.Link).setURL(profileUrl(id)))]});
  }
  async function resolveClaim(claimId,method,resolvedBy){
    const client=await pool.connect();let result;
    try{
      await client.query("begin");
      const claim=(await client.query(`select * from portal_alt_character_claims where id=$1 for update`,[claimId])).rows[0];
      if(!claim||!["pending","code_required"].includes(claim.status))throw new Error("This claim has already been resolved.");
      if(method==="officer_approved"&&claim.status==="code_required")throw new Error("This claim now requires the member's Lodestone profile code and cannot be officer-approved.");
      if(method!=="officer_approved"&&claim.code_expires_at&&new Date(claim.code_expires_at)<=new Date())throw new Error("This profile-verification code has expired. The member must request a new code.");
      const a=await client.query(`select c.id,c.active,c.fc_membership_status from portal_discord_links dl join portal_characters c on c.id=dl.character_id where dl.discord_user_id=$1 limit 1`,[claim.discord_user_id]);
      if(!a.rows[0]?.active||a.rows[0].fc_membership_status!=="current")throw new Error("The member no longer has a current FC membership anchor.");
      const cap=await capState(client,claim.discord_user_id,true);
      if(cap.active>=cap.max)throw new Error(`The member has reached the limit of ${cap.max} additional character(s).`);
      let character=(await client.query(`select id from portal_characters where lodestone_character_id=$1 limit 1`,[claim.lodestone_character_id])).rows[0];
      if(!character)character=(await client.query(`insert into portal_characters(display_name,character_name,world,lodestone_character_id,ffxiv_collect_character_id,role,active,fc_membership_status,sync_status,mount_win_notifications_enabled,updated_at) values($1,$1,$2,$3,$3,'Alt',true,'linked_external','pending',true,now()) returning id`,[claim.character_name,claim.world,claim.lodestone_character_id])).rows[0];
      const alreadyLinked=(await client.query(`select verification_method,verified_by_discord_user_id from portal_alt_character_links where discord_user_id=$1 and character_id=$2 and active=true limit 1`,[claim.discord_user_id,character.id])).rows[0];
      if(alreadyLinked){
        await client.query(`update portal_alt_character_claims set status='approved',resolution_method='duplicate_existing_link',resolved_by_discord_user_id=$2,resolved_at=now(),rejection_reason='Character was already linked; original verification retained.',updated_at=now() where id=$1`,[claimId,resolvedBy]);
        await client.query("commit");
        return {...claim,characterId:Number(character.id),alreadyLinked:true,originalVerificationMethod:alreadyLinked.verification_method};
      }
      const occupied=await client.query(`select discord_user_id from portal_alt_character_links where character_id=$1 and active=true and discord_user_id<>$2 union all select discord_user_id from portal_discord_links where character_id=$1 and discord_user_id<>$2`,[character.id,claim.discord_user_id]);
      if(occupied.rows.length)throw new Error("That character was linked to another member while this request was pending.");
      await client.query(`insert into portal_alt_character_links(discord_user_id,character_id,verification_method,verified_by_discord_user_id) values($1,$2,$3,$4) on conflict(discord_user_id,character_id) do update set active=true,verification_method=excluded.verification_method,verified_by_discord_user_id=excluded.verified_by_discord_user_id,verified_at=now(),updated_at=now()`,[claim.discord_user_id,character.id,method,resolvedBy]);
      await client.query(`update portal_characters set role='Alt',active=true,updated_at=now() where id=$1`,[character.id]);
      await client.query(`update portal_alt_character_claims set status='approved',resolution_method=$2,resolved_by_discord_user_id=$3,resolved_at=now(),updated_at=now() where id=$1`,[claimId,method,resolvedBy]);
      await client.query("commit");
      result={...claim,characterId:Number(character.id)};
    }catch(error){await client.query("rollback");throw error;}finally{client.release();}
    return result;
  }
  async function finishOfficerMessage(claim,text){
    if(!claim?.officer_message_id||!claim?.officer_channel_id)return false;
    let lastError=null;
    for(let attempt=1;attempt<=3;attempt+=1){
      try{
        const channel=await bot.channels.fetch(claim.officer_channel_id);
        if(!channel?.isTextBased()||!channel.messages)throw new Error("Officer log channel is unavailable.");
        const message=await channel.messages.fetch(claim.officer_message_id);
        await message.edit({content:text,components:[]});
        return true;
      }catch(error){lastError=error;if(attempt<3)await new Promise(resolve=>setTimeout(resolve,500*attempt));}
    }
    console.warn(`[cotf-bot] Could not finalize additional-character officer message ${claim.officer_message_id}:`,lastError?.message||lastError);
    return false;
  }
  function completedClaimText(claim){if(claim.status==="approved")return `Claim already completed through ${String(claim.resolution_method||"verification").replaceAll("_"," ")}.`;if(claim.status==="rejected")return "Claim already rejected.";if(claim.status==="cancelled")return "Claim already cancelled.";if(claim.status==="expired")return "Claim already expired.";return `Claim is already ${claim.status}.`;}
  async function handle(interaction){
    if(!(interaction.isButton()||interaction.isStringSelectMenu()||interaction.isModalSubmit())||!interaction.customId.startsWith("altchar:"))return false;
    if(!await isFcVerified()){await updateInteraction(interaction,{content:"Free Company ownership verification is still pending. Additional-character actions are paused.",embeds:[],components:[]});return true;}
    try{
      if(interaction.customId==="altchar:dc"){await interaction.deferUpdate();const dc=interaction.values[0],worlds=(await getWorldDirectory())[dc]||[];if(!worlds.length)throw new Error("That data center is no longer available. Run the character command again.");await updateInteraction(interaction,{embeds:[card("Choose the character world",`Data center: **${dc}**`)],components:[row(new StringSelectMenuBuilder().setCustomId(`altchar:world:${dc}`).setPlaceholder("Choose a world").addOptions(worlds.slice(0,25).map(value=>({label:value,value}))))]});return true;}
      if(interaction.customId.startsWith("altchar:world:")){const dc=interaction.customId.split(":")[2],world=interaction.values[0],directory=await getWorldDirectory();if(!directory[dc]?.includes(world))throw new Error("That world is no longer available. Run the character command again.");const modal=new ModalBuilder().setCustomId(`altchar:name:${dc}:${world}`).setTitle("Find an FFXIV character").addComponents(row(new TextInputBuilder().setCustomId("character_name").setLabel("Full first and last name").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(40)));await interaction.showModal(modal);return true;}
      if(interaction.customId.startsWith("altchar:name:")){const [, ,dc,world]=interaction.customId.split(":");await interaction.deferReply({flags:MessageFlags.Ephemeral});const name=interaction.fields.getTextInputValue("character_name").trim();if(!/^\S+\s+\S+/.test(name))throw new Error("Enter the complete first and last character name.");const found=await searchLodestoneCharacter(name,world);if(!found)return void await interaction.editReply({embeds:[card("Character not found",`No exact **${name} · ${world}** result was found on the Lodestone. Check the spelling and try again.`)]});await interaction.editReply({embeds:[card("Confirm this character",`**${found.name} · ${found.world}**\n${dc}\nLodestone ID: ${found.id}`)],components:[row(new ButtonBuilder().setCustomId(`altchar:claim:${found.id}:${dc}:${world}`).setLabel("Claim This Character").setStyle(ButtonStyle.Primary),new ButtonBuilder().setLabel("Open Lodestone Profile").setStyle(ButtonStyle.Link).setURL(profileUrl(found.id)))]});return true;}
      if(interaction.customId.startsWith("altchar:claim:")){const [, ,id,dc,world]=interaction.customId.split(":");await interaction.deferUpdate();await createClaim(interaction,id,dc,world);return true;}
      if(interaction.customId==="altchar:cancel-select"){
        await interaction.deferUpdate();
        const id=Number(interaction.values[0]);const claim=(await pool.query(`select * from portal_alt_character_claims where id=$1 and discord_user_id=$2`,[id,interaction.user.id])).rows[0];
        if(!claim)throw new Error("That pending claim is no longer available.");
        await pool.query(`update portal_alt_character_claims set status='cancelled',resolved_at=now(),updated_at=now() where id=$1 and discord_user_id=$2 and status in('pending','code_required')`,[id,interaction.user.id]);
        await finishOfficerMessage(claim,"Claim cancelled by the member.");
        await updateInteraction(interaction,{content:"The pending additional-character claim was cancelled.",embeds:[],components:[]});return true;
      }
      if(interaction.customId==="altchar:unlink-select"){
        await interaction.deferUpdate();
        const characterId=Number(interaction.values[0]);const client=await pool.connect();let linked;
        try{await client.query("begin");linked=(await client.query(`select c.character_name,c.world from portal_alt_character_links l join portal_characters c on c.id=l.character_id where l.discord_user_id=$1 and l.character_id=$2 and l.active=true for update`,[interaction.user.id,characterId])).rows[0];if(!linked)throw new Error("That linked character is no longer available.");await client.query(`update portal_alt_character_links set active=false,is_primary=false,updated_at=now() where discord_user_id=$1 and character_id=$2`,[interaction.user.id,characterId]);await client.query(`update portal_characters c set active=false,fc_membership_status='unlinked_external',sync_status='unlinked_external',updated_at=now() where c.id=$1 and c.fc_membership_status='linked_external' and not exists(select 1 from portal_alt_character_links l where l.character_id=c.id and l.active=true) and not exists(select 1 from portal_discord_links dl where dl.character_id=c.id)`,[characterId]);await client.query("commit");}catch(error){await client.query("rollback");throw error;}finally{client.release();}
        await updateInteraction(interaction,{content:`**${linked.character_name} · ${linked.world}** was unlinked. Its additional-character scans are stopped.`,embeds:[],components:[]});return true;
      }
      const [,action,idText]=interaction.customId.split(":");const id=Number(idText);
      if(["nickname","cancel","check","approve","reject","require-code"].includes(action))await interaction.deferUpdate();
      if(action==="nickname"){const linked=(await pool.query(`select c.character_name from portal_alt_character_links l join portal_characters c on c.id=l.character_id where l.discord_user_id=$1 and l.character_id=$2 and l.active=true`,[interaction.user.id,id])).rows[0];if(!linked)throw new Error("That linked character is not available.");const s=await settings(),guild=await bot.guilds.fetch(s.guild_id),member=await guild.members.fetch(interaction.user.id);await member.setNickname(linked.character_name,"Member chose a verified linked character nickname");await pool.query(`update portal_discord_links set discord_nickname=$2,discord_display_name=$2,updated_at=now() where discord_user_id=$1`,[interaction.user.id,linked.character_name]);await updateInteraction(interaction,{content:`Your Discord nickname is now **${linked.character_name}**. It will also be your default character when you log in to the portal.`,embeds:[],components:[]});return true;}
      if(action==="keep-nickname"){const linked=(await pool.query(`select 1 from portal_alt_character_links where discord_user_id=$1 and character_id=$2 and active=true`,[interaction.user.id,id])).rows[0];if(!linked)throw new Error("That linked character is not available.");await interaction.update({content:"Your additional character remains linked. Your Discord nickname was not changed, and the character matching your current Discord name remains the portal default.",embeds:[],components:[]});return true;}
      const claim=(await pool.query(`select * from portal_alt_character_claims where id=$1`,[id])).rows[0];if(!claim)throw new Error("That claim no longer exists.");
      if(action==="cancel"){if(claim.discord_user_id!==interaction.user.id)throw new Error("Only the requesting member can cancel this claim.");await pool.query(`update portal_alt_character_claims set status='cancelled',resolved_at=now(),updated_at=now() where id=$1 and status in('pending','code_required')`,[id]);await finishOfficerMessage(claim,"Claim cancelled by the member.");await updateInteraction(interaction,{content:"The additional-character claim was cancelled.",embeds:[],components:[]});return true;}
      if(action==="check"){if(claim.discord_user_id!==interaction.user.id)throw new Error("Only the requesting member can check this code.");if(!claim.code_expires_at||new Date(claim.code_expires_at)<=new Date()){if(claim.status==="code_required"){await pool.query(`update portal_alt_character_claims set status='expired',resolved_at=now(),rejection_reason='Required profile verification window expired',updated_at=now() where id=$1 and status='code_required'`,[id]);await finishOfficerMessage(claim,"Claim expired before the required profile-code verification.");throw new Error("That required profile code has expired. Run the character command to start a new claim.");}await pool.query(`update portal_alt_character_claims set code_digest=null,code_expires_at=null,rejection_reason='Optional profile code expired; officer approval remains available',updated_at=now() where id=$1 and status='pending'`,[id]);throw new Error("That profile code has expired, but the pending officer approval remains available. Cancel and restart the claim if you want a new code.");}const html=await fetchText(profileUrl(claim.lodestone_character_id));const candidates=html.match(new RegExp(`${DISCORD_COMMAND_NAME}-[A-Z0-9]+-[A-Z0-9]+`,"ig"))||[];if(!candidates.some(value=>codeDigest(secret,value)===claim.code_digest))throw new Error("The matching code is not visible on the public Lodestone profile yet. Profile updates can take a moment; check the code and retry.");const linked=await resolveClaim(id,"self_service_profile_code",interaction.user.id);await finishOfficerMessage(claim,linked.alreadyLinked?"Duplicate claim closed; the existing verified link was retained.":"Claim completed through the member's Lodestone profile code.");await updateInteraction(interaction,nicknameChoice(linked));return true;}
      if(!await isOfficer(interaction))throw new Error("Only a portal administrator or Discord officer with Manage Server permission can resolve this claim.");
      if(!["pending","code_required"].includes(claim.status)){await updateInteraction(interaction,{content:completedClaimText(claim),embeds:interaction.message.embeds,components:[]});return true;}
      if(action==="approve"){const linked=await resolveClaim(id,"officer_approved",interaction.user.id);if(linked.alreadyLinked){await updateInteraction(interaction,{content:`${linked.character_name} was already linked to <@${linked.discord_user_id}>. This duplicate request is closed; its original ${String(linked.originalVerificationMethod||"verification").replaceAll("_"," ")} record was retained.`,embeds:interaction.message.embeds,components:[]});return true;}const member=await interaction.guild?.members.fetch(linked.discord_user_id).catch(()=>null);if(member)await member.send(nicknameChoice(linked)).catch(()=>null);await updateInteraction(interaction,{content:`Approved by <@${interaction.user.id}>. ${linked.character_name} is now linked to <@${linked.discord_user_id}>.`,embeds:interaction.message.embeds,components:[]});return true;}
      if(action==="reject"){await pool.query(`update portal_alt_character_claims set status='rejected',resolution_method='officer_rejected',resolved_by_discord_user_id=$2,resolved_at=now(),updated_at=now() where id=$1 and status in('pending','code_required')`,[id,interaction.user.id]);await updateInteraction(interaction,{content:`Rejected by <@${interaction.user.id}>.`,embeds:interaction.message.embeds,components:[]});return true;}
      if(action==="require-code"){if(!claim.code_expires_at)throw new Error("This officer-only request was not issued with a profile code.");await pool.query(`update portal_alt_character_claims set status='code_required',updated_at=now() where id=$1 and status='pending'`,[id]);await updateInteraction(interaction,{content:`<@${claim.discord_user_id}> must now complete the Lodestone profile-code check. Officer approval is disabled for this request.`,embeds:interaction.message.embeds,components:[row(new ButtonBuilder().setCustomId(`altchar:reject:${claim.id}`).setLabel("Reject").setStyle(ButtonStyle.Danger),new ButtonBuilder().setLabel("Open Lodestone Profile").setStyle(ButtonStyle.Link).setURL(profileUrl(claim.lodestone_character_id)))]});return true;}
    }catch(error){const message=error instanceof Error?error.message:String(error);if(interaction.deferred||interaction.replied)await interaction.editReply({content:message,embeds:[],components:[]}).catch(()=>null);else await interaction.reply({content:message,flags:MessageFlags.Ephemeral}).catch(()=>null);return{handled:true,error};}
    return false;
  }
  return{ensure:()=>ensureAltCharacterTables(pool),command,handle};
}
