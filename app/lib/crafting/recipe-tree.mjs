// One node per item keeps shared ingredients consolidated across all targets.
export function recipeTree(targets, recipes, items, qualityGoals={},options={}) {
 const byOutput=new Map(recipes.map(r=>[r.outputItemId,r])),byId=new Map(items.map(i=>[i.id,i])),levels=new Map(),visiting=new Set(),edges=[];
 function visit(id){
  if(levels.has(id))return levels.get(id);
  if(visiting.has(id))throw Error('A recipe cycle prevents a complete tree.');
  if(!byId.has(id))throw Error('An item is missing from the recipe tree.');
  visiting.add(id);const recipe=byOutput.get(id);let level=0;
  if(recipe){for(const ingredient of recipe.ingredients){level=Math.max(level,visit(ingredient.itemId)+1);edges.push({from:ingredient.itemId,to:id,quantity:ingredient.quantity});}}
  visiting.delete(id);levels.set(id,level);return level;
 }
 for(const id of targets)visit(id);
 const max=Math.max(0,...levels.values()),columns=Array.from({length:max+1},()=>[]),targetSet=new Set(targets);
 // Terminal finished products share the rightmost column, even with shorter recipes.
 for(const [id,level] of levels){const column=!options.workshop&&targetSet.has(id)&&!edges.some(e=>e.from===id)?max:level;columns[column].push({...byId.get(id),column,recipe:byOutput.get(id),target:targetSet.has(id)});}
 const heights=columns.map(column=>{let y=48;column.sort((a,b)=>a.name.localeCompare(b.name)).forEach((node,row)=>{node.row=row;node.x=node.column*300+12;node.y=y;node.height=(node.recipe?330+30*Math.max(0,recipeCrystals(node.recipe,items,1).length-1):260)+(!node.recipe&&node.timedMaterial?200:0)+(node.name.length>30?18:0)+(qualityGoals[node.id]>0?32:0);y+=node.height+16;});return y;});
 return {nodes:columns.flat(),edges,columns:columns.length,width:columns.length*300,height:Math.max(48,...heights)};
}
import {isCrystal} from './planner-layout.mjs';
export function recipeCrystals(recipe,items,craftCount){
 const byId=new Map(items.map(i=>[i.id,i])),totals=new Map();
 for(const ingredient of recipe?.ingredients||[]){const item=byId.get(ingredient.itemId);if(isCrystal(item)){const prev=totals.get(item.id);const perCraft=(prev?.perCraft||0)+ingredient.quantity;totals.set(item.id,{...item,perCraft,total:perCraft*Math.max(0,craftCount||0)});}}
 return [...totals.values()];
}
export function branchFor(id,edges){
 const selected=new Set([id]);
 function walk(key,field,next,seen=new Set()){if(seen.has(key))return;seen.add(key);for(const edge of edges.filter(e=>e[field]===key)){selected.add(edge[next]);walk(edge[next],field,next,seen);}}
 walk(id,'to','from');walk(id,'from','to');return selected;
}
export function treeStatus(node,row,current){
 if(!row||row.required===0)return 'Not needed — intermediate already covered';
 if(row.remaining===0)return 'Already owned';
 if(node.recipe&&node.recipe.ingredients.every(i=>(current.get(i.itemId)?.remaining??Infinity)===0))return 'Ready to craft — ingredients available';
 return node.recipe?'Materials still needed':'Still to acquire';
}
// Use natural DOM card heights without changing dependency order or quantities.
export function measuredTree(tree,heights={}){
 const positions=new Map();let height=48;
 for(let column=0;column<tree.columns;column++){
  let y=48;
  for(const node of tree.nodes.filter(n=>n.column===column)){
   const measured=heights[String(node.id)],h=Number.isFinite(measured)&&measured>0?Math.ceil(measured):node.height;
   positions.set(node.id,{y,height:h});y+=h+16;
  }
  height=Math.max(height,y);
 }
 return {...tree,height,nodes:tree.nodes.map(n=>({...n,...positions.get(n.id)}))};
}
export function responsiveTree(tree,availableWidth){
 const width=Math.max(tree.width,Math.floor(availableWidth||0)),nodeWidth=Math.min(440,Math.max(264,width/Math.max(1,tree.columns)-36));
 const columnSpacing=tree.columns>1?(width-nodeWidth-24)/(tree.columns-1):0;
 return {...tree,width,nodeWidth,columnSpacing,nodes:tree.nodes.map(node=>({...node,width:nodeWidth,x:tree.columns>1?12+node.column*columnSpacing:(width-nodeWidth)/2}))};
}
