import type { Client } from "pg";

export type PortalBackupJob = {
  id: number;
  status: "pending" | "running" | "completed" | "failed";
  requestedBy: string;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  archiveName: string | null;
  archiveSizeBytes: number | null;
  errorText: string | null;
};

export async function ensureBackupJobsTable(client: Client) {
  await client.query(`
    create table if not exists portal_backup_jobs (
      id bigserial primary key,
      status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
      requested_by text not null,
      requested_at timestamptz not null default now(),
      started_at timestamptz,
      completed_at timestamptz,
      archive_name text,
      archive_size_bytes bigint,
      error_text text
    );
    create unique index if not exists portal_backup_jobs_active_unique
      on portal_backup_jobs ((true)) where status in ('pending', 'running');
    create index if not exists portal_backup_jobs_requested_idx
      on portal_backup_jobs (requested_at desc);
  `);
}

export async function requestPortalBackup(client: Client, requestedBy: string) {
  await ensureBackupJobsTable(client);
  const active = await client.query(`select id from portal_backup_jobs where status in ('pending', 'running') limit 1;`);
  if (active.rows.length) throw new Error("A backup is already pending or running.");
  await client.query(
    `insert into portal_backup_jobs (requested_by) values ($1);`,
    [requestedBy.trim() || "Portal administrator"]
  );
}

export async function getPortalBackupJobs(client: Client, limit = 12): Promise<PortalBackupJob[]> {
  await ensureBackupJobsTable(client);
  const result = await client.query(
    `select id::int, status, requested_by, requested_at, started_at, completed_at,
            archive_name, archive_size_bytes::bigint, error_text
       from portal_backup_jobs
      order by requested_at desc, id desc
      limit $1;`,
    [Math.max(1, Math.min(50, limit))]
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    status: row.status,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    archiveName: row.archive_name,
    archiveSizeBytes: row.archive_size_bytes === null ? null : Number(row.archive_size_bytes),
    errorText: row.error_text
  }));
}

export async function clearPortalBackupHistory(client: Client) {
  await ensureBackupJobsTable(client);
  const result = await client.query(
    `delete from portal_backup_jobs where status in ('completed', 'failed') returning id;`
  );
  return result.rowCount || 0;
}
