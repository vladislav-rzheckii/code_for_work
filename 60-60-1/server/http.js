export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

export function tokenFrom(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return "";
}

export function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100000) reject(fail(413, "Слишком большой запрос."));
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(fail(400, "Некорректный запрос."));
      }
    });
    req.on("error", reject);
  });
}

export function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function handle(res, task) {
  try {
    await task();
  } catch (error) {
    const status = error.status || 500;
    const message = status === 500 ? "Не получилось сохранить данные." : error.message;
    send(res, status, { error: message });
  }
}
