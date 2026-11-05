import { parseInitData } from "../../server/telegram.js";
import { telegramSession } from "../../server/sheets.js";
import { handle, readJson, send, tokenFrom } from "../../server/http.js";

export default async function handler(req, res) {
  await handle(res, async () => {
    if (req.method !== "POST") {
      send(res, 405, { error: "Метод не поддерживается." });
      return;
    }
    const body = await readJson(req);
    const user = parseInitData(body.initData);
    send(res, 200, await telegramSession(tokenFrom(req), user.id));
  });
}
