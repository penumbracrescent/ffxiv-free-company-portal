import { NextResponse } from "next/server";
import { discoverDiscordSetup } from "../../../../lib/discord-setup";
import { isValidSetupToken } from "../../../../lib/setup-security";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!isValidSetupToken(body.setupToken)) return NextResponse.json({ error: "The setup session is invalid or expired." }, { status: 403 });
    const discovery = await discoverDiscordSetup(body.botToken, body.guildId);
    return NextResponse.json(discovery);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Discord validation failed." }, { status: 400 });
  }
}
