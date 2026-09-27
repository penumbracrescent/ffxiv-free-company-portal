import { NextResponse } from "next/server";
import { isValidSetupToken } from "../../../../lib/setup-security";

export const runtime = "nodejs";

const LODESTONE_WORLD_STATUS_URL = "https://na.finalfantasyxiv.com/lodestone/worldstatus/";

function parseWorlds(html: string) {
  const result: Record<string, string[]> = {};
  const dataCenterPattern = /<h2\s+class="world-dcgroup__header">\s*([^<]+?)\s*<\/h2>\s*<ul>([\s\S]*?)<\/ul>/gi;
  for (const match of html.matchAll(dataCenterPattern)) {
    const dataCenter = match[1].trim();
    const worlds = [...match[2].matchAll(/world-list__world_name">[\s\S]*?<p>\s*([^<]+?)\s*<\/p>/gi)].map((world) => world[1].trim());
    if (dataCenter && worlds.length) result[dataCenter] = worlds;
  }
  if (Object.keys(result).length < 4) throw new Error("The Lodestone response did not contain a complete world list.");
  return result;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!isValidSetupToken(String(body.setupToken || ""))) return NextResponse.json({ error: "The setup session is invalid or expired." }, { status: 403 });
    const response = await fetch(LODESTONE_WORLD_STATUS_URL, {
      cache: "no-store",
      headers: { "user-agent": "FFXIV-Free-Company-Portal-Setup/1.0" },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`The Lodestone returned HTTP ${response.status}.`);
    const worlds = parseWorlds(await response.text());
    return NextResponse.json({ worlds, source: LODESTONE_WORLD_STATUS_URL, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The official world list could not be loaded." }, { status: 502 });
  }
}
