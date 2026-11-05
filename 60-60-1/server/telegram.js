import crypto from "node:crypto";
import { fail } from "./http.js";

const INIT_MAX_AGE = 24 * 60 * 60;

export function botToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  if (!token) throw fail(503, "Бот ещё не подключён.");
  return token;
}

export function appUrl() {
  return String(process.env.TELEGRAM_APP_URL || "https://60-60-1.vercel.app").replace(/\/$/, "");
}

export function parseInitData(raw) {
  const initData = String(raw || "");
  if (!initData) throw fail(401, "Открой челлендж из Telegram.");
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") || "";
  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken()).digest();
  const digest = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (!/^[0-9a-f]{64}$/i.test(hash)) throw fail(401, "Сессия Telegram не подошла.");
  const given = Buffer.from(hash, "hex");
  const expected = Buffer.from(digest, "hex");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    throw fail(401, "Сессия Telegram не подошла.");
  }
  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > INIT_MAX_AGE) {
    throw fail(401, "Сессия Telegram устарела. Открой челлендж ещё раз.");
  }
  let user;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch {
    user = null;
  }
  const id = user && user.id != null ? String(user.id) : "";
  if (!/^\d+$/.test(id)) throw fail(401, "Сессия Telegram не подошла.");
  return { id, firstName: String(user.first_name || "").slice(0, 64) };
}

export async function telegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!data.ok) {
    console.error("telegram", method, JSON.stringify(data).slice(0, 400));
    throw fail(502, "Бот не ответил.");
  }
  return data.result;
}

export async function sendTelegram(chatId, text, extra = {}) {
  if (!chatId) return false;
  await telegram("sendMessage", { chat_id: chatId, text, ...extra });
  return true;
}

export function webhookSecretOk(req) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  if (!expected) return false;
  return req.headers["x-telegram-bot-api-secret-token"] === expected;
}

export function cronSecretOk(req) {
  const expected = process.env.CRON_SECRET || "";
  if (!expected) return false;
  const header = req.headers.authorization || "";
  return header === `Bearer ${expected}`;
}

export const TIME_UP_TEXT = "Время вышло. Час закрыт, день отмечен.";
export const REMIND_TEXT = "Сегодня час ещё впереди. Открой 60/60/1 и поработай над целью.";
export const START_TEXT = "60 минут · 60 дней · 1 цель.\nОткрой челлендж кнопкой ниже и двигайся вместе с друзьями.";

export function webAppKeyboard() {
  return {
    keyboard: [[{ text: "Открыть челлендж", web_app: { url: appUrl() } }]],
    resize_keyboard: true,
  };
}

export async function configureBot() {
  const url = `${appUrl()}/api/telegram/webhook`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  if (!secret) throw fail(503, "Нужен TELEGRAM_WEBHOOK_SECRET.");
  const me = await telegram("getMe", {});
  await telegram("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message"],
  });
  await telegram("setChatMenuButton", {
    menu_button: { type: "web_app", text: "Челлендж", web_app: { url: appUrl() } },
  });
  await telegram("setMyCommands", {
    commands: [{ command: "start", description: "Открыть челлендж 60/60/1" }],
  });
  return { username: me.username, url };
}
