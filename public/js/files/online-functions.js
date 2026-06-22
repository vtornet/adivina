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

// ========== CREAR PARTIDA ONLINE ==========
export async function createOnlineGame() {
  const decade = document.getElementById("online-decade-select").value;
  const category = document.getElementById("online-category-select").value;
  const playerData = getCurrentUserData();

  if (!playerData || !playerData.email) {
    showAppAlert("Debes iniciar sesión para crear una partida.");
    return;
  }

  // Validación de acceso premium
  if (isPremiumSelection(decade, category) && !hasPremiumAccess()) {
    showPremiumModal("Esta combinación es Premium. Desbloquéala para jugar online.", category);
    return;
  }

  try {
    await loadSongsForDecadeAndCategory(decade, category);
    const songsArray = configuracionCanciones[decade][category].sort(() => 0.5 - Math.random()).slice(0, 10);

    if (songsArray.length < 10) {
      showAppAlert("No hay suficientes canciones en esta categoría.");
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/online-games`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creatorEmail: playerData.email,
        category,
        decade,
        songsUsed: songsArray,
        playerName: playerData.playerName,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      currentOnlineGameCode = result.code;
      isOnlineMode = true;

      localStorage.setItem(
        "currentOnlineGameData",
        JSON.stringify({
          code: result.code,
          songsUsed: songsArray,
          decade: decade,
          category: category,
        }),
      );

      // MODAL CON BOTONES DE COPIAR Y COMPARTIR
      const shareText = `¡Rétame en Adivina la Canción! 🎵\nMi código de partida es: ${result.code}\nJuega aquí: https://adivinalacancion.app`;

      const modalOptions = {
        title: "¡Partida Creada!",
        message: `Tu código es: ${result.code}\n\nComparte este código con tu rival para que pueda unirse.`,
        confirmText: "Empezar Partida",
        cancelText: "Copiar y Compartir",
        showCancel: true,
      };

      const userChoice = await showAppModal(modalOptions);

      if (!userChoice) {
        // Si el usuario pulsa "Copiar y Compartir"
        if (navigator.share) {
          try {
            await navigator.share({
              title: "Duelo Online - Adivina la Canción",
              text: shareText,
            });
          } catch (err) {
            console.log("Compartir cancelado o no disponible");
            copyOnlineGameCode(result.code);
          }
        } else {
          copyOnlineGameCode(result.code);
        }
      }

      // Iniciar la partida tras la interacción
      startOnlineGame();
    } else {
      showAppAlert(result.message || "Error al crear la partida.");
    }
  } catch (err) {
    console.error("Error en createOnlineGame:", err);
    showAppAlert("Error de conexión al crear la partida.");
  }
}

// Nueva función de apoyo P3
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

// ========== UNIRSE A UNA PARTIDA ONLINE ==========
export async function joinOnlineGame() {
  const code = document.getElementById("join-code-input").value.trim().toUpperCase();
  if (!code) return showAppAlert("Introduce un código válido.");

  const playerData = getCurrentUserData(); // <-- OBTENER DATOS AQUÍ
  if (!playerData || !playerData.email || !playerData.playerName) {
    // <<-- ¡CUIDADO! AQUÍ DICE 'player.playerName', debe ser playerData.playerName
    showAppAlert("Debes iniciar sesión con tu nombre de jugador para jugar online.");
    showScreen("login-screen"); // <-- Redirigir a login si no está logueado
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/online-games/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        playerName: playerData.playerName,
        email: playerData.email,
      }),
    });

    const result = await response.json();
    if (response.ok) {
      currentOnlineGameCode = code;
      currentOnlineSongs = result.game.songsUsed;
      currentOnlineEmail = playerData.email;
      currentOnlinePlayerName = playerData.playerName;
      isOnlineMode = true;
      localStorage.setItem(
        "currentOnlineGameData",
        JSON.stringify({
          code: code,
          songsUsed: result.game.songsUsed,
          decade: result.game.decade, // <-- AÑADE ESTO
          category: result.game.category, // <-- AÑADE ESTO
        }),
      );
      await startOnlineGame();
    } else {
      showAppAlert(result.message || "Error al unirse a la partida.");
    }
  } catch (err) {
    console.error(err);
    showAppAlert("Error al unirse a la partida.");
  }
}

