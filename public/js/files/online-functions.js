import { logger } from "./logger.js";

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
            logger.debug("Compartir cancelado o no disponible");
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
    logger.error("Error en createOnlineGame", err);
    showAppAlert("Error de conexión al crear la partida.");
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

