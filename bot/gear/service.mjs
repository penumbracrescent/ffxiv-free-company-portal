import vendorData from './vendors.json' with {type:'json'};
import {JOBS,SLOTS,normalizeItem,statScore,validateInput,marketOffer,unconditionalMerchants} from './core.mjs';
const cache=new Map();
async function json(url){const response=await fetch(url,{signal:AbortSignal.timeout(15000),cache:'no-store',headers:{'User-Agent':'CotF-GearPlanner/1.0'}});if(!response.ok)throw Error(`Data source returned ${response.status}`);return response.json();}
async function cached(key,ttl,fn){const old=cache.get(key);if(old&&old.expires>Date.now())return old.promise;const promise=fn();cache.set(key,{promise,expires:Date.now()+ttl});try{return await promise;}catch(e){cache.delete(key);throw e;}finally{if(cache.size>200)for(const [k,v]of cache)if(v.expires<Date.now())cache.delete(k);}}
export async function worlds(){return cached('worlds',86400000,async()=>{const [worlds,dcs]=await Promise.all([json('https://universalis.app/api/v2/worlds'),json('https://universalis.app/api/v2/data-centers')]);return dcs.filter(dc=>['North-America','Europe','Japan','Oceania'].includes(dc.region)).flatMap(dc=>dc.worlds.map(id=>({id,name:worlds.find(w=>w.id===id)?.name,dc:dc.name,region:dc.region}))).filter(w=>w.name).sort((a,b)=>a.name.localeCompare(b.name));});}
const fields='Name,LevelEquip,LevelItem.Strength,EquipSlotCategory,ClassJobCategory,BaseParam[].Name,BaseParamValue,BaseParamSpecial[].Name,BaseParamValueSpecial,CanBeHq,IsUntradable,IsUnique,Icon,DamageMag,DamagePhys,DefensePhys,DefenseMag,Block,BlockRate';
export async function catalog(job,level){return cached(`catalog:${job}:${level}`,86400000,async()=>{
 const items=[];let cursor=null;
 for(let page=0;page<30;page++){
  const p=new URLSearchParams({sheets:'Item',limit:'100',fields,query:`+ClassJobCategory.${job}=true +LevelEquip<=${level} +LevelEquip>=${Math.max(1,level-25)} -Name~"Dated "`});if(cursor)p.set('cursor',cursor);
  const result=await json('https://v2.xivapi.com/api/search?'+p);items.push(...result.results.map(normalizeItem));cursor=result.next;if(!cursor)break;
 }
 if(cursor)throw Error('Equipment catalogue exceeded its safe query limit.');
 // Retain the six strongest purchasable and three other acquisition alternatives per slot.
 const selected=new Map();for(const slot of SLOTS){const pool=items.filter(i=>i.slots[slot]>0&&statScore(i,i.hq?'HQ':'NQ',job)>0).sort((a,b)=>statScore(b,b.hq?'HQ':'NQ',job)-statScore(a,a.hq?'HQ':'NQ',job));for(const item of [...pool.filter(i=>i.tradable).slice(0,6),...pool.filter(i=>vendorData.vendors[i.id]?.some(v=>v.type==='GilShop')).slice(0,3),...pool.filter(i=>i.tradable&&i.level<=level-3).slice(0,2),...pool.filter(i=>!i.tradable).slice(0,3)])selected.set(item.id,item);}
 return [...selected.values()];
});}
export async function calculate(input){
 const valid=validateInput(input),worldList=await worlds(),home=worldList.find(w=>w.id===valid.world);if(!home)throw Error('Unsupported home world.');
 const allowed=worldList.filter(w=>valid.scope==='home'?w.id===home.id:valid.scope==='dc'?w.dc===home.dc:w.region===home.region),area=valid.scope==='home'?String(home.id):valid.scope==='dc'?home.dc:home.region;
 const items=await catalog(valid.job,valid.level),offers={},warnings=[];
 for(const item of items){offers[item.id]=[];for(const shop of vendorData.vendors[item.id]||[]){const merchants=unconditionalMerchants(shop);if(merchants.length&&shop.type==='GilShop'&&shop.quality==='NQ'&&shop.currencies.length===1&&shop.currencies[0].id===1)offers[item.id].push({key:`vendor:${item.id}:${shop.shopId}`,kind:'vendor',quality:'NQ',price:shop.currencies[0].amount,quantity:1,merchants});}item.acquisition=(vendorData.vendors[item.id]||[]).map(shop=>({...shop,conditional:!unconditionalMerchants(shop).length}));}
 const ids=items.filter(i=>i.tradable).map(i=>i.id);
 for(let i=0;i<ids.length;i+=30){const chunk=ids.slice(i,i+30);
  const requests=[{area,hq:false},{area,hq:true},...(area!==String(home.id)?[{area:String(home.id),hq:false},{area:String(home.id),hq:true}]:[])];
  await Promise.all(requests.map(async request=>{try{
   const result=await json(`https://universalis.app/api/v2/${encodeURIComponent(request.area)}/${chunk.join(',')}?listings=20&entries=0&hq=${request.hq}`);
   const records=result.items||{[result.itemID]:result};for(const [id,record]of Object.entries(records)){for(const listing of record.listings||[]){const o=marketOffer(listing,Number(id),request.area===String(home.id)?home.id:0);if(o&&allowed.some(w=>w.id===o.world)&&offers[id]&&!offers[id].some(e=>e.key===o.key)){o.worldName=worldList.find(w=>w.id===o.world)?.name;offers[id].push(o);}}}
  }catch{warnings.push('Some market prices could not be fetched. Missing listings are not counted as free.');}}));
 }
 return {...valid,home,items,offers,warnings:[...new Set(warnings)],queriedAt:new Date().toISOString(),catalogWindow:`Level ${Math.max(1,valid.level-25)}–${valid.level}`,vendorCommit:vendorData.commit};
}
export {JOBS};
