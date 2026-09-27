import type { Client } from "pg";

export const AVAILABILITY_STALE_DAYS = 90;
export const AVAILABILITY_TIME_ZONES = [
  ["America/St_Johns", "Newfoundland Time"], ["America/Halifax", "Atlantic Time"],
  ["America/New_York", "Eastern Time"], ["America/Chicago", "Central Time"],
  ["America/Denver", "Mountain Time"], ["America/Phoenix", "Arizona Time"],
  ["America/Los_Angeles", "Pacific Time"], ["America/Anchorage", "Alaska Time"],
  ["Pacific/Honolulu", "Hawaii Time"], ["UTC", "UTC"],
  ["Europe/London", "United Kingdom"], ["Europe/Paris", "Central European Time"],
  ["Europe/Berlin", "Germany"], ["Africa/Johannesburg", "South Africa"],
  ["Asia/Dubai", "Gulf Time"], ["Asia/Kolkata", "India Time"],
  ["Asia/Bangkok", "Indochina Time"], ["Asia/Singapore", "Singapore Time"],
  ["Asia/Shanghai", "China Time"], ["Asia/Tokyo", "Japan Time"],
  ["Asia/Seoul", "Korea Time"], ["Australia/Sydney", "Sydney Time"],
  ["Australia/Brisbane", "Brisbane Time"], ["Australia/Perth", "Perth Time"],
  ["Pacific/Auckland", "New Zealand Time"]
] as const;

export type AvailabilityScope = "ongoing" | "week" | "two_weeks";
export type AvailabilityWindow = { day: number; slot: number; start: number; end: number };

export async function ensureAvailabilityTables(client: Client) {
  await client.query(`
    create table if not exists portal_member_availability_profiles (
      discord_user_id text primary key,
      time_zone text not null default 'America/Chicago',
      schedule_scope text not null default 'ongoing' check(schedule_scope in ('ongoing','week','two_weeks')),
      effective_from timestamptz not null default now(), expires_at timestamptz,
      last_confirmed_at timestamptz not null default now(),
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table if not exists portal_member_availability_windows (
      discord_user_id text not null references portal_member_availability_profiles(discord_user_id) on delete cascade,
      day_of_week integer not null check(day_of_week between 0 and 6),
      slot_index integer not null check(slot_index between 0 and 1),
      start_minute integer not null check(start_minute between 0 and 1439),
      end_minute integer not null check(end_minute between 1 and 1800),
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      primary key(discord_user_id,day_of_week,slot_index), check(end_minute > start_minute)
    );
    create index if not exists portal_member_availability_expiry_idx on portal_member_availability_profiles(expires_at);
    create index if not exists portal_member_availability_windows_day_idx on portal_member_availability_windows(day_of_week,start_minute,end_minute);
  `);
}

export async function clearExpiredAvailability(client: Client) {
  await client.query(`delete from portal_member_availability_profiles where schedule_scope<>'ongoing' and expires_at is not null and expires_at<=now();`);
}

export function isValidTimeZone(value: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date()); return true; }
  catch { return false; }
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {timeZone,year:"numeric",month:"2-digit",day:"2-digit",weekday:"short",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])) as Record<string,string>;
}

function zonedDateTimeToUtc(year:number,month:number,day:number,hour:number,minute:number,timeZone:string) {
  let value = Date.UTC(year,month-1,day,hour,minute,0);
  for(let iteration=0;iteration<3;iteration+=1){const p=zonedParts(new Date(value),timeZone);const represented=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second));value-=represented-Date.UTC(year,month-1,day,hour,minute,0);}
  return new Date(value);
}

export function availabilityExpiry(scope:AvailabilityScope,timeZone:string,now=new Date()) {
  if(scope==="ongoing") return null;
  return new Date(now.getTime()+(scope==="week"?7:14)*86400000);
}

export function ongoingReconfirmAt(lastConfirmedAt:string|Date){return new Date(new Date(lastConfirmedAt).getTime()+AVAILABILITY_STALE_DAYS*86400000);}

