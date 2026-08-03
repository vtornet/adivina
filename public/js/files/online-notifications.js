// online-notifications.js - Sistema de notificaciones para juego online
import { logger } from "./logger.js";
import { showAppAlert, showAppConfirm } from "./modal-functions.js";
import { addNotification } from "./notification-functions.js";

export function getWinnerName(players) {
  if (!players || players.length === 0) return "Nadie";

  let maxScore = -Infinity;
  let winnerName = "";

  for (const player of players) {
    if (player.score > maxScore) {
      maxScore = player.score;
      winnerName = player.name;
    }
  }

  return winnerName || "Nadie";
}

export function isOnlineGameFinished(game) {
  if (!game) return false;
  if (Array.isArray(game.players) && game.players.length >= 2) {
    return game.players.every((p) => p.finished === true);
  }
  return false;
}

const shownInviteCodes = new Set();

export function showInviteToast(invites) {
  if (!invites || invites.length === 0) return;

  const newInvites = invites.filter((inv) => !shownInviteCodes.has(inv.code));
  if (newInvites.length === 0) return;

  newInvites.forEach((invite) => {
    shownInviteCodes.add(invite.code);

    const creatorPlayer = invite.players?.find(
      (p) => p.email?.toLowerCase() === invite.creatorEmail?.toLowerCase(),
    );
    const invitingPlayer = creatorPlayer?.name || invite.creatorPlayerName || "Alguien";

    addNotification(`${invitingPlayer} te ha invitado a una partida online.`, "invite");
    vibrate();
    playInAppSound();

    if (globalThis.Notification && Notification.permission === "granted") {
      new Notification("Nueva invitación", {
        body: `${invitingPlayer} te ha invitado a jugar.`,
        icon: "img/adivina.png",
      });
    }

    const toast = document.createElement("div");
    toast.className = "invite-toast";

    const msg = document.createElement("p");
    msg.textContent = `${invitingPlayer} te ha invitado a jugar.`;

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px";

    const viewBtn = document.createElement("button");
    viewBtn.className = "btn";
    viewBtn.textContent = "Ver";
    viewBtn.onclick = () => {
      globalThis.showScreen("pending-games-screen");
      dismiss();
    };

    const closeBtn = document.createElement("button");
    closeBtn.className = "btn secondary";
    closeBtn.textContent = "Cerrar";
    closeBtn.onclick = dismiss;

    function dismiss() {
      toast.classList.add("hide");
      setTimeout(() => toast.remove(), 220);
    }

    actions.appendChild(viewBtn);
    actions.appendChild(closeBtn);
    toast.appendChild(msg);
    toast.appendChild(actions);
    document.body.appendChild(toast);

    setTimeout(dismiss, 7000);
  });
}

function playInAppSound() {
  if (globalThis.sfxAcierto) {
    globalThis.sfxAcierto.currentTime = 0;
    globalThis.sfxAcierto.play().catch(() => {});
  }
}

function vibrate() {
  navigator.vibrate?.([200, 100, 200]);
}

export function sendInviteNotification(invitingPlayerName) {
  addNotification(`${invitingPlayerName} te ha invitado a una partida online.`, "invite");
  vibrate();
  playInAppSound();

  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const notification = new Notification("Nueva invitación online", {
    body: `${invitingPlayerName} te ha invitado a jugar.`,
    icon: "img/adivina.png",
  });
  notification.onclick = () => {
    globalThis.focus();
    globalThis.showScreen?.("pending-games-screen");
    notification.close();
  };
}

export function sendGameFinishedNotification(opponentName) {
  addNotification(`${opponentName} ha terminado. ¡Consulta el resultado!`, "result");
  vibrate();
  playInAppSound();

  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const notification = new Notification("¡Partida online finalizada!", {
    body: `${opponentName} ha terminado. ¡Mira el resultado!`,
    icon: "img/adivina.png",
  });
  notification.onclick = () => {
    globalThis.focus();
    globalThis.showScreen?.("pending-games-screen");
    notification.close();
  };
}

export async function clearOnlineGameHistory() {
  const playerData = globalThis.currentUser;
  if (!playerData || !playerData.email) {
    showAppAlert("Debes iniciar sesión para borrar tu historial.");
    globalThis.showScreen("login-screen");
    return;
  }

  try {
    const response = await fetch(`${globalThis.API_BASE_URL}/api/online-games/clear-history/${playerData.email}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    const result = await response.json();

    if (response.ok) {
      showAppAlert(result.message);
      loadPlayerOnlineGames();
    } else {
      showAppAlert(`Error al borrar historial: ${result.message}`);
    }
  } catch (error) {
    logger.error("Error de red al borrar historial de partidas online", error);
    showAppAlert("Error de conexión. Intenta de nuevo más tarde.");
  }
}

export async function confirmClearOnlineGameHistory() {
  const confirmed = await showAppConfirm(
    "¿Seguro que quieres borrar TODO el historial de partidas online? Esta acción no se puede deshacer.",
  );

  if (!confirmed) return;

  await clearOnlineGameHistory();
}
