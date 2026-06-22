import { showAppAlert } from "./modal-functions.js";
import { syncUserPermissions } from "./app-init-functions.js";

// Variables globales accedidas desde window (definidas en constants.js)
// API_BASE_URL, CANONICAL_PROD_ORIGIN

/**
 * Configura los listeners para pagos y eventos.
 */
export function setupPaymentListeners() {
  // Verificamos si venimos de un pago exitoso de Stripe
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get("session_id");

  if (sessionId) {
    syncUserPermissions();
    // Limpiamos la URL para no re-procesar el éxito al recargar
    window.history.replaceState({}, document.title, window.location.pathname);
    showAppAlert("¡Gracias por tu compra! Tu contenido se está desbloqueando.");
  }
}

/**
 * Redirige al usuario a Stripe para el proceso de pago.
 * @param {string} product - Identificador del producto a comprar.
 */
export async function redirectToStripe(product) {
  if (!window.currentUser || !window.currentUser.email) {
    showAppAlert("Debes iniciar sesión para comprar contenido premium.");
    return;
  }

  try {
    const API_BASE_URL =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? window.location.origin
        : window.CANONICAL_PROD_ORIGIN;

    const response = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: window.currentUser.email,
        product: product,
      }),
    });

    if (!response.ok) {
      throw new Error("Error al crear sesión de pago");
    }

    const { url } = await response.json();

    if (url) {
      window.location.href = url;
    } else {
      throw new Error("No se recibió URL de pago");
    }
  } catch (error) {
    console.error("Error al redirigir a Stripe:", error);
    showAppAlert("Error al iniciar el proceso de pago. Por favor, intenta de nuevo.");
  }
}

/**
 * Valida el estado de un pago después de retornar de Stripe.
 * @param {string} sessionId - ID de la sesión de pago.
 * @returns {Promise<Object|null>} Datos del pago o null si hay error.
 */
export async function validatePaymentStatus(sessionId) {
  if (!sessionId) return null;

  try {
    const API_BASE_URL =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? window.location.origin
        : window.CANONICAL_PROD_ORIGIN;

    const response = await fetch(`${API_BASE_URL}/api/validate-payment?session_id=${sessionId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error al validar estado del pago:", error);
    return null;
  }
}

/**
 * Maneja el retorno de un pago exitoso.
 * @param {string} sessionId - ID de la sesión de pago.
 */
export async function handlePaymentReturn(sessionId) {
  if (!sessionId) return;

  try {
    const paymentData = await validatePaymentStatus(sessionId);

    if (paymentData && paymentData.status === "completed") {
      await syncUserPermissions();
      showAppAlert("¡Pago completado! Tu contenido premium ha sido desbloqueado.");
    } else {
      showAppAlert("Hay un problema con tu pago. Contacta con soporte.");
    }
  } catch (error) {
    console.error("Error al manejar retorno de pago:", error);
    showAppAlert("Error al procesar tu pago. Por favor, contacta con soporte.");
  }

  // Limpiar URL
  window.history.replaceState({}, document.title, window.location.pathname);
}

/**
 * Verifica si el usuario tiene acceso a un producto específico.
 * @param {string} product - Identificador del producto.
 * @returns {boolean} True si el usuario tiene acceso.
 */
export function hasProductAccess(product) {
  if (!window.currentUser || !window.currentUser.permissions) {
    return false;
  }

  const permissions = window.currentUser.permissions;

  // Acceso completo
  if (permissions.includes("full_access")) {
    return true;
  }

  // Acceso a producto específico
  if (permissions.includes(product)) {
    return true;
  }

  return false;
}

/**
 * Obtiene la lista de productos disponibles.
 * @returns {Array} Lista de productos disponibles.
 */
export function getAvailableProducts() {
  return [
    { id: "full_pack", name: "Pack Completo", price: 9.99, description: "Acceso a todo el contenido premium" },
    { id: "80s", name: "Años 80", price: 2.99, description: "Todas las canciones de los 80s" },
    { id: "90s", name: "Años 90", price: 2.99, description: "Todas las canciones de los 90s" },
    { id: "00s", name: "Años 2000", price: 2.99, description: "Todas las canciones de los 2000" },
    { id: "10s", name: "Años 2010", price: 2.99, description: "Todas las canciones de los 2010" },
    { id: "actual", name: "Actualidad", price: 2.99, description: "Canciones de actualidad" },
    { id: "verano", name: "Canciones del Verano", price: 1.99, description: "Pack especial de verano" },
  ];
}

/**
 * Formatea el precio de un producto para mostrar.
 * @param {number} price - Precio del producto.
 * @returns {string} Precio formateado con símbolo de euro.
 */
export function formatProductPrice(price) {
  return `${price.toFixed(2)}€`;
}
