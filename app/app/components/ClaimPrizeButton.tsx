"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { claimFcfsAction } from "../../lib/giveaways/actions";

export default function ClaimPrizeButton({giveawayId,disabled=false}:{giveawayId:number;disabled?:boolean}){
  const [message,setMessage]=useState("");
  const [success,setSuccess]=useState(false);
  const [pending,startTransition]=useTransition();
  const titleId=useId();

  useEffect(()=>{
    if(!message)return;
    const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setMessage("");};
    window.addEventListener("keydown",close);
    return()=>window.removeEventListener("keydown",close);
  },[message]);

  function submit(formData:FormData){
    startTransition(async()=>{
      const result=await claimFcfsAction(formData);
      setSuccess(result.ok);
      setMessage(result.message);
    });
  }

  return <>
    <form action={submit}>
      <input type="hidden" name="giveawayId" value={giveawayId}/>
      <button className="button primary" type="submit" disabled={disabled||pending}>{pending?"Claiming...":"Claim Prize"}</button>
    </form>
    {message?<div className="giveaway-feedback-backdrop" onMouseDown={event=>{if(event.currentTarget===event.target)setMessage("");}}>
      <section className="giveaway-feedback-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
        <span className={`status-badge ${success?"success":"warning"}`}>{success?"Claim recorded":"Unable to claim"}</span>
        <h3 id={titleId}>{success?"Prize claimed":"Claim not available"}</h3>
        <p>{message}</p>
        <button className="button primary" type="button" autoFocus onClick={()=>setMessage("")}>Close</button>
      </section>
    </div>:null}
  </>;
}