// Nueva función para unirse a una partida pendiente (reutiliza lógica de joinOnlineGame)
export async function joinOnlineGameFromPending(code, playerName, email) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/online-games/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code,
        playerName: playerName,
        email: email,
      }),
    });

    const result = await response.json(); // result es { game: {...} }
    if (response.ok) {
      // Si la unión es exitosa, establece las variables de juego online
      currentOnlineGameCode = code;
      currentOnlineSongs = result.game.songsUsed;
      currentOnlineEmail = email;
      currentOnlinePlayerName = playerName;
      isOnlineMode = true;

      // Guardar info del juego online para usarla en startOnlineGame
      localStorage.setItem(
        "currentOnlineGameData",
        JSON.stringify({
          code: code,
          songsUsed: result.game.songsUsed,
          decade: result.game.decade,
          category: result.game.category,
        }),
      );

      await startOnlineGame(); // Inicia el juego
    } else {
      showAppAlert(result.message || "Error al unirse a la partida pendiente.");
      loadPlayerOnlineGames(); // Recarga la lista por si el estado cambió
    }
  } catch (err) {
    console.error("Error de red al unirse a la partida pendiente:", err);
    showAppAlert("Error de conexión. Intenta de nuevo más tarde.");
  }
}

// ========== OBTENER CANCIONES PARA LA PARTIDA ONLINE ==========
export async function getSongsForOnlineMatch(decade, category) {
  await loadSongsForDecadeAndCategory(decade, category);
  // ====== MODO "TODAS LAS DÉCADAS" ======
  if (gameState.selectedDecade === "Todas") {
    gameState.category = category;

    const allDecades = ["80s", "90s", "00s", "10s", "Actual"];

    let mergedSongs = [];

    for (const dec of allDecades) {
      try {
        await loadSongsForDecadeAndCategory(dec, category);

        if (
          configuracionCanciones[dec] &&
          configuracionCanciones[dec][category] &&
          Array.isArray(configuracionCanciones[dec][category])
        ) {
          mergedSongs = mergedSongs.concat(configuracionCanciones[dec][category]);
        }
      } catch (e) {
        console.warn(`No se pudieron cargar canciones de ${dec} - ${category}`, e);
      }
    }

    // Guardamos mezcla global
    configuracionCanciones["Todas"] = configuracionCanciones["Todas"] || {};
    configuracionCanciones["Todas"][category] = mergedSongs;

    // Validación mínima
    if (mergedSongs.length < gameState.totalQuestionsPerPlayer) {
      showAppAlert(
        `No hay suficientes canciones en la categoría ${getCategoryLabel(category)} para jugar en Todas las Décadas.`,
      );
      return;
    }

    showScreen("player-selection-screen");
    return;
  }

  const songs = configuracionCanciones[decade][category];
  const shuffled = [...songs].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 10);
}

