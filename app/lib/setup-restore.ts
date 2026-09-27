import { existsSync, readFileSync } from "node:fs";
import { open, readFile, unlink } from "node:fs/promises";

export const restoreDirectory = "/setup-output";
export function restoredSetupValues(): Record<string, string> {
  if (!existsSync(`${restoreDirectory}/restore-applied.json`) || !existsSync(`${restoreDirectory}/restored-env.json`)) return {};
  return JSON.parse(readFileSync(`${restoreDirectory}/restored-env.json`, "utf8"));
}
export async function restoreState() {
  try { return JSON.parse(await readFile(`${restoreDirectory}/restore-status.json`, "utf8")); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { phase: "idle", message: "Choose a backup to restore." };
    throw error;
  }
}
export async function lockSetupOperation() {
  const path = `${restoreDirectory}/restore-operation.lock`;
  const handle = await open(path, "wx", 0o600);
  await handle.close();
  return () => unlink(path).catch(() => undefined);
}
export function restoreAllowed() {
  return existsSync(`${restoreDirectory}/bootstrap.json`)
    && !existsSync(`${restoreDirectory}/installation.json`)
    && !existsSync(`${restoreDirectory}/setup-sealed.json`)
    && !existsSync(`${restoreDirectory}/restore-applied.json`);
}
