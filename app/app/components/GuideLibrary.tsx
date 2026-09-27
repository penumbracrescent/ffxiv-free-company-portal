"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BUILT_IN_GUIDES, GUIDE_LIBRARY_PATCH, GUIDE_LIBRARY_VERIFIED_ON, type BuiltInGuide } from "../../lib/guide-library";

export type CustomGuideResource = {
  id: number;
  category: string;
  title: string;
  body: string;
  url: string | null;
  visibility_mode: "public" | "members";
};

function guideHref(slug:string,returnHref?:string){return`/?view=guides&guide=${encodeURIComponent(slug)}${returnHref?`&returnTo=${encodeURIComponent(returnHref)}`:""}#guides`;}

type GatheringLiveMeta = {
  kind: "fish" | "node" | "ocean";
  startHour?: number;
  endHour?: number;
  windows?: { startHour: number; endHour: number }[];
  weather?: string[];
  previousWeather?: string[];
  weatherRates?: [string, number][];
  oceanPhases?: string[];
};

const decodeGatheringLive = (value: string): GatheringLiveMeta | null => {
  if (!value.startsWith("LIVE:")) return null;
  try { return JSON.parse(decodeURIComponent(value.slice(5))) as GatheringLiveMeta; } catch { return null; }
};
const eorzeaHour = (at: number) => ((at / 1000) / 175) % 24;
const inEtWindow = (hour: number, start = 0, end = 24) => start === 0 && end === 24
  ? true
  : start < end ? hour >= start && hour < end : hour >= start || hour < end;
