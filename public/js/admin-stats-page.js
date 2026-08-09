const STORAGE_KEY = "adminStatsKey";

const CATEGORY_LABELS = {
  espanol: "Español",
  ingles: "Inglés",
  peliculas: "Películas",
  series: "Series",
  tv: "TV",
  infantiles: "Infantiles",
  anuncios: "Anuncios",
  consolidated: "Consolidado",
};

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const keyInput = document.getElementById("admin-key-input");
const keySaveBtn = document.getElementById("admin-key-save");
const errorEl = document.getElementById("stats-error");
const contentEl = document.getElementById("stats-content");
const noteEl = document.getElementById("stats-note");

let latestNewUsers = null;
let activeRange = "byDay";

function formatDayLabel(id) {
  const [, month, day] = id.split("-");
  return `${day}/${month}`;
}

function formatWeekLabel(id) {
  const [, week] = id.split("-W");
  return `Sem ${week}`;
}

function formatMonthLabel(id) {
  const [year, month] = id.split("-");
  return `${MONTH_LABELS[Number(month) - 1]} ${year.slice(2)}`;
}

function formatLabel(id, range) {
  if (range === "byDay") return formatDayLabel(id);
  if (range === "byWeek") return formatWeekLabel(id);
  return formatMonthLabel(id);
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
  contentEl.hidden = true;
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = "";
}

function renderVBarChart(container, data, range) {
  container.innerHTML = "";
  if (!data.length) {
    container.innerHTML = '<p class="empty-msg">Sin datos en este periodo.</p>';
    return;
  }

  const max = Math.max(...data.map((d) => d.count), 1);
  const chart = document.createElement("div");
  chart.className = "vbar-chart";

  const labelStep = Math.max(1, Math.ceil(data.length / 7));

  data.forEach((d) => {
    const col = document.createElement("div");
    col.className = "vbar-col";

    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    tooltip.textContent = `${formatLabel(d._id, range)}: ${d.count}`;
    col.appendChild(tooltip);

    const bar = document.createElement("div");
    bar.className = "vbar";
    const heightPct = (d.count / max) * 100;
    bar.style.height = d.count === 0 ? "1px" : `${Math.max(heightPct, 2)}%`;
    col.appendChild(bar);

    chart.appendChild(col);
  });

  container.appendChild(chart);

  const axisLabels = document.createElement("div");
  axisLabels.className = "vbar-axis-labels";
  data.forEach((d, i) => {
    const span = document.createElement("span");
    if (i % labelStep === 0 || i === data.length - 1) {
      span.textContent = formatLabel(d._id, range);
    }
    axisLabels.appendChild(span);
  });
  container.appendChild(axisLabels);
}

function renderHBarChart(container, data, labelMap) {
  container.innerHTML = "";
  if (!data.length) {
    container.innerHTML = '<p class="empty-msg">Sin datos todavía.</p>';
    return;
  }

  const max = Math.max(...data.map((d) => d.count), 1);

  data.forEach((d) => {
    const row = document.createElement("div");
    row.className = "hbar-row";

    const name = document.createElement("div");
    name.className = "hbar-name";
    name.textContent = (labelMap && labelMap[d.key]) || d.key;
    row.appendChild(name);

    const track = document.createElement("div");
    track.className = "hbar-track";
    const fill = document.createElement("div");
    fill.className = "hbar-fill";
    fill.style.width = `${Math.max((d.count / max) * 100, 3)}%`;
    track.appendChild(fill);
    row.appendChild(track);

    const value = document.createElement("div");
    value.className = "hbar-value";
    value.textContent = d.count;
    row.appendChild(value);

    container.appendChild(row);
  });
}

function renderStats(stats) {
  document.getElementById("tile-total-users").textContent = stats.totalUsers.toLocaleString("es-ES");
  document.getElementById("tile-total-games").textContent = stats.totalGamesPlayed.toLocaleString("es-ES");

  latestNewUsers = stats.newUsers;
  renderVBarChart(document.getElementById("new-users-chart"), latestNewUsers[activeRange], activeRange);

  renderHBarChart(document.getElementById("decades-chart"), stats.topDecades);
  renderHBarChart(document.getElementById("categories-chart"), stats.topCategories, CATEGORY_LABELS);

  noteEl.textContent = stats.note || "";
  contentEl.hidden = false;
  clearError();
}

async function loadStats(key) {
  try {
    const response = await fetch("/api/admin/stats", {
      headers: { "x-admin-key": key },
    });

    if (response.status === 401) {
      localStorage.removeItem(STORAGE_KEY);
      showError("Clave incorrecta o no autorizada.");
      return;
    }

    if (!response.ok) {
      showError("Error del servidor al cargar estadísticas.");
      return;
    }

    const stats = await response.json();
    renderStats(stats);
  } catch {
    showError("No se pudo conectar con el servidor.");
  }
}

keySaveBtn.addEventListener("click", () => {
  const key = keyInput.value.trim();
  if (!key) return;
  localStorage.setItem(STORAGE_KEY, key);
  loadStats(key);
});

keyInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") keySaveBtn.click();
});

document.querySelectorAll(".range-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".range-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeRange = btn.dataset.range;
    if (latestNewUsers) {
      renderVBarChart(document.getElementById("new-users-chart"), latestNewUsers[activeRange], activeRange);
    }
  });
});

const storedKey = localStorage.getItem(STORAGE_KEY);
if (storedKey) {
  keyInput.value = storedKey;
  loadStats(storedKey);
}
