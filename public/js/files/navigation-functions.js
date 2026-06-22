import { showAppConfirm, showAppAlert } from "./modal-functions.js";
import { showScreen } from "./screen-functions.js";
import { closeHamburgerMenu } from "./burger-functions.js";
import { logout } from "./login.js";
import { generateDecadeButtons, generateCategoryButtons } from "./ui-functions.js";
import { hasPremiumAccess, isPremiumDecade, showPremiumModal, isPremiumCategory, hasCategoryAccess } from "./premium-functions.js";
import { getDecadeLabel, getCategoryLabel } from "./app-info-functions.js";
import { loadAllDecadesForCategory } from "./songs-list-functions.js";

/**
 * Maneja la selección de una década por el usuario.
 * @param {string} decade - La década seleccionada.
 */
export async function selectDecade(decade) {
  // 1. Verificación de Usuario
  if (!window.currentUser || !window.currentUser.playerName) {
    showAppAlert("Debes iniciar sesión y establecer tu nombre de jugador para continuar.");
    showScreen("login-screen");
    return;
  }

  // 2. NUEVA LÓGICA: Sección Especiales
  if (decade === "especiales") {
    window.gameState.selectedDecade = "especiales";
    generateCategoryButtons(); // Genera el menú especial con texto de feedback
    showScreen("category-screen");
    return;
  }

  // 3. Verificación Premium (para décadas normales bloqueadas)
  if (isPremiumDecade(decade) && !hasPremiumAccess()) {
    showPremiumModal("Contenido premium. Próximamente disponible mediante desbloqueo.");
    return;
  }

  window.gameState.selectedDecade = decade;

  // 4. Lógica para "Todas las Décadas"
  if (decade === "Todas") {
    window.gameState.selectedDecade = "Todas";
    generateCategoryButtons();
    showScreen("category-screen");
    return;
  }

  // 5. Lógica para Décadas Normales
  // Antes de mostrar la pantalla de categorías, cargamos todas las categorías de la década.
  const categoriesToLoadPromises = window.allPossibleCategories.map((cat) =>
    window.loadSongsForDecadeAndCategory(decade, cat).catch((error) => {
      console.warn(
        `No se pudo cargar la categoría ${cat} para la década ${decade}. Puede que no haya canciones o un error de archivo.`,
        error,
      );
      return null;
    }),
  );

  await Promise.allSettled(categoriesToLoadPromises);

  generateCategoryButtons();
  showScreen("category-screen");
}

/**
 * Sale del juego después de una confirmación.
 */
export async function exitGame() {
  closeHamburgerMenu();
  const confirmed = await showAppConfirm("¿Seguro que quieres salir del juego? Se cerrará la sesión actual.");
  if (confirmed) {
    logout();
  }
}

/**
 * Confirma si el usuario desea regresar al menú principal, perdiendo el progreso de la partida actual.
 */
export async function confirmReturnToMenu() {
  closeHamburgerMenu();
  const confirmed = await showAppConfirm(
    "¿Estás seguro de que quieres volver al menú principal? Perderás el progreso de esta partida.",
  );
  if (confirmed) {
    if (window.isOnlineMode) {
      window.isOnlineMode = false;
      window.currentOnlineGameCode = null;
      window.currentOnlineSongs = [];
      window.currentOnlineEmail = null;
      window.currentOnlinePlayerName = null;
      localStorage.removeItem("currentOnlineGameData");
      showScreen("online-mode-screen"); // Volver al menú online
    } else if (window.isElderlyMode) {
      window.isElderlyMode = false; // Resetear el estado
      window.gameState = {}; // Limpiar gameState
      document.getElementById("elderly-player-1-name").value = ""; // Limpiar input principal
      document.getElementById("elderly-other-player-names-inputs").innerHTML = ""; // Limpiar inputs extra
      showScreen("elderly-mode-intro-screen"); // Volver a la pantalla de inicio del modo fácil
    } else if (window.isSummerSongsMode) {
      // <-- NUEVA CONDICIÓN PARA MODO VERANO
      window.isSummerSongsMode = false; // Resetear el estado
      window.gameState = {}; // Limpiar gameState
      showScreen("decade-selection-screen"); // Volver a la selección de década
    } else {
      // Modo offline normal
      if (window.gameState.selectedDecade === "Todas") {
        showScreen("decade-selection-screen");
      } else {
        showScreen("category-screen");
      }
    }
  }
}

/**
 * Finaliza el modo online y vuelve al menú principal.
 */
