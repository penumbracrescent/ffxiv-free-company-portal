import { SOURCE_PRIORITY } from "../policy.mjs";

const DISPLAY_NAMES = { crunchyroll:"Crunchyroll", hidive:"HIDIVE", oceanveil:"OceanVeil", netflix:"Netflix", hulu:"Hulu", disney:"Disney+", amazon:"Prime Video" };

function observation(sourceKey, row, observedAt) {
  const language=String(row.language||row.airType||"").toLowerCase();
  const startsAt=row.startsAt||row.releaseAt||row.episodeDate;
  if(!["sub","dub"].includes(language)||!startsAt||!Number.isFinite(new Date(startsAt).getTime())) return null;
  const episodeLabel=String(row.episodeLabel||row.episodeNumber||"Special");
  const status=["confirmed","expected","delayed","unknown","released"].includes(String(row.status||"").toLowerCase()) ? String(row.status).toLowerCase() : "confirmed";
  return { sourceKey, sourceRecordKey:String(row.id||row.key||`${row.englishTitle||row.title}:${language}:${episodeLabel}`), sourcePriority:SOURCE_PRIORITY.official,
    observedAt,sourceTimezone:row.timezone||"UTC",sourceTimestamp:String(startsAt),displayTitle:row.englishTitle||row.title||row.romajiTitle,
    englishTitle:row.englishTitle||row.title||row.romajiTitle,romajiTitle:row.romajiTitle||null,nativeTitle:row.nativeTitle||null,aliases:row.aliases||[],imageUrl:row.imageUrl||null,description:row.description||row.synopsis||null,sourceUrl:row.sourceUrl||row.url||null,sourceRoute:row.sourceRoute||null,
    seriesStatus:row.seriesStatus||"unknown",episodeNumber:Number(row.episodeNumber)||null,episodeLabel,batchKey:row.releaseKind==="batch"?episodeLabel:null,
    releaseKind:row.releaseKind==="batch"?"batch":"episode",language,status,delayedUntil:status==="delayed"&&row.delayedUntil?new Date(row.delayedUntil).toISOString():null,delayNote:status==="delayed"?(row.delayNote||null):null,startsAt:new Date(startsAt).toISOString(),durationMinutes:Number(row.durationMinutes)||null,
    confirmed:row.confirmed!==false,platforms:[{platformKey:sourceKey,displayName:DISPLAY_NAMES[sourceKey]||sourceKey,sourceUrl:row.url||null,availableAt:new Date(startsAt).toISOString()}],raw:row };
}

export function createOfficialFeedSource(sourceKey, url) {
  return { key:sourceKey,enabled:Boolean(url),disabledReason:url?null:`No official ${sourceKey} feed URL configured.`,async fetchObservations(){
    const observedAt=new Date().toISOString(); const response=await fetch(url,{headers:{accept:"application/json"},signal:AbortSignal.timeout(30000)});
    if(!response.ok) throw new Error(`${sourceKey} feed returned HTTP ${response.status}.`); const payload=await response.json();
    const rows=Array.isArray(payload)?payload:payload.releases; if(!Array.isArray(rows)) throw new Error(`${sourceKey} feed did not return a release array.`);
    return {observations:rows.map((row)=>observation(sourceKey,row,observedAt)).filter(Boolean),metadata:{checkedAt:observedAt,count:rows.length}};
  }};
}