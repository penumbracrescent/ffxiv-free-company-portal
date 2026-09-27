"use client";

import { useEffect, useState } from "react";

export type Confidence = "Exact model" | "Estimate" | "Planning aid";

export function useSavedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`cotf-calculator:${key}`);
      if (saved) setValue(JSON.parse(saved));
    } catch { /* A blocked local store should not make a calculator unusable. */ }
    setLoaded(true);
  }, [key]);
  useEffect(() => {
    if (!loaded) return;
    try { window.localStorage.setItem(`cotf-calculator:${key}`, JSON.stringify(value)); } catch { /* See above. */ }
  }, [key, loaded, value]);
  return [value, setValue, loaded] as const;
}

export function CalculatorTrust({ confidence, updated, sources, children }: {
  confidence: Confidence; updated: string; sources: { label: string; url: string }[]; children?: React.ReactNode;
}) {
  return <aside className="calculator-trust">
    <span className={`calculator-confidence ${confidence === "Exact model" ? "exact" : "estimate"}`}>{confidence}</span>
    <span>Reviewed {updated}</span>
    <span>{children}</span>
    <span>Sources: {sources.map((source, index) => <span key={source.url}>{index ? " · " : ""}<a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></span>)}</span>
  </aside>;
}

export function ReportCalculatorIssue({ calculator, context }: { calculator: string; context: unknown }) {
  const [description, setDescription] = useState("");
  const [includeContext, setIncludeContext] = useState(false);
  const [status, setStatus] = useState("");
  const tracker = process.env.NEXT_PUBLIC_CALCULATOR_ISSUES_URL || "";
  async function prepare() {
    const body = [
      `## Calculator report: ${calculator}`,
      "",
      "### What happened",
      description.trim() || "Please describe the result that looked incorrect.",
      "",
      `Page: ${window.location.href}`,
      `Reported: ${new Date().toISOString()}`,
      includeContext ? `\n### Calculation context\n\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\`` : "",
      "",
      "No account token, Discord identifier, or login data is included. Calculator inputs appear only when the reporter explicitly includes them.",
    ].filter(Boolean).join("\n");
    if (tracker) {
      const join = tracker.includes("?") ? "&" : "?";
      window.open(`${tracker}${join}title=${encodeURIComponent(`[Calculator] ${calculator} result`)}&body=${encodeURIComponent(body)}`, "_blank", "noopener,noreferrer");
      setStatus("A prefilled report was opened. Nothing was sent until you submit it there.");
      return;
    }
    try { await navigator.clipboard.writeText(body); setStatus("Report copied. Send it to a portal administrator."); }
    catch { setStatus("Copy was blocked by the browser. Select and copy your description manually."); }
  }
  return <details className="calculator-report">
    <summary>Report incorrect information or a calculation problem</summary>
    <p>{tracker ? "This opens a prefilled issue. You can inspect and edit it before submitting." : "This installation has no issue tracker configured. The report will be copied for you."}</p>
    <label>What looked wrong?<textarea rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder="Include the expected result and what the calculator showed." /></label>
    <label className="calculator-inline-check"><input type="checkbox" checked={includeContext} onChange={event => setIncludeContext(event.target.checked)} /> Include these calculator inputs</label>
    <button type="button" className="button secondary" onClick={prepare}>{tracker ? "Review report on GitHub" : "Copy report"}</button>
    {status ? <small aria-live="polite">{status}</small> : null}
  </details>;
}

export const numberValue = (value: string | number) => Number(value) || 0;
export const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
