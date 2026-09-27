"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTestGiveawayAction } from "../../lib/giveaways/actions";

export default function DeleteTestGiveawayButton({giveawayId}:{giveawayId:number}){
  const [pending,startTransition]=useTransition();
  const [error,setError]=useState("");
  const buttonRef=useRef<HTMLButtonElement>(null);
  const router=useRouter();

  function submit(formData:FormData){
    startTransition(async()=>{
      setError("");
      try{
        await deleteTestGiveawayAction(formData);
        const card=buttonRef.current?.closest<HTMLElement>(".giveaway-card");
        if(card){card.hidden=true;card.setAttribute("aria-hidden","true");}
        router.refresh();
      }catch(cause){
        setError(cause instanceof Error?cause.message:"The test giveaway could not be deleted.");
      }
    });
  }

  return <div>
    <form action={submit}>
      <input type="hidden" name="giveawayId" value={giveawayId}/>
      <button ref={buttonRef} className="danger-button" type="submit" disabled={pending}>{pending?"Deleting...":"Delete Test Giveaway"}</button>
    </form>
    {error?<p className="giveaway-wizard-error" role="alert">{error}</p>:null}
  </div>;
}
