"use client";

import { useEffect, useState } from "react";

type Listing = {
  world_name: string;
  data_center_name: string | null;
  min_price: number | string;
};

type MarketboardMount = {
  id: number;
  mount_name: string;
  marketboard_item_name: string | null;
  icon_url: string | null;
  source_name: string | null;
  owned_by_viewer: boolean;
  listings: Listing[];
  faerie: Listing | null;
};

const STORAGE_KEY = "cotf-marketboard-hide-owned";

export default function MarketboardMountGrid({ mounts, canFilterByOwnership, comparisonLabel, comparisonWorld, defaultHideOwned = false }: { mounts: MarketboardMount[]; canFilterByOwnership: boolean; comparisonLabel: string; comparisonWorld: string; defaultHideOwned?: boolean }) {
  const [hideOwned, setHideOwned] = useState(defaultHideOwned);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    setHideOwned(saved === null ? defaultHideOwned : saved === "true");
    setReady(true);
  }, [defaultHideOwned]);

  const toggleHideOwned = () => {
    if (!canFilterByOwnership) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/api/auth/signin?callbackUrl=${encodeURIComponent(returnTo)}`);
      return;
    }
    const next = !hideOwned;
    setHideOwned(next);
    window.localStorage.setItem(STORAGE_KEY, String(next));
  };

  const visibleMounts = hideOwned ? mounts.filter((mount) => !mount.owned_by_viewer) : mounts;

  return (
    <>
      <div className="marketboard-filter-row">
        <button type="button" className={hideOwned ? "marketboard-owned-filter active" : "marketboard-owned-filter"} aria-pressed={hideOwned} onClick={toggleHideOwned}>
          {canFilterByOwnership ? (hideOwned ? "Showing missing mounts" : "Hide mounts I own") : "Log in to filter by ownership"}
        </button>
      </div>
      {ready && visibleMounts.length === 0 ? <p className="empty-state">No marketboard mounts match this filter.</p> : null}
      <div className="party-target-grid" hidden={ready && visibleMounts.length === 0}>
        {visibleMounts.map((mount) => (
          <article key={mount.id} className="party-target-card">
            {mount.icon_url ? <img className="party-target-mount-image" src={mount.icon_url} alt="" /> : null}
            <h4>{mount.mount_name}</h4>
            <p className="marketboard-item-name">Marketboard item: <strong>{mount.marketboard_item_name || "Loading item name..."}</strong></p>
            <p>{mount.source_name || "Marketboard item"}</p>
            <div className="marketboard-price-list">
              {mount.listings.map((listing) => (
                <p key={`${listing.data_center_name}-${listing.world_name}`}><strong>{`${listing.data_center_name || "North-America"}/${listing.world_name}`}</strong> - {Number(listing.min_price).toLocaleString()} gil</p>
              ))}
              {mount.faerie ? <p><strong>{comparisonLabel}</strong> - {Number(mount.faerie.min_price).toLocaleString()} gil</p> : <p><strong>{comparisonLabel || comparisonWorld}</strong> - no current listing</p>}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
