const envText = (name, fallback = "") => String(process.env[name] || fallback).trim();

export const GUILD_NAME = envText("PORTAL_NAME", "Free Company");
export const PORTAL_URL = envText("PORTAL_URL", "http://localhost:9030/");

const requestedCommandName = envText("DISCORD_COMMAND_NAME", "fc").toLowerCase();
export const DISCORD_COMMAND_NAME = /^[a-z0-9_-]{1,32}$/.test(requestedCommandName)
  ? requestedCommandName
  : "fc";

const requestedColor = envText("PORTAL_ACCENT_COLOR", "#9333ea").replace(/^#/, "");
export const PORTAL_ACCENT_COLOR = /^[0-9a-f]{6}$/i.test(requestedColor)
  ? Number.parseInt(requestedColor, 16)
  : 0x9333ea;
