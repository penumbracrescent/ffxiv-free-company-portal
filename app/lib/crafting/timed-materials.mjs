import {windowFor} from '../gathering/timing.mjs';
export function timedNodesForItem(nodes,itemId,now){return nodes.filter(n=>Number(n.itemId)===Number(itemId)).map(n=>({...n,window:windowFor(n,now)})).filter(n=>n.window).sort((a,b)=>Number(b.window.active)-Number(a.window.active)||(a.window.start-b.window.start)||a.key.localeCompare(b.key));}
export function countdown(ms){const seconds=Math.max(0,Math.ceil(ms/1000));return Math.floor(seconds/60)+'m '+String(seconds%60).padStart(2,'0')+'s';}
