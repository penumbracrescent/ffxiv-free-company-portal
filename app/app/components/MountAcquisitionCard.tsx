"use client";

import { useState, type KeyboardEvent } from "react";
import CollectionAcquisitionLinks from "./CollectionAcquisitionLinks";

type Listing = { world_name: string; data_center_name: string | null; min_price: number };
type AcquisitionSource = { type: string; text: string; relatedType: string | null; relatedId: number | null };

type Props = {
  returnHref: string;
  mount: {
    id: number;
    mount_name: string;
    description: string | null;
    source_name: string | null;
    patch: string | null;
    icon_url: string | null;
    image_url: string | null;
    ffxiv_collect_mount_id: string | null;
    marketboard_item_name: string | null;
    marketboard_listings: Listing[];
    marketboard_faerie: Listing | null;
    category_name: string;
    acquisition_data: AcquisitionSource[];
    owned_by_viewer: boolean;
    fc_owned_count: number;
    tracked_characters: number;
  };
};

export default function MountAcquisitionCard({ mount, returnHref }: Props) {
  const [isFlipped, setIsFlipped] = useState(false);
  const artworkUrl = mount.image_url || mount.icon_url;
  const detailsUrl = mount.ffxiv_collect_mount_id
    ? `https://ffxivcollect.com/mounts/${encodeURIComponent(mount.ffxiv_collect_mount_id)}`
    : `https://ffxivcollect.com/mounts?name=${encodeURIComponent(mount.mount_name)}`;

  return <article className={`minion-acquisition-card mount-acquisition-card ${isFlipped ? "is-flipped" : ""}`}>
    <div className="minion-acquisition-card-inner">
      <div className="minion-acquisition-face minion-acquisition-front" role="button" onClick={() => setIsFlipped(true)} onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => { if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return; event.preventDefault(); setIsFlipped(true); }} tabIndex={isFlipped ? -1 : 0} aria-label={`View artwork for ${mount.mount_name}`} aria-hidden={isFlipped}>
        <div className="minion-acquisition-heading">
          {artworkUrl ? <img className="minion-acquisition-image" src={artworkUrl} alt="" /> : null}
          <div><div className="tag-row"><span className="tag">{mount.category_name}</span><span className={`tag ${mount.owned_by_viewer ? "owned" : "missing"}`}>{mount.owned_by_viewer ? "Owned" : "Missing"}</span></div><h3>{mount.mount_name}</h3>{mount.patch ? <p>Patch {mount.patch}</p> : null}</div>
        </div>
        {mount.description ? <p className="minion-description">{mount.description}</p> : null}
        <div className="minion-source-list">{mount.acquisition_data.length ? mount.acquisition_data.map((source, index) => <div className="minion-source-entry" key={`${mount.id}-${source.type}-${index}`}><strong>{source.type || "How to obtain"}</strong>{source.text ? <span>{source.text}</span> : null}<CollectionAcquisitionLinks source={source} returnHref={returnHref} /></div>) : <div className="minion-source-entry"><strong>How to obtain</strong><span>{mount.source_name || "This source has not been published yet."}</span></div>}</div>
        {mount.marketboard_item_name ? <div className="minion-card-marketboard"><strong>Marketboard: {mount.marketboard_item_name}</strong>{mount.marketboard_listings.length ? <div className="minion-card-marketboard-prices">{mount.marketboard_listings.map((listing) => <span key={`${listing.data_center_name}-${listing.world_name}`}><b>{`${listing.data_center_name || "North-America"}/${listing.world_name}`}</b> - {Number(listing.min_price).toLocaleString()} gil</span>)}<span className="minion-card-faerie-price"><b>{mount.marketboard_faerie ? `${mount.marketboard_faerie.data_center_name || "Home"}/${mount.marketboard_faerie.world_name}` : "Selected home world"}</b> - {mount.marketboard_faerie ? `${Number(mount.marketboard_faerie.min_price).toLocaleString()} gil` : "no current listing"}</span></div> : <span className="minion-card-marketboard-empty">No current North American listings.</span>}</div> : null}
        <div className="minion-ownership-summary"><span>Owned by {mount.fc_owned_count} of {mount.tracked_characters} tracked FC members</span></div>
        <span className="minion-card-flip-hint">View artwork</span>
      </div>
      <div className="minion-acquisition-face minion-acquisition-back" aria-hidden={!isFlipped}>
        <div className="minion-acquisition-artwork" aria-hidden="true">{artworkUrl ? <img src={artworkUrl} alt="" /> : null}</div>
        <div className="minion-acquisition-back-header"><h3>{mount.mount_name}</h3><div className="tag-row"><span className="tag">{mount.category_name}</span><span className={`tag ${mount.owned_by_viewer ? "owned" : "missing"}`}>{mount.owned_by_viewer ? "Owned" : "Missing"}</span></div></div>
        <div className="minion-acquisition-back-actions"><button type="button" className="button secondary" onClick={() => setIsFlipped(false)} tabIndex={isFlipped ? 0 : -1}>Return to details</button><a className="button primary" href={detailsUrl} target="_blank" rel="noopener noreferrer" tabIndex={isFlipped ? 0 : -1}>More information <span aria-hidden="true">↗</span></a></div>
      </div>
    </div>
  </article>;
}
