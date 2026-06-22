import { showAppAlert } from "./modal-functions.js";
import { showScreen } from "./screen-functions.js";
import { hasPremiumAccess, showPremiumModal } from "./premium-functions.js";
import { saveUserScores } from "./user-functions.js";
import { saveGameResult } from "./game-functions.js";
import { updateRecentSongsHistory } from "./songs-history.js";
import { setEndGameNavigationButtons, setOnlineMenuButtonVisibility } from "./navigation-functions.js";
import { shareGameResultHandler } from "./share-functions.js";
import { playAudioSnippet } from "./audio-manager.js";
import { setupQuestion, updateAttemptsCounter, checkAnswer } from "./questions.js";

// Variables globales accedidas desde window (definidas en constants.js)
// gameState, isOnlineMode, isElderlyMode, isSummerSongsMode, currentUser
// configuracionCanciones, loadSongsForDecadeAndCategory

/**
 * Permite al usuario seleccionar el número de jugadores y prepara los inputs para sus nombres.
 * @param {number} numPlayers - El número de jugadores seleccionado.
 */
export function selectPlayers(numPlayers) {
  if (!window.currentUser || !window.currentUser.playerName) {
    showAppAlert("Debes iniciar sesión y establecer tu nombre de jugador para continuar.");
    showScreen("login-screen");
    return;
  }

  window.gameState.playerCount = numPlayers;
  const otherPlayerNamesInputsDiv = document.getElementById("other-player-names-inputs");
  otherPlayerNamesInputsDiv.innerHTML = "";

  document.getElementById("logged-in-player-name").textContent = window.currentUser.playerName;

  for (let i = 1; i < numPlayers; i++) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "text-input";
    input.placeholder = `Nombre del Jugador ${i + 1}`;
    input.id = `player-${i + 1}-name-input`;
    otherPlayerNamesInputsDiv.appendChild(input);
  }

  if (numPlayers === 1) {
    startGame();
    return;
  }

  showScreen("player-names-input-screen");
}

/**
 * Inicia el modo "Canciones del Verano".
 */
export async function startSummerSongsGame() {
  if (!hasPremiumAccess()) {
    showPremiumModal("Contenido premium. Próximamente disponible mediante desbloqueo.");
    return;
  }
  if (!window.currentUser || !window.currentUser.playerName) {
    showAppAlert("Debes iniciar sesión y establecer tu nombre de jugador para continuar.");
    showScreen("login-screen");
    return;
  }

  // Limpiar el estado anterior del juego y establecer el modo de verano
  window.gameState = {}; // Limpiar completamente el gameState para el nuevo modo
  window.isOnlineMode = false;
  window.isElderlyMode = false;
  window.isSummerSongsMode = true; // Establecer esto a TRUE para que la lógica de retorno y fin de juego lo reconozca

  window.gameState.selectedDecade = "verano"; // Década especial para el verano
  window.gameState.category = "consolidated"; // Categoría 'consolidated' para el verano

  // Aquí precargamos las canciones y hacemos la validación ANTES de ir a la selección de jugadores.
  // Esto asegura que solo permitimos continuar si hay suficientes canciones para este modo.
  try {
    await window.loadSongsForDecadeAndCategory(window.gameState.selectedDecade, window.gameState.category);
    const allSongsToChooseFrom =
      window.configuracionCanciones[window.gameState.selectedDecade][window.gameState.category];

    // Para este modo, asumiremos que se necesitan al menos 10 canciones en total para poder jugar
    // con un mínimo de 1 jugador y que tenga al menos 10 preguntas.
    const minimumSongsRequired = 10; // Mínimo de canciones para empezar una partida de 1 jugador

    if (!allSongsToChooseFrom || allSongsToChooseFrom.length < minimumSongsRequired) {
      showAppAlert(
        `No hay suficientes canciones en el modo "Canciones del Verano". Necesitas al menos ${minimumSongsRequired} canciones para jugar.`,
      );
      showScreen("decade-selection-screen"); // Volver si no hay suficientes
      return;
    }

    console.log(`Canciones de verano precargadas: ${allSongsToChooseFrom.length} canciones disponibles.`);

    // Si hay suficientes canciones, pasamos a la pantalla de selección de jugadores.
    showScreen("player-selection-screen");
  } catch (error) {
    console.error('Error al precargar canciones para el modo "Canciones del Verano":', error);
    showAppAlert('Error al cargar las canciones para el modo "Canciones del Verano". Intenta de nuevo más tarde.');
    showScreen("decade-selection-screen"); // Volver a la selección de década
  }
}

