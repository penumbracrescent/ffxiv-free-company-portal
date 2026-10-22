"use client";
import {createContext,useContext,useEffect,useState,useMemo} from 'react';
import {timedNodesForItem,countdown} from '../../lib/crafting/timed-materials.mjs';
import TimedGathering from './TimedGathering';
import baseStyles from './PersonalCraftPlanner.module.css';
import workshopStyles from './SoloWorkshop.module.css';
const styles={...baseStyles,...workshopStyles};
const CatalogueContext=createContext<any[]>([]);
export function useTimedItemIds(){const nodes=useContext(CatalogueContext);return useMemo(()=>new Set(nodes.map(n=>Number(n.itemId))),[nodes]);}
const TimedContext=createContext<any>({nodes:[],now:Date.now(),ready:false,error:'',settings:{tracked:[]}});
export function CraftTimedProvider({userKey,children}:{userKey:string;children:React.ReactNode}){
 const [catalogue,setCatalogue]=useState<any>(null),[error,setError]=useState(''),[offset,setOffset]=useState(0),[now,setNow]=useState(Date.now()),[settings,setSettings]=useState<any>({tracked:[]});
 useEffect(()=>{let live=true;async function load(){const start=Date.now();try{const r=await fetch('/api/gathering/catalogue',{cache:'no-store'}),d=await r.json();if(!r.ok||!d.ready)throw Error(d.error||'Timed-node catalog is not ready.');if(live){setCatalogue(d);setOffset(d.serverTime-(start+Date.now())/2);setError('');}}catch(e:any){if(live)setError(e.message);}}void load();const timer=setInterval(load,300000),tick=setInterval(()=>setNow(Date.now()),1000);return()=>{live=false;clearInterval(timer);clearInterval(tick);};},[]);
 useEffect(()=>{function refresh(){try{setSettings(JSON.parse(localStorage.getItem('portal-timed:'+userKey)||'{}').settings||{tracked:[]});}catch{setSettings({tracked:[]});}}refresh();window.addEventListener('portal-gathering-settings',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('portal-gathering-settings',refresh);window.removeEventListener('storage',refresh);};},[userKey]);
 return <CatalogueContext.Provider value={catalogue?.nodes||[]}><TimedContext.Provider value={{nodes:catalogue?.nodes||[],ready:!!catalogue?.ready,now:now+offset,error,settings}}>{children}<div className={styles.craftAlertControls}><TimedGathering userKey={userKey} alertOnly/></div></TimedContext.Provider></CatalogueContext.Provider>;
}
export function TimedMaterial({itemId,needed=1}:{itemId:number;needed?:number}){
 const {nodes,now,ready,settings}=useContext(TimedContext),matches=timedNodesForItem(nodes,itemId,now),[selection,setSelection]=useState('');
 const node=matches.find((n:any)=>n.key===selection)||matches[0];if(!node)return null;
 const tracked=settings.tracked?.includes(node.key),active=node.window.active&&needed>0;
 return <div className={styles.timedMaterial} data-timed-active={active?'true':'false'}><strong>{node.window.active?'Available now · closes in ':'Next opening in '}{countdown((node.window.active?node.window.end:node.window.start)-now)}</strong><small>{node.location} · X {node.x??'?'}, Y {node.y??'?'} · {node.job} · Lv {node.level} · {node.type}{node.collectable?' · Collectable':''}</small><small>{node.window.active?'Closes':'Opens'} {new Date(node.window.active?node.window.end:node.window.start).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}{node.folklore?' · Unlock: '+node.folklore:''}</small>{matches.length>1&&<label>Timed location<select aria-label="Timed location" value={node.key} onChange={e=>setSelection(e.target.value)}>{matches.map((n:any)=><option key={n.key} value={n.key}>{n.location} · {n.job} · Lv {n.level}{n.window.active?' · Available now':''}</option>)}</select></label>}<button type="button" disabled={!ready||needed<=0} onClick={()=>window.dispatchEvent(new CustomEvent('portal-craft-track',{detail:{key:node.key}}))}>{needed<=0?'Material covered':tracked?(settings.enabled?'Alerts enabled · settings':'Tracked · enable alerts'):'Enable alerts'}</button><small>{tracked?'Uses your shared Timed Gathering watch list and quiet hours.':'Selects this node and opens alert controls. No notification permission is requested until you enable your chosen delivery method.'}</small></div>;
}
