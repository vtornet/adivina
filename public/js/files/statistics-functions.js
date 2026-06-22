import { showAppAlert, showAppConfirm } from "./modal-functions.js";
import { showScreen } from "./screen-functions.js";
import { getDecadeLabel, getCategoryLabel } from "./app-info-functions.js";
import { DECADES_WITH_SPECIALS } from "../constants/app-constants.js";

/**
 * Calcula las victorias en duelos entre dos jugadores.
 * @param {string} player1Name - Nombre del primer jugador.
 * @param {string} player2Name - Nombre del segundo jugador.
 * @returns {Object} Objeto con las victorias de cada jugador.
 */
export function calculateDuelWins(player1Name, player2Name) {
  let wins1 = 0;
  let wins2 = 0;

  const p1 = player1Name.toLowerCase();
  const p2 = player2Name.toLowerCase();

  gameHistory.forEach((game) => {
    if (game.players.length === 2) {
      const gamePlayersLower = game.players.map((p) => p.name.toLowerCase()).sort();
      const sortedDuelPlayers = [p1, p2].sort();

      if (gamePlayersLower[0] === sortedDuelPlayers[0] && gamePlayersLower[1] === sortedDuelPlayers[1]) {
        if (game.winner && game.winner.toLowerCase() === p1) {
          wins1++;
        } else if (game.winner && game.winner.toLowerCase() === p2) {
          wins2++;
        }
      }
    }
  });
  return { [player1Name]: wins1, [player2Name]: wins2 };
}

/**
 * Muestra la pantalla de estadísticas del usuario actual.
 */
export function showStatisticsScreen() {
  if (!currentUser || !currentUser.email) {
    showAppAlert("Debes iniciar sesión para ver tus estadísticas.");
    showScreen("login-screen");
    return;
  }

  showScreen("statistics-screen");
  renderUserTotalScores();
  renderDuelHistory();
}

/**
 * Confirma y resetea las estadísticas del usuario.
 */
export async function confirmResetStatistics() {
  if (!currentUser || !currentUser.email) {
    showAppAlert("Debes iniciar sesión para borrar tus estadísticas.");
    showScreen("login-screen");
    return;
  }

  const confirmed = await showAppConfirm(
    "¿Seguro que quieres borrar tus estadísticas? Empezarán de cero desde este momento y no podrás recuperar las actuales.",
  );
  if (!confirmed) return;

  await resetUserStatistics();
}

/**
 * Borra las estadísticas del usuario del servidor.
 */
export async function resetUserStatistics() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/scores/${currentUser.email}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    const result = await response.json();

    if (response.ok) {
      userAccumulatedScores[currentUser.email] = {};
      renderUserTotalScores();
      showAppAlert(result.message || "Estadísticas borradas correctamente.");
    } else {
      showAppAlert(result.message || "No se pudieron borrar las estadísticas.");
    }
  } catch (error) {
    console.error("Error de red al borrar estadísticas:", error);
    showAppAlert("Error de conexión. Intenta de nuevo más tarde.");
  }
}

/**
 * Renderiza las puntuaciones totales del usuario por década y categoría.
 */
export function renderUserTotalScores() {
  const categoryScoresList = document.getElementById("category-scores-list");
  categoryScoresList.innerHTML = "";

  const userScores = userAccumulatedScores[currentUser.email];

  if (!userScores || Object.keys(userScores).length === 0) {
    categoryScoresList.innerHTML =
      '<p style="color: var(--text-color);">Aún no tienes puntos acumulados. ¡Juega para empezar a sumar!</p>';
    return;
  }

  const decadesInOrder = DECADES_WITH_SPECIALS;
  let hasScoresToDisplay = false;

  decadesInOrder.forEach((decadeId) => {
    const categoriesInDecade = userScores[decadeId];
    if (categoriesInDecade && Object.keys(categoriesInDecade).length > 0) {
      hasScoresToDisplay = true;
      const decadeHeader = document.createElement("h4");
      decadeHeader.style.color = "var(--secondary-color)";
      decadeHeader.style.marginTop = "15px";
      decadeHeader.style.marginBottom = "10px";
      decadeHeader.textContent = getDecadeLabel(decadeId);
      categoryScoresList.appendChild(decadeHeader);

      const sortedCategoriesInDecade = Object.entries(categoriesInDecade).sort(
        ([, scoreA], [, scoreB]) => scoreB - scoreA,
      );

      sortedCategoriesInDecade.forEach(([categoryId, score]) => {
        const categoryNameDisplay = getCategoryLabel(categoryId);
        const p = document.createElement("p");
        p.className = "score-item";
        p.innerHTML = `• ${categoryNameDisplay}: <strong>${score} puntos</strong>`;
        categoryScoresList.appendChild(p);
      });
    }
  });

  if (!hasScoresToDisplay) {
    categoryScoresList.innerHTML =
      '<p style="color: var(--text-color);">Aún no tienes puntos acumulados. ¡Juega para empezar a sumar!</p>';
  }
}

