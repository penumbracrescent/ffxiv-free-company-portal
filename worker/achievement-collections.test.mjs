import test from "node:test";
import assert from "node:assert/strict";
import { classifyAvailability, expansionForPatch, parseLodestoneAchievementPage } from "./achievement-collections.mjs";

test("maps patches to expansions",()=>{assert.equal(expansionForPatch("2.1"),"A Realm Reborn");assert.equal(expansionForPatch("7.55"),"Dawntrail");});
test("classifies legacy and ranked PvP conservatively",()=>{assert.equal(classifyAvailability({type:{name:"Legacy"}}).availability,"legacy");assert.equal(classifyAvailability({type:{name:"PvP"},name:"Feast Season ranking"}).availability,"ranked_pvp");assert.equal(classifyAvailability({type:{name:"Battle"},name:"Ordinary victory"}).availability,"obtainable");});
test("parses stable Lodestone achievement IDs and earned dates",()=>{const parsed=parseLodestoneAchievementPage(`<main><p>1,566 Total</p><p>Page 1 of 32</p><a class="entry__achievement" href="/lodestone/character/1/achievement/detail/3505/"><time data-epoch="1785547411"></time></a></main>`);assert.equal(parsed.expectedTotal,1566);assert.equal(parsed.totalPages,32);assert.deepEqual(parsed.entries.map((entry)=>entry.achievementId),[3505]);assert.match(parsed.entries[0].earnedAt,/^2026-/);});
