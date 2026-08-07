import { logger } from "./logger.js";
import { showAppAlert } from "./modal-functions.js";

export function showContactModal() {
  const modal = document.getElementById("contact-modal");
  if (!modal) return;

  const emailInput = document.getElementById("contact-email");
  if (emailInput && globalThis.currentUser?.email) {
    emailInput.value = globalThis.currentUser.email;
  }

  document.getElementById("contact-message").value = "";
  document.getElementById("contact-reason").selectedIndex = 0;

  modal.classList.remove("hidden");
}

export function closeContactModal() {
  document.getElementById("contact-modal")?.classList.add("hidden");
}

export async function sendContactForm() {
  const reason = document.getElementById("contact-reason").value;
  const email = document.getElementById("contact-email").value.trim();
  const message = document.getElementById("contact-message").value.trim();

  if (!message) {
    showAppAlert("Por favor, escribe un mensaje antes de enviar.");
    return;
  }

  const sendBtn = document.querySelector("#contact-modal .btn:not(.secondary)");
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = "Enviando..."; }

  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, email, message }),
    });

    const data = await response.json();

    if (response.ok) {
      closeContactModal();
      showAppAlert(data.message);
    } else {
      showAppAlert(data.message || "Error al enviar el mensaje.");
    }
  } catch (err) {
    logger.error("Error al enviar formulario de contacto", err);
    showAppAlert("Error de conexión. Inténtalo de nuevo.");
  } finally {
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = "Enviar"; }
  }
}
