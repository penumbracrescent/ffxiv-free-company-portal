import { NextResponse } from "next/server";
import { Client } from "pg";
import { auth } from "../../../../auth";
import { inspectPrivacySubject,resolvePrivacySubject } from "../../../../lib/privacy-requests";
import { ensurePrivacyTables } from "../../../../lib/privacy";
export const runtime="nodejs";
export async function GET(request:Request){
  const session:any=await auth();
  if(!session?.user?.groups?.includes("Admins")) return NextResponse.json({error:"Administrator access is required."},{status:403});
  const input=new URL(request.url).searchParams.get("subject")||"";
  const db=new Client({connectionString:process.env.DATABASE_URL});
  try{
    await db.connect(); await ensurePrivacyTables(db);
    const subject=await resolvePrivacySubject(db,input),records=await inspectPrivacySubject(db,subject,true);
    await db.query(`insert into portal_privacy_requests(subject_discord_user_id,subject_character_id,subject_label,request_type,status,requested_by,result_summary,completed_at) values($1,$2,$3,'access','completed',$4,$5::jsonb,now())`,[subject.discordUserId,subject.characterId,subject.label,String(session.user.discordUserId||session.user.email||session.user.name||"Administrator"),JSON.stringify({exportedTables:Object.keys(records)})]);
    return new NextResponse(JSON.stringify({exportedAt:new Date().toISOString(),subject,records},null,2),{headers:{"content-type":"application/json; charset=utf-8","content-disposition":`attachment; filename="portal-data-${subject.discordUserId}.json"`,"cache-control":"no-store"}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"The export could not be created."},{status:400});}
  finally{await db.end().catch(()=>undefined)}
}
