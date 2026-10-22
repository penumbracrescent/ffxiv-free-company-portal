import {Client} from 'pg';
export async function loadPersonalGraph(targets:number[]){
 if(!targets.length||targets.length>100||targets.some(id=>!Number.isSafeInteger(id)||id<1))throw Error('Choose between 1 and 100 valid crafts.');
 const client=new Client({connectionString:process.env.DATABASE_URL});await client.connect();
 try{
  await client.query('begin read only');await client.query("set local statement_timeout='8s'");
  const seen=new Set<number>(),recipes:any[]=[],ingredients:any[]=[];let pending=[...new Set(targets)];
  for(let depth=0;pending.length;depth++){
   if(depth>20||seen.size+pending.length>2000)throw Error('This list is too complex. Split it into smaller plans.');
   pending.forEach(id=>seen.add(id));
   const r=await client.query(`select id::int,output_item_id::int as "outputItemId",output_quantity as "outputQuantity",preferred,craft_job as job,class_job_level as level,xivapi_id as "xivapiId",required_craftsmanship as "requiredCraftsmanship",required_control as "requiredControl",can_hq as "canHq",is_expert as expert,is_collectable as collectable,stars from portal_crafting_recipes where output_item_id=any($1::bigint[]) and source_kind='xivapi' order by preferred desc,id`,[pending]);recipes.push(...r.rows);
   const ids=r.rows.map(x=>x.id);const ing=ids.length?await client.query(`select recipe_id::int as "recipeId",item_id::int as "itemId",quantity from portal_crafting_recipe_ingredients where recipe_id=any($1::bigint[])`,[ids]):{rows:[]};ingredients.push(...ing.rows);
   pending=[...new Set<number>(ing.rows.map((x:any)=>x.itemId))].filter(id=>!seen.has(id));
  }
  const items=await client.query(`select id::int,name,icon_url as "iconUrl",xivapi_id as "xivapiId",can_be_hq as "canBeHq",is_raw as "isRaw",item_category as category,level_equip as level,item_level as "itemLevel",last_synced_at as "syncedAt" from portal_crafting_items where id=any($1::bigint[]) and source_kind='xivapi'`,[[...seen]]);
  if(items.rows.length!==seen.size)throw Error('One or more materials lack a complete catalog entry. Refresh the catalog and retry.');
  const sources=await client.query(`select id::int,item_id::int as "itemId",source_type as type,source_name as name,location_name as location,details,last_synced_at as "syncedAt" from portal_crafting_item_sources where item_id=any($1::bigint[]) order by location_name,source_name`,[[...seen]]);
  await client.query('commit');
  return {items:items.rows.map(i=>({...i,isRaw:!recipes.some(r=>r.outputItemId===i.id),sources:sources.rows.filter(s=>s.itemId===i.id)})),recipes:recipes.map(r=>({...r,ingredients:ingredients.filter(i=>i.recipeId===r.id)})),loadedAt:new Date().toISOString()};
 }finally{await client.end();}
}
