"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type FcGalleryImage = {
  id: number;
  title: string;
  alt_text: string;
  created_at: string;
};

type FcGalleryViewerProps = {
  images: FcGalleryImage[];
};

function formatAddedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export default function FcGalleryViewer({ images }: FcGalleryViewerProps) {
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mediaRef = useRef<HTMLDivElement>(null);
  const activeImage = activeImageIndex === null ? null : images[activeImageIndex] ?? null;
  const hasMultipleImages = images.length > 1;

  const closeViewer = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    setActiveImageIndex(null);
  };

  const showPreviousImage = () => {
    if (activeImageIndex === null) return;
    setActiveImageIndex((activeImageIndex - 1 + images.length) % images.length);
  };

  const showNextImage = () => {
    if (activeImageIndex === null) return;
    setActiveImageIndex((activeImageIndex + 1) % images.length);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await mediaRef.current?.requestFullscreen();
    } catch {
      // The viewer remains available when a browser declines full-screen mode.
    }
  };

  useEffect(() => {
    const updateFullscreenState = () => setIsFullscreen(document.fullscreenElement === mediaRef.current);
    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  useEffect(() => {
    if (activeImageIndex === null) return;

    const originalOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeViewer();
      if (hasMultipleImages && event.key === "ArrowLeft") showPreviousImage();
      if (hasMultipleImages && event.key === "ArrowRight") showNextImage();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeImageIndex, hasMultipleImages, images.length]);

  return (
    <>
      <div className="fc-info-gallery-grid">
        {images.map((image, index) => (
          <article key={image.id} className="panel fc-info-gallery-card">
            <button
              className="fc-info-gallery-image-link"
              type="button"
              onClick={() => setActiveImageIndex(index)}
              aria-label={`Open ${image.title} in the FC Gallery viewer`}
            >
              <img src={`/api/gallery/${image.id}`} alt={image.alt_text || image.title} loading="lazy" decoding="async" />
            </button>
            <h3>{image.title}</h3>
            {image.alt_text && image.alt_text !== image.title ? <p>{image.alt_text}</p> : null}
            <small>Added {formatAddedAt(image.created_at)}</small>
          </article>
        ))}
      </div>

      {activeImage && typeof document !== "undefined" ? createPortal(
        <div
          className="community-gallery-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${activeImage.title} in the FC Gallery`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeViewer();
          }}
        >
          <div className="community-gallery-lightbox-dialog">
            <div className="community-gallery-lightbox-toolbar">
              <div>
                <span className="tag">FC Gallery</span>
                <strong>{activeImage.title}</strong>
              </div>
              <div className="community-gallery-lightbox-toolbar-actions">
                <button type="button" className="community-gallery-lightbox-fullscreen" onClick={toggleFullscreen}>
                  {isFullscreen ? "Exit Full Screen" : "Full Screen"}
                </button>
                <button type="button" className="community-gallery-lightbox-close" onClick={closeViewer}>Close x</button>
              </div>
            </div>
            <div className="community-gallery-lightbox-layout">
              <div ref={mediaRef} className="community-gallery-lightbox-media">
                <img src={`/api/gallery/${activeImage.id}`} alt={activeImage.alt_text || activeImage.title} />
                {isFullscreen ? <button type="button" className="community-gallery-exit-fullscreen" onClick={toggleFullscreen}>Exit Full Screen</button> : null}
                {hasMultipleImages ? <>
                  <button type="button" className="community-gallery-lightbox-arrow previous" onClick={showPreviousImage} aria-label="Previous FC Gallery photo">‹</button>
                  <button type="button" className="community-gallery-lightbox-arrow next" onClick={showNextImage} aria-label="Next FC Gallery photo">›</button>
                  <span className="community-gallery-lightbox-count">{activeImageIndex! + 1} / {images.length}</span>
                </> : null}
              </div>
              <aside className="community-gallery-lightbox-info">
                <h3>{activeImage.title}</h3>
                {activeImage.alt_text && activeImage.alt_text !== activeImage.title ? <p>{activeImage.alt_text}</p> : null}
                <small>Added {formatAddedAt(activeImage.created_at)}</small>
                <p className="community-gallery-lightbox-help">
                  {hasMultipleImages ? "Use the arrows or your keyboard's left and right keys to browse every FC photo." : "Click outside this window or use Escape to close."}
                </p>
              </aside>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  );
}