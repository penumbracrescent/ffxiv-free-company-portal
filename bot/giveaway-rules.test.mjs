import test from "node:test";
import assert from "node:assert/strict";
import { expiredClaimOutcome, normalizeRank, rankedVotePoints } from "./giveaway-rules.mjs";
import { readFileSync } from "node:fs";
const giveawayBot=readFileSync(new URL("./giveaways.mjs",import.meta.url),"utf8");
test("ranked vote choices are bounded by the configured allowance",()=>{assert.equal(normalizeRank(1,3),1);assert.equal(normalizeRank(4,3),null);assert.equal(rankedVotePoints(3,1),3);assert.equal(rankedVotePoints(3,3),1);});
test("expired FCFS claims reopen only while the giveaway can still accept claims",()=>{const now=Date.now();assert.equal(expiredClaimOutcome({kind:"fcfs",hasAlternate:false,closesAt:null,now}),"reopen");assert.equal(expiredClaimOutcome({kind:"fcfs",hasAlternate:false,closesAt:new Date(now-1).toISOString(),now}),"complete");});
test("expired drawn results promote an alternate when one exists",()=>{assert.equal(expiredClaimOutcome({kind:"random",hasAlternate:true,closesAt:null}),"promote");assert.equal(expiredClaimOutcome({kind:"contest",hasAlternate:false,closesAt:null}),"forfeit");});
test("Discord contest voting preserves private and anonymous ballot identity rules",()=>{assert.match(giveawayBot,/ballot_privacy_mode text not null default 'private'/);assert.match(giveawayBot,/giveawayVoterKey/);assert.match(giveawayBot,/anonymous\?encryptGiveawayDiscordId/);assert.match(giveawayBot,/anonymousVote\?null:interaction\.user\.id/);});
