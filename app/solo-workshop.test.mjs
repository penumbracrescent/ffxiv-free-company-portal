import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWorkshop,validWorkshops,phaseTargets,combinedTargets,allocatePhasePlans,workshopMaterialRequirement} from './lib/crafting/solo-workshop.mjs';
import {newLibrary,validLibrary} from './lib/crafting/list-store.mjs';
import {timedNodesForItem,countdown} from './lib/crafting/timed-materials.mjs';
const template={id:1,name:'Shark-class Hull',phases:[{id:1,number:1,title:'Hull',materials:[{id:5,name:'Lumber',quantity:6,batchQuantity:2,batchCount:3}]},{id:2,number:2,title:'Fittings',materials:[{id:5,name:'Lumber',quantity:3}]}]};
test('confirmed results discount only the next phase with whole batch rounding per copy',()=>{
 const p=makeWorkshop(template,3),a=p.phases[0],b=p.phases[1];b.materials[0]={id:5,name:'Lumber',quantity:18,batchQuantity:2,batchCount:9};
 assert.equal(workshopMaterialRequirement(p,b,b.materials[0]).total,54);
 a.progressResult='excellent';assert.equal(phaseTargets(p,a)[0].quantity,18);assert.equal(phaseTargets(p,b)[0].quantity,36);
 a.progressResult='outstanding';assert.equal(phaseTargets(p,b)[0].quantity,18);
 b.materials[0]={id:5,name:'Lumber',quantity:2,batchQuantity:2,batchCount:1};
 assert.equal(workshopMaterialRequirement(p,b,b.materials[0]).total,6,'Do not round batches across copies');
 a.progressResult='normal';assert.equal(workshopMaterialRequirement(p,b,b.materials[0]).total,6);
});
test('discounts preserve submitted quantities, unknown metadata and excluded previous results',()=>{
 const p=makeWorkshop(template),a=p.phases[0],b=p.phases[1];a.progressResult='outstanding';a.included=false;
 assert.equal(phaseTargets(p,b)[0].quantity,3,'Missing batch metadata keeps standard amount');
 b.materials[0]={id:5,name:'Lumber',quantity:6,batchQuantity:2,batchCount:3,submitted:5};
 assert.deepEqual(phaseTargets(p,b),[]);assert.equal(b.materials[0].submitted,5);
 assert.equal(workshopMaterialRequirement(p,b,b.materials[0]).total,2);
});
test('progress results survive backup and invalid results are rejected',()=>{
 const lib=newLibrary(),p=makeWorkshop(template);p.phases[0].progressResult='excellent';lib.lists[0].plan.workshops=[p];
 assert.ok(validLibrary(JSON.parse(JSON.stringify(lib))));p.phases[0].progressResult='good';assert.equal(validWorkshops([p]),false);
});
test('HQ stock spent on an earlier quality goal cannot be credited again',()=>{const plans=allocatePhasePlans([{targets:[{id:5,quantity:4,hq:4}]},{targets:[{id:5,quantity:4,hq:4}]}],{5:10},{5:5},(targets,stock,hq)=>[{itemId:5,required:4,contributed:Math.min(4,hq[5]||0),remaining:Math.max(0,4-(hq[5]||0)),isRaw:true,craftCount:0,outputQuantity:1}]);assert.equal(plans[1].availableHq[5],1);assert.equal(plans[1].rows[0].remaining,3);});
test('workshop quantities aggregate once and multiply project quantities, not batches twice',()=>{const p=makeWorkshop(template,2);assert.equal(combinedTargets([], [p])[0].quantity,18);assert.equal(validWorkshops([p]),true);p.phases[0].materials[0].submitted=2;assert.equal(phaseTargets(p,p.phases[0])[0].quantity,10);p.phases[1].included=false;assert.equal(combinedTargets([{id:5,name:'Lumber',quantity:1,hq:1}],[p])[0].quantity,11);assert.equal(combinedTargets([{id:5,name:'Lumber',quantity:1,hq:1}],[p])[0].hq,1);});
test('submitted materials are not returned to inventory',()=>{const p=makeWorkshop(template);p.phases[0].materials[0].submitted=6;assert.deepEqual(phaseTargets(p,p.phases[0]),[]);assert.equal(combinedTargets([],[p])[0].quantity,3);});
test('workshop backups retain phases, quantity and layout while legacy backups still validate',()=>{const library=newLibrary();assert.ok(validLibrary(library));library.lists[0].plan.workshops=[makeWorkshop(template)];library.lists[0].plan.workshopView='phases';assert.ok(validLibrary(JSON.parse(JSON.stringify(library))));delete library.lists[0].plan.workshops;delete library.lists[0].plan.workshopView;assert.ok(validLibrary(library));});
test('invalid workshop inputs and bounded plans are rejected safely',()=>{for(const input of [null,[null],[{}],[{phases:[null]}],[{phases:[{materials:[null]}]}]])assert.equal(validWorkshops(input),false);const p=makeWorkshop(template);p.quantity=101;assert.equal(validWorkshops([p]),false);assert.throws(()=>combinedTargets([{id:5,name:'Lumber',quantity:10000}],[makeWorkshop(template)]),/exceeds/);});
test('phase stock is credited only once and earlier batch surplus is reused',()=>{const calculate=(targets,stock)=>targets.map(t=>({itemId:t.id,required:t.quantity,contributed:stock[t.id]||0,remaining:Math.max(0,t.quantity-(stock[t.id]||0)),isRaw:t.id===2,outputQuantity:3,craftCount:Math.ceil(Math.max(0,t.quantity-(stock[t.id]||0))/3)}));const plans=allocatePhasePlans([{targets:[{id:1,quantity:4},{id:2,quantity:4}]},{targets:[{id:1,quantity:3},{id:2,quantity:3}]}],{1:1,2:5},{},calculate);assert.equal(plans[0].rows[0].remaining,3);assert.equal(plans[1].available[1],0);assert.equal(plans[1].available[2],1);assert.equal(plans[1].rows[1].remaining,2);const surplus=allocatePhasePlans([{targets:[{id:1,quantity:1}]},{targets:[{id:1,quantity:3}]}],{}, {},calculate);assert.equal(surplus[1].available[1],2);assert.equal(surplus[1].rows[0].remaining,1);});
test('timed matching uses game item IDs and prefers an active node',()=>{const now=0,nodes=[{key:'later',itemId:44,spawns:[12],duration:2},{key:'active',itemId:44,spawns:[0],duration:2},{key:'other',itemId:45,spawns:[0],duration:2}];const matched=timedNodesForItem(nodes,44,now);assert.equal(matched.length,2);assert.equal(matched[0].key,'active');assert.equal(matched[0].window.active,true);assert.equal(timedNodesForItem(nodes,999,now).length,0);assert.equal(countdown(61000),'1m 01s');});
