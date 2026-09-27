"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  logoUrl: string;
  portalName: string;
  portalSubtitle: string;
  children: ReactNode;
};

export default function ResponsiveSidebar({ logoUrl, portalName, portalSubtitle, children }: Props) {
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const toggleButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const main = document.querySelector<HTMLElement>(".content-shell");
    const previousAriaHidden = main?.getAttribute("aria-hidden");
    if (main) { main.inert = true; main.setAttribute("aria-hidden", "true"); }
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); return; }
      if (event.key !== "Tab") return;
      const items = Array.from(sidebar.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),summary,[tabindex]:not([tabindex="-1"])') || []).filter(item => item.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 1101px)");
    window.addEventListener("keydown", handleKeyboard);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (main) { main.inert = false; if (previousAriaHidden===null) main.removeAttribute("aria-hidden"); else main.setAttribute("aria-hidden",previousAriaHidden); }
      window.removeEventListener("keydown", handleKeyboard);
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [open]);

  function closeMenu(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => toggleButton.current?.focus(), 0);
  }

  return <>
    <button
      ref={toggleButton}
      type="button"
      className="mobile-menu-toggle"
      aria-controls="guild-sidebar"
      aria-expanded={open}
      aria-label="Open navigation menu"
      onClick={() => setOpen(true)}
    >
      <span className="mobile-menu-icon" aria-hidden="true"><i /><i /><i /></span>
      <span>Menu</span>
    </button>
    <button
      type="button"
      className={`mobile-menu-backdrop${open ? " open" : ""}`}
      aria-label="Close navigation menu"
      tabIndex={open ? 0 : -1}
      onClick={() => closeMenu(true)}
    />
    <aside ref={sidebar} id="guild-sidebar" className={`sidebar${open ? " mobile-open" : ""}`} aria-label="Portal sidebar">
      <div className="sidebar-brand">
        <img src={logoUrl} alt={`${portalName} logo`} />
        <div>
          <p>{portalName}</p>
          <span>{portalSubtitle}</span>
        </div>
        <button ref={closeButton} type="button" className="mobile-menu-close" aria-label="Close navigation menu" onClick={() => closeMenu(true)}>×</button>
      </div>
      <div className="sidebar-navigation" onClick={(event) => {
        if ((event.target as HTMLElement).closest("a")) closeMenu();
      }}>
        {children}
        <span className="sidebar-scroll-hint" aria-hidden="true">↓ Scroll for more</span>
      </div>
    </aside>
  </>;
}
