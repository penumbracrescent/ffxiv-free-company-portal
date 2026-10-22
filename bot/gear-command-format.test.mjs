import test from 'node:test';import assert from 'node:assert/strict';
import {gearEquipmentFields,GEAR_PRICE_NOTICE} from './gear-command-format.mjs';
const market=(slot='MainHand',id=30987)=>({slot,item:{id,name:'Exarchic Rod',tradable:true},quality:'HQ',cost:5250,offer:{kind:'market',worldName:'Sargatanas',quantity:1}});
test('each market piece links to its own Universalis item and names its purchase world',()=>{const fields=gearEquipmentFields([market()],{MainHand:'Main hand'});assert.match(fields[0].value,/Main hand: \[Exarchic Rod\]\(https:\/\/universalis.app\/market\/30987\).*HQ.*5,250 gil.*Sargatanas/);});
test('vendor pieces show merchant, zone and coordinates without implying market stock',()=>{const row={...market(),quality:'NQ',offer:{kind:'vendor',merchants:[{name:'Syneyhil',zone:'Limsa Lominsa',x:6.3,y:11.9}]}};assert.match(gearEquipmentFields([row],{})[0].value,/Vendor: Syneyhil — Limsa Lominsa \(X 6.3, Y 11.9\)/);});
test('missing listings are explicitly unpriced; untradable items do not get market links',()=>{const row={...market(),cost:null,offer:undefined,item:{id:1,name:'Quest reward',tradable:false}};const value=gearEquipmentFields([row],{})[0].value;assert.match(value,/Unpriced · No available listing/);assert.doesNotMatch(value,/universalis/);});
test('long plans split into Discord-safe fields without dropping either ring or any slot',()=>{const rows=Array.from({length:12},(_,i)=>({...market(`slot${i}`,30000+i),item:{id:30000+i,name:'A long equipment name '.repeat(6)},offer:{kind:'vendor',merchants:[{name:'Merchant '.repeat(10),zone:'Location '.repeat(10),x:1,y:2}]}}));const fields=gearEquipmentFields(rows,{});assert.ok(fields.length>1);assert.ok(fields.every(f=>f.value.length<=1024));for(let i=0;i<12;i++)assert.match(fields.map(f=>f.value).join('\n'),new RegExp(`slot${i}:`));assert.ok(fields.reduce((n,f)=>n+f.name.length+f.value.length,0)<5500);});
test('shared market stack costs are not advertised as free gear',()=>{const row={...market(),cost:0,offer:{kind:'market',world:73,quantity:2}};assert.match(gearEquipmentFields([row],{})[0].value,/Included in shared listing · World 73 · 2 units in listing/);});
test('price notice attributes Universalis and explains price and stock are not guaranteed',()=>{assert.match(GEAR_PRICE_NOTICE,/Universalis/);assert.match(GEAR_PRICE_NOTICE,/not guaranteed prices or stock/);assert.match(GEAR_PRICE_NOTICE,/Confirm before traveling/);});
test('gear is grouped by world in shopping-stop order rather than body-slot order',()=>{
 const rows=[market('Body'),{...market('MainHand'),offer:{kind:'market',worldName:'Jenova',quantity:1}},{...market('Feet'),offer:{kind:'market',worldName:'Jenova',quantity:1}},market('FingerR')];
 const fields=gearEquipmentFields(rows,{},['Jenova','Sargatanas']);
 assert.deepEqual(fields.map(f=>f.name),['Stop 1 · Jenova','Stop 2 · Sargatanas']);
 assert.match(fields[0].value,/MainHand:/);assert.match(fields[0].value,/Feet:/);assert.doesNotMatch(fields[0].value,/Body:/);
 assert.match(fields[1].value,/Body:/);assert.match(fields[1].value,/FingerR:/);
});
test('vendors and unpriced pieces stay separate and do not count as world stops',()=>{
 const rows=[{...market('Head'),offer:undefined,cost:null},{...market('Body'),offer:{kind:'vendor',merchants:[{name:'Merchant',zone:'Gridania'}]}},market()];
 assert.deepEqual(gearEquipmentFields(rows,{},['Vendors','Sargatanas']).map(f=>f.name),['Stop 1 · Sargatanas','Vendor purchases','Unpriced equipment']);
});
test('oversized stops use numbered parts instead of generic equipment continuation headings',()=>{
 const rows=Array.from({length:12},(_,i)=>({...market(`slot${i}`,30000+i),item:{id:30000+i,name:'A long equipment name '.repeat(6)}}));
 const fields=gearEquipmentFields(rows,{},['Sargatanas']);
 assert.ok(fields.length>1);assert.ok(fields.every(f=>f.name.startsWith('Stop 1 · Sargatanas · Part ')));assert.ok(fields.every(f=>f.value.length<=1024));
 assert.doesNotMatch(JSON.stringify(fields),/Equipment \(continued\)/);
});
