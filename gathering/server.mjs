import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import pg from 'pg';import webpush from 'web-push';
import {downloadCatalogue} from './catalogue.mjs';import {notificationDisplayState,notificationText,inQuietHours,validateSettings} from './timing.mjs';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:4}),hash=s=>createHash('sha256').update(s).digest('hex');
const internal=hash('timed-gathering:'+process.env.AUTH_SECRET),origin=process.env.PORTAL_URL;
if(!process.env.AUTH_SECRET||!/^https?:\/\//.test(origin||''))throw Error('AUTH_SECRET and an HTTP(S) PORTAL_URL are required. System notifications require a secure browser context.');
await mkdir('/state',{recursive:true});let vapid;
try{vapid=JSON.parse(await readFile('/state/vapid.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;vapid=webpush.generateVAPIDKeys();await writeFile('/state/vapid.json',JSON.stringify(vapid),{mode:0o600,flag:'wx'});}
webpush.setVapidDetails(origin.replace(/^http:/,'https:'),vapid.publicKey,vapid.privateKey);
await pool.query(`create table if not exists portal_timed_catalogue(id integer primary key check(id=1),data jsonb not null,updated_at timestamptz not null default now());
 create table if not exists portal_timed_devices(id uuid primary key,owner text not null,endpoint_hash text unique not null,subscription jsonb not null,stop_hash text not null,settings jsonb not null,last_signature text,last_events jsonb not null default '[]',enabled_at bigint not null,updated_at timestamptz not null default now(),last_sent_at timestamptz,last_error text);
 create index if not exists portal_timed_devices_owner on portal_timed_devices(owner);`);
let catalogue=(await pool.query('select data from portal_timed_catalogue where id=1')).rows[0]?.data||null,importError='',lastRefreshAttempt=0;
async function refresh(){lastRefreshAttempt=Date.now();try{const next=await downloadCatalogue();await pool.query('insert into portal_timed_catalogue(id,data) values(1,$1) on conflict(id) do update set data=excluded.data,updated_at=now()',[JSON.stringify(next)]);catalogue=next;importError='';console.log('Timed gathering imported',next.nodes.length,'items',next.revision);}catch(e){importError=e.message;console.error('Timed gathering import:',importError);}}
if(catalogue)void refresh();else await refresh();
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>32000)throw Error('Request is too large.');}return JSON.parse(text||'{}');}
function authorized(req){const value=Buffer.from(String(req.headers['x-gathering-key']||'')),expected=Buffer.from(internal);return value.length===expected.length&&timingSafeEqual(value,expected);}
function validSubscription(s){
 if(!s||typeof s.endpoint!=='string'||s.endpoint.length>2048)throw Error('Invalid push subscription.');const u=new URL(s.endpoint);
 // Never send requests to user-supplied internal URLs; only supported vendor push gateways.
 const hosts=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'];
 if(u.protocol!=='https:'||u.port||u.username||u.password||!hosts.some(h=>u.hostname===h||h==='web.push.apple.com'&&u.hostname.endsWith('.'+h)))throw Error('Unsupported browser push gateway. Try Chrome, Edge, Firefox, or Safari.');
 if(!/^[A-Za-z0-9_-]{80,100}$/.test(s.keys?.p256dh||'')||!/^[A-Za-z0-9_-]{20,30}$/.test(s.keys?.auth||''))throw Error('Invalid push keys.');return {endpoint:s.endpoint,keys:s.keys};
}
async function stop(token){if(!/^[a-f0-9]{64}$/.test(token||''))throw Error('Invalid stop-alert token.');await pool.query("update portal_timed_devices set settings=jsonb_set(settings,'{enabled}','false'),updated_at=now(),last_signature=null where stop_hash=$1",[hash(token)]);}
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://gathering');if(url.pathname==='/health')return json(res,catalogue?200:503,{ready:!!catalogue,items:catalogue?.nodes.length||0,importError});
 if(!authorized(req))return json(res,403,{error:'Forbidden.'});
 if(req.method==='GET'&&url.pathname==='/catalogue')return json(res,200,{...catalogue,serverTime:Date.now(),importError,ready:!!catalogue});
 if(req.method==='GET'&&url.pathname==='/config')return json(res,200,{publicKey:vapid.publicKey,serverTime:Date.now()});
 if(req.method==='POST'&&url.pathname==='/stop'){const b=await body(req);await stop(b.token);return json(res,200,{stopped:true});}
 if(req.method==='POST'&&url.pathname==='/device'){
  const b=await body(req);if(!/^[a-f0-9-]{36}$/.test(b.id||'')||typeof b.owner!=='string'||!b.owner||b.owner.length>100)throw Error('Invalid device.');
  const allowed=new Set((catalogue?.nodes||[]).map(n=>n.key)),settings=validateSettings(b.settings,allowed),subscription=validSubscription(b.subscription),endpointHash=hash(subscription.endpoint);
  const token=randomBytes(32).toString('hex'),enabledAt=Date.now();
  const existing=(await pool.query('select 1 from portal_timed_devices where id=$1',[b.id])).rowCount;
  if(!existing&&Number((await pool.query('select count(*) from portal_timed_devices where owner=$1',[b.owner])).rows[0].count)>=10)throw Error('This account already has 10 registered devices. Contact the portal operator to remove an old device.');
  const r=await pool.query(`insert into portal_timed_devices(id,owner,endpoint_hash,subscription,stop_hash,settings,enabled_at) values($1,$2,$3,$4,$5,$6,$7) on conflict(id) do update set subscription=excluded.subscription,endpoint_hash=excluded.endpoint_hash,stop_hash=excluded.stop_hash,settings=excluded.settings,last_signature=null,last_events=case when portal_timed_devices.settings->>'enabled'='true' then portal_timed_devices.last_events else '[]'::jsonb end,enabled_at=excluded.enabled_at,updated_at=now(),last_error=null where portal_timed_devices.owner=excluded.owner returning id`,[b.id,b.owner,endpointHash,JSON.stringify(subscription),hash(token),JSON.stringify(settings),enabledAt]);
  if(!r.rowCount)return json(res,403,{error:'This device belongs to another signed-in account. Clear this device’s alerts first.'});return json(res,200,{token,enabledAt,settings});
 }
 if(req.method==='GET'&&url.pathname==='/device'){const r=await pool.query('select settings,last_sent_at,last_error from portal_timed_devices where id=$1 and owner=$2',[url.searchParams.get('id'),url.searchParams.get('owner')]);return json(res,200,r.rows[0]||{settings:null});}
 if(req.method==='POST'&&url.pathname==='/test'){const b=await body(req);const r=(await pool.query('select * from portal_timed_devices where id=$1 and owner=$2',[b.id,b.owner])).rows[0];if(!r||!r.settings.enabled)throw Error('Enable alerts on this device first.');await webpush.sendNotification(r.subscription,JSON.stringify({title:'Gathering alerts are ready',body:'Test alert. Stop all alerts disables every gathering timer on this device.',kind:'test',enabledAt:r.enabled_at,sentAt:Date.now(),expiresAt:Date.now()+60000}),{TTL:60,urgency:'high',timeout:10000});return json(res,200,{sent:true});}
 return json(res,404,{error:'Not found.'});
 }catch(e){console.error('Gathering request failed:',e.code||e.name);json(res,400,{error:e.code==='23505'?'This browser subscription is already linked. Stop alerts on the previous account first.':e.message});}}).listen(8081,'0.0.0.0');
