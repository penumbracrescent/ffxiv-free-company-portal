"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { getCollectionSourceGuideLinks, getCollectionSourceNotice } from "../../lib/collection-source-guide-links";

type AchievementSource = {
  type: string;
  text: string;
  relatedType: string | null;
  relatedId: number | null;
};

type Props = { source: AchievementSource; returnHref: string };

function stopCardFlip(event: MouseEvent<HTMLAnchorElement> | KeyboardEvent<HTMLAnchorElement>) {
  event.stopPropagation();
}

export default function CollectionAcquisitionLinks({ source, returnHref }: Props) {
  const isAchievement = String(source.relatedType || source.type).trim().toLowerCase() === "achievement";
  const achievementId = Number(source.relatedId || 0);
  const guides = getCollectionSourceGuideLinks(source);
  const notice = getCollectionSourceNotice(source);
  if ((!isAchievement || achievementId <= 0) && guides.length === 0 && !notice) return null;
  const achievementHref = `/?view=achievements&collectionSearch=${encodeURIComponent(source.text)}#collection-catalog`;
  return <div className="collection-acquisition-links" aria-label={`Resources for ${source.text || "this achievement"}`}>
    {isAchievement && achievementId > 0 ? <a className="button secondary" href={achievementHref} onClick={stopCardFlip} onKeyDown={stopCardFlip}>View achievement</a> : null}
    {guides.map((guide) => <a key={guide.slug} className={`button ${guide.depth === "detailed" ? "primary" : "secondary"}`} href={`/?view=guides&guide=${encodeURIComponent(guide.slug)}&returnTo=${encodeURIComponent(returnHref)}#guides`} onClick={stopCardFlip} onKeyDown={stopCardFlip}>{guide.depth === "detailed" ? "Open guide" : "Guide overview"}</a>)}
    {notice ? <div className={`collection-source-notice ${notice.tone}`}><strong>{notice.label}</strong><span>{notice.detail}</span></div> : null}
  </div>;
}
