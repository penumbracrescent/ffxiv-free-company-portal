"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Platform = { key: string; name: string; url?: string | null };
type Release = {
  id: string;
  release_key: string;
  episode_label: string | null;
  release_kind: string;
  language: "sub" | "dub";
  status: "confirmed" | "expected" | "delayed" | "unknown" | "released";
  starts_at: string;
  duration_minutes: number | null;
  delayed_until: string | null;
  delay_note: string | null;
  series_key: string;
  english_title: string;
  romaji_title: string | null;
  image_url: string | null;
  description: string | null;
  source_url: string | null;
  platforms: Platform[];
  variants?: Release[];
};
type DetailSelection = { title: string; releases: Release[] };
type AnimeReleaseCalendarProps = {
  subCalendarId?: string;
  dubCalendarId?: string;
  defaultLanguage?: "all" | "sub" | "dub";
  defaultPlatforms?: string[];
  defaultDisplay?: "calendar" | "upcoming";
  timeZoneMode?: "central" | "local";
  timeFormat?: "12" | "24";
};

const STORAGE_KEY = "cotf-anime-calendar-filters-v1";
const TIMEZONE = "America/Chicago";
const serviceNames = ["Crunchyroll", "HIDIVE", "OceanVeil", "Netflix", "Hulu", "Disney+", "Prime Video"];

function dayKey(value: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function dateLabel(value: string) { return new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "long", month: "long", day: "numeric" }).format(new Date(value)); }
function timeLabel(value: string) { return new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value)); }
function variants(release: Release) { return (release.variants || [release]).slice().sort((a,b) => (a.language === "sub" ? 0 : 1)-(b.language === "sub" ? 0 : 1) || new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime()); }
function releaseLabel(release: Release) { const items=variants(release); const sameEpisode=items.every((item) => item.release_kind===items[0].release_kind && item.episode_label===items[0].episode_label); return sameEpisode ? `${items[0].release_kind === "batch" ? "Episodes" : "Episode"} ${items[0].episode_label || "TBA"} · ${items.map((item) => item.language.toUpperCase()).join("/")}` : items.map((item) => `${item.language.toUpperCase()} ${item.release_kind === "batch" ? "Episodes" : "Episode"} ${item.episode_label || "TBA"}`).join(" · "); }
function releaseTimeLabel(release: Release) { const items=variants(release); const sameTime=items.every((item) => new Date(item.starts_at).getTime()===new Date(items[0].starts_at).getTime()); return sameTime ? timeLabel(items[0].starts_at) : items.map((item) => `${item.language.toUpperCase()} ${timeLabel(item.starts_at)}`).join(" · "); }
function languageLabel(release: Release) { return [...new Set(variants(release).map((item) => item.language.toUpperCase()))].join("+"); }
function statusLabel(release: Release) { const statuses=[...new Set(variants(release).map((item) => item.status))]; return statuses.length === 1 ? statuses[0] : "mixed"; }
function delayLabel(release: Release) {
  const delayed=variants(release).filter((item) => item.status === "delayed");
  if (!delayed.length) return "";
  const details=new Map<string,string[]>();
  delayed.forEach((item) => {
    const until=item.delayed_until ? `until ${new Intl.DateTimeFormat("en-US", { timeZone:"UTC", month:"long", day:"numeric", year:"numeric" }).format(new Date(item.delayed_until))}` : "with return date unknown";
    const detail=item.delay_note ? `${until} — ${item.delay_note}` : until;
    details.set(detail,[...(details.get(detail)||[]),item.language.toUpperCase()]);
  });
  return [...details.entries()].map(([detail,languages]) => `${languages.join("/")} delayed ${detail}`).join(" · ");
}
function platformKey(name: string) { return name.toLowerCase().replace(/[^a-z0-9]+/g, "").replace("primevideo", "amazon"); }
function firstOfCurrentMonth() { const today=dayKey(new Date().toISOString()).split("-").map(Number); return new Date(Date.UTC(today[0],today[1]-1,1)); }

