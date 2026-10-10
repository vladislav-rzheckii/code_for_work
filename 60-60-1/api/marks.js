import { clearMark, setMark } from "../server/sheets.js";
import { handle, readJson, send, tokenFrom } from "../server/http.js";

export default async function handler(req, res) {
  await handle(res, async () => {
    const body = await readJson(req);
    if (req.method === "POST") {
      send(res, 200, await setMark(tokenFrom(req), body));
      return;
    }
    if (req.method === "DELETE") {
      send(res, 200, await clearMark(tokenFrom(req), body));
      return;
    }
    send(res, 405, { error: "Метод не поддерживается." });
  });
}
