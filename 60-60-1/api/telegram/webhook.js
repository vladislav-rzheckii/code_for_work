import { sendTelegram, START_TEXT, webAppKeyboard, webhookSecretOk } from "../../server/telegram.js";
import { handle, readJson, send } from "../../server/http.js";

export default async function handler(req, res) {
  await handle(res, async () => {
    if (req.method !== "POST") {
      send(res, 405, { error: "Метод не поддерживается." });
      return;
    }
    if (!webhookSecretOk(req)) {
      send(res, 401, { error: "Секрет вебхука не подошёл." });
      return;
    }
    const update = await readJson(req);
    const message = update.message;
    const text = message && typeof message.text === "string" ? message.text : "";
    const chatId = message && message.chat && message.chat.id;
    if (chatId && text.startsWith("/start")) {
      await sendTelegram(chatId, START_TEXT, { reply_markup: webAppKeyboard() });
    }
    send(res, 200, { ok: true });
  });
}
