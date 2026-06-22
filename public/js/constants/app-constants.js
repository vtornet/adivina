export const APP_VERSION = "v1.3.1 (Fixed)";
export const CANONICAL_PROD_ORIGIN = "https://adivinalacancion.app";
export const NOTIFICATIONS_STORAGE_KEY = "localNotifications";
export const NOTIFICATIONS_PROMPTED_KEY = "inviteNotificationsPrompted";
export const PERMISSIONS_STORAGE_KEY = "userPermissions";
export const FINISHED_NOTIFICATIONS_KEY = "finishedOnlineNotifications";
export const ADMIN_EMAIL = "vtornet@gmail.com";
export const BASE_DECADES = Array.isArray(window.allDecadesDefined)
  ? window.allDecadesDefined
  : ["80s", "90s", "00s", "10s", "actual", "verano"];

export const DECADES_ORDER = BASE_DECADES.filter((decade) => decade !== "verano" && decade !== "especiales").concat([
  "especiales",
]);

export const CATEGORY_ORDER = Array.isArray(window.allPossibleCategories)
  ? window.allPossibleCategories
  : ["espanol", "ingles", "peliculas", "series", "tv", "infantiles", "anuncios"];

export const DECADES_WITH_SPECIALS = [...DECADES_ORDER, "Todas"];

// Local storage keys for user data
export const LOCAL_USERS_KEY = "localUsers";
export const LOCAL_SCORES_KEY = "localScores";
export const LOCAL_GAME_HISTORY_KEY = "localGameHistory";
