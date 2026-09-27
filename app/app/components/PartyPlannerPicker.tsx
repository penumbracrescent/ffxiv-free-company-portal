"use client";

import { useMemo, useState } from "react";

type PartyCharacterOption = {
  id: number;
  display_name: string;
  character_name: string;
  world: string;
  role: string;
  sync_status: string;
  owner_key: string;
};

type PartyPlannerPickerProps = {
  partyCharacterOptions: PartyCharacterOption[];
  selectedPartyCharacterIds: number[];
  selectedMountSetId: number | null;
  initialSearch?: string;
};

export default function PartyPlannerPicker({
  partyCharacterOptions,
  selectedPartyCharacterIds,
  selectedMountSetId,
  initialSearch = ""
}: PartyPlannerPickerProps) {
  const [search, setSearch] = useState(initialSearch);
  const [selectedIds, setSelectedIds] = useState<number[]>(() => {
    const owners = new Set<string>();
    return selectedPartyCharacterIds.filter((id) => {
      const character = partyCharacterOptions.find((option) => option.id === id);
      if (!character || owners.has(character.owner_key)) return false;
      owners.add(character.owner_key);
      return true;
    });
  });

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const normalizedSearch = search.trim().toLowerCase();

  const selectedCharacters = useMemo(() => {
    return selectedIds
      .map((id) => partyCharacterOptions.find((character) => character.id === id))
      .filter(Boolean) as PartyCharacterOption[];
  }, [partyCharacterOptions, selectedIds]);

  const filteredCharacters = useMemo(() => {
    const selectedOwnerKeys = new Set(selectedCharacters.map((character) => character.owner_key));
    return partyCharacterOptions
      .filter((character) => !selectedIdSet.has(character.id))
      .filter((character) => !selectedOwnerKeys.has(character.owner_key))
      .filter((character) => {
        if (!normalizedSearch) return true;

        return [
          character.display_name,
          character.character_name,
          character.world,
          character.role,
          character.sync_status
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedSearch));
      });
  }, [partyCharacterOptions, selectedCharacters, selectedIdSet, normalizedSearch]);

  const toggleCharacter = (characterId: number) => {
    setSelectedIds((currentIds) => {
      if (currentIds.includes(characterId)) {
        return currentIds.filter((id) => id !== characterId);
      }

      if (currentIds.length >= 8) {
        return currentIds;
      }

      return [...currentIds, characterId];
    });
  };

  const removeCharacter = (characterId: number) => {
    setSelectedIds((currentIds) => currentIds.filter((id) => id !== characterId));
  };

const clearHref =
  selectedMountSetId && Number.isFinite(selectedMountSetId) && selectedMountSetId > 0
    ? `/?view=mounts&mountSetId=${selectedMountSetId}#party-planner`
    : "/?view=mounts#party-planner";

  return (
    <form className="party-planner-form" method="get" action="/?view=mounts#party-planner">
<input type="hidden" name="view" value="mounts" />
      {selectedMountSetId && selectedMountSetId > 0 ? (
        <input type="hidden" name="mountSetId" value={selectedMountSetId} />
      ) : null}

      {selectedIds.map((characterId) => (
        <input
          key={characterId}
          type="hidden"
          name="partyCharacterId"
          value={characterId}
        />
      ))}

      <div className="party-search-row">
        <label>
          <span>Find Member</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, role, world, or sync status..."
          />
        </label>

        <div className="party-planner-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() => setSearch("")}
          >
            Clear Search
          </button>

          <a className="ghost-button" href={clearHref}>
            Clear Party
          </a>
        </div>
      </div>

      <div className="selected-party-panel">
        <div>
          <span className="tag">Selected Party</span>
          <h4>{selectedIds.length}/8 Members</h4>
        </div>

        {selectedCharacters.length > 0 ? (
          <div className="selected-party-chip-list">
            {selectedCharacters.map((character) => (
              <button
                key={character.id}
                className="selected-party-chip"
                type="button"
                onClick={() => removeCharacter(character.id)}
              >
                <strong>{character.display_name}</strong>
                <span>Remove</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="party-empty-note">
            No party members selected yet. Search or scroll below to add members.
          </p>
        )}
      </div>

      <details className="party-member-picker" open>
        <summary>
          <span>Select Party Members</span>
          <strong>
            {filteredCharacters.length} shown · {partyCharacterOptions.length} total
          </strong>
        </summary>

        <div className="party-member-grid">
          {filteredCharacters.length > 0 ? (
            filteredCharacters.map((character) => {
              const limitReached = selectedIds.length >= 8;

              return (
                <label
                  key={character.id}
                  className={`party-member-option ${limitReached ? "limit-reached" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(character.id)}
                    disabled={limitReached}
                    onChange={() => toggleCharacter(character.id)}
                  />

                  <span>
                    <strong>{character.display_name}</strong>
                    <small>
                      {character.role} · {character.sync_status}
                    </small>
                  </span>
                </label>
              );
            })
          ) : (
            <article className="party-member-empty">
              <strong>No matching unselected members.</strong>
              <span>Clear the search or remove someone from the selected party.</span>
            </article>
          )}
        </div>
      </details>

      {selectedIds.length >= 8 ? (
        <p className="party-limit-note">
          Party is full. Remove someone to add another member.
        </p>
      ) : null}

      <div className="party-planner-actions">
        <button className="button primary" type="submit">
          Calculate Party Targets
        </button>
      </div>
    </form>
  );
}
