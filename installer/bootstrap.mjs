import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.env.INSTALL_ROOT || "/install";
const envPath = join(root, ".env");
const stateDirectory = join(root, "data", "setup");
const brandingDirectory = join(root, "data", "branding");
const animeDirectory = join(root, "data", "anime");
const statePath = join(stateDirectory, "bootstrap.json");
const tokenPath = join(root, "SETUP_TOKEN.txt");
const secret = (bytes = 32) => randomBytes(bytes).toString("hex");
const quote = (value) => `'${String(value).replaceAll("'", "")}'`;

await mkdir(stateDirectory, { recursive: true, mode: 0o777 });
await mkdir(brandingDirectory, { recursive: true, mode: 0o777 });
await mkdir(animeDirectory, { recursive: true, mode: 0o777 });
await chmod(stateDirectory, 0o777);
await chmod(brandingDirectory, 0o777);
await chmod(animeDirectory, 0o777);

if (existsSync(envPath)) {
  const current = await readFile(envPath, "utf8");
  if (/^SETUP_COMPLETE='?true'?$/m.test(current)) {
    console.log(JSON.stringify({ complete: true }));
    process.exit(0);
  }
  if (existsSync(statePath)) {
    console.log(JSON.stringify(JSON.parse(await readFile(statePath, "utf8"))));
    process.exit(0);
  }
  throw new Error("An unfinished .env exists without setup state. Move it aside and run setup again.");
}

const token = secret(32);
const port = String(process.env.PORTAL_PORT || "9030");
const values = {
  PORTAL_PORT: port,
  PORTAL_NAME: "Free Company Portal",
  PORTAL_SUBTITLE: "Free Company Portal",
  PORTAL_URL: `http://localhost:${port}/`,
  PORTAL_LOGO_URL: "/branding/default-logo.svg",
  PORTAL_BANNER_URL: "/branding/default-banner.svg",
  PORTAL_BACKGROUND_COLOR: "#05000c",
  PORTAL_ACCENT_COLOR: "#9333ea",
  PORTAL_TILE_COLOR: "#120423",
  POSTGRES_DB: "fc_portal",
  POSTGRES_USER: "fc_portal",
  POSTGRES_PASSWORD: secret(32),
  DOCKER_DNS_PRIMARY: "8.8.8.8",
  DOCKER_DNS_SECONDARY: "8.8.4.4",
  AUTH_SECRET: secret(32),
  PRIVACY_SUPPRESSION_SECRET: secret(32),
  ANIME_SERVICE_API_TOKEN: secret(32),
  AUTH_URL: `http://localhost:${port}/`,
  AUTH_TRUST_HOST: "true",
  AUTH_PROVIDER: "discord",
  AUTH_DISCORD_ID: "",
  AUTH_DISCORD_SECRET: "",
  AUTH_AUTHENTIK_ID: "",
  AUTH_AUTHENTIK_SECRET: "",
  AUTH_AUTHENTIK_ISSUER: "",
  PORTAL_ADMIN_DISCORD_IDS: "",
  SETUP_MODE: "true",
  SETUP_COMPLETE: "false",
  SETUP_TOKEN: token
};
await writeFile(envPath, Object.entries(values).map(([key, value]) => `${key}=${quote(value)}`).join("\n") + "\n", { mode: 0o600 });
const state = { complete: false, token, port, setupUrl: `http://localhost:${port}/setup` };
await writeFile(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
await writeFile(tokenPath, token, { mode: 0o600 });
console.log(JSON.stringify(state));
