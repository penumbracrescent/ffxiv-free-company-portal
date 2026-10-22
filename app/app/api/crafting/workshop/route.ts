import {NextResponse} from 'next/server';
import {guardCraftingRequest} from '../../../../lib/crafting/request-guard';
import {soloWorkshopCatalogue} from '../../../../lib/crafting/workshop-catalogue';
export const runtime='nodejs';
export async function GET(request:Request){
 const access=await guardCraftingRequest('solo-workshop-catalogue',30);if(access.error)return access.error;
 try{const p=new URL(request.url).searchParams,result=await soloWorkshopCatalogue(p.get('q')||'',p.has('id')?Number(p.get('id')):undefined);return NextResponse.json(result,{headers:{'Cache-Control':'private, no-store'}});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Workshop catalog unavailable.'},{status:400});}
}
