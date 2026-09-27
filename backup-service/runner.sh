#!/bin/sh
set -eu

# Restored backup queues must not run before the operator seals setup.
if [ "${SETUP_MODE:-false}" = "true" ]; then
  echo "Setup mode: backup processing paused."
  while :; do sleep 60; done
fi

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR=${BACKUP_DIR:-/backups}
SOURCE_DIR=${SOURCE_DIR:-/source}
mkdir -p "$BACKUP_DIR"

# A restart can happen after the archive was written but before PostgreSQL was
# updated. Wait for the portal schema, then reconcile every orphaned running job
# against the shared backup folder before calling it a failure.
until psql "$DATABASE_URL" -Atq -v ON_ERROR_STOP=1 -c \
  "select id from portal_backup_jobs where status = 'running' order by id;" >/tmp/cotf-orphaned-backup-jobs 2>/dev/null; do
  sleep 5
done

while IFS= read -r orphaned_job_id; do
  [ -n "$orphaned_job_id" ] || continue
  recovered_archive=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "cotf-portal-backup-*-job-$orphaned_job_id.tar.gz" -size +1023c -print 2>/dev/null | sort | tail -n 1)
  if [ -n "$recovered_archive" ]; then
    recovered_name=$(basename "$recovered_archive")
    recovered_size=$(wc -c < "$recovered_archive" | tr -d ' ')
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v job_id="$orphaned_job_id" -v archive_name="$recovered_name" -v archive_size="$recovered_size" >/dev/null <<'SQL'
update portal_backup_jobs
   set status = 'completed', completed_at = now(),
       archive_name = :'archive_name', archive_size_bytes = :'archive_size'::bigint,
       error_text = null
 where id = :'job_id'::bigint and status = 'running';
SQL
  else
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v job_id="$orphaned_job_id" >/dev/null <<'SQL'
update portal_backup_jobs
   set status = 'failed', completed_at = now(),
       error_text = 'The backup helper restarted before this backup completed.'
 where id = :'job_id'::bigint and status = 'running';
SQL
  fi
done </tmp/cotf-orphaned-backup-jobs
rm -f /tmp/cotf-orphaned-backup-jobs

finish_job() {
  job_id=$1
  status=$2
  archive_name=${3:-}
  archive_size=${4:-0}
  error_text=${5:-}
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v job_id="$job_id" -v job_status="$status" \
    -v archive_name="$archive_name" -v archive_size="$archive_size" -v error_text="$error_text" >/dev/null <<'SQL'
update portal_backup_jobs
   set status = :'job_status', completed_at = now(),
       archive_name = nullif(:'archive_name', ''),
       archive_size_bytes = case when :'archive_name' = '' then null else :'archive_size'::bigint end,
       error_text = nullif(:'error_text', '')
 where id = :'job_id'::bigint;
SQL
}

while :; do
  job_id=$(psql "$DATABASE_URL" -Atq -v ON_ERROR_STOP=1 -c \
    "with candidate as (
       select id from portal_backup_jobs where status = 'pending'
       order by requested_at, id for update skip locked limit 1
     )
     update portal_backup_jobs jobs
        set status = 'running', started_at = now(), error_text = null
       from candidate where jobs.id = candidate.id
     returning jobs.id;" 2>/dev/null || true)

  if [ -z "$job_id" ]; then
    sleep 5
    continue
  fi

  stamp=$(date -u +%Y%m%d-%H%M%S)
  archive_name="cotf-portal-backup-$stamp-job-$job_id.tar.gz"
  archive="$BACKUP_DIR/$archive_name"
  stage=$(mktemp -d "/tmp/cotf-backup-$job_id-XXXXXX")
  log_file="/tmp/cotf-backup-$job_id.log"

  if (
    test -f "$SOURCE_DIR/installation.env"
    test -f "$SOURCE_DIR/installation-compose.yaml"
    cp "$SOURCE_DIR/installation.env" "$stage/installation.env"
    cp "$SOURCE_DIR/installation-compose.yaml" "$stage/installation-compose.yaml"
    pg_dump -Fc --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$stage/portal.dump"
    mkdir -p "$stage/data"
    if [ -d "$SOURCE_DIR/data" ]; then cp -a "$SOURCE_DIR/data/." "$stage/data/"; fi
    rm -rf "$stage/data/setup"
    created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    printf '%s\n' "{\"format\":\"cotf-portal-backup\",\"version\":1,\"createdAt\":\"$created_at\",\"database\":\"portal.dump\",\"environment\":\"installation.env\",\"compose\":\"installation-compose.yaml\",\"data\":[\"*\"],\"excluded\":[\"data/setup\",\"backups\"],\"createdBy\":\"portal-backup-service\",\"warning\":\"Contains private credentials and community data. Store securely.\"}" > "$stage/manifest.json"
    tar -czf "$archive" -C "$stage" .
    test "$(wc -c < "$archive")" -ge 1024
  ) >"$log_file" 2>&1; then
    archive_size=$(wc -c < "$archive" | tr -d ' ')
    finish_job "$job_id" completed "$archive_name" "$archive_size" ""
  else
    rm -f "$archive"
    error_text=$(tail -c 1800 "$log_file" | tr '\n\r' '  ')
    finish_job "$job_id" failed "" 0 "${error_text:-Backup creation failed.}"
  fi

  rm -rf "$stage"
  rm -f "$log_file"
done
