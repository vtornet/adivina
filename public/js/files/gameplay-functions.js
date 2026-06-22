import { showAppAlert } from "./modal-functions.js";
import { showScreen } from "./screen-functions.js";
import { getDecadeLabel, getCategoryLabel } from "./app-info-functions.js";
import { hasPremiumAccess, showPremiumModal } from "./premium-functions.js";
import { saveUserScores, getLocalScores } from "./user-functions.js";
import { saveGameResult } from "./game-functions.js";
import { getRecentSongs, updateRecentSongsHistory } from "./songs-history.js";
import { setEndGameNavigationButtons, setOnlineMenuButtonVisibility } from "./navigation-functions.js";
import { shareGameResultHandler } from "./share-functions.js";
import { parseDisplay } from "./songs-list-functions.js";

// Variables globales accedidas desde window (definidas en constants.js)
// audioPlayer, sfxAcierto, sfxError, gameState, activeTimeUpdateListener, audioPlaybackTimeout
// isOnlineMode, isElderlyMode, isSummerSongsMode, currentUser
// configuracionCanciones, loadSongsForDecadeAndCategory

/**
 * Reproduce un fragmento de audio de la canción actual.
 * La duración depende del número de intentos restantes.
 */
export function playAudioSnippet() {
  if (window.gameState.hasPlayed) return;

  const durations = { 3: 4.0, 2: 6.0, 1: 10.0 };
  const durationSecs = durations[window.gameState.attempts];
  const currentPlayer = window.gameState.players[window.gameState.currentPlayerIndex];
  const currentQuestion = currentPlayer.questions[currentPlayer.questionsAnswered];

  let fileName = typeof currentQuestion.file === "string" ? currentQuestion.file.trim() : "";
  if (!fileName) return;

  
  // Detectamos si la ruta viene con Mayúscula (Actual) y la forzamos a minúscula (actual)
  // para coincidir con el nombre físico de la carpeta en el servidor Linux.
  if (fileName.startsWith("Actual/")) {
    fileName = fileName.replace("Actual/", "actual/");
  }
  // --------------------------------------------------

  const playBtn = document.getElementById("play-song-btn");
  playBtn.innerText = "🎵";
  playBtn.disabled = true;
  playBtn.classList.add("is-playing");
  window.gameState.hasPlayed = true;

  let audioSrc = fileName.startsWith("/") ? fileName : `/audio/${fileName}`;

  // Usamos tu lógica original de comprobación para no alterar el comportamiento
  if (!window.audioPlayer.src.endsWith(audioSrc)) {
    window.audioPlayer.src = audioSrc;
  }

  if (window.activeTimeUpdateListener)
    window.audioPlayer.removeEventListener("timeupdate", window.activeTimeUpdateListener);
  window.audioPlayer.currentTime = 0;

  const stopAudioListener = () => {
    if (window.audioPlayer.currentTime >= durationSecs) {
      window.audioPlayer.pause();
      window.audioPlayer.currentTime = 0;
      playBtn.innerText = "▶";
      playBtn.classList.remove("is-playing");
      window.audioPlayer.removeEventListener("timeupdate", stopAudioListener);
      window.activeTimeUpdateListener = null;
    }
  };

  window.activeTimeUpdateListener = stopAudioListener;
  window.audioPlayer.addEventListener("timeupdate", stopAudioListener);

  window.audioPlayer.play().catch((e) => {
    console.error("Fallo 404 en ruta física:", audioSrc);
    playBtn.disabled = false;
    playBtn.innerText = "▶";
    playBtn.classList.remove("is-playing");
    window.gameState.hasPlayed = false;
    showAppAlert("Error 404: El archivo no se encuentra en el servidor.");
  });
}

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

  window.gameState.totalQuestionsPerPlayer = 10;

  let allSongsToChooseFrom;

  if (window.gameState.selectedDecade === "Todas") {
    const mergedPool = window.configuracionCanciones?.["Todas"]?.[window.gameState.category];

    if (!Array.isArray(mergedPool) || mergedPool.length < 4) {
      showAppAlert(
        `Error: No hay suficientes canciones en '${getCategoryLabel(window.gameState.category)}' para ${getDecadeLabel(window.gameState.selectedDecade)}.`,
      );
      showScreen("category-screen");
      return;
    }

    allSongsToChooseFrom = [...mergedPool];
  } else {
    if (
      !window.configuracionCanciones[window.gameState.selectedDecade] ||
      !window.configuracionCanciones[window.gameState.selectedDecade][window.gameState.category]
    ) {
      showAppAlert(
        `Error: No se encontraron canciones para la década ${getDecadeLabel(window.gameState.selectedDecade)} y categoría ${getCategoryLabel(window.gameState.category)}.`,
      );
      showScreen("decade-selection-screen");
      return;
    }

    allSongsToChooseFrom = [
      ...window.configuracionCanciones[window.gameState.selectedDecade][window.gameState.category],
    ];
  }

  const requiredSongs = window.gameState.totalQuestionsPerPlayer * window.gameState.playerCount;

  if (allSongsToChooseFrom.length < requiredSongs) {
    console.warn(
      `Advertencia: No hay suficientes canciones en ${getDecadeLabel(window.gameState.selectedDecade)} - ${getCategoryLabel(window.gameState.category)}. Se necesitan ${requiredSongs} y solo hay ${allSongsToChooseFrom.length}. Ajustando el número de preguntas por jugador.`,
    );
    window.gameState.totalQuestionsPerPlayer = Math.floor(allSongsToChooseFrom.length / window.gameState.playerCount);
    if (window.gameState.totalQuestionsPerPlayer < 1) {
      showAppAlert(
        `No hay suficientes canciones en ${getDecadeLabel(window.gameState.selectedDecade)} - ${getCategoryLabel(window.gameState.category)} para que cada jugador tenga al menos una pregunta. Elige otra década o categoría.`,
      );
      showScreen("decade-selection-screen");
      return;
    }
  }

  // Obtener el historial de canciones recientes para el usuario y la categoría/década actuales
  const recentSongFiles = getRecentSongs(
    window.currentUser.email,
    window.gameState.selectedDecade,
    window.gameState.category,
  );
  console.log("Canciones recientes a evitar:", recentSongFiles);

  // Separar canciones en "no recientes" y "recientes"
  let nonRecentSongs = allSongsToChooseFrom.filter((song) => !recentSongFiles.has(song.file));
  let recentSongs = allSongsToChooseFrom.filter((song) => recentSongFiles.has(song.file));

  console.log("Canciones no recientes:", nonRecentSongs.length);
  console.log("Canciones recientes (para usar si es necesario):", recentSongs.length);

  // Priorizar canciones no recientes, luego añadir de las recientes si no hay suficientes
  let songsForThisGame = nonRecentSongs.sort(() => 0.5 - Math.random()); // Baraja las no recientes

  const totalRequiredSongs = requiredSongs;

  // Si no hay suficientes canciones "no recientes", añadimos de las "recientes"
  if (songsForThisGame.length < totalRequiredSongs) {
    const needed = totalRequiredSongs - songsForThisGame.length;
    const additionalSongs = recentSongs.sort(() => 0.5 - Math.random()).slice(0, needed);
    songsForThisGame = songsForThisGame.concat(additionalSongs);
    console.warn(
      `Advertencia: No hay suficientes canciones no recientes. Se han añadido ${additionalSongs.length} canciones recientes.`,
    );
  }

  // Asegurarse de que el array final esté barajado si se combinaron listas
  songsForThisGame.sort(() => 0.5 - Math.random());

  // Asignar preguntas a los jugadores
  for (let i = 0; i < window.gameState.playerCount; i++) {
    if (songsForThisGame.length >= window.gameState.totalQuestionsPerPlayer) {
      window.gameState.players[i].questions = songsForThisGame.splice(0, window.gameState.totalQuestionsPerPlayer);
    } else {
      window.gameState.players[i].questions = [...songsForThisGame];
      console.warn(
        `No se pudieron asignar ${window.gameState.totalQuestionsPerPlayer} preguntas al jugador ${window.gameState.players[i].name}. Solo se asignaron ${songsForThisGame.length} preguntas.`,
      );
      songsForThisGame = [];
      window.gameState.totalQuestionsPerPlayer = window.gameState.players[i].questions.length;
    }
  }

  window.gameState.currentPlayerIndex = 0;
  setupQuestion();
  showScreen("game-screen");
}

