"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type GalleryImage = { id: number; src: string; };

type CommunityGalleryPostCardProps = {
  categoryLabel: string;
  displayName: string;
  discordDisplayName: string;
  caption: string | null;
  postedAt: string;
  images: GalleryImage[];
  children?: ReactNode;
};

export default function CommunityGalleryPostCard({ categoryLabel, displayName, discordDisplayName, caption, postedAt, images, children }: CommunityGalleryPostCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mediaRef = useRef<HTMLDivElement>(null);
  const activeImage = images[activeImageIndex] ?? images[0];
  const hasMultipleImages = images.length > 1;
  const closeGallery = () => { if (document.fullscreenElement) void document.exitFullscreen(); setIsOpen(false); setActiveImageIndex(0); };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await mediaRef.current?.requestFullscreen();
    } catch {
      // The browser can decline full-screen mode; the gallery remains usable normally.
    }
  };
  const showPreviousImage = () => setActiveImageIndex((current) => (current - 1 + images.length) % images.length);
  const showNextImage = () => setActiveImageIndex((current) => (current + 1) % images.length);

  useEffect(() => {
    const updateFullscreenState = () => setIsFullscreen(document.fullscreenElement === mediaRef.current);
    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeGallery();
      if (hasMultipleImages && event.key === "ArrowLeft") showPreviousImage();
      if (hasMultipleImages && event.key === "ArrowRight") showNextImage();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = originalOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [isOpen, hasMultipleImages, images.length]);

  return (
    <article className="panel community-gallery-post">
      <button className="community-gallery-post-trigger" type="button" onClick={() => setIsOpen(true)} aria-label={`Open ${displayName}'s ${categoryLabel} post`}>
        <div className={`community-gallery-images community-gallery-preview ${hasMultipleImages ? "multiple" : ""}`}>{images.slice(0, 1).map((image) => <img key={image.id} src={image.src} loading="lazy" decoding="async" alt={`${displayName}'s ${categoryLabel}`} />)}{hasMultipleImages ? <span className="community-gallery-preview-count">+{images.length - 1}</span> : null}</div>
        <div className="community-gallery-post-copy">
          <h4>{displayName}</h4>
          {displayName !== discordDisplayName ? <small className="community-gallery-discord-name">Discord: {discordDisplayName}</small> : null}
          {caption ? <p>{caption}</p> : null}
          <small>Shared {postedAt}</small>
          <span className="community-gallery-open-post">Open full post{hasMultipleImages ? ` · ${images.length} photos` : ""}</span>
        </div>
      </button>
      {isOpen && activeImage && typeof document !== "undefined" ? createPortal(
        <div className="community-gallery-lightbox" role="dialog" aria-modal="true" aria-label={`${displayName}'s ${categoryLabel} post`} onMouseDown={(event) => { if (event.target === event.currentTarget) closeGallery(); }}>
          <div className="community-gallery-lightbox-dialog">
            <div className="community-gallery-lightbox-toolbar"><div><span className="tag">Community Gallery</span><strong>{displayName}</strong></div><div className="community-gallery-lightbox-toolbar-actions"><button type="button" className="community-gallery-lightbox-fullscreen" onClick={toggleFullscreen}>{isFullscreen ? "Exit Full Screen" : "Full Screen"}</button><button type="button" className="community-gallery-lightbox-close" onClick={closeGallery}>Close ×</button></div></div>
            <div className="community-gallery-lightbox-layout">
              <div ref={mediaRef} className="community-gallery-lightbox-media">
                <img src={activeImage.src} alt={`${displayName}'s ${categoryLabel} · image ${activeImageIndex + 1}`} />
                {isFullscreen ? <button type="button" className="community-gallery-exit-fullscreen" onClick={toggleFullscreen}>Exit Full Screen</button> : null}
                {hasMultipleImages ? <><button type="button" className="community-gallery-lightbox-arrow previous" onClick={showPreviousImage} aria-label="Previous image">‹</button><button type="button" className="community-gallery-lightbox-arrow next" onClick={showNextImage} aria-label="Next image">›</button><span className="community-gallery-lightbox-count">{activeImageIndex + 1} / {images.length}</span></> : null}
              </div>
              <aside className="community-gallery-lightbox-info">
                <h3>{displayName}</h3>
                {displayName !== discordDisplayName ? <p className="community-gallery-discord-name">Discord: {discordDisplayName}</p> : null}
                {caption ? <p>{caption}</p> : null}
                <small>Shared {postedAt}</small>
                <p className="community-gallery-lightbox-help">{hasMultipleImages ? "Use the arrows or your keyboard’s left and right keys to browse every photo." : "Click outside this window or use Escape to close."}</p>
                {children}
              </aside>
            </div>
          </div>
        </div>
      , document.body) : null}
    </article>
  );
}