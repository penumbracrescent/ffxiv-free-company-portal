import {JOBS} from './core.mjs';
export const PREFERENCE_KEY='gear-planner-inputs-v1';
export function readPreferences(storage){
 try{const value=JSON.parse(storage.getItem(PREFERENCE_KEY)||'null');if(!value)return {job:'GLA',level:1};return {job:Object.hasOwn(JOBS,value.job)?value.job:'GLA',level:Number.isInteger(value.level)&&value.level>=1&&value.level<=100?value.level:1};}
 catch{return {job:'GLA',level:1};}
}
export function savePreferences(storage,job,level){if(!Object.hasOwn(JOBS,job)||!Number.isInteger(level)||level<1||level>100)return;try{storage.setItem(PREFERENCE_KEY,JSON.stringify({job,level}));}catch{/* Restricted browser storage must not stop gear planning. */}}