/**
 * Configura la siguiente pregunta del juego.
 */
export function setupQuestion() {
  const currentPlayer = window.gameState.players[window.gameState.currentPlayerIndex];

  if (currentPlayer.questionsAnswered >= window.gameState.totalQuestionsPerPlayer) {
    nextPlayerOrEndGame();
    return;
  }

  clearTimeout(window.audioPlaybackTimeout);

  // Limpieza preventiva de listeners de audio
  if (window.activeTimeUpdateListener) {
    window.audioPlayer.removeEventListener("timeupdate", window.activeTimeUpdateListener);
    window.activeTimeUpdateListener = null;
  }

  window.audioPlayer.pause();

  window.gameState.attempts = 3;
  window.gameState.hasPlayed = false;

  const currentQuestion = currentPlayer.questions[currentPlayer.questionsAnswered];

  document.getElementById("player-name-display").textContent = currentPlayer.name;

  // Lógica de visualización de título
  const categoryDisplayEl = document.getElementById("category-display");
  if (window.gameState.selectedDecade === "verano") {
    categoryDisplayEl.innerText = "Especiales - Canciones del Verano";
  } else if (window.gameState.selectedDecade === "elderly") {
    categoryDisplayEl.innerText = "Modo Fácil - Todas las Canciones";
  } else {
    categoryDisplayEl.innerText = `${getDecadeLabel(window.gameState.selectedDecade)} - ${getCategoryLabel(window.gameState.category)}`;
  }

  document.getElementById("question-counter").innerText =
    `Pregunta ${currentPlayer.questionsAnswered + 1}/${window.gameState.totalQuestionsPerPlayer}`;
  document.getElementById("player-turn").innerText = `Turno de ${currentPlayer.name}`;
  document.getElementById("points-display").innerText = `Puntos: ${currentPlayer.score}`;

  updateAttemptsCounter();

  const answerButtonsContainer = document.getElementById("answer-buttons");
  answerButtonsContainer.innerHTML = "";

  // Seleccionar el Pool correcto
  const allSongsToChooseFromForOptions =
    window.gameState.selectedDecade === "Todas"
      ? window.configuracionCanciones?.["Todas"]?.[window.gameState.category]
      : window.configuracionCanciones?.[window.gameState.selectedDecade]?.[window.gameState.category];

  if (!Array.isArray(allSongsToChooseFromForOptions) || allSongsToChooseFromForOptions.length < 4) {
    console.error(`Error: Pool no válido para ${window.gameState.selectedDecade} - ${window.gameState.category}`);
    showAppAlert(
      `No hay suficientes canciones en '${getCategoryLabel(window.gameState.category)}' para ${getDecadeLabel(window.gameState.selectedDecade)}.`,
    );
    showScreen("category-screen");
    return;
  }

  let options = [currentQuestion];
  let safetyCounter = 0; // Protección contra bucles infinitos

  while (options.length < 4 && safetyCounter < 200) {
    safetyCounter++;
    const randomSong =
      allSongsToChooseFromForOptions[Math.floor(Math.random() * allSongsToChooseFromForOptions.length)];

    // 1. Evitar duplicados
    const isDuplicate = options.some((opt) => opt.file === randomSong.file);

    // 2. Evitar que sea la respuesta correcta
    const isCorrectAnswer = randomSong.file === currentQuestion.file;

    // 3. FILTRO ESTRICTO DE CATEGORÍA
    let isCategoryMismatch = false;
    if (
      window.gameState.category !== "consolidated" &&
      randomSong.originalCategory &&
      randomSong.originalCategory !== window.gameState.category
    ) {
      isCategoryMismatch = true;
    }

    if (!isDuplicate && !isCorrectAnswer && !isCategoryMismatch) {
      options.push(randomSong);
    }
  }

  // Fallback de seguridad
  if (options.length < 4) {
    console.warn("Advertencia: No se encontraron suficientes distractores estrictos. Rellenando con pool disponible.");
    let fallbackSafety = 0;
    while (options.length < 4 && fallbackSafety < 100) {
      fallbackSafety++;
      const randomSong =
        allSongsToChooseFromForOptions[Math.floor(Math.random() * allSongsToChooseFromForOptions.length)];
      if (!options.some((opt) => opt.file === randomSong.file) && randomSong.file !== currentQuestion.file) {
        options.push(randomSong);
      }
    }
  }

  options.sort(() => 0.5 - Math.random());

  options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "btn answer-btn";
    const parsedDisplay = parseDisplay(option.display);
    button.innerHTML = `<strong>${parsedDisplay.artist}</strong>${parsedDisplay.title}`;
    button.onclick = () => checkAnswer(option.file === currentQuestion.file, button);
    answerButtonsContainer.appendChild(button);
  });

  const playBtn = document.getElementById("play-song-btn");
  playBtn.onclick = playAudioSnippet;
  playBtn.disabled = false;
  playBtn.innerText = "▶";
}

