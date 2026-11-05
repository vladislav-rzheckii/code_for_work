import crypto from "node:crypto";
import { parseInitData } from "../server/telegram.js";

process.env.TELEGRAM_BOT_TOKEN = "123456:TEST";

function makeInitData(user, authDate) {
  const params = {
    auth_date: String(authDate),
    query_id: "AAEtest",
    user: JSON.stringify(user),
  };
  const dataCheckString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(process.env.TELEGRAM_BOT_TOKEN).digest();
  const hash = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...params, hash }).toString();
}

const ok = parseInitData(makeInitData({ id: 42, first_name: "Влад" }, Math.floor(Date.now() / 1000)));
if (ok.id !== "42") throw new Error("id");
let failed = false;
try {
  parseInitData(makeInitData({ id: 42, first_name: "Влад" }, Math.floor(Date.now() / 1000)).replace("42", "43"));
} catch {
  failed = true;
}
if (!failed) throw new Error("tamper");
console.log("initData ok");
