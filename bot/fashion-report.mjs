import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from "discord.js";
import { createHash } from "node:crypto";

const REPORT_URL = "https://fashionreportxiv.com/";
const REPORT_STATE_URL = "https://fashionreportxiv.com/api/report-state";
const REPORT_IMAGE_URL = "https://fashionreportxiv.com/hint.png";
const KAIYOKO_URL = "https://x.com/KaiyokoStar";
const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20_000;
const MIN_IMAGE_BYTES = 10_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

let lastAttemptAt = 0;
let syncRunning = false;

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Children-of-the-Fae-Fashion-Report/1.0" }
    });
  } finally {
    clearTimeout(timeout);
  }
}

function getJudgingWindow(now = new Date()) {
  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    8,
    0,
    0,
    0
  ));
  const daysSinceFriday = (start.getUTCDay() - 5 + 7) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceFriday);
  if (now.getTime() < start.getTime()) start.setUTCDate(start.getUTCDate() - 7);

  const closesAt = new Date(start.getTime());
  closesAt.setUTCDate(closesAt.getUTCDate() + 4);
  return { closesAt, isOpen: now >= start && now < closesAt };
}

async function readSource() {
  const stateResponse = await fetchWithTimeout(REPORT_STATE_URL);
  if (!stateResponse.ok) throw new Error(`Fashion Report status returned HTTP ${stateResponse.status}.`);

  const source = await stateResponse.json();
  const weekNumber = Number.parseInt(String(source?.lastOptions?.week || ""), 10);
  const reportTitle = String(source?.lastOptions?.reportTitle || "").trim();
  const hints = Array.isArray(source?.lastOptions?.hints) ? source.lastOptions.hints : [];

  if (!Number.isInteger(weekNumber) || weekNumber < 400 || weekNumber > 10_000) {
    throw new Error("Fashion Report source did not provide a valid week number.");
  }
  if (!reportTitle || hints.length < 4) {
    throw new Error("Fashion Report source has not published a complete weekly guide yet.");
  }

  const imageResponse = await fetchWithTimeout(REPORT_IMAGE_URL);
  if (!imageResponse.ok) throw new Error(`Fashion Report image returned HTTP ${imageResponse.status}.`);
  const contentType = String(imageResponse.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("image/")) throw new Error("Fashion Report image response was not an image.");

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  if (imageBuffer.length < MIN_IMAGE_BYTES || imageBuffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Fashion Report image size was outside the safe limits.");
  }

  return {
    weekNumber,
    reportTitle,
    imageBuffer,
    imageHash: createHash("sha256").update(imageBuffer).digest("hex")
  };
}

function makeMessage(source, closesAt) {
  const closeTimestamp = Math.floor(closesAt.getTime() / 1000);
  const filename = `fashion-report-week-${source.weekNumber}.png`;
  const embed = new EmbedBuilder()
    .setColor(0x8f2de2)
    .setTitle(`Fashion Report: Week ${source.weekNumber}`)
    .setURL(REPORT_URL)
    .setDescription(
      `**${source.reportTitle}**\n\nJudging closes <t:${closeTimestamp}:F> · <t:${closeTimestamp}:R>\n\nGuide by [Kaiyoko Star](${KAIYOKO_URL}).`
    )
    .setImage(`attachment://${filename}`)
    .setFooter({ text: "Weekly Fashion Report guide · FFXIV materials © SQUARE ENIX" });

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Detailed Guide").setURL(REPORT_URL),
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Kaiyoko on X").setURL(KAIYOKO_URL)
  );

  return {
    embeds: [embed],
    components: [buttons],
    files: [new AttachmentBuilder(source.imageBuffer, { name: filename })],
    allowedMentions: { parse: [] }
  };
}

