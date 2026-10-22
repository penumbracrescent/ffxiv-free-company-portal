import {workshopMaterialRequirement} from './solo-workshop.mjs';
// Presentation-only nodes. They never enter recipe expansion or inventory accounting.
export function workshopRecipeTree(tree,projects=[],ordinary=[],focusedPhaseId=null){
 const headers=Array.from({length:tree.columns},(_,i)=>i===0?'Raw / acquire':'Craft stage '+i);
 if(!projects.length){if(tree.columns>1)headers[tree.columns-1]+=' · Finished products';return {...tree,headers};}
 const nodes=tree.nodes.map(n=>({...n,kind:'item'})),edges=[...tree.edges],ids=new Set(nodes.map(n=>n.id));
 const phaseNumbers=[...new Set(projects.flatMap(p=>p.phases.map(ph=>ph.number)))].sort((a,b)=>a-b);
 const phaseColumns=new Map(phaseNumbers.map((number,i)=>[number,tree.columns+i]));
 headers.push(...phaseNumbers.map(n=>'Workshop phase '+n));
 const outputColumn=headers.length;headers.push(ordinary.length?'Project goals / finished crafts':'Completed project · goal');
 for(const project of projects){
  const phases=[...project.phases].sort((a,b)=>a.number-b.number);let previous=null;
  for(const phase of phases){
   const id='workshop:'+project.key+':phase:'+phase.id,inScope=focusedPhaseId==null||phase.id===focusedPhaseId;
   const materials=phase.materials.map(m=>({...m,...workshopMaterialRequirement(project,phase,m),submitted:m.submitted||0,pending:Math.max(0,workshopMaterialRequirement(project,phase,m).total-(m.submitted||0))}));
   nodes.push({id,kind:'workshopPhase',name:phase.title,projectName:project.name,projectKey:project.key,phaseNumber:phase.number,phaseId:phase.id,progressResult:phase.progressResult||'unknown',hasNextPhase:phases.some(p=>p.number===phase.number+1),projectQuantity:project.quantity,included:phase.included,inScope,materials,column:phaseColumns.get(phase.number),height:Math.min(650,350+materials.length*44),recorded:materials.every(m=>m.pending===0)});
   // Dashed links mean submission order, never a recipe ingredient or material demand.
   if(previous)edges.push({from:previous,to:id,kind:'sequence'});previous=id;
   if(phase.included&&inScope)for(const material of materials)if(material.pending>0&&ids.has(material.id))edges.push({from:material.id,to:id,kind:'submission',quantity:material.pending,name:material.name});
  }
  const id='workshop:'+project.key+':output',included=phases.filter(p=>p.included),complete=phases.every(p=>p.materials.every(m=>(m.submitted||0)>=workshopMaterialRequirement(project,p,m).total));
  nodes.push({id,kind:'workshopOutput',name:project.name,projectKey:project.key,quantity:project.quantity,unlocks:project.unlocks,unlockConfirmed:project.unlockConfirmed,column:outputColumn,height:240,phaseCount:phases.length,includedCount:included.length,recorded:complete});
  if(previous)edges.push({from:previous,to:id,kind:'sequence'});
 }
 if(ordinary.length){const id='ordinary:outputs';nodes.push({id,kind:'ordinaryOutputs',name:'Ordinary finished crafts',materials:ordinary,column:outputColumn,height:Math.min(650,120+ordinary.length*40)});for(const target of ordinary)if(ids.has(target.id))edges.push({from:target.id,to:id,kind:'output',quantity:target.quantity,name:target.name});}
 let height=tree.height;
 for(let column=tree.columns;column<headers.length;column++){
  let y=48;for(const node of nodes.filter(n=>n.column===column)){node.x=column*300+12;node.y=y;y+=node.height+16;}height=Math.max(height,y);
 }
 return {...tree,nodes,edges,headers,columns:headers.length,width:headers.length*300,height};
}
