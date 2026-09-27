"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type OfficerActivityEntry = {
  id: string; source: string; category: string; outcome: "success" | "failure" | "info";
  actor: string; action: string; summary: string | null; occurred_at: string;
  reference_id: string | null; duration_ms: number | null;
};
export type OfficerCommandUsage = { command_path: string; days_30: number; days_60: number; days_90: number };
export type OfficerActivityFilters = { search: string; source: string; outcome: string; windowDays: number };
export type OfficerActivityResult = {
  entries: OfficerActivityEntry[]; total: number; page: number; pageSize: number; totalPages: number;
  filters: OfficerActivityFilters; sources: string[]; usage: OfficerCommandUsage[];
};

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Unknown time";
}

export default function OfficerActivityLog({
  entries,
  total,
  page,
  pageSize,
  totalPages,
  filters,
  sources,
  usage,
  loadActivity
}: OfficerActivityResult & {
  loadActivity: (filters: OfficerActivityFilters, requestedPage?: number) => Promise<OfficerActivityResult>;
}) {
  const [search, setSearch] = useState(filters.search);
  const [source, setSource] = useState(filters.source);
  const [outcome, setOutcome] = useState(filters.outcome);
  const [windowDays, setWindowDays] = useState(String(filters.windowDays));
  const [activity, setActivity] = useState({ entries, total, page, pageSize, totalPages, sources });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const skippedInitialLoad = useRef(false);
  const requestSequence = useRef(0);

  const updateAddress = useCallback((nextFilters: OfficerActivityFilters, nextPage: number) => {
    const url = new URL(window.location.href);
    const values: Record<string, string> = {
      activitySearch: nextFilters.search,
      activitySource: nextFilters.source,
      activityOutcome: nextFilters.outcome,
      activityWindow: String(nextFilters.windowDays),
      activityPage: String(nextPage)
    };
    for (const [key, value] of Object.entries(values)) {
      if (!value || value === "all" || (key === "activityPage" && value === "1")) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    url.hash = "officer-activity";
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  const loadPage = useCallback(async (requestedPage = 1) => {
    const nextFilters: OfficerActivityFilters = {
      search: search.trim(),
      source,
      outcome,
      windowDays: Number(windowDays) || 30
    };
    const requestId = ++requestSequence.current;
    setLoading(true);
    setLoadError("");
    try {
      const next = await loadActivity(nextFilters, requestedPage);
      if (requestId !== requestSequence.current) return;
      setActivity({
        entries: next.entries,
        total: next.total,
        page: next.page,
        pageSize: next.pageSize,
        totalPages: next.totalPages,
        sources: next.sources
      });
      updateAddress(next.filters, next.page);
    } catch {
      if (requestId === requestSequence.current) {
        setLoadError("The activity log could not update. Please try again.");
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [loadActivity, outcome, search, source, updateAddress, windowDays]);

  useEffect(() => {
    if (!skippedInitialLoad.current) {
      skippedInitialLoad.current = true;
      return;
    }
    const timer = window.setTimeout(() => void loadPage(1), 250);
    return () => window.clearTimeout(timer);
  }, [loadPage]);

  function clearFilters() {
    setSearch("");
    setSource("all");
    setOutcome("all");
    setWindowDays("30");
  }

  return <div className="officer-activity-log" id="officer-activity" aria-busy={loading}>
    <section className="officer-command-usage">
      <div><span className="eyebrow">Anonymous command usage</span><h4>Private command totals</h4><p className="muted">Aggregate counts contain no member identities and are retained for 90 days.</p></div>
      <div className="officer-command-usage-table"><div className="usage-head"><span>Command</span><span>30 days</span><span>60 days</span><span>90 days</span></div>{usage.length ? usage.map(item => <div className="usage-row" key={item.command_path}><strong>{item.command_path}</strong><span>{item.days_30}</span><span>{item.days_60}</span><span>{item.days_90}</span></div>) : <p className="muted">Usage totals will appear as members use the rebuilt command set.</p>}</div>
    </section>
    <div className="officer-activity-filters">
      <label><span>Search activity</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Member, command, action, or reference ID..." /></label>
      <label><span>Source</span><select value={source} onChange={event => setSource(event.target.value)}><option value="all">All sources</option>{activity.sources.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      <label><span>Result</span><select value={outcome} onChange={event => setOutcome(event.target.value)}><option value="all">All results</option><option value="success">Success</option><option value="failure">Failure</option><option value="info">Informational</option></select></label>
      <label><span>Time</span><select value={windowDays} onChange={event => setWindowDays(event.target.value)}><option value="1">Past 24 hours</option><option value="7">Past 7 days</option><option value="30">Past 30 days</option><option value="90">Past 90 days</option></select></label>
      <button className="button primary" type="button" disabled={loading} onClick={() => void loadPage(activity.page)}>{loading ? "Updating..." : "Refresh"}</button>
      <button className="ghost-button" type="button" disabled={loading} onClick={clearFilters}>Clear</button>
    </div>
    {loadError ? <p className="form-error" role="alert">{loadError}</p> : null}
    <p className="muted">Showing {activity.entries.length ? (activity.page - 1) * activity.pageSize + 1 : 0}-{Math.min(activity.page * activity.pageSize, activity.total)} of {activity.total} matching records. Detailed Discord command diagnostics are retained for 30 days.</p>
    <div className="officer-activity-list">
      {activity.entries.length ? activity.entries.map(entry => <article className="officer-activity-row" key={entry.id}><div className="officer-activity-result"><span className={`tag ${entry.outcome === "success" ? "success" : entry.outcome === "failure" ? "danger" : "warning"}`}>{entry.outcome}</span><time>{formatDateTime(entry.occurred_at)}</time></div><div><strong>{entry.action}</strong><p>{entry.actor}</p></div><div><span className="officer-activity-source">{entry.source} · {entry.category}</span>{entry.summary ? <p>{entry.summary}</p> : null}</div><div className="officer-activity-meta">{entry.duration_ms !== null ? <span>{entry.duration_ms} ms</span> : null}{entry.reference_id ? <code>{entry.reference_id}</code> : null}</div></article>) : <article className="panel"><span className="tag">No matches</span><h4>No activity matches these filters</h4></article>}
    </div>
    <div className="officer-activity-pagination"><button className="ghost-button" type="button" disabled={loading || activity.page <= 1} onClick={() => void loadPage(activity.page - 1)}>Previous</button><span>Page {activity.page} of {activity.totalPages}</span><button className="button primary" type="button" disabled={loading || activity.page >= activity.totalPages} onClick={() => void loadPage(activity.page + 1)}>Next</button></div>
  </div>;
}
