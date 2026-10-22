import test from 'node:test';
import assert from 'node:assert/strict';
import {includesEpisodeOne,premiereTitle} from '../src/premiere.mjs';
import {eventPayload} from '../src/google.mjs';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
test('episode one marker accepts numeric labels, not other episodes or specials',()=>{
 for(const label of ['1','01','1.0'])assert.equal(includesEpisodeOne({episode_label:label}),true);
 for(const label of ['11','10','1.5','TBA','Special'])assert.equal(includesEpisodeOne({episode_label:label}),false);
 assert.equal(includesEpisodeOne({episode_number:1}),true);
 assert.equal(includesEpisodeOne({episode_label:'11',episode_number:1}),false);
 assert.equal(includesEpisodeOne({episode_label:'1',release_kind:'special'}),false);
});
test('only batches including episode one are marked',()=>{
 assert.equal(includesEpisodeOne({episode_label:'1-12',episode_number:12,release_kind:'batch'}),true);
 assert.equal(includesEpisodeOne({episode_label:'2-12',episode_number:12,release_kind:'batch'}),false);
});
test('star is idempotent and does not affect event identity or colors',()=>{
 const release={english_title:'Example',episode_label:'1',release_kind:'episode',language:'dub',starts_at:'2026-10-02T12:00:00Z',release_key:'unchanged-key'};
 const payload=eventPayload(release,'America/Chicago');
 assert.equal(payload.summary,'⭐ Example — Episode 1 (DUB)');
 assert.equal(premiereTitle({...release,english_title:'⭐ Example'}),'⭐ Example');
 assert.equal(payload.extendedProperties.private.cotfReleaseKey,'unchanged-key');
 assert.equal('colorId' in payload,false);assert.equal('reminders' in payload,false);
 assert.equal(eventPayload({...release,episode_label:'2'},'America/Chicago').summary,'Example — Episode 2 (DUB)');
});
test('portal marks merged SUB/DUB cards when either includes episode one',async()=>{
 const source=await readFile(new URL('../../app/app/components/AnimeReleaseCalendar.tsx',import.meta.url),'utf8');
 const body=source.slice(source.indexOf('function markedRelease('),source.indexOf('export default function')).trim().replace('release: Release','release');
 const mark=runInNewContext('('+body+')',{variants:r=>r.variants||[r]});
 const release={english_title:'Example',episode_label:'2',release_kind:'episode'};
 assert.equal(mark(release).english_title,'Example');
 assert.equal(mark({...release,episode_label:'1'}).english_title,'⭐ Example');
 assert.equal(mark({...release,episode_label:'1',language:'raw'}).english_title,'⭐ Example');
 assert.equal(mark({...release,variants:[release,{...release,episode_label:'1'}]}).english_title,'⭐ Example');
 assert.equal(mark({...release,episode_label:'1',english_title:'⭐ Example'}).english_title,'⭐ Example');
});
