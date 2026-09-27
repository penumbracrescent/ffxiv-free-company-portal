"use client";

import { useState, type KeyboardEvent } from "react";
import CollectionAcquisitionLinks from "./CollectionAcquisitionLinks";

type MinionAcquisitionSource = {
  type: string;
  text: string;
  relatedType: string | null;
  relatedId: number | null;
  questName: string | null;
  questGiver: string | null;
  location: string | null;
  coordinates: string | null;
};

type MarketboardListing = {
  world_name: string;
  data_center_name: string | null;
  min_price: number;
};

type MinionAcquisitionCardProps = {
  returnHref: string;
  minion: {
    id: number;
    minion_name: string;
    description: string | null;
    source_name: string | null;
    patch: string | null;
    icon_url: string | null;
    image_url: string | null;
    ffxiv_collect_minion_id: string | null;
    marketboard_item_name: string | null;
    marketboard_listings: MarketboardListing[];
    marketboard_faerie: MarketboardListing | null;
    category_name: string;
    acquisition_data: MinionAcquisitionSource[];
    owned_by_viewer: boolean;
    fc_owned_count: number;
    tracked_characters: number;
  };
};

export default function MinionAcquisitionCard({ minion, returnHref }: MinionAcquisitionCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const artworkUrl = minion.image_url || minion.icon_url;
  const detailsUrl = minion.ffxiv_collect_minion_id
    ? `https://ffxivcollect.com/minions/${encodeURIComponent(minion.ffxiv_collect_minion_id)}`
    : `https://ffxivcollect.com/minions?name=${encodeURIComponent(minion.minion_name)}`;

  return (
    <article className={`minion-acquisition-card ${isFlipped ? "is-flipped" : ""}`}>
      <div className="minion-acquisition-card-inner">
        <div
          className="minion-acquisition-face minion-acquisition-front"
          onClick={() => setIsFlipped(true)}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
            event.preventDefault();
            setIsFlipped(true);
          }}
          role="button"
          tabIndex={isFlipped ? -1 : 0}
          aria-label={`View artwork for ${minion.minion_name}`}
          aria-hidden={isFlipped}
        >
          <div className="minion-acquisition-heading">
            {artworkUrl ? (
              <img className="minion-acquisition-image" src={artworkUrl} alt="" />
            ) : null}
            <div>
              <div className="tag-row">
                <span className="tag">{minion.category_name}</span>
                <span className={`tag ${minion.owned_by_viewer ? "owned" : "missing"}`}>
                  {minion.owned_by_viewer ? "Owned" : "Missing"}
                </span>
              </div>
              <h3>{minion.minion_name}</h3>
              {minion.patch ? <p>Patch {minion.patch}</p> : null}
            </div>
          </div>

          {minion.description ? <p className="minion-description">{minion.description}</p> : null}

          <div className="minion-source-list">
            {minion.acquisition_data.length > 0 ? minion.acquisition_data.map((source, index) => (
              <div key={`${minion.id}-${source.type}-${index}`} className="minion-source-entry">
                <strong>{source.questName || source.type || "Source"}</strong>
                {source.questGiver ? <span><b>Quest giver:</b> {source.questGiver}</span> : null}
                {source.location ? (
                  <span><b>Location:</b> {source.location}{source.coordinates ? ` (${source.coordinates})` : ""}</span>
                ) : null}
                {source.text && source.text !== source.questName ? <span>{source.text}</span> : null}
                <CollectionAcquisitionLinks source={source} returnHref={returnHref} />
              </div>
            )) : (
              <div className="minion-source-entry">
                <strong>Source details unavailable</strong>
                <span>{minion.source_name || "This source has not been published yet."}</span>
              </div>
            )}
          </div>

          {minion.marketboard_item_name ? (
            <div className="minion-card-marketboard">
              <strong>Marketboard: {minion.marketboard_item_name}</strong>
              {minion.marketboard_listings.length > 0 ? (
                <div className="minion-card-marketboard-prices">
                  {minion.marketboard_listings.map((listing) => (
                    <span key={`${listing.data_center_name}-${listing.world_name}`}>
                      <b>
                        {`${listing.data_center_name || "North-America"}/${listing.world_name}`}
                      </b>{" "}
                      - {Number(listing.min_price).toLocaleString()} gil
                    </span>
                  ))}
                  <span className="minion-card-faerie-price">
                    <b>{minion.marketboard_faerie ? `${minion.marketboard_faerie.data_center_name || "Home"}/${minion.marketboard_faerie.world_name}` : "Selected home world"}</b>{" "}
                    - {minion.marketboard_faerie
                      ? `${Number(minion.marketboard_faerie.min_price).toLocaleString()} gil`
                      : "no current listing"}
                  </span>
                </div>
              ) : (
                <span className="minion-card-marketboard-empty">No current North American listings.</span>
              )}
            </div>
          ) : null}

          <div className="minion-ownership-summary">
            <span>Owned by {minion.fc_owned_count} of {minion.tracked_characters} tracked FC members</span>
          </div>
          <span className="minion-card-flip-hint">View artwork</span>
        </div>

        <div className="minion-acquisition-face minion-acquisition-back" aria-hidden={!isFlipped}>
          <div className="minion-acquisition-artwork" aria-hidden="true">
            {artworkUrl ? <img src={artworkUrl} alt="" /> : null}
          </div>
          <div className="minion-acquisition-back-header">
            <h3>{minion.minion_name}</h3>
            <div className="tag-row">
              <span className="tag">{minion.category_name}</span>
              <span className={`tag ${minion.owned_by_viewer ? "owned" : "missing"}`}>
                {minion.owned_by_viewer ? "Owned" : "Missing"}
              </span>
            </div>
          </div>
          <div className="minion-acquisition-back-actions">
            <button type="button" className="button secondary" onClick={() => setIsFlipped(false)} tabIndex={isFlipped ? 0 : -1}>
              Return to details
            </button>
            <a className="button primary" href={detailsUrl} target="_blank" rel="noopener noreferrer" tabIndex={isFlipped ? 0 : -1}>
              More information <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
