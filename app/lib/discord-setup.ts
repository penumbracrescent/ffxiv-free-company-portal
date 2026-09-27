type DiscordRole = { id: string; name: string; position: number; permissions: string; managed: boolean };
type DiscordChannel = { id: string; name: string; type: number; position: number; parent_id?: string | null; permission_overwrites?: Array<{ id: string; type: number; allow: string; deny: string }> };
type DiscordGuild = { id: string; name: string; owner_id: string };
type DiscordUser = { id: string; username: string };
type DiscordMember = { roles: string[] };

export type DiscordSetupOption = { id: string; label: string };
export type DiscordSetupDiscovery = {
  guildName: string;
  botName: string;
  roles: DiscordSetupOption[];
  channels: DiscordSetupOption[];
  warnings: string[];
};

const ADMINISTRATOR = 1n << 3n;
const VIEW_CHANNEL = 1n << 10n;
const SEND_MESSAGES = 1n << 11n;
const MANAGE_ROLES = 1n << 28n;

function bits(value: string | undefined) {
  try { return BigInt(value || "0"); } catch { return 0n; }
}

async function api<T>(path: string, token: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`https://discord.com/api/v10${path}`, {
      headers: { Authorization: `Bot ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });
  } catch (error) {
    const cause = error instanceof Error ? error.cause as { code?: string } | undefined : undefined;
    const code = cause?.code || (error instanceof Error ? error.name : "connection error");
    if (code === "UND_ERR_CONNECT_TIMEOUT" || code === "TimeoutError") throw new Error("The portal container timed out while contacting Discord. Check the Docker host's internet access, firewall, and DNS settings.");
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") throw new Error("The portal container could not resolve discord.com. Recreate the portal with the supplied Compose DNS settings, then try again.");
    throw new Error(`The portal container could not connect to Discord (${code}). Check the Docker network, DNS, firewall, and outbound HTTPS access.`);
  }
  if (!response.ok) throw new Error(`Discord returned HTTP ${response.status}. Check the token, server ID, and whether the bot was invited.`);
  return response.json() as Promise<T>;
}

function channelPermissions(base: bigint, channel: DiscordChannel, guildId: string, userId: string, memberRoles: Set<string>) {
  if ((base & ADMINISTRATOR) !== 0n) return ~0n;
  let permissions = base;
  const overwrites = channel.permission_overwrites || [];
  const everyone = overwrites.find((item) => item.type === 0 && item.id === guildId);
  if (everyone) permissions = (permissions & ~bits(everyone.deny)) | bits(everyone.allow);
  let deny = 0n;
  let allow = 0n;
  for (const item of overwrites) {
    if (item.type === 0 && item.id !== guildId && memberRoles.has(item.id)) {
      deny |= bits(item.deny);
      allow |= bits(item.allow);
    }
  }
  permissions = (permissions & ~deny) | allow;
  const member = overwrites.find((item) => item.type === 1 && item.id === userId);
  if (member) permissions = (permissions & ~bits(member.deny)) | bits(member.allow);
  return permissions;
}

export async function discoverDiscordSetup(botToken: string, guildId: string): Promise<DiscordSetupDiscovery> {
  const token = String(botToken || "").trim();
  const serverId = String(guildId || "").trim();
  if (!token || !/^\d{15,22}$/.test(serverId)) throw new Error("A valid bot token and numeric Discord server ID are required.");
  const [guild, roles, channels, bot] = await Promise.all([
    api<DiscordGuild>(`/guilds/${serverId}`, token),
    api<DiscordRole[]>(`/guilds/${serverId}/roles`, token),
    api<DiscordChannel[]>(`/guilds/${serverId}/channels`, token),
    api<DiscordUser>("/users/@me", token)
  ]);
  const member = await api<DiscordMember>(`/guilds/${serverId}/members/${bot.id}`, token);
  const roleMap = new Map(roles.map((role) => [role.id, role]));
  const memberRoleIds = new Set([serverId, ...(member.roles || [])]);
  let basePermissions = 0n;
  for (const roleId of memberRoleIds) basePermissions |= bits(roleMap.get(roleId)?.permissions);
  const owner = guild.owner_id === bot.id;
  const canManageRoles = owner || (basePermissions & (ADMINISTRATOR | MANAGE_ROLES)) !== 0n;
  const highestRole = Math.max(0, ...member.roles.map((roleId) => roleMap.get(roleId)?.position || 0));
  const assignableRoles = canManageRoles
    ? roles.filter((role) => role.id !== serverId && !role.managed && role.position < highestRole)
        .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name))
        .map((role) => ({ id: role.id, label: `@${role.name}` }))
    : [];
  const categories = new Map(channels.filter((channel) => channel.type === 4).map((channel) => [channel.id, channel]));
  const writableChannels = channels.filter((channel) => channel.type === 0 || channel.type === 5)
    .map((channel) => ({ channel, permissions: owner ? ~0n : channelPermissions(basePermissions, channel, serverId, bot.id, memberRoleIds) }))
    .filter(({ permissions }) => (permissions & VIEW_CHANNEL) !== 0n && (permissions & SEND_MESSAGES) !== 0n)
    .sort((a, b) => (categories.get(a.channel.parent_id || "")?.position ?? -1) - (categories.get(b.channel.parent_id || "")?.position ?? -1) || a.channel.position - b.channel.position || a.channel.name.localeCompare(b.channel.name))
    .map(({ channel }) => ({ id: channel.id, label: `${categories.get(channel.parent_id || "") ? `${categories.get(channel.parent_id || "")!.name} / ` : ""}#${channel.name}` }));
  const warnings: string[] = [];
  if (!canManageRoles) warnings.push("The bot lacks Manage Roles. Raise its permissions and place its role above the roles it will assign.");
  if (!writableChannels.length) warnings.push("No writable text channels were found. Grant View Channel and Send Messages where the bot should post.");
  return { guildName: guild.name, botName: bot.username, roles: assignableRoles, channels: writableChannels, warnings };
}
