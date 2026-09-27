"use client";

import { useActionState, useEffect, useState } from "react";

export type DiscordLinkAssignmentState = {
  status: "idle" | "success" | "conflict" | "error";
  message: string;
  conflict?: {
    characterName: string;
    targetCharacterId: number;
    existingDiscordUserId: string;
    existingDiscordName: string;
    requestedDiscordUserId: string;
    requestedDiscordName: string;
  };
};

type SelectOption = {
  value: string;
  label: string;
};

type Props = {
  action: (
    previousState: DiscordLinkAssignmentState,
    formData: FormData
  ) => Promise<DiscordLinkAssignmentState>;
  mode: "bind" | "reassign";
  discordUserId?: string;
  discordOptions?: SelectOption[];
  characterOptions: SelectOption[];
};

const initialState: DiscordLinkAssignmentState = {
  status: "idle",
  message: ""
};

export default function DiscordLinkAssignmentForm({
  action,
  mode,
  discordUserId,
  discordOptions = [],
  characterOptions
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [conflictDismissed, setConflictDismissed] = useState(false);

  useEffect(() => {
    setConflictDismissed(false);
  }, [state]);

  const isReassign = mode === "reassign";
  const conflict = state.status === "conflict" ? state.conflict : undefined;

  return (
    <>
      <form action={formAction}>
        {isReassign ? (
          <label>
            <span>Verified Discord member</span>
            <select name="discordUserId" required defaultValue="">
              <option value="" disabled>Choose a linked Discord member</option>
              {discordOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="discordUserId" value={discordUserId} />
        )}

        <label>
          <span>{isReassign ? "Move link to current FC character" : "Bind current FC character"}</span>
          <select name={isReassign ? "targetCharacterId" : "characterId"} required defaultValue="">
            <option value="" disabled>
              {isReassign ? "Choose a current FC character" : "Choose the member's character"}
            </option>
            {characterOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <button className="button primary" type="submit" disabled={pending}>
          {pending
            ? "Checking..."
            : isReassign
              ? "Reassign Verified Link"
              : "Save Character Link"}
        </button>
      </form>

      {state.status === "error" ? (
        <p className="discord-link-form-message error" role="alert">{state.message}</p>
      ) : null}
      {state.status === "success" ? (
        <p className="discord-link-form-message success" role="status">{state.message}</p>
      ) : null}

      {conflict && !conflictDismissed ? (
        <div className="discord-link-conflict-backdrop" role="presentation">
          <section
            className="discord-link-conflict-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discord-link-conflict-title"
          >
            <span className="tag danger">Character link conflict</span>
            <h3 id="discord-link-conflict-title">This character already belongs to another Discord ID</h3>
            <p>
              <strong>{conflict.characterName}</strong> is currently linked to{" "}
              <strong>{conflict.existingDiscordName}</strong> (Discord ID{" "}
              <code>{conflict.existingDiscordUserId}</code>), but you attempted to assign it
              to <strong>{conflict.requestedDiscordName}</strong> (Discord ID{" "}
              <code>{conflict.requestedDiscordUserId}</code>).
            </p>
            <p>
              You can exit and choose a different character, use the reassignment controls,
              or clear the old portal link and assign this character to the new Discord ID.
              Clearing the link does not remove either Discord member or change their roles.
            </p>
            <div className="discord-link-conflict-actions">
              <button
                className="ghost-button"
                type="button"
                onClick={() => setConflictDismissed(true)}
              >
                Exit
              </button>
              <form action={formAction}>
                <input type="hidden" name="discordUserId" value={conflict.requestedDiscordUserId} />
                <input
                  type="hidden"
                  name={isReassign ? "targetCharacterId" : "characterId"}
                  value={conflict.targetCharacterId}
                />
                <input type="hidden" name="resolveConflict" value="clear_and_assign" />
                <input type="hidden" name="expectedConflictDiscordUserId" value={conflict.existingDiscordUserId} />
                <button className="button danger" type="submit" disabled={pending}>
                  {pending ? "Reassigning..." : "Clear Old Link and Assign"}
                </button>
              </form>
              <form action={formAction}>
                <input type="hidden" name="discordUserId" value={conflict.requestedDiscordUserId} />
                <input
                  type="hidden"
                  name={isReassign ? "targetCharacterId" : "characterId"}
                  value={conflict.targetCharacterId}
                />
                <input type="hidden" name="resolveConflict" value="clear_and_assign" />
                <input type="hidden" name="transferVerifiedRole" value="true" />
                <input type="hidden" name="expectedConflictDiscordUserId" value={conflict.existingDiscordUserId} />
                <button className="button primary" type="submit" disabled={pending}>
                  {pending ? "Queueing Transfer..." : "Replace Link + Transfer Verified Role"}
                </button>
              </form>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
