import { ADMIN_EMAIL, PERMISSIONS_STORAGE_KEY } from "../constants/app-constants.js";
import { loadGameHistory } from "./game-functions.js";
import { parseJsonResponse, isValidEmail } from "./helpers.js";
import { showAppAlert } from "./modal-functions.js";
import { startOnlineInvitePolling } from "./online-functions.js";
import { showScreen } from "./screen-functions.js";
import { generateDecadeButtons, updatePremiumButtonsState } from "./ui-functions.js";
import { getActivePermissions, getLocalUsers, getUserPermissions, loadUserScores } from "./user-functions.js";

export async function loginUser() {
  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const API_BASE_URL =
    globalThis.location.hostname === "localhost" || globalThis.location.hostname === "127.0.0.1"
      ? globalThis.location.origin
      : CANONICAL_PROD_ORIGIN;

  if (!email || !password) {
    showAppAlert("Por favor, introduce tu email y contraseña.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await parseJsonResponse(response);

    if (response.status === 403 && data.requireVerification) {
      showAppAlert(data.message);
      document.getElementById("verify-email-display").textContent = data.email;
      localStorage.setItem("tempVerifyEmail", data.email);
      showScreen("verify-email-screen");
      return;
    }

    if (response.ok) {
      if (!data || !data.user || !data.user.email) {
        showAppAlert("Respuesta inválida del servidor. Intenta de nuevo más tarde.");
        return;
      }

      globalThis.currentUser = {
        email: data.user.email,
        playerName: data.user.playerName,
        unlocked_sections: data.user.unlocked_sections || [],
      };

      // Procesar Permisos iniciales del Servidor
      if (data.user.unlocked_sections) {
        const perms = {
          email: data.user.email,
          unlocked_sections: data.user.unlocked_sections,
          is_admin: data.user.email === ADMIN_EMAIL,
        };

        const allPerms = JSON.parse(localStorage.getItem(PERMISSIONS_STORAGE_KEY) || "{}");
        allPerms[data.user.email] = perms;
        localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(allPerms));
      }

      startOnlineInvitePolling();
    } else if (response.status === 404 || response.status >= 500) {
      globalThis.useLocalApiFallback = true;
    } else {
      showAppAlert(`Error al iniciar sesión: ${data?.message || "No se pudo iniciar sesión."}`);
      return;
    }
  } catch (error) {
    console.warn("API no disponible, usando login local:", error);
    globalThis.useLocalApiFallback = true;
  }

  // Fallback offline
  if (globalThis.useLocalApiFallback) {
    const users = getLocalUsers();
    const user = users[email];
    if (!user || user.password !== password) {
      showAppAlert("Email o contraseña incorrectos.");
      return;
    }
    globalThis.currentUser = {
      email: user.email,
      playerName: user.playerName,
      unlocked_sections: [],
    };
  }

  if (globalThis.currentUser) {
    // Esto arregla el problema tras reset de contraseña
    try {
      await syncUserPermissions();
    } catch (e) {
      console.error("Error sincronizando permisos en login:", e);
    }

    getUserPermissions(globalThis.currentUser.email);

    localStorage.setItem("loggedInUserEmail", globalThis.currentUser.email);
    localStorage.setItem("userData", JSON.stringify(globalThis.currentUser));
    localStorage.setItem("sessionActive", "true");

    showAppAlert(`¡Bienvenido, ${globalThis.currentUser.playerName || globalThis.currentUser.email}!`);
    emailInput.value = "";
    passwordInput.value = "";

    await loadUserScores(globalThis.currentUser.email);
    await loadGameHistory(globalThis.currentUser.email);

    if (globalThis.currentUser.playerName) {
      showScreen("decade-selection-screen");
      generateDecadeButtons();
      updatePremiumButtonsState();
    } else {
      showScreen("set-player-name-screen");
    }
  }
}

export async function requestPasswordReset() {
  const emailInput = document.getElementById("password-reset-email");
  const email = emailInput?.value.trim();
  const tokenInfo = document.getElementById("password-reset-token-info");

  if (!email) {
    showAppAlert("Introduce tu correo electrónico para recibir el token.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/password-reset/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const result = await response.json();

    if (response.ok) {
      if (tokenInfo) {
        tokenInfo.textContent = result.token
          ? `Token generado: ${result.token}`
          : result.message || "Si el email existe, te enviaremos un token.";
      }
      showAppAlert(result.message || "Si el email existe, te enviaremos un token.");
    } else {
      showAppAlert(result.message || "No se pudo solicitar el token.");
    }
  } catch (error) {
    console.error("Error al solicitar token:", error);
    showAppAlert("Error de conexión. Intenta de nuevo más tarde.");
  }
}

export async function confirmPasswordReset() {
  const email = document.getElementById("password-reset-email")?.value.trim();
  const token = document.getElementById("password-reset-token")?.value.trim();
  const newPassword = document.getElementById("password-reset-new-password")?.value.trim();
  const confirmPassword = document.getElementById("password-reset-confirm-password")?.value.trim();

  if (!email || !token || !newPassword) {
    showAppAlert("Completa el email, el token y la nueva contraseña.");
    return;
  }
  if (newPassword !== confirmPassword) {
    showAppAlert("Las contraseñas no coinciden.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/password-reset/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token, newPassword }),
    });
    const result = await response.json();

    if (response.ok) {
      showAppAlert(result.message || "Contraseña actualizada correctamente.");
      closePasswordResetModal();
    } else {
      showAppAlert(result.message || "No se pudo cambiar la contraseña.");
    }
  } catch (error) {
    console.error("Error al confirmar reset:", error);
    showAppAlert("Error de conexión. Intenta de nuevo más tarde.");
  }
}

