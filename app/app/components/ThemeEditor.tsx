"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

export type ThemeEditorRole = {
  key: string;
  label: string;
  description: string;
  variable: string;
  color: string;
  secondary?: {
    key: string;
    label: string;
    variable: string;
    color: string;
  };
};

type ThemeEditorProps = {
  roles: ThemeEditorRole[];
  saveAction: (formData: FormData) => Promise<void>;
  navigationItems: Array<{ key: string; label: string }>;
  navigationOrder: string[];
  saveNavigationAction: (formData: FormData) => Promise<void>;
};

const roleSelectors: Array<[string, string]> = [
  ["accentColor", ".button.primary, .top-action-button.login, button[type='submit']:not(.secondary):not(.danger):not(.danger-button), input[type='checkbox'], input[type='radio'], progress"],
  ["labelColor", ".tag:not(.success):not(.warning):not(.danger), .group-chip, .eyebrow, .mount-row.header"],
  ["headingColor", "h1, h2, h3, h4, h5, h6"],
  ["mutedTextColor", "small, .muted, .muted-text, .subtitle"],
  ["textColor", "p, li, td, th, label, strong, span"],
  ["insetColor", "input:not([type='color']), select, textarea, .button.secondary, .top-action-button:not(.login), .user-pill, .poll-choice-list label, .collection-source, .giveaway-prize, .mount-table, .mount-row:not(.header), .discord-link-row, .discord-audit-row, .event-roster-party, .event-roster-queue, .event-roster-completed"],
  ["sidebarColor", ".sidebar, .side-nav, .officer-link"],
  ["tileColor", ".panel, .settings-form, .quick-card, .stat-card, .poll-card, .giveaway-card, .giveaway-rules, .giveaway-officer-create, .giveaway-submission-card, .anime-day, .anime-calendar-panel, .collection-card, .collection-filter-panel, .member-profile-front, .member-profile-back, .member-event-card, .join-date-manager-card, .tracker-collapsible-summary, .tracker-collapsible, .officer-activity-row, .officer-command-usage, .discord-roster-control-card, .discord-action-queue-card, .discord-scheduled-post-card, .discord-automation-card, .mount-management-card, .mount-set-card, .most-needed-card, .party-target-card, .mount-win-card, .crafting-create-panel, .crafting-project-card, .guide-library-card, article"],
  ["backgroundColor", ".content-shell, .guild-app"]
];

const editorStorageKey = "cotf.portal-theme-editor";
const validColor = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

function findEditableTarget(start: Element | null) {
  if (!start) return null;
  const explicit = start.closest<HTMLElement>("[data-theme-role]");
  if (explicit?.dataset.themeRole) return { key: explicit.dataset.themeRole, element: explicit };
  for (const [key, selector] of roleSelectors) {
    const element = start.closest<HTMLElement>(selector);
    if (element) return { key, element };
  }
  return null;
}

