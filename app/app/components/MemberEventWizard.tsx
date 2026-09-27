"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Duty = {
  id: number;
  duty_type: string;
  name: string;
  level: number | null;
  party_size?: number | null;
};

type Mount = {
  id: number;
  mount_name: string;
  source_name: string | null;
};

type Props = {
  duties: Duty[];
  mounts: Mount[];
  isOfficer: boolean;
  eventTimeZone: string;
  createEvent: (formData: FormData) => Promise<void>;
};

type Review = {
  activity: string;
  title: string;
  schedule: string;
  party: string;
  destination: string;
  levelRange: string;
  notes: string;
};

const STEP_LABELS = ["Activity", "Schedule & party", "Details", "Review"];

function defaultPartySize(type: string, duty?: Duty) {
  if (duty?.party_size) return duty.party_size;
  return type === "raid" ? 8 : type === "trial" ? 8 : type === "dungeon" ? 4 : 8;
}

function defaultChannelFor(type: string) {
  return "event";
}

function channelLabel(channel: string) {
  return channel === "test"
    ? "Shared Test Channel"
    : "Party Planner";
}

const EVENT_TIME_ZONE_LABELS: Record<string, string> = {
  "America/St_Johns": "Newfoundland Time",
  "America/Halifax": "Atlantic Time",
  "America/New_York": "Eastern Time",
  "America/Chicago": "Central Time",
  "America/Denver": "Mountain Time",
  "America/Phoenix": "Arizona Time",
  "America/Los_Angeles": "Pacific Time",
  "America/Anchorage": "Alaska Time",
  "Pacific/Honolulu": "Hawaii Time"
};

function eventTimeZoneLabel(timeZone: string) {
  return EVENT_TIME_ZONE_LABELS[timeZone] || timeZone;
}

function formatEnteredDateTime(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) return "Not set";
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  const entered = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeStyle: "short", timeZone: "UTC" }).format(entered);
}

