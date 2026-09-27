import { Client } from "pg";
import { auth } from "../../../../../auth";

export const dynamic = "force-dynamic";

type Session = { user?: { groups?: string[]; discordUserId?: string | null } } | null;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isFinite(id) || id <= 0) return new Response("Not found", { status: 404 });
  const session = await auth() as Session;
  const discordUserId = String(session?.user?.discordUserId || "").trim();
  const isOfficer = (session?.user?.groups || []).some(group => ["admins", "guild officers"].includes(String(group).toLowerCase()));
  if (!discordUserId && !isOfficer) return new Response("Sign in required", { status: 401 });
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const access = await client.query(
      `select i.mime_type, i.image_data,
         exists(select 1 from portal_discord_links dl join portal_characters c on c.id=dl.character_id join portal_discord_member_snapshots dms on dms.discord_user_id=dl.discord_user_id where dl.discord_user_id=$2 and c.active=true and c.fc_membership_status='current' and dms.present_in_guild=true and exists(select 1 from portal_fc_verification verification where verification.id=1 and verification.status='verified')) as eligible
       from portal_giveaway_submission_images i
       join portal_giveaway_submissions s on s.id=i.submission_id
       join portal_giveaways g on g.id=s.giveaway_id
       where i.id=$1 and (g.is_test=false or $3::boolean)
       limit 1;`,
      [id, discordUserId, isOfficer]
    );
    const row = access.rows[0];
    if (!row) return new Response("Not found", { status: 404 });
    if (!isOfficer && !row.eligible) return new Response("Member access required", { status: 403 });
    return new Response(new Uint8Array(row.image_data), { headers: { "Content-Type": row.mime_type, "Cache-Control": "private, max-age=300" } });
  } finally { await client.end(); }
}

