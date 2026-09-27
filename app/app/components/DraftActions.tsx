"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteGiveawayDraftAction } from "../../lib/giveaways/actions";
import type { GiveawayRecord } from "../../lib/giveaways/types";

export default function DraftActions({draft}:{draft:GiveawayRecord}){
  const [pending,startTransition]=useTransition();
  const [error,setError]=useState("");
  const deleteRef=useRef<HTMLButtonElement>(null);
  const router=useRouter();

  function resume(){window.dispatchEvent(new CustomEvent("cotf:resume-giveaway-draft",{detail:draft}));}
  function remove(formData:FormData){
    if(!window.confirm(`Delete the draft "${draft.title}"? This cannot be undone.`))return;
    startTransition(async()=>{
      setError("");
      try{
        await deleteGiveawayDraftAction(formData);
        const card=deleteRef.current?.closest<HTMLElement>(".giveaway-card");
        if(card){card.hidden=true;card.setAttribute("aria-hidden","true");}
        router.refresh();
      }catch(cause){setError(cause instanceof Error?cause.message:"The draft could not be deleted.");}
    });
  }

  return <div className="giveaway-draft-actions">
    <button className="button primary" type="button" onClick={resume}>Resume Draft</button>
    <form action={remove}>
      <input type="hidden" name="giveawayId" value={draft.id}/>
      <button ref={deleteRef} className="danger-button" type="submit" disabled={pending}>{pending?"Deleting...":"Delete Draft"}</button>
    </form>
    {error?<p className="giveaway-wizard-error" role="alert">{error}</p>:null}
  </div>;
}
