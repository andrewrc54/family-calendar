/* ===================== Estado / persistencia ===================== */

const STORAGE_KEY = "familyCalendarState";

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MEALS = ["Desayuno", "Almuerzo", "Cena"];

function defaultState() {
  return {
    members: [],
    routines: [],       // {id, memberId, text}
    completions: {},    // { "YYYY-MM-DD": { [taskId]: true } }
    stars: {},           // { memberId: number }
    meals: {},           // { "Lunes_Desayuno": "texto" }
    shopping: [],         // {id, text, done}
    location: null,       // {lat, lon}
    selectedCalendarId: "primary",
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch (e) {
    console.error("No se pudo leer el estado guardado", e);
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayWeekday() {
  // JS getDay(): 0=domingo..6=sábado -> reordenamos a lunes..domingo
  const idx = new Date().getDay();
  return DAYS[(idx + 6) % 7];
}

/* ===================== Tabs ===================== */

document.getElementById("tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
});

/* ===================== Encabezado: fecha + clima ===================== */

function renderDate() {
  const el = document.getElementById("today-date");
  const now = new Date();
  el.textContent = now.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const WEATHER_ICONS = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌦️",
  61: "🌧️", 63: "🌧️", 65: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "🌨️",
  80: "🌦️", 81: "🌧️", 82: "⛈️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};

async function renderWeather() {
  const el = document.getElementById("today-weather");
  if (!state.location) {
    el.textContent = "📍 Configura tu ubicación en Ajustes para ver el clima";
    return;
  }
  try {
    const { lat, lon } = state.location;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();
    const temp = Math.round(data.current.temperature_2m);
    const icon = WEATHER_ICONS[data.current.weather_code] || "🌡️";
    el.textContent = `${icon} ${temp}°C`;
  } catch (e) {
    el.textContent = "No se pudo cargar el clima";
  }
}

document.getElementById("ubicacion-btn").addEventListener("click", () => {
  const status = document.getElementById("ubicacion-status");
  if (!navigator.geolocation) {
    status.textContent = "Este navegador no soporta geolocalización.";
    return;
  }
  status.textContent = "Buscando ubicación…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.location = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      saveState();
      status.textContent = "Ubicación guardada ✅";
      renderWeather();
    },
    () => {
      status.textContent = "No se pudo obtener la ubicación (revisa permisos).";
    }
  );
});

/* ===================== Miembros (Ajustes) ===================== */

function renderMiembrosLista() {
  const wrap = document.getElementById("miembros-lista");
  wrap.innerHTML = "";
  state.members.forEach((m) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.style.background = m.color;
    chip.innerHTML = `<span>${m.name}</span>`;
    const btn = document.createElement("button");
    btn.textContent = "×";
    btn.onclick = () => {
      if (!confirm(`¿Quitar a ${m.name}? Se borrarán sus rutinas y estrellas.`)) return;
      state.members = state.members.filter((x) => x.id !== m.id);
      state.routines = state.routines.filter((r) => r.memberId !== m.id);
      delete state.stars[m.id];
      saveState();
      renderEverything();
    };
    chip.appendChild(btn);
    wrap.appendChild(chip);
  });
}

document.getElementById("miembro-add").addEventListener("click", () => {
  const nameInput = document.getElementById("miembro-nombre");
  const colorInput = document.getElementById("miembro-color");
  const name = nameInput.value.trim();
  if (!name) return;
  state.members.push({ id: uid(), name, color: colorInput.value });
  nameInput.value = "";
  saveState();
  renderEverything();
});

/* ===================== Rutinas ===================== */

function renderRutinaMiembroSelect() {
  const sel = document.getElementById("rutina-miembro");
  sel.innerHTML = "";
  state.members.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name;
    sel.appendChild(opt);
  });
}

document.getElementById("rutina-add").addEventListener("click", () => {
  const sel = document.getElementById("rutina-miembro");
  const texto = document.getElementById("rutina-texto");
  if (!sel.value || !texto.value.trim()) return;
  state.routines.push({ id: uid(), memberId: sel.value, text: texto.value.trim() });
  texto.value = "";
  saveState();
  renderEverything();
});

