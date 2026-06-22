import { showAppAlert } from "./modal-functions.js";
import { openPasswordResetModal } from "./modal-functions.js";

/**
 * Alterna la visibilidad de un campo de contraseña entre texto y password.
 * @param {string} inputId - El ID del input de contraseña.
 * @param {HTMLElement} button - El botón que activa/desactiva la visibilidad.
 */
export function togglePasswordVisibility(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  button.textContent = isPassword ? "🙈" : "👁️";
  button.setAttribute("aria-pressed", String(isPassword));
}

/**
 * Muestra el modal de recuperación de contraseña.
 */
export function showPasswordRecoveryInfo() {
  openPasswordResetModal();
}
