import type { Client } from "pg";
import { CURATED_ACHIEVEMENT_GUIDE_IDS, getAchievementGuideLinks, type AchievementGuideLink } from "./achievement-guide-links";

export type CollectionKind = "achievements" | "titles";
export type CollectionGuideFilter = "all" | "detailed" | "category" | "none";
export type CollectionFilters = { search:string; type:string; category:string; patch:string; availability:string; ownership:"all"|"owned"|"missing"; guide:CollectionGuideFilter; page:number };
export type CollectionReward = { type:string; name:string|null };
export type CollectionAchievementSource = { achievementId:number; name:string; description:string|null; points:number; typeName:string|null; categoryName:string|null; owned:boolean; earnedAt:string|null; rewards:CollectionReward[]; guides:AchievementGuideLink[] };
export type CollectionCatalogRow = { id:number; name:string; alternateName:string|null; description:string|null; points:number; patch:string|null; expansion:string|null; iconUrl:string|null; typeName:string|null; categoryName:string|null; availability:string; availabilityReason:string|null; owned:boolean; earnedAt:string|null; sourceAchievement:string|null; sourceAchievementId:number|null; sources:CollectionAchievementSource[]; rewards:CollectionReward[]; guides:AchievementGuideLink[] };
export type CollectionCatalogPage = { rows:CollectionCatalogRow[]; total:number; page:number; totalPages:number; pageSize:number; owned:number; catalogTotal:number; pointsEarned:number; pointsTotal:number; types:string[]; categories:string[]; patches:string[]; syncStatus:{status:string;lastSuccessAt:string|null;message:string|null}|null };

export async function ensureAchievementCollectionTables(client:Client) {
  await client.query(`
    create table if not exists portal_achievements (achievement_id bigint primary key,name text not null,description text,points integer not null default 0,sort_order integer not null default 0,patch text,expansion text,owned_percent text,icon_url text,category_id integer,category_name text,type_id integer,type_name text,availability text not null default 'unknown',availability_reason text,active boolean not null default true,updated_at timestamptz not null default now());
    create table if not exists portal_titles (title_id bigint primary key,male_name text not null,female_name text,placement text not null default 'unknown',sort_order integer not null default 0,patch text,expansion text,owned_percent text,icon_url text,availability text not null default 'unknown',availability_reason text,active boolean not null default true,updated_at timestamptz not null default now());
    create table if not exists portal_title_achievements (title_id bigint not null references portal_titles(title_id) on delete cascade,achievement_id bigint not null references portal_achievements(achievement_id) on delete cascade,primary key (title_id,achievement_id));
    create table if not exists portal_achievement_rewards (achievement_id bigint not null references portal_achievements(achievement_id) on delete cascade,reward_type text not null,reward_key text not null,reward_name text,reward_data jsonb not null default '{}'::jsonb,primary key (achievement_id,reward_type,reward_key));
    create table if not exists portal_character_achievements (character_id bigint not null references portal_characters(id) on delete cascade,achievement_id bigint not null references portal_achievements(achievement_id) on delete cascade,earned_at timestamptz,first_seen_at timestamptz not null default now(),last_seen_at timestamptz not null default now(),primary key (character_id,achievement_id));
    create table if not exists portal_character_achievement_sync_state (character_id bigint primary key references portal_characters(id) on delete cascade,baseline_completed_at timestamptz,last_attempt_at timestamptz,last_success_at timestamptz,last_known_count integer not null default 0,status text not null default 'pending',message text,updated_at timestamptz not null default now());
    create index if not exists portal_achievements_filters_idx on portal_achievements (type_name,category_name,patch);
    create index if not exists portal_titles_filters_idx on portal_titles (patch,availability);
  `);
}

function mapReward(value:any):CollectionReward { return {type:String(value?.type||"reward"),name:value?.name||null}; }