function renderRutinasPorMiembro() {
  const wrap = document.getElementById("rutinas-por-miembro");
  wrap.innerHTML = "";
  if (state.members.length === 0) {
    wrap.innerHTML = `<p class="muted">Agrega miembros de la familia en Ajustes primero.</p>`;
    return;
  }
  state.members.forEach((m) => {
    const block = document.createElement("div");
    block.className = "rutina-block";
    block.style.setProperty("--member-color", m.color);
    const tasks = state.routines.filter((r) => r.memberId === m.id);
    block.innerHTML = `<div class="member-name">${m.name}</div>`;
    if (tasks.length === 0) {
      block.innerHTML += `<p class="muted">Sin tareas todavía.</p>`;
    }
    tasks.forEach((t) => {
      const row = document.createElement("div");
      row.className = "task-item";
      row.innerHTML = `<label style="flex:1">${t.text}</label>`;
      const rm = document.createElement("button");
      rm.className = "task-remove";
      rm.textContent = "🗑️";
      rm.onclick = () => {
        state.routines = state.routines.filter((r) => r.id !== t.id);
        saveState();
        renderEverything();
      };
      row.appendChild(rm);
      block.appendChild(row);
    });
    wrap.appendChild(block);
  });
}

/* ===================== Hoy: checklist + estrellas ===================== */

function toggleTaskDone(memberId, taskId) {
  const key = todayKey();
  if (!state.completions[key]) state.completions[key] = {};
  const wasDone = !!state.completions[key][taskId];
  if (wasDone) {
    delete state.completions[key][taskId];
    state.stars[memberId] = Math.max(0, (state.stars[memberId] || 0) - 1);
  } else {
    state.completions[key][taskId] = true;
    state.stars[memberId] = (state.stars[memberId] || 0) + 1;
  }
  saveState();
  renderHoy();
  renderPremios();
}

function renderHoy() {
  const wrap = document.getElementById("hoy-miembros");
  wrap.innerHTML = "";
  if (state.members.length === 0) {
    wrap.innerHTML = `<p class="muted">Agrega miembros de la familia en Ajustes para empezar.</p>`;
    return;
  }
  const key = todayKey();
  const doneToday = state.completions[key] || {};

  state.members.forEach((m) => {
    const tasks = state.routines.filter((r) => r.memberId === m.id);
    const card = document.createElement("div");
    card.className = "member-card";
    card.style.setProperty("--member-color", m.color);
    card.innerHTML = `
      <div class="member-card-header">
        <span class="member-name">${m.name}</span>
        <span class="member-stars">⭐ ${state.stars[m.id] || 0}</span>
      </div>
    `;
    if (tasks.length === 0) {
      card.innerHTML += `<p class="muted">Sin rutinas asignadas.</p>`;
    }
    tasks.forEach((t) => {
      const isDone = !!doneToday[t.id];
      const row = document.createElement("div");
      row.className = "task-item" + (isDone ? " done" : "");
      const cbId = `cb_${t.id}`;
      row.innerHTML = `
        <input type="checkbox" id="${cbId}" ${isDone ? "checked" : ""} />
        <label for="${cbId}">${t.text}</label>
      `;
      row.querySelector("input").addEventListener("change", () => toggleTaskDone(m.id, t.id));
      card.appendChild(row);
    });
    wrap.appendChild(card);
  });
}

/* ===================== Comidas ===================== */

function renderMealTable() {
  const table = document.getElementById("meal-table");
  table.innerHTML = "";
  const thead = document.createElement("tr");
  thead.innerHTML = "<th></th>" + DAYS.map((d) => `<th>${d}</th>`).join("");
  table.appendChild(thead);

  MEALS.forEach((meal) => {
    const row = document.createElement("tr");
    row.innerHTML = `<th>${meal}</th>`;
    DAYS.forEach((day) => {
      const key = `${day}_${meal}`;
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "text";
      input.value = state.meals[key] || "";
      input.placeholder = "—";
      input.addEventListener("change", () => {
        state.meals[key] = input.value;
        saveState();
      });
      td.appendChild(input);
      row.appendChild(td);
    });
    table.appendChild(row);
  });
}

/* ===================== Compras ===================== */

function renderCompras() {
  const ul = document.getElementById("compra-lista");
  ul.innerHTML = "";
  state.shopping.forEach((item) => {
    const li = document.createElement("li");
    li.className = item.done ? "done" : "";
    const cbId = `sh_${item.id}`;
    li.innerHTML = `<input type="checkbox" id="${cbId}" ${item.done ? "checked" : ""} /><span>${item.text}</span>`;
    li.querySelector("input").addEventListener("change", (e) => {
      item.done = e.target.checked;
      saveState();
      renderCompras();
    });
    const rm = document.createElement("button");
    rm.className = "task-remove";
    rm.textContent = "🗑️";
    rm.onclick = () => {
      state.shopping = state.shopping.filter((x) => x.id !== item.id);
      saveState();
      renderCompras();
    };
    li.appendChild(rm);
    ul.appendChild(li);
  });
}

