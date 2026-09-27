"use client";

import { useMemo, useState } from "react";
import MemberProfileCard from "./MemberProfileCard";

type Member = {
  id: number;
  display_name: string;
  character_name: string;
  world: string;
  portrait_url: string | null;
  avatar_url: string | null;
  portrait_synced_at: string | null;
  role: string;
  fc_rank_name: string | null;
  fc_rank_changed_at: string | null;
  sync_status: string;
  first_seen_in_fc_at: string | null;
  join_date_override: string | null;
  join_date_source: string;
  last_seen_in_fc_at: string | null;
  last_mount_sync_at: string | null;
  total_mounts: number;
  owned_mounts: number;
  missing_mounts: number;
  collection_rate: number;
  rename_history: {
    id: number;
    old_name: string;
    new_name: string;
    detected_at: string;
  }[];
  rank_history: {
    id: number;
    old_rank_name: string;
    new_rank_name: string;
    old_rank_started_at: string | null;
    detected_at: string;
  }[];
  is_current_fc_member: boolean;
  linked_to_character_name: string | null;
  linked_characters: { id: number; character_name: string; world: string }[];
};

type Props = {
  members: Member[];
  roles: { name: string }[];
  initialSearch: string;
  initialRole: string;
  initialSyncStatus: string;
};

export default function MemberDirectoryView({ members, roles, initialSearch, initialRole, initialSyncStatus }: Props) {
  const [search, setSearch] = useState(initialSearch);
  const normalizedSearch = search.trim().toLowerCase();

  const visibleMembers = useMemo(() => {
    if (!normalizedSearch) return members;

    return members.filter((member) => [
      member.display_name,
      member.character_name,
      member.role,
      member.fc_rank_name,
      member.world,
      member.sync_status,
      member.linked_to_character_name,
      ...member.linked_characters.map((linked) => linked.character_name),
      ...member.rename_history.flatMap((rename) => [rename.old_name, rename.new_name]),
      ...member.rank_history.flatMap((rank) => [rank.old_rank_name, rank.new_rank_name])
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedSearch)));
  }, [members, normalizedSearch]);

  return <>
    <form className="member-directory-filters" method="get" action="/">
      <input type="hidden" name="view" value="members" />

      <label>
        <span>Search</span>
        <input
          name="memberSearch"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search member name, FC rank, role..."
          autoComplete="off"
        />
      </label>

      <label>
        <span>Role</span>
        <select name="memberRole" defaultValue={initialRole}>
          <option value="">All roles</option>
          {roles.map((role) => <option key={role.name} value={role.name}>{role.name}</option>)}
        </select>
      </label>

      <label>
        <span>Sync Status</span>
        <select name="memberSyncStatus" defaultValue={initialSyncStatus}>
          <option value="">All statuses</option>
          <option value="fc_synced">FC synced</option>
          <option value="mount_synced">Mount synced</option>
          <option value="collect_missing">FFXIV Collect missing</option>
          <option value="collect_private">FFXIV Collect private</option>
          <option value="mount_sync_failed">Mount sync failed</option>
        </select>
      </label>

      <div className="member-directory-actions">
        <button className="button primary" type="submit">Filter</button>
        <button className="ghost-button" type="button" onClick={() => setSearch("")}>Clear Search</button>
        <a className="ghost-button" href="/?view=members">Reset</a>
      </div>
    </form>

    <p className="member-directory-count" aria-live="polite">
      Showing {visibleMembers.length} tracked character{visibleMembers.length === 1 ? "" : "s"}.
    </p>

    <div className="member-card-grid">
      {visibleMembers.length > 0 ? visibleMembers.map((member) => <MemberProfileCard key={member.id} member={member} />) : <article className="panel"><span className="tag">No Results</span><h3>No members found</h3><p>Keep typing to adjust the search, or clear it to show everyone.</p></article>}
    </div>
  </>;
}
