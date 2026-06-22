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
  confirmClearOnlineGameHistory,
} from "./files/online-functions.js";
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

// Funciones de navegación
window.endOnlineModeAndGoHome = endOnlineModeAndGoHome;
window.goToOnlineMenu = goToOnlineMenu;
window.selectDecade = selectDecade;
window.selectCategory = selectCategory;

// Funciones de gameplay
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

// Funciones de historial de canciones
window.updateRecentSongsHistory = updateRecentSongsHistory;
window.getRecentSongs = getRecentSongs;

window.parseDisplay = parseDisplay;
window.selectDecade = selectDecade;

// Funciones de elderly-mode
window.addElderlyPlayerInput = addElderlyPlayerInput;
window.startElderlyModeGame = startElderlyModeGame;

// Funciones de navegación
window.setOnlineMenuButtonVisibility = setOnlineMenuButtonVisibility;
window.setEndGameNavigationButtons = setEndGameNavigationButtons;
window.exitGame = exitGame;
window.confirmReturnToMenu = confirmReturnToMenu;

// Funciones de estadísticas
window.showStatisticsScreen = showStatisticsScreen;
window.confirmResetStatistics = confirmResetStatistics;
window.renderUserTotalScores = renderUserTotalScores;
window.renderDuelHistory = renderDuelHistory;

// Funciones de listado de canciones
window.showSongsListCategorySelection = showSongsListCategorySelection;
window.displaySongsForCategory = displaySongsForCategory;

// Funciones online
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

// Funciones de share
window.generateShareText = generateShareText;
window.shareGameResultHandler = shareGameResultHandler;

// Funciones de navegación
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

// INICIALIZACIÓN
window.checkCookieConsent = checkCookieConsent;
window.acceptCookieConsent = acceptCookieConsent;

// Funciones de inicialización
window.setupPaymentListeners = setupPaymentListeners;
window.refreshUI = refreshUI;
window.startApp = startApp;
window.selectCategory = selectCategory;

// Inicialización
window.onload = initializeApp;
