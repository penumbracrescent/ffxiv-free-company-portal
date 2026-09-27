import { Pool } from "pg";
import { NextResponse } from "next/server";
import { auth } from "../../../../auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

function getGroups(session: any): string[] {
  const candidates = [session?.user?.groups, session?.groups, session?.user?.attributes?.groups];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.map((value) => String(value));
    if (typeof candidate === "string") return candidate.split(/[,;]/).map((value) => value.trim()).filter(Boolean);
  }
  return [];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const imageId = Number(id);
  if (!Number.isFinite(imageId) || imageId <= 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  const session = await auth();
  const groups = getGroups(session);
  const isOfficer = groups.includes("Admins") || groups.includes("Guild Officers");
  const discordUserId = String((session as any)?.user?.discordUserId ?? "").trim();
  let canAccessMemberArtwork = isOfficer;
  if (!canAccessMemberArtwork && discordUserId) {
    const memberAccess = await pool.query(
      `select 1
       from portal_discord_links dl
       join portal_characters c on c.id = dl.character_id
       where dl.discord_user_id = $1
         and c.active = true
         and c.fc_membership_status = 'current'
         and exists(select 1 from portal_fc_verification verification where verification.id=1 and verification.status='verified')
       limit 1;`,
      [discordUserId]
    ).catch(() => null);
    canAccessMemberArtwork = Boolean(memberAccess?.rows[0]);
  }

  const result = await pool.query(
    `
      select
        i.image_data,
        i.mime_type,
        p.review_status,
        p.category,
        coalesce(mp.artwork_public_enabled, false) as artwork_public_enabled
      from portal_community_gallery_images i
      join portal_community_gallery_posts p on p.id = i.post_id
      left join portal_member_preferences mp on mp.discord_user_id = p.discord_user_id
      where i.id = $1
        and (
          $2::boolean
          or (
            p.review_status = 'approved'
            and (p.category <> 'artwork' or $3::boolean or coalesce(mp.artwork_public_enabled, false))
          )
        )
      limit 1;
    `,
    [imageId, isOfficer, canAccessMemberArtwork]
  );
  const image = result.rows[0];

  if (!image) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(image.image_data, {
    headers: {
      "Content-Type": String(image.mime_type),
      "Cache-Control": image.review_status === "approved" && (image.category !== "artwork" || image.artwork_public_enabled === true) ? "public, max-age=3600, stale-while-revalidate=86400" : "private, no-store"
    }
  });
}
