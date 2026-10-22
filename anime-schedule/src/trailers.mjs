import {pool} from './db.mjs';
const cache=new Map();let inFlight=0,windowStart=0,requests=0;
export function animeReference(websites){
 for(const [field,host,path] of [['aniList','anilist.co','anime'],['mal','myanimelist.net','anime']]){
  const value=websites?.[field];if(typeof value!=='string')continue;
  try{const url=new URL(value.includes('://')?value:'https://'+value),match=url.pathname.match(new RegExp('^/'+path+'/(\\d+)(?:/|$)'));if(url.protocol==='https:'&&url.hostname===host&&match&&Number.isSafeInteger(Number(match[1])))return {field:field==='aniList'?'id':'idMal',id:Number(match[1])};}catch{}
 }return null;
}
export async function lookupTrailer(route,config,fetcher=fetch){
 if(!route||!config.animeScheduleToken)return {trailer:null,reason:'No verified trailer reference available.'};
 const detailResponse=await fetcher(config.animeScheduleBaseUrl.replace(/\/$/,'')+'/anime/'+encodeURIComponent(route),{headers:{Authorization:'Bearer '+config.animeScheduleToken,Accept:'application/json'},signal:AbortSignal.timeout(5000)});
 if(!detailResponse.ok)throw Error('Show metadata unavailable');
 const detail=await detailResponse.json(),reference=animeReference(detail.websites);
 if(!reference)return {trailer:null,reason:'No verified trailer reference available.'};
 const response=await fetcher('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({query:'query($id:Int){Media('+reference.field+':$id,type:ANIME){id trailer{id site}}}',variables:{id:reference.id}}),signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw Error('Trailer catalog unavailable');
 const payload=await response.json();if(payload.errors)throw Error('Trailer catalog unavailable');
 const trailer=payload.data?.Media?.trailer;
 if(!trailer||String(trailer.site).toLowerCase()!=='youtube'||!/^[A-Za-z0-9_-]{11}$/.test(String(trailer.id)))return {trailer:null,reason:'No supported trailer is listed for this show.'};
 return {trailer:{site:'youtube',id:trailer.id,url:'https://www.youtube.com/watch?v='+trailer.id,thumbnail:'https://i.ytimg.com/vi/'+trailer.id+'/hqdefault.jpg',source:'https://anilist.co/anime/'+payload.data.Media.id},checkedAt:new Date().toISOString()};
}
export async function trailerForSeries(seriesKey,config){
 if(!/^series_[a-f0-9]{32}$/.test(seriesKey||''))return {status:400,payload:{error:'Invalid show identifier.'}};
 const row=(await pool.query('select source_route from anime.series where series_key=$1',[seriesKey])).rows[0];
 if(!row)return {status:404,payload:{error:'Show not found.'}};
 const route=row.source_route;if(!route)return {status:200,payload:{trailer:null,reason:'No verified trailer reference available.'}};
 const cached=cache.get(route);if(cached&&cached.until>Date.now()){try{return {status:200,payload:await cached.promise};}catch{return {status:503,payload:{error:'Trailer lookup temporarily unavailable.'}};}}
 if(inFlight>=2)return {status:503,payload:{error:'Trailer lookup is busy. Please try again.'}};
 if(Date.now()-windowStart>60000){windowStart=Date.now();requests=0;}if(requests>=20)return {status:503,payload:{error:'Trailer lookup limit reached. Please try again shortly.'}};
 requests++;inFlight++;
 if(cache.size>=500)cache.delete(cache.keys().next().value);
 const promise=lookupTrailer(route,config);cache.set(route,{promise,until:Date.now()+86400000});
 try{return {status:200,payload:await promise};}catch{cache.delete(route);return {status:503,payload:{error:'Trailer lookup temporarily unavailable.'}};}finally{inFlight--;}
}
