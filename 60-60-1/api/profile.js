import { updateProfile } from "../server/sheets.js";
import { handle, readJson, send, tokenFrom } from "../server/http.js";

export default async function handler(req, res) {
  await handle(res, async () => {
    if (req.method !== "PATCH" && req.method !== "POST") {
      send(res, 405, { error: "Метод не поддерживается." });
      return;
    }
    send(res, 200, await updateProfile(tokenFrom(req), await readJson(req)));
  });
}
