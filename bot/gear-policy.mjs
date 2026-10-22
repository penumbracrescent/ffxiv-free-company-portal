import {buildBasket}from './gear/core.mjs';
import {LEVEL_CAP}from './gear/game-config.mjs';
export function gearPolicy(level,quality='auto',cap=LEVEL_CAP){return {mode:level>=cap?'stats':'value',quality:quality==='hq'||level>=cap?'hq-available':'any'};}
export function discordGearBasket(data,quality='auto',source='market'){
 const offers=source==='market'?Object.fromEntries(Object.entries(data.offers).map(([id,rows])=>[id,rows.filter(row=>row.kind==='market')])):data.offers;
 const items=source==='market'?data.items.filter(item=>item.tradable!==false):data.items;
 return buildBasket({...data,items,offers},gearPolicy(data.level,quality));
}
