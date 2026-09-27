"use client";

import { useState } from "react";

type MemberProfileCardProps = {
  member: {
    id: number;
    display_name: string;
    character_name: string;
    world: string;
    portrait_url: string | null;
    avatar_url: string | null;
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
};

function formatShortDate(value: string | null) {
  if (!value) return "Unknown";

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatNumericDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "2-digit",
    month: "numeric",
    day: "numeric"
  });
}

function calendarDaysBetween(startValue: string, endValue = new Date().toISOString()) {
  const start = new Date(startValue);
  const end = new Date(endValue);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(0, Math.floor((endDay - startDay) / 86_400_000));
}

function dayLabel(days: number) {
  return `${days} day${days === 1 ? "" : "s"}`;
}

function formatRankChangeAge(value: string | null) {
  if (!value) return "Baseline pending";
  const days = calendarDaysBetween(value);
  return `${formatNumericDate(value)} - ${days === null ? "unknown age" : `${dayLabel(days)} ago`}`;
}

export default function MemberProfileCard({ member }: MemberProfileCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const joinLabel = !member.is_current_fc_member ? "Tracking started" : member.join_date_override
    ? "Joined"
    : member.first_seen_in_fc_at
      ? "Tracked since"
      : "Join date";

  const joinDate = member.join_date_override || member.first_seen_in_fc_at;
  const portraitUrl = member.portrait_url || member.avatar_url || "/branding/default-logo.svg";
  const hasPortrait = Boolean(member.portrait_url || member.avatar_url);
  const latestPreviousRank = member.rank_history.length > 0
    ? member.rank_history[member.rank_history.length - 1]
    : null;
  const previousRankDays = latestPreviousRank?.old_rank_started_at
    ? calendarDaysBetween(latestPreviousRank.old_rank_started_at, latestPreviousRank.detected_at)
    : null;
  const previousRankLabel = latestPreviousRank
    ? `Previous: ${latestPreviousRank.old_rank_name}${previousRankDays === null ? "" : ` — held ${dayLabel(previousRankDays)}`}`
    : null;

  return (
    <article className={`member-profile-card ${isFlipped ? "is-flipped" : ""}`}>
      <button
        className="member-profile-flip-button"
        type="button"
        onClick={() => setIsFlipped((current) => !current)}
        aria-label={
          isFlipped
            ? `Show front of ${member.display_name}'s card`
            : `Show details for ${member.display_name}`
        }
      >
        <div className="member-profile-inner">
          <div className="member-profile-front">
            <div className="member-portrait-frame">
              <img
                src={portraitUrl}
                alt={`${member.display_name} portrait`}
                className={hasPortrait ? "member-portrait-image" : "member-portrait-placeholder"}
              />
            </div>

            <div className="member-profile-main">
              <div className="member-profile-tags">
                <span className="tag">{member.role}</span>
                {member.is_current_fc_member && member.fc_rank_name ? <span className="tag">FC Rank: {member.fc_rank_name}</span> : null}
                {member.linked_to_character_name ? <span className="tag">Linked to {member.linked_to_character_name}</span> : null}
                {member.linked_characters.length > 0 ? <span className="tag">Linked characters ({member.linked_characters.length}) · view</span> : null}
              </div>
              <h3>{member.display_name}</h3>
              <p>{member.world}</p>

               {member.rename_history.length > 0 ? (
                 <span className="member-rename-badge">
                   Formerly {member.rename_history[member.rename_history.length - 1].old_name}
                 </span>
               ) : null}

              <div className="member-date-line">
                <span>{joinLabel}</span>
                <strong>{formatShortDate(joinDate)}</strong>
              </div>


              <div className="member-mini-progress">
                <div>
                  <span>Mounts</span>
                  <strong>
                    {member.owned_mounts}/{member.total_mounts}
                  </strong>
                </div>

                <div className="member-progress-bar">
                  <span style={{ width: `${Math.min(member.collection_rate, 100)}%` }} />
                </div>

                <small>{member.collection_rate}% collected</small>
              </div>

              <small className="member-card-hint">Click card for details</small>
            </div>
          </div>

          <div className="member-profile-back">
            <div>
              <span className="tag">Details</span>
              <h3>{member.display_name}</h3>
              <p>{member.character_name} · {member.world}</p>
              {member.linked_to_character_name ? <p><strong>Linked to:</strong> {member.linked_to_character_name}</p> : null}
              {member.linked_characters.length > 0 ? <div className="member-rename-history"><h4>Linked characters ({member.linked_characters.length})</h4><ul>{member.linked_characters.map((linked) => <li key={linked.id}><strong>{linked.character_name}</strong><small>{linked.world}</small></li>)}</ul></div> : null}

               {member.rename_history.length > 0 ? (
                 <div className="member-rename-history">
                   <h4>Name History</h4>
                   <ul>
                     {member.rename_history.map((rename) => (
                       <li key={rename.id}>
                         <strong>{rename.old_name}</strong> → <strong>{rename.new_name}</strong>
                         <small>{formatShortDate(rename.detected_at)}</small>
                       </li>
                     ))}
                   </ul>
                 </div>
               ) : null}
            </div>

            <dl className="member-stat-list">
              <div>
                <dt>Role</dt>
                <dd>{member.role}</dd>
              </div>

              {member.is_current_fc_member ? <div>
                <dt>FC rank</dt>
                <dd>{member.fc_rank_name || "Not recorded"}</dd>
              </div> : <div><dt>FC membership</dt><dd>Not in FC roster — linked character</dd></div>}

              {member.is_current_fc_member ? <div>
                <dt>Rank since</dt>
                <dd>{formatRankChangeAge(member.fc_rank_changed_at)}</dd>
              </div> : null}

              {member.is_current_fc_member && previousRankLabel ? (
                <div>
                  <dt>Previous rank</dt>
                  <dd>{previousRankLabel.replace("Previous: ", "")}</dd>
                </div>
              ) : null}

              <div>
                <dt>Sync</dt>
                <dd>{member.sync_status}</dd>
              </div>

              <div>
                <dt>{joinLabel}</dt>
                <dd>{formatShortDate(joinDate)}</dd>
              </div>

              <div>
                <dt>Last seen in FC</dt>
                <dd>{formatShortDate(member.last_seen_in_fc_at)}</dd>
              </div>

              <div>
                <dt>Last mount sync</dt>
                <dd>{formatShortDate(member.last_mount_sync_at)}</dd>
              </div>

              <div>
                <dt>Owned mounts</dt>
                <dd>
                  {member.owned_mounts}/{member.total_mounts}
                </dd>
              </div>

              <div>
                <dt>Missing mounts</dt>
                <dd>{member.missing_mounts}</dd>
              </div>
            </dl>

            <div className="member-card-actions" onClick={(event) => event.stopPropagation()}>
              <a
                className="ghost-button"
                href={`/?view=mounts&detailCharacterId=${member.id}#mounts`}
              >
                View Mounts
              </a>

              <a
                className="ghost-button"
                href={`/?view=mounts&partyCharacterId=${member.id}#party-planner`}
              >
                Plan Party
              </a>
            </div>

            <small className="member-card-hint">Click card to flip back</small>
          </div>
        </div>
      </button>
    </article>
  );
}
