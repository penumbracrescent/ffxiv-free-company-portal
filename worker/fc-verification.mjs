import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const VERSION = 1;

function clean(value) {
  return String(value ?? "").trim();
}

export function parseLodestoneFreeCompanyUrl(value) {
  const url = new URL(clean(value));
  const host = url.hostname.toLowerCase();
  if (!(host === "finalfantasyxiv.com" || host.endsWith(".finalfantasyxiv.com")) || url.protocol !== "https:") {
    throw new Error("The Free Company URL must be an official HTTPS Lodestone address.");
  }
  const match = url.pathname.match(/^\/lodestone\/freecompany\/(\d+)(?:\/|$)/);
  if (!match) throw new Error("The Lodestone URL does not contain a numeric Free Company ID.");
  url.pathname = `/lodestone/freecompany/${match[1]}/`;
  url.search = "";
  url.hash = "";
  return { fcId: match[1], lodestoneUrl: url.toString() };
}

function canonical(state) {
  return JSON.stringify({
    version: VERSION,
    fcId: clean(state.fcId),
    lodestoneUrl: clean(state.lodestoneUrl),
    discordGuildId: clean(state.discordGuildId),
    world: clean(state.world),
    datacenter: clean(state.datacenter),
    verificationCode: clean(state.verificationCode),
    status: state.status === "verified" ? "verified" : "pending",
    verifiedAt: state.status === "verified" ? clean(state.verifiedAt) : ""
  });
}

function sign(state, secret) {
  return createHmac("sha256", secret).update(canonical(state)).digest("hex");
}

function validSignature(state, secret) {
  const supplied = Buffer.from(clean(state?.signature), "hex");
  const expected = Buffer.from(sign(state, secret), "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function sameIdentity(left, right) {
  return ["fcId", "lodestoneUrl", "discordGuildId", "world", "datacenter", "verificationCode", "status", "verifiedAt"]
    .every((key) => clean(left?.[key]) === clean(right?.[key]));
}

function challengeCode() {
  return `COTF-${randomBytes(6).toString("hex").toUpperCase()}`;
}

function rowState(row) {
  if (!row) return null;
  return {
    version: VERSION,
    fcId: clean(row.fc_lodestone_id),
    lodestoneUrl: clean(row.lodestone_url),
    discordGuildId: clean(row.discord_guild_id),
    world: clean(row.world),
    datacenter: clean(row.datacenter),
    verificationCode: clean(row.verification_code),
    status: row.status === "verified" ? "verified" : "pending",
    verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : "",
    lastCheckedAt: row.last_checked_at ? new Date(row.last_checked_at).toISOString() : "",
    lastError: clean(row.last_error)
  };
}

async function readSeal(path, secret) {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    return value?.version === VERSION && validSignature(value, secret) ? value : null;
  } catch {
    return null;
  }
}

