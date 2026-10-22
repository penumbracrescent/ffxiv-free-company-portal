// Solo plans never create or update FC-board projects. Stock is a shared pool;
// materials already submitted in game are separate from inventory.
export function validWorkshops(projects) {
 if(!Array.isArray(projects)||projects.some(p=>!p||!Array.isArray(p.phases)||p.phases.some(ph=>!ph||!Array.isArray(ph.materials)||ph.materials.some(m=>!m))))return false;
 if(projects.some(p=>(p.unlockConfirmed!=null&&typeof p.unlockConfirmed!=='boolean')||p.phases.some(ph=>!Number.isInteger(ph.number)||ph.number<1||ph.number>100||(ph.progressResult!=null&&!['unknown','normal','excellent','outstanding'].includes(ph.progressResult))||new Set(ph.materials.map(m=>m.id)).size!==ph.materials.length||ph.materials.some(m=>m.batchQuantity!=null&&(!Number.isInteger(m.batchQuantity)||m.batchQuantity<1||m.batchQuantity>10000)||m.batchCount!=null&&(!Number.isInteger(m.batchCount)||m.batchCount<1||m.batchCount>10000)))))return false;
 return Array.isArray(projects)&&projects.length<=30&&new Set(projects.map(p=>p.key)).size===projects.length&&projects.every(p=>typeof p.key==='string'&&p.key.length<=100&&Number.isSafeInteger(p.templateId)&&p.templateId>0&&typeof p.name==='string'&&p.name.length<=200&&Number.isInteger(p.quantity)&&p.quantity>0&&p.quantity<=100&&Array.isArray(p.phases)&&p.phases.length>0&&p.phases.length<=100&&p.phases.every(ph=>Number.isSafeInteger(ph.id)&&ph.id>0&&typeof ph.title==='string'&&ph.title.length<=200&&typeof ph.included==='boolean'&&Array.isArray(ph.materials)&&ph.materials.length<=100&&ph.materials.every(m=>Number.isSafeInteger(m.id)&&m.id>0&&typeof m.name==='string'&&m.name.length<=200&&Number.isInteger(m.quantity)&&m.quantity>0&&m.quantity<=10000&&(m.submitted==null||Number.isInteger(m.submitted)&&m.submitted>=0&&m.submitted<=1000000))));
}
export function workshopMaterialRequirement(project,phase,material) {
 const previous=project.phases.find(p=>p.number===phase.number-1),previousResult=previous?.progressResult||'unknown';
 const factor=previousResult==='excellent'?1:previousResult==='outstanding'?2:0;
 const verified=Number.isInteger(material.batchQuantity)&&Number.isInteger(material.batchCount)&&material.batchQuantity>0&&material.batchCount>0&&material.batchQuantity*material.batchCount===material.quantity;
 const reducedBatches=verified?Math.floor(material.batchCount*factor/3):0;
 // Round per project copy, never across multiple projects. Submitted stock is not refunded.
 const baseTotal=material.quantity*project.quantity,total=Math.max(1,material.quantity-(material.batchQuantity||0)*reducedBatches)*project.quantity;
 return {baseTotal,total,reducedBatches,previousResult,discountVerified:verified,discounted:total<baseTotal};
}
export function phaseTargets(project,phase) {
 if(!phase.included)return [];
 return phase.materials.map(m=>({id:m.id,name:m.name,iconUrl:m.iconUrl,quantity:Math.max(0,workshopMaterialRequirement(project,phase,m).total-(m.submitted||0)),hq:0})).filter(m=>m.quantity>0);
}
export function workshopTargets(projects) {
 const targets=new Map();
 for(const p of projects)for(const phase of p.phases)for(const m of phaseTargets(p,phase)){const old=targets.get(m.id);targets.set(m.id,{...m,quantity:(old?.quantity||0)+m.quantity});}
 return [...targets.values()];
}
export function combinedTargets(ordinary,projects) {
 const map=new Map(ordinary.map(i=>[i.id,{...i}]));
 for(const m of workshopTargets(projects)){const old=map.get(m.id);map.set(m.id,{...m,quantity:(old?.quantity||0)+m.quantity,hq:old?.hq||0});}
 if(map.size>100||[...map.values()].some(i=>i.quantity>10000))throw Error('This plan exceeds 100 materials or 10,000 units of one material. Split it into smaller lists.');
 return [...map.values()];
}
export function makeWorkshop(template,quantity=1) {return {key:crypto.randomUUID(),templateId:template.id,name:template.name,category:template.category,quantity,syncedAt:template.syncedAt,unlocks:template.unlocks,unlockConfirmed:false,phases:template.phases.map(p=>({...p,included:true,progressResult:'unknown',materials:p.materials.map(m=>({...m,submitted:0}))}))};}
export function allocatePhasePlans(sections,stock,hqStock,calculate) {
 const pool={...stock},hqPool={...hqStock};
 return sections.map(section=>{
  const available={...pool},availableHq={...hqPool},rows=calculate(section.targets,available,availableHq);
  for(const row of rows){const used=Math.min(row.required,Math.max(0,row.contributed));pool[row.itemId]=Math.max(0,(pool[row.itemId]||0)-used);const hqGoal=section.targets.find(t=>t.id===row.itemId)?.hq||0,hqUsed=Math.min(hqPool[row.itemId]||0,hqGoal),nqAvailable=Math.max(0,(available[row.itemId]||0)-(availableHq[row.itemId]||0));hqPool[row.itemId]=Math.max(0,(hqPool[row.itemId]||0)-hqUsed-Math.max(0,used-hqUsed-nqAvailable));if(!row.isRaw)pool[row.itemId]+=Math.max(0,row.craftCount*row.outputQuantity-row.remaining);}
  return {...section,rows,available,availableHq};
 });
}
