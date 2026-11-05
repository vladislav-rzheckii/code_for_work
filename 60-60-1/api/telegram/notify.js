import { notifyTimeUp } from "../../server/sheets.js";
import { handle, readJson, send, tokenFrom } from "../../server/http.js";

export default async function handler(req, res) {
  await handle(res, async () => {
    if (req.method !== "POST") {
      send(res, 405, { error: "Метод не поддерживается." });
      return;
    }
    const body = await readJson(req);
    if (body.event !== "timeup") {
      send(res, 400, { error: "Нужно событие конца часа." });
      return;
    }
    send(res, 200, await notifyTimeUp(tokenFrom(req)));
  });
}
