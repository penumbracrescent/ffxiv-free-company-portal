import test from "node:test";
import assert from "node:assert/strict";
import { calculateChocoboColor, chocoboOrderFields } from "./chocobo-color.mjs";
test("chocobo planner returns no fruit for the same color",()=>assert.deepEqual(calculateChocoboColor("Desert Yellow","Desert Yellow"),{list:[],order:[]}));
test("chocobo planner produces alternating totals and order",()=>{const plan=calculateChocoboColor("Desert Yellow","Soot Black");assert.ok(plan.list.length);assert.equal(plan.list.reduce((n,x)=>n+x.count,0),plan.order.length);});
test("long feeding orders are split without dropping a step",()=>{const order=Array.from({length:150},(_,index)=>"Fruit "+index),fields=chocoboOrderFields(order,200);assert.ok(fields.length>1);assert.ok(fields.every(field=>field.value.length<=200));assert.equal(fields.flatMap(field=>field.value.split("\n")).length,order.length);});
