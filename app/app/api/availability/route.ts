import { NextResponse } from "next/server";
import { Client } from "pg";
import { auth } from "../../../auth";
import { buildAvailabilityPlanner, ensureAvailabilityTables, readAvailability, requireAvailabilityMember, saveAvailability, type AvailabilityScope, type AvailabilityWindow } from "../../../lib/availability";
import { ensureEventPlanningTables } from "../../../lib/event-plans";

type Session = { user?: { discordUserId?: string | null; groups?: string[] } } | null;

async function connectedClient(){const client=new Client({connectionString:process.env.DATABASE_URL});await client.connect();return client;}
function discordId(session:Session){const value=String(session?.user?.discordUserId||"").trim();return /^\d{15,22}$/.test(value)?value:"";}
function officer(session:Session){const groups=Array.isArray(session?.user?.groups)?session!.user!.groups!:[];return groups.includes("Admins")||groups.includes("Guild Officers");}
function errorResponse(error:unknown,status=400){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Availability could not be updated."},{status});}

export async function GET(request:Request){
  const session=(await auth()) as Session,id=discordId(session);if(!id)return errorResponse(new Error("Sign in with your linked Discord account."),401);
  const client=await connectedClient();
  try{
    await ensureAvailabilityTables(client);const character=await requireAvailabilityMember(client,id),url=new URL(request.url);
    if(url.searchParams.get("planner")==="1"){
      if(!officer(session))return errorResponse(new Error("Officer access is required."),403);
      const timeZone=String(url.searchParams.get("timeZone")||"America/Chicago");
      return NextResponse.json({ok:true,planner:await buildAvailabilityPlanner(client,timeZone,Number(url.searchParams.get("duration")||120),Number(url.searchParams.get("weeks")||4))});
    }
    return NextResponse.json({ok:true,character,availability:await readAvailability(client,id)});
  }catch(error){return errorResponse(error);}finally{await client.end();}
}

export async function POST(request:Request){
  const session=(await auth()) as Session,id=discordId(session);if(!id)return errorResponse(new Error("Sign in with your linked Discord account."),401);
  const client=await connectedClient();
  try{
    await ensureAvailabilityTables(client);await requireAvailabilityMember(client,id);const body=await request.json();
    if(body?.action==="clear"){await client.query(`delete from portal_member_availability_profiles where discord_user_id=$1`,[id]);await ensureEventPlanningTables(client);await client.query(`update portal_event_plan_interest i set availability_source=null,availability_confirmed_at=null,updated_at=now() from portal_event_plans p where p.id=i.plan_id and p.status='collecting' and i.discord_user_id=$1 and i.status='interested' and i.availability_source='saved'`,[id]);return NextResponse.json({ok:true,availability:await readAvailability(client,id)});}
    if(body?.action==="confirm"){await client.query(`update portal_member_availability_profiles set last_confirmed_at=now(),updated_at=now() where discord_user_id=$1`,[id]);await ensureEventPlanningTables(client);await client.query(`update portal_event_plan_interest i set availability_source='saved',availability_confirmed_at=now(),updated_at=now() from portal_event_plans p where p.id=i.plan_id and p.status='collecting' and i.discord_user_id=$1 and i.status='interested' and (i.availability_source is null or i.availability_source='saved')`,[id]);return NextResponse.json({ok:true,availability:await readAvailability(client,id)});}
    const windows=Array.isArray(body?.windows)?body.windows.map((window:Record<string,unknown>):AvailabilityWindow=>({day:Number(window.day),slot:Number(window.slot),start:Number(window.start),end:Number(window.end)})):[];
    const availability=await saveAvailability(client,id,{timeZone:String(body?.timeZone||""),scope:String(body?.scope||"") as AvailabilityScope,windows});
    await ensureEventPlanningTables(client);
    await client.query(`update portal_event_plan_interest i set availability_source='saved',availability_confirmed_at=now(),updated_at=now() from portal_event_plans p where p.id=i.plan_id and p.status='collecting' and i.discord_user_id=$1 and i.status='interested' and i.availability_confirmed_at is null`,[id]);
    return NextResponse.json({ok:true,availability});
  }catch(error){return errorResponse(error);}finally{await client.end();}
}
