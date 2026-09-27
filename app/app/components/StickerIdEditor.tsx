"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  name: string;
  initialValue?: string;
  label?: string;
};

const parseStickerIds = (value: string) => [...new Set(String(value || "").split(/[\s,]+/).map((item) => item.trim()).filter(Boolean))];
const defaultWelcomeWaveStickerIds = "816087792291282944,754108890559283200,749054660769218631,781291131828699156,819128604311027752,751606379340365864,816086581509095424,781323769960202280,819130301702995968,772972089963577354,783787404518883338,831570715471380550,831571726223540294";

export default function StickerIdEditor({ name, initialValue = "", label = "Welcome Wave Sticker IDs (optional)" }: Props) {
  const [savedIds, setSavedIds] = useState(() => parseStickerIds(initialValue));
  const [draftIds, setDraftIds] = useState<string[]>([""]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSavedIds(parseStickerIds(initialValue));
  }, [initialValue]);

  useEffect(() => {
    if (!open) return;
    firstInputRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function showEditor() {
    setDraftIds(savedIds.length ? [...savedIds] : [""]);
    setError("");
    setOpen(true);
  }

  function update(index: number, value: string) {
    setDraftIds((current) => current.map((item, itemIndex) => itemIndex === index ? value.replace(/\D/g, "") : item));
  }

  function useDefaults() {
    setDraftIds(parseStickerIds(defaultWelcomeWaveStickerIds));
    setError("");
  }

  function remove(index: number) {
    setDraftIds((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.length ? next : [""];
    });
  }

  function save() {
    const ids = [...new Set(draftIds.map((item) => item.trim()).filter(Boolean))];
    if (ids.length > 50) {
      setError("A maximum of 50 sticker IDs can be saved.");
      return;
    }
    if (ids.some((id) => !/^\d{15,22}$/.test(id))) {
      setError("Each sticker ID must contain 15 to 22 digits.");
      return;
    }
    setSavedIds(ids);
    setOpen(false);
    setError("");
  }

  return (
    <div className="sticker-id-editor">
      <input type="hidden" name={name} value={savedIds.join(",")} />
      <span className="setup-field-label"><strong>{label}</strong></span>
      <button className="ghost-button sticker-id-edit" type="button" onClick={showEditor}>Edit Sticker IDs</button>
      <small>{savedIds.length ? `${savedIds.length} sticker ID${savedIds.length === 1 ? "" : "s"} configured.` : "No sticker IDs configured."} Save the surrounding setup or bot settings form after closing the editor.</small>

      {open ? (
        <div className="sticker-id-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="sticker-id-dialog" role="dialog" aria-modal="true" aria-labelledby={`${name}-sticker-title`}>
            <header>
              <div>
                <span className="eyebrow">Discord stickers</span>
                <h3 id={`${name}-sticker-title`}>Welcome Wave Sticker IDs</h3>
              </div>
              <button className="ghost-button" type="button" onClick={() => setOpen(false)} aria-label="Exit sticker ID editor">Exit</button>
            </header>
            <p className="muted">Enter the numeric IDs for server stickers the portal may use with its optional welcome engagement.</p>
            <button className="button primary" type="button" onClick={useDefaults}>Use default sticker IDs</button>
            <p className="muted">Replaces the list below with the 13 bundled defaults. You can edit or remove them before saving. Exit without saving to keep your previous list.</p>
            <div className="sticker-id-list">
              {draftIds.map((id, index) => (
                <div className="sticker-id-row" key={`${index}-${draftIds.length}`}>
                  <label>
                    <span>Sticker ID {index + 1}</span>
                    <input
                      ref={index === 0 ? firstInputRef : undefined}
                      value={id}
                      onChange={(event) => update(index, event.target.value)}
                      inputMode="numeric"
                      pattern="[0-9]{15,22}"
                      maxLength={22}
                      autoComplete="off"
                      placeholder="Numeric Discord sticker ID"
                    />
                  </label>
                  <button className="ghost-button danger" type="button" onClick={() => remove(index)} aria-label={`Remove sticker ID ${index + 1}`}>Remove</button>
                </div>
              ))}
            </div>
            <button className="ghost-button sticker-id-add" type="button" onClick={() => setDraftIds((current) => [...current, ""])}>＋ Add ID</button>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <footer>
              <button className="button secondary" type="button" onClick={() => setOpen(false)}>Exit</button>
              <button className="button primary" type="button" onClick={save}>Save Sticker IDs</button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
