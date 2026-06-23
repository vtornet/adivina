import { showAppAlert } from "./modal-functions.js";
import { showScreen } from "./screen-functions.js";
import { getDecadeLabel, getCategoryLabel } from "./app-info-functions.js";
import { parseDisplay } from "./helpers.js";
import { playAudioSnippet } from "./audio-manager.js";

// Variables globales accedidas desde window (definidas en constants.js)
// audioPlayer, sfxAcierto, sfxError, gameState, activeTimeUpdateListener, audioPlaybackTimeout
// configuracionCanciones

/**
 * Configura la siguiente pregunta del juego.
 */
export function setupQuestion(nextPlayerOrEndGameCallback) {
  const currentPlayer = globalThis.gameState.players[globalThis.gameState.currentPlayerIndex];

  if (currentPlayer.questionsAnswered >= globalThis.gameState.totalQuestionsPerPlayer) {
    if (nextPlayerOrEndGameCallback) {
      nextPlayerOrEndGameCallback();
    }
    return;
  }

  clearTimeout(globalThis.audioPlaybackTimeout);

  // Limpieza preventiva de listeners de audio
  if (globalThis.activeTimeUpdateListener) {
    globalThis.audioPlayer.removeEventListener("timeupdate", globalThis.activeTimeUpdateListener);
    globalThis.activeTimeUpdateListener = null;
  }

  globalThis.audioPlayer.pause();

  globalThis.gameState.attempts = 3;
  globalThis.gameState.hasPlayed = false;

  const currentQuestion = currentPlayer.questions[currentPlayer.questionsAnswered];

  document.getElementById("player-name-display").textContent = currentPlayer.name;

  // Lógica de visualización de título
  const categoryDisplayEl = document.getElementById("category-display");
  if (globalThis.gameState.selectedDecade === "verano") {
    categoryDisplayEl.innerText = "Especiales - Canciones del Verano";
  } else if (globalThis.gameState.selectedDecade === "elderly") {
    categoryDisplayEl.innerText = "Modo Fácil - Todas las Canciones";
  } else {
    categoryDisplayEl.innerText = `${getDecadeLabel(globalThis.gameState.selectedDecade)} - ${getCategoryLabel(globalThis.gameState.category)}`;
  }

  document.getElementById("question-counter").innerText =
    `Pregunta ${currentPlayer.questionsAnswered + 1}/${globalThis.gameState.totalQuestionsPerPlayer}`;
  document.getElementById("player-turn").innerText = `Turno de ${currentPlayer.name}`;
  document.getElementById("points-display").innerText = `Puntos: ${currentPlayer.score}`;

  updateAttemptsCounter();

  const answerButtonsContainer = document.getElementById("answer-buttons");
  answerButtonsContainer.innerHTML = "";

  // Seleccionar el Pool correcto
  const allSongsToChooseFromForOptions =
    globalThis.gameState.selectedDecade === "Todas"
      ? globalThis.configuracionCanciones?.["Todas"]?.[globalThis.gameState.category]
      : globalThis.configuracionCanciones?.[globalThis.gameState.selectedDecade]?.[globalThis.gameState.category];

  if (!Array.isArray(allSongsToChooseFromForOptions) || allSongsToChooseFromForOptions.length < 4) {
    console.error(
      `Error: Pool no válido para ${globalThis.gameState.selectedDecade} - ${globalThis.gameState.category}`,
    );
    showAppAlert(
      `No hay suficientes canciones en '${getCategoryLabel(globalThis.gameState.category)}' para ${getDecadeLabel(globalThis.gameState.selectedDecade)}.`,
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
      globalThis.gameState.category !== "consolidated" &&
      randomSong.originalCategory &&
      randomSong.originalCategory !== globalThis.gameState.category
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
    button.onclick = () =>
      checkAnswer(option.file === currentQuestion.file, button, nextPlayerOrEndGameCallback, setupQuestionCallback);
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

  counter.innerText = `Intentos: ${globalThis.gameState.attempts}`;
  if (globalThis.gameState.attempts === 3) counter.style.backgroundColor = "var(--correct-color)";
  else if (globalThis.gameState.attempts === 2) counter.style.backgroundColor = "var(--warning-color)";
  else counter.style.backgroundColor = "var(--incorrect-color)";
}

/**
 * Verifica la respuesta del jugador.
 * @param {boolean} isCorrect - True si la respuesta es correcta, false si es incorrecta.
 * @param {HTMLElement} button - El botón de respuesta que se pulsó.
 */
export function checkAnswer(isCorrect, button, nextPlayerOrEndGameCallback, setupQuestionCallback) {
  if (!globalThis.gameState.hasPlayed) {
    showAppAlert("¡Primero tienes que pulsar el botón ▶ para escuchar la canción!");
    return;
  }

  // LIMPIEZA DE AUDIO Y LISTENERS
  clearTimeout(globalThis.audioPlaybackTimeout);

  if (globalThis.activeTimeUpdateListener) {
    globalThis.audioPlayer.removeEventListener("timeupdate", globalThis.activeTimeUpdateListener);
    globalThis.activeTimeUpdateListener = null;
  }

  globalThis.audioPlayer.pause();
  globalThis.audioPlayer.currentTime = 0;

  // Bloqueamos TODOS momentáneamente al pulsar
  document.querySelectorAll(".answer-btn").forEach((btn) => btn.classList.add("disabled"));

  if (isCorrect) {
    globalThis.sfxAcierto.currentTime = 0;
    globalThis.sfxAcierto.play();
    const points = { 3: 3, 2: 2, 1: 1 };
    globalThis.gameState.players[globalThis.gameState.currentPlayerIndex].score +=
      points[globalThis.gameState.attempts];
    button.classList.add("correct");
    globalThis.gameState.players[globalThis.gameState.currentPlayerIndex].questionsAnswered++;

    setTimeout(() => {
      if (nextPlayerOrEndGameCallback) nextPlayerOrEndGameCallback();
    }, 1500);
  } else {
    globalThis.sfxError.currentTime = 0;
    globalThis.sfxError.play();

    button.classList.add("incorrect");

    globalThis.gameState.attempts--;
    updateAttemptsCounter();

    if (globalThis.gameState.attempts > 0) {
      setTimeout(() => {
        document.querySelectorAll(".answer-btn").forEach((btn) => {
          if (!btn.classList.contains("incorrect")) {
            btn.classList.remove("disabled");
          }
        });

        globalThis.gameState.hasPlayed = false;
        const playBtn = document.getElementById("play-song-btn");
        playBtn.disabled = false;
        playBtn.innerText = "▶";
        playBtn.classList.remove("is-playing");
      }, 1500);
    } else {
      globalThis.gameState.players[globalThis.gameState.currentPlayerIndex].questionsAnswered++;
      setTimeout(() => {
        if (nextPlayerOrEndGameCallback) nextPlayerOrEndGameCallback();
      }, 1500);
    }
  }
}
