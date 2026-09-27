"use client";

import { useEffect, useRef, useState } from "react";

type Role = { name: string };

type Props = {
  roles: Role[];
  total: number;
  initialQuery?: string;
  initialRole?: string;
  initialStatus?: string;
};

function searchable(value: string) {
  return value.trim().toLocaleLowerCase();
}

export default function LiveCharacterFilters({ roles, total, initialQuery = "", initialRole = "", initialStatus = "" }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [role, setRole] = useState(initialRole);
  const [status, setStatus] = useState(initialStatus);
  const [visible, setVisible] = useState(total);
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const search = searchable(query);
    const cards = Array.from(regionRef.current?.closest("details")?.querySelectorAll<HTMLElement>("[data-character-filter-card]") || []);
    let count = 0;

    for (const card of cards) {
      const matchesSearch = !search || searchable(card.dataset.characterSearch || "").includes(search);
      const matchesRole = !role || card.dataset.characterRole === role;
      const matchesStatus = !status || card.dataset.characterStatus === status;
      const matches = matchesSearch && matchesRole && matchesStatus;
      card.hidden = !matches;
      if (matches) count += 1;
    }

    setVisible(count);
  }, [query, role, status, total]);

  function reset() {
    setQuery("");
    setRole("");
    setStatus("");
    regionRef.current?.querySelector<HTMLInputElement>("input[type=\"search\"]")?.focus();
  }

  return (
    <div ref={regionRef} className="character-filter-panel">
      <div className="character-filter-form" role="search" aria-label="Filter characters">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by character, display name, email, or ID"
          aria-label="Search characters"
        />
        <select value={role} onChange={(event) => setRole(event.target.value)} aria-label="Filter by role">
          <option value="">All roles</option>
          {roles.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <button className="top-action-button" type="button" onClick={reset} disabled={!query && !role && !status}>Reset</button>
      </div>
      <p aria-live="polite">Showing {visible} of {total} character{total === 1 ? "" : "s"}.</p>
    </div>
  );
}