const weatherAt = (at: number, rates: [string, number][] = []) => {
  if (!rates.length) return "";
  const unix = Math.floor(at / 1000);
  const bell = Math.floor(unix / 175);
  const increment = (bell + 8 - (bell % 8)) % 24;
  const totalDays = Math.floor(unix / 4200);
  const base = totalDays * 100 + increment;
  const step1 = ((base << 11) ^ base) >>> 0;
  const rate = (((step1 >>> 8) ^ step1) >>> 0) % 100;
  return rates.find(([, threshold]) => rate < threshold)?.[0] || rates.at(-1)?.[0] || "";
};
const gatheringMatches = (meta: GatheringLiveMeta, at: number) => {
  if (meta.kind === "ocean") return false;
  const hour = eorzeaHour(at);
  const timeMatches = meta.kind === "node"
    ? !meta.windows?.length || meta.windows.some((window) => inEtWindow(hour, window.startHour, window.endHour))
    : inEtWindow(hour, meta.startHour, meta.endHour);
  if (!timeMatches) return false;
  const current = weatherAt(at, meta.weatherRates);
  const previous = weatherAt(at - 1_400_000, meta.weatherRates);
  return (!meta.weather?.length || meta.weather.includes(current))
    && (!meta.previousWeather?.length || meta.previousWeather.includes(previous));
};
const gatheringLiveStatus = (meta: GatheringLiveMeta | null, now: number) => {
  if (!meta || !now) return { available: false, label: "Calculating…", nextAt: Number.POSITIVE_INFINITY };
  if (meta.kind === "ocean") return { available: false, label: `Voyage schedule${meta.oceanPhases?.length ? ` · ${meta.oceanPhases.join(" / ")}` : ""}`, nextAt: Number.POSITIVE_INFINITY };
  if (gatheringMatches(meta, now)) return { available: true, label: "Available now", nextAt: now };
  const hourMs = 175_000;
  for (let step = 1; step <= 4_800; step += 1) {
    const candidate = now + step * hourMs;
    if (!gatheringMatches(meta, candidate)) continue;
    const deltaMinutes = Math.max(1, Math.round((candidate - now) / 60_000));
    const relative = deltaMinutes < 60 ? `${deltaMinutes}m` : `${Math.floor(deltaMinutes / 60)}h ${deltaMinutes % 60}m`;
    return { available: false, label: `Next in about ${relative} · ${new Date(candidate).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`, nextAt: candidate };
  }
  return { available: false, label: "No matching window found in the next 200 ET days", nextAt: Number.POSITIVE_INFINITY };
};
const formatEorzeaClock = (now: number) => {
  if (!now) return "Loading ET…";
  const totalMinutes = Math.floor((now / 1000) * 60 / 175);
  const hour = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ET`;
};

function InlineText({ text, returnHref }: { text: string; returnHref?: string }) {
  const pieces = text.split(/(\*\*[^*]+\*\*|\[\[[^\]]+\]\])/g);
  return <>{pieces.map((piece, index) => {
    if (piece.startsWith("**") && piece.endsWith("**")) return <strong key={index}>{piece.slice(2, -2)}</strong>;
    if (piece.startsWith("[[") && piece.endsWith("]]")) {
      const [slug, label] = piece.slice(2, -2).split("|", 2);
      return <a key={index} className="guide-inline-link" href={guideHref(slug,returnHref)}>{label || slug} →</a>;
    }
    return piece;
  })}</>;
}

function GuideBody({ content, storageKey, returnHref }: { content: string; storageKey: string; returnHref?: string }) {
  const [checked, setChecked] = useState<string[]>([]);
  const [directoryChecked, setDirectoryChecked] = useState<string[]>([]);
  const [directorySearch, setDirectorySearch] = useState("");
  const [directorySource, setDirectorySource] = useState("All");
  const [directoryLevel, setDirectoryLevel] = useState("All");
  const [directoryMissingOnly, setDirectoryMissingOnly] = useState(false);
  const [directoryAvailableOnly, setDirectoryAvailableOnly] = useState(false);
  const [nowTick, setNowTick] = useState(0);
  const [directoryProfile, setDirectoryProfile] = useState("default");
  const [directoryProfileDraft, setDirectoryProfileDraft] = useState("default");
  const [directoryNotice, setDirectoryNotice] = useState("");
  const directoryImportRef = useRef<HTMLInputElement>(null);
  const tracksDirectory = /(?:spellbook|bestiary|familiar-actions|(?:fisher|miner|botanist)-discovery-directory)-\d/.test(storageKey);
  const directoryStorageKey = `guide-directory-progress:${directoryProfile}:${storageKey}`;
  useEffect(() => {
    const saved = localStorage.getItem("guide-directory-profile") || "default";
    setDirectoryProfile(saved);
    setDirectoryProfileDraft(saved);
  }, []);
  useEffect(() => {
    setNowTick(Date.now());
    const timer = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    try { setChecked(JSON.parse(localStorage.getItem(`guide-progress:${storageKey}`) || "[]")); } catch { setChecked([]); }
    try {
      const saved = localStorage.getItem(directoryStorageKey);
      const legacy = directoryProfile === "default" ? localStorage.getItem(`guide-directory-progress:${storageKey}`) : null;
      setDirectoryChecked(JSON.parse(saved || legacy || "[]"));
    } catch { setDirectoryChecked([]); }
    setDirectorySearch("");
    setDirectorySource("All");
    setDirectoryLevel("All");
    setDirectoryMissingOnly(false);
    setDirectoryAvailableOnly(false);
    setDirectoryNotice("");
  }, [storageKey, directoryProfile, directoryStorageKey]);
  const toggle = (key: string) => setChecked((current) => {
    const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
    localStorage.setItem(`guide-progress:${storageKey}`, JSON.stringify(next));
    return next;
  });
  const setDirectoryProgress = (next: string[]) => {
    localStorage.setItem(directoryStorageKey, JSON.stringify(next));
    setDirectoryChecked(next);
  };
  const toggleDirectoryEntry = (key: string) => setDirectoryProgress(
    directoryChecked.includes(key) ? directoryChecked.filter((item) => item !== key) : [...directoryChecked, key],
  );
  const activateDirectoryProfile = () => {
    const next = directoryProfileDraft.trim().replace(/[^a-z0-9 _-]/gi, "").slice(0, 40) || "default";
    localStorage.setItem("guide-directory-profile", next);
    setDirectoryProfileDraft(next);
    setDirectoryProfile(next);
  };
  const exportDirectoryProgress = () => {
    const prefix = `guide-directory-progress:${directoryProfile}:`;
    const progress: Record<string, string[]> = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      try { progress[key.slice(prefix.length)] = JSON.parse(localStorage.getItem(key) || "[]"); } catch { progress[key.slice(prefix.length)] = []; }
    }
    const blob = new Blob([JSON.stringify({ version: 1, profile: directoryProfile, progress }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `guide-directory-progress-${directoryProfile.replace(/\s+/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setDirectoryNotice("Progress exported.");
  };
  const importDirectoryProgress = async (file?: File) => {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text()) as { profile?: string; progress?: Record<string, string[]> };
      if (!payload.progress || typeof payload.progress !== "object") throw new Error("Invalid progress file");
      const importedProfile = String(payload.profile || directoryProfile).replace(/[^a-z0-9 _-]/gi, "").slice(0, 40) || "default";
      for (const [key, value] of Object.entries(payload.progress)) {
        if (Array.isArray(value)) localStorage.setItem(`guide-directory-progress:${importedProfile}:${key}`, JSON.stringify(value.filter((entry) => typeof entry === "string")));
      }
      localStorage.setItem("guide-directory-profile", importedProfile);
      setDirectoryProfileDraft(importedProfile);
      setDirectoryProfile(importedProfile);
      setDirectoryNotice(`Imported progress for ${importedProfile}.`);
    } catch { setDirectoryNotice("That file is not a valid guide-progress export."); }
  };
  const resetDirectoryProgress = () => {
    if (!window.confirm(`Clear all saved guide progress for ${directoryProfile}?`)) return;
    const prefix = `guide-directory-progress:${directoryProfile}:`;
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter((key): key is string => Boolean(key?.startsWith(prefix)));
    keys.forEach((key) => localStorage.removeItem(key));
    setDirectoryChecked([]);
    setDirectoryNotice("Profile progress cleared.");
  };
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let list: string[] = [];
  let table: string[][] = [];
  const flushList = () => {
    if (!list.length) return;
    nodes.push(<ul key={`list-${nodes.length}`}>{list.map((item, index) => <li key={index}><InlineText text={item} returnHref={returnHref} /></li>)}</ul>);
    list = [];
  };
  const flushTable = () => {
    if (!table.length) return;
    const [header, ...body] = table;
    if (tracksDirectory && header[0] === "No.") {
      const isSpellbook = storageKey.includes("spellbook");
      const isBestiary = storageKey.includes("bestiary");
      const isGatheringDirectory = /(?:fisher|miner|botanist)-discovery-directory/.test(storageKey);
      const hasLevel = isSpellbook || isBestiary || isGatheringDirectory;
      const categoryFor = (row: string[]) => {
        if (isSpellbook) return row[3] || "Other";
        if (isBestiary) {
          if ((row[3] || "").includes("X:")) return "Open world";
          if (row[3] && row[3] !== "—") return "Duty";
          return "Quest or gourd";
        }
        return row[2] || "Other";
      };
      const categories = [...new Set(body.flatMap((row) => isSpellbook ? categoryFor(row).split("/").map((value) => value.trim()).filter(Boolean) : [categoryFor(row)]))].sort();
      const levels = hasLevel ? [...new Set(body.map((row) => Number(row[4])).filter(Number.isFinite))].sort((a, b) => a - b) : [];
      const query = directorySearch.trim().toLowerCase();
      const filtered = body.filter((row) => {
        const key = `${storageKey}:${row[0]}`;
        if (query && !row.join(" ").toLowerCase().includes(query)) return false;
        if (directorySource !== "All" && (isSpellbook ? !categoryFor(row).split("/").map((value) => value.trim()).includes(directorySource) : categoryFor(row) !== directorySource)) return false;
        if (directoryLevel !== "All" && Number(row[4]) > Number(directoryLevel)) return false;
        if (directoryMissingOnly && directoryChecked.includes(key)) return false;
        if (directoryAvailableOnly) {
          const live = row.map(decodeGatheringLive).find(Boolean) || null;
          if (!gatheringLiveStatus(live, nowTick).available) return false;
        }
        return true;
      });
      const allKeys = body.map((row) => `${storageKey}:${row[0]}`);
      const visibleKeys = filtered.map((row) => `${storageKey}:${row[0]}`);
      const completed = allKeys.filter((key) => directoryChecked.includes(key)).length;
      const routeRows = filtered.filter((row) => !directoryChecked.includes(`${storageKey}:${row[0]}`)).sort((a, b) => {
        const aLive = gatheringLiveStatus(a.map(decodeGatheringLive).find(Boolean) || null, nowTick);
        const bLive = gatheringLiveStatus(b.map(decodeGatheringLive).find(Boolean) || null, nowTick);
        return Number(bLive.available) - Number(aLive.available) || aLive.nextAt - bLive.nextAt || (a[5] || "").localeCompare(b[5] || "");
      });
      const copyRoute = async () => {
        const route = routeRows.map((row, index) => `${index + 1}. ${row[1]} — ${isSpellbook ? row[5] : isBestiary ? row[3] : row.slice(2).join(" / ")}`).join("\n");
        if (!route) return;
        await navigator.clipboard.writeText(route);
        setDirectoryNotice(`Copied a ${routeRows.length}-entry route.`);
      };
      const renderDirectoryValue = (value: string) => {
        const live = decodeGatheringLive(value);
        if (live) {
          const status = gatheringLiveStatus(live, nowTick);
          const currentWeather = weatherAt(nowTick, live.weatherRates);
          const previousWeather = weatherAt(nowTick - 1_400_000, live.weatherRates);
          return <div className={`guide-live-status ${status.available ? "available" : "waiting"}`}><strong>{status.label}</strong>{currentWeather ? <small>Now: {currentWeather}{previousWeather ? ` · previous: ${previousWeather}` : ""}</small> : null}</div>;
        }
        if (value.startsWith("Zone map: ") || value.startsWith("Item details: ")) {
          return <div className="guide-external-links">{value.split(" · ").map((part) => { const [label, ...urlParts] = part.split(": "); const url = urlParts.join(": "); return <a key={url} href={url} target="_blank" rel="noreferrer">{label} ↗</a>; })}</div>;
        }
        const coordinates = value.match(/X:\s*\d+(?:\.\d+)?\s*,?\s*Y:\s*\d+(?:\.\d+)?/i)?.[0];
        return <><InlineText text={value} returnHref={returnHref} />{coordinates ? <button type="button" className="guide-coordinate-copy" onClick={() => { navigator.clipboard.writeText(coordinates); setDirectoryNotice(`Copied ${coordinates}.`); }}>Copy coordinates</button> : null}</>;
      };
      nodes.push(
        <section className="guide-directory" key={`directory-${nodes.length}`}>
          <div className="guide-directory-summary"><strong>{completed} / {body.length} complete</strong><span className="guide-et-clock">{formatEorzeaClock(nowTick)}</span><span>{filtered.length} shown</span></div>
          <div className="guide-directory-profile">
            <label><span>Progress profile</span><input value={directoryProfileDraft} onChange={(event) => setDirectoryProfileDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") activateDirectoryProfile(); }} /></label>
            <button type="button" onClick={activateDirectoryProfile}>Use profile</button>
            <button type="button" className="secondary" onClick={exportDirectoryProgress}>Export</button>
            <button type="button" className="secondary" onClick={() => directoryImportRef.current?.click()}>Import</button>
            <button type="button" className="secondary danger" onClick={resetDirectoryProgress}>Reset profile</button>
            <input ref={directoryImportRef} className="guide-directory-file" type="file" accept="application/json,.json" onChange={(event) => { void importDirectoryProgress(event.target.files?.[0]); event.target.value = ""; }} />
          </div>
          <div className="guide-directory-tools">
            <label><span>Search entries</span><input value={directorySearch} onChange={(event) => setDirectorySearch(event.target.value)} placeholder={isSpellbook ? "Spell, enemy, dungeon, zone…" : isBestiary ? "Familiar, enemy, duty, coordinate…" : isGatheringDirectory ? "Item, zone, bait, weather, time…" : "Familiar, kin, action, Borrow…"} /></label>
            <label><span>{isSpellbook ? "Source type" : isBestiary ? "Location type" : isGatheringDirectory ? "Route tier" : "Kin"}</span><select value={directorySource} onChange={(event) => setDirectorySource(event.target.value)}><option>All</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
            {hasLevel ? <label><span>Maximum level</span><select value={directoryLevel} onChange={(event) => setDirectoryLevel(event.target.value)}><option>All</option>{levels.map((level) => <option key={level} value={level}>{level}</option>)}</select></label> : null}
            <label className="guide-directory-toggle"><input type="checkbox" checked={directoryMissingOnly} onChange={(event) => setDirectoryMissingOnly(event.target.checked)} /><span>Missing only</span></label>
            {isGatheringDirectory ? <label className="guide-directory-toggle"><input type="checkbox" checked={directoryAvailableOnly} onChange={(event) => setDirectoryAvailableOnly(event.target.checked)} /><span>Available now</span></label> : null}
          </div>
          <div className="guide-directory-actions"><button type="button" onClick={() => setDirectoryProgress([...new Set([...directoryChecked, ...visibleKeys])])} disabled={!visibleKeys.length}>Mark shown complete</button><button type="button" className="secondary" onClick={() => setDirectoryProgress(directoryChecked.filter((key) => !visibleKeys.includes(key)))} disabled={!visibleKeys.length}>Clear shown</button><button type="button" className="secondary" onClick={() => void copyRoute()} disabled={!routeRows.length}>Copy missing route (optimized)</button></div>
          {directoryNotice ? <p className="guide-directory-notice" role="status">{directoryNotice}</p> : null}
          <div className="guide-table-wrap"><table className="guide-table guide-directory-table"><thead><tr><th>Complete</th>{header.map((cell, index) => <th key={index}><InlineText text={cell} returnHref={returnHref} /></th>)}</tr></thead><tbody>{filtered.map((row) => { const key = `${storageKey}:${row[0]}`; const complete = directoryChecked.includes(key); return <tr key={key} className={complete ? "complete" : ""}><td><input aria-label={`Mark ${row[1] || `entry ${row[0]}`} complete`} type="checkbox" checked={complete} onChange={() => toggleDirectoryEntry(key)} /></td>{row.map((value, cellIndex) => <td key={cellIndex}>{renderDirectoryValue(value)}</td>)}</tr>; })}</tbody></table>{!filtered.length ? <p className="guide-directory-empty">No entries match these filters.</p> : null}</div>
        </section>,
      );
    } else {
      nodes.push(<div className="guide-table-wrap" key={`table-${nodes.length}`}><table className="guide-table"><thead><tr>{header.map((cell, index) => <th key={index}><InlineText text={cell} returnHref={returnHref} /></th>)}</tr></thead><tbody>{body.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}><InlineText text={cell} returnHref={returnHref} /></td>)}</tr>)}</tbody></table></div>);
    }
    table = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      flushList();
      const cells = line.slice(1, -1).split("|").map((cell) => cell.trim());
      if (!cells.every((cell) => /^:?-{3,}:?$/.test(cell))) table.push(cells);
      continue;
    }
    flushTable();
    if (line.startsWith("- [ ] ")) {
      flushList();
      const label = line.slice(6);
      const key = `${nodes.length}:${label}`;
      nodes.push(<label key={key} className={`guide-check ${checked.includes(key) ? "complete" : ""}`}><input type="checkbox" checked={checked.includes(key)} onChange={() => toggle(key)} /><span><InlineText text={label} returnHref={returnHref} /></span></label>);
      continue;
    }
    if (line.startsWith("- ")) { list.push(line.slice(2)); continue; }
    flushList();
    if (!line) continue;
    if (line.startsWith("## ")) nodes.push(<h3 key={`heading-${nodes.length}`}>{line.slice(3)}</h3>);
    else if (line.startsWith("### ")) nodes.push(<h4 key={`subheading-${nodes.length}`}>{line.slice(4)}</h4>);
    else if (line.startsWith("> ")) nodes.push(<aside key={`tip-${nodes.length}`} className="guide-callout"><InlineText text={line.slice(2)} returnHref={returnHref} /></aside>);
    else if (/^\d+\. /.test(line)) nodes.push(<p key={`step-${nodes.length}`} className="guide-step"><InlineText text={line} returnHref={returnHref} /></p>);
    else nodes.push(<p key={`p-${nodes.length}`}><InlineText text={line} returnHref={returnHref} /></p>);
  }
  flushList();
  flushTable();
  return <div className="guide-article-body">{nodes}</div>;
}

