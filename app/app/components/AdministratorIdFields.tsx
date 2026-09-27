"use client";

import { useState } from "react";

type Props = {
  initialIds: string[];
};

export default function AdministratorIdFields({ initialIds }: Props) {
  const [ids, setIds] = useState(() => (initialIds.length ? initialIds : [""]));

  function update(index: number, value: string) {
    setIds((current) => current.map((id, itemIndex) => itemIndex === index ? value.replace(/\D/g, "") : id));
  }

  function remove(index: number) {
    setIds((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.length ? next : [""];
    });
  }

  return (
    <div className="administrator-id-editor">
      <div className="administrator-id-list">
        {ids.map((id, index) => (
          <div className="administrator-id-row" key={`${index}-${ids.length}`}>
            <label>
              <span>Administrator {index + 1}</span>
              <input
                name="additionalAdminDiscordIds"
                value={id}
                onChange={(event) => update(index, event.target.value)}
                inputMode="numeric"
                pattern="[0-9]{15,22}"
                placeholder="Discord user ID"
                aria-label={`Additional administrator ${index + 1} Discord user ID`}
              />
            </label>
            <button className="ghost-button danger administrator-id-remove" type="button" onClick={() => remove(index)} aria-label={`Remove administrator ${index + 1}`}>
              Remove
            </button>
          </div>
        ))}
      </div>
      <button className="ghost-button administrator-id-add" type="button" onClick={() => setIds((current) => [...current, ""])}>
        <span aria-hidden="true">＋</span> Add administrator
      </button>
      <small>Use numeric Discord user IDs. Empty rows are ignored; removing an ID removes its access on the next authenticated request.</small>
    </div>
  );
}