// ========== EMPEZAR PARTIDA ONLINE ==========
export async function startOnlineGame() {
  // Reiniciar el gameState para una partida online
  gameState = {
    players: [],
    totalQuestionsPerPlayer: 10, // Por ahora, fijo para online
    currentPlayerIndex: 0,
    selectedDecade: null,
    category: null,
    isOnline: true, // Indica que es una partida online
    onlineGameCode: currentOnlineGameCode, // Almacenar el código aquí también
  };

  const localPlayer = {
    id: 1,
    name: currentOnlinePlayerName,
    score: 0,
    questionsAnswered: 0,
    questions: currentOnlineSongs, // Las canciones ya vienen del servidor
    email: currentOnlineEmail,
    finishedOnline: false, // Nuevo campo para controlar el estado online del jugador
  };
  gameState.players.push(localPlayer);

  // Si es una partida de dos jugadores, necesitaríamos al rival aquí.
  // Por ahora, solo tenemos al jugador local, la lógica del rival se manejará en el submit/poll
  // (La lógica del rival en el cliente puede ser más compleja o se maneja desde el servidor al comparar scores)

  // Configurar la primera pregunta
  // La información de decade y category debe venir con currentOnlineGame

  // Para esto, necesitaríamos que `joinOnlineGameFromPending` pase también la década y categoría.
  // O que `currentOnlineGame` las almacene globalmente.

  // Añadir decade y category a gameState desde el juego online
  const gameData = JSON.parse(localStorage.getItem("currentOnlineGameData")); // Recuperar datos del juego
  if (gameData) {
    gameState.selectedDecade = gameData.decade;
    gameState.category = gameData.category;
  } else {
    console.error("No se encontraron datos de la partida online en localStorage.");
    showAppAlert("Error: No se pudo cargar la información de la década/categoría para la partida online.");
    showScreen("online-mode-screen");
    return;
  }
  try {
    await loadSongsForDecadeAndCategory(gameState.selectedDecade, gameState.category);
  } catch (error) {
    console.error("Error al cargar las canciones para la partida online:", error);
    showAppAlert("Error al cargar las canciones para la partida online. Intenta de nuevo más tarde.");
    showScreen("online-mode-screen");
    return;
  }

  setupQuestion();
  showScreen("game-screen");
}

// ========== ENVIAR RESULTADO AL TERMINAR ==========
export async function submitOnlineScore() {
  // Asegurarse de que tenemos los datos del jugador actual
  const localPlayer = gameState.players.find((p) => p.email === currentOnlineEmail);
  if (!localPlayer) {
    console.error("Error: Jugador local no encontrado en gameState para submitOnlineScore.");
    showAppAlert("Error interno al enviar la puntuación.");
    return;
  }

  try {
    const storedGame = JSON.parse(localStorage.getItem("currentOnlineGameData") || "{}");

    const response = await fetch(`${API_BASE_URL}/api/online-games/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: storedGame.code || currentOnlineGameCode,
        email: localPlayer.email,
        score: localPlayer.score,
      }),
    });

    const result = await response.json();
    if (response.ok) {
      if (result.finished) {
        // Si ambos jugadores terminaron, mostrar resultados
        // Aquí llamaremos a una función de final de juego online
        showOnlineResults(result.game); // Nueva función para resultados online
      } else {
        // Si el otro jugador aún no termina, esperar
        showScreen("online-wait-screen");
        pollOnlineGameStatus();
      }
    } else {
      showAppAlert(result.message || "Error al enviar resultado.");
    }
  } catch (err) {
    console.error(err);
    showAppAlert("Error al guardar la puntuación online.");
  }
}

export function pollOnlineGameStatus() {
  const interval = setInterval(async () => {
    try {
      // currentOnlineGameCode debe estar disponible globalmente
      if (!currentOnlineGameCode) {
        clearInterval(interval);
        console.error("No hay código de partida online para consultar.");
        // Podríamos redirigir a una pantalla de error o menú principal aquí
        showScreen("online-mode-screen");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/online-games/${currentOnlineGameCode}`);
      const result = await response.json();

      if (!response.ok) {
        console.error("Error al consultar estado de partida:", result.message);
        // Podrías mostrar una alerta o simplemente dejar que siga intentando
        return;
      }

      if (result.finished) {
        clearInterval(interval); // Detener la consulta
        // Aquí, ambos jugadores han terminado. Mostrar los resultados.
        showOnlineResults(result); // result ya contiene game.players, game.decade, etc.
      } else {
        // Si aún no han terminado, podríamos actualizar el estado en pantalla si quisiéramos
        // Por ahora, el mensaje "Esperando..." es suficiente.
        console.log("Esperando al otro jugador...");
      }
    } catch (err) {
      console.error("Error de red al comprobar estado online:", err);
      // Si hay un error de red persistente, podríamos ofrecer una opción al usuario.
      // clearInterval(interval); // No limpiar el intervalo en errores de red temporales.
    }
  }, 3000); // Comprueba cada 3 segundos (antes 5 segundos, 3 es más rápido)
}

