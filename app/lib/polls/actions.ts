"use server";

import { Buffer } from "node:buffer";
import { Client } from "pg";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { cancelPoll, createPoll, deleteTestPoll, editScheduledPoll, getPollEligibility, requestPollEarlyEnd, resolvePollTie, savePollBallot } from "./service";
import type { PollActor } from "./types";

type Session={user?:{name?:string|null;email?:string|null;groups?:string[];discordUserId?:string|null}}|null;
async function db(){const client=new Client({connectionString:process.env.DATABASE_URL});await client.connect();return client;}
function text(form:FormData,key:string){return String(form.get(key)||"").trim();}
function bool(form:FormData,key:string){return form.get(key)==="on"||form.get(key)==="true";}
function number(form:FormData,key:string,fallback=0){const value=Number(form.get(key));return Number.isFinite(value)?value:fallback;}
function isOfficer(session:Session){return(Array.isArray(session?.user?.groups)?session!.user!.groups!:[]).some(group=>["admins","guild officers"].includes(String(group).toLowerCase()));}
async function actorFor(client:Client,session:Session):Promise<PollActor>{const discordUserId=String(session?.user?.discordUserId||"").trim()||null,eligible=await getPollEligibility(client,discordUserId);return{discordUserId,characterId:eligible.character?.id||null,characterName:eligible.character?.characterName||null,isOfficer:isOfficer(session),actorLabel:eligible.character?.characterName||session?.user?.email||session?.user?.name||"Unknown user"};}

const PORTAL_TIME_ZONE="America/Chicago";
function zoneOffsetMs(at:Date){const zone=new Intl.DateTimeFormat("en-US",{timeZone:PORTAL_TIME_ZONE,timeZoneName:"longOffset"}).formatToParts(at).find(part=>part.type==="timeZoneName")?.value||"GMT+00:00",match=/GMT([+-])(\d{2}):?(\d{2})/.exec(zone);if(!match)return 0;const minutes=Number(match[2])*60+Number(match[3]);return(match[1]==="-"?-1:1)*minutes*60000;}
function dateValue(form:FormData,key:string,required=false){const value=text(form,key);if(!value){if(required)throw new Error(`A ${key} date and time is required.`);return null;}const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);if(!match)throw new Error(`Invalid ${key} date and time.`);const wall=Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]),Number(match[4]),Number(match[5]));let parsed=new Date(wall-zoneOffsetMs(new Date(wall)));parsed=new Date(wall-zoneOffsetMs(parsed));return parsed.toISOString();}

