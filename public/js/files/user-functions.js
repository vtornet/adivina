import { ADMIN_EMAIL, PERMISSIONS_STORAGE_KEY } from "../../constants/constants";
import { currentUser } from "../main";

function getCurrentUserData() {
  const userDataString = localStorage.getItem("userData");
  if (!userDataString) return null;
  return JSON.parse(userDataString);
}

function getUserPermissions(email) {
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

function getActivePermissions() {
  // Si no hay usuario, no hay permisos
  if (!currentUser || !currentUser.email) return [];

  let localSections = [];
  let memorySections = [];

  // 1. Memoria (RAM) - Lo más inmediato
  if (currentUser.unlocked_sections && Array.isArray(currentUser.unlocked_sections)) {
    memorySections = currentUser.unlocked_sections;
  }

  // 2. Disco (LocalStorage) - La persistencia
  try {
    const storedPermsJSON = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
    if (storedPermsJSON) {
      const parsed = JSON.parse(storedPermsJSON);
      if (parsed[currentUser.email] && Array.isArray(parsed[currentUser.email].unlocked_sections)) {
        localSections = parsed[currentUser.email].unlocked_sections;
      }
    }
  } catch (e) {
    console.error("Error leyendo permisos locales:", e);
  }

  // 3. Fusión
  const combined = [...new Set([...localSections, ...memorySections])];

  // 4. Lógica Admin / Premium All
  if (combined.includes("premium_all") || currentUser.email === ADMIN_EMAIL) {
    return ["premium_all", ...combined];
  }

  return combined;
}

function getLocalUsers() {
  return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "{}");
}

function saveLocalUsers(users) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function getLocalScores() {
  return JSON.parse(localStorage.getItem(LOCAL_SCORES_KEY) || "{}");
}

function saveLocalScores(scores) {
  localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(scores));
}

function getLocalGameHistory() {
  return JSON.parse(localStorage.getItem(LOCAL_GAME_HISTORY_KEY) || "{}");
}

function saveLocalGameHistory(history) {
  localStorage.setItem(LOCAL_GAME_HISTORY_KEY, JSON.stringify(history));
}

async function redirectToStripe(categoryKey) {
  if (!currentUser || !currentUser.email) {
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
        email: currentUser.email,
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

function closePremiumModal() {
  const modal = document.getElementById("premium-modal");
  if (modal) modal.classList.add("hidden");
}

module.exports = {
  getCurrentUserData,
  getUserPermissions,
  getActivePermissions,
  getLocalUsers,
  saveLocalUsers,
  getLocalScores,
  saveLocalScores,
  getLocalGameHistory,
  saveLocalGameHistory,
  redirectToStripe
};
