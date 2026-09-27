"use client";

import { useMemo, useState } from "react";
import MountAcquisitionCard from "./MountAcquisitionCard";

type Category = { category_key: string; category_name: string; mount_count: number; owned_count: number };
type Listing = { world_name: string; data_center_name: string | null; min_price: number };
type Source = { type: string; text: string; relatedType: string | null; relatedId: number | null };
type Mount = { id: number; mount_name: string; description: string | null; source_name: string | null; patch: string | null; icon_url: string | null; image_url: string | null; ffxiv_collect_mount_id: string | null; marketboard_item_name: string | null; marketboard_listings: Listing[]; marketboard_faerie: Listing | null; category_key: string; category_name: string; acquisition_data: Source[]; owned_by_viewer: boolean; fc_owned_count: number; tracked_characters: number; total_matches: number };
type Props = { mounts: Mount[]; categories: Category[]; allCategoryCount: number; activeCategory: string; activeCategoryName: string; initialSearch: string; hideOwned: boolean };

export default function MountCollectionBrowser({ mounts, categories, allCategoryCount, activeCategory, activeCategoryName, initialSearch, hideOwned }: Props) {
  const [search, setSearch] = useState(initialSearch);
  const normalizedSearch = search.trim().toLowerCase();
  const matchingMounts = useMemo(() => !normalizedSearch ? mounts : mounts.filter((mount) => [mount.mount_name, mount.description, mount.source_name, mount.patch, mount.marketboard_item_name, mount.category_name].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedSearch))), [mounts, normalizedSearch]);
  const shownMounts = matchingMounts.slice(0, 120);
  const ownershipSuffix = hideOwned ? "&mountOwnership=missing" : "";
  const searchSuffix = search.trim() ? `&mountSearch=${encodeURIComponent(search.trim())}` : "";
  const categoryHref = (category = "") => `/?view=mounts&mountTab=guide${category ? `&mountCategory=${category}` : ""}${searchSuffix}${ownershipSuffix}#mount-acquisition-list`;

  return <>
    <div className="minion-method-grid" aria-label="Mount acquisition methods">
      <a className={`minion-method-card ${activeCategory === "" ? "selected" : ""}`} href={categoryHref()}><span className="tag">All Methods</span><strong>{allCategoryCount}</strong><span>{hideOwned ? "mounts you do not own" : "cataloged mounts"}</span></a>
      {categories.map((category) => <a key={category.category_key} className={`minion-method-card ${activeCategory === category.category_key ? "selected" : ""}`} href={categoryHref(category.category_key)}><span className="tag">{category.category_name}</span><strong>{category.mount_count}</strong><span>{hideOwned ? "mounts you do not own" : `${category.owned_count} FC ownership records`}</span></a>)}
    </div>
    <section id="mount-acquisition-list" className="minion-acquisition-list-section">
      <form className="mount-filter-panel minion-acquisition-search" onSubmit={(event) => event.preventDefault()}><label><span>Search mounts or sources</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Mount, duty, achievement, vendor, location..." autoComplete="off" /></label><button className="button secondary" type="button" onClick={() => setSearch("")}>Clear Search</button></form>
      <div className="minion-guide-summary"><div><p className="eyebrow">Acquisition Details</p><h3>{activeCategoryName}</h3></div><span aria-live="polite">Showing {shownMounts.length} of {matchingMounts.length} matching mounts</span></div>
      <div className="minion-acquisition-grid">{shownMounts.length ? shownMounts.map((mount) => <MountAcquisitionCard key={mount.id} mount={mount} returnHref={categoryHref(activeCategory)} />) : <div className="empty-state">No mounts match this acquisition method or search.</div>}</div>
    </section>
  </>;
}
