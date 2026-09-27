import { NextResponse } from "next/server";
import { Client } from "pg";
import { auth } from "../../auth";

type Window = { startedAt: number; count: number };
const windows = new Map<string, Window>();

export async function guardCraftingRequest(action: string, limit: number, windowMs = 60_000) {
  const session: any = await auth();
  const discordUserId = String(session?.user?.discordUserId || "").trim();
  if (!discordUserId) {
    return { error: NextResponse.json({ error: "Sign in with Discord first." }, { status: 401 }) };
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const eligible = await client.query("select 1 from portal_discord_links dl join portal_characters c on c.id=dl.character_id where dl.discord_user_id=$1 and c.active=true and c.fc_membership_status='current' limit 1", [discordUserId]);
    if (!eligible.rowCount) {
      return { error: NextResponse.json({ error: "Current verified FC membership is required." }, { status: 403 }) };
    }
  } finally {
    await client.end();
  }

  const now = Date.now();
  const key = action + ":" + discordUserId;
  const current = windows.get(key);
  const entry = !current || now - current.startedAt >= windowMs ? { startedAt: now, count: 1 } : { ...current, count: current.count + 1 };
  windows.set(key, entry);

  if (windows.size > 500) {
    for (const [storedKey, value] of windows) if (now - value.startedAt >= windowMs) windows.delete(storedKey);
  }

  if (entry.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - entry.startedAt)) / 1000));
    return { error: NextResponse.json({ error: "Too many crafting requests. Try again shortly." }, { status: 429, headers: { "Retry-After": String(retryAfter) } }) };
  }
  return { discordUserId };
}