export async function changePassword() {
  if (!currentUser || !currentUser.email) {
    showAppAlert("Debes iniciar sesión para cambiar la contraseña.");
    showScreen("login-screen");
    return;
  }

  const currentPassword = document.getElementById("password-change-current")?.value.trim();
  const newPassword = document.getElementById("password-change-new")?.value.trim();
  const confirmPassword = document.getElementById("password-change-confirm")?.value.trim();

  if (!currentPassword || !newPassword) {
    showAppAlert("Completa todos los campos para cambiar la contraseña.");
    return;
  }
  if (newPassword !== confirmPassword) {
    showAppAlert("Las contraseñas no coinciden.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/password-change`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: currentUser.email, currentPassword, newPassword }),
    });
    const result = await response.json();

    if (response.ok) {
      showAppAlert(result.message || "Contraseña actualizada correctamente.");
      closeChangePasswordModal();
    } else {
      showAppAlert(result.message || "No se pudo cambiar la contraseña.");
    }
  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    showAppAlert("Error de conexión. Intenta de nuevo más tarde.");
  }
}

export async function registerUser() {
  const emailInput = document.getElementById("register-email");
  const passwordInput = document.getElementById("register-password");
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    showAppAlert("Por favor, introduce un email y una contraseña.");
    return;
  }
  if (!isValidEmail(email)) {
    showAppAlert("Por favor, introduce un email válido.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await parseJsonResponse(response);

    if (response.ok) {
      // CAMBIO: Si el servidor pide verificación, vamos a esa pantalla
      if (data.requireVerification) {
        showAppAlert(data.message);
        document.getElementById("verify-email-display").textContent = data.email;
        // Guardamos temporalmente el email para reenviar si hace falta
        localStorage.setItem("tempVerifyEmail", data.email);
        showScreen("verify-email-screen");
        return;
      }

      // Comportamiento antiguo (si no hubiera verificación)
      showAppAlert(data?.message || "Usuario registrado correctamente.");
      emailInput.value = "";
      passwordInput.value = "";
      showScreen("login-screen");
      return;
    }

    if (response.status === 404 || response.status >= 500) {
      globalThis.useLocalApiFallback = true;
    }

    if (!globalThis.useLocalApiFallback) {
      showAppAlert(`Error al registrar: ${data?.message || "No se pudo completar el registro."}`);
      return;
    }
  } catch (error) {
    console.warn("API no disponible, usando registro local:", error);
    globalThis.useLocalApiFallback = true;
  }

  if (globalThis.useLocalApiFallback) {
    const users = getLocalUsers();
    if (users[email]) {
      showAppAlert("Ese correo ya está registrado.");
      return;
    }
    users[email] = { email, password, playerName: null };
    saveLocalUsers(users);
    showAppAlert("Usuario registrado correctamente.");
    emailInput.value = "";
    passwordInput.value = "";
    showScreen("login-screen");
  }
}

export async function verifyEmailAction() {
  const code = document.getElementById("verify-code-input").value.trim();
  // Recuperamos el email que guardamos al registrar o intentar loguear
  const email = localStorage.getItem("tempVerifyEmail");

  if (!code || !email) {
    showAppAlert("Falta el código o el email.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const result = await response.json();

    if (response.ok) {
      showAppAlert(result.message);
      // Limpieza
      document.getElementById("verify-code-input").value = "";
      localStorage.removeItem("tempVerifyEmail");
      // Mandar al usuario a loguearse
      showScreen("login-screen");
    } else {
      showAppAlert(result.message || "Código incorrecto.");
    }
  } catch (err) {
    console.error(err);
    showAppAlert("Error de conexión al verificar.");
  }
}

export async function resendVerificationCode() {
  const email = localStorage.getItem("tempVerifyEmail");
  if (!email) {
    showAppAlert("No hay un email pendiente de verificación.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/resend-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const result = await response.json();
    showAppAlert(result.message || "Código reenviado.");
  } catch (err) {
    showAppAlert("Error al reenviar el código.");
  }
}

export function logout() {
  currentUser = null;
  localStorage.removeItem("loggedInUserEmail");
  localStorage.removeItem("userData");
  localStorage.removeItem("sessionActive");
  localStorage.removeItem("currentOnlineGameData");

  // --- LIMPIEZA DE PAGOS ---
  localStorage.removeItem("pending_purchase_intent");
  localStorage.removeItem("purchase_start_time");
  // -------------------------

  showAppAlert("Sesión cerrada correctamente.");
  showScreen("login-screen");
}

async function syncUserPermissions() {
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