document.getElementById("compra-add").addEventListener("click", () => {
  const input = document.getElementById("compra-texto");
  if (!input.value.trim()) return;
  state.shopping.push({ id: uid(), text: input.value.trim(), done: false });
  input.value = "";
  saveState();
  renderCompras();
});

document.getElementById("compra-limpiar").addEventListener("click", () => {
  state.shopping = state.shopping.filter((x) => !x.done);
  saveState();
  renderCompras();
});

/* ===================== Premios ===================== */

function renderPremios() {
  const wrap = document.getElementById("premios-grid");
  wrap.innerHTML = "";
  if (state.members.length === 0) {
    wrap.innerHTML = `<p class="muted">Agrega miembros en Ajustes para ver sus premios.</p>`;
    return;
  }
  state.members
    .slice()
    .sort((a, b) => (state.stars[b.id] || 0) - (state.stars[a.id] || 0))
    .forEach((m) => {
      const card = document.createElement("div");
      card.className = "member-card";
      card.style.setProperty("--member-color", m.color);
      card.innerHTML = `
        <div class="member-card-header">
          <span class="member-name">${m.name}</span>
          <span class="member-stars">⭐ ${state.stars[m.id] || 0}</span>
        </div>
      `;
      wrap.appendChild(card);
    });
}

/* ===================== Google Calendar ===================== */

let gcalAccessToken = null;
let gcalTokenClient = null;

function initGoogleClient() {
  if (!window.google || !google.accounts || !google.accounts.oauth2) {
    // El script de Google todavía no cargó; reintenta en breve.
    setTimeout(initGoogleClient, 300);
    return;
  }
  gcalTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_CALENDAR_SCOPES,
    callback: (resp) => {
      if (resp.error) {
        console.error("Error de autenticación Google:", resp);
        return;
      }
      gcalAccessToken = resp.access_token;
      onGoogleConnected();
    },
  });
}

function connectGoogle() {
  if (GOOGLE_CLIENT_ID.startsWith("REEMPLAZA_CON_TU_CLIENT_ID")) {
    alert("Todavía falta configurar el Client ID de Google en config.js.\nPídele a tu agente que lo complete con el ID de OAuth de Google Cloud Console.");
    return;
  }
  if (!gcalTokenClient) {
    alert("Google todavía está cargando, intenta de nuevo en un segundo.");
    return;
  }
  gcalTokenClient.requestAccessToken();
}

document.getElementById("gcal-connect").addEventListener("click", connectGoogle);
document.getElementById("ajustes-gcal-connect").addEventListener("click", connectGoogle);
document.getElementById("ajustes-gcal-disconnect").addEventListener("click", () => {
  gcalAccessToken = null;
  document.getElementById("gcal-connected-msg").classList.add("hidden");
  document.getElementById("gcal-connect").classList.remove("hidden");
  document.getElementById("gcal-add").classList.add("hidden");
  document.getElementById("gcal-picker").classList.add("hidden");
  document.getElementById("ajustes-gcal-disconnect").classList.add("hidden");
  document.getElementById("ajustes-gcal-connect").classList.remove("hidden");
  document.getElementById("calendario-eventos").innerHTML = `<p class="muted">Conecta tu cuenta de Google para ver tus eventos aquí.</p>`;
  document.getElementById("hoy-eventos").innerHTML = `<p class="muted">Conecta Google Calendar en Ajustes para ver tus eventos.</p>`;
});

function onGoogleConnected() {
  document.getElementById("gcal-connect").classList.add("hidden");
  document.getElementById("gcal-connected-msg").classList.remove("hidden");
  document.getElementById("gcal-add").classList.remove("hidden");
  document.getElementById("gcal-picker").classList.remove("hidden");
  document.getElementById("ajustes-gcal-connect").classList.add("hidden");
  document.getElementById("ajustes-gcal-disconnect").classList.remove("hidden");
  fetchCalendarList();
  fetchGoogleEvents();
}

