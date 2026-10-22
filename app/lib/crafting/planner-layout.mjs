export function isCrystal(item) {
  return Number(item?.xivapiId) >= 2 && Number(item?.xivapiId) <= 19;
}
export function sourceFor(item, method, index, visited = new Set()) {
  const sources = item?.sources || [];
  const eligible = sources.filter(s => method === 'gather' ? s.type === 'gathering' : method === 'hunt' ? !!s.details?.monsterId : s.type === 'vendor');
  if (eligible.includes(sources[index])) return sources[index];
  if (!isCrystal(item) || method !== 'gather') return eligible[0];
  // Prefer ordinary nodes on the existing route, then lower-level alternatives.
  // This is a convenience suggestion, not a distance-optimized route.
  const score = s => (s.details?.times || s.details?.legendary ? 100000 : 0) + (visited.has(s.location) ? 0 : 1000) + Number(s.details?.level || 0);
  return [...eligible].sort((a,b) => score(a) - score(b))[0];
}
export function coordinates(source) {
  const d = source?.details;
  return d?.x != null && d?.y != null ? `X ${d.x}, Y ${d.y}` : 'Coordinates unavailable';
}
export function gatherJob(source) {
  const job = source?.details?.job;
  return ({BTN:'Botanist',MIN:'Miner',FSH:'Fisher'})[job] || job || 'Gathering job unverified';
}
export function acquisitionIndicators(item,craftable=false){
 const sources=item?.sources||[],badges=[];
 if(sources.some(s=>s.type==='vendor'))badges.push({kind:'vendor',label:'Vendor available'});
 if(sources.some(s=>s.type==='gathering'))badges.push({kind:'gather',label:'Gatherable'});
 if(sources.some(s=>s.details?.monsterId))badges.push({kind:'hunt',label:'Monster drops'});
 if(craftable)badges.push({kind:'craft',label:'Craftable'});
 if(sources.some(s=>s.type!=='vendor'&&s.type!=='gathering'&&!s.details?.monsterId))badges.push({kind:'other',label:'Other source listed'});
 return badges;
}
