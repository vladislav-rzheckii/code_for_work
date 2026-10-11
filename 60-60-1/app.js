const TOTAL_DAYS = 60;
const FULL_MS = 60 * 60 * 1000;
const VIEWS = ["today", "days", "friends", "setup"];
const NAV = [
  { id: "today", label: "Сегодня", short: "Сегодня" },
  { id: "days", label: "60 дней", short: "Дни" },
  { id: "friends", label: "Друзья", short: "Друзья" },
  { id: "setup", label: "Старт", short: "Старт" },
];
const NAV_ICONS = {
  today: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7.25"/><path d="M12 8.2V12l2.4 1.6"/></svg>`,
  days: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3.5v3M16 3.5v3M4 10h16"/></svg>`,
  friends: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="2.3"/><circle cx="16" cy="9" r="1.9"/><path d="M4.8 18.2c.5-2.5 2.3-3.9 4.2-3.9s3.7 1.4 4.2 3.9"/><path d="M13.2 14.7c1-.4 2.1-.5 3.2-.1 1.4.5 2.3 1.8 2.7 3.4"/></svg>`,
  setup: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 20V4.5"/><path d="M6 5.2h11.2L14.4 8.6l2.8 3.4H6"/></svg>`,
};
const TOKEN_KEY = "challenge-60601-token";
const DESIGN_KEY = "challenge-60601-design";

const longDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const fullDate = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const state = {
  name: "",
  goal: "",
  photo: "",
  start: "",
  marks: {},
  people: [],
  meId: null,
  status: "loading",
  error: "",
  busy: false,
  noteDraft: null,
  editingNote: false,
  selectedOffset: null,
  notice: "",
  noticeTimer: 0,
  timer: {
    remainingMs: FULL_MS,
    running: false,
    endsAt: null,
  },
};

state.start = iso(today());

const root = document.getElementById("app");

function joined() {
  return Boolean(state.meId);
}

function today() {
  const value = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parseISO(value);
}

function parseISO(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function iso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, amount) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

function dayDiff(from, to) {
  const utc = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((utc(to) - utc(from)) / 86400000);
}

function isValidISO(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseISO(value);
  return !Number.isNaN(date.getTime()) && iso(date) === value;
}

function todayIndex() {
  if (!isValidISO(state.start)) return NaN;
  return dayDiff(parseISO(state.start), today());
}

function getPhase() {
  if (!joined()) return "guest";
  const index = todayIndex();
  if (!Number.isFinite(index) || index < 0) return "upcoming";
  if (index > TOTAL_DAYS - 1) return "finished";
  return "active";
}

function plural(amount, one, few, many) {
  const abs = Math.abs(amount) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function safePhoto(value) {
  return /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value || "") && value.length <= 40000 ? value : "";
}

function avatarMarkup(person, large) {
  const photo = safePhoto(person.photo);
  const cls = large ? "avatar large" : "avatar";
  if (photo) return `<img class="${cls}" src="${esc(photo)}" alt="" />`;
  return `<span class="${cls} face" aria-hidden="true"><svg viewBox="0 0 48 48"><circle cx="17" cy="20" r="2.4"/><circle cx="31" cy="20" r="2.4"/><path d="M16 29.5c2.4 3.2 5.2 4.6 8 4.6s5.6-1.4 8-4.6" fill="none" stroke-width="2.4" stroke-linecap="round"/></svg></span>`;
}

function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      const scale = Math.max(size / image.width, size / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      let quality = 0.72;
      let data = canvas.toDataURL("image/jpeg", quality);
      while (data.length > 40000 && quality > 0.4) {
        quality -= 0.08;
        data = canvas.toDataURL("image/jpeg", quality);
      }
      if (!safePhoto(data)) {
        reject(new Error("Фото слишком большое."));
        return;
      }
      resolve(data);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Фото не открылось."));
    };
    image.src = url;
  });
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

function displayName() {
  return state.name.trim() || "Без имени";
}

function goalTitle() {
  return state.goal.trim() || "Цель не задана";
}

function dateForOffset(offset) {
  return addDays(parseISO(state.start), offset);
}

function cellOn(startDate, marks, offset) {
  const index = isValidISO(startDate) ? dayDiff(parseISO(startDate), today()) : NaN;
  if (!Number.isFinite(index) || offset < 0 || offset > TOTAL_DAYS - 1) return "future";
  if (index < 0 || offset > index) return "future";
  const marked = marks.has(iso(addDays(parseISO(startDate), offset)));
  if (index <= TOTAL_DAYS - 1 && offset === index) return marked ? "done" : "today";
  return marked ? "done" : "missed";
}