async function fetchCalendarList() {
  if (!gcalAccessToken) return;
  const sel = document.getElementById("gcal-calendar-select");
  try {
    const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
      headers: { Authorization: `Bearer ${gcalAccessToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const calendars = data.items || [];
    sel.innerHTML = "";
    calendars.forEach((cal) => {
      const opt = document.createElement("option");
      opt.value = cal.id;
      opt.textContent = cal.summary + (cal.primary ? " (principal)" : "");
      if (cal.id === state.selectedCalendarId) opt.selected = true;
      sel.appendChild(opt);
    });
    // Si el calendario guardado ya no existe en la lista, cae de nuevo a "primary".
    if (!calendars.some((c) => c.id === state.selectedCalendarId)) {
      state.selectedCalendarId = "primary";
      saveState();
    }
  } catch (e) {
    console.error("No se pudo cargar la lista de calendarios", e);
  }
}

document.getElementById("gcal-calendar-select").addEventListener("change", (e) => {
  state.selectedCalendarId = e.target.value;
  saveState();
  fetchGoogleEvents();
});

async function fetchGoogleEvents() {
  if (!gcalAccessToken) return;
  const timeMin = new Date().toISOString();
  const calId = encodeURIComponent(state.selectedCalendarId || "primary");
  const url = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=10&singleEvents=true&orderBy=startTime`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${gcalAccessToken}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderGoogleEvents(data.items || []);
  } catch (e) {
    console.error("Error obteniendo eventos de Google Calendar", e);
    document.getElementById("calendario-eventos").innerHTML = `<p class="muted">No se pudieron cargar los eventos. Intenta reconectar.</p>`;
  }
}

function formatEventWhen(ev) {
  const start = ev.start?.dateTime || ev.start?.date;
  if (!start) return "";
  const d = new Date(start);
  if (ev.start.date && !ev.start.dateTime) {
    return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
  }
  return d.toLocaleString("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function renderGoogleEvents(events) {
  const listEl = document.getElementById("calendario-eventos");
  const hoyEl = document.getElementById("hoy-eventos");
  if (events.length === 0) {
    listEl.innerHTML = `<p class="muted">No hay eventos próximos.</p>`;
    hoyEl.innerHTML = `<p class="muted">No hay eventos próximos.</p>`;
    return;
  }
  const html = events
    .map(
      (ev) => `
      <div class="event-card">
        <span class="event-title">${ev.summary || "(sin título)"}</span>
        <span class="event-when">${formatEventWhen(ev)}</span>
      </div>`
    )
    .join("");
  listEl.innerHTML = html;

  const todayStr = todayKey();
  const todays = events.filter((ev) => {
    const start = ev.start?.dateTime || ev.start?.date;
    return start && start.startsWith(todayStr);
  });
  hoyEl.innerHTML = todays.length
    ? todays.map((ev) => `
      <div class="event-card">
        <span class="event-title">${ev.summary || "(sin título)"}</span>
        <span class="event-when">${formatEventWhen(ev)}</span>
      </div>`).join("")
    : `<p class="muted">No hay eventos para hoy.</p>`;
}

document.getElementById("event-add-btn").addEventListener("click", async () => {
  if (!gcalAccessToken) {
    alert("Conecta Google Calendar primero.");
    return;
  }
  const title = document.getElementById("event-title").value.trim();
  const date = document.getElementById("event-date").value;
  const time = document.getElementById("event-time").value || "09:00";
  if (!title || !date) {
    alert("Falta título o fecha.");
    return;
  }
  const startDateTime = `${date}T${time}:00`;
  const startDate = new Date(startDateTime);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const body = {
    summary: title,
    start: { dateTime: startDate.toISOString(), timeZone: tz },
    end: { dateTime: endDate.toISOString(), timeZone: tz },
  };

  try {
    const calId = encodeURIComponent(state.selectedCalendarId || "primary");
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId}/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gcalAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    document.getElementById("event-title").value = "";
    document.getElementById("event-date").value = "";
    document.getElementById("event-time").value = "";
    fetchGoogleEvents();
  } catch (e) {
    alert("No se pudo agregar el evento. Intenta reconectar Google Calendar.");
    console.error(e);
  }
});

/* ===================== Reset ===================== */

document.getElementById("reset-btn").addEventListener("click", () => {
  if (!confirm("Esto borrará miembros, rutinas, comidas, compras y premios guardados en este dispositivo. ¿Continuar?")) return;
  state = defaultState();
  saveState();
  renderEverything();
});

/* ===================== Render general ===================== */

function renderEverything() {
  renderDate();
  renderWeather();
  renderMiembrosLista();
  renderRutinaMiembroSelect();
  renderRutinasPorMiembro();
  renderHoy();
  renderMealTable();
  renderCompras();
  renderPremios();
}

renderEverything();
initGoogleClient();

// Refresca fecha/eventos si la app queda abierta pasando la medianoche.
setInterval(() => {
  renderDate();
  renderHoy();
  if (gcalAccessToken) fetchGoogleEvents();
}, 60 * 1000);
