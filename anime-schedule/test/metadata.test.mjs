import test from "node:test";
import assert from "node:assert/strict";
import { confirmedEpisodeCount } from "../src/sources/animeschedule.mjs";

test("known numeric and string episode counts are retained",()=>{
  assert.equal(confirmedEpisodeCount({episodes:12}),12);
  assert.equal(confirmedEpisodeCount({episodes:"24"}),24);
});
test("missing counts and aired counters are never treated as finales",()=>{
  for(const detail of [null,{}, {episodes:null}, {episodes:0}, {episodes:-1}, {episodes:12.5}, {episodes:"unknown"}, {episodeOverride:12,subEpisodes:12,dubEpisodes:12}]){
    assert.equal(confirmedEpisodeCount(detail),null);
  }
});
