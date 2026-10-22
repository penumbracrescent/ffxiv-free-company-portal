import test from 'node:test';import assert from 'node:assert/strict';
import {recipeTree,branchFor,responsiveTree,measuredTree} from './lib/crafting/recipe-tree.mjs';
import {workshopRecipeTree} from './lib/crafting/workshop-tree.mjs';
import {workshopRefresh,catalogAge} from './lib/crafting/workshop-refresh.mjs';
import {validTreeView} from './lib/crafting/tree-view.mjs';
import {fetchWorkshopUnlock} from './lib/crafting/workshop-unlocks.mjs';
const items=[{id:1,name:'Ore'},{id:2,name:'Ingot'},{id:3,name:'Rivets'},{id:4,name:'Bought component'}],recipes=[{outputItemId:2,outputQuantity:1,ingredients:[{itemId:1,quantity:2}]},{outputItemId:3,outputQuantity:1,ingredients:[{itemId:2,quantity:1}]}];
const project=()=>({key:'p',name:'Hull',quantity:2,phases:[{id:11,number:1,title:'Frame',included:true,materials:[{id:3,name:'Rivets',quantity:2,submitted:1}]},{id:12,number:2,title:'Panels',included:true,materials:[{id:2,name:'Ingot',quantity:3}]},{id:13,number:3,title:'Finishing',included:true,materials:[{id:4,name:'Bought component',quantity:1}]}]});
const base=()=>recipeTree([2,3,4],recipes,items,{}, {workshop:true});
test('view preferences accept only bounded zoom and scroll values',()=>{
 assert.ok(validTreeView({zoom:.8,left:220,top:600}));for(const value of [null,{}, {zoom:99,left:0,top:0},{zoom:1,left:-1,top:0},{zoom:1,left:0,top:Infinity}])assert.equal(validTreeView(value),false);
});
test('catalog preview preserves project choices and stock recordings without mutating the plan',()=>{
 const p={...project(),templateId:7,syncedAt:'2020-01-01',unlockConfirmed:true};p.phases[0].progressResult='excellent';p.phases[1].included=false;
 const latest={...structuredClone(p),id:7,syncedAt:'2026-10-08',unlocks:{verified:true,schematic:'Prototype'}};latest.phases[0].materials[0].quantity=4;
 const before=JSON.stringify(p),preview=workshopRefresh(p,latest);assert.ok(preview.changed);assert.equal(JSON.stringify(p),before);assert.equal(preview.project.quantity,2);assert.equal(preview.project.phases[0].materials[0].submitted,1);assert.equal(preview.project.phases[0].progressResult,'excellent');assert.equal(preview.project.phases[1].included,false);assert.equal(preview.project.unlockConfirmed,true);assert.equal(preview.changes[0].after,4);
 assert.throws(()=>workshopRefresh(p,{...latest,id:8}),/does not match/);
});
test('removed submitted materials block catalog replacement and unchanged snapshots remain safe',()=>{
 const p={...project(),templateId:7},latest={...structuredClone(p),id:7};assert.equal(workshopRefresh(p,latest).changed,false);latest.phases.shift();assert.equal(workshopRefresh(p,latest).blocked.length,1);
 assert.match(catalogAge('2020-01-01',Date.parse('2026-10-08')),/30 days/);assert.match(catalogAge(null),/unverified/);
});
test('verified schematic lookup associates exact item IDs with one-time costs',async()=>{
 const calls=[],fake=async url=>{calls.push(url);return {ok:true,json:async()=>url.includes('CompanyCraftSequence')?{fields:{'CompanyCraftDraft@as(raw)':30}}:url.includes('CompanyCraftDraft')?{fields:{Name:'Prototype VI','RequiredItem@as(raw)':[10,20,0],RequiredItemCount:[18,8,0]}}:{rows:[{row_id:20,fields:{Name:'Fiber'}},{row_id:10,fields:{Name:'Lumber',Icon:{path:'ui/icon/010000/010010.tex'}}}]}};};
 const result=await fetchWorkshopUnlock(548,fake);assert.equal(result.verified,true);assert.equal(result.schematic,'Prototype VI');assert.deepEqual(result.materials.map(m=>[m.name,m.quantity]),[['Lumber',18],['Fiber',8]]);assert.equal(calls.length,3);
});
test('failed, incomplete or unspecified schematic data never claims FC access',async()=>{
 const failed=await fetchWorkshopUnlock(1,async()=>{throw Error('Unavailable');});assert.equal(failed.verified,false);
 const none=await fetchWorkshopUnlock(1,async()=>({ok:true,json:async()=>({fields:{'CompanyCraftDraft@as(raw)':-1}})}));assert.equal(none.verified,true);assert.equal(none.schematic,null);assert.equal(none.unlockConfirmed,undefined);
 const incomplete=await fetchWorkshopUnlock(1,async()=>({ok:true,json:async()=>({fields:{}})}));assert.equal(incomplete.verified,false);
});
test('natural card heights reflow each column and grow or shrink the canvas without changing dependencies',()=>{
 const tree=responsiveTree(workshopRecipeTree(base(),[project()]),2400),before=JSON.stringify(tree);
 const heights=Object.fromEntries(tree.nodes.map((n,i)=>[String(n.id),150+i*47]));
 const expanded=measuredTree(tree,heights);
 for(let col=0;col<expanded.columns;col++){let y=48;for(const node of expanded.nodes.filter(n=>n.column===col)){assert.equal(node.y,y);assert.equal(node.height,heights[String(node.id)]);y+=node.height+16;}assert.ok(expanded.height>=y);}
 const compact=measuredTree(tree,Object.fromEntries(tree.nodes.map(n=>[String(n.id),100])));
 assert.ok(compact.height<expanded.height);assert.deepEqual(expanded.edges,tree.edges);assert.equal(JSON.stringify(tree),before);
 const fallback=measuredTree(tree,{'1':NaN});assert.ok(fallback.nodes.every(n=>Number.isFinite(n.height)&&n.height>0));
});
test('all craft depths are numbered before three workshop phases and the output goal',()=>{const tree=workshopRecipeTree(base(),[project()]);assert.deepEqual(tree.headers,['Raw / acquire','Craft stage 1','Craft stage 2','Workshop phase 1','Workshop phase 2','Workshop phase 3','Completed project · goal']);assert.equal(tree.nodes.find(n=>n.id===4).column,0);assert.equal(tree.nodes.find(n=>n.id===3).column,2);assert.equal(tree.nodes.find(n=>n.kind==='workshopOutput').column,6);});
test('presentation preserves recipe inputs and shows exact pending submission quantities',()=>{const b=base(),p=project(),before=JSON.stringify({b,p});const tree=workshopRecipeTree(b,[p]);assert.equal(JSON.stringify({b,p}),before);const submission=tree.edges.find(e=>e.kind==='submission'&&e.from===3);assert.equal(submission.quantity,3);assert.equal(tree.nodes.find(n=>n.kind==='workshopPhase').materials[0].total,4);assert.equal(tree.nodes.filter(n=>n.id===3).length,1);});
test('excluded phases remain visible, without adding their materials or claiming completion',()=>{const p=project();p.phases[1].included=false;const tree=workshopRecipeTree(base(),[p]);assert.equal(tree.nodes.filter(n=>n.kind==='workshopPhase').length,3);assert.equal(tree.nodes.find(n=>n.phaseNumber===2).included,false);assert.equal(tree.edges.filter(e=>e.kind==='submission'&&e.to.endsWith(':12')).length,0);assert.equal(tree.nodes.find(n=>n.kind==='workshopOutput').recorded,false);assert.equal(tree.edges.filter(e=>e.kind==='sequence').length,3);});
test('phase focus keeps the full sequence but links only the selected phase inputs',()=>{const tree=workshopRecipeTree(base(),[project()],[],12);assert.equal(tree.nodes.filter(n=>n.kind==='workshopPhase'&&n.inScope).length,1);assert.ok(tree.edges.filter(e=>e.kind==='submission').every(e=>e.to.endsWith(':12')));});
test('multiple workshop goals and ordinary outputs are separate, with traceable dependencies',()=>{const p=project(),q={...project(),key:'q',name:'Second Hull'};const tree=workshopRecipeTree(base(),[p,q],[{id:3,name:'Rivets',quantity:1}]);assert.equal(tree.nodes.filter(n=>n.kind==='workshopOutput').length,2);assert.equal(tree.nodes.filter(n=>n.kind==='ordinaryOutputs').length,1);assert.equal(new Set(tree.nodes.map(n=>n.id)).size,tree.nodes.length);const branch=branchFor('workshop:p:output',tree.edges);assert.ok(branch.has(1)&&branch.has(3)&&branch.has('workshop:p:phase:11')&&branch.has('workshop:p:phase:13'));assert.equal(branch.has('workshop:q:output'),false);const wide=responsiveTree(tree,3440);assert.ok(wide.nodes.every(n=>n.x+n.width<=wide.width));});
test('normal recipe trees retain finished products while numbering the last crafting stage',()=>{const normal=workshopRecipeTree(recipeTree([3],recipes,items));assert.deepEqual(normal.headers,['Raw / acquire','Craft stage 1','Craft stage 2 · Finished products']);assert.equal(normal.nodes.some(n=>n.kind==='workshopPhase'),false);});
