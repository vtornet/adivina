import { ADMIN_EMAIL, PERMISSIONS_STORAGE_KEY, LOCAL_USERS_KEY, LOCAL_SCORES_KEY, LOCAL_GAME_HISTORY_KEY } from "../constants/app-constants.js";
import { parseJsonResponse } from "./helpers.js";

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
      if (parsed[window.currentUser.email] && Array.isArray(parsed[window.currentUser.email].unlocked_sections)) {
        localSections = parsed[window.currentUser.email].unlocked_sections;
      }
    }
  } catch (e) {
    console.error("Error leyendo permisos locales:", e);
  }

  // 3. Fusión
  const combined = [...new Set([...localSections, ...memorySections])];

  // 4. Lógica Admin / Premium All
  if (combined.includes("premium_all") || window.currentUser.email === ADMIN_EMAIL) {
    return ["premium_all", ...combined];
  }

  return combined;
}

export function getLocalUsers() {
  return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "{}");
}

export function saveLocalUsers(users) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

export function getLocalScores() {
  return JSON.parse(localStorage.getItem(LOCAL_SCORES_KEY) || "{}");
}

export function saveLocalScores(scores) {
  localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(scores));
}

export function getLocalGameHistory() {
  return JSON.parse(localStorage.getItem(LOCAL_GAME_HISTORY_KEY) || "{}");
}

export function saveLocalGameHistory(history) {
  localStorage.setItem(LOCAL_GAME_HISTORY_KEY, JSON.stringify(history));
}

export async function redirectToStripe(categoryKey) {
  if (!window.currentUser || !window.currentUser.email) {
    showAppAlert("Debes iniciar sesión para realizar compras.");
    return;
  }

  const priceMap = {
    espanol: "price_AQUI",
    ingles: "price_AQUI",
    peliculas: "price_1Stw76AzxZ5jYRrVcSP4iFVS",
    series: "price_AQUI",
    tv: "price_AQUI",
    infantiles: "price_AQUI",
    anuncios: "price_AQUI",
    full_pack: "price_1SuACIAzxZ5jYRrVNKmtD0KN",
  };

  const priceId = priceMap[categoryKey];

  if (!priceId || priceId === "price_AQUI") {
    console.error(`Falta configuración de precio para: ${categoryKey}`);
    showAppAlert("Esta categoría aún no está disponible para compra.");
    return;
  }

  const permissionKeyToSave = categoryKey === "full_pack" ? "premium_all" : categoryKey;

  try {
    const response = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: window.currentUser.email,
        categoryKey: permissionKeyToSave,
        priceId: priceId,
        returnUrl: window.location.origin,
      }),
    });

    const session = await response.json();

    if (response.ok && session.id) {
      // v.66: Preparado para producción.
      // Cuando tengas la clave REAL, cambia 'pk_test_...' por 'pk_live_...'
      const stripeKey =
        "pk_test_51StvbzAzxZ5jYRrVht2VaE3PAIbqyJSDq2Ym9XPyohsv5gKjkGRBQ5OsvRR9EE3wTNvbDVQweNfIb8Z7Bc3byFXy00QVZ0iVkD";
      const stripe = Stripe(stripeKey);
      await stripe.redirectToCheckout({ sessionId: session.id });
    } else {
      throw new Error(session.error || "Error al crear sesión de pago.");
    }
  } catch (err) {
    console.error("Error Stripe:", err);
    showAppAlert("No se pudo iniciar el proceso de pago.");
  }
}

export function closePremiumModal() {
  const modal = document.getElementById("premium-modal");
  if (modal) modal.classList.add("hidden");
}

export async function loadUserScores(userEmail) {
  if (useLocalApiFallback) {
    const localScores = getLocalScores();
    userAccumulatedScores[userEmail] = localScores[userEmail] || {};
    console.log(`Puntuaciones locales de ${userEmail} cargadas:`, userAccumulatedScores[userEmail]);
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/scores/${userEmail}`);
    const data = await parseJsonResponse(response);

    if (response.ok) {
      const scoresByDecade = {};
      data.forEach((item) => {
        if (!scoresByDecade[item.decade]) {
          scoresByDecade[item.decade] = {};
        }
        scoresByDecade[item.decade][item.category] = item.score;
      });
      userAccumulatedScores[userEmail] = scoresByDecade;
      console.log(`Puntuaciones de ${userEmail} cargadas:`, userAccumulatedScores[userEmail]);
    } else if (response.status === 404 || response.status >= 500) {
      useLocalApiFallback = true;
      const localScores = getLocalScores();
      userAccumulatedScores[userEmail] = localScores[userEmail] || {};
    } else {
      console.error("Error al cargar puntuaciones:", data?.message);
      userAccumulatedScores[userEmail] = {};
    }
  } catch (error) {
    console.warn("API no disponible, usando puntuaciones locales:", error);
    useLocalApiFallback = true;
    const localScores = getLocalScores();
    userAccumulatedScores[userEmail] = localScores[userEmail] || {};
  }
}

export async function saveUserScores(userEmail, decade, category, score) {
  if (!userEmail || !decade || !category || typeof score === "undefined") {
    console.error("Error: Datos incompletos para guardar puntuación acumulada (email, decade, category, score).");
    return;
  }

  if (useLocalApiFallback) {
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
      useLocalApiFallback = true;
      await saveUserScores(userEmail, decade, category, score);
    } else {
      console.error("Error al guardar puntuación:", data?.message);
    }
  } catch (error) {
    console.warn("API no disponible, usando puntuaciones locales:", error);
    useLocalApiFallback = true;
    await saveUserScores(userEmail, decade, category, score);
  }
}
