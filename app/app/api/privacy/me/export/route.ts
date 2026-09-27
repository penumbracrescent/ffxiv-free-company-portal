import { NextResponse } from "next/server";
import { Client } from "pg";
import { auth } from "../../../../../auth";
import { inspectPrivacySubject, resolvePrivacySubject } from "../../../../../lib/privacy-requests";
import { ensurePrivacyTables, isPrivacySuppressed, privacyFingerprint } from "../../../../../lib/privacy";
export const runtime="nodejs";
export async function GET(){
  const session:any=await auth();
  const discordUserId=String(session?.user?.discordUserId||"").trim();
  if(!discordUserId)return NextResponse.json({error:"Sign in with your verified Discord identity first."},{status:401});
  const db=new Client({connectionString:process.env.DATABASE_URL});
  try{
    await db.connect();await ensurePrivacyTables(db);
    if(await isPrivacySuppressed(db,discordUserId))return NextResponse.json({error:"This Discord identity is opted out. No new export record was created."},{status:403});
    const subject=await resolvePrivacySubject(db,discordUserId);
    const records=await inspectPrivacySubject(db,subject,true);
    await db.query(`insert into portal_privacy_requests(subject_fingerprint,subject_label,request_type,status,requested_by,result_summary,completed_at) values($1,'Member self-service export','access','completed','member_self_service',$2::jsonb,now())`,[privacyFingerprint("discord",discordUserId),JSON.stringify({exportedTables:Object.keys(records)})]);
    return new NextResponse(JSON.stringify({exportedAt:new Date().toISOString(),subject:{characterId:subject.characterId,characterName:subject.label},records},null,2),{headers:{"content-type":"application/json; charset=utf-8","content-disposition":"attachment; filename=portal-my-data.json","cache-control":"no-store"}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Your export could not be created."},{status:400});}
  finally{await db.end().catch(()=>undefined);}
}
