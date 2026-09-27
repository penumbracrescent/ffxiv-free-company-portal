import { Client, type PoolClient } from "pg";
import { createHmac } from "node:crypto";

export type PrivacySettings = {
  operatorName: string; privacyContact: string; operatorRegion: string;
  formerMemberRetentionDays: number; activityRetentionDays: number; backupRetentionDays: number;
  additionalNotice: string; effectiveAt: string; updatedAt: string;
};
type Queryable = Pick<Client | PoolClient, "query">;
const days = (value: unknown, fallback: number, minimum = 1, maximum = 3650) => { const parsed = Number(value); return Number.isInteger(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback; };
export const defaultPrivacySettings = (): PrivacySettings => ({
  operatorName: String(process.env.PORTAL_OPERATOR_NAME || process.env.PORTAL_NAME || "Portal operator").trim(),
  privacyContact: String(process.env.PORTAL_PRIVACY_CONTACT || "").trim(), operatorRegion: String(process.env.PORTAL_OPERATOR_REGION || "").trim(),
  formerMemberRetentionDays: days(process.env.PORTAL_FORMER_MEMBER_RETENTION_DAYS, 30), activityRetentionDays: days(process.env.PORTAL_ACTIVITY_RETENTION_DAYS, 365), backupRetentionDays: days(process.env.PORTAL_BACKUP_RETENTION_DAYS, 90),
  additionalNotice: String(process.env.PORTAL_PRIVACY_ADDITIONAL_NOTICE || "").trim(), effectiveAt: new Date().toISOString(), updatedAt: new Date().toISOString()
});
export function validatePrivacyContact(value: string) { const contact=value.trim(); if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return contact; try { const parsed=new URL(contact); if(parsed.protocol==="https:") return parsed.toString(); } catch {} throw new Error("Enter a public privacy contact email address or an HTTPS contact page URL."); }
export async function ensurePrivacyTables(client: Queryable) {
  await client.query(`create table if not exists portal_privacy_settings (id integer primary key check(id=1),operator_name text not null,privacy_contact text not null,operator_region text not null default '',former_member_retention_days integer not null default 30 check(former_member_retention_days between 1 and 3650),activity_retention_days integer not null default 365 check(activity_retention_days between 1 and 3650),backup_retention_days integer not null default 90 check(backup_retention_days between 1 and 3650),additional_notice text not null default '',effective_at timestamptz not null default now(),updated_at timestamptz not null default now());
    create table if not exists portal_privacy_requests (id bigserial primary key,subject_discord_user_id text,subject_character_id bigint,subject_label text not null default '',request_type text not null check(request_type in ('access','erasure')),status text not null default 'received' check(status in ('received','completed','rejected','failed')),requested_by text not null,request_note text not null default '',result_summary jsonb not null default '{}'::jsonb,requested_at timestamptz not null default now(),completed_at timestamptz);
    alter table portal_privacy_requests alter column subject_discord_user_id drop not null;
    alter table portal_privacy_requests add column if not exists subject_fingerprint text;
    create table if not exists portal_privacy_suppressions (
      id bigserial primary key,
      discord_fingerprint text not null unique,
      lodestone_fingerprint text,
      status text not null default 'active' check(status in ('active','opted_back_in')),
      requested_by_kind text not null default 'member',
      policy_version text not null default '2026-09-06',
      requested_at timestamptz not null default now(),
      opted_back_in_at timestamptz
    );
    alter table portal_privacy_suppressions drop constraint if exists portal_privacy_suppressions_lodestone_fingerprint_key;
    create table if not exists portal_privacy_suppressed_characters(discord_fingerprint text not null,lodestone_fingerprint text not null,created_at timestamptz not null default now(),primary key(discord_fingerprint,lodestone_fingerprint));
    create index if not exists portal_privacy_suppressions_lodestone_idx on portal_privacy_suppressions(lodestone_fingerprint) where status='active';
    do $$ begin
      if to_regclass('public.portal_discord_links') is not null then alter table portal_discord_links add column if not exists privacy_mode text not null default 'full'; end if;
      if to_regclass('public.portal_characters') is not null then alter table portal_characters add column if not exists privacy_suppressed boolean not null default false; end if;
    end $$;`);
  const d=defaultPrivacySettings();
  await client.query(`insert into portal_privacy_settings(id,operator_name,privacy_contact,operator_region,former_member_retention_days,activity_retention_days,backup_retention_days,additional_notice) values(1,$1,$2,$3,$4,$5,$6,$7) on conflict(id) do nothing`,[d.operatorName,d.privacyContact,d.operatorRegion,d.formerMemberRetentionDays,d.activityRetentionDays,d.backupRetentionDays,d.additionalNotice]);
}

function suppressionSecret() {
  const secret=String(process.env.PRIVACY_SUPPRESSION_SECRET || process.env.AUTH_SECRET || "").trim();
  if(!secret) throw new Error("A privacy suppression secret is required for durable privacy suppression.");
  return secret;
}
export function privacyFingerprint(kind:"discord"|"lodestone",value:string){return createHmac("sha256",suppressionSecret()).update(`${kind}:${String(value).trim()}`).digest("hex");}
export async function isPrivacySuppressed(client:Queryable,discordUserId:string){await ensurePrivacyTables(client);const fingerprint=privacyFingerprint("discord",discordUserId);return Boolean((await client.query(`select 1 from portal_privacy_suppressions where discord_fingerprint=$1 and status='active' limit 1`,[fingerprint])).rows.length);}
export async function getPrivacySettings(client?: Queryable): Promise<PrivacySettings> { let owned:Client|null=null; try { const db=client||(owned=new Client({connectionString:process.env.DATABASE_URL})); if(owned) await owned.connect(); await ensurePrivacyTables(db); const row=(await db.query(`select * from portal_privacy_settings where id=1`)).rows[0]; return {operatorName:row.operator_name,privacyContact:row.privacy_contact,operatorRegion:row.operator_region,formerMemberRetentionDays:Number(row.former_member_retention_days),activityRetentionDays:Number(row.activity_retention_days),backupRetentionDays:Number(row.backup_retention_days),additionalNotice:row.additional_notice,effectiveAt:new Date(row.effective_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString()}; } catch { return defaultPrivacySettings(); } finally { if(owned) await owned.end().catch(()=>undefined); } }
export async function savePrivacySettings(client: Queryable,input:Omit<PrivacySettings,"effectiveAt"|"updatedAt">) { await ensurePrivacyTables(client); await client.query(`insert into portal_privacy_settings(id,operator_name,privacy_contact,operator_region,former_member_retention_days,activity_retention_days,backup_retention_days,additional_notice) values(1,$1,$2,$3,$4,$5,$6,$7) on conflict(id) do update set operator_name=excluded.operator_name,privacy_contact=excluded.privacy_contact,operator_region=excluded.operator_region,former_member_retention_days=excluded.former_member_retention_days,activity_retention_days=excluded.activity_retention_days,backup_retention_days=excluded.backup_retention_days,additional_notice=excluded.additional_notice,updated_at=now()`,[input.operatorName.trim(),validatePrivacyContact(input.privacyContact),input.operatorRegion.trim(),days(input.formerMemberRetentionDays,30),days(input.activityRetentionDays,365),days(input.backupRetentionDays,90),input.additionalNotice.trim()]); }
export function privacyContactHref(contact:string){return contact.startsWith("https://")?contact:contact?`mailto:${contact}`:"";}