export default function ThemeEditor({ roles, saveAction, navigationItems, navigationOrder, saveNavigationAction }: ThemeEditorProps) {
  const entries = useMemo(() => roles.flatMap((role) => [
    { key: role.key, variable: role.variable, color: role.color },
    ...(role.secondary ? [role.secondary] : [])
  ]), [roles]);
  const initial = useMemo(() => Object.fromEntries(entries.map((entry) => [entry.key, entry.color])), [entries]);
  const [colors, setColors] = useState<Record<string, string>>(initial);
  const [savedColors, setSavedColors] = useState<Record<string, string>>(initial);
  const [active, setActive] = useState(false);
  const [editorSection, setEditorSection] = useState<"colors" | "navigation">("colors");
  const [selectedKey, setSelectedKey] = useState(roles[0]?.key || "accentColor");
  const [navOrder, setNavOrder] = useState(navigationOrder);
  const [savedNavOrder, setSavedNavOrder] = useState(navigationOrder);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [exitPrompt, setExitPrompt] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();

  const selected = roles.find((role) => role.key === selectedKey) || roles[0];
  const dirtyKeys = entries.filter((entry) => colors[entry.key] !== savedColors[entry.key]).map((entry) => entry.key);
  const selectedKeys = selected ? [selected.key, ...(selected.secondary ? [selected.secondary.key] : [])] : [];
  const selectedIsDirty = selectedKeys.some((key) => dirtyKeys.includes(key));
  const navigationIsDirty = navOrder.some((key, index) => key !== savedNavOrder[index]);
  const totalDirty = dirtyKeys.length + (navigationIsDirty ? 1 : 0);

  useEffect(() => {
    const keys = new Set(entries.map((entry) => entry.key));
    try {
      const stored = JSON.parse(localStorage.getItem(editorStorageKey) || "null") as { active?: boolean; editorSection?: "colors" | "navigation"; selectedKey?: string; colors?: Record<string, unknown>; savedColors?: Record<string, unknown>; navOrder?: unknown; savedNavOrder?: unknown } | null;
      if (stored?.active) {
        const restoredColors = Object.fromEntries(Object.entries(stored.colors || {}).filter(([key, value]) => keys.has(key) && validColor(value))) as Record<string, string>;
        const restoredSaved = Object.fromEntries(Object.entries(stored.savedColors || {}).filter(([key, value]) => keys.has(key) && validColor(value))) as Record<string, string>;
        setColors({ ...initial, ...restoredColors });
        setSavedColors({ ...initial, ...restoredSaved });
        if (stored.selectedKey && keys.has(stored.selectedKey)) setSelectedKey(stored.selectedKey);
        if (stored.editorSection === "navigation") setEditorSection("navigation");
        const validNavKeys = new Set(navigationItems.map((item) => item.key));
        const restoreOrder = (value: unknown, fallback: string[]) => Array.isArray(value) && value.length === validNavKeys.size && value.every((key) => typeof key === "string" && validNavKeys.has(key)) && new Set(value).size === validNavKeys.size ? value as string[] : fallback;
        setNavOrder(restoreOrder(stored.navOrder, navigationOrder));
        setSavedNavOrder(restoreOrder(stored.savedNavOrder, navigationOrder));
        setActive(true);
      }
    } catch {
      localStorage.removeItem(editorStorageKey);
    } finally {
      setHydrated(true);
    }
  }, [entries, initial, navigationItems, navigationOrder, roles]);

  useEffect(() => {
    if (!hydrated || !active) return;
    localStorage.setItem(editorStorageKey, JSON.stringify({ active: true, editorSection, selectedKey, colors, savedColors, navOrder, savedNavOrder }));
  }, [active, colors, editorSection, hydrated, navOrder, savedColors, savedNavOrder, selectedKey]);

  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".side-nav");
    if (!nav) return;
    const children = new Map(Array.from(nav.children).map((child) => [(child as HTMLElement).dataset.navKey, child]));
    for (const key of navOrder) {
      const child = children.get(key);
      if (child) nav.appendChild(child);
    }
  }, [navOrder]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".guild-app");
    if (!root) return;
    for (const entry of entries) root.style.setProperty(entry.variable, colors[entry.key] || entry.color);
  }, [colors, entries]);

  useEffect(() => {
    document.documentElement.classList.toggle("theme-editor-active", active && editorSection === "colors");
    if (!active) document.querySelectorAll("[data-theme-editor-target]").forEach((node) => node.removeAttribute("data-theme-editor-target"));
    return () => document.documentElement.classList.remove("theme-editor-active");
  }, [active, editorSection]);

  const finishExit = (discard: boolean) => {
    if (discard) {
      setColors(savedColors);
      setNavOrder(savedNavOrder);
    }
    localStorage.removeItem(editorStorageKey);
    setExitPrompt(false);
    setActive(false);
    setMessage("");
  };

  const requestExit = () => {
    if (totalDirty) setExitPrompt(true);
    else finishExit(false);
  };

  useEffect(() => {
    if (!active || editorSection !== "colors") return;
    let highlighted: HTMLElement | null = null;
    const point = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest(".theme-editor")) return;
      const match = findEditableTarget(event.target as Element | null);
      if (highlighted !== match?.element) {
        highlighted?.removeAttribute("data-theme-editor-target");
        highlighted = match?.element || null;
        highlighted?.setAttribute("data-theme-editor-target", match?.key || "");
      }
    };
    const choose = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest(".theme-editor")) return;
      if ((event.target as Element | null)?.closest("a[href]")) {
        localStorage.setItem(editorStorageKey, JSON.stringify({ active: true, editorSection, selectedKey, colors, savedColors, navOrder, savedNavOrder }));
        return;
      }
      const match = findEditableTarget(event.target as Element | null);
      if (!match) return;
      event.preventDefault();
      event.stopPropagation();
      setSelectedKey(match.key);
      setMessage("");
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") requestExit(); };
    document.addEventListener("pointermove", point, true);
    document.addEventListener("click", choose, true);
    document.addEventListener("keydown", escape);
    return () => {
      highlighted?.removeAttribute("data-theme-editor-target");
      document.removeEventListener("pointermove", point, true);
      document.removeEventListener("click", choose, true);
      document.removeEventListener("keydown", escape);
    };
  }, [active, colors, editorSection, navOrder, savedColors, savedNavOrder, selectedKey]);

  if (!selected) return null;

  const save = (keys: string[], exitAfter = false) => startTransition(async () => {
    const formData = new FormData();
    formData.set("colors", JSON.stringify(Object.fromEntries(keys.map((key) => [key, colors[key]]))));
    try {
      await saveAction(formData);
      const nextSaved = { ...savedColors, ...Object.fromEntries(keys.map((key) => [key, colors[key]])) };
      setSavedColors(nextSaved);
      if (exitAfter) {
        localStorage.removeItem(editorStorageKey);
        setExitPrompt(false);
        setActive(false);
        setMessage("");
      } else {
        setMessage(`${selected.label} saved.`);
      }
    } catch {
      setExitPrompt(false);
      setMessage("Those colors could not be saved. Your previews are still here; please try again.");
    }
  });

  const moveNavigation = (key: string, direction: -1 | 1) => {
    setNavOrder((current) => {
      const index = current.indexOf(key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setMessage("Previewing the new menu order—save to keep it.");
  };

  const placeNavigation = (targetKey: string) => {
    if (!draggedKey || draggedKey === targetKey) return;
    setNavOrder((current) => {
      const next = current.filter((key) => key !== draggedKey);
      next.splice(next.indexOf(targetKey), 0, draggedKey);
      return next;
    });
    setDraggedKey(null);
    setMessage("Previewing the new menu order—save to keep it.");
  };

  const saveNavigation = (exitAfter = false) => startTransition(async () => {
    const formData = new FormData();
    formData.set("navigationOrder", JSON.stringify(navOrder));
    try {
      await saveNavigationAction(formData);
      setSavedNavOrder(navOrder);
      if (exitAfter) {
        localStorage.removeItem(editorStorageKey);
        setExitPrompt(false);
        setActive(false);
        setMessage("");
      } else {
        setMessage("Menu order saved for everyone.");
      }
    } catch {
      setExitPrompt(false);
      setMessage("The menu order could not be saved. Your preview is still here; please try again.");
    }
  });

  const saveEverythingAndExit = () => {
    if (dirtyKeys.length && navigationIsDirty) {
      startTransition(async () => {
        const colorData = new FormData();
        colorData.set("colors", JSON.stringify(Object.fromEntries(dirtyKeys.map((key) => [key, colors[key]]))));
        const navData = new FormData();
        navData.set("navigationOrder", JSON.stringify(navOrder));
        try {
          await saveAction(colorData);
          await saveNavigationAction(navData);
          setSavedColors(colors);
          setSavedNavOrder(navOrder);
          localStorage.removeItem(editorStorageKey);
          setExitPrompt(false);
          setActive(false);
          setMessage("");
        } catch {
          setExitPrompt(false);
          setMessage("Some editor changes could not be saved. Your previews are still here; please try again.");
        }
      });
    } else if (navigationIsDirty) saveNavigation(true);
    else save(dirtyKeys, true);
  };

  return (
    <div className={`theme-editor ${active ? "is-active" : ""}`}>
      <button className="top-action-button theme-editor-toggle" type="button" onClick={() => active ? requestExit() : setActive(true)}>
        {active ? "Exit Editor Mode" : "Editor Mode"}
      </button>
      {active ? (
        <section className="theme-editor-panel" role="dialog" aria-label="Portal editor">
          <header><div><strong>Editor Mode</strong><small>{editorSection === "colors" ? "Click an element to edit it. Links still navigate normally." : "Drag pages or use the arrow buttons. The Officer Area remains pinned."}</small></div><button type="button" aria-label="Exit Editor Mode" onClick={requestExit}>×</button></header>
          <div className="theme-editor-tabs" role="tablist" aria-label="Editor sections"><button type="button" role="tab" aria-selected={editorSection === "colors"} className={editorSection === "colors" ? "active" : ""} onClick={() => { setEditorSection("colors"); setMessage(""); }}>Colors</button><button type="button" role="tab" aria-selected={editorSection === "navigation"} className={editorSection === "navigation" ? "active" : ""} onClick={() => { setEditorSection("navigation"); setMessage(""); }}>Menu order</button></div>
          {editorSection === "colors" ? <>
            <label><span>Editing</span><select value={selected.key} onChange={(event) => { setSelectedKey(event.target.value); setMessage(""); }}>{roles.map((role) => <option key={role.key} value={role.key}>{role.label}</option>)}</select></label>
            <p>{selected.description}</p>
            <label><span>{selected.secondary ? "Top color" : "Color"}</span><span className="theme-editor-color"><input type="color" value={colors[selected.key]} onChange={(event) => { setColors((current) => ({ ...current, [selected.key]: event.target.value })); setMessage("Previewing—save to keep it."); }} /><code>{colors[selected.key]}</code></span></label>
            {selected.secondary ? <label><span>{selected.secondary.label}</span><span className="theme-editor-color"><input type="color" value={colors[selected.secondary.key]} onChange={(event) => { setColors((current) => ({ ...current, [selected.secondary!.key]: event.target.value })); setMessage("Previewing the page fade—save to keep it."); }} /><code>{colors[selected.secondary.key]}</code></span></label> : null}
            <footer><button className="button secondary" type="button" disabled={!selectedIsDirty} onClick={() => setColors((current) => ({ ...current, ...Object.fromEntries(selectedKeys.map((key) => [key, savedColors[key]])) }))}>Undo preview</button><button className="button primary" type="button" disabled={pending || !selectedIsDirty} onClick={() => save(selectedKeys)}>{pending ? "Saving…" : selected.secondary ? "Save background" : "Save color"}</button></footer>
          </> : <>
            <p>Expandable menus move as one item. Member-only pages retain their positions when they are hidden from a viewer.</p>
            <div className="theme-editor-nav-presets"><button className="button secondary" type="button" onClick={() => { setNavOrder([...navigationItems].sort((a, b) => a.label.localeCompare(b.label)).map((item) => item.key)); setMessage("Previewing alphabetical order—save to keep it."); }}>Alphabetize</button><button className="button secondary" type="button" onClick={() => { setNavOrder(navigationItems.map((item) => item.key)); setMessage("Previewing the default order—save to keep it."); }}>Restore default</button></div>
            <ol className="theme-editor-nav-list">{navOrder.map((key, index) => { const item = navigationItems.find((candidate) => candidate.key === key); if (!item) return null; return <li key={key} draggable onDragStart={() => setDraggedKey(key)} onDragEnd={() => setDraggedKey(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => placeNavigation(key)} className={draggedKey === key ? "dragging" : ""}><span className="theme-editor-drag" aria-hidden="true">⋮⋮</span><strong>{item.label}</strong><span className="theme-editor-nav-buttons"><button type="button" aria-label={`Move ${item.label} up`} disabled={index === 0} onClick={() => moveNavigation(key, -1)}>↑</button><button type="button" aria-label={`Move ${item.label} down`} disabled={index === navOrder.length - 1} onClick={() => moveNavigation(key, 1)}>↓</button></span></li>; })}</ol>
            <footer><button className="button secondary" type="button" disabled={!navigationIsDirty} onClick={() => { setNavOrder(savedNavOrder); setMessage(""); }}>Undo preview</button><button className="button primary" type="button" disabled={pending || !navigationIsDirty} onClick={() => saveNavigation()}>{pending ? "Saving…" : "Save menu order"}</button></footer>
          </>}
          {message ? <output>{message}</output> : null}
        </section>
      ) : null}
      {exitPrompt ? (
        <div className="theme-editor-exit-backdrop">
          <section className="theme-editor-exit-dialog" role="alertdialog" aria-modal="true" aria-labelledby="theme-editor-exit-title" aria-describedby="theme-editor-exit-description">
            <h3 id="theme-editor-exit-title">Save changes before exiting?</h3>
            <p id="theme-editor-exit-description">You have {totalDirty} unsaved editor {totalDirty === 1 ? "change" : "changes"}.</p>
            <div>
              <button className="button primary" type="button" disabled={pending} autoFocus onClick={saveEverythingAndExit}>Yes — Save &amp; Exit</button>
              <button className="button secondary" type="button" disabled={pending} onClick={() => setExitPrompt(false)}>No — Keep Editing</button>
              <button className="button danger" type="button" disabled={pending} onClick={() => finishExit(true)}>Discard &amp; Exit</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
