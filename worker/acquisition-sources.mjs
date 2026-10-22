export const ACQUISITION_DATA_REVISION='53405826790e1405831003a75935d9eb66c2dd0a';
export const ACQUISITION_DATA_URL=`https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/${ACQUISITION_DATA_REVISION}/libs/data/src/lib/json`;
const integer=n=>Number.isSafeInteger(Number(n))&&Number(n)>0?Number(n):null;
const coord=n=>n!=null&&Number.isFinite(Number(n))?Math.round(Number(n)*100)/100:null;
export function buildAcquisitionSources(ids,{nodes,maps,places,drops,mobs,monsters},revision=ACQUISITION_DATA_REVISION){
 const result=new Map(),place=id=>places?.[String(id)]?.en||null;
 for(const [nodeId,node]of Object.entries(nodes||{})){
  const map=maps?.[String(node.map)],zoneId=integer(map?.placename_id)||integer(node.zoneid),location=place(zoneId);if(!location||!Array.isArray(node.items))continue;
  for(const itemXivapiId of new Set([...node.items,...(node.hiddenItems||[])])){
   const itemId=ids.get(Number(itemXivapiId));if(!itemId)continue;
   const method=['Mining','Quarrying','Logging','Harvesting'][node.type];if(!method)continue;
   const externalKey=`teamcraft_gathering_${itemXivapiId}_${nodeId}`;
   const spawns=(node.spawns||[]).filter(n=>Number.isInteger(n)&&n>=0&&n<24);
   result.set(externalKey,{itemId,externalKey,type:'gathering',name:method,location,details:{nodeId:Number(nodeId),gatheringPointBaseId:node.base,level:node.level,job:node.type<2?'Miner':'Botanist',zoneId,mapId:integer(node.map),area:place(node.zoneid),x:coord(node.x),y:coord(node.y),coordinateKind:'gathering area center',hidden:(node.hiddenItems||[]).includes(itemXivapiId),limited:!!node.limited,legendary:!!node.legendary,ephemeral:!!node.ephemeral,times:spawns.length?`Eorzea time: ${spawns.map(h=>String(h).padStart(2,'0')+':00').join(', ')}; duration ${node.duration} Eorzea minutes`:null,unlock:null,dataRevision:revision}});
  }
 }
 for(const [item,list]of Object.entries(drops||{})){
  const itemId=ids.get(Number(item));if(!itemId||!Array.isArray(list))continue;
  for(const monsterId of new Set(list)){
   if(!integer(monsterId))continue;const name=mobs?.[String(monsterId)]?.en;if(!name)continue;
   const positions=monsters?.[String(monsterId)]?.positions||[],zones=new Map();
   for(const p of positions){const map=maps?.[String(p.map)],zoneId=integer(map?.placename_id)||integer(p.zoneid),location=place(zoneId);if(!location)continue;const key=zoneId+':'+(p.map||0),prev=zones.get(key);if(prev)prev.positions.push({x:coord(p.x),y:coord(p.y),level:p.level,fate:p.fate});else zones.set(key,{zoneId,location,mapId:integer(p.map),x:coord(p.x),y:coord(p.y),level:p.level,positions:[{x:coord(p.x),y:coord(p.y),level:p.level,fate:p.fate}]});}
   if(!zones.size)zones.set('unknown',{zoneId:null,location:null,mapId:null,x:null,y:null,level:null,positions:[]});
   for(const zone of zones.values()){const externalKey=`teamcraft_monster_${item}_${monsterId}_${zone.zoneId||0}_${zone.mapId||0}`;result.set(externalKey,{itemId,externalKey,type:'other',name:'Monster drop: '+name,location:zone.location,details:{...zone,monsterId:Number(monsterId),fateOnly:zone.positions.length>0&&zone.positions.every(p=>p.fate>0),coordinateKind:zone.positions.length?'known monster spawn; drop not guaranteed':'spawn location unverified',dataRevision:revision}});}
  }
 }
 return [...result.values()];
}
export async function syncAcquisitionSources(client,{fetchJson,intervalHours=168,force=false,baseUrl}={}){
 const key='gathering_acquisition_v3';await client.query('insert into portal_crafting_source_sync_state(source_key) values($1) on conflict do nothing',[key]);
 const state=(await client.query('select last_successful_sync_at from portal_crafting_source_sync_state where source_key=$1',[key])).rows[0];
 if(!force&&state?.last_successful_sync_at&&Date.now()-new Date(state.last_successful_sync_at).getTime()<Math.max(1,intervalHours)*3600000)return 'Gathering and monster-drop acquisition data is current.';
 await client.query('update portal_crafting_source_sync_state set last_attempt_at=now(),last_error=null where source_key=$1',[key]);
 try{
  const get=fetchJson|| (async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Acquisition download failed: '+r.status);return r.json();});
  let revision=ACQUISITION_DATA_REVISION;
  if(!baseUrl){const upstream=await get('https://api.github.com/repos/ffxiv-teamcraft/ffxiv-teamcraft/commits/staging');if(!/^[a-f0-9]{40}$/.test(upstream?.sha||''))throw Error('Unable to verify acquisition dataset revision; existing sources retained.');revision=upstream.sha;baseUrl='https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/'+revision+'/libs/data/src/lib/json';}
  const files=['nodes','maps','places','drop-sources','mobs','monsters'],data=await Promise.all(files.map(f=>get(baseUrl+'/'+f+'.json')));
  if(Object.keys(data[0]||{}).length<100||Object.keys(data[3]||{}).length<100)throw Error('Incomplete acquisition dataset; existing sources retained.');
  const db=(await client.query("select id::int,xivapi_id::int from portal_crafting_items where source_kind='xivapi'")).rows,ids=new Map(db.map(r=>[r.xivapi_id,r.id]));
  const all=buildAcquisitionSources(ids,{nodes:data[0],maps:data[1],places:data[2],drops:data[3],mobs:data[4],monsters:data[5]},revision);if(all.filter(s=>s.type==='gathering').length<500)throw Error('Unexpected gathering coverage; existing sources retained.');
  await client.query('begin');try{
   // Replace only this importer's managed records, including the old incorrect ID mapping.
   await client.query("delete from portal_crafting_item_sources where (source_kind='xivapi' and external_key like 'xivapi_gathering_%') or (source_kind='teamcraft' and (external_key like 'teamcraft_gathering_%' or external_key like 'teamcraft_monster_%'))");
   for(let i=0;i<all.length;i+=500)await client.query(`insert into portal_crafting_item_sources(item_id,external_key,source_type,source_name,location_name,details,source_kind,last_synced_at,updated_at) select item_id,external_key,type,name,location,details,'teamcraft',now(),now() from jsonb_to_recordset($1::jsonb) as r(item_id bigint,external_key text,type text,name text,location text,details jsonb)`,[JSON.stringify(all.slice(i,i+500).map(s=>({item_id:s.itemId,external_key:s.externalKey,type:s.type,name:s.name,location:s.location,details:s.details})))]);
   await client.query('update portal_crafting_source_sync_state set last_successful_sync_at=now(),last_error=null,updated_at=now() where source_key=$1',[key]);await client.query('commit');
  }catch(e){await client.query('rollback');throw e;}
  return `Acquisition import complete: ${all.filter(s=>s.type==='gathering').length} gathering locations, ${all.filter(s=>s.type==='other').length} monster-drop locations; ${new Set(all.map(s=>s.itemId)).size} items covered.`;
 }catch(e){await client.query('update portal_crafting_source_sync_state set last_error=$1,updated_at=now() where source_key=$2',[String(e.message||e),key]);throw e;}
}
