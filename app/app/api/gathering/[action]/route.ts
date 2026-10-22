import {NextResponse} from 'next/server';import {createHash} from 'node:crypto';import {guardCraftingRequest} from '../../../../lib/crafting/request-guard';
export const runtime='nodejs';
async function proxy(request:Request,action:string,method:string){
 if(!['catalogue','config','device','stop','test'].includes(action))return NextResponse.json({error:'Not found.'},{status:404});
 if(method==='POST'){
  const origin=request.headers.get('origin'),host=request.headers.get('host');
  if(!origin||new URL(origin).host!==host)return NextResponse.json({error:'Same-site request required.'},{status:403});
  if(Number(request.headers.get('content-length')||0)>32000)return NextResponse.json({error:'Request too large.'},{status:413});
 }
 try{
  const access=action==='stop'?null:await guardCraftingRequest('timed-gathering-'+action,action==='catalogue'?15:40);if(access?.error)return access.error;
  let data:any=undefined;if(method==='POST'){const text=await request.text();if(text.length>32000)throw Error('Request too large.');data=JSON.parse(text);if(action!=='stop')data.owner=access?.discordUserId;}
  const url=new URL('/'+action,process.env.GATHERING_SERVICE_URL||'http://gathering:8081');
  if(action==='device'&&method==='GET'){url.searchParams.set('id',new URL(request.url).searchParams.get('id')||'');url.searchParams.set('owner',access?.discordUserId||'');}
  const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-Gathering-Key':createHash('sha256').update('timed-gathering:'+process.env.AUTH_SECRET).digest('hex')},body:data?JSON.stringify(data):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
  return NextResponse.json(await r.json(),{status:r.status,headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Gathering alerts are temporarily unavailable.'},{status:503});}
}
export async function GET(request:Request,{params}:{params:Promise<{action:string}>}){const {action}=await params;if(!['catalogue','config','device'].includes(action))return NextResponse.json({error:'Method not allowed.'},{status:405});return proxy(request,action,'GET');}
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}){const {action}=await params;if(!['device','stop','test'].includes(action))return NextResponse.json({error:'Method not allowed.'},{status:405});return proxy(request,action,'POST');}
