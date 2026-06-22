// ============================================================================
// MANEJADOR DE ERRORES GLOBAL - Detecta errores de importación, ejecución, etc.
// ============================================================================
window.addEventListener("error", (event) => {
  console.error("❌ ERROR GLOBAL:", event.message, event.filename, event.lineno);
  console.error("Error object:", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("❌ PROMESA RECHAZADA:", event.reason);
});

import {
  getDecadeLabel,
  getCategoryLabel,
  getDecadesForSelect,
  getCategoriesForSelect,
} from "./files/app-info-functions.js";

import {
  hasCategoryAccess,
  hasPremiumAccess,
  isPremiumCategory,
  isPremiumDecade,
  isPremiumSelection,
  showPremiumModal,
} from "./files/premium-functions.js";

import {
  getCurrentUserData,
  getUserPermissions,
  getActivePermissions,
  getLocalUsers,
  saveLocalUsers,
  getLocalScores,
  saveLocalScores,
  getLocalGameHistory,
  saveLocalGameHistory,
  closePremiumModal,
  loadUserScores,
  saveUserScores,
} from "./files/user-functions.js";

import {
  loginUser,
  requestPasswordReset,
  confirmPasswordReset,
  changePassword,
  registerUser,
  logout,
} from "./files/login.js";

import { addNotification, toggleNotificationsPanel } from "./files/notification-functions.js";

import { populateDecadeOptions, populateCategoryOptions } from "./files/populate-functions.js";

import { parseJsonResponse } from "./files/helpers.js";
import {
  showAppAlert,
  showAppConfirm,
  showAppModal,
  showInstructions,
  showChangePasswordModal,
  closeChangePasswordModal,
  openPasswordResetModal,
  closePasswordResetModal,
  closeInstructions,
} from "./files/modal-functions.js";
import { closeHamburgerMenu, toggleHamburgerMenu } from "./files/burger-functions.js";
import { showScreen } from "./files/screen-functions.js";
import { APP_VERSION } from "./constants/app-constants.js";
import {
  startOnlineInvitePolling,
  loadPlayerOnlineGames,
  createOnlineGame,
  joinOnlineGame,
  joinOnlineGameFromPending,
  startOnlineGame,
  submitOnlineScore,
  pollOnlineGameStatus,
  invitePlayerByName,
  showOnlineResults,
  shareOnlineCode,
  copyOnlineGameCode,
  viewOnlineGameResults,
  goToOnlineWaitScreen,
  continueOnlineGame,
  declineOnlineGame,
  deletePendingOnlineGame,
  updateOnlineInviteBadge,
  showInviteToast,
  sendInviteNotification,
  sendGameFinishedNotification,
  getSongsForOnlineMatch,
  saveOnlineGameToHistory,
  getWinnerName,
  formatOnlineGameDate,
  isOnlineGameFinished,
} from "./files/online-functions.js";
import { generateCategoryButtons, updatePremiumButtonsState, generateDecadeButtons } from "./files/ui-functions.js";
import { loadGameHistory } from "./files/game-functions.js";
import { togglePasswordVisibility, showPasswordRecoveryInfo } from "./files/auth-helpers.js";
import { updateRecentSongsHistory, getRecentSongs } from "./files/songs-history.js";
import { addElderlyPlayerInput, startElderlyModeGame, elderlyPlayerCount } from "./files/elderly-functions.js";
import { generateShareText, shareGameResultHandler } from "./files/share-functions.js";
import { checkCookieConsent, acceptCookieConsent } from "./files/cookies-functions.js";
import {
  showStatisticsScreen,
  confirmResetStatistics,
  renderUserTotalScores,
  renderDuelHistory,
  calculateDuelWins,
} from "./files/statistics-functions.js";
import { showSongsListCategorySelection, displaySongsForCategory, parseDisplay } from "./files/songs-list-functions.js";
import {
  exitGame,
  confirmReturnToMenu,
  endOnlineModeAndGoHome,
  goToOnlineMenu,
  setOnlineMenuButtonVisibility,
  setEndGameNavigationButtons,
  selectDecade,
  selectCategory,
  showStats,
  showAllSongs,
} from "./files/navigation-functions.js";
import {
  playAudioSnippet,
  selectPlayers,
  startGame,
  setupQuestion,
  updateAttemptsCounter,
  checkAnswer,
  nextPlayerOrEndGame,
  continueToNextPlayerTurn,
  endGame,
  startSummerSongsGame,
} from "./files/gameplay-functions.js";
import { startApp, initializeApp, setupPaymentListeners, refreshUI } from "./files/app-init-functions.js";
// Variables globales ahora accesibles via window (definidas en constants.js)
// gameState, audioPlayer, sfxAcierto, sfxError están en window

// Referencias a elementos DOM (necesarias en main.js)
const audioPlayer = window.audioPlayer || document.getElementById("audio-player");
const sfxAcierto = window.sfxAcierto || document.getElementById("sfx-acierto");
const sfxError = window.sfxError || document.getElementById("sfx-error");

// const API_BASE_URL =
//   window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
//     ? window.location.origin
//     : CANONICAL_PROD_ORIGIN;

// window.currentUser = null;
// window.useLocalApiFallback = false;

(() => {
  const savedUserJSON = localStorage.getItem("userData");
  if (savedUserJSON) {
    try {
      window.currentUser = JSON.parse(savedUserJSON);
      console.log("✅ Sesión persistente restaurada:", currentUser.email);
    } catch (e) {
      console.error("❌ Sesión corrupta. Limpiando localStorage.", e);
      localStorage.removeItem("userData");
      window.currentUser = null;
    }
  }
})();
// Variables ahora importadas desde constants.js
// userAccumulatedScores, gameHistory, pendingPurchaseCategory, appModalResolver

// function updatePremiumButtonsState() {
//   const summerButton = document.getElementById("summer-songs-btn");
//   if (!summerButton) return;

//   if (hasPremiumAccess()) {
//     summerButton.classList.remove("locked");
//   } else {
//     summerButton.classList.add("locked");
//   }
// }

// main.js - Función showScreen

window.showScreen = showScreen;

// Funciones de password importadas desde auth-helpers.js
window.togglePasswordVisibility = togglePasswordVisibility;
window.showPasswordRecoveryInfo = showPasswordRecoveryInfo;

window.toggleHamburgerMenu = toggleHamburgerMenu;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((error) => {
      console.warn("No se pudo registrar el Service Worker:", error);
    });
  });
}

