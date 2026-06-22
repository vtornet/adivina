// online-notifications.js - Sistema de notificaciones para juego online

export function getWinnerName(players) {
  if (!players || players.length === 0) return "";

  let maxScore = -Infinity;
  let winnerName = "";

  for (const player of players) {
    if (player.score > maxScore) {
      maxScore = player.score;
      winnerName = player.playerName;
    }
  }

  return winnerName;
}

export function formatOnlineGameDate(dateValue) {
  if (!dateValue) return "";

  const date = new Date(dateValue);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Justo ahora";
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  if (diffDays < 7) return `Hace ${diffDays} d`;

  return date.toLocaleDateString("es-ES");
}

export function isOnlineGameFinished(game) {
  if (!game) return false;
  const player1Finished = game.player1?.finished || false;
  const player2Finished = game.player2?.finished || false;
  return player1Finished && player2Finished;
}

export function showInviteToast(invites) {
  if (!invites || invites.length === 0) return;

  const invite = invites[0];
  const invitingPlayer = invite.invitingPlayer?.playerName || "Alguien";

  if (window.Notification && Notification.permission === "granted") {
    new Notification("Nueva invitación", {
      body: `${invitingPlayer} te ha invitado a jugar.`,
      icon: "img/adivina.png",
    });
  }

  const toast = document.createElement("div");
  toast.className = "online-invite-toast";
  toast.innerHTML = `
    <span>${invitingPlayer} te ha invitado a jugar.</span>
    <button onclick="window.location.href='#pending-games-screen'">Ver</button>
  `;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 5000);
}

export function sendInviteNotification(invitingPlayerName) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const notification = new Notification("Invitación online enviada", {
    body: `Has invitado a ${invitingPlayerName} a jugar.`,
    icon: "img/adivina.png",
  });

  notification.onclick = () => {
    window.focus();
    showScreen("pending-games-screen");
    notification.close();
  };
}

export function sendGameFinishedNotification(opponentName) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const notification = new Notification("Partida online finalizada", {
    body: `${opponentName} ha terminado su partida.`,
    icon: "img/adivina.png",
  });

  notification.onclick = () => {
    window.focus();
    window.showScreen("pending-games-screen");
    notification.close();
  };
}

export async function clearOnlineGameHistory() {
  const playerData = window.currentUser;
  if (!playerData || !playerData.email) {
    window.showAppAlert("Debes iniciar sesión para borrar tu historial.");
    window.showScreen("login-screen");
    return;
  }

  try {
    const response = await fetch(`${window.API_BASE_URL}/api/online-games/clear-history/${playerData.email}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    const result = await response.json();

    if (response.ok) {
      window.showAppAlert(result.message);
      loadPlayerOnlineGames();
    } else {
      window.showAppAlert(`Error al borrar historial: ${result.message}`);
    }
  } catch (error) {
    console.error("Error de red al borrar historial de partidas online:", error);
    window.showAppAlert("Error de conexión. Intenta de nuevo más tarde.");
  }
}

export async function confirmClearOnlineGameHistory() {
  const confirmed = await window.showAppConfirm(
    "¿Seguro que quieres borrar TODO el historial de partidas online? Esta acción no se puede deshacer.",
  );

  if (!confirmed) return;

  await clearOnlineGameHistory();
}
