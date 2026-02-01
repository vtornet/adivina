import { NOTIFICATIONS_STORAGE_KEY } from "../../constants/constants.js";

export function getNotifications() {
  const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }

  const initial = [
    {
      id: "welcome-premium",
      message: "Próximamente podrás desbloquear nuevas categorías.",
      date: new Date().toLocaleDateString(),
    },
  ];
  localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

export function updateNotificationBadge() {
  const notifications = getNotifications();
  // Contamos las que no tienen 'read' o 'read' es false
  const unreadCount = notifications.filter((n) => !n.read).length;

  const badge = document.getElementById("notification-badge");
  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 9 ? "9+" : unreadCount;
      badge.classList.remove("hidden");
      // Efecto visual divertido para llamar la atención
      badge.style.animation = "none";
      badge.offsetHeight; /* trigger reflow */
      badge.style.animation = "popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    } else {
      badge.classList.add("hidden");
    }
  }
}

export function renderNotifications() {
  const list = document.getElementById("notifications-list");
  if (!list) return;
  const notifications = getNotifications();
  list.innerHTML = "";
  if (notifications.length === 0) {
    list.innerHTML = "<p>No hay notificaciones todavía.</p>";
    return;
  }

  notifications.forEach((note) => {
    const item = document.createElement("div");
    item.className = "notification-item";
    item.innerHTML = `<p>${note.message}</p><small>${note.date}</small>`;
    if (note.type === "invite" || note.type === "result") {
      item.style.cursor = "pointer";
      item.addEventListener("click", () => {
        toggleNotificationsPanel();
        showScreen("pending-games-screen");
      });
    }
    list.appendChild(item);
  });
}

export function addNotification(message, type = "info") {
  const notifications = getNotifications();
  notifications.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    message,
    date: new Date().toLocaleDateString(),
    type,
    read: false, // <--- NUEVO: Marcamos como NO leída
  });
  localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));

  updateNotificationBadge(); // <--- NUEVO: Actualizamos el contador visualmente
}

export function getFinishedNotificationsState() {
  const stored = localStorage.getItem(FINISHED_NOTIFICATIONS_KEY);
  if (!stored) return {};
  return JSON.parse(stored);
}

export function setFinishedNotificationsState(state) {
  localStorage.setItem(FINISHED_NOTIFICATIONS_KEY, JSON.stringify(state));
}

export function toggleNotificationsPanel() {
  const panel = document.getElementById("notifications-panel");
  if (!panel) return;
  const isHidden = panel.classList.contains("hidden");

  if (isHidden) {
    // AL ABRIR: Marcamos todo como leído
    const notifications = getNotifications();
    const updatedNotifications = notifications.map((n) => ({ ...n, read: true }));
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedNotifications));

    // Actualizamos UI
    updateNotificationBadge(); // El contador se pondrá a 0 y desaparecerá
    renderNotifications(); // Mostramos la lista

    panel.classList.remove("hidden");
  } else {
    panel.classList.add("hidden");
  }
}
