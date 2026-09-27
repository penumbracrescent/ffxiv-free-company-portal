import { open, rename, stat, unlink, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { isValidSetupToken } from "../../../../lib/setup-security";
import { lockSetupOperation, restoreAllowed, restoreDirectory, restoreState } from "../../../../lib/setup-restore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const maxUpload = 2 * 1024 ** 3;
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (!isValidSetupToken(request.headers.get("x-setup-token"))) return reply({ error: "The setup session is invalid or expired." }, 403);
  let release: (() => Promise<unknown>) | undefined;
  let handedOff = false;
  try {
    const action = new URL(request.url).searchParams.get("action") || "status";
    if (action === "status") {
      const state = await restoreState();
      const heartbeat = await stat(`${restoreDirectory}/restore-heartbeat`).catch(() => null);
      return reply({ ...state, helperOnline: Boolean(heartbeat && Date.now() - heartbeat.mtimeMs < 15000) });
    }
    if (!restoreAllowed()) return reply({ error: "Restore is available only in a fresh installation before setup is saved." }, 409);
    const heartbeat = await stat(`${restoreDirectory}/restore-heartbeat`).catch(() => null);
    if (!heartbeat || Date.now() - heartbeat.mtimeMs > 15000) return reply({ error: "The restore helper is not running. Start or rebuild the project with the restore service included." }, 503);
    release = await lockSetupOperation();
    if (!restoreAllowed()) return reply({ error: "Setup was saved while this request was waiting. Restore is now disabled." }, 409);
    const state = await restoreState();
    if (["validating", "restoring", "queued"].includes(state.phase)) return reply({ error: "A restore operation is already in progress." }, 409);
    let command: Record<string, unknown>;
    if (action === "upload") {
      const length = Number(request.headers.get("content-length") || 0);
      if (length > maxUpload) return reply({ error: "Upload limit is 2 GiB. Use the backups folder for larger archives." }, 413);
      if (!request.body) return reply({ error: "Choose a backup archive." }, 400);
      const temporary = `${restoreDirectory}/restore-upload.part`;
      const handle = await open(temporary, "w", 0o600);
      let size = 0;
      try {
        const reader = request.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > maxUpload) { await reader.cancel(); throw new Error("Upload exceeds the 2 GiB limit. Use the backups folder instead."); }
            await handle.writeFile(value);
          }
        } finally { reader.releaseLock(); }
        if (!size) throw new Error("Upload is empty.");
      } catch (error) { await unlink(temporary).catch(() => undefined); throw error; }
      finally { await handle.close(); }
      await rename(temporary, `${restoreDirectory}/restore-upload.tar.gz`);
      command = { action: "inspect", filename: "upload" };
    } else {
      if (Number(request.headers.get("content-length") || 0) > 4096) return reply({ error: "Request is too large." }, 413);
      const raw = await request.text();
      if (raw.length > 4096) return reply({ error: "Request is too large." }, 413);
      const body = JSON.parse(raw || "{}");
      if (action === "list") command = { action: "list" };
      else if (action === "inspect" && typeof body.filename === "string" && /^[A-Za-z0-9][A-Za-z0-9._ -]{0,180}\.tar\.gz$/.test(body.filename)) command = { action: "inspect", filename: body.filename };
      else if (action === "confirm" && body.trusted === true && state.phase === "ready" && body.confirmation === state.preview?.confirmation) command = { action: "confirm", confirmation: body.confirmation };
      else return reply({ error: "Inspect a valid backup and confirm that you are authorized to restore it." }, 400);
    }
    await writeFile(`${restoreDirectory}/restore-status.json`, JSON.stringify({ phase: "queued", message: "Waiting for the restore helper..." }), { mode: 0o600 });
    await writeFile(`${restoreDirectory}/restore-request.tmp`, JSON.stringify(command), { mode: 0o600 });
    await rename(`${restoreDirectory}/restore-request.tmp`, `${restoreDirectory}/restore-request.json`);
    handedOff = true;
    return reply({ ok: true }, 202);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return reply({ error: "Another setup operation is already running." }, 409);
    return reply({ error: error instanceof Error && error.message.startsWith("Upload") ? error.message : "The restore request could not be saved. Check disk space and setup-folder permissions." }, 400);
  } finally {
    if (release && !handedOff) await release();
  }
}