// =====================================================================
// FUNCIONES DE AUTENTICACIÓN (Registro y Login)
// =====================================================================

window.loginUser = loginUser;

// --- NUEVAS FUNCIONES PARA VERIFICACIÓN DE EMAIL ---

// ==========================================
// WRAPPER DE SEGURIDAD (NO ROMPER HTML)
// ==========================================
async function confirmClearOnlineGameHistory() {
  const confirmed = await showAppConfirm(
    "¿Seguro que quieres borrar TODO el historial de partidas online? Esta acción no se puede deshacer.",
  );

  if (!confirmed) return;

  await clearOnlineGameHistory();
}

window.confirmClearOnlineGameHistory = confirmClearOnlineGameHistory;

async function clearOnlineGameHistory() {
  const playerData = getCurrentUserData();
  if (!playerData || !playerData.email) {
    showAppAlert("Debes iniciar sesión para borrar tu historial.");
    showScreen("login-screen");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/online-games/clear-history/${playerData.email}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    const result = await response.json();

    if (response.ok) {
      showAppAlert(result.message);
      loadPlayerOnlineGames(); // Recargar la lista de partidas para mostrar el cambio
    } else {
      showAppAlert(`Error al borrar historial: ${result.message}`);
    }
  } catch (error) {
    console.error("Error de red al borrar historial de partidas online:", error);
    showAppAlert("Error de conexión. Intenta de nuevo más tarde.");
  }
}

