import test from 'node:test';import assert from 'node:assert/strict';
import {animeReference,lookupTrailer} from './src/trailers.mjs';
const config={animeScheduleToken:'test-only',animeScheduleBaseUrl:'https://animeschedule.test/api/v3'};
test('trailer identity uses exact trusted AniList/MAL references, never title search',()=>{
 assert.deepEqual(animeReference({aniList:'anilist.co/anime/123/Season-2/'}),{field:'id',id:123});
 assert.deepEqual(animeReference({mal:'https://myanimelist.net/anime/321'}),{field:'idMal',id:321});
 for(const value of ['https://anilist.co.evil.test/anime/123','https://evil.test/anime/123','javascript:alert(1)','http://anilist.co/anime/123','anilist.co/anime/not-an-id'])assert.equal(animeReference({aniList:value}),null);
});
test('lookup returns only a validated supported video for the exact show',async()=>{
 const calls=[],fake=async(url,options)=>{calls.push([url,options]);return {ok:true,json:async()=>calls.length===1?{websites:{aniList:'anilist.co/anime/123/'}}:{data:{Media:{id:123,trailer:{site:'youtube',id:'abcdefghijk'}}}}};};
 const result=await lookupTrailer('season-two',config,fake);assert.equal(result.trailer.id,'abcdefghijk');assert.match(calls[1][1].body,/Media\(id:\$id,type:ANIME\)/);assert.match(calls[1][1].body,/"id":123/);
});
test('missing/invalid trailers and unavailable metadata are safe',async()=>{
 assert.equal((await lookupTrailer('route',{},()=>{throw Error('Must not call');})).trailer,null);
 for(const trailer of [null,{site:'youtube',id:'bad<script>'},{site:'other',id:'abcdefghijk'}]){
  let count=0;const result=await lookupTrailer('route',config,async()=>({ok:true,json:async()=>++count===1?{websites:{mal:'myanimelist.net/anime/44'}}:{data:{Media:{id:55,trailer}}}}));assert.equal(result.trailer,null);
 }
 await assert.rejects(()=>lookupTrailer('route',config,async()=>({ok:false})),/unavailable/);
});