export default function AnimeReleaseCalendar({
  subCalendarId = "",
  dubCalendarId = "",
  defaultLanguage = "all",
  defaultPlatforms = [],
  defaultDisplay = "upcoming",
  timeZoneMode = "central",
  timeFormat = "12"
}: AnimeReleaseCalendarProps) {
  const preferredTimeZone = timeZoneMode === "local" ? undefined : TIMEZONE;
  const preferredHour12 = timeFormat !== "24";
  const userDayKey = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: preferredTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  const userDateLabel = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: preferredTimeZone, weekday: "long", month: "long", day: "numeric" }).format(new Date(value));
  const userTimeLabel = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: preferredTimeZone, hour: "numeric", minute: "2-digit", hour12: preferredHour12, timeZoneName: "short" }).format(new Date(value));
  const userReleaseTimeLabel = (release: Release) => {
    const items = variants(release);
    const sameTime = items.every((item) => new Date(item.starts_at).getTime() === new Date(items[0].starts_at).getTime());
    return sameTime ? userTimeLabel(items[0].starts_at) : items.map((item) => item.language.toUpperCase() + " " + userTimeLabel(item.starts_at)).join(" · ");
  };
  const userDelayLabel = (release: Release) => {
    const delayed = variants(release).filter((item) => item.status === "delayed");
    if (!delayed.length) return "";
    const details = new Map<string, string[]>();
    delayed.forEach((item) => {
      const until = item.delayed_until ? "until " + new Intl.DateTimeFormat("en-US", { timeZone: preferredTimeZone, month: "long", day: "numeric", year: "numeric" }).format(new Date(item.delayed_until)) : "with return date unknown";
      const detail = item.delay_note ? until + " — " + item.delay_note : until;
      details.set(detail, [...(details.get(detail) || []), item.language.toUpperCase()]);
    });
    return [...details.entries()].map(([detail, languages]) => languages.join("/") + " delayed " + detail).join(" · ");
  };
  const userFirstOfCurrentMonth = () => {
    const today = userDayKey(new Date().toISOString()).split("-").map(Number);
    return new Date(Date.UTC(today[0], today[1] - 1, 1));
  };
  const [language, setLanguage] = useState<"all" | "sub" | "dub">(defaultLanguage);
  const [platforms, setPlatforms] = useState<string[]>(defaultPlatforms);
  const [display, setDisplay] = useState<"calendar" | "upcoming">(defaultDisplay);
  const [monthCursor, setMonthCursor] = useState(userFirstOfCurrentMonth);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<DetailSelection | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try { const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}"); if(["all","sub","dub"].includes(saved.language)) setLanguage(saved.language); if(Array.isArray(saved.platforms)) setPlatforms(saved.platforms); if(["calendar","upcoming"].includes(saved.display)) setDisplay(saved.display); } catch { /* Ignore an invalid saved preference. */ }
  }, []);
  useEffect(() => { localStorage.setItem(STORAGE_KEY,JSON.stringify({language,platforms,display})); }, [language,platforms,display]);
  useEffect(() => {
    const controller=new AbortController();
    let from=new Date(); let to=new Date(Date.now()+90*86400000);
    if(display==="calendar") { const start=new Date(monthCursor); start.setUTCDate(1-start.getUTCDay()); from=start; to=new Date(start); to.setUTCDate(start.getUTCDate()+42); }
    const params=new URLSearchParams({from:from.toISOString(),to:to.toISOString(),language});
    platforms.forEach((platform) => params.append("platform",platform));
    setLoading(true); setError(""); setDetail(null);
    fetch(`/api/anime/releases?${params}`,{signal:controller.signal})
      .then(async(response)=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to load releases.");return data;})
      .then((data)=>setReleases(Array.isArray(data.releases)?data.releases:[]))
      .catch((reason)=>{if(reason.name!=="AbortError")setError(reason.message);})
      .finally(()=>setLoading(false));
    return()=>controller.abort();
  },[language,platforms,display,monthCursor]);
  useEffect(() => {
    if(!detail)return;
    const previous=document.body.style.overflow; document.body.style.overflow="hidden"; closeButtonRef.current?.focus();
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setDetail(null);}; window.addEventListener("keydown",onKey);
    return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",onKey);};
  },[detail]);

  const displayReleases=useMemo(()=>{
    if(language!=="all")return releases;
    const merged=new Map<string,Release>();
    releases.forEach((release)=>{const key=`${release.series_key}:${userDayKey(release.starts_at)}`;const existing=merged.get(key);if(!existing){merged.set(key,{...release,variants:[release]});return;}const combinedPlatforms=new Map([...(existing.platforms||[]),...(release.platforms||[])].map((platform)=>[platform.key,platform]));existing.variants=[...(existing.variants||[existing]),release];existing.platforms=[...combinedPlatforms.values()];if(release.status==="delayed")existing.status="delayed";});
    return [...merged.values()].sort((a,b)=>new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime());
  },[releases,language]);
  const groups=useMemo(()=>{const map=new Map<string,Release[]>();displayReleases.forEach((release)=>{const key=userDayKey(release.starts_at);map.set(key,[...(map.get(key)||[]),release]);});return[...map.entries()].sort(([a],[b])=>a.localeCompare(b));},[displayReleases]);
  const calendar=useMemo(()=>{const today=userDayKey(new Date().toISOString());const first=new Date(monthCursor);const start=new Date(first);start.setUTCDate(first.getUTCDate()-first.getUTCDay());const byDay=new Map(groups);return{title:new Intl.DateTimeFormat("en-US",{month:"long",year:"numeric",timeZone:"UTC"}).format(first),today,days:Array.from({length:42},(_,offset)=>{const date=new Date(start);date.setUTCDate(start.getUTCDate()+offset);const key=date.toISOString().slice(0,10);return{key,number:date.getUTCDate(),inMonth:date.getUTCMonth()===first.getUTCMonth(),items:byDay.get(key)||[]};})};},[groups,monthCursor]);

  function changeMonth(amount:number){setMonthCursor((current)=>new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth()+amount,1)));}
  function openRelease(release:Release){setDetail({title:release.english_title,releases:[release]});}
  function openDay(items:Release[]){if(items.length)setDetail({title:userDateLabel(items[0].starts_at),releases:items});}

  return <section id="anime-calendar" className="anime-calendar-panel">
    <div className="section-title-row"><div><p className="eyebrow">Release Guide</p><h2>Anime Release Calendar</h2><p>{timeZoneMode === "local" ? "Subbed and dubbed releases shown in your browser’s local time." : "Subbed and dubbed releases shown in Central time."} Confirmed times replace estimates as sources publish updates.</p></div></div>
    {subCalendarId || dubCalendarId ? <div className="anime-subscribe-links" aria-label="Google Calendar subscriptions"><span>Add releases to Google Calendar:</span>{subCalendarId ? <a href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(subCalendarId)}`} target="_blank" rel="noreferrer">Subscribe to SUB</a> : null}{dubCalendarId ? <a href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(dubCalendarId)}`} target="_blank" rel="noreferrer">Subscribe to DUB</a> : null}</div> : null}
    <div className="anime-view-toggle" aria-label="Release view"><button type="button" className={display==="upcoming"?"active":""} onClick={()=>setDisplay("upcoming")}>Upcoming</button><button type="button" className={display==="calendar"?"active":""} onClick={()=>setDisplay("calendar")}>Calendar</button></div>
    <div className="anime-filter-panel">
      <fieldset><legend>Language</legend><div className="anime-filter-buttons">{(["all","sub","dub"] as const).map((value)=><button type="button" key={value} className={language===value?"active":""} onClick={()=>setLanguage(value)}>{value==="all"?"Sub + Dub":value.toUpperCase()}</button>)}</div></fieldset>
      <fieldset><legend>Platforms</legend><div className="anime-filter-buttons">{serviceNames.map((name)=>{const key=platformKey(name);return<button type="button" key={name} className={platforms.includes(key)?"active":""} onClick={()=>setPlatforms((current)=>current.includes(key)?current.filter((item)=>item!==key):[...current,key])}>{name}</button>;})}<button type="button" onClick={()=>setPlatforms([])}>Clear</button></div></fieldset>
    </div>
    {loading?<p className="empty-state">Loading release calendar…</p>:error?<p className="empty-state">{error}</p>:display==="calendar"?<div className="anime-month"><div className="anime-month-heading"><button type="button" onClick={()=>changeMonth(-1)} aria-label="Previous month">‹</button><h3>{calendar.title}</h3><div><button type="button" onClick={()=>setMonthCursor(userFirstOfCurrentMonth())}>Today</button><button type="button" onClick={()=>changeMonth(1)} aria-label="Next month">›</button></div></div><div className="anime-weekdays">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day)=><span key={day}>{day}</span>)}</div><div className="anime-month-grid">{calendar.days.map((day)=><article key={day.key} className={`${day.inMonth?"":"outside"} ${day.key===calendar.today?"today":""}`}><button type="button" className="anime-day-number" onClick={()=>openDay(day.items)} disabled={!day.items.length} aria-label={day.items.length?`Open ${day.items.length} releases for this day`:undefined}>{day.number}</button>{day.items.slice(0,4).map((release)=><button type="button" className="anime-calendar-event" key={release.release_key} onClick={()=>openRelease(release)} title={`${release.english_title} — ${userReleaseTimeLabel(release)}${userDelayLabel(release)?` — ${userDelayLabel(release)}`:""}`}><b>{userTimeLabel(release.starts_at).replace(/\s+(CST|CDT)$/," ")}</b> {release.english_title} <em>{languageLabel(release)}</em></button>)}{day.items.length>4?<button type="button" className="anime-more-button" onClick={()=>openDay(day.items)}>+{day.items.length-4} more</button>:null}</article>)}</div></div>:groups.length===0?<p className="empty-state">No matching releases are currently scheduled.</p>:<div className="anime-day-grid">{groups.map(([date,items])=><article className="anime-day" key={date}><h3><button type="button" onClick={()=>openDay(items)}>{userDateLabel(items[0].starts_at)}</button></h3><div>{items.map((release)=><button type="button" className="anime-release" key={release.release_key} onClick={()=>openRelease(release)}>{release.image_url?<img src={release.image_url} alt="" loading="lazy"/>:null}<span><span className="anime-release-heading"><strong>{release.english_title}</strong><span className={`anime-status ${statusLabel(release)}`}>{statusLabel(release)}</span></span><span>{releaseLabel(release)}</span><span>{userReleaseTimeLabel(release)}{release.platforms.length?` · ${release.platforms.map((platform)=>platform.name).join(", ")}`:""}</span>{userDelayLabel(release)?<span className="anime-delay-detail">{userDelayLabel(release)}</span>:null}</span></button>)}</div></article>)}</div>}
    {detail?<div className="anime-detail-backdrop" role="presentation" onClick={(event)=>{if(event.target===event.currentTarget)setDetail(null);}}><section className="anime-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="anime-detail-title"><div className="anime-detail-header"><h3 id="anime-detail-title">{detail.title}</h3><button ref={closeButtonRef} type="button" onClick={()=>setDetail(null)} aria-label="Close release details">Close</button></div><div className="anime-detail-list">{detail.releases.map((release)=><article key={release.release_key} className="anime-detail-card">{release.image_url?<img src={release.image_url} alt=""/>:null}<div><div className="anime-release-heading"><h4>{release.english_title}</h4><span className={`anime-status ${statusLabel(release)}`}>{statusLabel(release)}</span></div>{release.romaji_title&&release.romaji_title!==release.english_title?<p>{release.romaji_title}</p>:null}<p className="anime-detail-description">{release.description || "A show description has not been published yet."}</p>{release.source_url?<p><a className="anime-detail-source" href={release.source_url} target="_blank" rel="noreferrer">More details on AnimeSchedule.net</a></p>:null}<p><strong>{releaseLabel(release)}</strong></p><p>{userDateLabel(release.starts_at)} · {userReleaseTimeLabel(release)}</p>{userDelayLabel(release)?<p className="anime-delay-detail">{userDelayLabel(release)}</p>:null}{release.platforms.length?<div className="anime-detail-platforms">{release.platforms.map((platform)=>platform.url?<a key={platform.key} href={platform.url} target="_blank" rel="noreferrer">{platform.name}</a>:<span key={platform.key}>{platform.name}</span>)}</div>:<p>Streaming platform not yet published.</p>}</div></article>)}</div><button type="button" className="anime-detail-mobile-close" onClick={()=>setDetail(null)}>Close</button></section></div>:null}
  </section>;
}