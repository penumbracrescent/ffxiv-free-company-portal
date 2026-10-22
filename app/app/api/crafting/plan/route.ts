import {NextResponse} from 'next/server';
import {guardCraftingRequest} from '../../../../lib/crafting/request-guard';
import {loadPersonalGraph} from '../../../../lib/crafting/personal-plan';
export const runtime='nodejs';
export async function GET(request:Request){
 const access=await guardCraftingRequest('personal-craft-plan',20);if(access.error)return access.error;
 try{const text=new URL(request.url).searchParams.get('items')||'';if(text.length>1500)throw Error('Too many selected items.');const graph=await loadPersonalGraph(text.split(',').map(Number));return NextResponse.json(graph,{headers:{'Cache-Control':'private, no-store'}});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not load the craft plan.'},{status:400});}
}
