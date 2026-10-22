const cache=new Map();
export async function fetchWorkshopUnlock(sequenceId,fetcher=fetch){
 const unknown={verified:false,message:'Schematic requirement unverified. Check the Schematic Board before purchasing materials.'};
 if(!Number.isSafeInteger(sequenceId)||sequenceId<1)return unknown;
 try{
  const json=async url=>{const response=await fetcher(url,{signal:AbortSignal.timeout(2500)});if(!response.ok)throw Error('Catalog unavailable');return response.json();};
  const sequence=await json('https://v2.xivapi.com/api/sheet/CompanyCraftSequence/'+sequenceId+'?fields=CompanyCraftDraft@as(raw)');
  const draftId=sequence.fields?.['CompanyCraftDraft@as(raw)'];
  if(!Number.isInteger(draftId))return unknown;
  if(draftId<=0)return {verified:true,schematic:null,materials:[],checkedAt:new Date().toISOString(),message:'Game data lists no specific schematic for this project.'};
  const draft=await json('https://v2.xivapi.com/api/sheet/CompanyCraftDraft/'+draftId+'?fields=Name,RequiredItem@as(raw),RequiredItemCount'),fields=draft.fields;
  const ids=fields?.['RequiredItem@as(raw)'],counts=fields?.RequiredItemCount;
  if(!fields?.Name||!Array.isArray(ids)||!Array.isArray(counts)||ids.length!==counts.length)return unknown;
  const required=ids.map((id,index)=>({id,quantity:counts[index]})).filter(m=>m.id>0&&m.quantity>0);
  if(required.some(m=>!Number.isSafeInteger(m.id)||!Number.isSafeInteger(m.quantity)))return unknown;
  const items=required.length?await json('https://v2.xivapi.com/api/sheet/Item?rows='+required.map(m=>m.id).join(',')+'&fields=Name,Icon'):{rows:[]};
  const materials=required.map(m=>{const item=items.rows?.find(i=>i.row_id===m.id);if(!item?.fields?.Name)throw Error('Missing item');return {...m,name:item.fields.Name,iconUrl:item.fields.Icon?.path?'https://v2.xivapi.com/api/asset?path='+encodeURIComponent(item.fields.Icon.path)+'&format=png':null};});
  return {verified:true,schematic:fields.Name,draftId,materials,checkedAt:new Date().toISOString(),source:'https://v2.xivapi.com/api/sheet/CompanyCraftDraft/'+draftId,location:'Schematic Board · Company Workshop',message:'Schematic unlock materials are a separate, one-time FC requirement—not project turn-in materials.'};
 }catch{return unknown;}
}
export async function workshopUnlock(sequenceId){
 const existing=cache.get(sequenceId);if(existing&&existing.expires>Date.now())return existing.promise;
 if(cache.size>=200)cache.delete(cache.keys().next().value);
 const promise=fetchWorkshopUnlock(sequenceId);cache.set(sequenceId,{promise,expires:Date.now()+3600000});
 const result=await promise;if(!result.verified)cache.set(sequenceId,{promise:Promise.resolve(result),expires:Date.now()+300000});return result;
}
