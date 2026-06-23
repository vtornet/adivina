// online-invites.js - Sistema de invitaciones y polling para juego online

let onlineInvitePollInterval = null;

export function startOnlineInvitePolling() {
  if (onlineInvitePollInterval) return;
  onlineInvitePollInterval = setInterval(() => {
    if (globalThis.currentUser && globalThis.currentUser.email) {
      // loadPlayerOnlineGames will be imported from online-ui.js
      import("./online-ui.js").then((m) => m.loadPlayerOnlineGames());
    }
  }, 15000);
}

export function stopOnlineInvitePolling() {
  if (!onlineInvitePollInterval) return;
  clearInterval(onlineInvitePollInterval);
  onlineInvitePollInterval = null;
}

export async function declineOnlineGame(code) {
  const playerData = globalThis.currentUser;
  if (!playerData?.email) {
    globalThis.showAppAlert("Debes iniciar sesión para declinar una partida.");
    globalThis.showScreen("login-screen");
    return;
  }

  const confirmed = await globalThis.showAppConfirm(
    "¿Quieres declinar esta partida online? Se eliminará la invitación pendiente.",
  );
  if (!confirmed) return;

  try {
    const response = await fetch(`${globalThis.API_BASE_URL}/api/online-games/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, email: playerData?.email }),
    });
    const result = await response.json();

    if (response.ok) {
      await globalThis.showAppAlert(result.message || "Partida declinada.");
      import("./online-ui.js").then((m) => m.loadPlayerOnlineGames());
    } else {
      globalThis.showAppAlert(result.message || "No se pudo declinar la partida.");
    }
  } catch (err) {
    console.error("Error al declinar partida online:", err);
    globalThis.showAppAlert("Error de conexión. Intenta de nuevo más tarde.");
  }
}

export async function deletePendingOnlineGame(code) {
  const playerData = globalThis.currentUser;
  if (!playerData?.email) {
    globalThis.showAppAlert("Debes iniciar sesión para eliminar una partida.");
    globalThis.showScreen("login-screen");
    return;
  }

  const confirmed = await globalThis.showAppConfirm(
    "¿Seguro que quieres eliminar esta partida pendiente? Esta acción es irreversible.",
  );
  if (!confirmed) return;

  try {
    const response = await fetch(`${globalThis.API_BASE_URL}/api/online-games/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, email: playerData?.email }),
    });
    const result = await response.json();

    if (response.ok) {
      await globalThis.showAppAlert(result.message || "Partida eliminada.");
      import("./online-ui.js").then((m) => m.loadPlayerOnlineGames());
    } else {
      globalThis.showAppAlert(result.message || "No se pudo eliminar la partida.");
    }
  } catch (err) {
    console.error("Error al eliminar partida online:", err);
    globalThis.showAppAlert("Error de conexión. Intenta de nuevo más tarde.");
  }
}

export function copyOnlineGameCode(code) {
  navigator.clipboard
    .writeText(code)
    .then(() => {
      globalThis.showAppAlert(`Código de partida copiado: ${code}`);
    })
    .catch((err) => {
      console.error("Error al copiar el código:", err);
      globalThis.showAppAlert(`No se pudo copiar el código. Por favor, cópialo manualmente: ${code}`);
    });
}

export function updateOnlineInviteBadge(count) {
  const badge = document.getElementById("online-invite-count");
  if (badge) {
    badge.textContent = count;
    if (count > 0) {
      badge.hidden = false;
      badge.style.display = "inline-flex";
    } else {
      badge.hidden = true;
      badge.style.display = "none";
    }
  }
}

export async function invitePlayerByName() {
  const rivalName = document.getElementById("rival-name-input").value.trim();
  const decade = document.getElementById("invite-decade-select").value;
  const category = document.getElementById("invite-category-select").value;

  const playerData = globalThis.currentUser;
  if (!rivalName || !playerData || !playerData.email || !playerData.playerName) {
    globalThis.showAppAlert("Faltan datos o no estás logueado con un nombre de jugador.");
    globalThis.showScreen("login-screen");
    return;
  }

  // Import functions needed from other modules
  const { isPremiumSelection } = await import("./premium-functions.js");
  const { showPremiumModal } = await import("./premium-functions.js");
  const { getSongsForOnlineMatch } = await import("./online-functions.js");
  const { startOnlineGame } = await import("./online-functions.js");

  if (isPremiumSelection(decade, category) && !globalThis.hasPremiumAccess?.()) {
    showPremiumModal("Esta categoría es Premium. Desbloquéala para invitar a tus amigos.", category);
    return;
  }

  const songsArray = await getSongsForOnlineMatch(decade, category);
  if (!songsArray || songsArray.length < 10) {
    globalThis.showAppAlert("No hay suficientes canciones.");
    return;
  }

  try {
    const response = await fetch(`${globalThis.API_BASE_URL}/api/online-games/by-username`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creatorEmail: playerData.email,
        rivalPlayerName: rivalName,
        category,
        decade,
        songsUsed: songsArray,
        playerName: playerData.playerName,
      }),
    });

    const result = await response.json();
    if (response.ok) {
      globalThis.showAppAlert("Invitación enviada a " + rivalName);
      globalThis.currentOnlineGameCode = result.code;
      globalThis.currentOnlineSongs = songsArray;
      globalThis.currentOnlineEmail = playerData.email;
      globalThis.currentOnlinePlayerName = playerData.playerName;
      globalThis.isOnlineMode = true;

      localStorage.setItem(
        "currentOnlineGameData",
        JSON.stringify({
          code: result.code,
          songsUsed: songsArray,
          decade: decade,
          category: category,
        }),
      );
      await startOnlineGame();
    } else {
      globalThis.showAppAlert(result.message || "Error al invitar.");
    }
  } catch (err) {
    console.error(err);
    globalThis.showAppAlert("Error al enviar la invitación.");
  }
}

export function shareOnlineCode(code) {
  const text = `¡Rétame en Adivina la Canción! 🎵\nMi código de partida es: ${code}\nEntra aquí: https://adivinalacancion.app`;

  if (navigator.share) {
    navigator
      .share({
        title: "Duelo en Adivina la Canción",
        text: text,
      })
      .catch(() => copyOnlineGameCode(code));
  } else {
    copyOnlineGameCode(code);
  }
}
