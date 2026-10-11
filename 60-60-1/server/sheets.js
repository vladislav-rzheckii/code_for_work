import crypto from "node:crypto";
import { GoogleAuth } from "google-auth-library";
import { fail } from "./http.js";

const PEOPLE = "People";
const MARKS = "Marks";
const PEOPLE_HEADERS = ["id", "name", "goal", "startDate", "token", "createdAt", "photo"];
const MARK_HEADERS = ["personId", "date", "note", "updatedAt"];
const TOTAL_DAYS = 60;

let authClient;
let sheetsReady = false;
let photoHeaderReady = false;

function credentials() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!sheetId || !raw) {
    throw fail(503, "Таблица ещё не подключена.");
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw fail(503, "Ключ таблицы записан неверно.");
  }
  if (typeof parsed.private_key === "string") {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return { sheetId, parsed };
}

async function accessToken() {
  if (!authClient) {
    const { parsed } = credentials();
    const auth = new GoogleAuth({
      credentials: parsed,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    authClient = await auth.getClient();
  }
  const token = await authClient.getAccessToken();
  if (!token.token) throw fail(503, "Не удалось войти в таблицу.");
  return token.token;
}

async function sheets(path, options = {}) {
  const { sheetId } = credentials();
  const token = await accessToken();
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("sheets", response.status, JSON.stringify(data).slice(0, 500));
    throw fail(502, "Таблица не ответила.");
  }
  return data;
}

function todayISO() {
  const timeZone = process.env.CHALLENGE_TIMEZONE || "Europe/Moscow";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isISO(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function addDays(value, amount) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function cleanText(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u001F]/g, " ")
    .trim()
    .slice(0, max);
}

async function values(range) {
  const data = await sheets(`/values/${encodeURIComponent(range)}`);
  return data.values || [];
}

async function writeValues(range, rows) {
  await sheets(`/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: rows }),
  });
}

async function appendValues(range, rows) {
  await sheets(`/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values: rows }),
  });
}

async function ensureSheets() {
  if (sheetsReady) return;
  const meta = await sheets("?fields=sheets.properties.title");
  const titles = (meta.sheets || []).map((sheet) => sheet.properties.title);
  const requests = [];
  if (!titles.includes(PEOPLE)) requests.push({ addSheet: { properties: { title: PEOPLE } } });
  if (!titles.includes(MARKS)) requests.push({ addSheet: { properties: { title: MARKS } } });
  if (requests.length) {
    await sheets(":batchUpdate", { method: "POST", body: JSON.stringify({ requests }) });
  }
  const peopleHeader = await values(`${PEOPLE}!A1:F1`);
  if (peopleHeader[0]?.[0] !== "id") {
    await writeValues(`${PEOPLE}!A1:G1`, [PEOPLE_HEADERS]);
    photoHeaderReady = true;
  }
  const markHeader = await values(`${MARKS}!A1:D1`);
  if (markHeader[0]?.[0] !== "personId") await writeValues(`${MARKS}!A1:D1`, [MARK_HEADERS]);
  sheetsReady = true;
}

function safePhoto(value) {
  const photo = String(value || "");
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo)) return "";
  if (photo.length > 40000) return "";
  return photo;
}

async function ensurePhotoColumn() {
  if (photoHeaderReady) return;
  const header = await values(`${PEOPLE}!G1`);
  if (header[0]?.[0] !== "photo") await writeValues(`${PEOPLE}!G1`, [["photo"]]);
  photoHeaderReady = true;
}
function rowObject(headers, row) {
  const record = {};
  headers.forEach((header, index) => {
    record[header] = row[index] || "";
  });
  return record;
}

async function readPeople() {
  await ensureSheets();
  await ensurePhotoColumn();
  const rows = await values(`${PEOPLE}!A2:G`);
  return rows
    .map((row, index) => ({ ...rowObject(PEOPLE_HEADERS, row), row: index + 2 }))
    .filter((person) => person.id);
}

async function readMarks() {
  const rows = await values(`${MARKS}!A2:D`);
  return rows
    .map((row, index) => ({ ...rowObject(MARK_HEADERS, row), row: index + 2 }))
    .filter((mark) => mark.personId && mark.date);
}

function publicPeople(people, marks) {
  return people.map((person) => ({
    id: person.id,
    name: person.name,
    goal: person.goal,
    startDate: person.startDate,
    photo: safePhoto(person.photo),
    marks: marks.filter((mark) => mark.personId === person.id).map((mark) => mark.date),
  }));
}

