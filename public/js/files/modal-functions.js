export function showAppAlert(message, options = {}) {
  return showAppModal({
    title: options.title || "Aviso",
    message,
    confirmText: options.confirmText || "Aceptar",
    showCancel: false,
  });
}

export function showAppConfirm(message, options = {}) {
  return showAppModal({
    title: options.title || "Confirmación",
    message,
    confirmText: options.confirmText || "Aceptar",
    cancelText: options.cancelText || "Cancelar",
    showCancel: true,
  });
}

export function showInstructions() {
  const modal = document.getElementById("instructions-modal");
  closeHamburgerMenu();
  if (modal) modal.classList.remove("hidden");
}

export function closeInstructions() {
  const modal = document.getElementById("instructions-modal");
  if (modal) modal.classList.add("hidden");
}

let appModalResolver = null;

export function showAppModal({ title, message, confirmText = "Aceptar", cancelText = "Cancelar", showCancel = false } = {}) {
  const modal = document.getElementById("app-modal");
  const titleEl = document.getElementById("app-modal-title");
  const messageEl = document.getElementById("app-modal-message");
  const confirmBtn = document.getElementById("app-modal-confirm");
  const cancelBtn = document.getElementById("app-modal-cancel");

  if (!modal || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
    if (showCancel) {
      return Promise.resolve(window.confirm(message || ""));
    }
    window.alert(message || "");
    return Promise.resolve(true);
  }

  titleEl.textContent = title || "Aviso";
  messageEl.textContent = message || "";
  confirmBtn.textContent = confirmText;
  cancelBtn.textContent = cancelText;
  cancelBtn.style.display = showCancel ? "inline-flex" : "none";

  modal.classList.remove("hidden");

  return new Promise((resolve) => {
    appModalResolver = resolve;
    confirmBtn.onclick = () => {
      modal.classList.add("hidden");
      appModalResolver?.(true);
      appModalResolver = null;
    };
    cancelBtn.onclick = () => {
      modal.classList.add("hidden");
      appModalResolver?.(false);
      appModalResolver = null;
    };
  });
}

export function openPasswordResetModal() {
  closeHamburgerMenu();
  const modal = document.getElementById("password-reset-modal");
  if (modal) modal.classList.remove("hidden");
}

export function closePasswordResetModal() {
  const modal = document.getElementById("password-reset-modal");
  if (modal) modal.classList.add("hidden");
  const tokenInfo = document.getElementById("password-reset-token-info");
  if (tokenInfo) tokenInfo.textContent = "";
  [
    "password-reset-email",
    "password-reset-token",
    "password-reset-new-password",
    "password-reset-confirm-password",
  ].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.value = "";
  });
}

export function showChangePasswordModal() {
  closeHamburgerMenu();
  const modal = document.getElementById("password-change-modal");
  if (modal) modal.classList.remove("hidden");
}

export function closeChangePasswordModal() {
  const modal = document.getElementById("password-change-modal");
  if (modal) modal.classList.add("hidden");
  ["password-change-current", "password-change-new", "password-change-confirm"].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.value = "";
  });
}
