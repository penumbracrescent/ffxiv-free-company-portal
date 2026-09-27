"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteGiveawayAction } from "../../lib/giveaways/actions";

export default function DeleteGiveawayButton({giveawayId,title}:{giveawayId:number;title:string}){
  const [pending,startTransition]=useTransition();
  const [error,setError]=useState("");
  const buttonRef=useRef<HTMLButtonElement>(null);
  const router=useRouter();

  function submit(formData:FormData){
    if(!window.confirm(`Permanently delete "${title}" and all of its entries, winners, results, and related Discord posts? This cannot be undone.`))return;
    startTransition(async()=>{
      setError("");
      try{
        await deleteGiveawayAction(formData);
        const card=buttonRef.current?.closest<HTMLElement>(".giveaway-card");
        if(card){card.hidden=true;card.setAttribute("aria-hidden","true");}
        router.refresh();
      }catch(cause){setError(cause instanceof Error?cause.message:"The giveaway could not be deleted.");}
    });
  }

  return <div>
    <form action={submit}>
      <input type="hidden" name="giveawayId" value={giveawayId}/>
      <button ref={buttonRef} className="danger-button" type="submit" disabled={pending}>{pending?"Deleting...":"Delete Giveaway & Results"}</button>
    </form>
    {error?<p className="giveaway-wizard-error" role="alert">{error}</p>:null}
  </div>;
}