// ============================================================================
// VALIDACIÓN DE DEPENDENCIAS GLOBALES
// ============================================================================
function validateGlobals() {
  const requiredGlobals = [
    "gameState", "currentUser", "isOnlineMode", "isElderlyMode", "isSummerSongsMode",
    "audioPlayer", "sfxAcierto", "sfxError", "activeTimeUpdateListener", "audioPlaybackTimeout",
    "configuracionCanciones", "loadSongsForDecadeAndCategory", "allPossibleCategories",
    "API_BASE_URL"
  ];
  const missing = [];
  for (const name of requiredGlobals) {
    if (window[name] === undefined) {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    console.error("❌ FALTAN VARIABLES GLOBALES:", missing);
  } else {
    console.log("✅ Todas las variables globales están definidas");
  }
}
// Ejecutar validación después de cargar
setTimeout(validateGlobals, 1000);

// Funciones de navegación importadas desde navigation-functions.js
window.endOnlineModeAndGoHome = endOnlineModeAndGoHome;
window.goToOnlineMenu = goToOnlineMenu;
window.selectDecade = selectDecade;
window.selectCategory = selectCategory;

// Funciones de gameplay importadas desde gameplay-functions.js
window.playAudioSnippet = playAudioSnippet;
window.selectPlayers = selectPlayers;
window.startGame = startGame;
window.setupQuestion = setupQuestion;
window.updateAttemptsCounter = updateAttemptsCounter;
window.checkAnswer = checkAnswer;
window.nextPlayerOrEndGame = nextPlayerOrEndGame;
window.continueToNextPlayerTurn = continueToNextPlayerTurn;
window.endGame = endGame;
window.startSummerSongsGame = startSummerSongsGame;

// Funciones de songs-history importadas desde songs-history.js
window.updateRecentSongsHistory = updateRecentSongsHistory;
window.getRecentSongs = getRecentSongs;

async function setPlayerName() {
  const playerNameInput = document.getElementById("player-name-input");
  const newPlayerName = playerNameInput.value.trim();

  if (!newPlayerName) {
    showAppAlert("Por favor, introduce un nombre de jugador.");
    return;
  }

  if (currentUser) {
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/users/${currentUser.email}/playername`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: newPlayerName }),
      });

      const data = await parseJsonResponse(response);

      if (response.ok) {
        currentUser.playerName = newPlayerName;
        localStorage.setItem("userData", JSON.stringify(currentUser));
        localStorage.setItem("sessionActive", "true");
        showAppAlert(data?.message || "Nombre de jugador actualizado.");
        playerNameInput.value = "";
        showScreen("decade-selection-screen");
        generateDecadeButtons();
        return;
      }

      if (response.status === 404 || response.status >= 500) {
        useLocalApiFallback = true;
      } else {
        showAppAlert(`Error al actualizar nombre: ${data?.message || "No se pudo actualizar el nombre."}`);
        return;
      }
    } catch (error) {
      console.warn("API no disponible, usando actualización local:", error);
      useLocalApiFallback = true;
    }

    if (useLocalApiFallback) {
      const users = getLocalUsers();
      if (users[currentUser.email]) {
        users[currentUser.email].playerName = newPlayerName;
        saveLocalUsers(users);
      }
      currentUser.playerName = newPlayerName;
      localStorage.setItem("userData", JSON.stringify(currentUser));
      localStorage.setItem("sessionActive", "true");
      showAppAlert("Nombre de jugador actualizado.");
      playerNameInput.value = "";
      showScreen("decade-selection-screen");
      generateDecadeButtons();
    }
  } else {
    showAppAlert("No hay un usuario logueado. Por favor, inicia sesión primero.");
    showScreen("login-screen");
  }
}

// calculateDuelWins ya está importada desde statistics-functions.js

// parseDisplay importada desde songs-list-functions.js
window.parseDisplay = parseDisplay;

// selectDecade importada desde navigation-functions.js
window.selectDecade = selectDecade;

// loadAllDecadesForCategory importada desde songs-list-functions.js

// selectPlayers importada desde gameplay-functions.js

// Funciones de elderly-mode importadas desde elderly-functions.js
window.addElderlyPlayerInput = addElderlyPlayerInput;
window.startElderlyModeGame = startElderlyModeGame;
// elderlyPlayerCount ya está importada desde constants.js

// startSummerSongsGame importada desde gameplay-functions.js
// startGame importada desde gameplay-functions.js
// setupQuestion importada desde gameplay-functions.js

// updateAttemptsCounter importada desde gameplay-functions.js
// checkAnswer importada desde gameplay-functions.js
// nextPlayerOrEndGame importada desde gameplay-functions.js
// continueToNextPlayerTurn importada desde gameplay-functions.js
// endGame importada desde gameplay-functions.js

// Funciones de navegación importadas desde navigation-functions.js
window.setOnlineMenuButtonVisibility = setOnlineMenuButtonVisibility;
window.setEndGameNavigationButtons = setEndGameNavigationButtons;
window.exitGame = exitGame;
window.confirmReturnToMenu = confirmReturnToMenu;

// =====================================================================
// FUNCIONES DE PANTALLA DE ESTADÍSTICAS (ACTUALIZADAS para décadas y categorías)
// =====================================================================

// Funciones de estadísticas importadas desde statistics-functions.js
window.showStatisticsScreen = showStatisticsScreen;
window.confirmResetStatistics = confirmResetStatistics;
window.renderUserTotalScores = renderUserTotalScores;
window.renderDuelHistory = renderDuelHistory;
// calculateDuelWins ya está importada desde statistics-functions.js

// =====================================================================
// FUNCIONES DE PANTALLA DE LISTADO DE CANCIONES (ACTUALIZADAS para décadas y categorías)
// =====================================================================

// Funciones de listado de canciones importadas desde songs-list-functions.js
window.showSongsListCategorySelection = showSongsListCategorySelection;
window.displaySongsForCategory = displaySongsForCategory;

// Variables para el modo online ahora importadas desde constants.js

// Funciones online importadas desde online-functions.js
window.createOnlineGame = createOnlineGame;
window.joinOnlineGame = joinOnlineGame;
window.joinOnlineGameFromPending = joinOnlineGameFromPending;
window.getSongsForOnlineMatch = getSongsForOnlineMatch;
window.startOnlineGame = startOnlineGame;
window.submitOnlineScore = submitOnlineScore;
window.pollOnlineGameStatus = pollOnlineGameStatus;
window.saveOnlineGameToHistory = saveOnlineGameToHistory;
window.getWinnerName = getWinnerName;
window.formatOnlineGameDate = formatOnlineGameDate;
window.isOnlineGameFinished = isOnlineGameFinished;
window.invitePlayerByName = invitePlayerByName;
window.shareOnlineCode = shareOnlineCode;
window.updateOnlineInviteBadge = updateOnlineInviteBadge;
window.showInviteToast = showInviteToast;
window.sendInviteNotification = sendInviteNotification;
window.sendGameFinishedNotification = sendGameFinishedNotification;
window.copyOnlineGameCode = copyOnlineGameCode;
window.viewOnlineGameResults = viewOnlineGameResults;
window.goToOnlineWaitScreen = goToOnlineWaitScreen;
window.continueOnlineGame = continueOnlineGame;
window.showOnlineResults = showOnlineResults;
window.loadPlayerOnlineGames = loadPlayerOnlineGames;

// Funciones de share importadas desde share-functions.js
window.generateShareText = generateShareText;
window.shareGameResultHandler = shareGameResultHandler;

// Funciones de navegación importadas desde navigation-functions.js
window.showStats = showStats;
window.showAllSongs = showAllSongs;

Object.assign(window, {
  togglePasswordVisibility,
  toggleNotificationsPanel,
  toggleHamburgerMenu,
  closeHamburgerMenu,
  showPasswordRecoveryInfo,
  showChangePasswordModal,
  showInstructions,
  closeInstructions,
  closePremiumModal,
  closePasswordResetModal,
  confirmPasswordReset,
  requestPasswordReset,
  closeChangePasswordModal,
  changePassword,
  loginUser,
  registerUser,
  setPlayerName,
  // Gameplay functions
  playAudioSnippet,
  selectPlayers,
  startGame,
  setupQuestion,
  updateAttemptsCounter,
  checkAnswer,
  nextPlayerOrEndGame,
  continueToNextPlayerTurn,
  endGame,
  startSummerSongsGame,
  // Navigation functions
  confirmReturnToMenu,
  addElderlyPlayerInput,
  startElderlyModeGame,
  exitGame,
  acceptCookieConsent,
  createOnlineGame,
  joinOnlineGame,
  invitePlayerByName,
  confirmClearOnlineGameHistory,
  goToOnlineMenu,
  endOnlineModeAndGoHome,
  showSongsListCategorySelection,
});

// =====================================================================
// INICIALIZACIÓN
// =====================================================================

// ... (resto del código)

// Funciones de cookies importadas desde cookies-functions.js
window.checkCookieConsent = checkCookieConsent;
window.acceptCookieConsent = acceptCookieConsent;

// Sustituye la función existente syncUserPermissions por esta:
// async function syncUserPermissions() {
//   // 1. Asegurar que tenemos usuario
//   if (!currentUser || !currentUser.email) {
//     const stored = getCurrentUserData();
//     if (stored && stored.email) {
//       currentUser = stored;
//     } else {
//       return;
//     }
//   }

//   const safeEmail = currentUser.email.trim();

//   try {
//     // v.66: Log silenciado para producción
//     // console.log(`🔄 Sincronizando permisos para ${safeEmail}...`);

//     // Fetch con Cache Busting agresivo
//     const response = await fetch(`${API_BASE_URL}/api/users/${safeEmail}?t=${Date.now()}`, {
//       cache: "no-store",
//       headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
//     });

//     if (response.ok) {
//       const data = await response.json();

//       if (data.user && Array.isArray(data.user.unlocked_sections)) {
//         const activeNow = getActivePermissions();
//         const serverSections = data.user.unlocked_sections;

//         const mergedSections = [...new Set([...activeNow, ...serverSections])];

//         if (currentUser) {
//           currentUser.unlocked_sections = mergedSections;
//           const userData = JSON.parse(localStorage.getItem("userData") || "{}");
//           userData.unlocked_sections = mergedSections;
//           localStorage.setItem("userData", JSON.stringify(userData));
//         }

//         const allPerms = JSON.parse(localStorage.getItem(PERMISSIONS_STORAGE_KEY) || "{}");
//         allPerms[safeEmail] = {
//           email: safeEmail,
//           unlocked_sections: mergedSections,
//           is_admin: safeEmail === ADMIN_EMAIL,
//         };
//         localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(allPerms));

//         // v.66: Log silenciado
//         // console.log("✅ Permisos sincronizados (Fusión):", mergedSections);

//         const currentScreen = document.querySelector(".screen.active");
//         if (currentScreen) {
//           if (currentScreen.id === "category-screen") generateCategoryButtons();
//           if (currentScreen.id === "decade-selection-screen") updatePremiumButtonsState();
//           if (currentScreen.id === "songs-list-category-screen") showSongsListCategorySelection();
//         }
//       }
//     }
//   } catch (error) {
//     console.warn("❌ Error al sincronizar perfil:", error);
//   }
// }

// isSyncing ahora importada desde app-init-functions.js

// Funciones de inicialización importadas desde app-init-functions.js
window.setupPaymentListeners = setupPaymentListeners;
window.refreshUI = refreshUI;
window.startApp = startApp;

// selectCategory importada desde navigation-functions.js
window.selectCategory = selectCategory;

// Inicialización
window.onload = initializeApp;
