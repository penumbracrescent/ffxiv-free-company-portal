import { NextResponse } from "next/server";
import { Client } from "pg";
import { auth } from "../../../../auth";
import { ensureCraftingTables } from "../../../../lib/crafting/schema";

const JOBS = ["Carpenter", "Blacksmith", "Armorer", "Goldsmith", "Leatherworker", "Weaver", "Alchemist", "Culinarian"];

async function connection() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await ensureCraftingTables(client);
  return client;
}

async function identity() {
  const session: any = await auth();
  return String(session?.user?.discordUserId || "").trim();
}

function integer(value: unknown, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export async function GET() {
  const discordUserId = await identity();
  if (!discordUserId) return NextResponse.json({ error: "Sign in with Discord first." }, { status: 401 });

  const db = await connection();
  try {
    const rows = await db.query(`select craft_job as job, level::int, craftsmanship::int, control::int, cp::int, specialist,
      preferred_food_item_id::int as "foodId", preferred_food_hq as "foodHq",
      preferred_medicine_item_id::int as "medicineId", preferred_medicine_hq as "medicineHq",
      updated_at as "updatedAt"
      from portal_crafter_profiles where discord_user_id=$1 order by craft_job`, [discordUserId]);
    return NextResponse.json({ profiles: rows.rows }, { headers: { "Cache-Control": "no-store" } });
  } finally {
    await db.end();
  }
}

export async function PUT(request: Request) {
  const discordUserId = await identity();
  if (!discordUserId) return NextResponse.json({ error: "Sign in with Discord first." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const job = String(body.job || "");
  const level = integer(body.level, 1, 100);
  const craftsmanship = integer(body.craftsmanship, 0, 99999);
  const control = integer(body.control, 0, 99999);
  const cp = integer(body.cp, 0, 9999);
  const foodId = integer(body.foodId, 1, 2147483647);
  const medicineId = integer(body.medicineId, 1, 2147483647);

  if (!JOBS.includes(job) || level === null || craftsmanship === null || control === null || cp === null) {
    return NextResponse.json({ error: "Choose a valid job and enter valid stats." }, { status: 400 });
  }

  const db = await connection();
  try {
    const eligible = await db.query(`select 1 from portal_discord_links dl
      join portal_characters c on c.id=dl.character_id
      where dl.discord_user_id=$1 and c.active=true and c.fc_membership_status='current' limit 1`, [discordUserId]);
    if (!eligible.rowCount) {
      return NextResponse.json({ error: "Current verified FC membership is required." }, { status: 403 });
    }

    const requestedIds = [foodId, medicineId].filter((value): value is number => value !== null);
    if (requestedIds.length) {
      const choices = await db.query(`select item_id::int as id, consumable_type from portal_crafting_consumables where item_id = any($1::bigint[])`, [requestedIds]);
      const byId = new Map(choices.rows.map((row) => [Number(row.id), row.consumable_type]));
      if ((foodId !== null && byId.get(foodId) !== "food") || (medicineId !== null && byId.get(medicineId) !== "medicine")) {
        return NextResponse.json({ error: "Choose a valid crafting food and medicine." }, { status: 400 });
      }
    }

    await db.query(`insert into portal_crafter_profiles
      (discord_user_id, craft_job, level, craftsmanship, control, cp, specialist,
       preferred_food_item_id, preferred_food_hq, preferred_medicine_item_id, preferred_medicine_hq, updated_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
      on conflict(discord_user_id,craft_job) do update set
        level=excluded.level, craftsmanship=excluded.craftsmanship, control=excluded.control, cp=excluded.cp,
        specialist=excluded.specialist, preferred_food_item_id=excluded.preferred_food_item_id,
        preferred_food_hq=excluded.preferred_food_hq, preferred_medicine_item_id=excluded.preferred_medicine_item_id,
        preferred_medicine_hq=excluded.preferred_medicine_hq, updated_at=now()`,
      [discordUserId, job, level, craftsmanship, control, cp, Boolean(body.specialist),
       foodId, body.foodHq !== false, medicineId, body.medicineHq !== false]);

    return NextResponse.json({ ok: true });
  } finally {
    await db.end();
  }
}
