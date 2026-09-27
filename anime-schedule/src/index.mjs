import { config } from "./config.mjs";
import { closeDatabase } from "./db.mjs";
import { ensureSchema } from "./schema.mjs";
import { createServer } from "./server.mjs";
import { runSync, sourcesDue } from "./sync.mjs";
import { syncGoogleCalendar } from "./google.mjs";

const transientDatabaseCodes = new Set(["57P01", "57P02", "57P03", "ECONNREFUSED", "ECONNRESET", "EAI_AGAIN", "ENOTFOUND", "ETIMEDOUT"]);
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let server;
let shuttingDown = false;

function isTransientDatabaseStartupError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || error || "");
  return transientDatabaseCodes.has(code)
    || /database system is (starting up|shutting down|in recovery mode)|connection (terminated|refused)|timeout expired/i.test(message);
}

async function ensureSchemaWhenDatabaseIsReady() {
  let attempt = 0;
  while (!shuttingDown) {
    try {
      await ensureSchema();
      return;
    } catch (error) {
      if (!isTransientDatabaseStartupError(error)) throw error;
      attempt += 1;
      const waitMilliseconds = Math.min(15000, 1000 * (2 ** Math.min(attempt - 1, 4)));
      const reason = String(error?.message || error || "database unavailable").replace(/\s+/g, " ").trim();
      console.warn(`[anime-schedule] PostgreSQL is not ready (${reason}); retrying in ${waitMilliseconds / 1000}s.`);
      await delay(waitMilliseconds);
    }
  }
}

let schedulerBusy = false;
async function schedulerTick() {
  if (schedulerBusy) return;
  schedulerBusy = true;
  try {
    const due = await sourcesDue(config);
    for (const sourceKey of due) {
      const result = await runSync(config, { sourceKey, dryRun: false, kind: "scheduled" });
      console.log(`[anime-schedule] Scheduled ${sourceKey}:`, JSON.stringify(result.sources?.[0] || result));
    }
    if (due.length && config.googleEnabled) console.log("[anime-schedule] Google Calendar:", JSON.stringify(await syncGoogleCalendar(config)));
  } catch (error) {
    console.error("[anime-schedule] Scheduler error:", error);
  } finally { schedulerBusy = false; }
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[anime-schedule] ${signal}; shutting down.`);
  if (server) await new Promise((resolve) => server.close(resolve));
  await closeDatabase().catch(() => undefined);
  process.exit(0);
}
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

await ensureSchemaWhenDatabaseIsReady();
if (!shuttingDown) {
  server = createServer(config);
  server.listen(config.port, "0.0.0.0", () => console.log(`[anime-schedule] API listening on ${config.port}; timezone ${config.timezone}.`));
  setTimeout(schedulerTick, 5000).unref();
  setInterval(schedulerTick, 60000).unref();
}