export async function requireAvailabilityMember(client:Client,discordUserId:string) {
  const result=await client.query(`select c.id::int,c.character_name,c.world from portal_discord_links dl join portal_characters c on c.id=dl.character_id where dl.discord_user_id=$1 and c.active=true and c.fc_membership_status='current' and exists(select 1 from portal_fc_verification verification where verification.id=1 and verification.status='verified') limit 1`,[discordUserId]);
  if(!result.rows[0]) throw new Error("Current verified FC membership is required to manage availability.");
  return result.rows[0] as {id:number;character_name:string;world:string};
}

export async function readAvailability(client:Client,discordUserId:string) {
  await ensureAvailabilityTables(client); await clearExpiredAvailability(client);
  const profile=(await client.query(`select *,schedule_scope='ongoing' and last_confirmed_at<now()-interval '${AVAILABILITY_STALE_DAYS} days' as stale from portal_member_availability_profiles where discord_user_id=$1`,[discordUserId])).rows[0]||null;
  const windows=profile?(await client.query(`select day_of_week::int as "day",slot_index::int as slot,start_minute::int as start,end_minute::int as "end" from portal_member_availability_windows where discord_user_id=$1 order by day_of_week,slot_index`,[discordUserId])).rows:[];
  return {profile,windows,reconfirmAt:profile?.schedule_scope==="ongoing"?ongoingReconfirmAt(profile.last_confirmed_at).toISOString():null};
}

export async function saveAvailability(client:Client,discordUserId:string,input:{timeZone:string;scope:AvailabilityScope;windows:AvailabilityWindow[]}) {
  if(!isValidTimeZone(input.timeZone)) throw new Error("Choose a valid timezone.");
  if(!["ongoing","week","two_weeks"].includes(input.scope)) throw new Error("Choose how long this schedule should remain active.");
  const windows=input.windows.filter((window,index,array)=>Number.isInteger(window.day)&&window.day>=0&&window.day<=6&&Number.isInteger(window.slot)&&window.slot>=0&&window.slot<=1&&Number.isInteger(window.start)&&window.start>=0&&window.start<1440&&Number.isInteger(window.end)&&window.end>window.start&&window.end<=1800&&array.findIndex((item)=>item.day===window.day&&item.slot===window.slot)===index);
  if(windows.length!==input.windows.length) throw new Error("One or more availability periods are invalid.");
  const expiresAt=availabilityExpiry(input.scope,input.timeZone);
  await client.query("begin");
  try{
    await client.query(`insert into portal_member_availability_profiles(discord_user_id,time_zone,schedule_scope,effective_from,expires_at,last_confirmed_at,created_at,updated_at) values($1,$2,$3,now(),$4,now(),now(),now()) on conflict(discord_user_id) do update set time_zone=excluded.time_zone,schedule_scope=excluded.schedule_scope,effective_from=now(),expires_at=excluded.expires_at,last_confirmed_at=now(),updated_at=now()`,[discordUserId,input.timeZone,input.scope,expiresAt?.toISOString()||null]);
    await client.query(`delete from portal_member_availability_windows where discord_user_id=$1`,[discordUserId]);
    for(const window of windows) await client.query(`insert into portal_member_availability_windows(discord_user_id,day_of_week,slot_index,start_minute,end_minute) values($1,$2,$3,$4,$5)`,[discordUserId,window.day,window.slot,window.start,window.end]);
    await client.query(`insert into portal_member_preferences(discord_user_id,event_time_zone,created_at,updated_at) values($1,$2,now(),now()) on conflict(discord_user_id) do update set event_time_zone=excluded.event_time_zone,updated_at=now()`,[discordUserId,input.timeZone]);
    await client.query("commit");
  }catch(error){await client.query("rollback");throw error;}
  return readAvailability(client,discordUserId);
}

function localSchedulePosition(date:Date,timeZone:string){const p=zonedParts(date,timeZone);return {day:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(p.weekday),minute:Number(p.hour)*60+Number(p.minute)};}

