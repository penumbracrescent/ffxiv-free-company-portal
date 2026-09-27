"use client";
import { useEffect, useMemo, useState } from "react";
import { CalculatorTrust, ReportCalculatorIssue, clamp, useSavedState } from "./CalculatorCommon";
import { CHOCOBO_COLORS, CHOCOBO_FRUIT } from "./CalculatorData";

export function chocoboPlan(currentName:string,targetName:string){
  const current=CHOCOBO_COLORS.find(color=>color[0]===currentName)||CHOCOBO_COLORS[35];
  const target=CHOCOBO_COLORS.find(color=>color[0]===targetName)||CHOCOBO_COLORS[5];
  const difference=[1,2,3].map(index=>(Number(target[index])-Number(current[index]))/5);
  const blue=(difference[0]+difference[1])/2, total=-difference[2]-blue, split=(difference[0]-difference[1])/2;
  const signed=[(total+split)/2,(total-split)/2,blue].map(Math.round);
  const counts=[Math.max(0,signed[0]),Math.max(0,-signed[0]),Math.max(0,signed[1]),Math.max(0,-signed[1]),Math.max(0,signed[2]),Math.max(0,-signed[2])];
  const remaining=[...counts],order:string[]=[],steps:{fruit:string;color:[number,number,number]}[]=[];
  let rgb:[number,number,number]=[Number(current[1]),Number(current[2]),Number(current[3])];
  const effects:[[number,number,number],[number,number,number],[number,number,number],[number,number,number],[number,number,number],[number,number,number]]=[[5,-5,-5],[-5,5,5],[-5,5,-5],[5,-5,5],[-5,-5,5],[5,5,-5]];
  while(remaining.some(Boolean)) for(let index=0;index<remaining.length;index++) if(remaining[index]>0){remaining[index]--;order.push(CHOCOBO_FRUIT[index]);rgb=rgb.map((value,channel)=>clamp(value+effects[index][channel],0,255)) as [number,number,number];steps.push({fruit:CHOCOBO_FRUIT[index],color:rgb});}
  return {current,target,counts,order,steps};
}

const swatch=(color:readonly [string,number,number,number])=>`rgb(${color[1]} ${color[2]} ${color[3]})`;
export default function ChocoboCalculator(){
  const [saved,setSaved]=useSavedState("chocobo",{current:"Desert Yellow",target:"Soot Black"});
  const [filter,setFilter]=useState(""); const [checked,setChecked]=useState<number[]>([]);
  useEffect(()=>{const parameters=new URLSearchParams(window.location.search),current=parameters.get("current"),target=parameters.get("target");if(CHOCOBO_COLORS.some(color=>color[0]===current)&&CHOCOBO_COLORS.some(color=>color[0]===target))setSaved({current:current!,target:target!});},[]);
  const plan=useMemo(()=>chocoboPlan(saved.current,saved.target),[saved]);
  const visible=CHOCOBO_COLORS.filter(color=>color[0].toLowerCase().includes(filter.toLowerCase()));
  const context={...saved,fruitCounts:plan.counts,completedSteps:checked.length};
  return <article className="calculator-panel">
    <header className="calculator-heading"><div><span className="tag">Visual feeding assistant</span><h3>Chocobo color planner</h3><p>Preview colors, prepare the fruit, and check off every confirmed feeding.</p></div><div className="calculator-color-pair"><span style={{background:swatch(plan.current)}} title={saved.current}/><b>→</b><span style={{background:swatch(plan.target)}} title={saved.target}/></div></header>
    <CalculatorTrust confidence="Estimate" updated="September 14, 2026" sources={[{label:"FFXIV community color research",url:"https://ffxiv.consolegameswiki.com/wiki/Chocobo_Colors"}]}>Fruit effects are modeled at five RGB points; hidden values and missed messages can change the result.</CalculatorTrust>
    <label>Find a color<input value={filter} onChange={event=>setFilter(event.target.value)} placeholder="Try purple, blue, soot…"/></label>
    <div className="calculator-color-grid">{visible.map(color=><button type="button" key={color[0]} onClick={()=>setSaved({...saved,target:color[0]})} className={saved.target===color[0]?"active":""}><span style={{background:swatch(color)}}/><b>{color[0]}</b></button>)}</div>
    <div className="calculator-fields"><label>Current color<select value={saved.current} onChange={event=>{setSaved({...saved,current:event.target.value});setChecked([])}}>{CHOCOBO_COLORS.map(color=><option key={color[0]}>{color[0]}</option>)}</select></label><label>Target color<select value={saved.target} onChange={event=>{setSaved({...saved,target:event.target.value});setChecked([])}}>{CHOCOBO_COLORS.map(color=><option key={color[0]}>{color[0]}</option>)}</select></label></div>
    <section className="calculator-result"><h4>Shopping list</h4><p>{plan.counts.map((count,index)=>count?`${count} ${CHOCOBO_FRUIT[index]}`:"").filter(Boolean).join(" · ")||"No fruit needed."}</p>
      <p className="calculator-callout">Feed in the exact order below. Advance only when the game says the chocobo is beginning to grow new feathers; if that message does not appear, repeat that fruit before moving on.</p>
      <details open><summary>Interactive feeding order ({checked.length}/{plan.steps.length})</summary><ol className="calculator-checklist">{plan.steps.map((step,index)=><li key={index}><label><input type="checkbox" checked={checked.includes(index)} onChange={()=>setChecked(value=>value.includes(index)?value.filter(item=>item!==index):[...value,index])}/><span>{step.fruit}</span><small>modeled RGB {step.color.join(" / ")}</small></label></li>)}</ol></details>
      <div className="calculator-actions"><button type="button" className="button secondary" onClick={()=>navigator.clipboard.writeText(plan.order.map((fruit,index)=>`${index+1}. ${fruit}`).join("\n"))}>Copy feeding order</button><button type="button" className="button secondary" onClick={()=>{setSaved({...saved,current:"Desert Yellow"});setChecked([])}}>Plan from Han Lemon reset</button></div>
      <details><summary>Did you receive a different color?</summary><p>Select the color actually received as the current color, then calculate the correction to the same target.</p><select value={saved.current} onChange={event=>{setSaved({...saved,current:event.target.value});setChecked([])}}>{CHOCOBO_COLORS.map(color=><option key={color[0]}>{color[0]}</option>)}</select></details>
    </section>
    <ReportCalculatorIssue calculator="Chocobo color" context={context}/>
  </article>;
}
