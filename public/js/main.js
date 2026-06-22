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
  getUserPermissions,
  getActivePermissions,
  getLocalScores,
  saveLocalScores,
  getLocalGameHistory,
  saveLocalGameHistory,
  closePremiumModal,
  loadUserScores,
  saveUserScores,
  setPlayerName,
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

import {
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
// Online functions - Core game logic
import {
  createOnlineGame,
  joinOnlineGame,
  joinOnlineGameFromPending,
  startOnlineGame,
  submitOnlineScore,
  pollOnlineGameStatus,
  getSongsForOnlineMatch,
  saveOnlineGameToHistory,
} from "./files/online-functions.js";

// Online invites
import {
  startOnlineInvitePolling,
  invitePlayerByName,
  shareOnlineCode,
  copyOnlineGameCode,
  declineOnlineGame,
  deletePendingOnlineGame,
  updateOnlineInviteBadge,
} from "./files/online-invites.js";

// Online UI
import {
  loadPlayerOnlineGames,
  showOnlineResults,
  viewOnlineGameResults,
  goToOnlineWaitScreen,
  continueOnlineGame,
} from "./files/online-ui.js";

// Online notifications
import {
  getWinnerName,
  formatOnlineGameDate,
  isOnlineGameFinished,
  showInviteToast,
  sendInviteNotification,
  sendGameFinishedNotification,
  confirmClearOnlineGameHistory,
} from "./files/online-notifications.js";
import { generateCategoryButtons, updatePremiumButtonsState } from "./files/ui-functions.js";
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
import { playAudioSnippet } from "./files/audio-manager.js";
import {
  selectPlayers,
  startGame,
  nextPlayerOrEndGame,
  continueToNextPlayerTurn,
  endGame,
  startSummerSongsGame,
} from "./files/gameplay-core.js";
import { setupQuestion, updateAttemptsCounter, checkAnswer } from "./files/questions.js";
import { startApp, initializeApp, setupPaymentListeners, refreshUI, validateGlobals } from "./files/app-init-functions.js";
// Referencias a elementos DOM (necesarias en main.js)
const audioPlayer = window.audioPlayer || document.getElementById("audio-player");
const sfxAcierto = window.sfxAcierto || document.getElementById("sfx-acierto");
const sfxError = window.sfxError || document.getElementById("sfx-error");

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

// FUNCIONES DE AUTENTICACIÓN
window.loginUser = loginUser;

// Ejecutar validación después de cargar
setTimeout(validateGlobals, 1000);

// Navegación
window.selectDecade = selectDecade;
window.selectCategory = selectCategory;
window.exitGame = exitGame;
window.confirmReturnToMenu = confirmReturnToMenu;
window.goToOnlineMenu = goToOnlineMenu;
window.endOnlineModeAndGoHome = endOnlineModeAndGoHome;
window.setOnlineMenuButtonVisibility = setOnlineMenuButtonVisibility;
window.setEndGameNavigationButtons = setEndGameNavigationButtons;
window.showStats = showStats;
window.showAllSongs = showAllSongs;

// Gameplay
window.selectPlayers = selectPlayers;
window.startGame = startGame;
window.setupQuestion = setupQuestion;
window.updateAttemptsCounter = updateAttemptsCounter;
window.checkAnswer = checkAnswer;
window.nextPlayerOrEndGame = nextPlayerOrEndGame;
window.continueToNextPlayerTurn = continueToNextPlayerTurn;
window.endGame = endGame;
window.startSummerSongsGame = startSummerSongsGame;
window.playAudioSnippet = playAudioSnippet;

// Historial de canciones
window.updateRecentSongsHistory = updateRecentSongsHistory;
window.getRecentSongs = getRecentSongs;

// Listado de canciones
window.showSongsListCategorySelection = showSongsListCategorySelection;
window.displaySongsForCategory = displaySongsForCategory;
window.parseDisplay = parseDisplay;

// Modo elderly
window.addElderlyPlayerInput = addElderlyPlayerInput;
window.startElderlyModeGame = startElderlyModeGame;

// Estadísticas
window.showStatisticsScreen = showStatisticsScreen;
window.confirmResetStatistics = confirmResetStatistics;
window.renderUserTotalScores = renderUserTotalScores;
window.renderDuelHistory = renderDuelHistory;

// Share
window.generateShareText = generateShareText;
window.shareGameResultHandler = shareGameResultHandler;

// Cookies
window.checkCookieConsent = checkCookieConsent;
window.acceptCookieConsent = acceptCookieConsent;

// Online - Core
window.createOnlineGame = createOnlineGame;
window.joinOnlineGame = joinOnlineGame;
window.joinOnlineGameFromPending = joinOnlineGameFromPending;
window.startOnlineGame = startOnlineGame;
window.submitOnlineScore = submitOnlineScore;
window.pollOnlineGameStatus = pollOnlineGameStatus;
window.getSongsForOnlineMatch = getSongsForOnlineMatch;
window.saveOnlineGameToHistory = saveOnlineGameToHistory;
window.confirmClearOnlineGameHistory = confirmClearOnlineGameHistory;

// Online - Invites
window.invitePlayerByName = invitePlayerByName;
window.shareOnlineCode = shareOnlineCode;
window.copyOnlineGameCode = copyOnlineGameCode;
window.declineOnlineGame = declineOnlineGame;
window.deletePendingOnlineGame = deletePendingOnlineGame;
window.updateOnlineInviteBadge = updateOnlineInviteBadge;
window.startOnlineInvitePolling = startOnlineInvitePolling;

// Online - UI
window.loadPlayerOnlineGames = loadPlayerOnlineGames;
window.showOnlineResults = showOnlineResults;
window.viewOnlineGameResults = viewOnlineGameResults;
window.goToOnlineWaitScreen = goToOnlineWaitScreen;
window.continueOnlineGame = continueOnlineGame;

// Online - Notifications
window.getWinnerName = getWinnerName;
window.formatOnlineGameDate = formatOnlineGameDate;
window.isOnlineGameFinished = isOnlineGameFinished;
window.showInviteToast = showInviteToast;
window.sendInviteNotification = sendInviteNotification;
window.sendGameFinishedNotification = sendGameFinishedNotification;

// Inicialización
window.setupPaymentListeners = setupPaymentListeners;
window.refreshUI = refreshUI;
window.startApp = startApp;

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
});

// Inicialización
window.onload = initializeApp;