/**
 * Inicia una nueva partida, configurando jugadores y preguntas.
 */
export function startGame() {
  if (!window.currentUser || !window.currentUser.playerName) {
    showAppAlert("Error: No se ha encontrado el nombre del jugador principal. Por favor, inicia sesión de nuevo.");
    window.logout?.();
    return;
  }
  if (!window.gameState.selectedDecade || !window.gameState.category) {
    showAppAlert("Error: No se ha seleccionado una década o categoría. Vuelve a empezar.");
    showScreen("decade-selection-screen");
    return;
  }

  window.gameState.players = [];
  window.gameState.players.push({
    id: 1,
    name: window.currentUser.playerName,
    score: 0,
    questionsAnswered: 0,
    questions: [],
    email: window.currentUser.email,
  });

  for (let i = 1; i < window.gameState.playerCount; i++) {
    const input = document.getElementById(`player-${i + 1}-name-input`);
    const name = input.value.trim() || `Jugador ${i + 1}`;
    window.gameState.players.push({
      id: i + 1,
      name: name,
      score: 0,
      questionsAnswered: 0,
      questions: [],
    });
  }

  const allSongsToChooseFrom =
    window.gameState.selectedDecade === "Todas"
      ? window.configuracionCanciones?.["Todas"]?.[window.gameState.category]
      : window.configuracionCanciones?.[window.gameState.selectedDecade]?.[window.gameState.category];

  if (!Array.isArray(allSongsToChooseFrom) || allSongsToChooseFrom.length === 0) {
    showAppAlert("Error: No hay canciones disponibles para esta combinación.");
    showScreen("decade-selection-screen");
    return;
  }

  const songsToExclude = window.currentUser ? window.getRecentSongs(window.currentUser.email, 10) : [];
  let availableSongs = allSongsToChooseFrom.filter((song) => !songsToExclude.has(song.file));

  if (availableSongs.length < window.gameState.totalQuestionsPerPlayer) {
    availableSongs = allSongsToChooseFrom;
  }

  availableSongs.sort(() => 0.5 - Math.random());

  for (const player of window.gameState.players) {
    player.questions = availableSongs.slice(0, window.gameState.totalQuestionsPerPlayer);
    availableSongs = availableSongs.slice(window.gameState.totalQuestionsPerPlayer);
  }

  window.gameState.currentPlayerIndex = 0;
  setupQuestion(nextPlayerOrEndGame);
  showScreen("game-screen");
}

/**
 * Avanza al siguiente jugador o finaliza la partida si todos han jugado.
 */
export function nextPlayerOrEndGame() {
  const currentPlayer = window.gameState.players[window.gameState.currentPlayerIndex];

  if (window.gameState.players.length === 1) {
    if (currentPlayer.questionsAnswered >= window.gameState.totalQuestionsPerPlayer) {
      endGame();
    } else {
      setupQuestion(nextPlayerOrEndGame);
    }
    return;
  }

  if (currentPlayer.questionsAnswered >= window.gameState.totalQuestionsPerPlayer) {
    window.gameState.currentPlayerIndex++;

    if (window.gameState.currentPlayerIndex < window.gameState.players.length) {
      document.getElementById("current-player-score-summary").textContent =
        `${currentPlayer.name} ha terminado su turno con ${currentPlayer.score} puntos.`;
      document.getElementById("next-player-prompt").textContent =
        `Siguiente jugador: ${window.gameState.players[window.gameState.currentPlayerIndex].name}, ¿preparado para comenzar?`;
      showScreen("player-transition-screen");
    } else {
      endGame();
    }
  } else {
    setupQuestion(nextPlayerOrEndGame);
  }
}

/**
 * Continúa el turno del siguiente jugador después de una pantalla de transición.
 */
export function continueToNextPlayerTurn() {
  setupQuestion(nextPlayerOrEndGame);
  showScreen("game-screen");
}

/**
 * Finaliza la partida, calcula el ganador y guarda los resultados.
 */
