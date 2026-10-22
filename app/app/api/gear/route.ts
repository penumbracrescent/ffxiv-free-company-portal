import {NextResponse} from 'next/server';
import {guardCraftingRequest} from '../../../lib/crafting/request-guard';
import {calculate,worlds,JOBS} from '../../../lib/gear/service.mjs';
import {Client} from 'pg';
export const runtime='nodejs';
export async function GET(request:Request){
 const guard=await guardCraftingRequest('gear',8);if(guard.error){if(guard.error.status===429)return NextResponse.json({error:'Too many gear calculations. Please wait a minute and try again.'},{status:429,headers:guard.error.headers});return guard.error;}
 try{const p=new URL(request.url).searchParams;if(p.get('action')==='worlds')return NextResponse.json({worlds:await worlds(),jobs:JOBS},{headers:{'Cache-Control':'private, max-age=3600'}});
 const data:any=await calculate(Object.fromEntries(p));
 const client=new Client({connectionString:process.env.DATABASE_URL});
 try{await client.connect();const found=await client.query(`select i.xivapi_id as "xivapiId",i.id::int as "craftPlanId" from portal_crafting_items i where i.xivapi_id=any($1::int[]) and exists(select 1 from portal_crafting_recipes r where r.output_item_id=i.id and r.source_kind='xivapi')`,[data.items.map((i:any)=>i.id)]);const ids=new Map(found.rows.map(i=>[i.xivapiId,i.craftPlanId]));data.items=data.items.map((i:any)=>({...i,craftPlanId:ids.get(i.id)||null}));data.craftCatalogAvailable=true;}catch{data.craftCatalogAvailable=false;}finally{await client.end();}
 return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'The gear plan could not be calculated.'},{status:400});}
}