export function mapCollectionCatalogRow(row:any):CollectionCatalogRow {
  const rawSources=Array.isArray(row.sources)?row.sources:[];
  const sources:CollectionAchievementSource[]=rawSources.map((source:any)=>{
    const achievementId=Number(source.achievementId||source.achievementid||0);
    const typeName=source.typeName||source.typename||null;
    const categoryName=source.categoryName||source.categoryname||null;
    return {achievementId,name:String(source.name||"Unknown achievement"),description:source.description||null,points:Number(source.points||0),typeName,categoryName,owned:source.owned===true,earnedAt:source.earnedAt||source.earnedat||null,rewards:(Array.isArray(source.rewards)?source.rewards:[]).map(mapReward),guides:getAchievementGuideLinks({achievementId,typeName,categoryName})};
  });
  const sourceAchievementId=row.source_achievement_id?Number(row.source_achievement_id):null;
  const directGuides=getAchievementGuideLinks({achievementId:sourceAchievementId,typeName:row.type_name,categoryName:row.category_name});
  const guides=[...directGuides,...sources.flatMap((source)=>source.guides)].filter((guide,index,all)=>all.findIndex((candidate)=>candidate.slug===guide.slug)===index);
  return {id:Number(row.id),name:String(row.name),alternateName:row.alternate_name||null,description:row.description||null,points:Number(row.points||0),patch:row.patch||null,expansion:row.expansion||null,iconUrl:row.icon_url||null,typeName:row.type_name||null,categoryName:row.category_name||null,availability:String(row.availability||"unknown"),availabilityReason:row.availability_reason||null,owned:row.owned===true,earnedAt:row.earned_at||null,sourceAchievement:row.source_achievement||null,sourceAchievementId,sources,rewards:(Array.isArray(row.rewards)?row.rewards:[]).map(mapReward),guides};
}

