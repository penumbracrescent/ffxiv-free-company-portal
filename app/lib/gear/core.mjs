export const JOBS={GLA:'Gladiator',PLD:'Paladin',MRD:'Marauder',WAR:'Warrior',DRK:'Dark Knight',GNB:'Gunbreaker',PGL:'Pugilist',MNK:'Monk',LNC:'Lancer',DRG:'Dragoon',ROG:'Rogue',NIN:'Ninja',SAM:'Samurai',RPR:'Reaper',VPR:'Viper',ARC:'Archer',BRD:'Bard',MCH:'Machinist',DNC:'Dancer',THM:'Thaumaturge',BLM:'Black Mage',ACN:'Arcanist',SMN:'Summoner',RDM:'Red Mage',PCT:'Pictomancer',BLU:'Blue Mage',CNJ:'Conjurer',WHM:'White Mage',SCH:'Scholar',AST:'Astrologian',SGE:'Sage',CRP:'Carpenter',BSM:'Blacksmith',ARM:'Armorer',GSM:'Goldsmith',LTW:'Leatherworker',WVR:'Weaver',ALC:'Alchemist',CUL:'Culinarian',MIN:'Miner',BTN:'Botanist',FSH:'Fisher'};
export const SLOTS=['MainHand','Body','Head','Gloves','Legs','Feet','OffHand','Ears','Neck','Wrists','FingerL','FingerR'];
export const LABELS={MainHand:'Main hand',OffHand:'Off hand',Head:'Head',Body:'Body',Gloves:'Hands',Legs:'Legs',Feet:'Feet',Ears:'Earrings',Neck:'Necklace',Wrists:'Bracelets',FingerL:'Left ring',FingerR:'Right ring'};
export function unconditionalMerchants(shop){return (shop.merchants||[]).filter(m=>! /salvager|recompense officer/i.test(m.name));}
export function validateInput(input){
 const job=String(input.job||'').toUpperCase(),level=Number(input.level),world=Number(input.world),scope=input.scope||'dc';
 if(!JOBS[job]||!Number.isInteger(level)||level<1||level>100||!Number.isInteger(world)||!['home','dc','region'].includes(scope))throw Error('Choose a valid job, level (1–100), home world and travel scope.');
 return {job,level,world,scope};
}
export function normalizeItem(row){
 const f=row.fields,stats={};
 for(const [i,p] of (f.BaseParam||[]).entries()){const name=p.fields?.Name;if(name)stats[name]=Number(f.BaseParamValue?.[i]||0);}
 for(const [name,key] of [['Physical damage','DamagePhys'],['Magic damage','DamageMag'],['Defense','DefensePhys'],['Magic Defense','DefenseMag'],['Block Strength','Block'],['Block Rate','BlockRate']])if(f[key])stats[name]=f[key];
 const bonus={};for(const [i,p] of (f.BaseParamSpecial||[]).entries()){const name=p.fields?.Name;if(name)bonus[name]=Number(f.BaseParamValueSpecial?.[i]||0);}
 // XIVAPI uses Weapon Damage / Magic Damage names for HQ weapon bonuses.
 if(bonus['Physical Damage']){bonus['Physical damage']=bonus['Physical Damage'];delete bonus['Physical Damage'];}
 if(bonus['Magic Damage']){bonus['Magic damage']=bonus['Magic Damage'];delete bonus['Magic Damage'];}
 return {id:row.row_id,name:f.Name,level:f.LevelEquip,ilevel:f.LevelItem?.value||0,slots:f.EquipSlotCategory?.fields||{},stats,bonus,hq:!!f.CanBeHq,unique:!!f.IsUnique,tradable:!f.IsUntradable,icon:f.Icon?.path, jobs:Object.keys(f.ClassJobCategory?.fields||{}).filter(j=>f.ClassJobCategory.fields[j]===true)};
}
export function qualityStats(item,quality){const stats={...item.stats};if(quality==='HQ'&&item.hq)for(const [name,value]of Object.entries(item.bonus||{}))stats[name]=(stats[name]||0)+Number(value);return stats;}
export function statScore(item,quality,job){
 const s=qualityStats(item,quality);
 if(['MIN','BTN','FSH'].includes(job))return (s.Gathering||0)*4+(s.Perception||0)*3+(s.GP||0)*2+(job==='FSH'&&item.slots.OffHand>0?1:0);
 if(['CRP','BSM','ARM','GSM','LTW','WVR','ALC','CUL'].includes(job))return (s.Craftsmanship||0)*4+(s.Control||0)*3+(s.CP||0)*5;
 const healer=['CNJ','WHM','SCH','AST','SGE'].includes(job),caster=['THM','BLM','ACN','SMN','RDM','PCT','BLU'].includes(job),dex=['ARC','BRD','MCH','DNC','ROG','NIN','VPR'].includes(job);
 const main=healer?'Mind':caster?'Intelligence':dex?'Dexterity':'Strength';
 return (s[main]||0)*10+(s.Vitality||0)*2+((healer||caster)?s['Magic damage']||0:s['Physical damage']||0)*100+(s['Critical Hit']||0)+(s['Direct Hit Rate']||0)+(s.Determination||0)+(s['Skill Speed']||0)*.5+(s['Spell Speed']||0)*.5+(s.Defense||0)*.3+(s['Magic Defense']||0)*.1+(s['Block Strength']||0)*.5+(s['Block Rate']||0)*.5;
}
export function marketOffer(listing,itemID,homeWorld){
 if(!Number.isFinite(listing.pricePerUnit)||listing.pricePerUnit<=0||!Number.isInteger(listing.quantity)||listing.quantity<1)return null;
 const subtotal=listing.pricePerUnit*listing.quantity;
 const tax=Number.isFinite(listing.tax)?listing.tax:Math.floor(subtotal*.05);
 return {key:`market:${itemID}:${listing.worldID||homeWorld}:${listing.listingID||[listing.retainerID,listing.pricePerUnit,listing.hq].join(':')}`,kind:'market',quality:listing.hq?'HQ':'NQ',world:Number(listing.worldID||homeWorld),worldName:listing.worldName,price:subtotal+tax,unitPrice:listing.pricePerUnit,tax,quantity:listing.quantity,reviewedAt:listing.lastReviewTime?listing.lastReviewTime*1000:null};
}
export function eligible(item,job,level,slot){return item.jobs.includes(job)&&item.level<=level&&item.slots[slot]>0;}
export function bestVariant(candidates,mode='value',threshold=.9){
 const available=candidates.filter(c=>c.offer&&Number.isFinite(c.offer.price));if(!available.length)return candidates.sort((a,b)=>b.score-a.score)[0]||null;
 const best=Math.max(...available.map(c=>c.score));
 const price=c=>c.effectivePrice??c.offer.price;
 if(mode==='stats')return available.sort((a,b)=>b.score-a.score||price(a)-price(b))[0];
 const economic=available.filter(c=>c.score>=best*.45).sort((a,b)=>price(a)-price(b)||b.score-a.score)[0];
 if(mode==='budget')return economic;
 const close=available.filter(c=>c.score>=best*threshold).sort((a,b)=>price(a)-price(b)||b.score-a.score)[0];
 // Avoid extravagant glamour/collector premiums during leveling. Highest-stats mode remains explicit.
 if(price(close)>Math.max(5000,price(economic)*10))return {...economic,valueNote:'A near-top alternative costs over ten times more. This cheaper leveling option avoids that premium.'};
 return close;
}
// Purchases consume whole stacks. Unused units can satisfy the second ring, never a second Unique item.
export function buildBasket(data,options={}){
 const rows=[],usedItems=new Set(),capacity=new Map(),blocked=new Set(),mode=options.mode||'value';
 for(const slot of SLOTS){
  if(blocked.has(slot)){rows.push({slot,blocked:true});continue;}
  if(options.owned?.[slot]){const owned=data.items.find(i=>i.id===Number(options.selected?.[slot]));if(owned){usedItems.add(owned.id);for(const [s,v]of Object.entries(owned.slots))if(v<0||(v>0&&s!==slot&&!s.startsWith('Finger')))blocked.add(s);}rows.push({slot,owned:true,item:owned,quality:options.fixedQuality?.[slot]||'NQ'});continue;}
  let items=data.items.filter(i=>eligible(i,data.job,data.level,slot)&&!(i.unique&&usedItems.has(i.id)));
  const selected=Number(options.selected?.[slot]);if(selected)items=items.filter(i=>i.id===selected);
  const variants=[];
  for(const item of items){
   for(const quality of item.hq?['NQ','HQ']:['NQ']){
    if(options.fixedQuality?.[slot]&&quality!==options.fixedQuality[slot])continue;
    if(!options.fixedQuality?.[slot]){if(options.quality==='hq'&&quality!=='HQ')continue;if(options.quality==='nq'&&quality!=='NQ')continue;}
    let offers=(data.offers[item.id]||[]).filter(o=>o.quality===quality&&(!options.worlds||o.kind==='vendor'||options.worlds.includes(o.world)));
    if(options.skip?.[slot]?.length)offers=offers.filter(o=>!options.skip[slot].includes(o.key));
    offers=offers.sort((a,b)=>(capacity.get(a.key)||0)>0?-1:(capacity.get(b.key)||0)>0?1:a.price-b.price);
    const offer=offers.find(o=>!capacity.has(o.key)||capacity.get(o.key)>0);
    variants.push({item,quality,offer,effectivePrice:offer&&(capacity.get(offer.key)||0)>0?0:offer?.price,score:statScore(item,quality,data.job)});
   }
  }
  const choice=bestVariant(variants,mode);if(!choice){rows.push({slot,missing:true});continue;}
  let cost=choice.offer?.price??null;
  if(choice.offer?.kind==='market'){const remaining=capacity.get(choice.offer.key);if(remaining!==undefined){cost=0;capacity.set(choice.offer.key,remaining-1);}else capacity.set(choice.offer.key,choice.offer.quantity-1);}
  rows.push({slot,...choice,cost});usedItems.add(choice.item.id);
  for(const [s,v]of Object.entries(choice.item.slots))if(v<0||(v>0&&s!==slot&&!s.startsWith('Finger')))blocked.add(s);
 }
 const purchases=rows.filter(r=>r.offer&&r.cost>0),missing=rows.filter(r=>!r.blocked&&!r.owned&&!r.offer&&(r.slot!=='OffHand'||data.items.some(i=>eligible(i,data.job,data.level,'OffHand'))));
 const groups={};for(const row of purchases){const key=row.offer.kind==='vendor'?'Vendors':row.offer.worldName||`World ${row.offer.world}`;(groups[key]??=[]).push(row);}
 return {rows,total:purchases.reduce((s,r)=>s+r.cost,0),missing:missing.length,groups,stops:Object.keys(groups).filter(s=>s!=='Vendors').length};
}
export function routes(data,options={}){
 const cheapest=buildBasket(data,options),home=buildBasket(data,{...options,worlds:[data.world]});
 const allWorlds=[...new Set(Object.values(data.offers).flat().filter(o=>o.kind==='market').map(o=>o.world))];
 let worlds=[data.world],current=home,maxStops=Math.max(1,Math.min(8,Number(options.maxStops)||3)),minSavings=Math.max(0,Number(options.minSavings)||0);
 while(worlds.length<maxStops){let best=current,next=null;for(const world of allWorlds.filter(w=>!worlds.includes(w))){const basket=buildBasket(data,{...options,worlds:[...worlds,world]});if(basket.missing<best.missing||(basket.missing===best.missing&&basket.total<best.total-minSavings)){best=basket;next=world;}}if(next===null)break;worlds.push(next);current=best;}
 return {cheapest,home,fewer:current};
}
