"use client";
import { useEffect, useState } from "react";

type RestoreState = { phase: string; message: string; helperOnline?: boolean; files?: string[]; preview?: { siteName: string; createdAt: string; expandedBytes: number; fileCount: number; confirmation: string } };

export default function RestoreBackup({ setupToken, onPendingChange }: { setupToken: string; onPendingChange: (pending: boolean) => void }) {
  const [opened, setOpened] = useState(false);
  const [state, setState] = useState<RestoreState>({ phase: "idle", message: "Choose a backup to restore." });
  const [file, setFile] = useState<File | null>(null);
  const [filename, setFilename] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [trusted, setTrusted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = busy || ["queued", "validating", "restoring"].includes(state.phase);
  useEffect(() => {
    onPendingChange(running || state.phase === "complete");
    // The restored-settings response unmounts this panel. Release its parent form lock.
    return () => onPendingChange(false);
  }, [running, state.phase, onPendingChange]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const response = await fetch("/api/setup/restore?action=status", { method: "POST", headers: { "x-setup-token": setupToken } });
        if (!response.ok) return;
        const value = await response.json() as RestoreState;
        if (!cancelled) {
          setState(value);
          if (value.files) setFiles(value.files);
          if (!["idle", "complete"].includes(value.phase)) setOpened(true);
        }
      } catch { /* Keep the last progress on a temporary connection loss. */ }
    }
    void poll();
    const timer = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [setupToken]);

  async function send(action: string, body: unknown = {}) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/setup/restore?action=${action}`, {
        method: "POST", headers: { "x-setup-token": setupToken, "content-type": action === "upload" ? "application/octet-stream" : "application/json" },
        body: action === "upload" ? file : JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Restore request failed.");
      setState({ phase: "queued", message: "Waiting for the restore helper..." });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Upload failed. For large backups, use the backups folder to avoid proxy upload limits."); }
    finally { setBusy(false); }
  }

  return <section className="setup-panel" aria-label="Restore from backup">
    <h2>Already have a portal backup?</h2>
    <p>Restore your existing community into this fresh installation, then review the prefilled setup pages.</p>
    {!opened ? <button type="button" className="button primary" onClick={() => setOpened(true)}>Restore from backup</button> : <div>
      <p className="setup-warning">Stop the old project before restoring. Use only a trusted COTF Portal backup you are authorized to import: it contains credentials and personal data. Existing destination databases cannot be overwritten. External Authentik, proxy, and Discord service configuration is not recreated.</p>
      {state.phase !== "complete" && <div className="form-grid">
        <label className="full"><span>Upload a backup (.tar.gz, up to 2 GiB)</span><input type="file" accept=".tar.gz,application/gzip" disabled={running} onChange={e => { setFile(e.target.files?.[0] || null); setTrusted(false); }} /></label>
        <button type="button" className="button primary" disabled={running || !file || file.size > 2 * 1024 ** 3} onClick={() => void send("upload")}>{busy ? "Sending request..." : "Upload and inspect backup"}</button>
        <button type="button" className="button primary" disabled={running} onClick={() => void send("list")}>Find backups in shared folder</button>
        {files.length > 0 && <><label><span>Backup in this installation's backups folder</span><select value={filename} disabled={running} onChange={e => { setFilename(e.target.value); setTrusted(false); }}><option value="">Choose an archive</option>{files.map(name => <option key={name}>{name}</option>)}</select></label><button className="button" type="button" disabled={running || !filename} onClick={() => void send("inspect", { filename })}>Inspect selected backup</button></>}
        <p className="full">For large archives or proxy upload limits, copy the archive into this new project's <code>backups</code> folder, then choose Find backups. Expanded contents are limited to 10 GiB.</p>
      </div>}
      <p role="status" aria-live="polite">{state.message}</p>
      {state.helperOnline === false && !running && <p className="setup-warning">Restore helper is not available yet. Ensure the project includes the new restore service.</p>}
      {error && <p className="setup-error" role="alert">{error}</p>}
      {state.phase === "ready" && state.preview && <div>
        <h3>{state.preview.siteName}</h3><p>Backup date: {state.preview.createdAt}<br />{state.preview.fileCount} entries; {(state.preview.expandedBytes / 1024 ** 2).toFixed(1)} MiB expanded.</p>
        <p>Imports the database, uploads, persistent files, and supported integration settings. Keeps this installation's database credentials, local port, network settings, and new session secret.</p>
        <label><input type="checkbox" checked={trusted} onChange={e => setTrusted(e.target.checked)} /> I trust this backup, have authority to restore its data and content, and have stopped the old project.</label>
        <button type="button" className="button primary" disabled={!trusted || running} onClick={() => void send("confirm", { trusted, confirmation: state.preview?.confirmation })}>Confirm restore</button>
      </div>}
      {state.phase === "complete" && <button type="button" className="button primary" onClick={() => window.location.reload()}>Continue with restored settings</button>}
      {!running && state.phase === "idle" && <button type="button" className="button primary" onClick={() => setOpened(false)}>Close</button>}
    </div>}
  </section>;
}
