import { timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";

export function isSetupMode() {
  return String(process.env.SETUP_MODE || "").toLowerCase() === "true"
    && !existsSync("/setup-output/setup-sealed.json");
}

export function isValidSetupToken(candidate: unknown) {
  if (!isSetupMode()) return false;
  const expected = String(process.env.SETUP_TOKEN || "");
  const received = String(candidate || "");
  if (!expected || Buffer.byteLength(expected) !== Buffer.byteLength(received)) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
