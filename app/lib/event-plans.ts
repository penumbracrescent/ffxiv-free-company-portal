import type { Client } from "pg";
import { AVAILABILITY_STALE_DAYS, type AvailabilityWindow } from "./availability";

export type EventPlanActor = { discordUserId: string; characterId: number; characterName: string; isOfficer: boolean };
export type EventPlanInput = {
  eventType: string; title: string; description?: string; dutyId?: number | null; mountId?: number | null;
  level?: number | null; partySize: number; standardRoles: boolean; startDate: string; endDate: string;
  durationMinutes: number; timeZone: string; targetChannelId: string; targetChannelName?: string;
};

export async function ensureEventPlanningTables(client: Client) {
  await client.query(`
    create table if not exists portal_event_plans (
      id bigserial primary key,
      status text not null default 'collecting' check(status in ('collecting','scheduled','cancelled','expired')),
      event_type text not null default 'custom', title text not null, description text not null default '',
      duty_id bigint references portal_discord_duties(id) on delete set null, duty_name text, duty_image_url text,
      mount_id bigint references portal_mounts(id) on delete set null, mount_name text, mount_image_url text,
      level integer, party_size integer not null default 8, standard_party_roles_required boolean not null default false,
      possible_start_date date not null, possible_end_date date not null, duration_minutes integer not null default 120,
      event_time_zone text not null default 'America/Chicago', target_channel_id text not null default '', target_channel_name text not null default '',
      created_by_discord_user_id text, created_by_character_id bigint references portal_characters(id) on delete set null,
      created_by text not null, discord_channel_id text, discord_message_id text,
      finalized_event_id bigint references portal_discord_events(id) on delete set null,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      cancelled_at timestamptz, cancelled_by text, sync_requested_at timestamptz, synced_at timestamptz,
      check(possible_end_date >= possible_start_date), check(duration_minutes between 30 and 480), check(party_size between 1 and 24)
    );
    create table if not exists portal_event_plan_interest (
      plan_id bigint not null references portal_event_plans(id) on delete cascade,
      discord_user_id text not null,
      character_id bigint references portal_characters(id) on delete set null,
      status text not null default 'interested' check(status in ('interested','withdrawn')),
      availability_source text check(availability_source in ('saved','plan')),
      availability_confirmed_at timestamptz,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      primary key(plan_id,discord_user_id)
    );
    create table if not exists portal_event_plan_availability_windows (
      plan_id bigint not null,
      discord_user_id text not null,
      day_of_week integer not null check(day_of_week between 0 and 6),
      slot_index integer not null check(slot_index between 0 and 1),
      start_minute integer not null check(start_minute between 0 and 1439),
      end_minute integer not null check(end_minute between 1 and 1800),
      time_zone text not null,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      primary key(plan_id,discord_user_id,day_of_week,slot_index),
      foreign key(plan_id,discord_user_id) references portal_event_plan_interest(plan_id,discord_user_id) on delete cascade,
      check(end_minute > start_minute)
    );
    create index if not exists portal_event_plans_status_dates_idx on portal_event_plans(status,possible_start_date,possible_end_date);
    create index if not exists portal_event_plan_interest_user_idx on portal_event_plan_interest(discord_user_id,status);
  `);
  await client.query(`alter table portal_event_plans alter column created_by_discord_user_id drop not null`);
  await client.query(`alter table portal_event_plans add column if not exists sync_requested_at timestamptz, add column if not exists synced_at timestamptz`);
  await client.query(`update portal_event_plans set status='expired',sync_requested_at=now(),updated_at=now() where status='collecting' and possible_end_date<current_date`);
}

