import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, SlashCommandBuilder, StringSelectMenuBuilder } from "discord.js";
import { createHmac } from "node:crypto";
import { addShareCommandGroup } from "./share-commands.mjs";
import { addTreasureMapCommand } from "./treasure-maps.mjs";
import { DISCORD_COMMAND_NAME, GUILD_NAME, PORTAL_ACCENT_COLOR, PORTAL_URL } from "./installation-config.mjs";

const COLOR = PORTAL_ACCENT_COLOR;
const PAGE = 10;
const ANIME_TIMEZONE = String(process.env.ANIME_TIMEZONE || "America/Chicago").trim();
const ANIME_DAY_LIMIT = 30;
const ACTIVE_GIVEAWAYS = ["open", "submissions_open", "submissions_closed", "voting_open", "voting_closed", "awaiting_claim"];
export const FAE_REQUIRED_COMMANDS = new Set(["help", "about", "privacy", "officer"]);
export const FAE_DISABLEABLE_COMMANDS = new Set(["me", "status", "character", "craftmacro", "chocobocolor", "map", "planevent", "availability", "events", "animeschedule", "giveaways", "entries", "mounts", "minions", "mountalerts", "share", "links"]);
const FAE_HELP_ITEMS = [
  ["me", "your linked-character overview"],
  ["status", "portal connection status"],
  ["character", "find and claim an additional character"],
  ["craftmacro", "generate a members-only reply and save crafter stats"],
  ["chocobocolor", "plan a private chocobo fruit feeding order"],
  ["map", "privately identify a treasure-map screenshot"],
  ["planevent", "schedule a duty run or farm party"],
  ["availability", "set or review your weekly event availability"],
  ["events", "upcoming FC events"],
  ["animeschedule", "private day-by-day anime release calendar"],
  ["giveaways", "active giveaways and contests"],
  ["entries", "your giveaway activity"],
  ["mounts", "tracked mounts"],
  ["minions", "minions and sources"],
  ["mountalerts", "mount-win notification preference"],
  ["share duty|mount|minion", "preview and post an illustrated catalog card", "share"],
  ["links", "portal shortcuts"],
  ["about", "service information"],
  ["privacy", "privacy and data information"]
];
const MINION_CATEGORIES = [["farmable","Duty / Farmed"],["gathering","Gathering / Ventures"],["gardening","Gardening"],["crafting","Crafting / Scrips"],["tribal","Tribal Quests"],["island_sanctuary","Island Sanctuary"],["pvp","PvP"],["event","Seasonal Events"],["quest","Quests"],["vendor","Vendors"],["premium","Premium"],["achievement","Achievements"],["gold_saucer","Gold Saucer"],["other","Other Sources"]];
const MINION_CATEGORY_SQL = `case when lower(coalesce(n.source_name,'')) like any(array['%tribal:%','%beast tribe:%']) then 'tribal' when lower(coalesce(n.source_name,'')) like '%pvp:%' then 'pvp' when lower(coalesce(n.source_name,'')) like '%event:%' then 'event' when lower(coalesce(n.source_name,'')) like '%premium:%' then 'premium' when lower(coalesce(n.source_name,'')) like '%quest:%' then 'quest' when lower(coalesce(n.source_name,'')) like '%purchase:%' then 'vendor' when lower(coalesce(n.source_name,'')) like '%achievement:%' then 'achievement' when lower(coalesce(n.source_name,'')) like '%gold saucer:%' then 'gold_saucer' when lower(coalesce(n.source_name,'')) like '%island sanctuary:%' then 'island_sanctuary' when lower(coalesce(n.source_name,'')) like '%gardening%' then 'gardening' when lower(coalesce(n.source_name,'')) like any(array['%gathering:%','%venture:%','%voyages:%']) then 'gathering' when lower(coalesce(n.source_name,'')) like any(array['%crafting:%','%skybuilders:%','%cosmic exploration:%','%scrip%']) then 'crafting' when lower(coalesce(n.source_name,'')) like any(array['%dungeon:%','%raid:%','%trial:%','%fate:%','%treasure hunt:%','%occult crescent:%','%bozja:%','%eureka:%','%hunts:%','%wondrous tails:%']) then 'farmable' else 'other' end`;

const path = (query="") => new globalThis.URL(query, PORTAL_URL).toString();
const link = (label, query="") => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(path(query));
const row = (...items) => new ActionRowBuilder().addComponents(...items);
const text = (value, fallback="Unknown") => String(value ?? "").trim() || fallback;
const cut = (value, size=90) => { const valueText=text(value,""); return valueText.length <= size ? valueText : `${valueText.slice(0,size-1)}…`; };
const when = (value, style="F") => { const time=new Date(value).getTime(); return Number.isFinite(time) ? `<t:${Math.floor(time/1000)}:${style}>` : "Not set"; };
const embed = (title, description="") => new EmbedBuilder().setColor(COLOR).setTitle(title).setDescription(description).setFooter({text:"FFXIV materials © SQUARE ENIX"});

export async function getDisabledFaeCommands(pool) {
  const result = await pool.query("select value from portal_settings where key='discordDisabledCommands' limit 1").catch(() => ({ rows: [] }));
  return new Set(String(result.rows[0]?.value || "").split(",").map((value) => value.trim()).filter((value) => FAE_DISABLEABLE_COMMANDS.has(value)));
}
export async function isFaeCommandEnabled(pool, name) {
  if (FAE_REQUIRED_COMMANDS.has(name) || !FAE_DISABLEABLE_COMMANDS.has(name)) return true;
  return !(await getDisabledFaeCommands(pool)).has(name);
}
export const disabledFaeCommandReply = (name) => ({ content: `\`/${DISCORD_COMMAND_NAME} ${name}\` is currently disabled by an FC officer.`, embeds: [], components: [] });

