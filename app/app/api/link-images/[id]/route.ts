import { Pool } from "pg";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const imageId = Number(id);

  if (!Number.isFinite(imageId) || imageId <= 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  const result = await pool.query(
    `
      select image_data, image_mime_type
      from portal_link_cards
      where id = $1
        and archived_at is null
        and image_data is not null
      limit 1;
    `,
    [imageId]
  );
  const image = result.rows[0];

  if (!image?.image_data || !image?.image_mime_type) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(image.image_data, {
    headers: {
      "Content-Type": String(image.image_mime_type),
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400"
    }
  });
}