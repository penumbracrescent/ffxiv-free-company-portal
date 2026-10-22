const signature=project=>JSON.stringify(project.phases.map(p=>[p.number,p.title,p.materials.map(m=>[m.id,m.quantity,m.batchQuantity,m.batchCount]).sort((a,b)=>a[0]-b[0])]).sort((a,b)=>a[0]-b[0]));
export function workshopRefresh(project,latest){
 if(!latest||latest.id!==project.templateId)throw Error('Catalog project does not match this saved plan.');
 const changes=[],blocked=[];
 const phases=latest.phases.map(p=>{
  const old=project.phases.find(ph=>ph.number===p.number);
  for(const m of p.materials){const prior=old?.materials.find(x=>x.id===m.id);if(!prior||prior.quantity!==m.quantity||prior.batchQuantity!==m.batchQuantity||prior.batchCount!==m.batchCount)changes.push({phase:p.number,name:m.name,before:prior?.quantity||0,after:m.quantity});}
  return {...p,included:old?.included??true,progressResult:old?.progressResult||'unknown',materials:p.materials.map(m=>({...m,submitted:old?.materials.find(x=>x.id===m.id)?.submitted||0}))};
 });
 for(const old of project.phases)for(const m of old.materials)if(!phases.find(p=>p.number===old.number)?.materials.some(x=>x.id===m.id)){changes.push({phase:old.number,name:m.name,before:m.quantity,after:0});if(m.submitted>0)blocked.push('Phase '+old.number+' · '+m.name+' has recorded submissions but is missing from the new catalog.');}
 return {changed:signature(project)!==signature(latest),changes,blocked,project:{...project,name:latest.name,category:latest.category,syncedAt:latest.syncedAt,unlocks:latest.unlocks,phases}};
}
export function catalogAge(syncedAt,now=Date.now()){
 const date=Date.parse(syncedAt);return !Number.isFinite(date)?'Snapshot date unverified':now-date>30*86400000?'Snapshot over 30 days old — check catalog':'Snapshot date '+new Date(date).toLocaleDateString();
}
