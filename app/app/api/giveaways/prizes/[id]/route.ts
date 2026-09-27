import { Client } from "pg";
import { auth } from "../../../../../auth";

export const dynamic = "force-dynamic";

type Session = { user?: { groups?: string[] } } | null;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const giveawayId = Number((await params).id);
  if (!Number.isFinite(giveawayId) || giveawayId <= 0) return new Response("Not found", { status: 404 });
  const session = await auth() as Session;
  const isOfficer = (session?.user?.groups || []).some(group => ["admins", "guild officers"].includes(String(group).toLowerCase()));
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(
      "select p.image_mime_type, p.image_data, g.is_test from portal_giveaway_prizes p join portal_giveaways g on g.id=p.giveaway_id where p.giveaway_id=$1 and p.image_data is not null and coalesce(g.delete_pending,false)=false order by p.id limit 1;",
      [giveawayId]
    );
    const row = result.rows[0];
    if (!row || (row.is_test && !isOfficer)) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(row.image_data), {
      headers: {
        "Content-Type": row.image_mime_type || "application/octet-stream",
        "Cache-Control": "private, max-age=300"
      }
    });
  } finally {
    await client.end();
  }
}