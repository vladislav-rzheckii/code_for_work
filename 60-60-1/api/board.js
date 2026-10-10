import { getBoard } from "../server/sheets.js";
import { handle, send, tokenFrom } from "../server/http.js";

export default async function handler(req, res) {
  await handle(res, async () => {
    if (req.method !== "GET") {
      send(res, 405, { error: "Метод не поддерживается." });
      return;
    }
    send(res, 200, await getBoard(tokenFrom(req)));
  });
}
