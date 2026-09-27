import { NextResponse } from "next/server";
import { searchCraftingCatalogItems } from "../../../../lib/crafting/service";
import { guardCraftingRequest } from "../../../../lib/crafting/request-guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await guardCraftingRequest("catalog-search", 30);
  if ("error" in access) return access.error;
  const query = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const items = await searchCraftingCatalogItems(query);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch {
    return NextResponse.json({ items: [], error: "Catalog search is temporarily unavailable." }, { status: 500 });
  }
}
