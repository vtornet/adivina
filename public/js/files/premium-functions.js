// --- FUNCIONES AUXILIARES (HELPER FUNCTIONS) ---
// Necesarias para validar el acceso premium gestionado por Stripe

import appInfo from "../../app_info/app-info.js";

export function isPremiumCategory(categoryId) {
  return appInfo.premium.premiumCategories.has(categoryId);
}

export function isPremiumDecade(decadeId) {
  return appInfo.premium.premiumDecades.has(decadeId);
}

export function hasCategoryAccess(categoryId) {
  // Verifica si el usuario tiene comprada esta categoría específica o el paquete completo
  const permissions = getActivePermissions();
  return permissions.includes("premium_all") || permissions.includes(categoryId);
}

export function hasPremiumAccess() {
  // Verifica si el usuario tiene el paquete completo (necesario para modos como 'Todas' o 'Verano')
  const permissions = getActivePermissions();
  return permissions.includes("premium_all");
}

export function isPremiumSelection(decade, category) {
  return isPremiumDecade(decade) || isPremiumCategory(category);
}

/**
 * Redirige al usuario a la pasarela de pago de Stripe.
 * @param {string} categoryKey - La clave de la categoría a comprar (ej: 'peliculas', 'full_pack')
 */

export function showPremiumModal(message, categoryKey) {
  const modal = document.getElementById("premium-modal");
  const text = document.getElementById("premium-modal-message");
  let buyBtn = document.getElementById("premium-buy-btn");

  if (!modal || !text) return;

  text.innerHTML = message || "Desbloquea contenido Premium.";

  if (!buyBtn) {
    buyBtn = document.createElement("button");
    buyBtn.id = "premium-buy-btn";
    buyBtn.className = "btn";
    buyBtn.style.marginTop = "15px";
    buyBtn.style.background = "linear-gradient(45deg, #6772E5, #5469D4)";
    modal.querySelector(".modal-content").insertBefore(buyBtn, modal.querySelector(".secondary"));
  }

  buyBtn.innerText = categoryKey ? `🔓 Desbloquear ${categoryKey.toUpperCase()}` : "🔓 Desbloquear TODO";
  buyBtn.onclick = () => redirectToStripe(categoryKey || "full_pack");

  modal.classList.remove("hidden");
}
