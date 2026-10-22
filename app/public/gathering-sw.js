// This worker handles only gathering notifications; it does not intercept page requests.
const DB='portal-gathering-alerts',TAG='portal-gathering';
function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('settings');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function state(value){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('settings',value?'readwrite':'readonly'),r=value?tx.objectStore('settings').put(value,'device'):tx.objectStore('settings').get('device');let result;r.onsuccess=()=>result=r.result;tx.oncomplete=()=>resolve(value||result||{});tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
async function clear(){const notices=await self.registration.getNotifications();for(const n of notices)if(n.tag.startsWith(TAG))n.close();}
function liveItems(items,now,tracked){return items.filter(n=>Number(n.end)+60000>now&&(!tracked||tracked.includes(n.key)));}
async function showItems(p,items,tag,now,silent){
 const available=items.filter(n=>n.start<=now&&now<n.end).length,soon=items.filter(n=>now<n.start).length;
 const title=available?`${available} tracked gathering item(s) available`:soon?`${soon} tracked item(s) opening soon`:'Gathering window just ended';
 const body=items.slice(0,5).map(n=>(now>=n.end?'ENDED: ':now>=n.start?'NOW: ':'SOON: ')+n.name+' — '+n.location+(n.x!=null?` (X ${n.x}, Y ${n.y})`:'')).join('\n')+(items.length>5?`\n+${items.length-5} other tracked items`:'');
 await self.registration.showNotification(title,{body:body+'\nStop all alerts cancels every gathering timer on this device.',icon:'/branding/default-logo.svg',tag,silent,renotify:!silent,actions:[{action:'stop-all',title:'Stop ALL gathering alerts'},{action:'open',title:'View nodes'}],data:{gathering:true,items,payload:p},requireInteraction:true});
}
async function prune(now,tracked){for(const n of await self.registration.getNotifications()){
 if(!n.tag.startsWith(TAG))continue;
 if(!Array.isArray(n.data?.items)){if(n.tag!==TAG+'-test'&&(tracked||n.title==='undefined'||n.body?.startsWith('undefined')))n.close();continue;}
 const items=liveItems(n.data.items,now,tracked);if(!items.length)n.close();else if(items.length!==n.data.items.length)await showItems(n.data.payload,items,n.tag,now,true);
}}
async function acknowledgeCleanup(){
 // Chrome requires a notification for each web push. A silent, immediately closed
 // update avoids leaving its generic "site updated in the background" notice behind.
 const tag=TAG+'-cleanup';await self.registration.showNotification('Gathering timers updated',{tag,silent:true,renotify:false,data:{gathering:true}});
 for(const n of await self.registration.getNotifications())if(n.tag===tag)n.close();
}
async function stop(){const s=await state();await state({...s,enabled:false,pendingStop:!!s.token});await clear();
 // Unsubscribe locally as well: stopping works on this device even if server cancellation is offline.
 try{const sub=await self.registration.pushManager.getSubscription();if(sub)await sub.unsubscribe();}catch{/* Local suppression is already active; server cancellation still proceeds. */}await flushStop();
 const clients=await self.clients.matchAll({type:'window'});for(const c of clients)c.postMessage({type:'GATHERING_STOPPED'});
}
async function flushStop(){const s=await state();if(!s.pendingStop||!s.token)return;try{const r=await fetch('/api/gathering/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:s.token}),signal:AbortSignal.timeout(5000)});if(r.ok)await state({...s,pendingStop:false});else throw Error('Stop request pending.');}catch{try{await self.registration.sync.register('gathering-stop');}catch{/* Retried when page opens or next worker event arrives. */}}}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{await prune(Date.now());await self.clients.claim();})()));
self.addEventListener('sync',event=>{if(event.tag==='gathering-stop')event.waitUntil(flushStop());});
self.addEventListener('message',event=>event.waitUntil((async()=>{try{if(event.data?.type==='GATHERING_CONFIG'){const previous=await state();if(event.data.settings.automatic&&!previous.enabled){await state({...previous,token:event.data.settings.token,pendingStop:true,enabled:false});await flushStop();}else{await flushStop();await state(event.data.settings);}}if(event.data?.type==='GATHERING_STOP')await stop();if(event.data?.type==='GATHERING_FLUSH')await flushStop();event.ports[0]?.postMessage({ok:true});}catch{event.ports[0]?.postMessage({ok:false});}})()));
self.addEventListener('push',event=>event.waitUntil((async()=>{
 const s=await state();if(!s.enabled){await flushStop();return;}
 let p;try{p=event.data.json();}catch{return;}
 if(Number(p.enabledAt)!==Number(s.enabledAt)||p.expiresAt<Date.now())return;
 if(Array.isArray(p.items)){const now=Math.max(Date.now(),Number(p.sentAt)||0);await prune(now,p.tracked);const items=liveItems(p.items,now,p.tracked);if(p.cleanupOnly||!items.length){await acknowledgeCleanup();return;}await showItems(p,items,p.replace===false?TAG+'-'+p.sentAt:TAG+'-summary',now,p.silent===true);return;}
 const title=typeof p.title==='string'&&p.title.trim()?p.title:'Timed Gathering',body=typeof p.body==='string'&&p.body.trim()?p.body:'Open Timed Gathering to view your tracked nodes.';
 await self.registration.showNotification(title,{body:body+'\nStop all alerts cancels every gathering timer on this device.',icon:'/branding/default-logo.svg',tag:p.kind==='test'?TAG+'-test':p.replace===false?TAG+'-'+p.sentAt:TAG+'-summary',silent:p.silent===true,renotify:p.silent!==true,actions:[{action:'stop-all',title:'Stop ALL gathering alerts'},{action:'open',title:'View nodes'}],data:{gathering:true},requireInteraction:true});
})()));
self.addEventListener('notificationclick',event=>event.waitUntil((async()=>{
 if(event.action==='stop-all'){await stop();return;}event.notification.close();
 const url='/?view=crafting&craftTab=gathering';const pages=await self.clients.matchAll({type:'window',includeUncontrolled:true});const target=pages.find(c=>new URL(c.url).origin===self.location.origin);if(target){await target.navigate(url);await target.focus();}else await self.clients.openWindow(url);
})()));
// Swiping dismisses that notification only. Stop ALL is an explicit separate action.