export async function getCollectionCatalogPage(client:Client,kind:CollectionKind,characterId:number|null,filters:CollectionFilters):Promise<CollectionCatalogPage> {
  const pageSize=48; const page=Math.max(1,filters.page||1); const offset=(page-1)*pageSize;
  const params=[characterId,filters.search,filters.type,filters.category,filters.patch,filters.availability,filters.ownership,pageSize,offset,filters.guide,CURATED_ACHIEVEMENT_GUIDE_IDS];
  const achievementOwned=`(ca.achievement_id is not null)`;
  const titleOwned=`exists (select 1 from portal_title_achievements owned_ta join portal_character_achievements owned_ca on owned_ca.achievement_id=owned_ta.achievement_id and owned_ca.character_id=$1 where owned_ta.title_id=t.title_id)`;
  const achievementGuideSql=`($10='all' or ($10='detailed' and a.achievement_id=any($11::bigint[])) or ($10='category' and not (a.achievement_id=any($11::bigint[]))) or $10='none' and false)`;
  const titleHasSource=`exists (select 1 from portal_title_achievements guide_ta where guide_ta.title_id=t.title_id)`;
  const titleHasDetailedGuide=`exists (select 1 from portal_title_achievements guide_ta where guide_ta.title_id=t.title_id and guide_ta.achievement_id=any($11::bigint[]))`;
  const titleGuideSql=`($10='all' or ($10='detailed' and ${titleHasDetailedGuide}) or ($10='category' and ${titleHasSource} and not ${titleHasDetailedGuide}) or ($10='none' and not ${titleHasSource}))`;
  const rowsSql=kind==="achievements"?`
    select a.achievement_id::int id,a.name,null::text alternate_name,a.description,a.points,a.patch,a.expansion,a.icon_url,a.type_name,a.category_name,a.availability,a.availability_reason,${achievementOwned} owned,ca.earned_at,null::text source_achievement,a.achievement_id::int source_achievement_id,'[]'::jsonb sources,
      coalesce((select jsonb_agg(jsonb_build_object('type',r.reward_type,'name',r.reward_name) order by r.reward_type,r.reward_name) from portal_achievement_rewards r where r.achievement_id=a.achievement_id),'[]'::jsonb) rewards,
      count(*) over()::int matching_total
    from portal_achievements a left join portal_character_achievements ca on ca.achievement_id=a.achievement_id and ca.character_id=$1
    where a.active=true and ($2='' or a.name ilike '%'||$2||'%' or coalesce(a.description,'') ilike '%'||$2||'%') and ($3='' or a.type_name=$3) and ($4='' or a.category_name=$4) and ($5='' or a.patch=$5) and ($6='' or a.availability=$6) and ($7='all' or ($7='owned' and ${achievementOwned}) or ($7='missing' and not ${achievementOwned})) and ${achievementGuideSql}
    order by lower(a.name),a.achievement_id limit $8 offset $9`:`
    select t.title_id::int id,t.male_name name,case when nullif(t.female_name,'') is distinct from t.male_name then t.female_name else null end alternate_name,primary_source.description,coalesce(primary_source.points,0) points,t.patch,t.expansion,t.icon_url,primary_source.type_name,primary_source.category_name,t.availability,t.availability_reason,${titleOwned} owned,
      (select max(earned_ca.earned_at) from portal_title_achievements earned_ta join portal_character_achievements earned_ca on earned_ca.achievement_id=earned_ta.achievement_id and earned_ca.character_id=$1 where earned_ta.title_id=t.title_id) earned_at,
      primary_source.name source_achievement,primary_source.achievement_id::int source_achievement_id,coalesce(source_rollup.sources,'[]'::jsonb) sources,'[]'::jsonb rewards,count(*) over()::int matching_total
    from portal_titles t
    left join lateral (select a.achievement_id,a.name,a.description,a.points,a.type_name,a.category_name from portal_title_achievements ta join portal_achievements a on a.achievement_id=ta.achievement_id where ta.title_id=t.title_id order by lower(a.name),a.achievement_id limit 1) primary_source on true
    left join lateral (
      select jsonb_agg(jsonb_build_object('achievementId',a.achievement_id::int,'name',a.name,'description',a.description,'points',a.points,'typeName',a.type_name,'categoryName',a.category_name,'owned',(ca.achievement_id is not null),'earnedAt',ca.earned_at,'rewards',coalesce((select jsonb_agg(jsonb_build_object('type',r.reward_type,'name',r.reward_name) order by r.reward_type,r.reward_name) from portal_achievement_rewards r where r.achievement_id=a.achievement_id),'[]'::jsonb)) order by lower(a.name),a.achievement_id) sources
      from portal_title_achievements ta join portal_achievements a on a.achievement_id=ta.achievement_id left join portal_character_achievements ca on ca.achievement_id=a.achievement_id and ca.character_id=$1 where ta.title_id=t.title_id
    ) source_rollup on true
    where t.active=true
      and ($2='' or t.male_name ilike '%'||$2||'%' or coalesce(t.female_name,'') ilike '%'||$2||'%' or exists (select 1 from portal_title_achievements search_ta join portal_achievements search_a on search_a.achievement_id=search_ta.achievement_id where search_ta.title_id=t.title_id and (search_a.name ilike '%'||$2||'%' or coalesce(search_a.description,'') ilike '%'||$2||'%')))
      and ($3='' or exists (select 1 from portal_title_achievements type_ta join portal_achievements type_a on type_a.achievement_id=type_ta.achievement_id where type_ta.title_id=t.title_id and type_a.type_name=$3))
      and ($4='' or exists (select 1 from portal_title_achievements category_ta join portal_achievements category_a on category_a.achievement_id=category_ta.achievement_id where category_ta.title_id=t.title_id and category_a.category_name=$4))
      and ($5='' or t.patch=$5) and ($6='' or t.availability=$6)
      and ($7='all' or ($7='owned' and ${titleOwned}) or ($7='missing' and not ${titleOwned})) and ${titleGuideSql}
    order by lower(t.male_name),t.title_id limit $8 offset $9`;
  const rowsResult=await client.query(rowsSql,params);
  const statsResult=await client.query(`select (select count(*)::int from portal_achievements where active=true) achievements_total,(select coalesce(sum(points),0)::int from portal_achievements where active=true) points_total,(select count(*)::int from portal_character_achievements where character_id=$1) achievements_owned,(select count(distinct ta.title_id)::int from portal_title_achievements ta join portal_character_achievements ca on ca.achievement_id=ta.achievement_id and ca.character_id=$1 join portal_titles t on t.title_id=ta.title_id and t.active=true) titles_owned,(select coalesce(sum(a.points),0)::int from portal_character_achievements ca join portal_achievements a on a.achievement_id=ca.achievement_id where ca.character_id=$1) points_earned,(select count(*)::int from portal_titles where active=true) titles_total`,[characterId]);
  const optionResult=await client.query(`select array(select distinct type_name from portal_achievements where active=true and type_name is not null order by type_name) types,array(select distinct category_name from portal_achievements where active=true and category_name is not null order by category_name) categories,array(select distinct patch from ${kind==="titles"?"portal_titles":"portal_achievements"} where active=true and patch is not null order by patch desc) patches`);
  const syncResult=characterId?await client.query(`select status,last_success_at,message from portal_character_achievement_sync_state where character_id=$1`,[characterId]):{rows:[]};
  const total=Number(rowsResult.rows[0]?.matching_total||0);const stats=statsResult.rows[0]||{};const options=optionResult.rows[0]||{};
  return {rows:rowsResult.rows.map(mapCollectionCatalogRow),total,page,totalPages:Math.max(1,Math.ceil(total/pageSize)),pageSize,owned:Number(kind==="titles"?stats.titles_owned:stats.achievements_owned||0),catalogTotal:Number(kind==="titles"?stats.titles_total:stats.achievements_total||0),pointsEarned:Number(stats.points_earned||0),pointsTotal:Number(stats.points_total||0),types:options.types||[],categories:options.categories||[],patches:options.patches||[],syncStatus:syncResult.rows[0]?{status:String(syncResult.rows[0].status),lastSuccessAt:syncResult.rows[0].last_success_at||null,message:syncResult.rows[0].message||null}:null};
}