export default function MemberEventWizard({ duties, mounts, isOfficer, eventTimeZone, createEvent }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [activityType, setActivityType] = useState("custom");
  const [customCategory, setCustomCategory] = useState("unclassified");
  const [levelMin, setLevelMin] = useState("");
  const [levelMax, setLevelMax] = useState("");
  const [dutyId, setDutyId] = useState("");
  const [mountFarm, setMountFarm] = useState(false);
  const [targetChannel, setTargetChannel] = useState("event");
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [partySize, setPartySize] = useState("8");
  const [standardRoles, setStandardRoles] = useState(false);
  const [description, setDescription] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [eventPlanId,setEventPlanId]=useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dirtyRef = useRef(false);

  const visibleDuties = useMemo(
    () => activityType === "custom" ? [] : duties.filter((duty) => duty.duty_type.toLowerCase() === activityType),
    [activityType, duties]
  );
  const selectedDuty = useMemo(
    () => visibleDuties.find((duty) => String(duty.id) === dutyId),
    [dutyId, visibleDuties]
  );
  const matchingMount = useMemo(
    () => selectedDuty ? mounts.find((mount) => mount.source_name?.toLowerCase().includes(selectedDuty.name.toLowerCase())) : undefined,
    [mounts, selectedDuty]
  );
  const canBeMountFarm = activityType === "raid" || activityType === "trial";

  useEffect(() => {
    if (!open) return;
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prior; window.removeEventListener("keydown", onKey); };
  }, [open]);

  useEffect(() => {
    const openSuggestedEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ date?: string; time?: string;startsAt?:string;eventPlanId?:number;activityType?:string;dutyId?:number|null;title?:string;description?:string;partySize?:number;standardRoles?:boolean;mountFarm?:boolean }>).detail || {};
      resetWizard();
      let date=String(detail.date||""),time=String(detail.time||"");if(detail.startsAt){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:eventTimeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(detail.startsAt)),map=Object.fromEntries(parts.map(part=>[part.type,part.value]));date=`${map.year}-${map.month}-${map.day}`;time=`${map.hour}:${map.minute}`;}
      const requestedType=String(detail.activityType||"custom");setActivityType(["raid","trial","dungeon","custom"].includes(requestedType)?requestedType:"custom");setDutyId(detail.dutyId?String(detail.dutyId):"");setTitle(String(detail.title||""));setDescription(String(detail.description||""));setPartySize(String(detail.partySize||8));setStandardRoles(Boolean(detail.standardRoles));setMountFarm(Boolean(detail.mountFarm));setEventPlanId(detail.eventPlanId?String(detail.eventPlanId):"");setEventDate(date);setEventTime(time);
      dirtyRef.current = true;
      setOpen(true);
    };
    window.addEventListener("cotf:plan-event", openSuggestedEvent);
    return () => window.removeEventListener("cotf:plan-event", openSuggestedEvent);
  }, []);

  function resetWizard() {
    setStep(1);
    setActivityType("custom");
    setCustomCategory("unclassified");
    setLevelMin("");
    setLevelMax("");
    setDutyId("");
    setMountFarm(false);
    setTargetChannel("event");
    setTitle("");
    setEventDate("");
    setEventTime("");
    setPartySize("8");
    setStandardRoles(false);
    setDescription("");
    setReview(null);
    setSubmitError("");
    setEventPlanId("");
    dirtyRef.current = false;
  }

  function launch() {
    resetWizard();
    setOpen(true);
  }

  function requestClose() {
    if (dirtyRef.current && !window.confirm("Close this setup? Unsaved event details will be lost.")) return;
    setOpen(false);
    resetWizard();
  }

  function markDirty() { dirtyRef.current = true; }

  function validateStep() {
    const section = formRef.current?.querySelector<HTMLElement>(`[data-event-step="${step}"]`);
    const fields = section?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea") || [];
    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        field.focus();
        return false;
      }
    }
    if (step === 1 && activityType !== "custom" && !dutyId) {
      setSubmitError("Choose the duty you are organizing.");
      return false;
    }
    if (step === 1 && activityType === "custom" && Number(levelMax) < Number(levelMin)) {
      setSubmitError("Maximum level must be greater than or equal to minimum level.");
      return false;
    }
    setSubmitError("");
    return true;
  }

  function buildReview() {
    const customCategoryLabel = customCategory === "raid" ? "Raids" : customCategory === "trial" ? "Trials" : customCategory === "treasure_maps" ? "Maps" : customCategory === "dungeon" ? "Dungeons" : "Unclassified";
    const activity = selectedDuty
      ? `${activityType[0].toUpperCase()}${activityType.slice(1)} · ${selectedDuty.name}${mountFarm && matchingMount ? ` · ${matchingMount.mount_name} farm` : ""}`
      : `${customCategoryLabel} · Custom FC event`;
    const dateLabel = formatEnteredDateTime(eventDate, eventTime);
    setReview({
      activity,
      title: title.trim() || "Untitled event",
      schedule: `${dateLabel} (${eventTimeZoneLabel(eventTimeZone)})`,
      party: `${partySize} members · ${standardRoles ? "standard tank, healer, and DPS roles" : "flexible composition"}`,
      destination: channelLabel(targetChannel),
      levelRange: activityType === "custom" ? `Levels ${levelMin}–${levelMax}` : selectedDuty?.level ? `Level ${selectedDuty.level}` : "No level requirement",
      notes: description.trim() || "No additional notes"
    });
  }

  function next() {
    if (!validateStep()) return;
    if (step === 3) buildReview();
    setStep((value) => Math.min(4, value + 1));
  }

  function previous() { setStep((value) => Math.max(1, value - 1)); }

  async function submitEvent(formData: FormData) {
    setSaving(true);
    setSubmitError("");
    try {
      await createEvent(formData);
      dirtyRef.current = false;
      setOpen(false);
      resetWizard();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "The event could not be published.");
    } finally {
      setSaving(false);
    }
  }

  function updateActivity(type: string) {
    setActivityType(type);
    setDutyId("");
    setMountFarm(false);
    setTargetChannel(defaultChannelFor(type));
    setPartySize(defaultPartySize(type).toString());
    markDirty();
  }

  function updateDuty(id: string) {
    setDutyId(id);
    const duty = duties.find((item) => String(item.id) === id);
    if (duty) setPartySize(defaultPartySize(activityType, duty).toString());
    markDirty();
  }

  const eventType = activityType === "custom"
    ? customCategory === "unclassified" ? "custom" : customCategory
    : mountFarm && matchingMount ? "mount_farm" : activityType === "raid" ? "raid" : "custom";

  return <>
    <article className="panel member-event-wizard-launch">
      <div><span className="tag">Member Event</span><h3>Create an FC Event</h3><p>Plan the activity, party, and Discord announcement in a guided setup.</p></div>
      <button type="button" className="button primary" onClick={launch}>Create Event</button>
    </article>

    {open ? <div className="giveaway-wizard-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <section className="giveaway-wizard member-event-wizard" role="dialog" aria-modal="true" aria-labelledby="member-event-wizard-title">
        <header className="giveaway-wizard-header">
          <div><p className="eyebrow">Event Setup · Step {step} of 4</p><h3 id="member-event-wizard-title">Create an FC Event</h3></div>
          <button ref={closeRef} type="button" className="button secondary" onClick={requestClose}>Close</button>
        </header>
        <nav className="giveaway-wizard-progress" aria-label="Event setup progress">
          {STEP_LABELS.map((label, index) => <button key={label} type="button" className={step === index + 1 ? "active" : step > index + 1 ? "complete" : ""} aria-current={step === index + 1 ? "step" : undefined} onClick={() => { if (index + 1 < step) setStep(index + 1); }}><span>{index + 1}</span>{label}</button>)}
        </nav>
        <form ref={formRef} action={submitEvent} className="giveaway-wizard-form" onChange={markDirty}>
          <input type="hidden" name="eventType" value={eventType} />
          <input type="hidden" name="memberCreatedEvent" value="true" />
          <input type="hidden" name="partyStrategy" value="rotation" />
          <input type="hidden" name="targetChannelKind" value={targetChannel} />
          <input type="hidden" name="eventTimeZone" value={eventTimeZone} />
          {eventPlanId?<input type="hidden" name="eventPlanId" value={eventPlanId} />:null}
          {matchingMount && mountFarm ? <input type="hidden" name="mountId" value={matchingMount.id} /> : null}

          <section data-event-step="1" hidden={step !== 1} className="giveaway-wizard-step">
            <div className="giveaway-wizard-intro"><h4>Choose the activity</h4><p>Select a duty when one applies, or create a custom social event.</p></div>
            <div className="event-type-options" role="radiogroup" aria-label="Activity type">
              {[{ value: "custom", label: "Custom", detail: "Social nights and other FC plans" }, { value: "raid", label: "Raid", detail: "Normal, alliance, savage, or ultimate" }, { value: "trial", label: "Trial", detail: "Trials and extreme farms" }, { value: "dungeon", label: "Dungeon", detail: "Light-party and deep-dungeon runs" }].map((option) => <button key={option.value} type="button" role="radio" aria-checked={activityType === option.value} className={activityType === option.value ? "selected" : ""} onClick={() => updateActivity(option.value)}><strong>{option.label}</strong><small>{option.detail}</small></button>)}
            </div>
            <div className="giveaway-wizard-grid">
              {activityType !== "custom" ? <label className="full"><span>Duty</span><select name="dutyId" required value={dutyId} onChange={(event) => updateDuty(event.target.value)}><option value="">Choose a {activityType}</option>{visibleDuties.map((duty) => <option key={duty.id} value={duty.id}>{duty.name}{duty.level ? ` · Level ${duty.level}` : ""}</option>)}</select></label> : <><div className="giveaway-wizard-note full"><strong>Custom event</strong><p>Classify the activity and choose the level range. You can add the event name and full details on the next pages.</p></div><label className="full"><span>Activity category</span><select name="customCategory" value={customCategory} onChange={(event) => setCustomCategory(event.target.value)}><option value="raid">Raids</option><option value="trial">Trials</option><option value="treasure_maps">Maps</option><option value="dungeon">Dungeons</option><option value="unclassified">Unclassified</option></select></label><label><span>Minimum level</span><input name="levelMin" type="number" min="1" max="200" required value={levelMin} onChange={(event) => setLevelMin(event.target.value)} placeholder="1" /></label><label><span>Maximum level</span><input name="levelMax" type="number" min="1" max="200" required value={levelMax} onChange={(event) => setLevelMax(event.target.value)} placeholder="100" /></label></>}
              {canBeMountFarm && dutyId ? <label className="check full"><input type="checkbox" checked={mountFarm} disabled={!matchingMount} onChange={(event) => { setMountFarm(event.target.checked); markDirty(); }} /><span><strong>Track this as a mount farm</strong><small>{matchingMount ? `Matched target: ${matchingMount.mount_name}` : "No tracked mount is matched to this duty."}</small></span></label> : null}
              {isOfficer ? <label><span>Discord destination</span><select value={targetChannel} onChange={(event) => { setTargetChannel(event.target.value); markDirty(); }}><option value="event">Party Planner</option><option value="test">Shared Test Channel</option></select></label> : null}
            </div>
            {submitError ? <p className="giveaway-wizard-error" role="alert">{submitError}</p> : null}
          </section>

          <section data-event-step="2" hidden={step !== 2} className="giveaway-wizard-step">
            <div className="giveaway-wizard-intro"><h4>Schedule and party</h4><p>Set when the event begins and how many members can join each party.</p></div>
            <div className="giveaway-wizard-grid">
              <label className="full"><span>Event title</span><input name="title" required maxLength={150} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What are you organizing?" /></label>
              <div className="giveaway-wizard-note full"><strong>Times will be processed as {eventTimeZoneLabel(eventTimeZone)}</strong><p>Change this under Settings → Notifications and events if it does not match the timezone you intend to use. Discord will display the final event time in each viewer&apos;s own timezone.</p></div>
              <label><span>Date</span><input name="eventDate" type="date" required value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></label>
              <label><span>Time</span><input name="eventTime" type="time" required value={eventTime} onChange={(event) => setEventTime(event.target.value)} /></label>
              <label><span>Party size</span><input name="partySize" type="number" min="1" max="24" required value={partySize} onChange={(event) => setPartySize(event.target.value)} /><small>Members per party; multiple parties can rotate as needed.</small></label>
              <label className="check"><input name="standardPartyRolesRequired" type="checkbox" checked={standardRoles} onChange={(event) => setStandardRoles(event.target.checked)} /><span><strong>Require standard roles</strong><small>Use tank, healer, and DPS composition instead of flexible parties.</small></span></label>
            </div>
          </section>

          <section data-event-step="3" hidden={step !== 3} className="giveaway-wizard-step">
            <div className="giveaway-wizard-intro"><h4>Add helpful details</h4><p>Give members any requirements, goals, or meeting instructions they should know.</p></div>
            <div className="giveaway-wizard-grid">
              <label className="full"><span>Description (optional)</span><textarea name="description" rows={8} maxLength={1500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Strategy, goals, voice chat plans, requirements, or anything members should bring." /><small>{description.length}/1500 characters</small></label>
              <div className="giveaway-wizard-note"><strong>Discord announcement</strong><p>The event will be queued immediately and Discord will show the scheduled event time in each member&apos;s local timezone.</p></div>
            </div>
          </section>

          <section data-event-step="4" hidden={step !== 4} className="giveaway-wizard-step">
            <div className="giveaway-wizard-intro"><h4>Review event</h4><p>Confirm the details before publishing the event and its Discord announcement.</p></div>
            <div className="giveaway-review-card">
              <div><span>Activity</span><strong>{review?.activity}</strong></div>
              <div><span>Title</span><strong>{review?.title}</strong></div>
              <div><span>Schedule</span><strong>{review?.schedule}</strong></div>
              <div><span>Party</span><strong>{review?.party}</strong></div>
              <div><span>Level range</span><strong>{review?.levelRange}</strong></div>
              <div className="full"><span>Discord destination</span><strong>{review?.destination}</strong></div>
              <div className="full"><span>Details</span><strong>{review?.notes}</strong></div>
            </div>
            <div className="giveaway-wizard-note review-note"><strong>Ready to publish</strong><p>This creates the event roster on the site and queues its Discord announcement. You can manage attendance and the party roster from this page afterward.</p></div>
            {submitError ? <p className="giveaway-wizard-error" role="alert">{submitError}</p> : null}
          </section>

          <footer className="giveaway-wizard-footer">
            <button type="button" className="button secondary" onClick={step === 1 ? requestClose : previous}>{step === 1 ? "Cancel" : "Previous"}</button>
            <span>Step {step} of 4</span>
            {step < 4 ? <button type="button" className="button primary" onClick={(event) => { event.preventDefault(); next(); }}>Next</button> : <button type="submit" className="button primary" disabled={saving}>{saving ? "Publishing…" : "Publish Event"}</button>}
          </footer>
        </form>
      </section>
    </div> : null}
  </>;
}