async function writeSeal(path, state, secret) {
  await mkdir(dirname(path), { recursive: true });
  const sealed = { ...JSON.parse(canonical(state)), signature: sign(state, secret) };
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(sealed, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
  return sealed;
}

async function saveState(client, state) {
  await client.query(`
    insert into portal_fc_verification (
      id, fc_lodestone_id, lodestone_url, discord_guild_id, world, datacenter,
      verification_code, status, verified_at, last_checked_at, last_error, updated_at
    ) values (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
    on conflict (id) do update set
      fc_lodestone_id=excluded.fc_lodestone_id,lodestone_url=excluded.lodestone_url,
      discord_guild_id=excluded.discord_guild_id,world=excluded.world,datacenter=excluded.datacenter,
      verification_code=excluded.verification_code,status=excluded.status,verified_at=excluded.verified_at,
      last_checked_at=excluded.last_checked_at,last_error=excluded.last_error,updated_at=now();
  `, [state.fcId, state.lodestoneUrl, state.discordGuildId, state.world, state.datacenter,
      state.verificationCode, state.status, state.verifiedAt || null, state.lastCheckedAt || null, state.lastError || null]);
}

export async function ensureFcVerificationTable(client) {
  await client.query(`
    create table if not exists portal_fc_verification (
      id integer primary key check(id=1),
      fc_lodestone_id text not null,
      lodestone_url text not null,
      discord_guild_id text not null,
      world text not null,
      datacenter text not null,
      verification_code text not null,
      status text not null default 'pending' check(status in ('pending','verified')),
      verified_at timestamptz,
      last_checked_at timestamptz,
      last_error text,
      updated_at timestamptz not null default now()
    );
  `);
}

export async function ensureFcVerification(client, options) {
  const secret = clean(options.secret);
  const guildId = clean(options.discordGuildId);
  if (!secret) throw new Error("AUTH_SECRET is required to seal Free Company verification.");
  if (!/^\d{15,22}$/.test(guildId)) throw new Error("DISCORD_GUILD_ID is missing or invalid.");
  const configured = parseLodestoneFreeCompanyUrl(options.lodestoneUrl);
  await ensureFcVerificationTable(client);
  const row = (await client.query("select * from portal_fc_verification where id=1")).rows[0];
  const databaseState = rowState(row);
  const fileState = await readSeal(options.sealPath, secret);

  if (fileState && databaseState && sameIdentity(fileState, databaseState)) {
    return databaseState;
  }
  // A completed seal can safely repair the final database write if the process
  // stopped between the two persistence operations, but only for the same target.
  if (fileState?.status === "verified" && databaseState?.status === "pending"
      && ["fcId", "lodestoneUrl", "discordGuildId", "world", "datacenter", "verificationCode"]
        .every((key) => clean(fileState[key]) === clean(databaseState[key]))) {
    await saveState(client, fileState);
    return rowState((await client.query("select * from portal_fc_verification where id=1")).rows[0]);
  }
  if (fileState || databaseState) {
    // A missing/mismatched seal is treated as a fresh or restored installation.
    // The selected setup values become a new pending target; no member endpoint
    // is contacted until its public profile publishes the challenge.
  }
  const pending = {
    version: VERSION,
    fcId: configured.fcId,
    lodestoneUrl: configured.lodestoneUrl,
    discordGuildId: guildId,
    world: clean(options.world),
    datacenter: clean(options.datacenter),
    verificationCode: challengeCode(),
    status: "pending",
    verifiedAt: ""
  };
  await writeSeal(options.sealPath, pending, secret);
  await saveState(client, pending);
  return pending;
}

export async function checkFcVerification(client, options, { force = false } = {}) {
  const state = await ensureFcVerification(client, options);
  if (state.status === "verified") return state;
  const lastCheck = state.lastCheckedAt ? new Date(state.lastCheckedAt).getTime() : 0;
  if (!force && Number.isFinite(lastCheck) && Date.now() - lastCheck < 15 * 60 * 1000) return state;
  const checkedAt = new Date().toISOString();
  try {
    const pages = [
      { label: "Free Company profile", url: state.lodestoneUrl },
      { label: "Free Company forum", url: new URL("forum/", state.lodestoneUrl).toString() }
    ];
    const failures = [];
    let matched = false;
    for (const page of pages) {
      try {
        const response = await fetch(page.url, {
          headers: {
            "User-Agent": "COTF-Portal-FC-Verification/1.0",
            ...(force ? { "Cache-Control": "no-cache", "Pragma": "no-cache" } : {})
          },
          cache: force ? "no-store" : "default",
          signal: AbortSignal.timeout(30000)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if ((await response.text()).includes(state.verificationCode)) {
          matched = true;
          break;
        }
      } catch (error) {
        failures.push(`${page.label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (!matched) {
      const message = failures.length === pages.length
        ? `Lodestone verification pages could not be read. ${failures.join("; ")}`.slice(0, 500)
        : "Verification code is not visible on the Free Company profile or public forum listing yet.";
      await client.query("update portal_fc_verification set last_checked_at=now(),last_error=$1,updated_at=now() where id=1", [message]);
      return { ...state, lastCheckedAt: checkedAt, lastError: message };
    }
    const verified = { ...state, status: "verified", verifiedAt: checkedAt, lastCheckedAt: checkedAt, lastError: "" };
    await writeSeal(options.sealPath, verified, clean(options.secret));
    await saveState(client, verified);
    return verified;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Lodestone verification failed.";
    await client.query("update portal_fc_verification set last_checked_at=now(),last_error=$1,updated_at=now() where id=1", [message]);
    return { ...state, lastCheckedAt: checkedAt, lastError: message };
  }
}

export function buildVerifiedMemberPageUrl(state, pageNumber) {
  if (state?.status !== "verified") throw new Error("Free Company ownership verification is still pending; roster scanning is paused.");
  const url = new URL(state.lodestoneUrl);
  url.pathname = `/lodestone/freecompany/${state.fcId}/member/`;
  url.search = `?page=${pageNumber}`;
  return url.toString();
}
