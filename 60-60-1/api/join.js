import { join } from "../server/sheets.js";
import { parseInitData } from "../server/telegram.js";
import { handle, readJson, send } from "../server/http.js";

export default async function handler(req, res) {
  await handle(res, async () => {
    if (req.method !== "POST") {
      send(res, 405, { error: "Метод не поддерживается." });
      return;
    }
    const body = await readJson(req);
    if (body.initData) body.telegramId = parseInitData(body.initData).id;
    else delete body.telegramId;
    const result = await join(body);
    send(res, 201, result);
  });
}
