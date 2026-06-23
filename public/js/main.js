// ============================================================================
// MANEJADOR DE ERRORES GLOBAL - Detecta errores de importación, ejecución, etc.
// ============================================================================
globalThis.addEventListener("error", (event) => {
  console.error("❌ ERROR GLOBAL:", event.message, event.filename, event.lineno);
  console.error("Error object:", event.error);
});

globalThis.addEventListener("unhandledrejection", (event) => {
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
import {
  startApp,
  initializeApp,
  setupPaymentListeners,
  refreshUI,
  validateGlobals,
} from "./files/app-init-functions.js";
// Referencias a elementos DOM (necesarias en main.js)
const audioPlayer = globalThis.audioPlayer || document.getElementById("audio-player");
const sfxAcierto = globalThis.sfxAcierto || document.getElementById("sfx-acierto");
const sfxError = globalThis.sfxError || document.getElementById("sfx-error");

(() => {
  const savedUserJSON = localStorage.getItem("userData");
  if (savedUserJSON) {
    try {
      globalThis.currentUser = JSON.parse(savedUserJSON);
      console.log("✅ Sesión persistente restaurada:", currentUser.email);
    } catch (e) {
      console.error("❌ Sesión corrupta. Limpiando localStorage.", e);
      localStorage.removeItem("userData");
      globalThis.currentUser = null;
    }
  }
})();

globalThis.showScreen = showScreen;

// Funciones de password importadas desde auth-helpers.js
globalThis.togglePasswordVisibility = togglePasswordVisibility;
globalThis.showPasswordRecoveryInfo = showPasswordRecoveryInfo;

globalThis.toggleHamburgerMenu = toggleHamburgerMenu;

if ("serviceWorker" in navigator) {
  globalThis.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((error) => {
      console.warn("No se pudo registrar el Service Worker:", error);
    });
  });
}

// FUNCIONES DE AUTENTICACIÓN
globalThis.loginUser = loginUser;

// Ejecutar validación después de cargar
setTimeout(validateGlobals, 1000);

// Navegación
globalThis.selectDecade = selectDecade;
globalThis.selectCategory = selectCategory;
globalThis.exitGame = exitGame;
globalThis.confirmReturnToMenu = confirmReturnToMenu;
globalThis.goToOnlineMenu = goToOnlineMenu;
globalThis.endOnlineModeAndGoHome = endOnlineModeAndGoHome;
globalThis.setOnlineMenuButtonVisibility = setOnlineMenuButtonVisibility;
globalThis.setEndGameNavigationButtons = setEndGameNavigationButtons;
globalThis.showStats = showStats;
globalThis.showAllSongs = showAllSongs;

// Gameplay
globalThis.selectPlayers = selectPlayers;
globalThis.startGame = startGame;
globalThis.setupQuestion = setupQuestion;
globalThis.updateAttemptsCounter = updateAttemptsCounter;
globalThis.checkAnswer = checkAnswer;
globalThis.nextPlayerOrEndGame = nextPlayerOrEndGame;
globalThis.continueToNextPlayerTurn = continueToNextPlayerTurn;
globalThis.endGame = endGame;
globalThis.startSummerSongsGame = startSummerSongsGame;
globalThis.playAudioSnippet = playAudioSnippet;

// Historial de canciones
globalThis.updateRecentSongsHistory = updateRecentSongsHistory;
globalThis.getRecentSongs = getRecentSongs;

// Listado de canciones
globalThis.showSongsListCategorySelection = showSongsListCategorySelection;
globalThis.displaySongsForCategory = displaySongsForCategory;
globalThis.parseDisplay = parseDisplay;

// Modo elderly
globalThis.addElderlyPlayerInput = addElderlyPlayerInput;
globalThis.startElderlyModeGame = startElderlyModeGame;

// Estadísticas
globalThis.showStatisticsScreen = showStatisticsScreen;
globalThis.confirmResetStatistics = confirmResetStatistics;
globalThis.renderUserTotalScores = renderUserTotalScores;
globalThis.renderDuelHistory = renderDuelHistory;

// Share
globalThis.generateShareText = generateShareText;
globalThis.shareGameResultHandler = shareGameResultHandler;

// Cookies
globalThis.checkCookieConsent = checkCookieConsent;
globalThis.acceptCookieConsent = acceptCookieConsent;

// Online - Core
globalThis.createOnlineGame = createOnlineGame;
globalThis.joinOnlineGame = joinOnlineGame;
globalThis.joinOnlineGameFromPending = joinOnlineGameFromPending;
globalThis.startOnlineGame = startOnlineGame;
globalThis.submitOnlineScore = submitOnlineScore;
globalThis.pollOnlineGameStatus = pollOnlineGameStatus;
globalThis.getSongsForOnlineMatch = getSongsForOnlineMatch;
globalThis.saveOnlineGameToHistory = saveOnlineGameToHistory;
globalThis.confirmClearOnlineGameHistory = confirmClearOnlineGameHistory;

// Online - Invites
globalThis.invitePlayerByName = invitePlayerByName;
globalThis.shareOnlineCode = shareOnlineCode;
globalThis.copyOnlineGameCode = copyOnlineGameCode;
globalThis.declineOnlineGame = declineOnlineGame;
globalThis.deletePendingOnlineGame = deletePendingOnlineGame;
globalThis.updateOnlineInviteBadge = updateOnlineInviteBadge;
globalThis.startOnlineInvitePolling = startOnlineInvitePolling;

// Online - UI
globalThis.loadPlayerOnlineGames = loadPlayerOnlineGames;
globalThis.showOnlineResults = showOnlineResults;
globalThis.viewOnlineGameResults = viewOnlineGameResults;
globalThis.goToOnlineWaitScreen = goToOnlineWaitScreen;
globalThis.continueOnlineGame = continueOnlineGame;

// Online - Notifications
globalThis.getWinnerName = getWinnerName;
globalThis.formatOnlineGameDate = formatOnlineGameDate;
globalThis.isOnlineGameFinished = isOnlineGameFinished;
globalThis.showInviteToast = showInviteToast;
globalThis.sendInviteNotification = sendInviteNotification;
globalThis.sendGameFinishedNotification = sendGameFinishedNotification;

// Inicialización
globalThis.setupPaymentListeners = setupPaymentListeners;
globalThis.refreshUI = refreshUI;
globalThis.startApp = startApp;

Object.assign(globalThis, {
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
globalThis.onload = initializeApp;
