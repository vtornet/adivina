// online-ui.js - UI de juego online

export async function loadPlayerOnlineGames() {
  const rawData = localStorage.getItem("userData");
  if (!rawData) {
    const activeContainer = document.getElementById("active-games-list");
    const finishedContainer = document.getElementById("finished-games-list");
    if (activeContainer) activeContainer.innerHTML = "<p>Inicia sesión para ver tus partidas.</p>";
    if (finishedContainer) finishedContainer.innerHTML = "";
    return;
  }

  let playerData;
  try {
    playerData = JSON.parse(rawData);
  } catch (e) {
    console.error("Error al parsear userData");
    return;
  }

  const userEmail = playerData.email ? playerData.email.trim().toLowerCase() : null;
  if (!userEmail) return;

  try {
    const emailEnc = encodeURIComponent(userEmail);
    const response = await fetch(`${window.API_BASE_URL}/api/online-games/player/${emailEnc}`, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    const data = await response.json();
    const games = Array.isArray(data) ? data : Array.isArray(data?.games) ? data.games : [];

    const activeGamesContainer = document.getElementById("active-games-list");
    const finishedGamesContainer = document.getElementById("finished-games-list");

    if (activeGamesContainer) activeGamesContainer.innerHTML = "";
    if (finishedGamesContainer) finishedGamesContainer.innerHTML = "";

    if (games.length === 0) {
      if (activeGamesContainer) activeGamesContainer.innerHTML = "<p>No tienes partidas online activas.</p>";
      if (finishedGamesContainer) finishedGamesContainer.innerHTML = "<p>No tienes partidas online finalizadas.</p>";

      const { updateOnlineInviteBadge } = await import("./online-invites.js");
      updateOnlineInviteBadge(0);
      return;
    }

    const { isOnlineGameFinished } = await import("./online-notifications.js");
    const { updateOnlineInviteBadge } = await import("./online-invites.js");
    const { showInviteToast } = await import("./online-notifications.js");

    const activeGames = games.filter((game) => !isOnlineGameFinished(game));
    const finishedGames = games.filter((game) => isOnlineGameFinished(game));

    const pendingInvites = activeGames.filter(
      (game) => game.waitingFor === userEmail && game.players.every((p) => p.email !== userEmail),
    );
    updateOnlineInviteBadge(pendingInvites.length);
    showInviteToast(pendingInvites);

    const { getDecadeLabel, getCategoryLabel } = await import("./app-info-functions.js");

    if (activeGames.length > 0 && activeGamesContainer) {
      activeGames.forEach((game) => {
        const gameDiv = document.createElement("div");
        gameDiv.className = "online-game-item";

        const isCreator = game.creatorEmail === userEmail;
        const currentPlayerStatus = game.players.find((p) => p.email === userEmail);
        const otherPlayer = game.players.find((p) => p.email !== userEmail);

        let displayRivalName = "Desconocido";
        if (game.players.length === 2 && otherPlayer) {
          displayRivalName = otherPlayer.name;
        } else if (game.waitingFor && isCreator) {
          displayRivalName = game.rivalPlayerName || game.waitingFor;
        } else if (!game.waitingFor && isCreator) {
          displayRivalName = "Esperando rival";
        } else if (game.players.length > 0 && !isCreator) {
          displayRivalName = game.players[0].name;
        }

        let statusText = "";
        let actionButtonsHTML = "";

        const isWaitingForMe = game.waitingFor === userEmail && !currentPlayerStatus;

        if (isWaitingForMe) {
          statusText = `¡Te han invitado!`;
          actionButtonsHTML = `
            <button class="btn" onclick="window.joinOnlineGameFromPending('${game.code}', '${playerData.playerName}', '${userEmail}')">Aceptar y Unirse</button>
            <button class="btn secondary" onclick="window.declineOnlineGame('${game.code}')">Declinar</button>
          `;
        } else if (game.players.length === 1 && isCreator) {
          if (game.waitingFor) {
            statusText = `Invitación enviada.`;
            actionButtonsHTML = `
              <button class="btn danger" onclick="window.deletePendingOnlineGame('${game.code}')">Eliminar</button>
            `;
          } else {
            statusText = "Esperando a que un rival se una...";
            actionButtonsHTML = `
              <button class="btn secondary" onclick="window.copyOnlineGameCode('${game.code}')">Copiar Código</button>
              <button class="btn danger" onclick="window.deletePendingOnlineGame('${game.code}')">Eliminar</button>
            `;
          }

          if (currentPlayerStatus && !currentPlayerStatus.finished) {
            statusText = "No has completado tu turno.";
            actionButtonsHTML = `
              <button class="btn" onclick="window.continueOnlineGame('${game.code}', '${playerData.playerName}', '${userEmail}')">Jugar</button>
              ${actionButtonsHTML}
            `;
          }
        } else if (game.players.length === 2) {
          const otherPlayerFinished = otherPlayer ? otherPlayer.finished : false;
          const myFinished = currentPlayerStatus ? currentPlayerStatus.finished : false;

          if (myFinished && !otherPlayerFinished) {
            statusText = `Esperando a ${otherPlayer ? otherPlayer.name : "rival"}...`;
            actionButtonsHTML = `<button class="btn secondary" onclick="window.goToOnlineWaitScreen('${game.code}')">Ver Estado</button>`;
          } else if (!myFinished && otherPlayerFinished) {
            statusText = `¡Tu turno! ${otherPlayer ? otherPlayer.name : "Rival"} ha terminado.`;
            actionButtonsHTML = `<button class="btn" onclick="window.continueOnlineGame('${game.code}', '${playerData.playerName}', '${userEmail}')">Jugar</button>`;
          } else if (!myFinished && !otherPlayerFinished) {
            statusText = `Partida en curso.`;
            actionButtonsHTML = `<button class="btn" onclick="window.continueOnlineGame('${game.code}', '${playerData.playerName}', '${userEmail}')">Continuar</button>`;
          }
        }

        gameDiv.innerHTML = `
          <p><strong>Partida con:</strong> ${displayRivalName}</p>
          <p><strong>Década:</strong> ${getDecadeLabel(game.decade)}</p>
          <p><strong>Categoría:</strong> ${getCategoryLabel(game.category)}</p>
          <p><strong>Estado:</strong> ${statusText}</p>
          <div class="online-game-actions">${actionButtonsHTML}</div>
        `;
        activeGamesContainer.appendChild(gameDiv);
      });
    } else if (activeGamesContainer) {
      activeGamesContainer.innerHTML = "<p>No tienes partidas online activas.</p>";
    }

    if (finishedGames.length > 0 && finishedGamesContainer) {
      finishedGames.forEach((game) => {
        const gameDiv = document.createElement("div");
        gameDiv.className = "online-game-item";
        const otherPlayer = game.players.find((p) => p.email !== userEmail);
        const otherPlayerName = otherPlayer ? otherPlayer.name : "Rival";

        gameDiv.innerHTML = `
          <p><strong>Partida con:</strong> ${otherPlayerName}</p>
          <p><strong>Categoría:</strong> ${getDecadeLabel(game.decade)} - ${getCategoryLabel(game.category)}</p>
          <p><strong>Estado:</strong> FINALIZADA</p>
          <button class="btn" onclick="window.viewOnlineGameResults('${game.code}')">Ver Resultados</button>
        `;
        finishedGamesContainer.appendChild(gameDiv);
      });
    } else if (finishedGamesContainer) {
      finishedGamesContainer.innerHTML = "<p>No tienes partidas finalizadas.</p>";
    }
  } catch (err) {
    console.error("Error en el historial:", err);
    const ac = document.getElementById("active-games-list");
    if (ac) ac.innerHTML = "<p>Error de conexión al cargar partidas.</p>";
  }
}

export async function viewOnlineGameResults(code) {
  try {
    const response = await fetch(`${window.API_BASE_URL}/api/online-games/${code}`);
    const result = await response.json();

    if (response.ok && result.finished && result.players?.length === 2) {
      window.currentOnlineGameCode = null;
      window.currentOnlineSongs = [];
      window.isOnlineMode = false;
      localStorage.removeItem("currentOnlineGameData");

      showOnlineResults(result);
    } else {
      window.showAppAlert(result.message || "La partida aún no ha terminado o no se encontraron resultados.");
      loadPlayerOnlineGames();
    }
  } catch (err) {
    console.error("Error al ver resultados de partida online:", err);
    window.showAppAlert("Error de conexión al cargar los resultados.");
  }
}

export async function goToOnlineWaitScreen(code) {
  window.currentOnlineGameCode = code;
  window.showScreen("online-wait-screen");

  const { pollOnlineGameStatus } = await import("./online-functions.js");
  pollOnlineGameStatus();
}

export async function continueOnlineGame(code, playerName, email) {
  try {
    const response = await fetch(`${window.API_BASE_URL}/api/online-games/${code}`);
    const result = await response.json();

    if (response.ok) {
      window.currentOnlineGameCode = code;
      window.currentOnlineSongs = result.songsUsed;
      window.currentOnlineEmail = email;
      window.currentOnlinePlayerName = playerName;
      window.isOnlineMode = true;

      localStorage.setItem(
        "currentOnlineGameData",
        JSON.stringify({
          code: code,
          songsUsed: result.songsUsed,
          decade: result.decade,
          category: result.category,
        }),
      );

      window.gameState = {
        players: [],
        totalQuestionsPerPlayer: 10,
        currentPlayerIndex: 0,
        selectedDecade: null,
        category: null,
        isOnline: true,
        onlineGameCode: window.currentOnlineGameCode,
      };

      const localPlayer = {
        id: 1,
        name: window.currentOnlinePlayerName,
        score: 0,
        questionsAnswered: 0,
        questions: window.currentOnlineSongs,
        email: window.currentOnlineEmail,
        finished_online: false,
      };
      window.gameState.players.push(localPlayer);

      const serverPlayer = result.players.find((p) => p.email === window.currentOnlineEmail);
      if (serverPlayer) {
        localPlayer.score = serverPlayer.score;
        localPlayer.finished_online = serverPlayer.finished;
      }

      const otherPlayer = result.players.find((p) => p.email !== window.currentOnlineEmail);
      if (otherPlayer) {
        window.gameState.players.push({
          id: 2,
          name: otherPlayer.name,
          score: otherPlayer.score,
          questionsAnswered: otherPlayer.questionsAnswered || 0,
          questions: [],
          email: otherPlayer.email,
          finished_online: otherPlayer.finished,
        });
      }

      const { startOnlineGame } = await import("./online-functions.js");
      await startOnlineGame();
    } else {
      window.showAppAlert(result.message || "Error al cargar la partida para continuar.");
      loadPlayerOnlineGames();
    }
  } catch (err) {
    console.error("Error de red al continuar partida online:", err);
    window.showAppAlert("Error de conexión. Intenta de nuevo más tarde.");
  }
}

export function showOnlineResults(gameData) {
  const finalScoresContainer = document.getElementById("final-scores");
  finalScoresContainer.innerHTML = "<h3>Resultados de la Partida Online</h3>";

  const sortedPlayers = [...gameData.players].sort((a, b) => b.score - a.score);
  const winnerDisplay = document.getElementById("winner-display");

  let winnerName = "Empate";
  if (sortedPlayers.length > 0) {
    const topScore = sortedPlayers[0].score;
    const winners = sortedPlayers.filter((player) => player.score === topScore);

    if (winners.length > 1) {
      const winnerNames = winners.map((winner) => winner.name).join(" y ");
      winnerDisplay.textContent = `¡Hay un EMPATE! Los GANADORES son ${winnerNames} con ${topScore} puntos!`;
    } else {
      winnerDisplay.textContent = `¡El GANADOR es ${sortedPlayers[0].name} con ${sortedPlayers[0].score} puntos!`;
      winnerName = sortedPlayers[0].name;
    }
  } else {
    winnerDisplay.textContent = "No hay ganador en esta partida.";
    winnerName = "Nadie";
  }

  winnerDisplay.style.animation = "neonGlow 1.5s ease-in-out infinite alternate";
  winnerDisplay.style.textShadow = "0 0 8px var(--secondary-color), 0 0 15px var(--secondary-color)";
  winnerDisplay.style.color = "var(--secondary-color)";
  winnerDisplay.style.borderBottom = "2px solid var(--secondary-color)";
  winnerDisplay.style.borderTop = "2px solid var(--secondary-color)";
  winnerDisplay.style.fontSize = "2.5rem";

  const topScore = sortedPlayers[0]?.score ?? null;
  const hasTieForFirst = sortedPlayers.filter((player) => player.score === topScore).length > 1;

  sortedPlayers.forEach((player, index) => {
    let medal = "";
    if (hasTieForFirst && player.score === topScore) {
      medal = "🥇";
    } else {
      medal = { 0: "🥇", 1: "🥈", 2: "🥉" }[index] || "";
    }
    finalScoresContainer.innerHTML += `<p>${medal} ${player.name}: <strong>${player.score} puntos</strong></p>`;
  });

  document.getElementById("play-again-btn").onclick = () => {
    window.currentOnlineGameCode = null;
    window.currentOnlineSongs = [];
    window.isOnlineMode = false;
    localStorage.removeItem("currentOnlineGameData");
    window.showScreen("online-mode-screen");
  };
  document.getElementById("play-again-btn").textContent = "Jugar Otra Vez Online";

  window.gameState.players = gameData.players;
  window.gameState.selectedDecade = gameData.decade;
  window.gameState.category = gameData.category;

  const shareBtnOnline = document.getElementById("share-result-btn");
  if (shareBtnOnline) {
    const { shareGameResultHandler } = await import("./share-functions.js");
    shareBtnOnline.onclick = shareGameResultHandler;
    shareBtnOnline.style.display = "inline-block";
  }

  const { saveOnlineGameToHistory } = await import("./online-functions.js");
  saveOnlineGameToHistory(gameData);

  const { setOnlineMenuButtonVisibility, setEndGameNavigationButtons } = await import("./navigation-functions.js");
  setOnlineMenuButtonVisibility(true);
  setEndGameNavigationButtons();
  window.showScreen("end-game-screen");
}
