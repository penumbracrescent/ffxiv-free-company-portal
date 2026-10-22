"use client";
import {useEffect,useRef,useState}from'react';import{notificationState,inQuietHours}from'../../lib/gathering/timing.mjs';
type SoundSettings={tracked:string[];leadMinutes:number;timezone:string;quietStart:string;quietEnd:string;volume:number;sound?:string};
type SoundPreset={label:string;notes:number[];wave:OscillatorType;spacing:number;length:number;peak?:number;weights?:number[]};
export const gatheringSounds:Record<string,SoundPreset>={chime:{label:'Soft chime',notes:[660,880,1100],wave:'sine',spacing:.18,length:.22},bell:{label:'Bell',notes:[1046.5,1318.5],wave:'sine',spacing:.3,length:.55},digital:{label:'Digital',notes:[880,660,880],wave:'triangle',spacing:.12,length:.12},gentle:{label:'Gentle',notes:[440,554.4,659.3],wave:'sine',spacing:.3,length:.4},alert:{label:'Alert — sharp triple beep',notes:[1200,1200,1200],wave:'square',spacing:.25,length:.18},alarm:{label:'Alarm — repeating high/low',notes:[740,1040,740,1040,740,1040],wave:'square',spacing:.25,length:.22},loudDing:{label:'Loud ding — boosted bell',notes:[2093,4186,5581,130.8,261.6],wave:'sine',spacing:0,length:1.5,peak:.95,weights:[.55,.12,.03,.2,.1]}};
export default function useGatheringSiteSound(nodes:any[],offset:number){
 const context=useRef<AudioContext|null>(null),output=useRef<GainNode|null>(null),oscillators=useRef(new Set<OscillatorNode>()),applied=useRef<SoundSettings|null>(null),seen=useRef(new Set<string>()),notices=useRef<any[]>([]),catalogue=useRef(nodes),clockOffset=useRef(offset),[active,setActive]=useState(false),[alert,setAlert]=useState('');
 catalogue.current=nodes;clockOffset.current=offset;
 async function unlock(){if(!context.current){const Constructor=window.AudioContext||(window as any).webkitAudioContext;if(!Constructor)throw Error('This browser cannot play site audio. Use system notifications instead.');context.current=new Constructor();const ctx=context.current!,input=ctx.createGain(),limiter=ctx.createWaveShaper(),curve=new Float32Array(4097);input.gain.value=.5;for(let i=0;i<curve.length;i++){const value=(i/(curve.length-1)*2-1)*2,magnitude=Math.abs(value);curve[i]=Math.sign(value)*(magnitude<=.85?magnitude:.85+.1*Math.tanh((magnitude-.85)/.1));}limiter.curve=curve;limiter.oversample='4x';input.connect(limiter);limiter.connect(ctx.destination);output.current=input;}await context.current!.resume();if(context.current!.state!=='running')throw Error('Audio is blocked. Unmute this browser tab and click Enable site sound again.');}
 function chime(volume:number,sound='chime'){const ctx=context.current;if(!ctx||ctx.state!=='running'||!Number.isFinite(volume)||volume<=0)return;// Keep simultaneous harmonics below full scale and avoid overlapping previews.
 for(const oscillator of oscillators.current){try{oscillator.stop();}catch{}}oscillators.current.clear();
 const preset=gatheringSounds[sound]||gatheringSounds.chime,start=ctx.currentTime;for(const [i,hz]of preset.notes.entries()){const oscillator=ctx.createOscillator(),gain=ctx.createGain(),time=start+i*preset.spacing;oscillators.current.add(oscillator);oscillator.type=preset.wave as OscillatorType;oscillator.frequency.value=hz;gain.gain.setValueAtTime(0,time);const peak=Math.max(0,Math.min(200,volume))/100*(preset.peak??.18)*(preset.weights?.[i]??1);gain.gain.linearRampToValueAtTime(peak,time+.02);gain.gain.exponentialRampToValueAtTime(.0001,time+preset.length-.02);oscillator.connect(gain);gain.connect(output.current!);oscillator.start(time);oscillator.stop(time+preset.length);oscillator.onended=()=>{oscillators.current.delete(oscillator);oscillator.disconnect();gain.disconnect();};}}
 function events(settings:SoundSettings,now:number){const state=notificationState(catalogue.current.filter(n=>settings.tracked.includes(n.key)),settings,now);return [...state.available.map((n:any)=>({...n,event:n.key+'@'+n.window.start+':open'})),...state.upcoming.map((n:any)=>({...n,event:n.key+'@'+n.window.start+':soon'}))];}
 async function enable(settings:SoundSettings){await unlock();applied.current={...settings,tracked:[...settings.tracked]};seen.current=new Set(events(settings,Date.now()+clockOffset.current).map(n=>n.event));setActive(true);notices.current=[];setAlert('');chime(settings.volume,settings.sound);}
 async function test(volume:number,sound='chime'){await unlock();chime(volume,sound);}
 function stop(){applied.current=null;setActive(false);notices.current=[];setAlert('');for(const oscillator of oscillators.current){try{oscillator.stop();}catch{}}oscillators.current.clear();void context.current?.suspend();}
 function renderNotices(now:number){setAlert(notices.current.slice(0,4).map(n=>(now>=n.window.end?'Window ended: ':now>=n.window.start?'Available now: ':'Opening soon: ')+n.name+' — '+n.location+(n.x!=null?` (X ${n.x}, Y ${n.y})`:'')).join(' · ')+(notices.current.length>4?` · +${notices.current.length-4} more`:''));}
 useEffect(()=>{const timer=setInterval(()=>{
  const settings=applied.current;if(!settings)return;
  const now=Date.now()+clockOffset.current;
  const retained=notices.current.filter(n=>n.window.end+60000>now&&settings.tracked.includes(n.key));
  if(retained.length!==notices.current.length){notices.current=retained;renderNotices(now);}
  if(context.current?.state!=='running'){applied.current=null;setActive(false);notices.current=[];setAlert('Browser audio was suspended. Click Resume site sound to continue.');return;}
  const list=events(settings,now),fresh=list.filter(n=>!seen.current.has(n.event));
  for(const n of list)seen.current.add(n.event);if(seen.current.size>1000)seen.current=new Set(list.map(n=>n.event));
  if(!fresh.length||inQuietHours(now,settings.timezone,settings.quietStart,settings.quietEnd))return;
  chime(settings.volume,settings.sound);
  for(const n of fresh){notices.current=notices.current.filter(old=>old.key!==n.key);notices.current.push(n);}
  renderNotices(now);
 },1000);return()=>{clearInterval(timer);applied.current=null;void context.current?.close();context.current=null;output.current=null;};},[]);
 function update(settings:SoundSettings){if(applied.current)applied.current={...settings,tracked:[...settings.tracked]};}
 return {active,alert,enable,update,test,stop,clear:()=>{notices.current=[];setAlert('');}};
}