function boardFor(people, marks, token) {
  const me = token ? people.find((person) => person.token === token) : null;
  if (token && !me) throw fail(401, "Код не подошёл.");
  const myMarks = {};
  if (me) {
    marks
      .filter((mark) => mark.personId === me.id)
      .forEach((mark) => {
        myMarks[mark.date] = mark.note || "";
      });
  }
  return {
    me: me ? { id: me.id, name: me.name, goal: me.goal, startDate: me.startDate, photo: safePhoto(me.photo) } : null,
    people: publicPeople(people, marks),
    myMarks,
  };
}

function photoFrom(body, fallback = "") {
  if (!Object.prototype.hasOwnProperty.call(body, "photo")) return fallback;
  const photo = String(body.photo || "");
  if (!photo) return "";
  if (!safePhoto(photo)) throw fail(400, "Фото слишком большое или записано неверно.");
  return photo;
}

function profileFrom(body) {
  const name = cleanText(body.name, 40);
  const goal = cleanText(body.goal, 80);
  const startDate = cleanText(body.startDate, 10);
  if (!name || !goal || !isISO(startDate)) {
    throw fail(400, "Нужны имя, цель и настоящая дата старта.");
  }
  return { name, goal, startDate };
}

export async function getBoard(token) {
  const people = await readPeople();
  const marks = await readMarks();
  return boardFor(people, marks, token);
}

export async function join(body) {
  const profile = profileFrom(body);
  const people = await readPeople();
  const person = {
    id: crypto.randomUUID(),
    name: profile.name,
    goal: profile.goal,
    startDate: profile.startDate,
    token: crypto.randomBytes(24).toString("hex"),
    createdAt: new Date().toISOString(),
    photo: photoFrom(body),
  };
  await appendValues(`${PEOPLE}!A:G`, [[person.id, person.name, person.goal, person.startDate, person.token, person.createdAt, person.photo]]);
  const marks = await readMarks();
  return { token: person.token, ...boardFor([...people, { ...person, row: 0 }], marks, person.token) };
}

export async function updateProfile(token, body) {
  if (!token) throw fail(401, "Сначала нужно начать челлендж.");
  const profile = profileFrom(body);
  const people = await readPeople();
  const me = people.find((person) => person.token === token);
  if (!me) throw fail(401, "Код не подошёл.");
  me.name = profile.name;
  me.goal = profile.goal;
  me.startDate = profile.startDate;
  me.photo = photoFrom(body, me.photo);
  await writeValues(`${PEOPLE}!A${me.row}:G${me.row}`, [[me.id, me.name, me.goal, me.startDate, me.token, me.createdAt, me.photo]]);
  const marks = await readMarks();
  return boardFor(people, marks, token);
}

function assertToday(person, date) {
  if (!isISO(date)) throw fail(400, "Нужна дата отметки.");
  if (date !== todayISO()) throw fail(400, "Отметить можно только сегодняшний день.");
  const end = addDays(person.startDate, TOTAL_DAYS - 1);
  if (date < person.startDate || date > end) throw fail(400, "Этот день вне твоих 60 дней.");
}

export async function setMark(token, body) {
  if (!token) throw fail(401, "Сначала нужно начать челлендж.");
  const people = await readPeople();
  const me = people.find((person) => person.token === token);
  if (!me) throw fail(401, "Код не подошёл.");
  const date = cleanText(body.date, 10);
  const note = cleanText(body.note, 280);
  assertToday(me, date);
  const marks = await readMarks();
  const existing = marks.find((mark) => mark.personId === me.id && mark.date === date);
  const updatedAt = new Date().toISOString();
  if (existing) {
    await writeValues(`${MARKS}!A${existing.row}:D${existing.row}`, [[me.id, date, note, updatedAt]]);
    existing.note = note;
  } else {
    marks.push({ personId: me.id, date, note, updatedAt, row: 0 });
    await appendValues(`${MARKS}!A:D`, [[me.id, date, note, updatedAt]]);
  }
  return boardFor(people, marks, token);
}

export async function clearMark(token, body) {
  if (!token) throw fail(401, "Сначала нужно начать челлендж.");
  const people = await readPeople();
  const me = people.find((person) => person.token === token);
  if (!me) throw fail(401, "Код не подошёл.");
  const date = cleanText(body.date, 10);
  assertToday(me, date);
  const marks = await readMarks();
  const existing = marks.find((mark) => mark.personId === me.id && mark.date === date);
  if (existing) {
    await writeValues(`${MARKS}!A${existing.row}:D${existing.row}`, [["", "", "", ""]]);
  }
  return boardFor(
    people,
    marks.filter((mark) => !(mark.personId === me.id && mark.date === date)),
    token,
  );
}
