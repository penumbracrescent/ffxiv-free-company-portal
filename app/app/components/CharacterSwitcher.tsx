"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type CharacterChoice = {
  id: number;
  character_name: string;
  world: string;
  kind: string;
};

type Props = {
  characters: CharacterChoice[];
  activeCharacterId: number | null;
  switchAction: (formData: FormData) => void | Promise<void>;
  canEmulateMember?: boolean;
  isEmulatingMember?: boolean;
  emulationAction?: (formData: FormData) => void | Promise<void>;
  returnTo?: string;
};

export default function CharacterSwitcher({ characters, activeCharacterId, switchAction, canEmulateMember=false, isEmulatingMember=false, emulationAction, returnTo="/?view=home" }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return <>
    {isEmulatingMember && canEmulateMember && emulationAction ? <form action={emulationAction} className="member-emulation-exit-form">
      <input type="hidden" name="enabled" value="false"/>
      <input type="hidden" name="returnTo" value={returnTo}/>
      <button className="top-action-button member-emulation-active" type="submit">Exit Member View</button>
    </form> : <button className="top-action-button" type="button" onClick={() => setOpen(true)}>Switch Character</button>}
    {open && typeof document !== "undefined" ? createPortal(
      <div className="character-switch-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}>
        <section className="character-switch-dialog" role="dialog" aria-modal="true" aria-labelledby="character-switch-title">
          <header>
            <div>
              <span className="tag">Character selection</span>
              <h3 id="character-switch-title">Switch Character</h3>
              <p>Choose which linked character the portal should use.</p>
            </div>
            <button className="ghost-button" type="button" onClick={() => setOpen(false)}>Close</button>
          </header>
          {characters.length ? <div className="character-switch-list">
            {characters.map((character) => {
              const active = character.id === activeCharacterId;
              return <form action={switchAction} key={character.id}>
                <input type="hidden" name="characterId" value={character.id} />
                <button className={`character-switch-option ${active ? "active" : ""}`} type="submit" disabled={active}>
                  <span>
                    <strong>{character.character_name}</strong>
                    <small>{character.world} · {character.kind}</small>
                  </span>
                  <span className="tag">{active ? "Selected" : "Switch"}</span>
                </button>
              </form>;
            })}
          </div> : null}
          {canEmulateMember && emulationAction && !isEmulatingMember ? <section className="character-emulation-panel">
            <div>
              <span className="tag">Admin preview</span>
              <h4>Emulate a non-admin member</h4>
              <p>Preview every portal page using ordinary member navigation and visibility without changing your account or selected character.</p>
            </div>
            <form action={emulationAction}>
              <input type="hidden" name="enabled" value="true"/>
              <input type="hidden" name="returnTo" value={returnTo}/>
              <button className="button secondary" type="submit">View Site as Member</button>
            </form>
          </section> : null}
        </section>
      </div>,
      document.body
    ) : null}
  </>;
}
