import {writeFile,mkdir} from 'node:fs/promises';
const sha='c56afbc26b47501ceabb55cdb8d24e3c4d025abb';
const root=`https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/${sha}/libs/data/src/lib/json/`;
async function get(file){const r=await fetch(root+file);if(!r.ok)throw Error(file+': '+r.status);return r.json();}
const [shops,equipment,npcs,places,items]=await Promise.all(['shops.json','equipment.json','db/npcs-database-pages.json','places.json','items.json'].map(get));
const vendors={};
for(const shop of shops){
 if(!['GilShop','SpecialShop'].includes(shop.type))continue;
 for(const trade of shop.trades||[])for(const item of trade.items||[]){
  if(!equipment[item.id] || item.amount!==1)continue;
  const currencies=(trade.currencies||[]).map(c=>({id:c.id,name:c.id===1?'gil':items[c.id]?.en||`Currency/item ${c.id}`,amount:c.amount}));
  if(!currencies.length||currencies.some(c=>!Number.isFinite(c.amount)||c.amount<=0))continue;
  const merchants=(shop.npcs||[]).map(id=>{const n=npcs[id]; if(!n)return null; const p=n.position;return {id,name:n.en||`Merchant ${id}`,zone:p?places[p.zoneid]?.en||'Location not recorded':'Location not recorded',x:p?.x,y:p?.y};}).filter(Boolean);
  if(!merchants.length)continue;
  const row={shopId:shop.id,type:shop.type,currencies,quality:item.hq?'HQ':shop.type==='GilShop'?'NQ':'Unverified',merchants};
  (vendors[item.id]??=[]).push(row);
 }
}
await mkdir(new URL('./app/lib/gear/',import.meta.url),{recursive:true});
await writeFile(new URL('./app/lib/gear/vendors.json',import.meta.url),JSON.stringify({source:'FFXIV Teamcraft',commit:sha,generatedAt:new Date().toISOString(),vendors}));
const license=await (await fetch(`https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/${sha}/LICENSE`)).text();
await writeFile(new URL('./app/lib/gear/TEAMCRAFT-LICENSE.txt',import.meta.url),license);
console.log(Object.keys(vendors).length+' equipment items with verified shop records');