function GuideCard({ guide, returnHref }: { guide: BuiltInGuide; returnHref?: string }) {
  return (
    <a className="guide-library-card" href={guideHref(guide.slug,returnHref)}>
      {guide.imageUrl ? <img src={guide.imageUrl} alt="" /> : null}
      <div className="guide-library-card-copy">
        <span className="tag">{guide.category}</span>
        <h3>{guide.title}</h3>
        <p>{guide.summary}</p>
        <div className="guide-card-meta">
          {guide.expansion ? <span>{guide.expansion}</span> : null}
          {guide.level ? <span>Level {guide.level}</span> : null}
          {guide.type === "collection" ? <span>Browse collection →</span> : <span>Read guide →</span>}
        </div>
      </div>
    </a>
  );
}

export default function GuideLibrary({ selectedSlug, customResources, returnHref }: { selectedSlug?: string; customResources: CustomGuideResource[]; returnHref?: string }) {
  const [search, setSearch] = useState("");
  const [audience, setAudience] = useState("All");
  const bySlug = useMemo(() => new Map(BUILT_IN_GUIDES.map((guide) => [guide.slug, guide])), []);
  const selected = selectedSlug ? bySlug.get(selectedSlug) : undefined;
  const query = search.trim().toLowerCase();

  const visible = useMemo(() => {
    if (query) {
      return BUILT_IN_GUIDES.filter((guide) => {
        const haystack = [guide.title, guide.summary, guide.category, guide.expansion, guide.level, guide.audience, guide.content, ...guide.tags].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(query) && (audience === "All" || guide.audience === audience || guide.audience === "Crafting & Gathering");
      });
    }
    const parent = selected?.type === "collection" ? selected.slug : selected?.parentSlug;
    return BUILT_IN_GUIDES.filter((guide) => guide.parentSlug === (parent ?? null));
  }, [audience, query, selected]);

  const breadcrumbs = useMemo(() => {
    const result: BuiltInGuide[] = [];
    let cursor = selected;
    while (cursor) { result.unshift(cursor); cursor = cursor.parentSlug ? bySlug.get(cursor.parentSlug) : undefined; }
    return result;
  }, [bySlug, selected]);

  return (
    <div className="guide-library">
      <div className="guide-library-tools panel">
        <label className="guide-search"><span>Search all guides</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try relic, level 80, Phaenna, scrips…" /></label>
        <label><span>Audience</span><select value={audience} onChange={(event) => setAudience(event.target.value)}><option>All</option><option>Combat</option><option>Crafting</option><option>Gathering</option><option>Crafting &amp; Gathering</option></select></label>
      </div>

      {breadcrumbs.length ? (
        <nav className="guide-breadcrumbs" aria-label="Guide breadcrumbs">
          {returnHref?<a className="guide-return-link" href={returnHref}>← Back to collection results</a>:null}
          <a href="/?view=guides#guides">Guides</a>
          {breadcrumbs.map((item) => <span key={item.slug}>/ <a href={guideHref(item.slug,returnHref)}>{item.title}</a></span>)}
        </nav>
      ) : null}

      {!query && selected?.type === "article" ? (
        <article className="guide-article panel">
          {selected.imageUrl ? <img className="guide-article-hero" src={selected.imageUrl} alt="" /> : null}
          <div className="guide-article-heading">
            <span className="tag">{selected.category}</span>
            <h2>{selected.title}</h2>
            <p>{selected.summary}</p>
            <div className="guide-card-meta">{selected.expansion ? <span>{selected.expansion}</span> : null}{selected.level ? <span>Level {selected.level}</span> : null}{selected.audience ? <span>{selected.audience}</span> : null}</div>
            <p className="guide-verification">Verified for patch {selected.verifiedPatch||GUIDE_LIBRARY_PATCH} · reviewed {selected.verifiedOn||GUIDE_LIBRARY_VERIFIED_ON}</p>
          </div>
          <GuideBody content={selected.content || ""} storageKey={selected.slug} returnHref={returnHref} />
          {selected.references?.length ? <footer className="guide-references"><h3>References & patch verification</h3><p>These sources support fact-checking and future patch maintenance; the walkthrough above is designed to work without leaving the portal.</p><ul>{selected.references.map((reference) => <li key={reference.url}><a href={reference.url} target="_blank" rel="noreferrer">{reference.label} ↗</a></li>)}</ul></footer> : null}
        </article>
      ) : (
        <>
          {selected?.type === "collection" && !query ? (
            <>
              <header className="guide-collection-heading">
                <span className="tag">{selected.category}</span>
                <h2>{selected.title}</h2>
                <p>{selected.summary}</p>
                <p className="guide-verification">Verified for patch {selected.verifiedPatch||GUIDE_LIBRARY_PATCH} · reviewed {selected.verifiedOn||GUIDE_LIBRARY_VERIFIED_ON}</p>
              </header>
              {selected.content ? (
                <section className="guide-article panel guide-collection-guide">
                  <GuideBody content={selected.content} storageKey={selected.slug} returnHref={returnHref} />
                  {selected.references?.length ? (
                    <footer className="guide-references">
                      <h3>References & patch verification</h3>
                      <p>These sources support fact-checking and future patch maintenance; the guide above is designed to work without leaving the portal.</p>
                      <ul>{selected.references.map((reference) => <li key={reference.url}><a href={reference.url} target="_blank" rel="noreferrer">{reference.label} ↗</a></li>)}</ul>
                    </footer>
                  ) : null}
                </section>
              ) : null}
            </>
          ) : null}
          {query ? <p className="guide-results-count">{visible.length} guide{visible.length === 1 ? "" : "s"} match “{search.trim()}”.</p> : null}
          <div className="guide-library-grid">{visible.map((guide) => <GuideCard key={guide.slug} guide={guide} returnHref={returnHref} />)}</div>
          {!visible.length ? <div className="panel guide-empty"><h3>No matching guide</h3><p>Try a broader topic, expansion, level, or audience.</p></div> : null}
        </>
      )}

      {!selected && !query && customResources.length ? (
        <section className="guide-community-section"><h2>Free Company Resources</h2><p>Links and notes added by this portal's officers.</p><div className="guide-library-grid">{customResources.map((guide) => <article key={guide.id} className="panel guide-resource-card"><div><span className="tag">{guide.category}</span>{guide.visibility_mode === "members" ? <span className="tag warning">Members only</span> : null}</div><h3>{guide.title}</h3><p>{guide.body}</p>{guide.url ? <a href={guide.url} target="_blank" rel="noreferrer">Open resource ↗</a> : null}</article>)}</div></section>
      ) : null}
    </div>
  );
}