async function recordState(pool, fields) {
  await pool.query(
    `update portal_fashion_report_state
     set week_number = coalesce($1, week_number),
         report_title = coalesce($2, report_title),
         image_hash = coalesce($3, image_hash),
         discord_channel_id = coalesce($4, discord_channel_id),
         discord_message_id = coalesce($5, discord_message_id),
         status = $6,
         error_text = $7,
         last_checked_at = now(),
         last_posted_at = case when $8 then now() else last_posted_at end,
         updated_at = now()
     where id = 1;`,
    [fields.weekNumber ?? null, fields.reportTitle ?? null, fields.imageHash ?? null,
      fields.channelId ?? null, fields.messageId ?? null, fields.status,
      fields.errorText ?? null, Boolean(fields.posted)]
  );
}

export async function ensureFashionReportTables(pool) {
  await pool.query(`
    create table if not exists portal_fashion_report_state (
      id integer primary key default 1,
      week_number integer,
      report_title text,
      image_hash text,
      discord_channel_id text,
      discord_message_id text,
      status text not null default 'idle',
      error_text text,
      last_checked_at timestamptz,
      last_posted_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint portal_fashion_report_state_singleton check (id = 1)
    );
  `);
  await pool.query(`insert into portal_fashion_report_state (id) values (1) on conflict (id) do nothing;`);
}

export async function processFashionReport({ pool, bot, getSettings, isNotificationWindowOpen, force = false }) {
  const nowMs = Date.now();
  if (!force && nowMs - lastAttemptAt < CHECK_INTERVAL_MS) return;
  if (syncRunning) return;
  lastAttemptAt = nowMs;
  syncRunning = true;

  try {
    const settings = await getSettings();
    if (!settings.fashion_report_enabled || !settings.fashion_report_channel_id) {
      await recordState(pool, { status: "disabled", errorText: null });
      return;
    }

    const window = getJudgingWindow();
    if (!window.isOpen) {
      await recordState(pool, { status: "waiting_for_judging", errorText: null });
      return;
    }
    if (!isNotificationWindowOpen(settings)) {
      await recordState(pool, { status: "waiting_for_notification_window", errorText: null });
      return;
    }

    const source = await readSource();
    const stateResult = await pool.query(`select * from portal_fashion_report_state where id = 1;`);
    const state = stateResult.rows[0] || {};
    const samePublishedGuide = Number(state.week_number) === source.weekNumber &&
      state.image_hash === source.imageHash &&
      state.discord_channel_id === settings.fashion_report_channel_id &&
      Boolean(state.discord_message_id);

    if (samePublishedGuide) {
      await recordState(pool, {
        weekNumber: source.weekNumber,
        reportTitle: source.reportTitle,
        imageHash: source.imageHash,
        status: "current",
        errorText: null
      });
      return;
    }

    const channel = await bot.channels.fetch(settings.fashion_report_channel_id);
    if (!channel?.isTextBased() || !channel.messages) {
      throw new Error("The configured Fashion Report destination is not a Discord text channel.");
    }

    let message = null;
    const canEditExisting = Number(state.week_number) === source.weekNumber &&
      state.discord_channel_id === settings.fashion_report_channel_id &&
      Boolean(state.discord_message_id);

    if (canEditExisting) {
      try {
        message = await channel.messages.fetch(state.discord_message_id);
        await message.edit({ ...makeMessage(source, window.closesAt), attachments: [] });
      } catch (error) {
        if (Number(error?.code) !== 10008) throw error;
        console.warn("[cotf-bot] Existing Fashion Report post no longer exists; sending a replacement.");
        message = null;
      }
    }

    if (!message) message = await channel.send(makeMessage(source, window.closesAt));

    await recordState(pool, {
      weekNumber: source.weekNumber,
      reportTitle: source.reportTitle,
      imageHash: source.imageHash,
      channelId: settings.fashion_report_channel_id,
      messageId: message.id,
      status: canEditExisting ? "updated" : "posted",
      errorText: null,
      posted: true
    });
    console.log(`[cotf-bot] Fashion Report Week ${source.weekNumber} ${canEditExisting ? "updated" : "posted"}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Fashion Report sync failed.";
    try {
      await recordState(pool, { status: "failed", errorText: message });
    } catch {
      // Preserve the source or Discord error if state recording also fails.
    }
    console.error("[cotf-bot] Fashion Report sync failed:", message);
  } finally {
    syncRunning = false;
  }
}
