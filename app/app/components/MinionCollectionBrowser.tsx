"use client";

import { useMemo, useState } from "react";
import MinionAcquisitionCard from "./MinionAcquisitionCard";

type Category = {
  category_key: string;
  category_name: string;
  minion_count: number;
  owned_count: number;
};

type Listing = { world_name: string; data_center_name: string | null; min_price: number };
type Source = { type: string; text: string; relatedType: string | null; relatedId: number | null; questName: string | null; questGiver: string | null; location: string | null; coordinates: string | null };
type Minion = {
  id: number;
  minion_name: string;
  description: string | null;
  source_name: string | null;
  patch: string | null;
  icon_url: string | null;
  image_url: string | null;
  ffxiv_collect_minion_id: string | null;
  marketboard_item_name: string | null;
  marketboard_listings: Listing[];
  marketboard_faerie: Listing | null;
  category_key: string;
  category_name: string;
  acquisition_data: Source[];
  owned_by_viewer: boolean;
  fc_owned_count: number;
  tracked_characters: number;
  total_matches: number;
};

type Props = {
  minions: Minion[];
  categories: Category[];
  allCategoryCount: number;
  activeCategory: string;
  activeCategoryName: string;
  initialSearch: string;
  hideOwned: boolean;
};

export default function MinionCollectionBrowser({ minions, categories, allCategoryCount, activeCategory, activeCategoryName, initialSearch, hideOwned }: Props) {
  const [search, setSearch] = useState(initialSearch);
  const normalizedSearch = search.trim().toLowerCase();

  const matchingMinions = useMemo(() => {
    if (!normalizedSearch) return minions;
    return minions.filter((minion) => {
      const sourceValues = minion.acquisition_data.flatMap((source) => [source.type, source.text, source.questName, source.questGiver, source.location, source.coordinates]);
      return [minion.minion_name, minion.description, minion.source_name, minion.patch, minion.marketboard_item_name, minion.category_name, ...sourceValues]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });
  }, [minions, normalizedSearch]);

  const shownMinions = matchingMinions.slice(0, 120);
  const ownershipSuffix = hideOwned ? "&minionOwnership=missing" : "";
  const searchSuffix = search.trim() ? `&minionSearch=${encodeURIComponent(search.trim())}` : "";
  const categoryHref = (category = "") => `/?view=minions&minionTab=collection${category ? `&minionCategory=${category}` : ""}${searchSuffix}${ownershipSuffix}#minion-acquisition-list`;

  return <>
    <div className="minion-method-grid" aria-label="Minion acquisition methods">
      <a className={`minion-method-card ${activeCategory === "" ? "selected" : ""}`} href={categoryHref()}>
        <span className="tag">All Methods</span><strong>{allCategoryCount}</strong><span>{hideOwned ? "minions you do not own" : "cataloged minions"}</span>
      </a>
      {categories.map((category) => <a key={category.category_key} className={`minion-method-card ${activeCategory === category.category_key ? "selected" : ""}`} href={categoryHref(category.category_key)}>
        <span className="tag">{category.category_name}</span><strong>{category.minion_count}</strong><span>{hideOwned ? "minions you do not own" : `${category.owned_count} FC ownership records`}</span>
      </a>)}
    </div>

    <section id="minion-acquisition-list" className="minion-acquisition-list-section">
      <form className="mount-filter-panel minion-acquisition-search" onSubmit={(event) => event.preventDefault()}>
        <label><span>Search minions or sources</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Minion, quest, vendor, duty, location..." autoComplete="off" /></label>
        <button className="button secondary" type="button" onClick={() => setSearch("")}>Clear Search</button>
      </form>

      <div className="minion-guide-summary">
        <div><p className="eyebrow">Acquisition Details</p><h3>{activeCategoryName}</h3></div>
        <span aria-live="polite">Showing {shownMinions.length} of {matchingMinions.length} matching minions</span>
      </div>

      <div className="minion-acquisition-grid">
        {shownMinions.length > 0 ? shownMinions.map((minion) => <MinionAcquisitionCard key={minion.id} minion={minion} returnHref={categoryHref(activeCategory)} />) : <div className="empty-state">No minions match this acquisition method or search.</div>}
      </div>
    </section>
  </>;
}
