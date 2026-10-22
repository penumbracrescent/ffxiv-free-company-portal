import {createHmac,timingSafeEqual}from 'node:crypto';
import {JOBS,validateInput}from './gear/core.mjs';
const secret=()=>process.env.DISCORD_PRIVACY_SECRET||process.env.AUTH_SECRET||process.env.DISCORD_BOT_TOKEN||'';
export function gearActionId(input,action,guild,key=secret()){
 if(!key)throw Error('Gear button signing is not configured.');
 const payload=[action,input.job,input.level,input.world,input.scope,input.quality||'auto',input.source||'market'].join(':');
 const signature=createHmac('sha256',key).update(`${guild}:${payload}`).digest('hex').slice(0,24);
 return `fae:gear:adjust:${payload}:${signature}`;
}
export function parseGearAction(id,guild,key=secret()){
 try{
  if(!key||!id.startsWith('fae:gear:adjust:'))return null;
  const [action,job,level,world,scope,quality,source,signature,...extra]=id.slice('fae:gear:adjust:'.length).split(':');
  if(extra.length||!['hq','region'].includes(action)||!JOBS[job]||!['auto','hq'].includes(quality)||!['market','all'].includes(source)||!signature)return null;
  const input={...validateInput({job,level:Number(level),world:Number(world),scope}),quality,source};
  const expected=gearActionId(input,action,guild,key).split(':').at(-1);
  if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return null;
  return {...input,quality:action==='hq'?'hq':quality,scope:action==='region'?'region':scope};
 }catch{return null;}
}
const pending=new Set(),lastRun=new Map();
export async function handleGearAdjustment(interaction,{canUse=async()=>false,isOfficer=async()=>false,render=async()=>{throw Error('Gear calculator unavailable.');}}={}){
 const input=parseGearAction(interaction.customId,interaction.guildId);
 if(!input)return interaction.reply({content:'This gear button is invalid or from an older version. Run the gear command again.',flags:64});
 const user=interaction.user.id,now=Date.now();
 if(pending.has(user)||now-(lastRun.get(user)||0)<5000)return interaction.reply({content:'Please wait a few seconds before recalculating gear again.',flags:64});
 pending.add(user);
 try{
  // Never update the source message: even public-post clicks get a new private reply.
  await interaction.deferReply({flags:64});
  if(!await canUse(interaction)){await interaction.editReply({content:'The gear command requires current verified FC membership and must be enabled by an officer.'});return;}
  lastRun.set(user,now);for(const [id,time]of lastRun)if(now-time>60000)lastRun.delete(id);
  await interaction.editReply(await render(interaction,input,{isOfficer:await isOfficer(interaction)}));
 }catch{await interaction.editReply({content:'Could not refresh gear prices right now. Please try again shortly.'}).catch(()=>null);}
 finally{pending.delete(user);}
}