function userMarks() {
  return new Set(Object.keys(state.marks));
}

function userCell(offset) {
  return cellOn(state.start, userMarks(), offset);
}

function phaseFrom(index) {
  if (!Number.isFinite(index) || index < 0) return "upcoming";
  if (index > TOTAL_DAYS - 1) return "finished";
  return "active";
}

function streakFrom(cellAt, index) {
  if (!Number.isFinite(index) || index < 0) return 0;
  let cursor = Math.min(index, TOTAL_DAYS - 1);
  if (index <= TOTAL_DAYS - 1 && cellAt(cursor) !== "done") cursor -= 1;
  let streak = 0;
  while (cursor >= 0 && cellAt(cursor) === "done") {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

function countCells(cellAt) {
  let done = 0;
  let missed = 0;
  for (let offset = 0; offset < TOTAL_DAYS; offset += 1) {
    const cell = cellAt(offset);
    if (cell === "done") done += 1;
    if (cell === "missed") missed += 1;
  }
  return { done, missed, hasMiss: missed > 0 };
}

function summaryFrom(index, cellAt, extra) {
  const phase = phaseFrom(index);
  const dayNumber = phase === "upcoming" ? 0 : phase === "finished" ? TOTAL_DAYS : index + 1;
  return {
    ...extra,
    phase,
    dayNumber,
    checkedIn: phase === "active" && cellAt(Math.min(index, TOTAL_DAYS - 1)) === "done" && index <= TOTAL_DAYS - 1,
    streak: streakFrom(cellAt, index),
    ...countCells(cellAt),
  };
}

function userSummary() {
  return summaryFrom(todayIndex(), userCell, {
    name: displayName(),
    goal: state.goal.trim(),
    you: true,
  });
}

function recordSummary(person) {
  const marks = new Set(person.marks || []);
  const index = isValidISO(person.startDate) ? dayDiff(parseISO(person.startDate), today()) : NaN;
  return summaryFrom(index, (offset) => cellOn(person.startDate, marks, offset), {
    name: person.name,
    goal: person.goal,
    photo: safePhoto(person.photo),
    you: person.id === state.meId,
  });
}

function people() {
  return state.people
    .map(recordSummary)
    .sort((a, b) => b.dayNumber - a.dayNumber || a.name.localeCompare(b.name, "ru"));
}

function formatRange() {
  const start = parseISO(state.start);
  const end = addDays(start, TOTAL_DAYS - 1);
  const withYear = start.getFullYear() !== end.getFullYear();
  const format = withYear
    ? (date) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(date)
    : (date) => longDate.format(date);
  return `${format(start)} — ${format(end)}`;
}

function describeStart(value) {
  if (!isValidISO(value)) return "Выберите дату старта.";
  const index = dayDiff(parseISO(value), today());
  if (index < 0) {
    const left = Math.abs(index);
    return `Ты начнёшь через ${left} ${plural(left, "день", "дня", "дней")}.`;
  }
  if (index > TOTAL_DAYS - 1) return "Твои 60 дней уже закончились.";
  return `Сейчас твой день ${index + 1} из 60.`;
}

function progressLabel() {
  const phase = getPhase();
  if (phase === "guest" || phase === "upcoming") return "старт";
  if (phase === "finished") return "60/60";
  return `${todayIndex() + 1}/60`;
}

function currentView() {
  const id = location.hash.replace("#", "");
  return VIEWS.includes(id) ? id : "today";
}

function displayRemaining() {
  if (state.timer.running && state.timer.endsAt) {
    return Math.max(0, state.timer.endsAt - Date.now());
  }
  return state.timer.remainingMs;
}

function formatMs(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function elapsedRatio(ms) {
  return Math.min(1, Math.max(0, (FULL_MS - ms) / FULL_MS));
}

function navLinks(view, short) {
  return NAV.map((item) => {
    const current = item.id === view ? ' aria-current="page"' : "";
    const label = short ? item.short : item.label;
    const icon = short
      ? `<span class="nav-icon" aria-hidden="true">${NAV_ICONS[item.id]}</span>`
      : "";
    return `<a href="#${item.id}"${current}>${icon}${label}</a>`;
  }).join("");
}

const THEMES = {
  paper: { label: "Светлая", color: "#e4dfd6" },
  ink: { label: "Тёмная", color: "#121418" },
  rose: { label: "Розовая", color: "#ffd0e6" },
};

function savedDesign() {
  try {
    const saved = localStorage.getItem(DESIGN_KEY);
    return Object.prototype.hasOwnProperty.call(THEMES, saved) ? saved : "paper";
  } catch {
    return "paper";
  }
}

function applyDesign(name) {
  const design = Object.prototype.hasOwnProperty.call(THEMES, name) ? name : "paper";
  document.documentElement.dataset.design = design;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = THEMES[design].color;
  document.querySelectorAll(".design-choice").forEach((button) => {
    button.setAttribute("aria-pressed", button.dataset.theme === design ? "true" : "false");
  });
}

function designToggle() {
  const current = document.documentElement.dataset.design || "paper";
  const buttons = Object.entries(THEMES)
    .map(([id, theme]) => {
      const pressed = id === current ? "true" : "false";
      return `<button type="button" class="design-choice" data-action="set-design" data-theme="${id}" aria-pressed="${pressed}">${theme.label}</button>`;
    })
    .join("");
  return `<div class="design-bar" role="group" aria-label="Оформление">${buttons}</div>`;
}

function setDesign(name) {
  applyDesign(name);
  try {
    localStorage.setItem(DESIGN_KEY, document.documentElement.dataset.design);
  } catch {
    /* the choice still applies for this visit */
  }
}

function renderHeader(view) {
  return `
    ${designToggle()}
    <header class="header">
      <div class="brand">
        <div class="logo">60/60/1</div>
        <div class="tagline">60 минут · 60 дней · 1 цель</div>
      </div>
      <nav class="desktop-nav" aria-label="Разделы">${navLinks(view, false)}</nav>
      <p class="header-day">${esc(progressLabel())}</p>
    </header>
  `;
}

function renderTabbar(view) {
  return `<nav class="tabbar" aria-label="Разделы">${navLinks(view, true)}</nav>`;
}

function renderStats(summary) {
  return `
    <div class="stats">
      <div class="stat streak-stat${summary.streak > 0 ? " hot" : ""}">
        <strong>${summary.streak}</strong>
        <span>${plural(summary.streak, "день подряд", "дня подряд", "дней подряд")}</span>
      </div>
      <div class="stat">
        <strong>${summary.done}</strong>
        <span>отмечено</span>
      </div>
      <div class="stat">
        <strong>${summary.missed}</strong>
        <span>${plural(summary.missed, "пропуск", "пропуска", "пропусков")}</span>
      </div>
    </div>
  `;
}

function renderTimer(summary) {
  const left = displayRemaining();
  const running = state.timer.running;
  let controls = "";
  if (running) {
    controls = `
      <button type="button" class="text-btn" data-action="pause-timer">Пауза</button>
      <button type="button" class="text-btn muted" data-action="reset-timer">Сбросить</button>
    `;
  } else if (left <= 0) {
    controls = `<button type="button" class="text-btn" data-action="reset-timer">Сбросить</button>`;
  } else {
    const resume = left < FULL_MS - 500;
    controls = `
      <button type="button" class="text-btn" data-action="start-timer">${resume ? "Продолжить" : "Начать"}</button>
      ${resume ? '<button type="button" class="text-btn muted" data-action="reset-timer">Сбросить</button>' : ""}
    `;
  }
  const hint =
    !running && left <= 0 && !summary.checkedIn
      ? '<p class="hint">Час на таймере прошёл — день можно отметить.</p>'
      : "";
  return `
    <section class="timer" aria-label="Таймер на 60 минут">
      <p class="timer-label">Час на цель</p>
      <p class="clock" id="clock">${formatMs(left)}</p>
      <div class="track" aria-hidden="true"><div class="fill" id="timer-fill" style="transform: scaleX(${elapsedRatio(left)})"></div></div>
      <div class="timer-actions">${controls}</div>
      ${hint}
    </section>
  `;
}

function explicitMark(offset) {
  if (!isValidISO(state.start) || offset < 0) return null;
  const key = iso(dateForOffset(offset));
  if (!Object.prototype.hasOwnProperty.call(state.marks, key)) return null;
  const value = state.marks[key];
  return value && typeof value === "object" ? value : { note: "" };
}

function noteForOffset(offset) {
  const mark = explicitMark(offset);
  return mark ? (mark.note || "").trim() : "";
}

function composerValue() {
  if (state.noteDraft != null) return state.noteDraft;
  const index = todayIndex();
  const mark = explicitMark(index);
  return mark ? mark.note || "" : "";
}

function renderNoteComposer(summary) {
  const hint = summary.checkedIn
    ? "Можно поправить текст и сохранить."
    : "Заметка необязательна и сохранится вместе с отметкой.";
  const actions = summary.checkedIn
    ? `<button type="button" class="btn" data-action="save-note">Сохранить заметку</button>
       <button type="button" class="text-btn muted" data-action="cancel-note">Отмена</button>`
    : `<button type="button" class="btn" data-action="mark">Отметить день</button>`;
  return `
    <label class="field note-field">
      <span>Заметка</span>
      <textarea id="field-note" maxlength="280" rows="3" placeholder="Что получилось за этот час">${esc(composerValue())}</textarea>
    </label>
    <p class="hint">${hint}</p>
    <div class="mark-actions">${actions}</div>
  `;
}

function renderMark(summary) {
  const index = todayIndex();
  const note = noteForOffset(index);
  if (summary.checkedIn && !state.editingNote) {
    return `
      <div class="mark-row">
        <p class="confirmed">Сегодня отмечено</p>
        ${note ? `<blockquote class="day-note">${esc(note)}</blockquote>` : ""}
        <div class="mark-actions">
          <button type="button" class="text-btn" data-action="edit-note">${note ? "Изменить заметку" : "Добавить заметку"}</button>
          <button type="button" class="text-btn muted" data-action="unmark">Снять отметку</button>
        </div>
      </div>
    `;
  }
  return renderNoteComposer(summary);
}

function friendsLine() {
  const lead = people()
    .filter((person) => !person.you && person.phase === "active")
    .sort((a, b) => b.dayNumber - a.dayNumber)[0];
  if (!lead) return joined() ? "Пока здесь только ты" : "Друзей пока нет";
  if (lead.streak > 0) {
    return `${lead.name} держит серию ${lead.streak} ${plural(lead.streak, "день", "дня", "дней")}`;
  }
  return `${lead.name} на дне ${lead.dayNumber} из 60`;
}

function renderGuest() {
  return `
    <div class="narrow">
      <p class="kicker">Можно начать в любой день</p>
      <h1>Одна цель на 60 дней</h1>
      <p class="intro">Выбери цель которую хочешь достичь и стартуй. Смотри на друзей и мотивируйся их успехом.</p>
      <div class="links">
        <a class="quiet-link" href="#setup">Выбрать старт</a>
        <a class="quiet-link" href="#friends">${esc(friendsLine())}</a>
      </div>
    </div>
  `;
}

function renderToday() {
  const phase = getPhase();
  if (phase === "guest") return renderGuest();
  const summary = userSummary();
  const startText = isValidISO(state.start) ? longDate.format(parseISO(state.start)) : "";
  let kicker = "Можно начать в любой день";
  let sub = startText ? `Твой старт ${startText}` : "";
  if (phase === "finished") {
    kicker = "Твои 60 дней позади";
    sub = formatRange();
  }
  if (phase === "active") {
    kicker = `Твой день ${todayIndex() + 1} из 60`;
    sub = `Старт ${startText}`;
  }
  let body = "";
  if (phase === "upcoming") {
    const left = Math.abs(todayIndex());
    body = `
      <p class="intro">До твоего старта ${left} ${plural(left, "день", "дня", "дней")}. Друзья уже идут своим темпом.</p>
      <div class="links">
        <a class="quiet-link" href="#friends">${esc(friendsLine())}</a>
        <a class="quiet-link" href="#setup">Выбрать свою дату</a>
      </div>
    `;
  } else if (phase === "finished") {
    body = `
      ${renderStats(summary)}
      <div class="links">
        <a class="quiet-link" href="#days">Смотреть все 60 дней</a>
        <a class="quiet-link" href="#friends">${esc(friendsLine())}</a>
      </div>
    `;
  } else {
    const note =
      summary.streak === 0 && summary.hasMiss
        ? '<p class="streak-note">Последний пропуск обнулил серию. Отмеченный сегодня день начнёт новую.</p>'
        : "";
    body = `
      ${renderTimer(summary)}
      ${renderMark(summary)}
      ${note}
      ${renderStats(summary)}
      <div class="links"><a class="quiet-link" href="#friends">${esc(friendsLine())}</a></div>
    `;
  }
  return `
    <div class="narrow">
      <p class="kicker">${esc(kicker)}</p>
      <h1>${esc(goalTitle())}</h1>
      <p class="sub">${esc(sub)}</p>
      ${body}
    </div>
  `;
}

function activeOffset() {
  if (state.selectedOffset == null) {
    const index = todayIndex();
    if (!Number.isFinite(index) || index < 0) return 0;
    return Math.min(index, TOTAL_DAYS - 1);
  }
  return Math.min(TOTAL_DAYS - 1, Math.max(0, state.selectedOffset));
}

function renderDays() {
  if (!joined()) {
    return `
      <h1>60 дней работы над собой</h1>
      <p class="intro">Календарь появится после того, как выберешь свою дату старта.</p>
      <div class="links"><a class="quiet-link" href="#setup">Выбрать старт</a></div>
    `;
  }
  const summary = userSummary();
  const selected = activeOffset();
  const index = todayIndex();
  const buttons = [];
  for (let offset = 0; offset < TOTAL_DAYS; offset += 1) {
    const cell = userCell(offset);
    const note = noteForOffset(offset);
    const classes = ["day", cell];
    if (note) classes.push("noted");
    if (offset === index && index >= 0 && index <= TOTAL_DAYS - 1) classes.push("today");
    if (offset === selected) classes.push("selected");
    const todayNote = offset === index && cell === "done" ? "сегодня, час отмечен" : "";
    const names = {
      done: "час отмечен",
      missed: "пропуск",
      today: "сегодня, ещё не отмечен",
      future: "ещё впереди",
    };
    const label = `День ${offset + 1}, ${todayNote || names[cell]}${note ? ", есть заметка" : ""}`;
    buttons.push(
      `<button type="button" class="${classes.join(" ")}" data-action="select-day" data-offset="${offset}" aria-pressed="${offset === selected}" aria-label="${esc(label)}">${offset + 1}</button>`,
    );
  }
  const cell = userCell(selected);
  const selectedNote = noteForOffset(selected);
  const title = `День ${selected + 1} · ${fullDate.format(dateForOffset(selected))}`;
  let text = "Этот день ещё впереди.";
  let link = "";
  if (cell === "done" && selected === index) text = "Сегодняшний час отмечен.";
  else if (cell === "done") text = "Час отмечен.";
  else if (cell === "missed") text = "Пропуск. Серия здесь обнулилась. Задним числом день не закрывается.";
  else if (cell === "today") {
    text = "Сегодня ещё не отмечен.";
    link = '<a class="quiet-link" href="#today">Отметить день</a>';
  }
  const noteHtml = selectedNote ? `<blockquote class="day-note">${esc(selectedNote)}</blockquote>` : "";
  const line =
    summary.done === 0 && summary.missed === 0
      ? "Отметок пока нет"
      : `${summary.done} отмечено · ${summary.missed} ${plural(summary.missed, "пропуск", "пропуска", "пропусков")}`;
  return `
    <p class="kicker">${esc(formatRange())}</p>
    <h1>60 дней работы над собой</h1>
    <p class="intro">Двигайся вперед, но помни, один пропуск обнуляет серию.</p>
    <p class="summary-line">${esc(line)}</p>
    <ul class="legend">
      <li><i class="swatch done"></i> Сделано</li>
      <li><i class="swatch noted"></i> С заметкой</li>
      <li><i class="swatch missed"></i> Пропуск</li>
      <li><i class="swatch today"></i> Сегодня</li>
      <li><i class="swatch future"></i> Впереди</li>
    </ul>
    <div class="grid" role="group" aria-label="Шестьдесят дней челленджа">${buttons.join("")}</div>
    <div class="detail">
      <p class="detail-title">${esc(title)}</p>
      <p>${esc(text)}</p>
      ${noteHtml}
      ${link}
    </div>
    <p class="fine">Это твой календарь. Пропуск — день, который уже прошёл без отметки. Друзья идут со своих дат.</p>
  `;
}

function progressLine(person) {
  if (person.phase === "upcoming") return "старт впереди";
  if (person.phase === "finished") return "60 дней позади";
  return `день ${person.dayNumber} из 60`;
}

function streakBlock(person) {
  if (person.phase !== "active" || person.streak <= 0) return "";
  const caption = `${plural(person.streak, "день", "дня", "дней")} подряд`;
  return `
    <span class="streak-mark hot">
      <strong>${person.streak}</strong>
      <span class="streak-caption">${caption}</span>
    </span>
  `;
}

function todayLine(person) {
  if (person.phase === "finished") return `${person.done} из 60 часов`;
  if (person.phase !== "active") return "";
  return person.checkedIn ? "сегодня час закрыт" : "сегодня час впереди";
}

function renderFriends() {
  const items = people()
    .map((person) => {
      const ratio = person.phase === "upcoming" ? 0 : person.dayNumber / TOTAL_DAYS;
      const kind = person.phase === "active" && person.checkedIn ? "in" : "plain";
      return `
        <li${person.you ? ' class="is-you"' : ""}>
          <div class="person-head">
            ${avatarMarkup(person)}
            <div class="person-id">
              <div class="person-name">${esc(person.name)}${person.you ? ' <span class="you-tag">вы</span>' : ""}</div>
              <div class="person-goal">${esc(person.goal || "Цель не задана")}</div>
            </div>
          </div>
          <div class="person-meta">
            <div class="person-facts">
              <span class="mark ${kind}">${esc(progressLine(person))}</span>
              ${todayLine(person) ? `<span class="person-streak">${esc(todayLine(person))}</span>` : ""}
            </div>
            ${streakBlock(person)}
          </div>
          <div class="person-track" aria-hidden="true"><i style="transform: scaleX(${ratio})"></i></div>
        </li>
      `;
    })
    .join("");
  return `
    <p class="kicker">Каждый со своего дня</p>
    <h1>Друзья</h1>
    <p class="intro">У каждого своя дата старта. Кто-то начал раньше, кто-то только входит, но все двигаются к достижению цели.</p>
    ${items ? `<ul class="people">${items}</ul>` : `<p class="summary-line">Пока никто не начал.</p>`}
  `;
}

function renderSetup() {
  return `
    <div class="narrow">
      <h1>Старт</h1>
      <p class="intro">Присоединяйся к челленджу 60-60-1. Мотивируйся успехом друзей и стань лучшей версией себя.</p>
      <form id="setup-form">
        <div class="photo-field">
          <button type="button" class="avatar-pick" data-action="pick-photo" aria-label="Выбрать фото">${avatarMarkup({ name: state.name, photo: state.photo }, true)}</button>
          <div>
            <span>Фото профиля</span>
            <p class="hint">Друзья увидят его в карточке.</p>
            ${state.photo ? '<button type="button" class="text-btn" data-action="clear-photo">Убрать фото</button>' : ""}
          </div>
          <input id="field-photo" type="file" accept="image/*" hidden />
        </div>
        <label class="field">
          <span>Как к вам обращаться</span>
          <input id="field-name" name="name" type="text" maxlength="40" required value="${esc(state.name)}" />
        </label>
        <label class="field">
          <span>Цель на 60 дней</span>
          <input id="field-goal" name="goal" type="text" maxlength="80" required value="${esc(state.goal)}" />
        </label>
        <label class="field">
          <span>Твой день старта</span>
          <input id="field-start" name="start" type="date" required value="${esc(state.start)}" />
        </label>
        <p class="preview" id="setup-preview">${esc(describeStart(state.start))}</p>
        <div class="form-actions"><button class="btn" type="submit" ${state.busy ? "disabled" : ""}>${joined() ? "Сохранить" : "Начать челлендж"}</button></div>
        <p class="notice" id="notice" role="status">${esc(state.notice)}</p>
      </form>
      ${
        joined()
          ? `<button type="button" class="text-btn" data-action="copy-code">Скопировать код устройства</button>`
          : `<label class="field">
              <span>Код устройства, если уже начинал</span>
              <input id="field-code" type="text" autocomplete="off" />
            </label>
            <button type="button" class="text-btn" data-action="use-code">Открыть по коду</button>`
      }
      <p class="fine">Отметки хранятся в общей таблице. Код устройства открывает того же человека на другом телефоне.</p>
    </div>
  `;
}

function render() {
  if (state.status === "loading") {
    root.innerHTML = `<div class="wrap">${designToggle()}<main class="narrow"><p class="kicker">60/60/1</p><h1>Загрузка</h1></main></div>`;
    return;
  }
  if (state.status === "error") {
    root.innerHTML = `
      <div class="wrap">${designToggle()}<main class="narrow">
        <p class="kicker">60/60/1</p>
        <h1>Не открылось</h1>
        <p class="intro">${esc(state.error)}</p>
        <button class="btn" type="button" data-action="retry">Повторить</button>
      </main></div>
    `;
    return;
  }
  const view = currentView();
  const screen = {
    today: renderToday,
    days: renderDays,
    friends: renderFriends,
    setup: renderSetup,
  }[view];
  root.innerHTML = `
    <div class="wrap">
      ${renderHeader(view)}
      <main>${screen()}</main>
    </div>
    ${renderTabbar(view)}
  `;
  paintTimer();
}

function paintTimer(ms) {
  const left = ms == null ? displayRemaining() : ms;
  const clock = document.getElementById("clock");
  const fill = document.getElementById("timer-fill");
  if (clock) clock.textContent = formatMs(left);
  if (fill) fill.style.transform = `scaleX(${elapsedRatio(left)})`;
}

function tick() {
  if (!state.timer.running || !state.timer.endsAt) return;
  const left = state.timer.endsAt - Date.now();
  if (left <= 0) {
    state.timer.remainingMs = 0;
    state.timer.running = false;
    state.timer.endsAt = null;
    render();
    return;
  }
  state.timer.remainingMs = left;
  paintTimer(left);
}

function startTimer() {
  if (state.timer.running) return;
  if (state.timer.remainingMs <= 0) state.timer.remainingMs = FULL_MS;
  state.timer.endsAt = Date.now() + state.timer.remainingMs;
  state.timer.running = true;
  render();
}

function pauseTimer() {
  if (!state.timer.running || !state.timer.endsAt) return;
  state.timer.remainingMs = Math.max(0, state.timer.endsAt - Date.now());
  state.timer.running = false;
  state.timer.endsAt = null;
  render();
}

function resetTimer() {
  state.timer.running = false;
  state.timer.endsAt = null;
  state.timer.remainingMs = FULL_MS;
}

function readNoteDraft() {
  const field = document.getElementById("field-note");
  if (field) return field.value;
  return state.noteDraft || "";
}

function token() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  const auth = options.token === undefined ? token() : options.token;
  if (auth) headers.Authorization = `Bearer ${auth}`;
  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) localStorage.removeItem(TOKEN_KEY);
  if (!response.ok) {
    const error = new Error(data.error || "Не получилось сохранить данные.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function applyBoard(data) {
  state.people = Array.isArray(data.people) ? data.people : [];
  state.meId = data.me ? data.me.id : null;
  state.marks = {};
  if (data.me) {
    state.name = data.me.name || "";
    state.goal = data.me.goal || "";
    state.start = data.me.startDate || iso(today());
    state.photo = safePhoto(data.me.photo);
    Object.entries(data.myMarks || {}).forEach(([date, note]) => {
      state.marks[date] = { note: note || "" };
    });
  }
  state.status = "ready";
  state.error = "";
}

let boardRequest = 0;

async function loadBoard(options = {}) {
  const silent = Boolean(options.silent) && state.status === "ready";
  const request = ++boardRequest;
  const view = currentView();
  if (!silent) {
    state.status = "loading";
    render();
  }
  try {
    const data = await api("/api/board");
    if (request !== boardRequest) return;
    applyBoard(data);
  } catch (error) {
    if (request !== boardRequest) return;
    if (error.status === 401) {
      try {
        const data = await api("/api/board", { token: "" });
        if (request !== boardRequest) return;
        applyBoard(data);
      } catch (again) {
        if (!silent) {
          state.status = "error";
          state.error = again.message;
        }
      }
    } else if (!silent) {
      state.status = "error";
      state.error = error.message;
    }
  }
  if (request !== boardRequest) return;
  if (silent && currentView() !== view) return;
  const active = document.activeElement;
  if (silent && active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
  render();
}

async function persistMark(note) {
  if (state.busy || !joined()) return;
  const index = todayIndex();
  if (index < 0 || index > TOTAL_DAYS - 1) return;
  state.busy = true;
  try {
    applyBoard(await api("/api/marks", { method: "POST", body: { date: iso(today()), note } }));
    state.noteDraft = null;
    state.editingNote = false;
  } catch (error) {
    state.notice = error.message;
  } finally {
    state.busy = false;
    render();
  }
}

function markToday() {
  persistMark(readNoteDraft().trim());
}

function saveNote() {
  if (!state.marks[iso(today())]) return;
  persistMark(readNoteDraft().trim());
}

async function unmarkToday() {
  if (state.busy || !joined()) return;
  state.busy = true;
  try {
    applyBoard(await api("/api/marks", { method: "DELETE", body: { date: iso(today()) } }));
    state.noteDraft = null;
    state.editingNote = false;
  } catch (error) {
    state.notice = error.message;
  } finally {
    state.busy = false;
    render();
  }
}

function flash(message) {
  state.notice = message;
  render();
  window.clearTimeout(state.noticeTimer);
  state.noticeTimer = window.setTimeout(() => {
    if (state.notice !== message) return;
    state.notice = "";
    const notice = document.getElementById("notice");
    if (notice) notice.textContent = "";
  }, 1600);
}

function captureSetupFields() {
  const name = document.getElementById("field-name");
  const goal = document.getElementById("field-goal");
  const start = document.getElementById("field-start");
  if (name) state.name = name.value;
  if (goal) state.goal = goal.value;
  if (start) state.start = start.value;
}

async function choosePhoto(file) {
  captureSetupFields();
  try {
    state.photo = await compressPhoto(file);
    state.notice = "";
  } catch (error) {
    state.notice = error.message;
  }
  render();
}

async function saveSetup(event) {
  event.preventDefault();
  if (state.busy) return;
  const name = document.getElementById("field-name").value.trim();
  const goal = document.getElementById("field-goal").value.trim();
  const start = document.getElementById("field-start").value;
  if (!name || !goal || !isValidISO(start)) {
    state.notice = "Нужны имя, цель и настоящая дата старта.";
    render();
    return;
  }
  state.name = name;
  state.goal = goal;
  state.start = start;
  const wasJoined = joined();
  state.busy = true;
  render();
  try {
    const body = { name, goal, startDate: start, photo: safePhoto(state.photo) };
    const data = wasJoined
      ? await api("/api/profile", { method: "PATCH", body })
      : await api("/api/join", { method: "POST", body });
    if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
    applyBoard(data);
    state.selectedOffset = null;
    state.notice = wasJoined ? "Сохранено" : "Ты в челлендже";
  } catch (error) {
    state.notice = error.message;
  } finally {
    state.busy = false;
    render();
  }
}

async function useCode() {
  const code = (document.getElementById("field-code")?.value || "").trim();
  if (!code) {
    state.notice = "Вставь код устройства.";
    render();
    return;
  }
  state.busy = true;
  render();
  try {
    applyBoard(await api("/api/board", { token: code }));
    localStorage.setItem(TOKEN_KEY, code);
    state.notice = "Это твоя запись.";
    history.replaceState(null, "", "#today");
  } catch (error) {
    state.status = "ready";
    state.notice = error.message;
  } finally {
    state.busy = false;
    render();
  }
}

async function copyCode() {
  const code = token();
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    flash("Код скопирован");
  } catch {
    state.notice = code;
    render();
  }
}

function onClick(event) {
  const el = event.target.closest("[data-action]");
  if (!el || !root.contains(el)) return;
  const action = el.dataset.action;
  if (action === "start-timer") startTimer();
  else if (action === "pause-timer") pauseTimer();
  else if (action === "reset-timer") {
    resetTimer();
    render();
  } else if (action === "mark") markToday();
  else if (action === "save-note") saveNote();
  else if (action === "edit-note") {
    state.editingNote = true;
    state.noteDraft = null;
    render();
  } else if (action === "cancel-note") {
    state.editingNote = false;
    state.noteDraft = null;
    render();
  } else if (action === "unmark") unmarkToday();
  else if (action === "select-day") {
    state.selectedOffset = Number(el.dataset.offset);
    render();
  } else if (action === "retry") loadBoard();
  else if (action === "use-code") useCode();
  else if (action === "copy-code") copyCode();
  else if (action === "set-design") setDesign(el.dataset.theme);
  else if (action === "pick-photo") document.getElementById("field-photo")?.click();
  else if (action === "clear-photo") {
    captureSetupFields();
    state.photo = "";
    state.notice = "";
    render();
  }
}

function onInput(event) {
  if (event.target.id === "field-note") {
    state.noteDraft = event.target.value;
    return;
  }
  if (event.target.id === "field-start") {
    const preview = document.getElementById("setup-preview");
    if (preview) preview.textContent = describeStart(event.target.value);
  }
  if (!state.notice) return;
  state.notice = "";
  const notice = document.getElementById("notice");
  if (notice) notice.textContent = "";
}

function boot() {
  applyDesign(savedDesign());
  const id = location.hash.replace("#", "");
  if (!VIEWS.includes(id)) history.replaceState(null, "", "#today");
  window.addEventListener("hashchange", () => {
    const next = location.hash.replace("#", "");
    if (!VIEWS.includes(next)) history.replaceState(null, "", "#today");
    if (state.status !== "ready") return;
    render();
    const view = currentView();
    if (view === "today" || view === "friends") loadBoard({ silent: true });
  });
  loadBoard();
}

root.addEventListener("click", onClick);
root.addEventListener("submit", (event) => {
  if (event.target.id === "setup-form") saveSetup(event);
});
root.addEventListener("input", onInput);
root.addEventListener("change", (event) => {
  if (event.target.id !== "field-photo") return;
  const file = event.target.files && event.target.files[0];
  if (file) choosePhoto(file);
});
window.setInterval(tick, 200);
boot();