async function tick(){
 try{
  const now=Date.now();if(now-lastRefreshAttempt>3600000&&(!catalogue||now-new Date(catalogue.importedAt).getTime()>7*86400000))await refresh();
  if(!catalogue)return;const rows=(await pool.query(`select d.* from portal_timed_devices d where d.settings->>'enabled'='true' and exists(select 1 from portal_discord_links dl join portal_characters c on c.id=dl.character_id where dl.discord_user_id=d.owner and c.active=true and c.fc_membership_status='current')`)).rows;
  for(const device of rows){
   const s=device.settings,quiet=inQuietHours(now,s.timezone,s.quietStart,s.quietEnd);
   const nodes=catalogue.nodes.filter(n=>s.tracked.includes(n.key)),state=notificationDisplayState(nodes,s,now);if(state.signature===device.last_signature)continue;
   const events=[...state.available.map(n=>n.key+'@'+n.window.start+':open'),...state.upcoming.map(n=>n.key+'@'+n.window.start+':soon')];
   if(!events.length&&!state.ended.length&&!device.last_signature&&!(device.last_events||[]).length){await pool.query('update portal_timed_devices set last_signature=$2 where id=$1 and enabled_at=$3',[device.id,state.signature,device.enabled_at]);continue;}
   const fresh=!quiet&&events.some(e=>!(device.last_events||[]).includes(e));
   const list=[...state.available,...state.upcoming,...state.ended];
   const items=list.map(n=>({key:n.key,name:n.name,location:n.location,x:n.x,y:n.y,start:n.window.start,end:n.window.end}));
   const payload={...notificationText(items,now),kind:'summary',items,tracked:s.tracked,cleanupOnly:quiet||(!s.summaryMode&&!fresh),enabledAt:device.enabled_at,sentAt:now,expiresAt:now+300000,silent:!fresh,replace:s.summaryMode};
   // Re-check immediately before delivery so stop-all wins against an in-flight scheduler pass.
   const live=(await pool.query("select 1 from portal_timed_devices where id=$1 and settings->>'enabled'='true' and enabled_at=$2",[device.id,device.enabled_at])).rowCount;if(!live)continue;
   try{await webpush.sendNotification(device.subscription,JSON.stringify(payload),{TTL:Math.max(1,Math.min(60,Math.floor((payload.expiresAt-now)/1000))),urgency:'high',timeout:10000,topic:s.summaryMode?'gathering-summary':undefined});await pool.query('update portal_timed_devices set last_signature=$2,last_events=$3,last_sent_at=now(),last_error=null where id=$1 and enabled_at=$4',[device.id,state.signature,JSON.stringify(events),device.enabled_at]);}
   catch(e){if([404,410].includes(e.statusCode))await pool.query("update portal_timed_devices set settings=jsonb_set(settings,'{enabled}','false'),last_error='Browser subscription expired. Enable alerts again.' where id=$1",[device.id]);else await pool.query("update portal_timed_devices set last_error='Push delivery failed; retry pending.' where id=$1",[device.id]);}
  }
 }catch(e){console.error('Gathering scheduler:',e.message);}finally{setTimeout(tick,15000);}
}
tick();console.log('Timed gathering scheduler running; no server restart needed.');
