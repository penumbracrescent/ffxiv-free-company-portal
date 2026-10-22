import {Client} from 'pg';
import {workshopUnlock} from './workshop-unlocks.mjs';
export async function soloWorkshopCatalogue(query:string,id?:number){
 if(query.length>80||id!=null&&(!Number.isSafeInteger(id)||id<1))throw Error('Invalid workshop query.');
 const client=new Client({connectionString:process.env.DATABASE_URL});await client.connect();
 try{
  await client.query('begin read only');await client.query("set local statement_timeout='8s'");
  const templates=await client.query(`select t.id::int,t.xivapi_id as "xivapiId",t.name,t.category,t.description,t.last_synced_at as "syncedAt",
    (select i.icon_url from portal_crafting_items i where i.name=t.name and i.source_kind='xivapi' limit 1) as "iconUrl",
    (select count(*)::int from portal_crafting_workshop_template_phases p where p.template_id=t.id) as "phaseCount"
    from portal_crafting_workshop_templates t where t.active and not t.is_development_fixture and t.source_kind='xivapi_company_craft'
    and ($1::bigint is null or t.id=$1) and ($1::bigint is not null or t.name ilike $2 or t.category ilike $2)
    order by t.category,t.name limit 40`,[id||null,'%'+query.trim().replace(/[%_\\]/g,'\\$&')+'%']);
  if(!id){await client.query('commit');return {workshops:templates.rows};}
  if(!templates.rows.length)throw Error('This workshop project is unavailable. Refresh the imported catalog.');
  const phases=await client.query(`select id::int,phase_number as number,title,description from portal_crafting_workshop_template_phases where template_id=$1 order by phase_number`,[id]);
  const materials=await client.query(`select m.template_phase_id::int as "phaseId",i.id::int,i.name,i.icon_url as "iconUrl",m.base_quantity as quantity,m.workshop_batch_quantity as "batchQuantity",m.base_batch_count as "batchCount"
   from portal_crafting_workshop_template_materials m join portal_crafting_items i on i.id=m.item_id where m.template_phase_id=any($1::bigint[]) order by m.sort_order,i.name`,[phases.rows.map(p=>p.id)]);
  if(!phases.rows.length||phases.rows.some(p=>!materials.rows.some(m=>m.phaseId===p.id)))throw Error('The workshop import is incomplete. Please refresh the catalog.');
  await client.query('commit');const unlocks=await workshopUnlock(templates.rows[0].xivapiId);return {workshop:{...templates.rows[0],unlocks,phases:phases.rows.map(p=>({...p,materials:materials.rows.filter(m=>m.phaseId===p.id)}))}};
 }finally{await client.end();}
}
