import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const baseUrl = process.env.ANIME_SCHEDULE_URL || "http://cotf-anime-schedule:8080";
  const target = new URL("/api/releases", baseUrl);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));
  try {
    const response = await fetch(target, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error("[cotf-portal] Anime schedule service unavailable:", error);
    return NextResponse.json({ error: "The anime calendar is temporarily unavailable." }, { status: 503 });
  }
}