import { showScreen } from "./screen-functions.js";
import { showAppAlert } from "./modal-functions.js";
import { generateDecadeButtons, generateCategoryButtons, updatePremiumButtonsState } from "./ui-functions.js";
import { loadUserScores } from "./user-functions.js";
import { loadGameHistory } from "./game-functions.js";
import { startOnlineInvitePolling } from "./online-functions.js";
import { checkCookieConsent } from "./cookies-functions.js";
import { APP_VERSION } from "../constants/app-constants.js";

let isSyncing = false;

/**
 * Refresca la UI basándose en la pantalla actual.
 */
export function refreshUI() {
  const currentScreen = document.querySelector(".screen.active");
  if (currentScreen) {
    if (currentScreen.id === "category-screen") generateCategoryButtons();
    if (currentScreen.id === "decade-selection-screen") updatePremiumButtonsState();
    if (currentScreen.id === "songs-list-category-screen") showSongsListCategorySelection();
  }
}

/**
 * Configura los listeners para pagos y eventos.
 */
export function setupPaymentListeners() {
  // Verificamos si venimos de un pago exitoso de Stripe
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get("session_id");

  if (sessionId) {
    // v.66: Log silenciado
    // console.log("💳 Detectado retorno de pago Stripe. Sincronizando...");
    syncUserPermissions();
    // Limpiamos la URL para no re-procesar el éxito al recargar
    window.history.replaceState({}, document.title, window.location.pathname);
    showAppAlert("¡Gracias por tu compra! Tu contenido se está desbloqueando.");
  }
}

/**
 * Sincroniza los permisos del usuario con el servidor.
 * (Esta función está comentada en main.js original, se mantiene para referencia)
 */
export async function syncUserPermissions() {
  // 1. Asegurar que tenemos usuario
  if (!currentUser || !currentUser.email) {
    const stored = getCurrentUserData();
    if (stored && stored.email) {
      currentUser = stored;
    } else {
      return;
    }
  }

  const safeEmail = currentUser.email.trim();

  try {
    // v.66: Log silenciado para producción
    // console.log(`🔄 Sincronizando permisos para ${safeEmail}...`);

    // Fetch con Cache Busting agresivo
    const response = await fetch(`${API_BASE_URL}/api/users/${safeEmail}?t=${Date.now()}`, {
      cache: "no-store",
      headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
    });

    if (response.ok) {
      const data = await response.json();

      if (data.user && Array.isArray(data.user.unlocked_sections)) {
        const activeNow = getActivePermissions();
        const serverSections = data.user.unlocked_sections;

        const mergedSections = [...new Set([...activeNow, ...serverSections])];

        if (currentUser) {
          currentUser.unlocked_sections = mergedSections;
          const userData = JSON.parse(localStorage.getItem("userData") || "{}");
          userData.unlocked_sections = mergedSections;
          localStorage.setItem("userData", JSON.stringify(userData));
        }

        const allPerms = JSON.parse(localStorage.getItem(PERMISSIONS_STORAGE_KEY) || "{}");
        allPerms[safeEmail] = {
          email: safeEmail,
          unlocked_sections: mergedSections,
          is_admin: safeEmail === ADMIN_EMAIL,
        };
        localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(allPerms));

        // v.66: Log silenciado
        // console.log("✅ Permisos sincronizados (Fusión):", mergedSections);

        const currentScreen = document.querySelector(".screen.active");
        if (currentScreen) {
          if (currentScreen.id === "category-screen") generateCategoryButtons();
          if (currentScreen.id === "decade-selection-screen") updatePremiumButtonsState();
          if (currentScreen.id === "songs-list-category-screen") showSongsListCategorySelection();
        }
      }
    }
  } catch (error) {
    console.warn("❌ Error al sincronizar perfil:", error);
  }
}

/**
 * Arranque unificado de la aplicación con persistencia de sesión.
 * @param {string} source - 'boot' para inicio normal, 'user' para inicio desde login
 */
export async function startApp(source = "boot") {
  window.startApp = startApp;
  const versionEl = document.getElementById("app-version");
  if (versionEl) versionEl.textContent = APP_VERSION;
  // source: 'boot' | 'user'
  // - boot  => si NO hay sesión, mostrar home-screen
  // - user  => si NO hay sesión, mostrar login-screen

  // Rehidratación defensiva (no confiamos en RAM)
  let restored = null;
  try {
    const savedUserJSON = localStorage.getItem("userData");
    if (savedUserJSON) restored = JSON.parse(savedUserJSON);
  } catch (e) {
    console.error("❌ userData corrupto. Limpiando.", e);
    localStorage.removeItem("userData");
    localStorage.removeItem("loggedInUserEmail");
    localStorage.removeItem("sessionActive");
    restored = null;
  }

  // Validación mínima
  if (restored && restored.email) {
    currentUser = restored;
    localStorage.setItem("sessionActive", "true");

    // --- ACTIVAR POLLING DE NOTIFICACIONES ---
    startOnlineInvitePolling();
    // -----------------------------------------

    // Cargar datos del usuario (sin bloquear el enrutamiento si falla)
    try {
      await loadUserScores(currentUser.email);
    } catch (e) {
      console.warn("Scores no cargados:", e);
    }
    try {
      await loadGameHistory(currentUser.email);
    } catch (e) {
      console.warn("Historial no cargado:", e);
    }

    // Enrutamiento
    if (currentUser.playerName) {
      showScreen("decade-selection-screen");
      if (typeof generateDecadeButtons === "function") generateDecadeButtons();
      if (typeof updatePremiumButtonsState === "function") updatePremiumButtonsState();
    } else {
      showScreen("set-player-name-screen");
    }
    return;
  }

  // Sin sesión
  if (source === "user") {
    showScreen("login-screen");
  } else {
    showScreen("home-screen");
  }
}

/**
 * Inicialización blindada (sesión + pagos).
 */
export async function initializeApp() {
  console.log("🚀 Iniciando aplicación (boot) - Sesión persistente.");

  // 0. Registrar Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("sw.js")
      .then((registration) => {
        console.log("SW registrado:", registration.scope);
        // Forzar actualización si hay uno nuevo esperando
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      })
      .catch((err) => {
        console.warn("SW fallo:", err);
      });
  }

  // 1. GESTIÓN DE COOKIES
  if (typeof checkCookieConsent === "function") {
    checkCookieConsent();
  }

  // 2. RETORNO DE PAGO (Stripe)
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get("session_id");

  if (sessionId) {
    console.log("💳 Retorno de pago detectado.");

    // Rehidratamos sesión y sincronizamos permisos si procede
    await startApp("boot");

    if (currentUser && typeof syncUserPermissions === "function") {
      await syncUserPermissions();

      showAppAlert(
        "¡Pago realizado con éxito! 🎉\n\n" +
          "Las categorías premium se están desbloqueando en este momento. " +
          "Este proceso puede tardar unos segundos.\n\n" +
          "Si no ves el contenido desbloqueado inmediatamente, " +
          "espera un momento o refresca la página para actualizar el estado.",
        { confirmText: "Entendido" },
      );
    }

    // Limpiar URL (elimina ?session_id)
    window.history.replaceState({}, document.title, window.location.pathname);
    return;
  }

  // 3. ARRANQUE NORMAL (con persistencia)
  await startApp("boot");
}

export { isSyncing };