export async function buildAvailabilityPlanner(client:Client,viewerTimeZone:string,durationMinutes=120,weeks=4){
  await ensureAvailabilityTables(client);await clearExpiredAvailability(client);
  const duration=Math.max(30,Math.min(360,Math.round(durationMinutes/30)*30)),horizon=Math.max(1,Math.min(8,weeks))*7*24*60/30;
  const rows=(await client.query(`select p.discord_user_id,p.time_zone,p.schedule_scope,p.expires_at,p.last_confirmed_at,coalesce(c.display_name,c.character_name,dl.discord_display_name,'Unknown member') as display_name,w.day_of_week::int as "day",w.slot_index::int as slot,w.start_minute::int as start,w.end_minute::int as "end" from portal_member_availability_profiles p join portal_discord_links dl on dl.discord_user_id=p.discord_user_id join portal_characters c on c.id=dl.character_id and c.active=true and c.fc_membership_status='current' left join portal_member_availability_windows w on w.discord_user_id=p.discord_user_id where (p.schedule_scope<>'ongoing' and p.expires_at>now()) or (p.schedule_scope='ongoing' and p.last_confirmed_at>=now()-interval '${AVAILABILITY_STALE_DAYS} days') order by lower(coalesce(c.display_name,c.character_name)),w.day_of_week,w.slot_index`)).rows;
  const totalMembers=Number((await client.query(`select count(*)::int count from portal_discord_links dl join portal_characters c on c.id=dl.character_id where c.active=true and c.fc_membership_status='current'`)).rows[0]?.count||0);
  const members=new Map<string,{discordUserId:string;name:string;timeZone:string;scope:string;expiresAt:string|null;reconfirmAt:string|null;windows:AvailabilityWindow[]}>();
  for(const row of rows){if(!members.has(row.discord_user_id))members.set(row.discord_user_id,{discordUserId:row.discord_user_id,name:row.display_name,timeZone:row.time_zone,scope:row.schedule_scope,expiresAt:row.expires_at||null,reconfirmAt:row.schedule_scope==="ongoing"?ongoingReconfirmAt(row.last_confirmed_at).toISOString():null,windows:[]});if(row.day!==null)members.get(row.discord_user_id)!.windows.push({day:Number(row.day),slot:Number(row.slot),start:Number(row.start),end:Number(row.end)});}
  const start=new Date(Math.ceil((Date.now()+30*60000)/(30*60000))*30*60000),candidates=[] as Array<{startsAt:string;endsAt:string;date:string;time:string;label:string;count:number;members:string[]}>;
  for(let index=0;index<horizon;index+=1){const begins=new Date(start.getTime()+index*30*60000),ends=new Date(begins.getTime()+duration*60000),available=[] as string[];for(const member of members.values()){if(member.expiresAt&&ends>=new Date(member.expiresAt))continue;const local=localSchedulePosition(begins,member.timeZone);if(member.windows.some((window)=>window.day===local.day&&local.minute>=window.start&&local.minute+duration<=window.end))available.push(member.name);}if(!available.length)continue;const parts=zonedParts(begins,viewerTimeZone),date=`${parts.year}-${parts.month}-${parts.day}`,time=`${parts.hour}:${parts.minute}`;candidates.push({startsAt:begins.toISOString(),endsAt:ends.toISOString(),date,time,label:new Intl.DateTimeFormat("en-US",{timeZone:viewerTimeZone,weekday:"long",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(begins),count:available.length,members:available});}
  candidates.sort((a,b)=>b.count-a.count||a.startsAt.localeCompare(b.startsAt));const suggestions=[] as typeof candidates;for(const candidate of candidates){if(suggestions.some((item)=>Math.abs(new Date(item.startsAt).getTime()-new Date(candidate.startsAt).getTime())<duration*60000))continue;suggestions.push(candidate);if(suggestions.length>=8)break;}
  return {durationMinutes:duration,weeks,totalMembers,reportingMembers:members.size,missingMembers:Math.max(0,totalMembers-members.size),suggestions,members:[...members.values()]};
}
