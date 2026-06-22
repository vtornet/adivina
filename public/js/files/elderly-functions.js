import { showAppAlert } from "./modal-functions.js";
import { showScreen } from "./screen-functions.js";

// main.js - Funciones para el modo "elderly"
let elderlyPlayerCount = 1; // Por defecto 1 jugador para el input inicial

/**
 * Añade inputs para jugadores adicionales en el modo fácil (elderly).
 * @param {number} numPlayers - El número total de jugadores.
 */
export function addElderlyPlayerInput(numPlayers) {
  elderlyPlayerCount = numPlayers;
  const otherPlayerNamesInputsDiv = document.getElementById("elderly-other-player-names-inputs");
  otherPlayerNamesInputsDiv.innerHTML = ""; // Limpiar inputs anteriores

  // Asegurarse de que el input del Jugador 1 sea editable si lo fuera
  document.getElementById("elderly-player-1-name").readOnly = false;

  for (let i = 1; i < numPlayers; i++) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "text-input";
    input.placeholder = `Nombre del Jugador ${i + 1}`;
    input.id = `elderly-player-${i + 1}-name-input`;
    otherPlayerNamesInputsDiv.appendChild(input);
  }
}

/**
 * Inicia una partida en modo fácil (elderly).
 */
export async function startElderlyModeGame() {
  const player1Name = document.getElementById("elderly-player-1-name").value.trim();
  if (!player1Name) {
    showAppAlert("Por favor, introduce al menos el nombre del Jugador 1.");
    return;
  }
  gameState.isOnline = false; // Este modo no es online
  isElderlyMode = true; // <-- ESTABLECE ESTO A TRUE
  gameState.players = [];
  // El jugador 1 siempre es el primer input
  gameState.players.push({
    id: 1,
    name: player1Name,
    score: 0,
    questionsAnswered: 0,
    questions: [],
    email: null, // No hay email en este modo
  });

  // Recoger nombres de jugadores adicionales
  for (let i = 1; i < elderlyPlayerCount; i++) {
    const input = document.getElementById(`elderly-player-${i + 1}-name-input`);
    const name = input.value.trim() || `Jugador ${i + 1}`; // Nombre por defecto si está vacío
    gameState.players.push({
      id: i + 1,
      name: name,
      score: 0,
      questionsAnswered: 0,
      questions: [],
    });
  }

  gameState.totalQuestionsPerPlayer = 10; // O la cantidad que desees para este modo

  // *** CAMBIO CRUCIAL AQUÍ: Usar 'elderly' como década y 'consolidated' como categoría ***
  gameState.selectedDecade = "elderly"; // <--- AHORA SÍ USA LA DÉCADA 'elderly'
  gameState.category = "consolidated"; // <--- Y SU CATEGORÍA 'consolidated'

  try {
    // Cargar las canciones específicas para el modo fácil
    // Ahora, loadSongsForDecadeAndCategory cargará desde data/songs/elderly/consolidated.js
    await loadSongsForDecadeAndCategory(gameState.selectedDecade, gameState.category);
    const allSongsToChooseFrom = configuracionCanciones[gameState.selectedDecade][gameState.category];

    if (
      !allSongsToChooseFrom ||
      allSongsToChooseFrom.length < gameState.totalQuestionsPerPlayer * gameState.players.length
    ) {
      showAppAlert(
        `No hay suficientes canciones en el modo fácil para ${elderlyPlayerCount} jugador(es). Se necesitan ${gameState.totalQuestionsPerPlayer * gameState.players.length} y solo hay ${allSongsToChooseFrom ? allSongsToChooseFrom.length : 0}. Por favor, añade más canciones a la carpeta 'elderly/consolidated'.`,
      ); // Mensaje actualizado
      showScreen("elderly-mode-intro-screen");
      return;
    }

    // Asignar preguntas aleatorias a cada jugador (igual que en startGame)
    let shuffledSongs = [...allSongsToChooseFrom].sort(() => 0.5 - Math.random());

    for (let i = 0; i < gameState.players.length; i++) {
      gameState.players[i].questions = shuffledSongs.splice(0, gameState.totalQuestionsPerPlayer);
    }

    gameState.currentPlayerIndex = 0;
    setupQuestion();
    showScreen("game-screen");
  } catch (error) {
    console.error("Error al iniciar el modo fácil:", error);
    showAppAlert("Error al cargar las canciones para el modo fácil. Intenta de nuevo más tarde.");
    showScreen("elderly-mode-intro-screen"); // Volver a la pantalla de inicio del modo fácil
  }
}

export { elderlyPlayerCount };
