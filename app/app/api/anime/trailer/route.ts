import {NextRequest,NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const series=request.nextUrl.searchParams.get('series')||'';
 if(!/^series_[a-f0-9]{32}$/.test(series))return NextResponse.json({error:'Invalid show identifier.'},{status:400});
 try{
  const target=new URL('/api/trailer',process.env.ANIME_SCHEDULE_URL||'http://cotf-anime-schedule:8080');target.searchParams.set('series',series);
  const response=await fetch(target,{cache:'no-store',signal:AbortSignal.timeout(12000)});
  return NextResponse.json(await response.json(),{status:response.status});
 }catch{return NextResponse.json({error:'Trailer lookup temporarily unavailable.'},{status:503});}
}
