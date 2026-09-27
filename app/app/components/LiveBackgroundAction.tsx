"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export type BackgroundActionStatus = { signature: string; complete: boolean; failed?: boolean; message?: string };

type Props = {
  action: (formData: FormData) => Promise<void>;
  statusAction: (kind: string) => Promise<BackgroundActionStatus>;
  statusKind: string;
  idleLabel: string;
  pendingLabel?: string;
  queuedLabel?: string;
  className?: string;
  formClassName?: string;
  disabled?: boolean;
  children?: ReactNode;
  watchForMs?: number;
};

export default function LiveBackgroundAction({ action, statusAction, statusKind, idleLabel, pendingLabel="Submitting...", queuedLabel="Request queued", className="button primary", formClassName, disabled=false, children, watchForMs=60000 }: Props) {
  const router=useRouter();
  const [phase,setPhase]=useState<"idle"|"pending"|"queued"|"complete"|"error">("idle");
  const [message,setMessage]=useState("");
  const signature=useRef("");

  useEffect(()=>{
    if(phase!=="queued")return;
    let cancelled=false;
    const startedAt=Date.now();
    let timer=0;
    const poll=async()=>{
      try {
        const status=await statusAction(statusKind);
        if(cancelled)return;
        if(status.signature&&status.signature!==signature.current){signature.current=status.signature;router.refresh();}
        if(status.complete){setMessage(status.message|| (status.failed?"The background request failed.":"Background update completed."));setPhase(status.failed?"error":"complete");return;}
      } catch {
        // A temporary status read should not turn a successfully queued request into an error.
      }
      if(Date.now()-startedAt>=watchForMs){setMessage("The request is still running. Reopen this tool to check it later.");setPhase("idle");return;}
      timer=window.setTimeout(poll,3000);
    };
    timer=window.setTimeout(poll,1000);
    return()=>{cancelled=true;window.clearTimeout(timer);};
  },[phase,router,statusAction,statusKind,watchForMs]);

  useEffect(()=>{if(phase!=="complete")return;const timer=window.setTimeout(()=>setPhase("idle"),5000);return()=>window.clearTimeout(timer);},[phase]);

  async function submit(formData:FormData){setPhase("pending");setMessage("");signature.current="";try{await action(formData);setPhase("queued");}catch(reason){setMessage(reason instanceof Error?reason.message:"The request could not be queued.");setPhase("error");}}
  const label=phase==="pending"?pendingLabel:phase==="queued"?`✓ ${queuedLabel}`:phase==="complete"?"✓ Completed":phase==="error"?"Try again":idleLabel;

  return <form action={submit} className={formClassName} data-live-background-action>
    {children}
    <button className={`${className} live-background-button ${phase}`} type="submit" disabled={disabled||phase==="pending"||phase==="queued"||phase==="complete"}>{phase==="pending"?<span className="live-action-spinner" aria-hidden="true"/>:null}<span>{label}</span></button>
    <span className={`live-action-status ${phase==="error"?"error":""}`} role="status" aria-live="polite">{phase==="queued"?"Watching this tool for its background result...":message}</span>
  </form>;
}
