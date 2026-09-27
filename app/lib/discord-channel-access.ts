type DiscordRole={id:string;name:string;position:number;permissions:string};
type DiscordChannel={id:string;name:string;type:number;position:number;parent_id?:string|null;permission_overwrites?:Array<{id:string;type:number;allow:string;deny:string}>};
type DiscordGuild={id:string;owner_id:string};
type DiscordUser={id:string};
type DiscordMember={roles:string[]};
export type DiscordChannelOption={id:string;label:string};

const ADMINISTRATOR=1n<<3n,VIEW_CHANNEL=1n<<10n,SEND_MESSAGES=1n<<11n,EMBED_LINKS=1n<<14n;
const cache=new Map<string,{expires:number;channels:DiscordChannelOption[]}>();
const bits=(value:string|undefined)=>{try{return BigInt(value||"0");}catch{return 0n;}};
async function api<T>(path:string,token:string):Promise<T>{const response=await fetch(`https://discord.com/api/v10${path}`,{headers:{Authorization:`Bot ${token}`},cache:"no-store",signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error(`Discord returned HTTP ${response.status}.`);return response.json() as Promise<T>;}
function permissions(base:bigint,channel:DiscordChannel,guildId:string,userId:string,roleIds:Set<string>){if((base&ADMINISTRATOR)!==0n)return~0n;let value=base;const overwrites=channel.permission_overwrites||[],everyone=overwrites.find(item=>item.type===0&&item.id===guildId);if(everyone)value=(value&~bits(everyone.deny))|bits(everyone.allow);let deny=0n,allow=0n;for(const item of overwrites)if(item.type===0&&item.id!==guildId&&roleIds.has(item.id)){deny|=bits(item.deny);allow|=bits(item.allow);}value=(value&~deny)|allow;const member=overwrites.find(item=>item.type===1&&item.id===userId);if(member)value=(value&~bits(member.deny))|bits(member.allow);return value;}
function basePermissions(member:DiscordMember,guildId:string,roles:Map<string,DiscordRole>){let value=0n;for(const roleId of new Set([guildId,...(member.roles||[])]))value|=bits(roles.get(roleId)?.permissions);return value;}

export async function getAvailableDiscordPostChannels({guildId,userId,excludedChannelIds=[],preferredChannelId=""}:{guildId:string;userId:string;excludedChannelIds?:string[];preferredChannelId?:string}){
  const token=String(process.env.DISCORD_BOT_TOKEN||"").trim(),serverId=String(guildId||process.env.DISCORD_GUILD_ID||"").trim(),memberId=String(userId||"").trim();
  if(!token||!serverId||!memberId)return[];
  const key=`${serverId}:${memberId}:${[...excludedChannelIds].sort().join(",")}:${preferredChannelId}:${token.slice(-8)}`,cached=cache.get(key);if(cached&&cached.expires>Date.now())return cached.channels;
  const [guild,roles,channels,botUser,userMember]=await Promise.all([api<DiscordGuild>(`/guilds/${serverId}`,token),api<DiscordRole[]>(`/guilds/${serverId}/roles`,token),api<DiscordChannel[]>(`/guilds/${serverId}/channels`,token),api<DiscordUser>("/users/@me",token),api<DiscordMember>(`/guilds/${serverId}/members/${memberId}`,token)]);
  const botMember=await api<DiscordMember>(`/guilds/${serverId}/members/${botUser.id}`,token),roleMap=new Map(roles.map(role=>[role.id,role])),userRoles=new Set([serverId,...(userMember.roles||[])]),botRoles=new Set([serverId,...(botMember.roles||[])]),userBase=guild.owner_id===memberId?~0n:basePermissions(userMember,serverId,roleMap),botBase=guild.owner_id===botUser.id?~0n:basePermissions(botMember,serverId,roleMap),excluded=new Set(excludedChannelIds.filter(Boolean)),categories=new Map(channels.filter(channel=>channel.type===4).map(channel=>[channel.id,channel]));
  const requiredUser=VIEW_CHANNEL|SEND_MESSAGES,requiredBot=VIEW_CHANNEL|SEND_MESSAGES|EMBED_LINKS;
  const result=channels.filter(channel=>(channel.type===0||channel.type===5)&&!excluded.has(channel.id)).filter(channel=>(permissions(userBase,channel,serverId,memberId,userRoles)&requiredUser)===requiredUser&&(permissions(botBase,channel,serverId,botUser.id,botRoles)&requiredBot)===requiredBot).sort((a,b)=>a.id===preferredChannelId?-1:b.id===preferredChannelId?1:(categories.get(a.parent_id||"")?.position??-1)-(categories.get(b.parent_id||"")?.position??-1)||a.position-b.position||a.name.localeCompare(b.name)).map(channel=>{const category=categories.get(channel.parent_id||"");return{id:channel.id,label:`${category?`${category.name} / `:""}#${channel.name}`};});
  cache.set(key,{expires:Date.now()+60000,channels:result});return result;
}
