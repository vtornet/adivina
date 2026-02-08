export function startOnlineInvitePolling() {
  if (onlineInvitePollInterval) return;
  onlineInvitePollInterval = setInterval(() => {
    if (currentUser && currentUser.email) {
      loadPlayerOnlineGames();
    }
  }, 15000);
}

export function stopOnlineInvitePolling() {
  if (!onlineInvitePollInterval) return;
  clearInterval(onlineInvitePollInterval);
  onlineInvitePollInterval = null;
}

export async function declineOnlineGame(code) {
  const playerData = getCurrentUserData();
  if (!playerData?.email) {
    showAppAlert("Debes iniciar sesión para declinar una partida.");
    showScreen("login-screen");
    return;
  }

  const confirmed = await showAppConfirm(
    "¿Quieres declinar esta partida online? Se eliminará la invitación pendiente.",
  );
  if (!confirmed) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/online-games/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, email: playerData?.email }),
    });
    const result = await response.json();

    if (response.ok) {
      await showAppAlert(result.message || "Partida declinada.");
      await loadPlayerOnlineGames();
    } else {
      showAppAlert(result.message || "No se pudo declinar la partida.");
    }
  } catch (err) {
    console.error("Error al declinar partida online:", err);
    showAppAlert("Error de conexión. Intenta de nuevo más tarde.");
  }
}

export async function deletePendingOnlineGame(code) {
  const playerData = getCurrentUserData();
  if (!playerData?.email) {
    showAppAlert("Debes iniciar sesión para eliminar una partida.");
    showScreen("login-screen");
    return;
  }

  const confirmed = await showAppConfirm(
    "¿Seguro que quieres eliminar esta partida pendiente? Esta acción es irreversible.",
  );
  if (!confirmed) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/online-games/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, email: playerData?.email }),
    });
    const result = await response.json();

    if (response.ok) {
      await showAppAlert(result.message || "Partida eliminada.");
      await loadPlayerOnlineGames();
    } else {
      showAppAlert(result.message || "No se pudo eliminar la partida.");
    }
  } catch (err) {
    console.error("Error al eliminar partida online:", err);
    showAppAlert("Error de conexión. Intenta de nuevo más tarde.");
  }
}

export function copyOnlineGameCode(code) {
  navigator.clipboard
    .writeText(code)
    .then(() => {
      showAppAlert(`Código de partida copiado: ${code}`);
    })
    .catch((err) => {
      console.error("Error al copiar el código:", err);
      showAppAlert(`No se pudo copiar el código. Por favor, cópialo manualmente: ${code}`);
    });
}

