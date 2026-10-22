"use client";
import {useEffect,useRef,useState} from 'react';
import styles from './GearPlanner.module.css';
// Coordinates are on the silhouette's 240 × 520 viewBox, not arbitrary card rows.
export const BODY_ANCHORS:Record<string,[number,number]>={MainHand:[51,285],Body:[120,157],Head:[120,60],Gloves:[61,285],Legs:[120,355],Feet:[88,466],OffHand:[184,285],Ears:[149,59],Neck:[128,104],Wrists:[179,267],FingerL:[182,299],FingerR:[190,303]};
export default function GearLinks(){
 const ref=useRef<SVGSVGElement>(null),[lines,setLines]=useState<any[]>([]);
 useEffect(()=>{
  const root=ref.current?.parentElement;if(!root)return;
  let frame=0,visible=true,lastSignature='';
  const measure=()=>{if(frame)return;frame=requestAnimationFrame(()=>{
   frame=0;
   if(!visible||document.hidden)return;
   const box=root.getBoundingClientRect(),model=root.querySelector('[data-gear-model]')?.getBoundingClientRect(),panel=root.querySelector('[data-gear-model]')?.parentElement?.getBoundingClientRect();
   if(!model||!model.width){setLines([]);return;}
   // SVG uses xMidYMid meet; account for its letterboxing rather than stretching anchors.
   const scale=Math.min(model.width/240,model.height/520),ox=model.left-box.left+(model.width-240*scale)/2,oy=model.top-box.top+(model.height-520*scale)/2;
   const ringJoinY=(root.querySelector('[data-gear-slot="FingerL"]')?.getBoundingClientRect().top??box.top)-box.top+32;
   const next=Array.from(root.querySelectorAll<HTMLElement>('[data-gear-slot]')).map((card,index)=>{
    const slot=card.dataset.gearSlot!,a=BODY_ANCHORS[slot==='FingerR'?'FingerL':slot],r=card.getBoundingClientRect(),left=index<6;
    const weapon=(slot==='MainHand'||slot==='OffHand')&&panel;
    const x=weapon?(slot==='MainHand'?panel.left+16:panel.right-16)-box.left:ox+a[0]*scale,y=weapon?panel.top-box.top+16:oy+a[1]*scale,endX=(left?r.right:r.left)-box.left,endY=r.top-box.top+32;
    const laneIndex=slot==='FingerR'?10:index;
    const lane=left?model.left-box.left-6-laneIndex*2:model.right-box.left+6+(laneIndex-6)*2;
    return {slot,x,y,path:slot==='FingerR'?`M ${lane} ${ringJoinY} V ${endY} H ${endX}`:`M ${x} ${y} H ${lane} V ${endY} H ${endX}`};
   });
   const signature=JSON.stringify(next);if(signature!==lastSignature){lastSignature=signature;setLines(next);}
  });};
  const observer=new ResizeObserver(measure);observer.observe(root);root.querySelectorAll('[data-gear-slot],[data-gear-model]').forEach(e=>observer.observe(e));
  const visibility=new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);if(visible)measure();});
  const modelElement=root.querySelector('[data-gear-model]');if(modelElement)visibility.observe(modelElement);
  measure();window.addEventListener('resize',measure);
  // Capture also handles scrolling inside the portal's own scroll containers.
  window.addEventListener('scroll',measure,{passive:true,capture:true});
  document.addEventListener('visibilitychange',measure);
  return()=>{observer.disconnect();visibility.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);document.removeEventListener('visibilitychange',measure);};
 },[]);
 return <svg ref={ref} className={styles.links} aria-hidden="true">{lines.map(l=><g key={l.slot}><path d={l.path}/>{l.slot!=='FingerR'&&<circle cx={l.x} cy={l.y} r="3"/>}</g>)}</svg>;
}
