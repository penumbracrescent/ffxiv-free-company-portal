"use client";

import { useState, useTransition } from "react";
import { manageGiveawayResultAction } from "../../lib/giveaways/actions";

export default function GiveawayResultControl({resultId,resultKind}:{resultId:number;resultKind:string}){
  const [action,setAction]=useState("claimed");
  const [reason,setReason]=useState("");
  const [error,setError]=useState("");
  const [pending,startTransition]=useTransition();
  const needsReason=action!=="claimed";

  function submit(formData:FormData){
    if(needsReason&&!reason.trim()){setError("Enter a reason before forfeiting this result.");return;}
    setError("");
    startTransition(async()=>{
      try{await manageGiveawayResultAction(formData);setReason("");}
      catch{setError("The result could not be updated. Refresh the page and try again.");}
    });
  }

  return <div className="giveaway-result-control">
    <form action={submit} noValidate>
      <input type="hidden" name="resultId" value={resultId}/>
      <select name="resultAction" value={action} onChange={event=>{setAction(event.target.value);setError("");}} disabled={pending}>
        <option value="claimed">Mark Claimed</option>
        <option value="forfeit">Forfeit and reopen prize</option>
        {resultKind!=="fcfs"?<option value="promote">Forfeit + Promote Alternate</option>:null}
      </select>
      {needsReason?<input name="reason" value={reason} onChange={event=>setReason(event.target.value)} placeholder="Reason required" aria-invalid={Boolean(error)} disabled={pending}/>:null}
      <button className="button secondary" type="submit" disabled={pending}>{pending?"Applying…":"Apply"}</button>
    </form>
    {error?<p className="giveaway-result-control-error" role="alert">{error}</p>:null}
  </div>;
}
