const text=(value,max=120)=>String(value??'').replace(/[\r\n]+/g,' ').slice(0,max).replace(/[\\\[\]_*`~|]/g,'\\$&');
export const GEAR_PRICE_NOTICE='Market prices: latest reported Universalis listings, not guaranteed prices or stock. Confirm before traveling.';
export function gearEquipmentFields(rows,labels,stopOrder=[]){
 const groups=new Map();
 for(const row of rows.filter(row=>row.item)){
  const world=row.offer?.worldName||`World ${row.offer?.world}`;
  const key=row.offer?.kind==='market'?`world:${world}`:row.offer?.kind==='vendor'?'vendors':'unpriced';
  if(!groups.has(key))groups.set(key,{key,world,rows:[]});
  groups.get(key).rows.push(row);
 }
 const marketGroups=[...groups.values()].filter(group=>group.key.startsWith('world:'));
 marketGroups.sort((a,b)=>{const ai=stopOrder.indexOf(a.world),bi=stopOrder.indexOf(b.world);return (ai<0?stopOrder.length:ai)-(bi<0?stopOrder.length:bi);});
 const ordered=[...marketGroups,...['vendors','unpriced'].filter(key=>groups.has(key)).map(key=>groups.get(key))];
 const fields=[];let stop=0;
 for(const group of ordered){
 const heading=group.key.startsWith('world:')?`Stop ${++stop} · ${text(group.world,60)}`:group.key==='vendors'?'Vendor purchases':'Unpriced equipment';
 const lines=group.rows.map(row=>{
  const id=Number(row.item.id),name=text(row.item.name);
  const item=Number.isSafeInteger(id)&&id>0&&row.item.tradable!==false?`[${name}](https://universalis.app/market/${id})`:name;
  let destination='No available listing';
  if(row.offer?.kind==='market')destination=text(row.offer.worldName||`World ${row.offer.world}`,60);
  if(row.offer?.kind==='vendor'){
   const merchant=row.offer.merchants?.[0];
   const coordinates=merchant&&Number.isFinite(Number(merchant.x))&&Number.isFinite(Number(merchant.y))&&merchant.x!=null&&merchant.y!=null?` (X ${Number(merchant.x).toFixed(1)}, Y ${Number(merchant.y).toFixed(1)})`:'';
   destination=`Vendor: ${text(merchant?.name||'Check merchant',80)}${merchant?.zone?` — ${text(merchant.zone,80)}`:''}${coordinates}`;
  }
  const price=row.cost==null?'Unpriced':row.cost===0&&row.offer?.kind==='market'?'Included in shared listing':`${row.cost.toLocaleString('en-US')} gil`;
  const quantity=row.offer?.kind==='market'&&row.offer.quantity>1?` · ${row.offer.quantity} units in listing`:'';
  return `${text(labels[row.slot]||row.slot,30)}: ${item} · ${row.quality} · ${price} · ${destination}${quantity}`;
 });
 // Keep a stop's equipment together, splitting oversized stops into numbered parts.
 let value='';const parts=[];
 for(const line of lines){if(value&&value.length+line.length+1>1024){parts.push(value);value='';}value+=(value?'\n':'')+line;}
 if(value)parts.push(value);
 for(const [index,value]of parts.entries())fields.push({name:parts.length>1?`${heading} · Part ${index+1}/${parts.length}`:heading,value});
 }
 return fields.length?fields:[{name:'Equipment',value:'No equipment found.'}];
}
