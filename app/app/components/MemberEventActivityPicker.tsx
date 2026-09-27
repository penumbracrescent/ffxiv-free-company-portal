"use client";

import { useMemo, useState } from "react";

type Duty = { id: number; duty_type: string; name: string; level: number | null };
type Mount = { id: number; mount_name: string; source_name: string | null };

type Props = {
  duties: Duty[];
  mounts: Mount[];
  isOfficer: boolean;
};

function defaultChannelFor(type: string) {
  return "event";
}

export default function MemberEventActivityPicker({ duties, mounts, isOfficer }: Props) {
  const [type, setType] = useState("");
  const [dutyId, setDutyId] = useState("");
  const [farm, setFarm] = useState("no");
  const [targetChannelKind, setTargetChannelKind] = useState("event");
  const visible = useMemo(
    () => duties.filter((duty) => !type || duty.duty_type.toLowerCase() === type),
    [duties, type]
  );
  const selected = visible.find((duty) => String(duty.id) === dutyId);
  const matching = useMemo(
    () => selected ? mounts.find((mount) => mount.source_name?.toLowerCase().includes(selected.name.toLowerCase())) : undefined,
    [mounts, selected]
  );
  const showFarm = type === "raid" || type === "trial";
  const defaultChannelKind = defaultChannelFor(type);

  return (
    <div className="member-event-activity-picker">
      <label>
        <span>Activity Type</span>
        <select value={type} onChange={(event) => {
          const nextType = event.target.value;
          setType(nextType);
          setDutyId("");
          setFarm("no");
          setTargetChannelKind(defaultChannelFor(nextType));
        }}>
          <option value="">No duty selected</option>
          <option value="raid">Raid</option>
          <option value="dungeon">Dungeon</option>
          <option value="trial">Trial</option>
        </select>
      </label>
      {type ? (
        <label>
          <span>Which {type}?</span>
          <select name="dutyId" value={dutyId} onChange={(event) => setDutyId(event.target.value)}>
            <option value="">Choose a duty</option>
            {visible.map((duty) => <option key={duty.id} value={duty.id}>{duty.name}{duty.level ? ` (Lv. ${duty.level})` : ""}</option>)}
          </select>
        </label>
      ) : null}
      {showFarm && dutyId ? (
        <label>
          <span>Mount farm?</span>
          <select value={farm} onChange={(event) => setFarm(event.target.value)}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>
      ) : null}
      {farm === "yes" && matching ? <><input type="hidden" name="mountId" value={matching.id} /><p className="member-event-mount-note">Mount target: <strong>{matching.mount_name}</strong></p></> : null}
      {isOfficer ? (
        <label>
          <span>Post To</span>
          <select name="targetChannelKind" value={targetChannelKind} onChange={(event) => setTargetChannelKind(event.target.value)}>
            <option value="event">Party Planner</option>
            <option value="test">Test Channel</option>
          </select>
        </label>
      ) : <input type="hidden" name="targetChannelKind" value={defaultChannelKind} />}
    </div>
  );
}
