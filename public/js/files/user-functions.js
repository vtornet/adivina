import { ADMIN_EMAIL, PERMISSIONS_STORAGE_KEY, LOCAL_USERS_KEY, LOCAL_SCORES_KEY, LOCAL_GAME_HISTORY_KEY, API_BASE_URL } from "../constants/app-constants.js";
import { parseJsonResponse } from "./helpers.js";
import { showAppAlert } from "./modal-functions.js";
import { showScreen } from "./screen-functions.js";
import { generateDecadeButtons } from "./ui-functions.js";

export function getCurrentUserData() {
  const userDataString = localStorage.getItem("userData");
  if (!userDataString) return null;
  return JSON.parse(userDataString);
}

export function getUserPermissions(email) {
  const storedPermissions = JSON.parse(localStorage.getItem(PERMISSIONS_STORAGE_KEY) || "{}");
  if (!storedPermissions[email]) {
    storedPermissions[email] = {
      email,
      unlocked_sections: [],
      no_ads: false,
      is_admin: false,
    };
  }

  if (email === ADMIN_EMAIL) {
    storedPermissions[email] = {
      email,
      unlocked_sections: ["premium_all"],
      no_ads: true,
      is_admin: true,
    };
  }

  localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(storedPermissions));
  return storedPermissions[email];
}

export function getActivePermissions() {
  // Si no hay usuario, no hay permisos
  if (!window.currentUser || !window.currentUser.email) return [];

  let localSections = [];
  let memorySections = [];

  // 1. Memoria (RAM) - Lo más inmediato
  if (window.currentUser.unlocked_sections && Array.isArray(window.currentUser.unlocked_sections)) {
    memorySections = window.currentUser.unlocked_sections;
  }

  // 2. Disco (LocalStorage) - La persistencia
  try {
    const storedPermsJSON = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
    if (storedPermsJSON) {
      const parsed = JSON.parse(storedPermsJSON);
      if (parsed[window.currentUser.email]) {
        localSections = parsed[window.currentUser.email].unlocked_sections || [];
      }
    }
  } catch (e) {
    console.warn("Error al leer permisos del localStorage:", e);
  }

  // Fusión: combinamos memorySections + localSections
  const mergedSections = [...new Set([...memorySections, ...localSections])];
  return mergedSections;
}

export function getLocalUsers() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "{}");
  } catch (e) {
    console.error("Error al leer usuarios locales:", e);
    return {};
  }
}

export function saveLocalUsers(users) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

export function getLocalScores() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_SCORES_KEY) || "{}");
  } catch (e) {
    console.error("Error al leer puntuaciones locales:", e);
    return {};
  }
}

export function saveLocalScores(scores) {
  localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(scores));
}

export function getLocalGameHistory() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_GAME_HISTORY_KEY) || "[]");
  } catch (e) {
    console.error("Error al leer historial de juegos:", e);
    return [];
  }
}

export function saveLocalGameHistory(history) {
  localStorage.setItem(LOCAL_GAME_HISTORY_KEY, JSON.stringify(history));
}

export function closePremiumModal() {
  const modal = document.getElementById("premium-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
}

export async function loadUserScores(userEmail) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/scores/${userEmail}`);
    if (response.ok) {
      const scores = await response.json();
      localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(scores));
    }
  } catch (error) {
    console.warn("API no disponible, usando puntuaciones locales:", error);
  }
}

export async function saveUserScores(userEmail, decade, category, score) {
  if (window.useLocalApiFallback) {
    const localScores = getLocalScores();
    localScores[userEmail] = localScores[userEmail] || {};
    localScores[userEmail][decade] = localScores[userEmail][decade] || {};
    localScores[userEmail][decade][category] = score;
    saveLocalScores(localScores);
    await loadUserScores(userEmail);
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userEmail, decade, category, score }),
    });

    const data = await parseJsonResponse(response);

    if (response.ok) {
      console.log(data.message);
      await loadUserScores(userEmail);
    } else if (response.status === 404 || response.status >= 500) {
      window.useLocalApiFallback = true;
      await saveUserScores(userEmail, decade, category, score);
    } else {
      console.error("Error al guardar puntuación:", data?.message);
    }
  } catch (error) {
    console.warn("API no disponible, usando puntuaciones locales:", error);
    window.useLocalApiFallback = true;
    await saveUserScores(userEmail, decade, category, score);
  }
}

export async function setPlayerName() {
  const playerNameInput = document.getElementById("player-name-input");
  const newPlayerName = playerNameInput.value.trim();

  if (!newPlayerName) {
    showAppAlert("Por favor, introduce un nombre de jugador.");
    return;
  }

  if (window.currentUser) {
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/users/${window.currentUser.email}/playername`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: newPlayerName }),
      });

      const data = await parseJsonResponse(response);

      if (response.ok) {
        window.currentUser.playerName = newPlayerName;
        localStorage.setItem("userData", JSON.stringify(window.currentUser));
        localStorage.setItem("sessionActive", "true");
        showAppAlert(data?.message || "Nombre de jugador actualizado.");
        playerNameInput.value = "";
        showScreen("decade-selection-screen");
        generateDecadeButtons();
        return;
      }

      if (response.status === 404 || response.status >= 500) {
        window.useLocalApiFallback = true;
      } else {
        showAppAlert(`Error al actualizar nombre: ${data?.message || "No se pudo actualizar el nombre."}`);
        return;
      }
    } catch (error) {
      console.warn("API no disponible, usando actualización local:", error);
      window.useLocalApiFallback = true;
    }

    if (window.useLocalApiFallback) {
      const users = getLocalUsers();
      if (users[window.currentUser.email]) {
        users[window.currentUser.email].playerName = newPlayerName;
        saveLocalUsers(users);
      }
      window.currentUser.playerName = newPlayerName;
      localStorage.setItem("userData", JSON.stringify(window.currentUser));
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
