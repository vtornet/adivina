const CANONICAL_PROD_ORIGIN = "https://adivinalacancion.app";

window.API_BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? window.location.origin
    : CANONICAL_PROD_ORIGIN;

window.currentUser = null;
window.useLocalApiFallback = false;

window.currentOnlineGameCode = null;
window.currentOnlineSongs = [];
window.currentOnlineEmail = null;
window.currentOnlinePlayerName = null;
window.isOnlineMode = false;
window.isElderlyMode = false;
window.isSummerSongsMode = false;
window.onlineInvitePollInterval = null;
window.lastInviteCodes = new Set();

window.userAccumulatedScores = {};
window.gameHistory = [];
window.pendingPurchaseCategory = null;

// Proxy para configuracionCanciones (apunta a allSongsByDecadeAndCategory)
// Se inicializa aquí y songs-loader.js puede reasignarlo si es necesario
window.configuracionCanciones = window.allSongsByDecadeAndCategory || {};

window.appModalResolver = null;

// Variables de juego y audio (compartidas entre módulos)
window.gameState = {};
window.audioPlaybackTimeout = null;
window.activeTimeUpdateListener = null;

// Referencias a elementos DOM (compartidas entre módulos)
window.screens = document.querySelectorAll(".screen");
window.audioPlayer = document.getElementById("audio-player");
window.sfxAcierto = document.getElementById("sfx-acierto");
window.sfxError = document.getElementById("sfx-error");

// Variables auxiliares (compartidas entre módulos)
window.elderlyPlayerCount = 1; // Por defecto 1 jugador para el input inicial
