// --- FUNCIONES AUXILIARES (HELPER FUNCTIONS) ---
// Necesarias para validar el acceso premium gestionado por Stripe

function isPremiumCategory(categoryId) {
  return PREMIUM_CATEGORIES.has(categoryId);
}

function isPremiumDecade(decadeId) {
  return PREMIUM_DECADES.has(decadeId);
}

function hasCategoryAccess(categoryId) {
  // Verifica si el usuario tiene comprada esta categoría específica o el paquete completo
  const permissions = getActivePermissions();
  return permissions.includes("premium_all") || permissions.includes(categoryId);
}

function hasPremiumAccess() {
  // Verifica si el usuario tiene el paquete completo (necesario para modos como 'Todas' o 'Verano')
  const permissions = getActivePermissions();
  return permissions.includes("premium_all");
}

function isPremiumSelection(decade, category) {
  return isPremiumDecade(decade) || isPremiumCategory(category);
}

module.exports = {
  isPremiumCategory,
  isPremiumDecade,
  hasCategoryAccess,
  hasPremiumAccess,
  isPremiumSelection,
};
