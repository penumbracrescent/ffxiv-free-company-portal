export function buildCatalogue(data,revision){
 const {nodes,items,maps,places,icons,flags,collectables,aetherytes,gatheringItems,reduce}=data;
 const metadata=new Map(Object.values(gatheringItems).map(x=>[x.itemId,x]));const results=[];
 for(const [id,node]of Object.entries(nodes)){
  const spawns=(node.spawns||[]).filter(h=>Number.isInteger(h)&&h>=0&&h<24);
  if(!spawns.length||!Number.isFinite(node.duration)||node.duration<=0||node.duration>1440||![0,1,2,3].includes(node.type))continue;
  const map=maps[node.map],location=places[map?.placename_id]?.en||places[node.zoneid]?.en;if(!location)continue;
  const travel=Object.values(aetherytes).filter(a=>a.map===node.map&&a.type===0&&Number.isFinite(a.x)&&Number.isFinite(a.y)).sort((a,b)=>Math.hypot(a.x-node.x,a.y-node.y)-Math.hypot(b.x-node.x,b.y-node.y))[0];
  for(const itemId of new Set([...(node.items||[]),...(node.hiddenItems||[])])){
   const name=items[itemId]?.en;if(!name)continue;const meta=metadata.get(itemId)||{},icon=icons[itemId],reward=collectables[itemId];
   results.push({key:id+':'+itemId,nodeId:Number(id),itemId,name,icon:typeof icon==='string'&&icon.startsWith('/api/asset?')?'https://v2.xivapi.com'+icon:null,job:node.type<2?'Miner':'Botanist',level:node.level,stars:meta.stars||0,perception:meta.perceptionReq||null,type:node.ephemeral?'Ephemeral':node.folklore?'Legendary':'Unspoiled',collectable:!!flags[itemId]||!!reward,reduction:!!reduce[itemId],reward:reward?{name:items[reward.reward]?.en||'Scrip',base:reward.base,mid:reward.mid,high:reward.high}:null,location,area:places[node.zoneid]?.en||null,x:Number.isFinite(node.x)?Math.round(node.x*100)/100:null,y:Number.isFinite(node.y)?Math.round(node.y*100)/100:null,coordinateKind:'gathering area center',map:map?.image||null,mapSize:map?.size_factor||100,aetheryte:travel?places[travel.nameid]?.en||null:null,folklore:node.folklore?items[node.folklore]?.en||'Regional folklore book required':null,hidden:(node.hiddenItems||[]).includes(itemId),spawns,duration:node.duration,revision});
  }
 }
 return results;
}
export async function downloadCatalogue(){
 async function json(url){const r=await fetch(url,{signal:AbortSignal.timeout(45000),headers:{'User-Agent':'COTF-Timed-Gathering'}});if(!r.ok)throw Error('Timed-node dataset unavailable: '+r.status);return r.json();}
 const commit=await json('https://api.github.com/repos/ffxiv-teamcraft/ffxiv-teamcraft/commits/staging');if(!/^[a-f0-9]{40}$/.test(commit.sha))throw Error('Unverified timed-node revision.');
 const base='https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/'+commit.sha+'/libs/data/src/lib/json/';
 const names={nodes:'nodes',items:'items',maps:'maps',places:'places',icons:'item-icons',flags:'collectable-flags',collectables:'collectables',aetherytes:'aetherytes',gatheringItems:'gathering-items',reduce:'aetherial-reduce'};
 const entries=await Promise.all(Object.entries(names).map(async([key,file])=>[key,await json(base+file+'.json')]));
 const nodes=buildCatalogue(Object.fromEntries(entries),commit.sha);if(nodes.length<200)throw Error('Incomplete timed-node import; keeping previous catalogue.');return {nodes,revision:commit.sha,importedAt:new Date().toISOString()};
}
