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

window.appModalResolver = null;
