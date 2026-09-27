import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { brandingDirectory, validBrandingUrl } from "../../../../lib/portal-branding";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!validBrandingUrl(`/api/branding/${filename}`)) return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(join(brandingDirectory, filename));
    const types: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif" };
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": types[filename.split(".").pop()!],
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox"
    } });
  } catch { return new Response(null, { status: 404 }); }
}