export function endGame() {
  if (window.isOnlineMode) {
    window.submitOnlineScore?.(); // Si es online, envía la puntuación al servidor
    return;
  }

  const finalScoresContainer = document.getElementById("final-scores");
  finalScoresContainer.innerHTML = "<h3>Puntuaciones Finales</h3>";
  const winnerDisplay = document.getElementById("winner-display");

  const sortedPlayers = [...window.gameState.players].sort((a, b) => b.score - a.score);

  if (window.gameState.players.length === 1) {
    const player = window.gameState.players[0];
    winnerDisplay.textContent = `${player.name} has conseguido ${player.score} puntos.`;
    winnerDisplay.style.animation = "none";
    winnerDisplay.style.textShadow = "none";
    winnerDisplay.style.color = "var(--light-text-color)";
    winnerDisplay.style.border = "none";
    winnerDisplay.style.fontSize = "1.8rem";

    if (window.currentUser && window.currentUser.email && !window.isElderlyMode && !window.isSummerSongsMode) {
      saveUserScores(
        window.currentUser.email,
        window.gameState.selectedDecade,
        window.gameState.category,
        player.score,
      );
    }
  } else {
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

    if (window.currentUser && window.currentUser.email && !window.isElderlyMode && !window.isSummerSongsMode) {
      const loggedInPlayer = window.gameState.players.find((p) => p.email === window.currentUser.email);
      if (loggedInPlayer) {
        saveUserScores(
          window.currentUser.email,
          window.gameState.selectedDecade,
          window.gameState.category,
          loggedInPlayer.score,
        );
      } else {
        console.warn("Usuario logueado no encontrado en la lista de jugadores de la partida.");
      }
    }

    if (
      !window.isElderlyMode &&
      !window.isSummerSongsMode &&
      window.gameState.players.length > 1 &&
      !window.isOnlineMode
    ) {
      saveGameResult(window.gameState.players, winnerName, window.gameState.selectedDecade, window.gameState.category);
    }
  }

  sortedPlayers.forEach((player, index) => {
    const medal = window.gameState.players.length > 1 ? { 0: "🥇", 1: "🥈", 2: "🥉" }[index] || "" : "";
    finalScoresContainer.innerHTML += `<p>${medal} ${player.name}: <strong>${player.score} puntos</strong></p>`;
  });

  // Recopilar todas las canciones jugadas en esta partida
  let allPlayedSongsInThisGame = [];
  window.gameState.players.forEach((player) => {
    allPlayedSongsInThisGame = allPlayedSongsInThisGame.concat(player.questions);
  });

  // Actualizar el historial de canciones recientes
  if (window.currentUser && window.currentUser.email) {
    updateRecentSongsHistory(
      window.currentUser.email,
      window.gameState.selectedDecade,
      window.gameState.category,
      allPlayedSongsInThisGame,
    );
  }

  // Configurar botón "Jugar Otra Vez"
  document.getElementById("play-again-btn").textContent = "Jugar Otra Vez";
  document.getElementById("play-again-btn").onclick = () => {
    if (window.isElderlyMode) {
      document.getElementById("elderly-player-1-name").value = "";
      document.getElementById("elderly-other-player-names-inputs").innerHTML = "";
      window.elderlyPlayerCount = 1;
      showScreen("elderly-mode-intro-screen");
    } else if (window.isSummerSongsMode) {
      window.isSummerSongsMode = false;
      window.gameState = {};
      startSummerSongsGame();
    } else if (window.isOnlineMode) {
      window.isOnlineMode = false;
      window.currentOnlineGameCode = null;
      window.currentOnlineSongs = [];
      window.currentOnlineEmail = null;
      window.currentOnlinePlayerName = null;
      localStorage.removeItem("currentOnlineGameData");
      showScreen("online-mode-screen");
    } else {
      window.gameState.players.forEach((player) => {
        player.score = 0;
        player.questionsAnswered = 0;
        player.questions = [];
      });
      showScreen("player-selection-screen");
    }
  };

  // Configurar botón de compartir
  const shareBtn = document.getElementById("share-result-btn");
  if (shareBtn) {
    shareBtn.onclick = shareGameResultHandler;
    shareBtn.style.display = "inline-block";
  }

  setOnlineMenuButtonVisibility(false);
  setEndGameNavigationButtons();
  showScreen("end-game-screen");
}
