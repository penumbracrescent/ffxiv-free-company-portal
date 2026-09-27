import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import {createRosterOverrides,validOverrideName,sameMembership} from "./roster-overrides.mjs";

const member={id:"user",guild:{id:"guild"},joinedTimestamp:1700000000000,user:{bot:false},roles:{cache:new Map(),add:async()=>{},remove:async()=>{}}};
function fixture({admin=true,row={},request="completed",matched=true,linked=false,grantFailure=false,corrected=false}={}) {
  const saved={id:"1",guild_id:"guild",discord_user_id:"user",character_name:"Vighnesh Vara",
    created_at:new Date(),membership_joined_at:new Date(member.joinedTimestamp),status:"pending",due_at:new Date(Date.now()-1000),worker_request_id:1,
    role_added:true,granted_role_id:"verified",...row};
  const calls=[],notices=[],replies=[];
  const target={...member,manageable:true,displayName:"Discord Name",setNickname:async()=>calls.push("nickname"),roles:{cache:new Map(),add:async()=>{calls.push("grant");if(grantFailure)throw Error("Denied");},remove:async id=>calls.push("remove:"+id)}};
  const query=async(sql,args=[])=>{
    calls.push([sql,args]);
    if(sql.includes("pg_try_advisory")) return {rows:[{locked:true}]};
    if(sql.includes("select * from portal_discord_roster_overrides")) return {rows:[saved]};
    if(sql.includes("select status from portal_worker_requests")) return {rows:[{status:request}]};
    if(sql.startsWith("select character_id,match_source"))return {rows:corrected?[{character_id:99,match_source:"officer_reassigned"}]:[]};
    if(sql.includes("join portal_characters") && sql.includes("c.active"))return {rows:linked?[{}]:[]};
    if(sql.includes("select 1 from portal_discord_links"))return {rows:[]};
    if(sql.startsWith("update portal_discord_roster_overrides set status='approved'")) saved.status="approved";
    return {rows:[]};
  };
  const pool={query,connect:async()=>({query,release(){}})};
  const config={guild_id:"guild",officer_log_channel_id:"log",verified_role_id:"verified"};
  const service=createRosterOverrides({pool,bot:{guilds:{fetch:async()=>({members:{fetch:async()=>target}})}},
    settings:async()=>config,isAdmin:async()=>admin,primaryAdmin:async()=>"admin",
    notify:async p=>notices.push(p),findCharacter:async()=>null,
    completeOnboarding:async()=>calls.push("onboarding"),
    verify:async()=>{calls.push("verify");return {ok:matched,character:{id:12}};},
    welcomePost:async()=>{calls.push("portrait");return true;},welcomeGreeting:async()=>{calls.push("wave");return true;},audit:async()=>calls.push("audit")});
  const interaction={customId:"cotf_roster_override:1",user:{id:"admin"},guildId:"guild",channelId:"log",
    guild:{members:{fetch:async()=>target}},deferReply:async()=>{},editReply:async text=>replies.push(text)};
  return {service,interaction,calls,notices,replies,saved};
}
test("only character-shaped names get an override offer",()=>{
  assert.ok(validOverrideName("Vighnesh Vara"));
  for(const name of ["Brett","<@123> Name","@everyone Test",""])assert.equal(validOverrideName(name),false);
});
test("nonadmins cannot grant provisional access",async()=>{
  const f=fixture({admin:false});await f.service.handle(f.interaction);
  assert.ok(!f.calls.includes("grant"));assert.match(f.replies[0],/Only a configured/);
});
test("approval is durable before role changes and duplicates cannot reapprove",async()=>{
  const f=fixture();await f.service.handle(f.interaction);
  assert.ok(f.calls.findIndex(c=>Array.isArray(c)&&c[0]==="commit")<f.calls.indexOf("grant"));
  assert.ok(f.calls.indexOf("nickname")<f.calls.indexOf("grant"));
  assert.ok(f.calls.indexOf("grant")<f.calls.indexOf("wave"));
  await f.service.handle(f.interaction);
  assert.equal(f.calls.filter(c=>c==="grant").length,1);
  assert.ok(f.calls.some(c=>Array.isArray(c)&&c[0].includes("interval '24 hours'")));
});
test("Discord permission failure is logged without losing the deadline",async()=>{
  const f=fixture({grantFailure:true});await f.service.handle(f.interaction);
  assert.equal(f.saved.status,"approved");assert.match(f.replies[0],/incomplete/);
});
test("guest expiry cancellation is committed with approval before Discord updates",async()=>{
  const f=fixture({grantFailure:true});await f.service.handle(f.interaction);
  const cancel=f.calls.findIndex(c=>Array.isArray(c)&&c[0].includes("update portal_discord_guest_access"));
  const commit=f.calls.findIndex(c=>Array.isArray(c)&&c[0]==="commit");
  assert.ok(cancel>=0 && cancel<commit && commit<f.calls.indexOf("grant"));
  assert.deepEqual(f.calls[cancel][1],["guild","user"]);
  assert.match(f.calls[cancel][0],/status='verified'/);
  assert.match(f.calls[cancel][0],/status in \('pending','guest'\)/);
  // A new process uses the same DB status filter, not an in-memory timer.
  const source=await readFile(new URL("./bot.mjs",import.meta.url),"utf8");
  assert.match(source,/where \(status='pending' and selection_expires_at<=now\(\)\)[\s\S]*?or \(status='guest' and expires_at<=now\(\)\)/);
});
test("successful recheck posts the portrait without an access interruption",async()=>{
  const f=fixture({row:{status:"approved"}});await f.service.process();
  assert.ok(!f.calls.includes("remove:verified"));
  assert.ok(f.calls.includes("portrait"));
});
test("manual corrections supersede delayed verification",async()=>{
  const f=fixture({corrected:true});await f.service.process();
  assert.ok(!f.calls.includes("verify"));assert.ok(!f.calls.includes("remove:verified"));
  assert.ok(f.calls.some(c=>Array.isArray(c)&&c[1]?.includes("superseded")));
});
test("scan grace is bounded and pending scans do not cause immediate removal",async()=>{
  const waiting=fixture({request:"pending"});await waiting.service.process();
  assert.ok(!waiting.calls.includes("remove:verified"));
  const overdue=fixture({request:"pending",row:{access_deadline_at:new Date(Date.now()-1000),check_deadline_at:new Date(Date.now()-1000)}});
  await overdue.service.process();assert.ok(overdue.calls.includes("remove:verified"));
  assert.ok(overdue.notices.some(n=>n.components?.[0].components.some(b=>b.label==="Retry roster check")));
});
test("rejoining invalidates old approvals and their timer exemptions",async()=>{
  assert.equal(sameMembership({membership_joined_at:new Date(1)},member),false);
  const f=fixture({row:{membership_joined_at:new Date(1)}});await f.service.process();
  assert.ok(!f.calls.includes("verify"));assert.ok(!f.calls.includes("remove:verified"));
  await f.service.protectedAccess("guild","user",member.joinedTimestamp);
  assert.ok(f.calls.some(c=>Array.isArray(c)&&c[0].includes("membership_joined_at=$3")));
  await f.service.onJoin(member);await f.service.onLeave(member);
  assert.ok(f.calls.some(c=>Array.isArray(c)&&c[0].includes("status='left'")));
});
test("review retry queues fresh work without granting access or extending its deadline",async()=>{
  const f=fixture({row:{status:"review",access_ended_at:new Date()}});
  f.interaction.customId="cotf_roster_override:1:retry";await f.service.handle(f.interaction);
  assert.ok(!f.calls.includes("grant"));
  const update=f.calls.find(c=>Array.isArray(c)&&c[0].includes("worker_request_id=null"));
  assert.ok(update);assert.ok(!update[0].includes("access_deadline_at="));
});
test("closing review frees the name for a new request",async()=>{
  const f=fixture({row:{status:"review",access_ended_at:new Date()}});
  f.interaction.customId="cotf_roster_override:1:close";await f.service.handle(f.interaction);
  assert.ok(f.calls.some(c=>Array.isArray(c)&&c[0].includes("status='closed',normalized_name=")));
});
test("atomic link upsert refuses to overwrite manual corrections",async()=>{
  const source=await readFile(new URL("./bot.mjs",import.meta.url),"utf8");
  assert.match(source,/where excluded.match_source <> 'roster_override_recheck'/);
  assert.match(source,/portal_discord_links.character_id = excluded.character_id/);
  assert.match(source,/if \(!savedLink.rows.length\) return \{ ok: false, corrected: true/);
});
test("startup matching retains a current FC anchor when Discord uses a linked-character nickname",async()=>{
  const source=await readFile(new URL("./bot.mjs",import.meta.url),"utf8");
  const matcher=source.slice(source.indexOf("async function autoMatchMemberByDisplayName"),source.indexOf("// =========================\n// SECTION 11"));
  assert.ok(matcher.indexOf("const existingAnchor")<matcher.indexOf("const possibleNames"));
  assert.match(matcher,/getActiveCharacterForDiscordUser\(member\.id, names\.displayName\)/);
  assert.match(matcher,/Existing current FC membership anchor retained/);
  assert.match(matcher,/status='superseded'/);
  assert.ok(matcher.indexOf("if \(existingAnchor\)")<matcher.indexOf("rosterOverrides\?\.offer"));
});
test("unmatched recheck expires only the granted role and alerts admins",async()=>{
  const f=fixture({matched:false,row:{status:"approved"}});await f.service.process();
  assert.ok(f.calls.includes("remove:verified"));assert.ok(!f.calls.includes("portrait"));
  assert.match(f.notices[0].content,/still unverified/);
});
test("preexisting roles and current linked membership are never revoked",async()=>{
  for(const options of [{row:{role_added:false}},{linked:true}]) {
    const f=fixture(options);await f.service.process();assert.ok(!f.calls.includes("remove:verified"));
  }
});
test("worker failure cannot silently retain a provisional role",async()=>{
  const f=fixture({request:"failed"});await f.service.process();
  assert.ok(f.calls.includes("remove:verified"));assert.ok(!f.calls.includes("verify"));
  assert.match(f.notices[0].content,/refresh failed/);
});
test("single-use prompt claims submission atomically and greeting waits for verification",async()=>{
  const source=await readFile(new URL("./bot.mjs",import.meta.url),"utf8");
  assert.match(source,/used_by=\$4,used_at=now\(\)[\s\S]*?used_at is null returning message_id/);
  assert.match(source,/cotf_verify_character_modal::\$\{interaction.message.id\}/);
  const join=source.slice(source.indexOf('bot.on("guildMemberAdd"'),source.indexOf('bot.on("messageCreate"'));
  assert.ok(join.indexOf("autoMatchMemberByDisplayName")<join.indexOf("postVerifiedCharacterGreeting"));
  assert.match(join,/if \(welcomeReadiness\.ready\)[\s\S]*?postVerifiedCharacterGreeting\(member, matchedCharacter\)/);
  const verify=source.slice(source.indexOf("async function verifyMemberByCharacterName"),source.indexOf("// SUBSECTION 10B"));
  assert.ok(verify.indexOf("applyVerifiedDiscordState")<verify.indexOf("getVerifiedWelcomeReadiness"));
  assert.ok(verify.indexOf("getVerifiedWelcomeReadiness")<verify.indexOf("postVerifiedCharacterGreeting"));
  const command=await readFile(new URL("./fae-commands.mjs",import.meta.url),"utf8");
  assert.match(command,/setName\("officer"\)[\s\S]*?setName\("verify"\)/);
});
test("used-prompt deletion failures persist for retry without allowing reuse",async()=>{
  const source=await readFile(new URL("./bot.mjs",import.meta.url),"utf8");
  const helper=source.slice(source.indexOf("let verificationCleanupRunning = false;"),source.indexOf('bot.once("clientReady"'));
  let fail=true,removed=false,alerts=0;
  const context=vm.createContext({
    pool:{query:async sql=>{
      if(sql.startsWith("select"))return {rows:removed?[]:[{message_id:"123",channel_id:"456"}]};
      if(sql.includes("set removed_at=now()"))removed=true;
      return {rows:[]};
    }},
    bot:{channels:{fetch:async()=>({messages:{delete:async()=>{if(fail)throw Object.assign(Error("Missing permission"),{code:50013});}}})}},
    sendOfficerLog:async()=>{alerts++;},console
  });
  vm.runInContext(helper,context);
  await vm.runInContext("cleanupUsedVerificationPrompts()",context);
  assert.equal(removed,false);assert.equal(alerts,1);
  fail=false;
  await vm.runInContext("cleanupUsedVerificationPrompts()",context);
  assert.equal(removed,true);
});
