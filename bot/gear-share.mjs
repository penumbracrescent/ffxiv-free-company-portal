import {randomBytes} from 'node:crypto';
const plans=new Map(),TTL=15*60*1000;
export function rememberGearPost(interaction,payload){
 const now=Date.now();for(const [id,plan] of plans)if(now-plan.createdAt>TTL)plans.delete(id);
 while(plans.size>=200)plans.delete(plans.keys().next().value);
 const id=randomBytes(12).toString('hex');
 plans.set(id,{owner:interaction.user.id,guild:interaction.guildId,channel:interaction.channelId,payload:JSON.parse(JSON.stringify(payload)),createdAt:now,busy:false,posted:false});
 return `fae:gear:post:${id}`;
}
export async function handleGearPost(interaction,{isOfficer=async()=>false}={}){
 const id=interaction.customId.slice('fae:gear:post:'.length),plan=plans.get(id);
 const privateReply=content=>interaction.reply({content,flags:64});
 if(!plan||Date.now()-plan.createdAt>TTL)return privateReply('This gear plan expired or the bot restarted. Run the gear command again.');
 if(plan.owner!==interaction.user.id||plan.guild!==interaction.guildId||plan.channel!==interaction.channelId)return privateReply('Only the officer who calculated this plan can post it, in its original channel.');
 if(plan.busy||plan.posted)return privateReply('This gear plan is already posted or being posted.');
 plan.busy=true;
 try{
  await interaction.deferUpdate();
  if(!await isOfficer(interaction)){await interaction.editReply({content:'Officer access is required to post this gear plan.',components:[]});return;}
  const channel=await interaction.guild.channels.fetch(plan.channel);
  const member=interaction.guild.members.me||await interaction.guild.members.fetchMe();
  const required=['ViewChannel',channel?.isThread?.()?'SendMessagesInThreads':'SendMessages','EmbedLinks'];
  if(!channel?.isTextBased()||!channel.permissionsFor(member)?.has(required))throw Error('The bot needs permission to view this channel, send messages and embed links.');
  const message=await channel.send({...plan.payload,allowedMentions:{parse:[]}});
  plan.posted=true;
  await interaction.editReply({content:`Posted this gear plan in this channel. [View post](${message.url})`,components:plan.payload.components});
 }catch(error){
  const content=plan.posted?'The gear plan was posted. Run the command again for a new calculation.':`Could not post this gear plan. ${error.message||'Please try again.'}`;
  if(interaction.deferred||interaction.replied)await interaction.editReply({content,...(plan.posted?{components:plan.payload.components}:{})}).catch(()=>null);else await privateReply(content).catch(()=>null);
 }finally{plan.busy=false;}
}
