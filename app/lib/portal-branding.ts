import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const brandingDirectory = "/app/public/uploads/officer-branding";
export function imageExtension(bytes: Buffer, mime: string) {
  if (mime === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "png";
  if (mime === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpg";
  if (mime === "image/webp" && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (mime === "image/gif" && ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) return "gif";
  throw new Error("Choose a PNG, JPG, WebP, or GIF image with matching file contents.");
}
export async function prepareBrandingImage(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || !value.size) return null;
  if (value.size > 8 * 1024 * 1024) throw new Error("Each branding image must be 8 MB or smaller.");
  const bytes = Buffer.from(await value.arrayBuffer());
  return { bytes, extension: imageExtension(bytes, value.type) };
}
export async function storeBrandingImage(image: { bytes: Buffer; extension: string }) {
  await mkdir(brandingDirectory, { recursive: true });
  const filename = `${randomUUID()}.${image.extension}`;
  await writeFile(join(brandingDirectory, filename), image.bytes, { flag: "wx", mode: 0o644 });
  return `/api/branding/${filename}`;
}
export function validBrandingUrl(value: string) {
  return /^\/api\/branding\/[0-9a-f-]{36}\.(png|jpg|webp|gif)$/.test(value);
}
