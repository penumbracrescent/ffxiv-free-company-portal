import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnimeScheduleSource} from './src/sources/animeschedule.mjs';
import {eventPayload} from './src/google.mjs';
import {fallbackLanguages, RAW_FALLBACK_SQL} from './src/raw.mjs';
import {pool} from './src/db.mjs';
test('raw adapter admits broadcasts and keeps premiere identity',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>({ok:true,status:200,json:async()=>[{title:'Black Clover',route:'black-clover',airType:'raw',episodeNumber:1,episodeDate:'2026-10-03T09:00:00-05:00',airingStatus:'aired'}]});
 try {
  const source=createAnimeScheduleSource({animeScheduleToken:'test',animeScheduleBaseUrl:'https://example.invalid',timezone:'America/Chicago',weeksBehind:0,weeksAhead:0});
  const {observations}=await source.fetchObservations({freshDescriptionRoutes:['black-clover']});
  assert.equal(observations.length,1);assert.equal(observations[0].language,'raw');assert.equal(observations[0].episodeNumber,1);
 }finally{globalThis.fetch=original;}
});
test('raw premiere is starred and explicitly labelled',()=>{
 const event=eventPayload({english_title:'Black Clover',language:'raw',episode_label:'1',release_kind:'episode',starts_at:'2026-10-03T14:00:00Z',release_key:'test'},'America/Chicago');
 assert.equal(event.summary,'⭐ Black Clover — Episode 1 (RAW)');
 assert.match(event.description,/Original broadcast/);
 assert.equal(event.extendedProperties.private.cotfLanguage,'raw');
});
test('raw non-premiere is not starred',()=>{
 assert.doesNotMatch(eventPayload({english_title:'Test',language:'raw',episode_label:'2',starts_at:'2026-10-03T14:00:00Z'},'America/Chicago').summary,/⭐/);
});
test('language defaults include fallback without duplicate entries',()=>assert.deepEqual(fallbackLanguages(['sub','dub','raw']),['sub','dub','raw']));
test('database fallback hides raw per episode, including translated batches',{
 skip: !process.env.ANIME_TEST_DATABASE_URL && 'Requires an isolated ANIME_TEST_DATABASE_URL (*_test database)',
},async()=>{
 const {ensureSchema}=await import('./src/schema.mjs');
 await ensureSchema();
 const client=await pool.connect();
 try {
  await client.query('begin');
  const series=(await client.query("insert into anime.series(series_key,english_title) values('raw-test-'||gen_random_uuid(),'RAW test') returning id")).rows[0].id;
  async function add(language,label,num,kind='episode',status='confirmed') {
   return (await client.query(`insert into anime.releases(release_key,series_id,language,episode_label,episode_number,release_kind,status,starts_at,source_key,source_observed_at) values(gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,now(),'test',now()) returning id`,[series,language,label,num,kind,status])).rows[0].id;
  }
  const visible=async()=> (await client.query(`select r.language,r.episode_label from anime.releases r where r.series_id=$1 and ${RAW_FALLBACK_SQL} order by r.language,r.episode_label`,[series])).rows;
  await add('raw','1',1);await add('raw','2',2);await add('raw','3',3);await add('raw','4',4);
  assert.equal((await visible()).length,4);
  await add('sub','1',1);assert.equal((await visible()).filter(r=>r.language==='raw').length,3);
  await add('dub','2',2);assert.equal((await visible()).filter(r=>r.language==='raw').length,2);
  await add('sub','3-4',4,'batch');assert.equal((await visible()).filter(r=>r.language==='raw').length,0);
  await add('raw','5',5);await add('sub','5',5,'episode','unknown');assert.equal((await visible()).filter(r=>r.language==='raw').length,1);
  const alias=(await client.query("insert into anime.series(series_key,english_title,source_route) values('raw-alias-'||gen_random_uuid(),'Renamed RAW test','raw-alias-regression') returning id")).rows[0].id;
  await client.query("update anime.series set source_route='raw-alias-regression' where id=$1",[series]);
  await add('raw','6',6);
  await client.query(`insert into anime.releases(release_key,series_id,language,episode_label,episode_number,release_kind,status,starts_at,source_key,source_observed_at) values(gen_random_uuid()::text,$1,'sub','6.0',6,'episode','confirmed',now(),'test',now())`,[alias]);
  assert.equal((await visible()).filter(r=>r.language==='raw').length,1,'renamed same-source episode replaces RAW; unrelated episode 5 remains');
  await client.query("update anime.series set source_route='different-season' where id=$1",[alias]);
  assert.equal((await visible()).filter(r=>r.language==='raw').length,2,'different source season cannot replace RAW');
 }finally{await client.query('rollback');client.release();await pool.end();}
});
