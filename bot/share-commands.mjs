import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags
} from "discord.js";
import { createHmac } from "node:crypto";
import { DISCORD_COMMAND_NAME, PORTAL_ACCENT_COLOR, PORTAL_URL } from "./installation-config.mjs";

const COLOR = PORTAL_ACCENT_COLOR;
const KINDS = new Set(["duty", "mount", "minion"]);

const clean = (value, fallback = "") => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || fallback;
const cut = (value, limit) => {
  const result = clean(value);
  return result.length <= limit ? result : `${result.slice(0, Math.max(0, limit - 1))}…`;
};
const validImage = (value) => /^https?:\/\//i.test(String(value || "")) ? String(value) : null;
const reference = () => `SHARE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const components = (...items) => new ActionRowBuilder().addComponents(...items);

function detailsLink(label, url) {
  return new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url);
}

export function addShareCommandGroup(command) {
  command.addSubcommandGroup((group) => {
    group
      .setName("share")
      .setDescription("Preview and share an illustrated FFXIV catalog card in this channel.");
    for (const [name, description, prompt] of [
      ["duty", "Share a dungeon, trial, or raid.", "Start typing a dungeon, trial, or raid name"],
      ["mount", "Share a mount and its acquisition details.", "Start typing a mount name"],
      ["minion", "Share a minion and its acquisition details.", "Start typing a minion name"]
    ]) {
      group.addSubcommand((subcommand) => subcommand
        .setName(name)
        .setDescription(description)
        .addStringOption((option) => option
          .setName("name")
          .setDescription(prompt)
          .setRequired(true)
          .setAutocomplete(true)));
    }
    return group;
  });
  return command;
}

let shareSchemaReady = null;
async function ensureShareSchema(pool) {
  if (shareSchemaReady) return shareSchemaReady;
  shareSchemaReady = (async () => {
  await pool.query(`alter table portal_mounts add column if not exists description text;`);
  await pool.query(`alter table portal_discord_duties add column if not exists description text;`);
  await pool.query(`create table if not exists portal_command_diagnostics (id bigserial primary key,reference_id text not null unique,command_name text not null,command_path text not null,interaction_kind text not null default 'command',discord_user_id text,discord_username text,discord_display_name text,character_id bigint,character_name text,guild_id text,channel_id text,outcome text not null check(outcome in ('success','failure')),failure_stage text,error_code text,error_message text,duration_ms integer not null default 0,bot_version text,created_at timestamptz not null default now());`);
  await pool.query(`alter table portal_command_diagnostics alter column discord_user_id drop not null; update portal_command_diagnostics set discord_user_id=null,discord_username=null,discord_display_name=null,character_id=null,character_name=null where outcome='success';`);
  await pool.query(`create table if not exists portal_command_usage_daily (usage_date date not null,command_path text not null,invocation_count integer not null default 0,primary key(usage_date,command_path));`);
  })().catch((error) => {
    shareSchemaReady = null;
    throw error;
  });
  return shareSchemaReady;
}

async function linkedCharacter(pool, userId, currentNickname="") {
  return (await pool.query(`with membership as(select dl.discord_user_id,dl.character_id anchor_id,coalesce(nullif($2,''),dl.discord_nickname,dl.discord_display_name,'') current_nickname from portal_discord_links dl join portal_characters anchor on anchor.id=dl.character_id where dl.discord_user_id=$1 and anchor.active=true and anchor.fc_membership_status='current' and exists(select 1 from portal_fc_verification verification where verification.id=1 and verification.status='verified')),candidates as(select anchor.id,anchor.character_name,anchor.display_name,case when lower(trim(anchor.character_name))=lower(trim(m.current_nickname)) or lower(trim(anchor.display_name))=lower(trim(m.current_nickname)) then 0 else 1 end priority from membership m join portal_characters anchor on anchor.id=m.anchor_id union all select linked.id,linked.character_name,linked.display_name,case when lower(trim(linked.character_name))=lower(trim(m.current_nickname)) or lower(trim(linked.display_name))=lower(trim(m.current_nickname)) then 0 else 2 end priority from membership m join portal_alt_character_links acl on acl.discord_user_id=m.discord_user_id and acl.active=true join portal_characters linked on linked.id=acl.character_id and linked.active=true)select id,character_name,display_name from candidates order by priority,id limit 1;`, [userId,currentNickname])).rows[0] || null;
}

async function logInteraction(pool, interaction, { commandPath, kind, outcome, startedAt, error = null, referenceId }) {
  try {
    const secret = String(process.env.PRIVACY_SUPPRESSION_SECRET || process.env.AUTH_SECRET || "").trim();
    if (!secret) return;
    const fingerprint = createHmac("sha256", secret).update(`discord:${interaction.user.id}`).digest("hex");
    const suppressed = await pool.query("select 1 from portal_privacy_suppressions where discord_fingerprint=$1 and status='active' limit 1", [fingerprint]).catch(() => ({ rows: [] }));
    if (suppressed.rows.length) return;
    await ensureShareSchema(pool);
    const identified = outcome === "failure";
    const character = identified ? await linkedCharacter(pool, interaction.user.id,interaction.member?.displayName||interaction.member?.nickname||interaction.user.globalName||interaction.user.username||"").catch(() => null) : null;
    const message = error ? cut(error instanceof Error ? error.message : error, 300) : null;
    const code = error ? cut(error?.code || error?.name || "Error", 80) : null;
    const inserted = await pool.query(`insert into portal_command_diagnostics(reference_id,command_name,command_path,interaction_kind,discord_user_id,discord_username,discord_display_name,character_id,character_name,guild_id,channel_id,outcome,failure_stage,error_code,error_message,duration_ms,bot_version) values($1,'share',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) on conflict(reference_id) do nothing returning id;`, [referenceId, commandPath, kind, identified ? interaction.user.id : null, identified ? (interaction.user.username || null) : null, identified ? (interaction.member?.displayName || interaction.user.globalName || null) : null, identified ? (character?.id || null) : null, identified ? (character?.display_name || character?.character_name || null) : null, interaction.guildId || null, interaction.channelId || null, outcome, error ? "Share command handler" : null, code, message, Math.max(0, Date.now() - startedAt), process.env.npm_package_version || null]);
    if (kind === "command" && inserted.rowCount) {
      await pool.query(`insert into portal_command_usage_daily(usage_date,command_path,invocation_count) values(current_date,$1,1) on conflict(usage_date,command_path) do update set invocation_count=portal_command_usage_daily.invocation_count+1;`, [commandPath]);
    }
  } catch (loggingError) {
    console.warn(`[fc-portal-bot] Could not record /${DISCORD_COMMAND_NAME} share diagnostic:`, loggingError?.message || loggingError);
  }
}

function dutyDescription(row) {
  const fields = row.xivapi_data?.fields || {};
  return clean(row.description || row.notes || fields.Description || fields.DescriptionShort || fields.Content || "", `${clean(row.duty_type, "Duty")} details from the synced FFXIV duty catalog.`);
}

async function catalogItem(pool, kind, id) {
  await ensureShareSchema(pool);
  if (kind === "duty") {
    const row = (await pool.query(`select id,name,duty_type,coalesce(level,level_required)::int level,item_level_required::int item_level,party_size::int,image_url,notes,description,xivapi_data from portal_discord_duties where id=$1 and coalesce(active,is_active,true)=true limit 1;`, [id])).rows[0];
    if (!row) return null;
    return {
      id: row.id,
      kind,
      title: clean(row.name, "Unknown duty"),
      description: dutyDescription(row),
      image: validImage(row.image_url),
      fields: [
        { name: "Type", value: clean(row.duty_type, "Duty"), inline: true },
        { name: "Level", value: row.level ? String(row.level) : "Not listed", inline: true },
        { name: "Item Level", value: row.item_level ? String(row.item_level) : "Not listed", inline: true },
        { name: "Party Size", value: row.party_size ? String(row.party_size) : "Not listed", inline: true }
      ],
      link: null
    };
  }
  if (kind === "mount") {
    const row = (await pool.query("select id,mount_name,description,source_name,patch,image_url,icon_url,mount_category,ffxiv_collect_mount_id,marketboard_item_id,marketboard_item_name,marketboard_eligible from portal_mounts where id=$1 limit 1;", [id])).rows[0];
    if (!row) return null;
    return {
      id: row.id,
      kind,
      title: clean(row.mount_name, "Unknown mount"),
      description: clean(row.description, "Mount details from the synced FFXIV collection catalog."),
      image: validImage(row.image_url || row.icon_url),
      fields: [
        { name: "How to Obtain", value: cut(row.source_name || "Source details have not been published yet.", 1024) },
        { name: "Category", value: clean(row.mount_category, "Other"), inline: true },
        { name: "Patch", value: clean(row.patch, "Not listed"), inline: true }
      ],
      link: row.ffxiv_collect_mount_id ? "https://ffxivcollect.com/mounts/" + encodeURIComponent(row.ffxiv_collect_mount_id) : null,
      marketboard: row.marketboard_eligible && row.marketboard_item_id ? {
        itemId: Number(row.marketboard_item_id),
        itemName: clean(row.marketboard_item_name, row.mount_name)
      } : null
    };
  }
  const row = (await pool.query("select id,minion_name,description,source_name,patch,image_url,icon_url,ffxiv_collect_minion_id,marketboard_item_id,marketboard_item_name,marketboard_eligible from portal_minions where id=$1 limit 1;", [id])).rows[0];
  if (!row) return null;
  return {
    id: row.id,
    kind,
    title: clean(row.minion_name, "Unknown minion"),
    description: clean(row.description, "Minion details from the synced FFXIV collection catalog."),
    image: validImage(row.image_url || row.icon_url),
    fields: [
      { name: "How to Obtain", value: cut(row.source_name || "Source details have not been published yet.", 1024) },
      { name: "Patch", value: clean(row.patch, "Not listed"), inline: true }
    ],
    link: row.ffxiv_collect_minion_id ? "https://ffxivcollect.com/minions/" + encodeURIComponent(row.ffxiv_collect_minion_id) : null,
    marketboard: row.marketboard_eligible && row.marketboard_item_id ? {
      itemId: Number(row.marketboard_item_id),
      itemName: clean(row.marketboard_item_name, row.minion_name)
    } : null
  };
}

async function marketboardPayload(pool, kind, id) {
  if (kind !== "mount" && kind !== "minion") throw new Error("Marketboard prices are only available for mounts and minions.");
  const item = await catalogItem(pool, kind, id);
  if (!item?.marketboard) throw new Error("This item is not marked as marketboard tradeable.");
  const priceTable = kind === "mount" ? "portal_marketboard_item_prices" : "portal_marketboard_minion_prices";
  const listings = (await pool.query("select world_name,data_center_name,min_price from " + priceTable + " where item_id=$1 and min_price is not null order by min_price asc,world_name asc;", [item.marketboard.itemId])).rows;
  const top = listings.slice(0, 3);
  const faerie = listings.find((row) => clean(row.world_name).toLowerCase() === "faerie");
  const price = (value) => Number(value).toLocaleString("en-US") + " gil";
  const lines = top.map((row) => "**" + clean(row.data_center_name, "Unknown") + "/" + clean(row.world_name, "Unknown") + "** - " + price(row.min_price));
  const faerieLine = "**Aether/Faerie** - " + (faerie ? price(faerie.min_price) : "No cached listing");
  const description = [
    "Marketboard item: **" + cut(item.marketboard.itemName, 180) + "**",
    "",
    ...(top.length ? lines : ["No cached listings are currently available."]),
    faerieLine,
    "",
    "Prices are collected at the top of every hour and may change between scans."
  ].join("\n");
  return {
    embeds: [new EmbedBuilder().setColor(COLOR).setTitle(cut(item.title + " - Marketboard Prices", 256)).setDescription(description).setFooter({ text: "FFXIV materials © SQUARE ENIX" })],
    components: [components(detailsLink("Open on Universalis", "https://universalis.app/market/" + item.marketboard.itemId))]
  };
}

function cardPayload(item, sharedBy = null) {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(cut(item.title, 256))
    .setDescription(cut(item.description, 4096))
    .addFields(item.fields)
    .setFooter({ text: `${sharedBy ? `Shared by ${cut(sharedBy, 80)}` : "Private preview — this has not been posted"} · FFXIV materials © SQUARE ENIX` });
  if (item.image) embed.setImage(item.image);
  const publicButtons = [];
  if (item.marketboard) {
    publicButtons.push(new ButtonBuilder()
      .setCustomId("share:market:" + item.kind + ":" + item.id)
      .setStyle(ButtonStyle.Primary)
      .setLabel("Marketboard Prices"));
  }
  if (item.link) publicButtons.push(detailsLink("More Details", item.link));
  const publicComponents = publicButtons.length ? [components(...publicButtons)] : [];
  return { embeds: [embed], components: publicComponents };
}

async function searchCatalog(pool, kind, query) {
  await ensureShareSchema(pool);
  const needle = clean(query).slice(0, 100);
  const pattern = `%${needle}%`;
  if (kind === "duty") {
    return (await pool.query(`select id,name label,duty_type extra from portal_discord_duties where coalesce(active,is_active,true)=true and ($1='' or name ilike $2) order by case when lower(name)=lower($1) then 0 when lower(name) like lower($1)||'%' then 1 else 2 end,lower(name) limit 25;`, [needle, pattern])).rows;
  }
  if (kind === "mount") {
    return (await pool.query(`select id,mount_name label,coalesce(mount_category,source_name,'Mount') extra from portal_mounts where $1='' or mount_name ilike $2 order by case when lower(mount_name)=lower($1) then 0 when lower(mount_name) like lower($1)||'%' then 1 else 2 end,lower(mount_name) limit 25;`, [needle, pattern])).rows;
  }
  return (await pool.query(`select id,minion_name label,coalesce(patch,source_name,'Minion') extra from portal_minions where $1='' or minion_name ilike $2 order by case when lower(minion_name)=lower($1) then 0 when lower(minion_name) like lower($1)||'%' then 1 else 2 end,lower(minion_name) limit 25;`, [needle, pattern])).rows;
}

export async function handleShareAutocomplete(interaction, pool) {
  try {
    const kind = interaction.options.getSubcommand();
    if (!KINDS.has(kind)) return interaction.respond([]);
    const matches = await searchCatalog(pool, kind, interaction.options.getFocused());
    await interaction.respond(matches.map((item) => ({
      name: cut(`${item.label}${item.extra ? ` — ${item.extra}` : ""}`, 100),
      value: String(item.id)
    })));
  } catch (error) {
    console.warn(`[fc-portal-bot] /${DISCORD_COMMAND_NAME} share autocomplete failed:`, error?.message || error);
    await interaction.respond([]).catch(() => null);
  }
}

export async function handleShareCommand(interaction, pool) {
  const startedAt = Date.now();
  const referenceId = reference();
  const kind = interaction.options.getSubcommand(false) || "unknown";
  const commandPath = `/${DISCORD_COMMAND_NAME} share ${kind}`;
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!KINDS.has(kind)) throw new Error("Unknown share category.");
    const item = await catalogItem(pool, kind, Number(interaction.options.getString("name", true)));
    if (!item) throw new Error("That catalog entry is no longer available. Please search again.");
    const preview = cardPayload(item);
    preview.components = [
      components(
        new ButtonBuilder().setCustomId(`share:post:${kind}:${item.id}:${interaction.user.id}`).setStyle(ButtonStyle.Primary).setLabel("Post to Channel"),
        new ButtonBuilder().setCustomId(`share:cancel:${interaction.user.id}`).setStyle(ButtonStyle.Secondary).setLabel("Cancel")
      ),
      ...preview.components
    ];
    await interaction.editReply(preview);
    await logInteraction(pool, interaction, { commandPath, kind: "command", outcome: "success", startedAt, referenceId });
  } catch (error) {
    console.error(`[cotf-bot] ${commandPath} failed (${referenceId}):`, error);
    await logInteraction(pool, interaction, { commandPath, kind: "command", outcome: "failure", startedAt, error, referenceId });
    const reply = { content: `That preview could not be loaded. Please try searching again.\nReference: ${referenceId}`, embeds: [], components: [] };
    if (interaction.deferred || interaction.replied) await interaction.editReply(reply).catch(() => null);
    else await interaction.reply({ ...reply, flags: MessageFlags.Ephemeral }).catch(() => null);
  }
}

export async function handleShareComponent(interaction, pool) {
  if (!interaction.isButton() || !interaction.customId.startsWith("share:")) return false;
  const startedAt = Date.now();
  const referenceId = reference();
  const parts = interaction.customId.split(":");
  const action = parts[1];
  const expectedUser = parts.at(-1);
  const commandPath = action === "post" ? `/${DISCORD_COMMAND_NAME} share ` + parts[2] + " > post" : action === "market" ? `/${DISCORD_COMMAND_NAME} share ` + parts[2] + " > marketboard" : `/${DISCORD_COMMAND_NAME} share cancel`;
  try {
    if (action === "market") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const kind = parts[2];
      const id = Number(parts[3]);
      if ((kind !== "mount" && kind !== "minion") || !Number.isInteger(id) || id <= 0) throw new Error("Invalid marketboard request.");
      await interaction.editReply(await marketboardPayload(pool, kind, id));
      await logInteraction(pool, interaction, { commandPath, kind: "component", outcome: "success", startedAt, referenceId });
      return true;
    }
    if (interaction.user.id !== expectedUser) {
      await interaction.reply({ content: "Only the member who opened this preview can use its buttons.", flags: MessageFlags.Ephemeral });
      return true;
    }
    if (action === "cancel") {
      await interaction.update({ content: "Share cancelled. Nothing was posted.", embeds: [], components: [] });
      await logInteraction(pool, interaction, { commandPath, kind: "component", outcome: "success", startedAt, referenceId });
      return true;
    }
    const kind = parts[2];
    const item = KINDS.has(kind) ? await catalogItem(pool, kind, Number(parts[3])) : null;
    if (!item) throw new Error("That catalog entry is no longer available.");
    await interaction.deferUpdate();
    const character = await linkedCharacter(pool, interaction.user.id,interaction.member?.displayName||interaction.member?.nickname||interaction.user.globalName||interaction.user.username||"").catch(() => null);
    const sharedBy = clean(character?.display_name || character?.character_name || interaction.member?.displayName || interaction.user.globalName || interaction.user.username, "FC member");
    if (!interaction.channel?.isTextBased()) throw new Error("This command can only post in a text channel.");
    await interaction.channel.send(cardPayload(item, sharedBy));
    await interaction.editReply({ content: `Posted **${item.title}** to this channel.`, embeds: [], components: [] });
    await logInteraction(pool, interaction, { commandPath, kind: "component", outcome: "success", startedAt, referenceId });
  } catch (error) {
    console.error(`[cotf-bot] ${commandPath} failed (${referenceId}):`, error);
    await logInteraction(pool, interaction, { commandPath, kind: "component", outcome: "failure", startedAt, error, referenceId });
    const failureMessage = action === "market" ? "Those marketboard prices could not be loaded right now. Please try again shortly." : "That card could not be posted. Please run the share command again.";
    const reply = { content: `${failureMessage}\nReference: ${referenceId}`, embeds: [], components: [] };
    if (interaction.deferred || interaction.replied) await interaction.editReply(reply).catch(() => null);
    else await interaction.reply({ ...reply, flags: MessageFlags.Ephemeral }).catch(() => null);
  }
  return true;
}
