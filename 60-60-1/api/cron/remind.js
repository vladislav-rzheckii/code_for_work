import { remindUnmarked } from "../../server/sheets.js";
import { cronSecretOk } from "../../server/telegram.js";
import { handle, send } from "../../server/http.js";

export default async function handler(req, res) {
  await handle(res, async () => {
    if (req.method !== "GET" && req.method !== "POST") {
      send(res, 405, { error: "Метод не поддерживается." });
      return;
    }
    if (!cronSecretOk(req)) {
      send(res, 401, { error: "Секрет расписания не подошёл." });
      return;
    }
    send(res, 200, await remindUnmarked());
  });
}