/**
 * Renderiza el historial de duelos del usuario.
 */
export function renderDuelHistory() {
  const duelList = document.getElementById("duel-list");
  duelList.innerHTML = "";

  const duels = gameHistory.filter((game) => game.players.length === 2);

  if (duels.length === 0) {
    duelList.innerHTML =
      '<p style="color: var(--text-color);">Aún no tienes duelos registrados. ¡Desafía a un amigo!</p>';
    return;
  }

  const duelPairs = {};
  duels.forEach((game) => {
    const playerNames = game.players.map((p) => p.name.toLowerCase()).sort();
    const pairKey = playerNames.join("_");

    if (!duelPairs[pairKey]) {
      // Usa .slice() para crear una copia de los jugadores antes de ordenar, para no modificar el original
      duelPairs[pairKey] = { players: game.players.slice().sort((a, b) => a.name.localeCompare(b.name)), games: [] };
    }
    duelPairs[pairKey].games.push(game);
  });

  for (const key in duelPairs) {
    const pair = duelPairs[key];
    // Asegúrate de que p1Obj y p2Obj sean objetos con la propiedad 'name'
    const [p1Obj, p2Obj] = pair.players;
    const p1Name = p1Obj.name;
    const p2Name = p2Obj.name;
    const duelWins = calculateDuelWins(p1Name, p2Name);

    const duelSummaryDiv = document.createElement("div");
    duelSummaryDiv.className = "duel-summary-card";
    duelSummaryDiv.style.background = "rgba(0, 0, 0, 0.2)";
    duelSummaryDiv.style.padding = "10px";
    duelSummaryDiv.style.borderRadius = "8px";
    duelSummaryDiv.style.marginBottom = "15px";
    duelSummaryDiv.style.border = "1px solid var(--primary-color)";

    duelSummaryDiv.innerHTML = `
            <p style="font-size: 1.1rem; font-weight: bold; color: var(--secondary-color); margin-bottom: 5px;">${p1Name} vs ${p2Name}</p>
            <p style="font-size: 0.95rem;">${p1Name}: <strong>${duelWins[p1Name]} victorias</strong> | ${p2Name}: <strong>${duelWins[p2Name]} victorias</strong></p>
            <details style="margin-top: 10px; text-align: left;">
                <summary style="font-size: 0.9rem; cursor: pointer; color: var(--warning-color);">Ver historial detallado</summary>
                <ul style="list-style-type: none; padding-left: 0;">
                </ul>
            </details>
        `;
    const detailsList = duelSummaryDiv.querySelector("ul");
    pair.games.sort((a, b) => {
      const [dayA, monthA, yearA] = a.date.split("/").map(Number);
      const [dayB, monthB, yearB] = b.date.split("/").map(Number);
      const dateA = new Date(yearA, monthA - 1, dayA);
      const dateB = new Date(yearB, monthB - 1, dayB);
      return dateB.getTime() - dateA.getTime();
    });

    pair.games.forEach((game) => {
      const listItem = document.createElement("li");
      listItem.style.fontSize = "0.85rem";
      listItem.style.marginBottom = "3px";
      listItem.style.color = "var(--text-color)";
      listItem.textContent = `Fecha: ${game.date}, Ganador: ${game.winner}, Década: ${getDecadeLabel(game.decade)}, Categoría: ${getCategoryLabel(game.category)}`;
      detailsList.appendChild(listItem);
    });

    duelList.appendChild(duelSummaryDiv);
  }
}