async function validateChannel(channelId:string){
  const client=await db();let guildId="";try{guildId=String((await client.query(`select guild_id from portal_discord_bot_settings where id=1`)).rows[0]?.guild_id||"").trim();}finally{await client.end();}
  const token=String(process.env.DISCORD_BOT_TOKEN||"").trim();if(!guildId||!token)throw new Error("Discord channel discovery is not configured.");
  const response=await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`,{headers:{Authorization:`Bot ${token}`},cache:"no-store"});if(!response.ok)throw new Error("Discord channels could not be validated. Refresh Discord resources in Officer Area.");
  const channels=await response.json() as Array<{id:string;name:string;type:number}>;const channel=channels.find(item=>item.id===channelId&&[0,5].includes(item.type));if(!channel)throw new Error("Choose a text or announcement channel from the connected Discord server.");return channel;
}

async function pollOptions(formData:FormData){
  const optionCount=Math.max(0,Math.min(25,Math.floor(number(formData,"optionCount")))),options=[];
  for(let index=0;index<optionCount;index++){
    const label=text(formData,`optionLabel${index}`),description=text(formData,`optionDescription${index}`),value=formData.get(`optionImage${index}`),file=value instanceof File&&value.size>0?value:null;
    if(file&&!['image/jpeg','image/png','image/gif','image/webp'].includes(file.type.toLowerCase()))throw new Error("Poll images must be JPG, PNG, GIF, or WebP files.");if(file&&file.size>5*1024*1024)throw new Error("Each poll image must be 5 MB or smaller.");
    options.push({label,description,existingChoiceId:number(formData,`optionExistingId${index}`)||null,imageFilename:file?.name||null,imageMimeType:file?.type||null,imageData:file?Buffer.from(await file.arrayBuffer()):null});
  }
  return options;
}

function pollInput(formData:FormData,channel:{id:string;name:string},options:any[]){return{pollType:text(formData,"pollType")||"single",question:text(formData,"question"),description:text(formData,"description"),privacyMode:text(formData,"privacyMode"),resultsVisibility:text(formData,"resultsVisibility"),maxSelections:number(formData,"maxSelections",1),winnerCount:number(formData,"winnerCount",1),minSelections:text(formData,"minSelections")?number(formData,"minSelections"):null,rankDepth:number(formData,"rankDepth",3),abstainEnabled:bool(formData,"abstainEnabled"),quorumMinimum:text(formData,"quorumMinimum")?number(formData,"quorumMinimum"):null,officerVotingEnabled:bool(formData,"officerVotingEnabled"),isTest:bool(formData,"isTest"),opensAt:dateValue(formData,"opensAt"),closesAt:dateValue(formData,"closesAt",true),channelId:channel.id,channelName:`#${channel.name}`,reminders:formData.getAll("reminderMinutes").map(Number),postResults:bool(formData,"postResults"),options};}

export async function createPollAction(formData:FormData){
  const session=await auth() as Session,client=await db();
  try{
    const actor=await actorFor(client,session);if(!actor.isOfficer)throw new Error("Officer access is required.");
    const options=await pollOptions(formData);
    let requestedChannelId=text(formData,"channelId");
    if(bool(formData,"isTest")){const configured=(await client.query(`select test_channel_id from portal_discord_bot_settings where id=1`)).rows[0]?.test_channel_id;requestedChannelId=String(configured||"").trim();if(!requestedChannelId)throw new Error("Configure a shared test channel before creating a test poll.");}
    const channel=await validateChannel(requestedChannelId);
    const pollId=await createPoll(client,actor,pollInput(formData,channel,options));
    revalidatePath("/");return{pollId};
  }finally{await client.end();}
}

export async function editScheduledPollAction(formData:FormData){const session=await auth() as Session,client=await db();try{const actor=await actorFor(client,session);if(!actor.isOfficer)throw new Error("Officer access is required.");const options=await pollOptions(formData),channel=await validateChannel(text(formData,"channelId"));await editScheduledPoll(client,actor,number(formData,"pollId"),pollInput(formData,channel,options));}finally{await client.end();}revalidatePath("/");}

export async function savePollBallotAction(formData:FormData){const session=await auth() as Session,client=await db();try{const actor=await actorFor(client,session),pollId=number(formData,"pollId"),pollType=text(formData,"pollType"),selections:Array<{choiceId:number;rank?:number|null}>=[];if(pollType==="ranked"){for(let rank=1;rank<=3;rank++){const choiceId=number(formData,`rank${rank}`);if(choiceId)selections.push({choiceId,rank});}}else for(const value of formData.getAll("choiceId")){const choiceId=Number(value);if(Number.isFinite(choiceId))selections.push({choiceId});}await savePollBallot(client,actor,pollId,selections,"website");}finally{await client.end();}revalidatePath("/");}
export async function endPollEarlyAction(formData:FormData){const session=await auth() as Session,client=await db();try{await requestPollEarlyEnd(client,await actorFor(client,session),number(formData,"pollId"));}finally{await client.end();}revalidatePath("/");}
export async function cancelPollAction(formData:FormData){const session=await auth() as Session,client=await db();try{await cancelPoll(client,await actorFor(client,session),number(formData,"pollId"));}finally{await client.end();}revalidatePath("/");}
export async function deleteTestPollAction(formData:FormData){const session=await auth() as Session,client=await db();try{await deleteTestPoll(client,await actorFor(client,session),number(formData,"pollId"));}finally{await client.end();}revalidatePath("/");}
export async function resolvePollTieAction(formData:FormData){const session=await auth() as Session,client=await db();try{const actor=await actorFor(client,session),mode=text(formData,"resolutionMode") as "extend"|"officer"|"random";if(!["extend","officer","random"].includes(mode))throw new Error("Choose a valid tie resolution.");await resolvePollTie(client,actor,number(formData,"pollId"),mode,text(formData,"choiceId")?number(formData,"choiceId"):null,mode==="extend"?dateValue(formData,"newClosesAt",true):null);}finally{await client.end();}revalidatePath("/");}