export async function viewOnlineGameResults(code) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/online-games/${code}`);
    const result = await response.json();
    if (response.ok && result.finished && result.players?.length === 2) {
      // Limpiar el estado de la partida actual para evitar conflictos
      currentOnlineGameCode = null;
      currentOnlineSongs = [];
      isOnlineMode = false;
      localStorage.removeItem("currentOnlineGameData");

      showOnlineResults(result); // Reutiliza la función existente para mostrar resultados
    } else {
      showAppAlert(result.message || "La partida aún no ha terminado o no se encontraron resultados.");
      // Recargar la lista por si el estado cambió
      loadPlayerOnlineGames();
    }
  } catch (err) {
    console.error("Error al ver resultados de partida online:", err);
    showAppAlert("Error de conexión al cargar los resultados.");
  }
}

export async function goToOnlineWaitScreen(code) {
  currentOnlineGameCode = code; // Establecer el código para que pollOnlineGameStatus funcione
  showScreen("online-wait-screen");
  pollOnlineGameStatus(); // Iniciar el polling
}

// main.js - Función continueOnlineGame
export async function continueOnlineGame(code, playerName, email) {
  try {
    // Obtener los datos completos de la partida del servidor
    const response = await fetch(`${API_BASE_URL}/api/online-games/${code}`);
    const result = await response.json(); // result es { finished: ..., players: [...], decade: ..., category: ..., songsUsed: [...] }

    if (response.ok) {
      // Establecer las variables globales para la partida
      currentOnlineGameCode = code;
      currentOnlineSongs = result.songsUsed; // Las canciones vienen de la respuesta del servidor
      currentOnlineEmail = email;
      currentOnlinePlayerName = playerName;
      isOnlineMode = true;

      // Guardar la información del juego online para usarla en startOnlineGame
      localStorage.setItem(
        "currentOnlineGameData",
        JSON.stringify({
          code: code,
          songsUsed: result.songsUsed,
          decade: result.decade,
          category: result.category,
        }),
      );

      // Limpiar el gameState actual antes de iniciar una nueva/continuar
      gameState = {
        players: [],
        totalQuestionsPerPlayer: 10,
        currentPlayerIndex: 0,
        selectedDecade: null,
        category: null,
        isOnline: true,
        onlineGameCode: currentOnlineGameCode,
      };

      // Añadir al jugador local al gameState
      const localPlayer = {
        id: 1,
        name: currentOnlinePlayerName,
        score: 0, // La puntuación se actualizará desde el servidor
        questionsAnswered: 0, // Las preguntas respondidas también se actualizarán
        questions: currentOnlineSongs,
        email: currentOnlineEmail,
        finishedOnline: false,
      };
      gameState.players.push(localPlayer);

      // Si la partida ya tiene datos de jugadores, actualiza el gameState con ellos
      const serverPlayer = result.players.find((p) => p.email === currentOnlineEmail);
      if (serverPlayer) {
        localPlayer.score = serverPlayer.score;
        localPlayer.finishedOnline = serverPlayer.finished;
        // Si el servidor guarda el progreso de las preguntas respondidas, lo aplicaríamos aquí.
        // Por ahora, asumimos que si está en curso, el jugador simplemente retoma su turno.
        // Si la partida tiene un player.currentQuestionIndex, se usaría aquí.
        // Como no lo tiene, se inicializa a 0. Esto es una simplificación.
        // Un sistema robusto persistiría el currentQuestionIndex por jugador.
      }

      // También añade al otro jugador al gameState para que `endGame` sepa que hay 2 jugadores
      const otherPlayer = result.players.find((p) => p.email !== currentOnlineEmail);
      if (otherPlayer) {
        gameState.players.push({
          id: 2, // Asignar un ID diferente
          name: otherPlayer.name,
          score: otherPlayer.score,
          questionsAnswered: otherPlayer.questionsAnswered || 0, // Si no se guarda, inicializar a 0
          questions: [], // Las canciones del rival no son relevantes para el juego local
          email: otherPlayer.email,
          finishedOnline: otherPlayer.finished,
        });
      }

      await startOnlineGame(); // Inicia el juego con los datos cargados
    } else {
      showAppAlert(result.message || "Error al cargar la partida para continuar.");
      loadPlayerOnlineGames(); // Recargar la lista por si el estado cambió
    }
  } catch (err) {
    console.error("Error de red al continuar partida online:", err);
    showAppAlert("Error de conexión. Intenta de nuevo más tarde.");
  }
}

// main.js - Añade esta nueva función
// main.js - Función showOnlineResults
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

  // Opciones de botón después de partida online: Volver al menú principal
  document.getElementById("play-again-btn").onclick = () => {
    // Limpiar estado online y volver al menú online para jugar otra partida online
    currentOnlineGameCode = null;
    currentOnlineSongs = [];
    isOnlineMode = false; // Importante resetear este estado
    localStorage.removeItem("currentOnlineGameData");
    showScreen("online-mode-screen"); // <--- ESTO LLEVA AL MENÚ ONLINE
  };
  document.getElementById("play-again-btn").textContent = "Jugar Otra Vez Online"; // Cambiar texto del botón

  // Aquí guardamos el resultado de la partida online
  saveOnlineGameToHistory(gameData);

  // Asegurarse de que el botón "Menú Principal" de la pantalla end-game-screen
  // (que está en index.html) sigue apuntando a endOnlineModeAndGoHome()
  // que a su vez te llevará a decade-selection-screen.
  // No necesitamos modificarlo aquí, solo asegurarnos de que la función existe y funciona.

  // ... código anterior dentro de showOnlineResults ...

  saveOnlineGameToHistory(gameData);

  // PEGAR ESTO AQUÍ:
  // Inyectamos datos en gameState para que el compartidor los lea
  gameState.players = gameData.players;
  gameState.selectedDecade = gameData.decade;
  gameState.category = gameData.category;

  const shareBtnOnline = document.getElementById("share-result-btn");
  if (shareBtnOnline) {
    shareBtnOnline.onclick = shareGameResultHandler;
    shareBtnOnline.style.display = "inline-block";
  }
  // FIN PEGAR

  setOnlineMenuButtonVisibility(true);
  setEndGameNavigationButtons();
  showScreen("end-game-screen");
}

export async function loadPlayerOnlineGames() {
  // 1. RECUPERACIÓN SEGURA (Crítico para móviles)
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
    const response = await fetch(`${API_BASE_URL}/api/online-games/player/${emailEnc}`, {
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
      updateOnlineInviteBadge(0);
      return;
    }

    const activeGames = games.filter((game) => !isOnlineGameFinished(game));
    const finishedGames = games.filter((game) => isOnlineGameFinished(game));

    // Notificaciones y Badge
    const pendingInvites = activeGames.filter(
      (game) => game.waitingFor === userEmail && game.players.every((p) => p.email !== userEmail),
    );
    updateOnlineInviteBadge(pendingInvites.length);
    showInviteToast(pendingInvites);

    // 3. RENDERIZADO DE PARTIDAS ACTIVAS
    if (activeGames.length > 0 && activeGamesContainer) {
      activeGames.forEach((game) => {
        const gameDiv = document.createElement("div");
        gameDiv.className = "online-game-item";

        // Variables de estado
        const isCreator = game.creatorEmail === userEmail;
        const currentPlayerStatus = game.players.find((p) => p.email === userEmail);
        const otherPlayer = game.players.find((p) => p.email !== userEmail);

        // LÓGICA DE NOMBRE (Optimizada)
        let displayRivalName = "Desconocido";

        if (game.players.length === 2 && otherPlayer) {
          displayRivalName = otherPlayer.name;
        } else if (game.waitingFor && isCreator) {
          // Si el backend envía el nombre, lo usamos. Si no, usamos el email limpio.
          displayRivalName = game.rivalPlayerName || game.waitingFor;
        } else if (!game.waitingFor && isCreator) {
          displayRivalName = "Esperando rival";
        } else if (game.players.length > 0 && !isCreator) {
          displayRivalName = game.players[0].name;
        }

        // LÓGICA DE BOTONES Y ESTADO
        let statusText = "";
        let actionButtonsHTML = "";

        // CASO 1: Me han invitado a mí
        const isWaitingForMe = game.waitingFor === userEmail && !currentPlayerStatus;

        if (isWaitingForMe) {
          statusText = `¡Te han invitado!`;
          actionButtonsHTML = `
                        <button class="btn" onclick="joinOnlineGameFromPending('${game.code}', '${playerData.playerName}', '${userEmail}')">Aceptar y Unirse</button>
                        <button class="btn secondary" onclick="declineOnlineGame('${game.code}')">Declinar</button>
                    `;
        }
        // CASO 2: Soy el Creador y estoy esperando
        else if (game.players.length === 1 && isCreator) {
          if (game.waitingFor) {
            // A) Invitación por NOMBRE
            statusText = `Invitación enviada.`;
            // Solo eliminar (Correcto según tus instrucciones)
            actionButtonsHTML = `
                            <button class="btn danger" onclick="deletePendingOnlineGame('${game.code}')">Eliminar</button>
                        `;
          } else {
            // B) Invitación por CÓDIGO
            statusText = "Esperando a que un rival se una...";
            // Copiar código y Eliminar (Quitado Declinar que sobraba)
            actionButtonsHTML = `
                            <button class="btn secondary" onclick="copyOnlineGameCode('${game.code}')">Copiar Código</button>
                            <button class="btn danger" onclick="deletePendingOnlineGame('${game.code}')">Eliminar</button>
                        `;
          }

          // Botón de rescate si el creador no jugó
          if (currentPlayerStatus && !currentPlayerStatus.finished) {
            statusText = "No has completado tu turno.";
            actionButtonsHTML = `
                            <button class="btn" onclick="continueOnlineGame('${game.code}', '${playerData.playerName}', '${userEmail}')">Jugar</button>
                            ${actionButtonsHTML}
                        `;
          }
        }
        // CASO 3: Partida en curso (2 jugadores)
        else if (game.players.length === 2) {
          const otherPlayerFinished = otherPlayer ? otherPlayer.finished : false;
          const myFinished = currentPlayerStatus ? currentPlayerStatus.finished : false;

          if (myFinished && !otherPlayerFinished) {
            statusText = `Esperando a ${otherPlayer ? otherPlayer.name : "rival"}...`;
            actionButtonsHTML = `<button class="btn secondary" onclick="goToOnlineWaitScreen('${game.code}')">Ver Estado</button>`;
          } else if (!myFinished && otherPlayerFinished) {
            statusText = `¡Tu turno! ${otherPlayer ? otherPlayer.name : "Rival"} ha terminado.`;
            actionButtonsHTML = `<button class="btn" onclick="continueOnlineGame('${game.code}', '${playerData.playerName}', '${userEmail}')">Jugar</button>`;
          } else if (!myFinished && !otherPlayerFinished) {
            statusText = `Partida en curso.`;
            actionButtonsHTML = `<button class="btn" onclick="continueOnlineGame('${game.code}', '${playerData.playerName}', '${userEmail}')">Continuar</button>`;
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

    // 4. RENDERIZADO DE PARTIDAS FINALIZADAS
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
                    <button class="btn" onclick="viewOnlineGameResults('${game.code}')">Ver Resultados</button>
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
