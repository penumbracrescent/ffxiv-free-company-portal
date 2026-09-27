"use client";

import { useEffect, useState } from "react";

type Action = (formData: FormData) => Promise<void>;

type CatalogItem = {
  id: number;
  name: string;
  category: string | null;
  level: number | null;
  itemLevel: number | null;
};

type Props = {
  createProjectAction: Action;
  leadOptions: Array<{ id: number; name: string }>;
};

function itemLabel(item: CatalogItem) {
  const levels = `Lv. ${item.level ?? "-"} · iLvl ${item.itemLevel ?? "-"}`;
  return `${item.name} · ${levels}${item.category ? ` · ${item.category}` : ""}`;
}

export default function CraftingCatalogRequestCreator({ createProjectAction, leadOptions }: Props) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setItems([]);
      setLoading(false);
      setSearched(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/crafting/catalog?q=${encodeURIComponent(normalized)}`, {
          signal: controller.signal
        });
        if (!response.ok) throw new Error("Catalog search failed");
        const payload = await response.json() as { items?: CatalogItem[] };
        setItems(Array.isArray(payload.items) ? payload.items : []);
        setSearched(true);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setItems([]);
          setSearched(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  return (
    <details className="crafting-create-panel crafting-catalog-create-panel">
      <summary><span><strong>Start a real-item request</strong><small>Type to search the imported FFXIV catalog. Only craftable items are shown.</small></span><span className="tracker-collapsible-toggle">Open</span></summary>
      <label className="crafting-live-search"><span>Catalog search</span><input value={query} onChange={(event) => setQuery(event.target.value)} minLength={2} maxLength={80} placeholder="Example: Darksteel Ingot or bow" autoComplete="off" /></label>
      <p className="crafting-catalog-hint">Matches update as you type and are ordered from lowest level to highest. Dungeon, raid, chest, and other non-craftable drops are excluded.</p>
      {loading ? <p className="crafting-empty">Searching the craftable catalog...</p> : null}
      {searched && !loading && !items.length ? <p className="crafting-empty">No craftable FFXIV items matched “{query.trim()}”. Try a shorter or different name.</p> : null}
      {items.length ? <form className="crafting-form" action={createProjectAction}>
        <label className="full"><span>Matching craftable item</span><select name="itemId" required defaultValue=""><option value="" disabled>Choose an item</option>{items.map((item) => <option key={item.id} value={item.id}>{itemLabel(item)}</option>)}</select></label>
        <label><span>Required quantity</span><input name="quantity" type="number" min="1" max="999999" required /></label>
        <label><span>Project title (optional)</span><input name="title" maxLength={120} placeholder="Defaults to the item and quantity" /></label>
        <label><span>Project lead</span><select name="leadCharacterId" defaultValue=""><option value="">No lead assigned</option>{leadOptions.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select></label>
        <label><span>Due date (optional)</span><input name="dueAt" type="date" /></label>
        <label><span>Discord post (optional)</span><select name="discordTargetChannelKind" defaultValue="none"><option value="none">Do not post yet</option><option value="crafting">Crafting Channel</option><option value="test">Test Channel</option></select></label>
        <label className="full"><span>Planning notes</span><textarea name="notes" maxLength={2000} placeholder="Visible to the FC on this project." /></label>
        <div className="form-actions"><button className="button primary" type="submit">Create Catalog Request</button></div>
      </form> : null}
    </details>
  );
}