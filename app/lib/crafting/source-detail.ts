import {Client}from 'pg';
const cache=new Map<string,{expires:number;value:any}>();
async function api(path:string){const response=await fetch('https://v2.xivapi.com/api/'+path,{signal:AbortSignal.timeout(12000),cache:'no-store'});if(!response.ok)throw Error('Verified game-data lookup is temporarily unavailable.');return response.json();}
export async function sourceDetail(kind:string,id:number){
 if(!['source','recipe'].includes(kind)||!Number.isSafeInteger(id)||id<1)throw Error('Choose a valid source or recipe.');
 const key=kind+':'+id,old=cache.get(key);if(old&&old.expires>Date.now())return old.value;
 const db=new Client({connectionString:process.env.DATABASE_URL});await db.connect();let row:any;try{row=(await db.query(kind==='source'?`select id,source_type,location_name,details,last_synced_at from portal_crafting_item_sources where id=$1`:`select xivapi_id from portal_crafting_recipes where id=$1 and source_kind='xivapi'`,[id])).rows[0];}finally{await db.end();}if(!row)throw Error('Catalog record not found.');
 let value:any;
 if(kind==='recipe'){
  const data=await api(`sheet/Recipe/${Number(row.xivapi_id)}?fields=SecretRecipeBook.Name,SecretRecipeBook.Item.Name,IsSpecializationRequired,RequiredStatus.Name`),f=data.fields;
  value={bookVerified:f.SecretRecipeBook!=null,book:f.SecretRecipeBook?.value?f.SecretRecipeBook.fields?.Item?.fields?.Name||f.SecretRecipeBook.fields?.Name||'Master recipe book required':null,specialist:typeof f.IsSpecializationRequired==='boolean'?f.IsSpecializationRequired:null,requiredStatus:f.RequiredStatus?.fields?.Name||null,checkedAt:new Date().toISOString()};
 }else{
  const d=row.details||{};let maps:any[]=[];
  if(Number.isInteger(d.mapId)&&d.mapId>0){const data=await api(`sheet/Map/${d.mapId}?fields=Id,SizeFactor,PlaceName.Name,PlaceNameSub.Name`);if(data.fields)maps=[data.fields];}
  else if(Number.isInteger(d.gatheringPointId)&&d.gatheringPointId>0){const data=await api(`sheet/GatheringPoint/${d.gatheringPointId}?fields=TerritoryType.Map.Id,TerritoryType.Map.SizeFactor,TerritoryType.Map.PlaceName.Name,TerritoryType.Map.PlaceNameSub.Name`);const map=data.fields?.TerritoryType?.fields?.Map?.fields;if(map)maps=[map];}
  else if(Number.isInteger(d.zoneId)&&d.zoneId>0){const p=new URLSearchParams({sheets:'Map',query:'+PlaceName='+d.zoneId,fields:'Id,SizeFactor,PlaceName.Name,PlaceNameSub.Name',limit:'20'});const data=await api('search?'+p);maps=(data.results||[]).map((r:any)=>r.fields);}
  value={maps:maps.filter(m=>/^[a-z0-9]+\/\d{2}$/.test(m.Id||'')).map(m=>({id:m.Id,size:m.SizeFactor,name:m.PlaceNameSub?.fields?.Name||m.PlaceName?.fields?.Name||row.location_name,image:'https://v2.xivapi.com/api/asset/map/'+m.Id})),x:d.x??null,y:d.y??null,coordinateKind:d.coordinateKind||null,level:d.level||null,job:d.job||null,area:d.area||null,location:row.location_name,recordUpdatedAt:row.last_synced_at,checkedAt:new Date().toISOString(),unlock:d.unlock||null,times:d.times||null};
 }
 if(cache.size>=200)cache.clear();cache.set(key,{expires:Date.now()+3600000,value});return value;
}