export async function saveOnlineGameToHistory(gameData) {
  try {
    const payload = {
      date: new Date().toISOString(),
      players: gameData.players,
      winner: getWinnerName(gameData.players),
      decade: gameData.decade,
      category: gameData.category,
    };

    await fetch(`${API_BASE_URL}/api/gamehistory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Error al guardar historial online:", err);
  }
}

export function getWinnerName(players) {
  if (players.length !== 2) return "Desconocido";
  const [a, b] = players;
  if (a.score > b.score) return a.name;
  if (b.score > a.score) return b.name;
  return "Empate";
}

export function formatOnlineGameDate(dateValue) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

export function isOnlineGameFinished(game) {
  return game.players.length === 2 && (game.finished || game.players.every((player) => player.finished));
}

export async function invitePlayerByName() {
  const rivalName = document.getElementById("rival-name-input").value.trim();
  const decade = document.getElementById("invite-decade-select").value;
  const category = document.getElementById("invite-category-select").value;

  const playerData = getCurrentUserData(); // <-- OBTENER DATOS AQUÍ
  if (!rivalName || !playerData || !playerData.email || !playerData.playerName) {
    showAppAlert("Faltan datos o no estás logueado con un nombre de jugador.");
    showScreen("login-screen"); // <-- Redirigir a login si no está logueado
    return;
  }
  if (isPremiumSelection(decade, category) && !hasPremiumAccess()) {
    // INDICACIÓN PRECISA: Pasamos 'category' para que el modal sepa qué categoría ofrecer
    showPremiumModal("Esta categoría es Premium. Desbloquéala para invitar a tus amigos.", category);
    return;
  }

  const songsArray = await getSongsForOnlineMatch(decade, category);
  if (!songsArray || songsArray.length < 10) {
    showAppAlert("No hay suficientes canciones.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/online-games/by-username`, {
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
      showAppAlert("Invitación enviada a " + rivalName);
      currentOnlineGameCode = result.code; // El código debe ser devuelto por el servidor en by-username
      currentOnlineSongs = songsArray; // Las canciones ya las tenemos
      currentOnlineEmail = playerData.email;
      currentOnlinePlayerName = playerData.playerName;
      isOnlineMode = true;

      // Guardar la información del juego online para usarla en startOnlineGame
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
      showAppAlert(result.message || "Error al invitar.");
    }
  } catch (err) {
    console.error(err);
    showAppAlert("Error al enviar la invitación.");
  }
}

/**
 * Muestra un toast de notificación cuando hay invitaciones pendientes.
 * @param {Array} invites - Array de invitaciones pendientes.
 */
export function showInviteToast(invites) {
  if (!invites || invites.length === 0) return;

  const newInvites = invites.filter((invite) => !lastInviteCodes.has(invite.code));
  if (newInvites.length === 0) return;

  newInvites.forEach((invite) => lastInviteCodes.add(invite.code));

  const invite = newInvites[0];
  const invitingPlayerName = invite.players[0] ? invite.players[0].name : "Alguien";
  addNotification(`Nueva invitación de ${invitingPlayerName}.`, "invite");
  sendInviteNotification(invitingPlayerName);
  const toast = document.createElement("div");
  toast.className = "invite-toast";
  toast.innerHTML = `
        <p>¡Nueva invitación de <strong>${invitingPlayerName}</strong>!</p>
        <button class="btn" type="button">Ver partidas recibidas</button>
    `;

  const button = toast.querySelector("button");
  button.addEventListener("click", () => {
    toast.remove();
    showScreen("pending-games-screen");
  });

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("hide");
    setTimeout(() => toast.remove(), 200);
  }, 6000);
}

export function sendInviteNotification(invitingPlayerName) {
  // Verificar soporte
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

  if (Notification.permission === "granted") {
    // Usar el Service Worker para mostrar la notificación (Compatible con Android/PWA)
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification("Nueva invitación online", {
        body: `Te ha invitado ${invitingPlayerName}.`,
        icon: "img/adivina.png",
        vibrate: [200, 100, 200],
        badge: "img/adivina.png",
        tag: "invite-notification",
      });
    });
  }
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
    showScreen("pending-games-screen");
    notification.close();
  };
}
