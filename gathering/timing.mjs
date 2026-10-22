// One Eorzea day is 4,200 real seconds. Always derive from epoch, never tick a drifting clock.
export const DAY=4200000, MINUTE=DAY/1440;
export function eorzeaTime(now=Date.now()){const minute=Math.floor(((now%DAY)+DAY)%DAY/MINUTE);return String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');}
export function windowFor(node,now=Date.now()){
 const starts=node.spawns||[],duration=Number(node.duration)*MINUTE;
 if(!starts.length||!Number.isFinite(duration)||duration<=0||duration>DAY)return null;
 const base=Math.floor(now/DAY)*DAY,windows=[];
 for(let day=-1;day<=1;day++)for(const hour of starts){if(Number.isFinite(hour)&&hour>=0&&hour<24){const start=base+day*DAY+hour*60*MINUTE;windows.push({start,end:start+duration});}}
 const active=windows.filter(w=>w.start<=now&&now<w.end).sort((a,b)=>b.start-a.start)[0];
 const next=windows.filter(w=>w.start>now).sort((a,b)=>a.start-b.start)[0];
 return active?{...active,active:true,nextStart:next?.start}:{...next,active:false,nextStart:next?.start};
}
export function inQuietHours(now,timezone,start,end){
 if(!start||!end||start===end)return false;
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now));
 const time=parts.find(p=>p.type==='hour').value+':'+parts.find(p=>p.type==='minute').value;
 return start<end?time>=start&&time<end:time>=start||time<end;
}
export function notificationState(nodes,settings,now){
 const available=nodes.map(n=>({...n,window:windowFor(n,now)})).filter(n=>n.window?.active).sort((a,b)=>a.window.end-b.window.end);
 const upcoming=nodes.map(n=>({...n,window:windowFor(n,now)})).filter(n=>n.window&&!n.window.active&&n.window.start-now<=settings.leadMinutes*60000).sort((a,b)=>a.window.start-b.window.start);
 const signature=available.map(n=>n.key+'@'+n.window.start).join(',')+'|'+upcoming.map(n=>n.key+'@'+n.window.start).join(',');
 return {available,upcoming,signature};
}
// Keep the just-closed window visible for one real minute, then request cleanup.
export function notificationDisplayState(nodes,settings,now){
 const state=notificationState(nodes,settings,now);
 const ended=nodes.map(n=>({...n,window:windowFor(n,now-60000)})).filter(n=>n.window?.active&&n.window.end<=now).map(n=>({...n,window:{...n.window,active:false},ended:true}));
 return {...state,ended,signature:state.signature+'|'+ended.map(n=>n.key+'@'+n.window.start).join(',')};
}
// Keep text fields alongside structured items: previously installed workers need them.
export function notificationText(items,now){
 const available=items.filter(n=>n.start<=now&&now<n.end).length,soon=items.filter(n=>now<n.start).length;
 const title=available?`${available} tracked gathering item(s) available`:soon?`${soon} tracked item(s) opening soon`:items.length?'Gathering window just ended':'Gathering window ended';
 const body=items.slice(0,5).map(n=>(now>=n.end?'ENDED: ':now>=n.start?'NOW: ':'SOON: ')+(n.name||'Gathering item')+' — '+(n.location||'Location unavailable')+(n.x!=null&&n.y!=null?` (X ${n.x}, Y ${n.y})`:'')).join('\n')+(items.length>5?`\n+${items.length-5} other tracked items`:'');
 return {title,body:body||'No tracked nodes available now. Future alerts remain enabled.'};
}
export function validateSettings(input,allowed){
 if(!Array.isArray(input.tracked)||input.tracked.length>100||input.tracked.some(k=>typeof k!=='string'||!allowed.has(k)))throw Error('Choose up to 100 valid timed items.');
 const leadMinutes=Number(input.leadMinutes??1);if(!Number.isInteger(leadMinutes)||leadMinutes<0||leadMinutes>5)throw Error('Advance warning must be 0–5 real minutes.');
 const timezone=String(input.timezone||'UTC');try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{throw Error('Choose a valid time zone.');}
 const quietStart=String(input.quietStart||''),quietEnd=String(input.quietEnd||'');for(const t of [quietStart,quietEnd])if(t&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))throw Error('Choose valid quiet-hour times.');
 return {tracked:[...new Set(input.tracked)],leadMinutes,timezone,quietStart,quietEnd,enabled:input.enabled===true,summaryMode:input.summaryMode!==false};
}
