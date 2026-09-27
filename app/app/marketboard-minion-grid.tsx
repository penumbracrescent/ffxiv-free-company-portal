"use client";

import { useEffect, useState } from "react";

type Listing = {
  world_name: string;
  data_center_name: string | null;
  min_price: number | string;
};

type MarketboardMinion = {
  id: number;
  minion_name: string;
  marketboard_item_name: string | null;
  icon_url: string | null;
  source_name: string | null;
  owned_by_viewer: boolean;
  listings: Listing[];
  faerie: Listing | null;
};

const STORAGE_KEY = "cotf-marketboard-hide-owned-minions";

export default function MarketboardMinionGrid({
  minions,
  canFilterByOwnership,
  comparisonLabel,
  comparisonWorld,
  defaultHideOwned = false
}: {
  minions: MarketboardMinion[];
  canFilterByOwnership: boolean;
  comparisonLabel: string;
  comparisonWorld: string;
  defaultHideOwned?: boolean;
}) {
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

  const visibleMinions = hideOwned
    ? minions.filter((minion) => !minion.owned_by_viewer)
    : minions;

  return (
    <>
      <div className="marketboard-filter-row">
        <button
          type="button"
          className={hideOwned ? "marketboard-owned-filter active" : "marketboard-owned-filter"}
          aria-pressed={hideOwned}
          onClick={toggleHideOwned}
        >
          {canFilterByOwnership
            ? hideOwned
              ? "Showing missing minions"
              : "Hide minions I own"
            : "Log in to filter by ownership"}
        </button>
      </div>
      {ready && visibleMinions.length === 0 ? (
        <p className="empty-state">No marketboard minions match this filter.</p>
      ) : null}
      <div className="party-target-grid" hidden={ready && visibleMinions.length === 0}>
        {visibleMinions.map((minion) => (
          <article key={minion.id} className="party-target-card">
            {minion.icon_url ? (
              <img className="party-target-mount-image" src={minion.icon_url} alt="" />
            ) : null}
            <h4>{minion.minion_name}</h4>
            <p className="marketboard-item-name">
              Marketboard item: <strong>{minion.marketboard_item_name || "Loading item name..."}</strong>
            </p>
            <p>{minion.source_name || "Marketboard item"}</p>
            <div className="marketboard-price-list">
              {minion.listings.map((listing) => (
                <p key={`${listing.data_center_name}-${listing.world_name}`}>
                  <strong>
                    {`${listing.data_center_name || "North-America"}/${listing.world_name}`}
                  </strong>{" "}
                  - {Number(listing.min_price).toLocaleString()} gil
                </p>
              ))}
              {minion.faerie ? (
                <p><strong>{comparisonLabel}</strong> - {Number(minion.faerie.min_price).toLocaleString()} gil</p>
              ) : (
                <p><strong>{comparisonLabel || comparisonWorld}</strong> - no current listing</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
