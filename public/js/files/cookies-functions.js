/**
 * Comprueba si el usuario ha aceptado el consentimiento de cookies.
 * Muestra el banner si no ha aceptado.
 */
export function checkCookieConsent() {
  // Comprobamos si ya aceptó el trato
  const consent = localStorage.getItem("cookieConsent");
  if (!consent) {
    const banner = document.getElementById("cookie-consent-banner");
    if (banner) {
      // Pequeño retraso para que la animación luzca al cargar la web
      setTimeout(() => {
        banner.classList.remove("hidden");
      }, 1500);
    }
  }
}

/**
 * Guarda el consentimiento de cookies y oculta el banner.
 */
export function acceptCookieConsent() {
  // Guardamos que ha aceptado
  localStorage.setItem("cookieConsent", "true");
  const banner = document.getElementById("cookie-consent-banner");
  if (banner) {
    // Efecto de salida (opcional, simplemente ocultamos)
    banner.style.opacity = "0";
    banner.style.transform = "translate(-50%, 50px)";
    setTimeout(() => banner.classList.add("hidden"), 300);
  }
}