let diagnosticsReady = null;
export const createFaeDiagnosticReference = () => `FC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
async function ensureDiagnostics(pool) {
  if (!diagnosticsReady) diagnosticsReady = (async () => {
    await pool.query(`create table if not exists portal_command_diagnostics (id bigserial primary key,reference_id text not null unique,command_name text not null,command_path text not null,interaction_kind text not null default 'command',discord_user_id text,discord_username text,discord_display_name text,character_id bigint,character_name text,guild_id text,channel_id text,outcome text not null check(outcome in ('success','failure')),failure_stage text,error_code text,error_message text,duration_ms integer not null default 0,bot_version text,created_at timestamptz not null default now());`);
    await pool.query(`alter table portal_command_diagnostics alter column discord_user_id drop not null; update portal_command_diagnostics set discord_user_id=null,discord_username=null,discord_display_name=null,character_id=null,character_name=null where outcome='success';`);
    await pool.query(`create index if not exists portal_command_diagnostics_created_idx on portal_command_diagnostics(created_at desc);`);
    await pool.query(`create index if not exists portal_command_diagnostics_user_idx on portal_command_diagnostics(discord_user_id,created_at desc);`);
    await pool.query(`create table if not exists portal_command_usage_daily (usage_date date not null,command_path text not null,invocation_count integer not null default 0,primary key(usage_date,command_path));`);
    await pool.query(`delete from portal_command_diagnostics where created_at < now()-interval '30 days';`);
    await pool.query(`delete from portal_command_usage_daily where usage_date < current_date-90;`);
  })().catch((error) => { diagnosticsReady=null; throw error; });
  return diagnosticsReady;
}
function diagnosticError(error) {
  const message=cut(error instanceof Error ? error.message : String(error||"Unknown error"),300);
  const code=cut(error?.code || error?.name || "Error",80);
  const frame=String(error?.stack||"").split("\n").map((line)=>line.trim()).find((line)=>line.includes("fae-commands.mjs:"));
  return {message,code,stage:frame?cut(frame.replace(/^at\s+/,""),180):"Command handler"};
}
export async function recordFaeDiagnostic(pool,interaction,{referenceId,commandPath,interactionKind,outcome,startedAt,error=null}) {
  try {
    const secret=String(process.env.PRIVACY_SUPPRESSION_SECRET||process.env.AUTH_SECRET||"").trim();
    if(!secret)return;
    const fingerprint=createHmac("sha256",secret).update(`discord:${interaction.user.id}`).digest("hex");const suppressed=await pool.query("select 1 from portal_privacy_suppressions where discord_fingerprint=$1 and status='active' limit 1",[fingerprint]).catch(()=>({rows:[]}));if(suppressed.rows.length)return;
    await ensureDiagnostics(pool);
    const identified=outcome==="failure";
    let linked=null;
    if(identified)try { linked=await character(pool,interaction.user.id,discordDisplayName(interaction)); } catch {}
    const failure=error?diagnosticError(error):{message:null,code:null,stage:null};
    const inserted=await pool.query(`insert into portal_command_diagnostics(reference_id,command_name,command_path,interaction_kind,discord_user_id,discord_username,discord_display_name,character_id,character_name,guild_id,channel_id,outcome,failure_stage,error_code,error_message,duration_ms,bot_version) values($1,$17,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) on conflict(reference_id) do nothing returning id;`,[referenceId,commandPath,interactionKind,identified?interaction.user.id:null,identified?(interaction.user.username||null):null,identified?(interaction.member?.displayName||interaction.user.globalName||null):null,identified?(linked?.id||null):null,identified?(linked?.display_name||linked?.character_name||null):null,interaction.guildId||null,interaction.channelId||null,outcome,failure.stage,failure.code,failure.message,Math.max(0,Date.now()-startedAt),process.env.npm_package_version||null,DISCORD_COMMAND_NAME]);
    if(interactionKind==="command"&&inserted.rowCount){
      await pool.query(`insert into portal_command_usage_daily(usage_date,command_path,invocation_count) values(current_date,$1,1) on conflict(usage_date,command_path) do update set invocation_count=portal_command_usage_daily.invocation_count+1;`,[commandPath]);
    }
  } catch (loggingError) { console.warn(`[fc-portal-bot] Could not record /${DISCORD_COMMAND_NAME} diagnostic:`,loggingError?.message||loggingError); }
}

const discordDisplayName = interaction => String(interaction?.member?.displayName || interaction?.member?.nickname || interaction?.user?.globalName || interaction?.user?.username || "").trim();
async function rememberDiscordDisplayName(pool,interaction){
  const currentName=discordDisplayName(interaction);
  const currentNickname=String(interaction?.member?.nickname||"").trim()||null;
  if(currentName)await pool.query(`update portal_discord_links set discord_nickname=$2,discord_display_name=$3,updated_at=now() where discord_user_id=$1`,[interaction.user.id,currentNickname,currentName]);
  return currentName;
}
async function character(pool, userId, currentNickname="") {
  const result=await pool.query(`with membership as (
      select dl.discord_user_id,dl.character_id anchor_id,coalesce(nullif($2,''),dl.discord_nickname,dl.discord_display_name,'') current_nickname
      from portal_discord_links dl join portal_characters anchor on anchor.id=dl.character_id
      where dl.discord_user_id=$1 and anchor.active=true and anchor.fc_membership_status='current'
        and exists(select 1 from portal_fc_verification verification where verification.id=1 and verification.status='verified')
    ), candidates as (
      select anchor.*,true access_anchor_current,
        case when lower(trim(anchor.character_name))=lower(trim(m.current_nickname)) or lower(trim(anchor.display_name))=lower(trim(m.current_nickname)) then 0 else 1 end identity_priority
      from membership m join portal_characters anchor on anchor.id=m.anchor_id
      union all
      select linked.*,true access_anchor_current,
        case when lower(trim(linked.character_name))=lower(trim(m.current_nickname)) or lower(trim(linked.display_name))=lower(trim(m.current_nickname)) then 0 else 2 end identity_priority
      from membership m join portal_alt_character_links acl on acl.discord_user_id=m.discord_user_id and acl.active=true
      join portal_characters linked on linked.id=acl.character_id and linked.active=true
    ) select * from candidates order by identity_priority,id limit 1;`,[userId,currentNickname]);
  return result.rows[0] || null;
}
function blocked(characterRow) {
  if(!characterRow) return {embeds:[embed("Link your character first","Use `/iam character:Your Name` to associate your Discord account with your FFXIV character. This only locates your own portal records.")],components:[row(link("Member Directory","?view=members"))]};
  if(!characterRow.active || characterRow.access_anchor_current!==true) return {embeds:[embed("Current FC membership required",`Your linked character is not currently attached to an active ${GUILD_NAME} membership. Ask an officer to review the roster record if that looks wrong.`)]};
  return null;
}

export function buildFaeCommand(){
  const command=new SlashCommandBuilder().setName(DISCORD_COMMAND_NAME).setDescription(`${GUILD_NAME} portal tools and personal collection information.`.slice(0,100));
  for(const [name,description] of [["help",`Show the available /${DISCORD_COMMAND_NAME} commands.`],["me","Show your personal portal overview."],["status","Check your portal connection status."],["character","Find and claim an additional FFXIV character."],["planevent","Schedule an FC duty run or farm party."],["availability","Set or review your weekly event availability."],["events","Show upcoming FC events."],["animeschedule","Browse the anime release schedule by day."],["giveaways","Show active giveaways and contests."],["entries","Show your giveaway and contest activity."],["mounts","Browse your tracked mount collection."],["minions","Browse your minion collection and sources."],["mountalerts","View or change mount-win notifications."],["links","Open useful portal pages."],["about","Learn what the FC bot handles."],["privacy","See what data these commands use."]]) command.addSubcommand(sub=>sub.setName(name).setDescription(description));
  command.addSubcommand(sub=>sub.setName("craftmacro").setDescription("Generate an ephemeral macro and save the entered crafter stats.").addStringOption(option=>option.setName("recipe").setDescription("Craftable item").setRequired(true).setAutocomplete(true)).addStringOption(option=>option.setName("goal").setDescription("What the macro should accomplish").addChoices({name:"Maximum quality / collectability",value:"max"},{name:"Completion only",value:"complete"})));
  command.addSubcommand(sub=>sub.setName("chocobocolor").setDescription("Calculate a private chocobo fruit feeding plan.").addStringOption(option=>option.setName("current").setDescription("Current plumage color").setRequired(true).setAutocomplete(true)).addStringOption(option=>option.setName("target").setDescription("Desired plumage color").setRequired(true).setAutocomplete(true)));
  addTreasureMapCommand(command);
  addShareCommandGroup(command);
  command.addSubcommandGroup(group => group.setName("officer").setDescription("Officer tools")
    .addSubcommand(sub => sub.setName("verify").setDescription("Post a character verification button in this channel.")));
  return command;
}

async function help(pool){const root=`/${DISCORD_COMMAND_NAME}`,disabled=await getDisabledFaeCommands(pool);const lines=FAE_HELP_ITEMS.filter(([name,,key])=>!disabled.has(key||name)).map(([name,description])=>`\`${root} ${name}\` — ${description}`);return {embeds:[embed(`${GUILD_NAME} commands`,lines.concat(["",`Use \`/iam character:Your Name\` for initial FC verification${disabled.has("character")?".":`; use \`/${DISCORD_COMMAND_NAME} character\` for additional characters.`}`]).join("\n"))],components:[row(link("Open Portal"))]};}

async function me(pool,userId){
  const c=await character(pool,userId), stop=blocked(c); if(stop)return stop;
  const [events,giveaways]=await Promise.all([pool.query(`select count(*)::int count from portal_discord_event_signups s join portal_discord_events e on e.id=s.event_id where s.character_id=$1 and s.signup_status in ('going','maybe') and e.event_starts_at>=now() and e.status in ('planned','open');`,[c.id]),pool.query(`select count(distinct g.id)::int count from portal_giveaways g left join portal_giveaway_entries e on e.giveaway_id=g.id and e.discord_user_id=$1 left join portal_giveaway_submissions s on s.giveaway_id=g.id and s.discord_user_id=$1 where g.is_test=false and coalesce(g.delete_pending,false)=false and g.status=any($2::text[]) and (e.id is not null or s.id is not null);`,[userId,ACTIVE_GIVEAWAYS])]);
  const card=embed(text(c.display_name||c.character_name),`${text(c.world)} · ${text(c.role,"Member")}`).addFields({name:"FC status",value:text(c.fc_membership_status),inline:true},{name:"Upcoming RSVPs",value:String(events.rows[0]?.count||0),inline:true},{name:"Giveaway activity",value:String(giveaways.rows[0]?.count||0),inline:true},{name:"Mount alerts",value:c.mount_win_notifications_enabled?"Enabled":"Disabled",inline:true},{name:"Mount sync",value:text(c.sync_status),inline:true},{name:"Minion sync",value:text(c.minion_sync_status),inline:true}); if(c.avatar_url)card.setThumbnail(c.avatar_url);
  return {embeds:[card],components:[row(link("Member Directory","?view=members"),link("Settings","?view=settings"))]};
}
async function status(pool,interaction){
  const c=await character(pool,interaction.user.id);
  let scan=null;
  try {
    scan=(await pool.query(`select present_in_guild,has_verified_role,last_scanned_at from portal_discord_member_snapshots where discord_user_id=$1 limit 1;`,[interaction.user.id])).rows[0]||null;
  } catch(error) {
    console.warn(`[fc-portal-bot] /${DISCORD_COMMAND_NAME} status could not read the latest roster snapshot:`,error?.message||error);
  }
  const linked=Boolean(c);
  const current=Boolean(c?.active&&c?.access_anchor_current===true);
  const discordState=scan?(scan.present_in_guild?"✅ Recognized":"❌ Not currently present"):(interaction.guildId?"✅ Recognized · roster scan pending":"⚠️ Unknown outside the FC Discord");
  const roleState=scan?(scan.has_verified_role?"✅ Present":"❌ Not present"):"⚠️ Not scanned yet";
  const characterState=linked?`✅ ${text(c.display_name||c.character_name)} · ${text(c.world)}`:"❌ Not linked · use `/iam`";
  const rosterState=current?(c.fc_membership_status==="current"?"✅ Current member":"✅ Linked through current FC membership"):linked?`❌ ${text(c.fc_membership_status)}`:"❌ Not linked";
  const accessState=current?"✅ Available":"❌ Character link or roster review needed";
  const description=[
    `**Discord member:** ${discordState}`,
    `**Verified role:** ${roleState}`,
    `**Linked character:** ${characterState}`,
    `**Current FC roster:** ${rosterState}`,
    `**Portal access:** ${accessState}`
  ].join("\n");
  return {embeds:[embed("Your portal connection status",description)],components:[row(link("Open Portal"))]};
}async function events(pool){const result=await pool.query(`select title,event_type,duty_name,event_starts_at,party_size from portal_discord_events where event_starts_at>=now() and status in ('planned','open') order by event_starts_at limit 6;`);return {embeds:[embed("Upcoming FC events",result.rows.length?result.rows.map(e=>`**${cut(e.title,80)}**\n${when(e.event_starts_at)} · ${text(e.duty_name||e.event_type)}${e.party_size?` · ${e.party_size} slots`:""}`).join("\n\n"):"No upcoming FC events are currently planned.")],components:[row(link("Events & Raiding","?view=events"))]};}
function animeDateKey(date=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:ANIME_TIMEZONE,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function shiftAnimeDateKey(dateKey,days){const [year,month,day]=dateKey.split("-").map(Number);return new Date(Date.UTC(year,month-1,day+days,12)).toISOString().slice(0,10);}
function animeDayOffset(dateKey){return Math.round((Date.parse(`${dateKey}T12:00:00Z`)-Date.parse(`${animeDateKey()}T12:00:00Z`))/86400000);}
function animeDayLabel(dateKey){return new Intl.DateTimeFormat("en-US",{timeZone:"UTC",weekday:"long",month:"long",day:"numeric",year:"numeric"}).format(new Date(`${dateKey}T12:00:00Z`));}
async function animeSchedule(pool,requestedDateKey=null){
  const today=animeDateKey();
  const requested=/^\d{4}-\d{2}-\d{2}$/.test(String(requestedDateKey||""))?String(requestedDateKey):today;
  const requestedOffset=animeDayOffset(requested);
  const offset=Math.max(0,Math.min(ANIME_DAY_LIMIT,Number.isFinite(requestedOffset)?requestedOffset:0));
  const dateKey=shiftAnimeDateKey(today,offset);
  let releases=[];
  try{
    const result=await pool.query(`select r.language,r.status,r.starts_at,r.episode_label,s.english_title,coalesce(jsonb_agg(distinct p.display_name) filter(where p.id is not null),'[]'::jsonb) platforms from anime.releases r join anime.series s on s.id=r.series_id left join anime.release_platforms rp on rp.release_id=r.id left join anime.platforms p on p.id=rp.platform_id where (r.starts_at at time zone $2)::date=$1::date and r.status<>'unknown' group by r.id,s.id order by r.starts_at,s.english_title`,[dateKey,ANIME_TIMEZONE]);
    releases=result.rows;
  }catch(error){
    if(error?.code!=="42P01"&&error?.code!=="3F000")throw error;
  }
  const lines=releases.map(release=>{
    const episode=release.episode_label?`Episode ${release.episode_label}`:"New release";
    const platforms=Array.isArray(release.platforms)&&release.platforms.length?release.platforms.join(", "):"Platform not published";
    return `**${cut(release.english_title,75)} — ${cut(episode,28)} (${String(release.language||"").toUpperCase()})**\n${when(release.starts_at,"t")} · ${cut(platforms,90)}`;
  });
  const description=lines.length?lines.join("\n\n"):"No anime releases are currently listed for this day.";
  const controls=[
    new ButtonBuilder().setCustomId(`fae:anime:day:${shiftAnimeDateKey(dateKey,-1)}`).setStyle(ButtonStyle.Secondary).setLabel("Previous Day").setDisabled(offset<=0),
    new ButtonBuilder().setCustomId(`fae:anime:day:${today}`).setStyle(ButtonStyle.Secondary).setLabel("Today").setDisabled(offset===0),
    new ButtonBuilder().setCustomId(`fae:anime:day:${shiftAnimeDateKey(dateKey,1)}`).setStyle(ButtonStyle.Primary).setLabel("Next Day").setDisabled(offset>=ANIME_DAY_LIMIT),
    link("Full Calendar","?view=anime")
  ];
  return {embeds:[embed(`Anime Schedule — ${animeDayLabel(dateKey)}`,description).setFooter({text:`Calendar day: ${ANIME_TIMEZONE}. Discord displays release times in your local timezone. · FFXIV materials © SQUARE ENIX`})],components:[row(...controls)]};
}
async function giveaways(pool){const result=await pool.query(`select g.title,g.kind,g.status,g.closes_at,g.submission_closes_at,p.prize_name,(select count(*) from portal_giveaway_entries e where e.giveaway_id=g.id and e.status in ('entered','claimed'))::int entries,(select count(*) from portal_giveaway_submissions s where s.giveaway_id=g.id and s.status in ('active','finalized'))::int submissions from portal_giveaways g left join lateral(select prize_name from portal_giveaway_prizes where giveaway_id=g.id order by id limit 1)p on true where g.is_test=false and coalesce(g.delete_pending,false)=false and g.status=any($1::text[]) order by coalesce(g.closes_at,g.submission_closes_at,g.created_at) limit 6;`,[ACTIVE_GIVEAWAYS]);return {embeds:[embed("Active giveaways and contests",result.rows.length?result.rows.map(g=>`**${cut(g.title,80)}**\n${text(g.kind)} · ${text(g.status)} · Prize: ${cut(g.prize_name,60)}\n${g.entries||g.submissions||0} current entries${g.closes_at||g.submission_closes_at?` · closes ${when(g.closes_at||g.submission_closes_at,"R")}`:""}`).join("\n\n"):"There are no active giveaways or contests right now.")],components:[row(link("Giveaways & Contests","?view=giveaways"))]};}
async function entries(pool,userId){const c=await character(pool,userId),stop=blocked(c);if(stop)return stop;const result=await pool.query(`select distinct g.id,g.title,g.kind,g.status,coalesce(e.status,s.status,r.claim_status) activity from portal_giveaways g left join portal_giveaway_entries e on e.giveaway_id=g.id and e.discord_user_id=$1 left join portal_giveaway_submissions s on s.giveaway_id=g.id and s.discord_user_id=$1 left join portal_giveaway_results r on r.giveaway_id=g.id and r.character_id=$2 where g.is_test=false and coalesce(g.delete_pending,false)=false and(e.id is not null or s.id is not null or r.id is not null)order by g.id desc limit 10;`,[userId,c.id]);return {embeds:[embed("Your giveaway activity",result.rows.length?result.rows.map(g=>`**${cut(g.title)}** — ${text(g.activity)}\n${text(g.kind)} · ${text(g.status)}`).join("\n\n"):"You do not have any giveaway or contest activity yet.")],components:[row(link("Giveaways & Contests","?view=giveaways"))]};}

function alertPanel(c){const enabled=Boolean(c.mount_win_notifications_enabled);return {embeds:[embed("Mount win notifications",enabled?"Mount-win Discord notifications are **enabled** for all of your linked characters.":"Mount-win Discord notifications are **disabled** for all of your linked characters.").addFields({name:"What this affects",value:"Only eligible tracked mount wins. Initial baselines, hidden or optional mounts, incomplete scans, marketboard-only mounts, and every minion remain silent."}).setFooter({text:"This shared preference applies to your FC character and additional characters. Changing it does not send or restore past notifications. · FFXIV materials © SQUARE ENIX"})],components:[row(new ButtonBuilder().setCustomId("fae:mountalerts:toggle").setStyle(enabled?ButtonStyle.Danger:ButtonStyle.Success).setLabel(enabled?"Disable Mount Win Notifications":"Enable Mount Win Notifications"),link("Settings","?view=settings"))]};}

async function mountHome(pool,userId){
  const c=await character(pool,userId),stop=blocked(c);if(stop)return stop;
  if(!c.mount_ownership_initialized_at)return {embeds:[embed("Mount collection not ready",`Current status: **${text(c.sync_status)}**. Totals appear only after the first complete validated scan so private, failed, or incomplete scans are never treated as missing mounts.`)],components:[row(link("Mount Tracker","?view=mounts&mountTab=collection"))]};
  const result=await pool.query(`select ms.id,ms.name,ms.expansion,count(m.id)::int total,count(cm.mount_id)filter(where cm.owned=true)::int owned from portal_mount_sets ms join portal_mounts m on m.mount_set_id=ms.id and m.active=true left join portal_character_mounts cm on cm.mount_id=m.id and cm.character_id=$1 where ms.active=true group by ms.id order by ms.sort_order,ms.id;`,[c.id]);
  const total=result.rows.reduce((n,r)=>n+Number(r.total),0),owned=result.rows.reduce((n,r)=>n+Number(r.owned),0);
  const select=new StringSelectMenuBuilder().setCustomId("fae:mounts:set").setPlaceholder("Browse missing mounts by set").addOptions(result.rows.slice(0,25).map(r=>({label:cut(r.name,100),description:`${text(r.expansion)} · ${Number(r.total)-Number(r.owned)} missing`,value:String(r.id)})));
  const components=[];if(result.rows.length)components.push(row(select));components.push(row(new ButtonBuilder().setCustomId("fae:mounts:market:0").setStyle(ButtonStyle.Primary).setLabel("Marketboard Options"),link("Full Mount Tracker","?view=mounts&mountTab=collection"),link("Marketboard Mounts","?view=mounts&mountTab=marketboard")));
  return {embeds:[embed("Your tracked mounts",`**${owned}/${total} collected · ${total-owned} missing**\n\nChoose a set to browse missing mounts, or open cached marketboard options.`)],components};
}
async function mountSet(pool,userId,setId,page=0,mode="missing"){
  const c=await character(pool,userId),stop=blocked(c);if(stop)return stop;if(!c.mount_ownership_initialized_at)return mountHome(pool,userId);
  const owned=mode==="collected";
  const result=await pool.query(`select m.mount_name,m.source_name,coalesce(cm.owned,false)owned,ms.name set_name,ms.expansion,count(*)over()::int rows from portal_mounts m join portal_mount_sets ms on ms.id=m.mount_set_id left join portal_character_mounts cm on cm.mount_id=m.id and cm.character_id=$1 where m.active=true and ms.active=true and ms.id=$2 and coalesce(cm.owned,false)=$3 order by lower(m.mount_name) limit $4 offset $5;`,[c.id,setId,owned,PAGE,page*PAGE]);
  if(!result.rows.length&&page>0)return mountSet(pool,userId,setId,0,mode);
  const first=result.rows[0],total=Number(first?.rows||0),buttons=[new ButtonBuilder().setCustomId("fae:mounts:home").setStyle(ButtonStyle.Secondary).setLabel("All Sets"),new ButtonBuilder().setCustomId(`fae:mounts:view:${setId}:${owned?"missing":"collected"}`).setStyle(ButtonStyle.Primary).setLabel(owned?"Show Missing":"Show Collected")];
  if(page>0)buttons.push(new ButtonBuilder().setCustomId(`fae:mounts:page:${setId}:${mode}:${page-1}`).setStyle(ButtonStyle.Secondary).setLabel("Previous"));if((page+1)*PAGE<total)buttons.push(new ButtonBuilder().setCustomId(`fae:mounts:page:${setId}:${mode}:${page+1}`).setStyle(ButtonStyle.Primary).setLabel("Next"));
  return {embeds:[embed(`${text(first?.expansion)} — ${text(first?.set_name,"Mount Set")}`,`${result.rows.map(r=>`${r.owned?"✅":"❌"} **${cut(r.mount_name,65)}**${r.source_name?` — ${cut(r.source_name,80)}`:""}`).join("\n")||`No ${mode} mounts in this set.`}\n\n${owned?"Collected":"Missing"} · page ${page+1} of ${Math.max(1,Math.ceil(total/PAGE))}`)],components:[row(...buttons),row(link("Full Mount Tracker","?view=mounts&mountTab=collection"))]};
}
async function minionHome(pool,userId){
  const c=await character(pool,userId),stop=blocked(c);if(stop)return stop;if(c.minion_sync_status!=="minion_synced"||!c.minion_ownership_initialized_at)return {embeds:[embed("Minion collection not ready",`Current status: **${text(c.minion_sync_status)}**. Data appears only after a complete validated scan. Minion updates never create Discord notifications.`)],components:[row(link("Minion Guide","?view=minions&minionTab=collection"))]};
  const result=await pool.query(`with x as(select n.id,${MINION_CATEGORY_SQL} category from portal_minions n)select category,count(*)::int total,count(cm.minion_id)filter(where cm.owned=true)::int owned from x n left join portal_character_minions cm on cm.minion_id=n.id and cm.character_id=$1 group by category;`,[c.id]);
  const map=new Map(result.rows.map(r=>[r.category,r])),total=result.rows.reduce((n,r)=>n+Number(r.total),0),owned=result.rows.reduce((n,r)=>n+Number(r.owned),0);
  const select=new StringSelectMenuBuilder().setCustomId("fae:minions:category").setPlaceholder("Browse missing minions by source").addOptions(MINION_CATEGORIES.map(([key,label])=>({label,description:`${Number(map.get(key)?.total||0)-Number(map.get(key)?.owned||0)} missing`,value:key})));
  return {embeds:[embed("Your minion collection",`**${owned}/${total} collected · ${total-owned} missing**\n\nChoose a source to browse missing minions. Minion collection changes are always quiet and never generate Discord messages.`)],components:[row(select),row(new ButtonBuilder().setCustomId("fae:minions:missing:0").setStyle(ButtonStyle.Secondary).setLabel("All Missing"),new ButtonBuilder().setCustomId("fae:minions:market:0").setStyle(ButtonStyle.Primary).setLabel("Marketboard Options"),link("Full Minion Guide","?view=minions&minionTab=collection"))]};
}
async function minionCategory(pool,userId,category,page=0){
  const c=await character(pool,userId),stop=blocked(c);if(stop)return stop;if(c.minion_sync_status!=="minion_synced"||!c.minion_ownership_initialized_at)return minionHome(pool,userId);
  const categoryClause=category==="all"?"true":"n.category=$2";const values=category==="all"?[c.id,PAGE,page*PAGE]:[c.id,category,PAGE,page*PAGE];
  const result=await pool.query(`with x as(select n.*,${MINION_CATEGORY_SQL} category from portal_minions n)select n.minion_name,n.source_name,n.marketboard_item_name,count(*)over()::int rows from x n left join portal_character_minions cm on cm.minion_id=n.id and cm.character_id=$1 where ${categoryClause} and coalesce(cm.owned,false)=false order by lower(n.minion_name) limit $${category==="all"?2:3} offset $${category==="all"?3:4};`,values);
  if(!result.rows.length&&page>0)return minionCategory(pool,userId,category,0);const total=Number(result.rows[0]?.rows||0),title=category==="all"?"All Missing Minions":MINION_CATEGORIES.find(([key])=>key===category)?.[1]||"Minions",buttons=[new ButtonBuilder().setCustomId("fae:minions:home").setStyle(ButtonStyle.Secondary).setLabel("All Sources")];
  if(page>0)buttons.push(new ButtonBuilder().setCustomId(`fae:minions:page:${category}:${page-1}`).setStyle(ButtonStyle.Secondary).setLabel("Previous"));if((page+1)*PAGE<total)buttons.push(new ButtonBuilder().setCustomId(`fae:minions:page:${category}:${page+1}`).setStyle(ButtonStyle.Primary).setLabel("Next"));
  return {embeds:[embed(title,`${result.rows.map(r=>`❌ **${cut(r.minion_name,60)}** — ${cut(r.source_name||"Source not published yet",90)}${r.marketboard_item_name?`\n↳ Marketboard: ${cut(r.marketboard_item_name,65)}`:""}`).join("\n")||"No missing minions found."}\n\nPage ${page+1} of ${Math.max(1,Math.ceil(total/PAGE))}`)],components:[row(...buttons),row(link("Full Minion Guide",`?view=minions&minionTab=collection${category!=="all"?`&minionCategory=${encodeURIComponent(category)}`:""}`))]};
}
async function marketPage(pool,userId,kind,page=0){
  const c=await character(pool,userId),stop=blocked(c);if(stop)return stop;
  const mount=kind==="mounts",catalog=mount?"portal_mounts":"portal_minions",ownership=mount?"portal_character_mounts":"portal_character_minions",foreign=mount?"mount_id":"minion_id",prices=mount?"portal_marketboard_item_prices":"portal_marketboard_minion_prices",name=mount?"mount_name":"minion_name";
  const result=await pool.query(`select n.id,n.${name} name,n.marketboard_item_name item_name,n.source_name,(select min(p.min_price) from ${prices} p where p.item_id=n.marketboard_item_id) lowest,count(*)over()::int rows from ${catalog} n left join ${ownership} cm on cm.${foreign}=n.id and cm.character_id=$1 where coalesce(cm.owned,false)=false and n.marketboard_eligible=true and n.marketboard_item_id is not null and exists(select 1 from ${prices} p where p.item_id=n.marketboard_item_id) order by lowest,lower(n.${name}) limit $2 offset $3;`,[c.id,8,page*8]);
  if(!result.rows.length&&page>0)return marketPage(pool,userId,kind,0);const total=Number(result.rows[0]?.rows||0),buttons=[new ButtonBuilder().setCustomId(`fae:${kind}:home`).setStyle(ButtonStyle.Secondary).setLabel("Collection Home")];if(page>0)buttons.push(new ButtonBuilder().setCustomId(`fae:${kind}:market:${page-1}`).setStyle(ButtonStyle.Secondary).setLabel("Previous"));if((page+1)*8<total)buttons.push(new ButtonBuilder().setCustomId(`fae:${kind}:market:${page+1}`).setStyle(ButtonStyle.Primary).setLabel("Next"));
  const components=[row(...buttons)];if(result.rows.length)components.unshift(row(new StringSelectMenuBuilder().setCustomId(`fae:${kind}:market-detail`).setPlaceholder("Choose an item for cached prices").addOptions(result.rows.map(r=>({label:cut(r.name,100),description:`${cut(r.item_name,65)} · from ${Number(r.lowest).toLocaleString()} gil`,value:String(r.id)})))));
  return {embeds:[embed(`Missing ${mount?"Mount":"Minion"} Marketboard Options`,`${result.rows.map(r=>`**${cut(r.name,65)}** — ${Number(r.lowest).toLocaleString()} gil\n↳ ${cut(r.item_name,75)}`).join("\n")||"No missing tradeable options with cached prices."}\n\nCached prices · page ${page+1} of ${Math.max(1,Math.ceil(total/8))}`)],components};
}
async function marketDetail(pool,userId,kind,id){
  const c=await character(pool,userId),stop=blocked(c);if(stop)return stop;const mount=kind==="mounts",catalog=mount?"portal_mounts":"portal_minions",ownership=mount?"portal_character_mounts":"portal_character_minions",foreign=mount?"mount_id":"minion_id",prices=mount?"portal_marketboard_item_prices":"portal_marketboard_minion_prices",name=mount?"mount_name":"minion_name";
  const item=(await pool.query(`select n.${name} name,n.marketboard_item_name item_name,n.source_name,n.marketboard_item_id from ${catalog} n left join ${ownership} cm on cm.${foreign}=n.id and cm.character_id=$1 where n.id=$2 and coalesce(cm.owned,false)=false;`,[c.id,id])).rows[0];if(!item)return marketPage(pool,userId,kind,0);
  const listings=(await pool.query(`select world_name,data_center_name,min_price from ${prices} where item_id=$1 order by min_price,world_name;`,[item.marketboard_item_id])).rows,top=listings.slice(0,3),faerie=listings.find(r=>String(r.world_name).toLowerCase()==="faerie");const lines=top.map(r=>`**${r.world_name==="Faerie"?"Aether":text(r.data_center_name)}/${text(r.world_name)}** — ${Number(r.min_price).toLocaleString()} gil`);lines.push(`**Aether/Faerie** — ${faerie?`${Number(faerie.min_price).toLocaleString()} gil`:"No cached listing"}`);
  return {embeds:[embed(text(item.name),`**Marketboard item:** ${text(item.item_name)}\n**Source:** ${text(item.source_name,"Source not published yet")}\n\n${lines.join("\n")}\n\nPrices are cached by the hourly worker.`)],components:[row(new ButtonBuilder().setCustomId(`fae:${kind}:market:0`).setStyle(ButtonStyle.Secondary).setLabel("Back to Options"),link(mount?"Marketboard Mounts":"Marketboard Minions",`?view=${kind}&${mount?"mountTab":"minionTab"}=marketboard`))]};
}
function links(){return {embeds:[embed(`${GUILD_NAME} links`,"Discord provides quick private summaries; the website remains the full interface.")],components:[row(link("Portal Home"),link("Events","?view=events"),link("Giveaways","?view=giveaways")),row(link("Mounts","?view=mounts&mountTab=collection"),link("Minions","?view=minions&minionTab=collection"),link("Anime Calendar","?view=anime"))]};}
function about(){return {embeds:[embed(`${GUILD_NAME} Bot`,`${GUILD_NAME}'s FC bot provides member character linking, events, collection tools, giveaways, galleries, and other FC features.\n\nUse \`/${DISCORD_COMMAND_NAME} help\` to see available commands.`)],components:[row(link("Open FC Portal"))]};}
function privacy(){return {embeds:[embed(`${GUILD_NAME} — Privacy & Data`,`${GUILD_NAME}'s bot and portal use information needed to provide FC features and associate your Discord account with your FFXIV character. Data changes are confirmed on the signed-in portal so another Discord user cannot submit them for you.`).addFields(
  {name:"FFXIV information",value:"• Character name and world\n• FC membership\n• Public Lodestone collection information such as mounts and minions\n• Public game/catalog information used for acquisition details\n• Public marketboard information used by collection tools"},
  {name:"Discord & FC information",value:"• Your Discord identity and current server membership\n• Your linked FFXIV character\n• FC-related roles used for permissions\n• Information you create through FC features, such as event RSVPs, giveaway or contest participation, gallery submissions, and personal feature settings"},
  {name:"Your choices",value:"Download your own data, switch to verification-only mode, or fully opt out under Member Settings → Data & Privacy. Full opt-out removes portal-managed roles and nickname; returning requires explicit opt-in and fresh verification."},
  {name:"How it is used",value:`FFXIV collection information comes from publicly accessible sources. Discord and portal information is used to provide ${GUILD_NAME} features and administration.`}
  )],components:[row(link("Manage My Data","?view=settings#data-privacy"),link("Privacy Policy","privacy"),link("Terms","terms")),row(new ButtonBuilder().setCustomId("fae:about").setStyle(ButtonStyle.Secondary).setLabel("About the Bot"))]};}
async function payload(interaction,pool){const name=interaction.options.getSubcommand();if(!await isFaeCommandEnabled(pool,name))return disabledFaeCommandReply(name);if(name==="help")return help(pool);if(name==="me")return me(pool,interaction.user.id);if(name==="status")return status(pool,interaction);if(name==="events")return events(pool);if(name==="animeschedule")return animeSchedule(pool);if(name==="giveaways")return giveaways(pool);if(name==="entries")return entries(pool,interaction.user.id);if(name==="mounts")return mountHome(pool,interaction.user.id);if(name==="minions")return minionHome(pool,interaction.user.id);if(name==="mountalerts"){const c=await character(pool,interaction.user.id),stop=blocked(c);return stop||alertPanel(c);}if(name==="links")return links();if(name==="about")return about();if(name==="privacy")return privacy();return help(pool);}

export async function handleFaeCommand(interaction,pool,{alreadyDeferred=false}={}){
  const startedAt=Date.now(),referenceId=createFaeDiagnosticReference(),commandPath=`/${DISCORD_COMMAND_NAME} ${interaction.options.getSubcommand(false)||"unknown"}`;
  try{
    if(!alreadyDeferred)await interaction.deferReply({flags:MessageFlags.Ephemeral});
    await rememberDiscordDisplayName(pool,interaction);
    await interaction.editReply(await payload(interaction,pool));
    await recordFaeDiagnostic(pool,interaction,{referenceId,commandPath,interactionKind:"command",outcome:"success",startedAt});
  }catch(error){
    console.error(`[cotf-bot] ${commandPath} failed (${referenceId}):`,error);
    await recordFaeDiagnostic(pool,interaction,{referenceId,commandPath,interactionKind:"command",outcome:"failure",startedAt,error});
    const reply={content:`The portal could not load that private summary right now. Please try again shortly.\nReference: ${referenceId}`,embeds:[],components:[]};
    if(interaction.deferred||interaction.replied)await interaction.editReply(reply).catch(()=>null);else await interaction.reply({...reply,flags:MessageFlags.Ephemeral}).catch(()=>null);
  }
}
export async function handleFaeComponent(interaction,pool){
  if(!(interaction.isButton()||interaction.isStringSelectMenu())||!interaction.customId.startsWith("fae:"))return false;
  const startedAt=Date.now(),referenceId=createFaeDiagnosticReference(),commandPath=interaction.customId.replace(/^fae:/,`/${DISCORD_COMMAND_NAME} `).replaceAll(":"," > ");
  try{
    await rememberDiscordDisplayName(pool,interaction);
    let result;
    if(interaction.customId==="fae:about")result=about();else if(interaction.customId.startsWith("fae:anime:day:"))result=await animeSchedule(pool,interaction.customId.slice("fae:anime:day:".length));else if(interaction.customId==="fae:mountalerts:toggle"){const c=await character(pool,interaction.user.id),stop=blocked(c);if(stop)result=stop;else{const enabled=!Boolean(c.mount_win_notifications_enabled);await pool.query(`update portal_characters set mount_win_notifications_enabled=$2,updated_at=now() where id in(select dl.character_id from portal_discord_links dl where dl.discord_user_id=$1 union select acl.character_id from portal_alt_character_links acl where acl.discord_user_id=$1 and acl.active=true)`,[interaction.user.id,enabled]);result=alertPanel({...c,mount_win_notifications_enabled:enabled});}}else if(interaction.customId==="fae:mounts:home")result=await mountHome(pool,interaction.user.id);else if(interaction.customId==="fae:mounts:set")result=await mountSet(pool,interaction.user.id,Number(interaction.values[0]),0,"missing");else if(interaction.customId.startsWith("fae:mounts:view:")){const parts=interaction.customId.split(":");result=await mountSet(pool,interaction.user.id,Number(parts[3]),0,parts[4]);}else if(interaction.customId.startsWith("fae:mounts:page:")){const parts=interaction.customId.split(":");result=await mountSet(pool,interaction.user.id,Number(parts[3]),Number(parts[5]),parts[4]);}else if(interaction.customId.startsWith("fae:mounts:market-detail"))result=await marketDetail(pool,interaction.user.id,"mounts",Number(interaction.values[0]));else if(interaction.customId.startsWith("fae:mounts:market:")){const parts=interaction.customId.split(":");result=await marketPage(pool,interaction.user.id,"mounts",Number(parts[3]));}else if(interaction.customId==="fae:minions:home")result=await minionHome(pool,interaction.user.id);else if(interaction.customId==="fae:minions:category")result=await minionCategory(pool,interaction.user.id,interaction.values[0],0);else if(interaction.customId.startsWith("fae:minions:missing:")){const parts=interaction.customId.split(":");result=await minionCategory(pool,interaction.user.id,"all",Number(parts[3]));}else if(interaction.customId.startsWith("fae:minions:page:")){const parts=interaction.customId.split(":");result=await minionCategory(pool,interaction.user.id,parts[3],Number(parts[4]));}else if(interaction.customId.startsWith("fae:minions:market-detail"))result=await marketDetail(pool,interaction.user.id,"minions",Number(interaction.values[0]));else if(interaction.customId.startsWith("fae:minions:market:")){const parts=interaction.customId.split(":");result=await marketPage(pool,interaction.user.id,"minions",Number(parts[3]));}else return false;
    await interaction.update(result);
    await recordFaeDiagnostic(pool,interaction,{referenceId,commandPath,interactionKind:"component",outcome:"success",startedAt});
  }catch(error){
    console.error(`[cotf-bot] ${interaction.customId} failed (${referenceId}):`,error);
    await recordFaeDiagnostic(pool,interaction,{referenceId,commandPath,interactionKind:"component",outcome:"failure",startedAt,error});
    await interaction.update({content:`That private panel could not be updated right now. Run the command again to retry.\nReference: ${referenceId}`,embeds:[],components:[]}).catch(()=>null);
  }
  return true;
}





