import { config } from "./config.mjs";
import { closeDatabase } from "./db.mjs";
import { ensureSchema } from "./schema.mjs";
import { runSync } from "./sync.mjs";

const [, , command, ...args] = process.argv;
if (command !== "sync") throw new Error("Usage: npm run sync -- [--source=name] [--apply]");
const sourceArg = args.find((arg) => arg.startsWith("--source="));
const sourceKey = sourceArg ? sourceArg.slice("--source=".length) : null;
const dryRun = !args.includes("--apply");
await ensureSchema();
try {
  const result = await runSync(config, { sourceKey, dryRun, kind: "cli" });
  console.log(JSON.stringify(result, null, 2));
  if (result.sources?.some((source) => source.status === "failed")) process.exitCode = 1;
} finally { await closeDatabase(); }