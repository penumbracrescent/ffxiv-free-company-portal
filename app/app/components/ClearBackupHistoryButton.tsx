"use client";

import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="danger-button" type="submit" disabled={pending}>{pending ? "Clearing..." : "Clear Backup History"}</button>;
}

export default function ClearBackupHistoryButton({ action, count }: { action: () => Promise<void>; count: number }) {
  if (!count) return null;
  return <form action={action} className="clear-backup-history" onSubmit={(event) => {
    if (!window.confirm(`Remove ${count} completed or failed backup histor${count === 1 ? "y entry" : "y entries"}? Existing archive files will not be deleted.`)) event.preventDefault();
  }}>
    <SubmitButton />
    <small>This only clears the portal history. Backup archive files remain in the backups folder.</small>
  </form>;
}
