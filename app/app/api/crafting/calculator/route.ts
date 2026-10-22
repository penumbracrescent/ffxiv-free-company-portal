import { NextResponse } from "next/server";
import { getCraftingCalculatorData } from "../../../../lib/crafting/service";
import { guardCraftingRequest } from "../../../../lib/crafting/request-guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await guardCraftingRequest("calculator-data", 20);
  if ("error" in access) return access.error;
  const itemId = Number.parseInt(new URL(request.url).searchParams.get("itemId") || "", 10);
  try {
    const requested = new URL(request.url).searchParams.get("recipeId");
    const recipeId=requested===null?undefined:Number(requested);
    if(recipeId!==undefined&&(!Number.isSafeInteger(recipeId)||recipeId<1))return NextResponse.json({error:"Invalid recipe."},{status:400});
    const data = await getCraftingCalculatorData(itemId, recipeId);
    if (!data) return NextResponse.json({ error: "No simulation-ready recipe was found for that item." }, { status: 404 });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch {
    return NextResponse.json({ error: "Crafting calculator data is temporarily unavailable." }, { status: 500 });
  }
}
