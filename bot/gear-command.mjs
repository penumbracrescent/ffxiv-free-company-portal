import {ActionRowBuilder,ButtonBuilder,ButtonStyle,EmbedBuilder}from 'discord.js';
import {calculate,worlds}from './gear/service.mjs';
import {JOBS,LABELS}from './gear/core.mjs';
import {LEVEL_CAP}from './gear/game-config.mjs';
import {discordGearBasket,gearPolicy}from './gear-policy.mjs';
import {gearActionId}from './gear-adjust.mjs';
import {PORTAL_URL,PORTAL_ACCENT_COLOR}from './installation-config.mjs';
import {gearEquipmentFields,GEAR_PRICE_NOTICE}from './gear-command-format.mjs';
import {rememberGearPost}from './gear-share.mjs';
const cooldowns=new Map();
export function gearAdjustmentButtons(parameters,guild){
 const controls=[];
 if(gearPolicy(parameters.level,parameters.quality).quality!=='hq-available')controls.push(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel('Change all to high quality').setCustomId(gearActionId(parameters,'hq',guild)));
 controls.push(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel(parameters.scope==='region'?'Region-wide search selected':'Search outside my data center').setCustomId(gearActionId(parameters,'region',guild)).setDisabled(parameters.scope==='region'));
 return controls;
}
export function addGearCommand(command){return command.addSubcommand(sub=>sub.setName('gear').setDescription('Plan level-safe gear with prices and a shopping route.').addStringOption(o=>o.setName('job').setDescription('Job abbreviation, e.g. BLM, RDM, PLD, BTN, CRP').setRequired(true)).addIntegerOption(o=>o.setName('level').setDescription('Your current job level').setRequired(true).setMinValue(1).setMaxValue(LEVEL_CAP)).addStringOption(o=>o.setName('world').setDescription('Home world name (defaults to linked character world)')).addStringOption(o=>o.setName('scope').setDescription('Where you are willing to shop').addChoices({name:'Home world only',value:'home'},{name:'My data center',value:'dc'},{name:'Other DCs in my region',value:'region'})));}
export async function gearReply(interaction,character,{isOfficer=false,input=null}={}){
 const now=Date.now(),user=interaction.user.id;
 if(!input){if(now-(cooldowns.get(user)||0)<30000)return {content:'Please wait 30 seconds before calculating another gear plan.'};cooldowns.set(user,now);for(const [id,time]of cooldowns)if(now-time>60000)cooldowns.delete(id);}
 const job=input?.job||interaction.options.getString('job').trim().toUpperCase(),level=input?.level||interaction.options.getInteger('level');if(!JOBS[job])return {content:'Use a valid class/job abbreviation, such as BLM, RDM, PLD, WAR, MIN, BTN or CRP.'};
 const worldName=input?null:interaction.options.getString('world')||character.world,world=(await worlds()).find(w=>input?w.id===input.world:w.name.toLowerCase()===String(worldName).trim().toLowerCase());if(!world)return {content:'Home world was not found. Please provide its full name.'};
 const scope=input?.scope||interaction.options.getString('scope')||'dc',quality=input?.quality||'auto';
 const source=input?.source||'market',data=await calculate({job,level,world:world.id,scope}),basket=discordGearBasket(data,quality,source),policy=gearPolicy(level,quality);
 const parameters={job,level,world:world.id,scope,quality,source};
 const strategy=policy.mode==='stats'?'Level cap: highest-stat marketboard gear':'Leveling value recommendations · Marketboard only';
 const qualityNote=policy.quality==='hq-available'?'HQ wherever supported; NQ only for items without an HQ version':'NQ/HQ compared separately';
 const card=new EmbedBuilder().setColor(PORTAL_ACCENT_COLOR).setTitle(`${JOBS[job]} · Level ${level}`).setDescription(`${world.name} · ${world.dc}\n${strategy} · ${scope==='region'?'Other data centers in your region':scope==='home'?'Home world only':'Within your data center'}\n${qualityNote}\n${GEAR_PRICE_NOTICE}\n**${basket.total.toLocaleString()} gil**, buyer tax included${basket.missing?' (partial total; unpriced slots remain)':''}\n${basket.stops} world stops · excludes travel costs`).addFields(...gearEquipmentFields(basket.rows,LABELS,Object.keys(basket.groups))).setFooter({text:policy.mode==='stats'?'Highest-stat marketboard candidates by planner scoring. Materia, stat breakpoints and set bonuses are not modeled.':'Leveling value recommendations. Confirm market listings before traveling.'});
 const url=new URL('/?view=gear',PORTAL_URL),buttons=new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open full Gear Planner').setURL(url.toString()));
 const reply={embeds:[card],components:[buttons]};
 if(interaction.guildId)buttons.addComponents(...gearAdjustmentButtons(parameters,interaction.guildId));
 if(isOfficer&&interaction.guildId&&interaction.channelId){const customId=rememberGearPost(interaction,reply);buttons.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel('Post to channel').setCustomId(customId));}
 return reply;
}