export function endOnlineModeAndGoHome() {
  closeHamburgerMenu();
  // Siempre resetear el estado de la partida online al ir al menú principal
  window.isOnlineMode = false;
  window.currentOnlineGameCode = null;
  window.currentOnlineSongs = [];
  window.currentOnlineEmail = null;
  window.currentOnlinePlayerName = null;
  localStorage.removeItem("currentOnlineGameData");

  // Resetear también el estado del juego general para evitar confusiones
  window.gameState = {};

  // Y siempre redirigir a la pantalla de selección de década
  showScreen("decade-selection-screen");
  generateDecadeButtons(); // Asegurarse de que los botones de década se generen correctamente
}

/**
 * Va al menú de juego online.
 */
export function goToOnlineMenu() {
  window.isOnlineMode = false;
  window.currentOnlineGameCode = null;
  window.currentOnlineSongs = [];
  window.currentOnlineEmail = null;
  window.currentOnlinePlayerName = null;
  localStorage.removeItem("currentOnlineGameData");
  showScreen("online-mode-screen");
}

/**
 * Establece la visibilidad del botón de menú online en la pantalla de fin de juego.
 * @param {boolean} isVisible - Si el botón debe ser visible.
 */
export function setOnlineMenuButtonVisibility(isVisible) {
  const onlineMenuButton = document.getElementById("online-menu-btn");
  if (!onlineMenuButton) return;
  onlineMenuButton.style.display = isVisible ? "inline-flex" : "none";
}

/**
 * Configura los botones de navegación en la pantalla de fin de juego.
 */
export function setEndGameNavigationButtons() {
  const backToCategories = document.getElementById("back-to-categories-btn");
  const backToDecades = document.getElementById("back-to-decades-btn");
  if (!backToCategories || !backToDecades) return;

  if (window.isOnlineMode) {
    backToCategories.style.display = "none";
    backToDecades.style.display = "none";
    return;
  }

  const selectedDecade = window.gameState?.selectedDecade;
  const showCategories = selectedDecade && selectedDecade !== "Todas";
  backToCategories.style.display = showCategories ? "inline-flex" : "none";
  backToDecades.style.display = "inline-flex";

  backToCategories.onclick = () => {
    closeHamburgerMenu();
    showScreen("category-screen");
  };

  backToDecades.onclick = () => {
    closeHamburgerMenu();
    showScreen("decade-selection-screen");
    generateDecadeButtons();
  };
}

/**
 * Maneja la selección de una categoría por el usuario.
 * @param {string} category - La categoría seleccionada.
 */
export async function selectCategory(category) {
  // 1. Verificación de usuario
  if (!window.currentUser || !window.currentUser.playerName) {
    showAppAlert("Debes iniciar sesión y establecer tu nombre de jugador para continuar.");
    showScreen("login-screen");
    return;
  }

  // 2. Verificación Premium
  if (isPremiumCategory(category) && !hasCategoryAccess(category)) {
    showPremiumModal(`Contenido premium. Desbloquéalo para jugar a ${getCategoryLabel(category)}.`, category);
    return;
  }

  window.gameState.category = category;

  try {
    // 3. Carga de canciones según el modo
    if (window.gameState.selectedDecade === "Todas") {
      await loadAllDecadesForCategory(window.gameState.category);
    } else {
      await window.loadSongsForDecadeAndCategory(window.gameState.selectedDecade, window.gameState.category);
    }

    // 4. Verificación de cantidad de canciones
    const pool =
      window.gameState.selectedDecade === "Todas"
        ? window.configuracionCanciones?.["Todas"]?.[window.gameState.category]
        : window.configuracionCanciones?.[window.gameState.selectedDecade]?.[window.gameState.category];

    if (!Array.isArray(pool) || pool.length < 4) {
      showAppAlert(
        `No hay suficientes canciones en '${getCategoryLabel(category)}' para ${getDecadeLabel(window.gameState.selectedDecade)}. ` +
          `Necesitas al menos 4 canciones.`,
      );
      showScreen("category-screen");
      return;
    }

    // 5. Éxito: Ir a selección de jugadores
    showScreen("player-selection-screen");
  } catch (error) {
    showAppAlert(`No se pudieron cargar las canciones para '${getCategoryLabel(category)}'. Intenta con otra.`);
    console.error(error);
    showScreen("category-screen");
  }
}

/**
 * Muestra la pantalla de estadísticas.
 */
export function showStats() {
  closeHamburgerMenu();
  window.showStatisticsScreen?.();
}

/**
 * Muestra la pantalla de listado de canciones.
 */
export function showAllSongs() {
  closeHamburgerMenu();
  window.showSongsListCategorySelection?.();
}