/**
 * Actualiza el contador de intentos y su color.
 */
export function updateAttemptsCounter() {
  const counter = document.getElementById("attempts-counter");
  if (!counter) return;

  counter.innerText = `Intentos: ${window.gameState.attempts}`;
  if (window.gameState.attempts === 3) counter.style.backgroundColor = "var(--correct-color)";
  else if (window.gameState.attempts === 2) counter.style.backgroundColor = "var(--warning-color)";
  else counter.style.backgroundColor = "var(--incorrect-color)";
}

/**
 * Verifica la respuesta del jugador.
 * @param {boolean} isCorrect - True si la respuesta es correcta, false si es incorrecta.
 * @param {HTMLElement} button - El botón de respuesta que se pulsó.
 */
export function checkAnswer(isCorrect, button) {
  if (!window.gameState.hasPlayed) {
    showAppAlert("¡Primero tienes que pulsar el botón ▶ para escuchar la canción!");
    return;
  }

  // LIMPIEZA DE AUDIO Y LISTENERS
  clearTimeout(window.audioPlaybackTimeout);

  if (window.activeTimeUpdateListener) {
    window.audioPlayer.removeEventListener("timeupdate", window.activeTimeUpdateListener);
    window.activeTimeUpdateListener = null;
  }

  window.audioPlayer.pause();
  window.audioPlayer.currentTime = 0;

  // Bloqueamos TODOS momentáneamente al pulsar
  document.querySelectorAll(".answer-btn").forEach((btn) => btn.classList.add("disabled"));

  if (isCorrect) {
    window.sfxAcierto.currentTime = 0;
    window.sfxAcierto.play();
    const points = { 3: 3, 2: 2, 1: 1 };
    window.gameState.players[window.gameState.currentPlayerIndex].score += points[window.gameState.attempts];
    button.classList.add("correct");
    window.gameState.players[window.gameState.currentPlayerIndex].questionsAnswered++;

    setTimeout(nextPlayerOrEndGame, 1500);
  } else {
    window.sfxError.currentTime = 0;
    window.sfxError.play();

    button.classList.add("incorrect");

    window.gameState.attempts--;
    updateAttemptsCounter();

    if (window.gameState.attempts > 0) {
      setTimeout(() => {
        document.querySelectorAll(".answer-btn").forEach((btn) => {
          if (!btn.classList.contains("incorrect")) {
            btn.classList.remove("disabled");
          }
        });

        window.gameState.hasPlayed = false;
        const playBtn = document.getElementById("play-song-btn");
        playBtn.disabled = false;
        playBtn.innerText = "▶";
        playBtn.classList.remove("is-playing");
      }, 1500);
    } else {
      window.gameState.players[window.gameState.currentPlayerIndex].questionsAnswered++;
      setTimeout(nextPlayerOrEndGame, 1500);
    }
  }
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
      setupQuestion();
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
    setupQuestion();
  }
}

/**
 * Continúa el turno del siguiente jugador después de una pantalla de transición.
 */
export function continueToNextPlayerTurn() {
  setupQuestion();
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
