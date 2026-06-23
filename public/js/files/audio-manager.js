import { showAppAlert } from "./modal-functions.js";

// Variables globales accedidas desde window (definidas en constants.js)
// audioPlayer, gameState, activeTimeUpdateListener

/**
 * Reproduce un fragmento de audio de la canción actual.
 * La duración depende del número de intentos restantes.
 */
export function playAudioSnippet() {
  if (globalThis.gameState.hasPlayed) return;

  const durations = { 3: 4.0, 2: 6.0, 1: 10.0 };
  const durationSecs = durations[globalThis.gameState.attempts];
  const currentPlayer = globalThis.gameState.players[globalThis.gameState.currentPlayerIndex];
  const currentQuestion = currentPlayer.questions[currentPlayer.questionsAnswered];

  let fileName = typeof currentQuestion.file === "string" ? currentQuestion.file.trim() : "";
  if (!fileName) return;

  // Detectamos si la ruta viene con Mayúscula (Actual) y la forzamos a minúscula (actual)
  // para coincidir con el nombre físico de la carpeta en el servidor Linux.
  if (fileName.startsWith("Actual/")) {
    fileName = fileName.replace("Actual/", "actual/");
  }

  const playBtn = document.getElementById("play-song-btn");
  playBtn.innerText = "🎵";
  playBtn.disabled = true;
  playBtn.classList.add("is-playing");
  globalThis.gameState.hasPlayed = true;

  let audioSrc = fileName.startsWith("/") ? fileName : `/audio/${fileName}`;

  // Usamos tu lógica original de comprobación para no alterar el comportamiento
  if (!globalThis.audioPlayer.src.endsWith(audioSrc)) {
    globalThis.audioPlayer.src = audioSrc;
  }

  if (globalThis.activeTimeUpdateListener)
    globalThis.audioPlayer.removeEventListener("timeupdate", globalThis.activeTimeUpdateListener);
  globalThis.audioPlayer.currentTime = 0;

  const stopAudioListener = () => {
    if (globalThis.audioPlayer.currentTime >= durationSecs) {
      globalThis.audioPlayer.pause();
      globalThis.audioPlayer.currentTime = 0;
      playBtn.innerText = "▶";
      playBtn.classList.remove("is-playing");
      globalThis.audioPlayer.removeEventListener("timeupdate", stopAudioListener);
      globalThis.activeTimeUpdateListener = null;
    }
  };

  globalThis.activeTimeUpdateListener = stopAudioListener;
  globalThis.audioPlayer.addEventListener("timeupdate", stopAudioListener);

  globalThis.audioPlayer.play().catch((e) => {
    console.error("Fallo 404 en ruta física:", audioSrc);
    playBtn.disabled = false;
    playBtn.innerText = "▶";
    playBtn.classList.remove("is-playing");
    globalThis.gameState.hasPlayed = false;
    showAppAlert("Error 404: El archivo no se encuentra en el servidor.");
  });
}
