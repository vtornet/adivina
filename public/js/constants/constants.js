const CANONICAL_PROD_ORIGIN = "https://adivinalacancion.app";

globalThis.API_BASE_URL =
  globalThis.location.hostname === "localhost" || globalThis.location.hostname === "127.0.0.1"
    ? globalThis.location.origin
    : CANONICAL_PROD_ORIGIN;

globalThis.currentUser = null;
globalThis.useLocalApiFallback = false;

globalThis.currentOnlineGameCode = null;
globalThis.currentOnlineSongs = [];
globalThis.currentOnlineEmail = null;
globalThis.currentOnlinePlayerName = null;
globalThis.isOnlineMode = false;
globalThis.isElderlyMode = false;
globalThis.isSummerSongsMode = false;
globalThis.onlineInvitePollInterval = null;
globalThis.lastInviteCodes = new Set();

globalThis.userAccumulatedScores = {};
globalThis.gameHistory = [];
globalThis.pendingPurchaseCategory = null;

// Proxy para configuracionCanciones (apunta a allSongsByDecadeAndCategory)
// Se inicializa aquí y songs-loader.js puede reasignarlo si es necesario
globalThis.configuracionCanciones = globalThis.allSongsByDecadeAndCategory || {};

globalThis.appModalResolver = null;

// Variables de juego y audio (compartidas entre módulos)
globalThis.gameState = {};
globalThis.audioPlaybackTimeout = null;
globalThis.activeTimeUpdateListener = null;

// Referencias a elementos DOM (compartidas entre módulos)
globalThis.screens = document.querySelectorAll(".screen");
globalThis.audioPlayer = document.getElementById("audio-player");
globalThis.sfxAcierto = document.getElementById("sfx-acierto");
globalThis.sfxError = document.getElementById("sfx-error");

// Variables auxiliares (compartidas entre módulos)
globalThis.elderlyPlayerCount = 1; // Por defecto 1 jugador para el input inicial