function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T12:00:00Z`).getTime()); }

export async function createEventPlan(client: Client, actor: EventPlanActor, input: EventPlanInput) {
  await ensureEventPlanningTables(client);
  const title=String(input.title||"").trim(),description=String(input.description||"").trim();
  if(!title||title.length>150)throw new Error("Enter a planning title of 150 characters or fewer.");
  if(description.length>1500)throw new Error("Planning details must be 1,500 characters or fewer.");
  if(!validDate(input.startDate)||!validDate(input.endDate)||input.endDate<input.startDate)throw new Error("Choose a valid possible date range.");
  const span=(new Date(`${input.endDate}T12:00:00Z`).getTime()-new Date(`${input.startDate}T12:00:00Z`).getTime())/86400000;
  if(span>62)throw new Error("A planning window can cover no more than 63 days.");
  const duration=Math.round(Number(input.durationMinutes)/30)*30,partySize=Number(input.partySize);
  if(duration<30||duration>480)throw new Error("Duration must be between 30 minutes and 8 hours.");
  if(!Number.isInteger(partySize)||partySize<1||partySize>24)throw new Error("Party size must be between 1 and 24.");
  const duty=input.dutyId?(await client.query(`select id::int,name,level,image_url from portal_discord_duties where id=$1 and active=true`,[input.dutyId])).rows[0]:null;
  const mount=input.mountId?(await client.query(`select id::int,mount_name,coalesce(image_url,icon_url) image_url from portal_mounts where id=$1`,[input.mountId])).rows[0]:null;
  const result=await client.query(`insert into portal_event_plans(event_type,title,description,duty_id,duty_name,duty_image_url,mount_id,mount_name,mount_image_url,level,party_size,standard_party_roles_required,possible_start_date,possible_end_date,duration_minutes,event_time_zone,target_channel_id,target_channel_name,created_by_discord_user_id,created_by_character_id,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) returning id::int`,[input.eventType||"custom",title,description,duty?.id||null,duty?.name||null,duty?.image_url||null,mount?.id||null,mount?.mount_name||null,mount?.image_url||null,duty?.level||input.level||null,partySize,Boolean(input.standardRoles),input.startDate,input.endDate,duration,input.timeZone||"America/Chicago",input.targetChannelId,input.targetChannelName||"Party Planner",actor.discordUserId,actor.characterId,actor.characterName]);
  const planId=Number(result.rows[0].id);
  await client.query(`insert into portal_event_plan_interest(plan_id,discord_user_id,character_id,status) values($1,$2,$3,'interested') on conflict(plan_id,discord_user_id) do nothing`,[planId,actor.discordUserId,actor.characterId]);
  await attachSavedAvailability(client,planId,actor.discordUserId,actor.characterId);
  return planId;
}

export async function updateEventPlan(client:Client,planId:number,actor:EventPlanActor,input:EventPlanInput){
  await ensureEventPlanningTables(client);
  const existing=(await client.query(`select created_by_discord_user_id,status from portal_event_plans where id=$1`,[planId])).rows[0];
  if(!existing||existing.status!=="collecting")throw new Error("This planning request is no longer editable.");
  if(!actor.isOfficer&&existing.created_by_discord_user_id!==actor.discordUserId)throw new Error("Only the organizer or an officer can edit this request.");
  const title=String(input.title||"").trim(),description=String(input.description||"").trim();
  if(!title||title.length>150)throw new Error("Enter a planning title of 150 characters or fewer.");
  if(description.length>1500)throw new Error("Planning details must be 1,500 characters or fewer.");
  if(!validDate(input.startDate)||!validDate(input.endDate)||input.endDate<input.startDate)throw new Error("Choose a valid possible date range.");
  const span=(new Date(`${input.endDate}T12:00:00Z`).getTime()-new Date(`${input.startDate}T12:00:00Z`).getTime())/86400000;
  if(span>62)throw new Error("A planning window can cover no more than 63 days.");
  const duration=Math.round(Number(input.durationMinutes)/30)*30,partySize=Number(input.partySize);
  if(duration<30||duration>480||!Number.isInteger(partySize)||partySize<1||partySize>24)throw new Error("Choose a valid duration and party size.");
  const duty=input.dutyId?(await client.query(`select id::int,name,level,image_url from portal_discord_duties where id=$1 and active=true`,[input.dutyId])).rows[0]:null;
  const mount=input.mountId?(await client.query(`select id::int,mount_name,coalesce(image_url,icon_url) image_url from portal_mounts where id=$1`,[input.mountId])).rows[0]:null;
  await client.query(`update portal_event_plans set event_type=$2,title=$3,description=$4,duty_id=$5,duty_name=$6,duty_image_url=$7,mount_id=$8,mount_name=$9,mount_image_url=$10,level=$11,party_size=$12,standard_party_roles_required=$13,possible_start_date=$14,possible_end_date=$15,duration_minutes=$16,event_time_zone=$17,target_channel_id=$18,target_channel_name=$19,sync_requested_at=now(),updated_at=now() where id=$1`,[planId,input.eventType||"custom",title,description,duty?.id||null,duty?.name||null,duty?.image_url||null,mount?.id||null,mount?.mount_name||null,mount?.image_url||null,duty?.level||input.level||null,partySize,Boolean(input.standardRoles),input.startDate,input.endDate,duration,input.timeZone||"America/Chicago",input.targetChannelId,input.targetChannelName||"Party Planner"]);
}

export async function cancelEventPlan(client:Client,planId:number,actor:EventPlanActor){await ensureEventPlanningTables(client);const result=await client.query(`update portal_event_plans set status='cancelled',cancelled_at=now(),cancelled_by=$3,sync_requested_at=now(),updated_at=now() where id=$1 and status='collecting' and ($2 or created_by_discord_user_id=$4)`,[planId,actor.isOfficer,actor.characterName,actor.discordUserId]);if(!result.rowCount)throw new Error("Only the organizer or an officer can cancel an active request.");}

export async function attachSavedAvailability(client:Client,planId:number,discordUserId:string,characterId:number|null){
  await ensureEventPlanningTables(client);
  const active=(await client.query(`select 1 from portal_member_availability_profiles where discord_user_id=$1 and ((schedule_scope='ongoing' and last_confirmed_at>=now()-interval '${AVAILABILITY_STALE_DAYS} days') or (schedule_scope<>'ongoing' and expires_at>now())) and exists(select 1 from portal_member_availability_windows where discord_user_id=$1)`,[discordUserId])).rowCount>0;
  await client.query(`insert into portal_event_plan_interest(plan_id,discord_user_id,character_id,status,availability_source,availability_confirmed_at) values($1,$2,$3,'interested',$4,case when $5 then now() else null end) on conflict(plan_id,discord_user_id) do update set character_id=excluded.character_id,status='interested',availability_source=case when portal_event_plan_interest.availability_source='plan' then 'plan' else excluded.availability_source end,availability_confirmed_at=case when portal_event_plan_interest.availability_source='plan' then portal_event_plan_interest.availability_confirmed_at else excluded.availability_confirmed_at end,updated_at=now()`,[planId,discordUserId,characterId,active?'saved':null,active]);
  await client.query(`update portal_event_plans set sync_requested_at=now(),updated_at=now() where id=$1`,[planId]);
  return active;
}

export async function attachPlanAvailability(client:Client,planId:number,discordUserId:string,characterId:number,timeZone:string,windows:AvailabilityWindow[]){
  await ensureEventPlanningTables(client);
  const valid=windows.filter((window,index,array)=>Number.isInteger(window.day)&&window.day>=0&&window.day<=6&&Number.isInteger(window.slot)&&window.slot>=0&&window.slot<=1&&Number.isInteger(window.start)&&window.start>=0&&window.start<1440&&Number.isInteger(window.end)&&window.end>window.start&&window.end<=1800&&array.findIndex((item)=>item.day===window.day&&item.slot===window.slot)===index);
  if(valid.length!==windows.length||valid.length===0)throw new Error("Add at least one valid availability period for this plan.");
  await client.query("begin");try{
    await client.query(`insert into portal_event_plan_interest(plan_id,discord_user_id,character_id,status,availability_source,availability_confirmed_at) values($1,$2,$3,'interested','plan',now()) on conflict(plan_id,discord_user_id) do update set character_id=excluded.character_id,status='interested',availability_source='plan',availability_confirmed_at=now(),updated_at=now()`,[planId,discordUserId,characterId]);
    await client.query(`delete from portal_event_plan_availability_windows where plan_id=$1 and discord_user_id=$2`,[planId,discordUserId]);
    for(const window of valid)await client.query(`insert into portal_event_plan_availability_windows(plan_id,discord_user_id,day_of_week,slot_index,start_minute,end_minute,time_zone) values($1,$2,$3,$4,$5,$6,$7)`,[planId,discordUserId,window.day,window.slot,window.start,window.end,timeZone]);
    await client.query(`update portal_event_plans set sync_requested_at=now(),updated_at=now() where id=$1`,[planId]);
    await client.query("commit");
  }catch(error){await client.query("rollback");throw error;}
}

export async function withdrawEventPlanInterest(client:Client,planId:number,discordUserId:string){await ensureEventPlanningTables(client);await client.query(`update portal_event_plan_interest set status='withdrawn',availability_confirmed_at=null,updated_at=now() where plan_id=$1 and discord_user_id=$2`,[planId,discordUserId]);await client.query(`update portal_event_plans set sync_requested_at=now(),updated_at=now() where id=$1`,[planId]);}

function zonedParts(date:Date,timeZone:string){const parts=new Intl.DateTimeFormat("en-US",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);return Object.fromEntries(parts.filter((part)=>part.type!=="literal").map((part)=>[part.type,part.value])) as Record<string,string>;}
function zoneOffsetMs(at:Date,zone:string){const name=new Intl.DateTimeFormat("en-US",{timeZone:zone,timeZoneName:"longOffset"}).formatToParts(at).find(part=>part.type==="timeZoneName")?.value||"GMT+00:00",match=/GMT([+-])(\d{2}):?(\d{2})/.exec(name);if(!match)return 0;const minutes=Number(match[2])*60+Number(match[3]);return(match[1]==="-"?-1:1)*minutes*60000;}
function localDateTimeToUtc(date:string,minute:number,zone:string){const [year,month,day]=date.split("-").map(Number),wall=Date.UTC(year,month-1,day,Math.floor(minute/60),minute%60);let value=wall-zoneOffsetMs(new Date(wall),zone);value=wall-zoneOffsetMs(new Date(value),zone);return new Date(value);}
function dateKey(value:unknown){return value instanceof Date?value.toISOString().slice(0,10):String(value||"").slice(0,10);}
function addDate(date:string,amount:number){const value=new Date(`${date}T12:00:00Z`);value.setUTCDate(value.getUTCDate()+amount);return value.toISOString().slice(0,10);}
function dateInZone(value:Date,timeZone:string){const parts=new Intl.DateTimeFormat("en-US",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(value),part=(name:string)=>parts.find(item=>item.type===name)?.value||"";return`${part("year")}-${part("month")}-${part("day")}`;}
function memberWindowLabels(member:{timeZone:string;windows:AvailabilityWindow[]},plan:Record<string,unknown>,viewerTimeZone:string){const planZone=String(plan.event_time_zone||viewerTimeZone),rangeStart=localDateTimeToUtc(dateKey(plan.possible_start_date),0,planZone),rangeEnd=localDateTimeToUtc(addDate(dateKey(plan.possible_end_date),1),0,planZone),startFormat=new Intl.DateTimeFormat("en-US",{timeZone:viewerTimeZone,weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}),timeFormat=new Intl.DateTimeFormat("en-US",{timeZone:viewerTimeZone,hour:"numeric",minute:"2-digit"}),labels:string[]=[];for(let cursor=addDate(dateKey(plan.possible_start_date),-2),last=addDate(dateKey(plan.possible_end_date),2);cursor<=last;cursor=addDate(cursor,1)){const weekday=new Date(`${cursor}T12:00:00Z`).getUTCDay();for(const window of member.windows.filter(item=>item.day===weekday)){const starts=localDateTimeToUtc(cursor,window.start,member.timeZone),ends=localDateTimeToUtc(addDate(cursor,Math.floor(window.end/1440)),window.end%1440,member.timeZone);if(ends<=rangeStart||starts>=rangeEnd)continue;labels.push(`${startFormat.format(starts)}–${dateInZone(starts,viewerTimeZone)===dateInZone(ends,viewerTimeZone)?timeFormat.format(ends):startFormat.format(ends)}`);}}return labels;}

export async function getEventPlanDashboard(client:Client,discordUserId:string,isOfficer:boolean){
  await ensureEventPlanningTables(client);
  const plans=(await client.query(`select p.*,coalesce(i.status,'none') current_interest_status,i.availability_source,i.availability_confirmed_at,(select count(*)::int from portal_event_plan_interest x where x.plan_id=p.id and x.status='interested') interested_count,(select count(*)::int from portal_event_plan_interest x where x.plan_id=p.id and x.status='interested' and x.availability_confirmed_at is not null) availability_count,coalesce((select jsonb_agg(jsonb_build_object('day',w.day_of_week,'slot',w.slot_index,'start',w.start_minute,'end',w.end_minute) order by w.day_of_week,w.slot_index) from portal_event_plan_availability_windows w where w.plan_id=p.id and w.discord_user_id=$1),'[]'::jsonb) current_plan_availability_windows,(select max(w.time_zone) from portal_event_plan_availability_windows w where w.plan_id=p.id and w.discord_user_id=$1) current_plan_availability_time_zone from portal_event_plans p left join portal_event_plan_interest i on i.plan_id=p.id and i.discord_user_id=$1 where p.status='collecting' order by p.possible_start_date,p.id`,[discordUserId])).rows;
  const viewerTimeZone=String((await client.query(`select coalesce((select event_time_zone from portal_member_preferences where discord_user_id=$1),(select time_zone from portal_member_availability_profiles where discord_user_id=$1),'America/Chicago') time_zone`,[discordUserId])).rows[0]?.time_zone||"America/Chicago");
  const output=[];
  for(const plan of plans){const details=await buildEventPlanSuggestions(client,Number(plan.id),viewerTimeZone),canManage=isOfficer||plan.created_by_discord_user_id===discordUserId;output.push({...plan,id:Number(plan.id),party_size:Number(plan.party_size),duration_minutes:Number(plan.duration_minutes),interested_count:Number(plan.interested_count),availability_count:details.groups.confirmed.length,suggestions:details.suggestions.slice(0,5).map(suggestion=>isOfficer?suggestion:{...suggestion,members:[]}),groups:isOfficer?details.groups:null,can_manage:canManage});}
  return output;
}

export async function buildEventPlanSuggestions(client:Client,planId:number,viewerTimeZone:string){
  await ensureEventPlanningTables(client);
  const plan=(await client.query(`select * from portal_event_plans where id=$1`,[planId])).rows[0];if(!plan)throw new Error("Planning request was not found.");
  const interests=(await client.query(`select i.discord_user_id,i.status,i.availability_source,i.availability_confirmed_at,coalesce(c.display_name,c.character_name,dl.discord_display_name,'Unknown member') display_name,coalesce(a.time_zone,$2) time_zone,a.day,a.slot,a.start,a."end" from portal_event_plan_interest i left join portal_discord_links dl on dl.discord_user_id=i.discord_user_id left join portal_characters c on c.id=coalesce(i.character_id,dl.character_id) left join portal_member_availability_profiles p on p.discord_user_id=i.discord_user_id left join lateral (select pw.day_of_week as "day",pw.slot_index as slot,pw.start_minute as start,pw.end_minute as "end",pw.time_zone from portal_event_plan_availability_windows pw where i.availability_source='plan' and pw.plan_id=i.plan_id and pw.discord_user_id=i.discord_user_id union all select w.day_of_week,w.slot_index,w.start_minute,w.end_minute,p.time_zone from portal_member_availability_windows w where i.availability_source='saved' and w.discord_user_id=i.discord_user_id) a on true where i.plan_id=$1 order by lower(coalesce(c.display_name,c.character_name,dl.discord_display_name)),a.day,a.slot`,[planId,viewerTimeZone])).rows;
  const members=new Map<string,{discordUserId:string;name:string;status:string;source:string|null;confirmed:boolean;timeZone:string;windows:AvailabilityWindow[]}>();for(const row of interests){if(!members.has(row.discord_user_id))members.set(row.discord_user_id,{discordUserId:row.discord_user_id,name:row.display_name,status:row.status,source:row.availability_source||null,confirmed:Boolean(row.availability_confirmed_at),timeZone:row.time_zone||viewerTimeZone,windows:[]});if(row.day!==null)members.get(row.discord_user_id)!.windows.push({day:Number(row.day),slot:Number(row.slot),start:Number(row.start),end:Number(row.end)});}for(const member of members.values())member.confirmed=member.confirmed&&member.windows.length>0;
  const candidates=[] as Array<{startsAt:string;endsAt:string;label:string;count:number;members:string[]}>;const duration=Number(plan.duration_minutes);
  for(let cursor=dateKey(plan.possible_start_date);cursor<=dateKey(plan.possible_end_date);){for(let minute=0;minute<1440;minute+=30){const starts=localDateTimeToUtc(cursor,minute,plan.event_time_zone);if(starts.getTime()<Date.now()+30*60000)continue;const ends=new Date(starts.getTime()+duration*60000),available=[] as string[];for(const member of members.values()){if(member.status!=="interested"||!member.confirmed)continue;const local=zonedParts(starts,member.timeZone),day=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(local.weekday),localMinute=Number(local.hour)*60+Number(local.minute);if(member.windows.some(window=>window.day===day&&localMinute>=window.start&&localMinute+duration<=window.end))available.push(member.name);}if(available.length)candidates.push({startsAt:starts.toISOString(),endsAt:ends.toISOString(),label:new Intl.DateTimeFormat("en-US",{timeZone:viewerTimeZone,weekday:"long",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(starts),count:available.length,members:available});}cursor=addDate(cursor,1);}
  candidates.sort((a,b)=>b.count-a.count||a.startsAt.localeCompare(b.startsAt));const suggestions=[] as typeof candidates;for(const candidate of candidates){if(suggestions.some(item=>Math.abs(new Date(item.startsAt).getTime()-new Date(candidate.startsAt).getTime())<duration*60000))continue;suggestions.push(candidate);if(suggestions.length>=8)break;}
  const confirmed=[...members.values()].filter(member=>member.status==="interested"&&member.confirmed);return{plan,suggestions,groups:{viewerTimeZone,confirmed:confirmed.map(member=>member.name),confirmedSchedules:confirmed.map(member=>({discordUserId:member.discordUserId,name:member.name,source:member.source,timeZone:member.timeZone,windows:memberWindowLabels(member,plan,viewerTimeZone)})),awaiting:[...members.values()].filter(member=>member.status==="interested"&&!member.confirmed).map(member=>member.name),withdrawn:[...members.values()].filter(member=>member.status==="withdrawn").map(member=>member.name)}};
}
