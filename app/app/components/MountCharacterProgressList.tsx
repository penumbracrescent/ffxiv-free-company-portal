"use client";

import { useMemo, useState } from "react";

type CharacterProgress = {
  character_id: number;
  display_name: string;
  character_name: string;
  world: string;
  role: string;
  sync_status: string;
  last_mount_sync_at: string | null;
  total_mounts: number;
  owned_mounts: number;
  missing_mounts: number;
  collection_rate: number;
};

type Props = {
  characters: CharacterProgress[];
  roles: { name: string }[];
  initialSearch: string;
  initialRole: string;
  initialSyncStatus: string;
  selectedMountSetId: number | null;
  selectedPartyCharacterIds: number[];
};

function formatShortDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export default function MountCharacterProgressList({ characters, roles, initialSearch, initialRole, initialSyncStatus, selectedMountSetId, selectedPartyCharacterIds }: Props) {
  const [search, setSearch] = useState(initialSearch);
  const normalizedSearch = search.trim().toLowerCase();

  const visibleCharacters = useMemo(() => {
    if (!normalizedSearch) return characters;
    return characters.filter((character) => [character.display_name, character.character_name, character.world, character.role, character.sync_status]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedSearch)));
  }, [characters, normalizedSearch]);

  function detailHref(characterId: number) {
    const params = new URLSearchParams({ view: "mounts", detailCharacterId: String(characterId) });
    if (selectedMountSetId) params.set("mountSetId", String(selectedMountSetId));
    if (search.trim()) params.set("mountTrackerSearch", search.trim());
    if (initialRole) params.set("mountTrackerRole", initialRole);
    if (initialSyncStatus) params.set("mountTrackerStatus", initialSyncStatus);
    selectedPartyCharacterIds.forEach((id) => params.append("partyCharacterId", String(id)));
    return `/?${params.toString()}#mount-character-details`;
  }

  const clearHref = selectedMountSetId
    ? `/?view=mounts&mountSetId=${selectedMountSetId}#mount-character-list`
    : "/?view=mounts#mount-character-list";

  return <section id="mount-character-list" className="mount-character-list-section">
    <div className="mount-character-list-heading">
      <div><p className="eyebrow">Character Progress</p><h3>Member Mount Collections</h3></div>
      <span aria-live="polite">{visibleCharacters.length} of {characters.length} shown</span>
    </div>

    <form className="mount-tracker-filters" method="get" action="/#mount-character-list">
      <input type="hidden" name="view" value="mounts" />
      {selectedMountSetId ? <input type="hidden" name="mountSetId" value={selectedMountSetId} /> : null}
      {selectedPartyCharacterIds.map((characterId) => <input key={characterId} type="hidden" name="partyCharacterId" value={characterId} />)}

      <label>
        <span>Character Search</span>
        <input name="mountTrackerSearch" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search member..." autoComplete="off" />
      </label>

      <label>
        <span>Role</span>
        <select name="mountTrackerRole" defaultValue={initialRole}>
          <option value="">All roles</option>
          {roles.map((role) => <option key={role.name} value={role.name}>{role.name}</option>)}
        </select>
      </label>

      <label>
        <span>Sync Status</span>
        <select name="mountTrackerStatus" defaultValue={initialSyncStatus}>
          <option value="">All statuses</option>
          <option value="mount_synced">Mount synced</option>
          <option value="pending">Pending</option>
          <option value="collect_missing">FFXIV Collect missing</option>
          <option value="collect_private">FFXIV Collect private</option>
          <option value="sync_failed">Sync failed</option>
        </select>
      </label>

      <div className="mount-filter-actions">
        <button className="button primary" type="submit">Apply Filters</button>
        <button className="ghost-button" type="button" onClick={() => setSearch("")}>Clear Search</button>
        <a className="ghost-button" href={clearHref}>Clear All</a>
      </div>
    </form>

    <div className="mount-table">
      <div className="mount-row header"><span>Member</span><span>Role</span><span>Sync</span><span>Owned</span><span>Missing</span><span>Rate</span><span>Last Sync</span></div>
      {visibleCharacters.length > 0 ? visibleCharacters.map((character) => <div key={character.character_id} className="mount-row">
        <span><a className="mount-detail-link" href={detailHref(character.character_id)}>{character.display_name}</a></span>
        <span>{character.role}</span>
        <span>{character.sync_status}</span>
        <span>{character.owned_mounts}/{character.total_mounts}</span>
        <span>{character.missing_mounts}</span>
        <span>{character.collection_rate}%</span>
        <span>{character.last_mount_sync_at ? formatShortDateTime(character.last_mount_sync_at) : "Pending"}</span>
      </div>) : <div className="mount-row mount-row-empty"><span>No members match this search.</span></div>}
    </div>
  </section>;
}
