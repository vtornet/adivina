import { closeHamburgerMenu } from "./burger-functions.js";

let _pickerFieldId = null;
let _pickerBtnId = null;

export function openSelectPicker(fieldId, btnId, title, options) {
  _pickerFieldId = fieldId;
  _pickerBtnId = btnId;

  document.getElementById("select-picker-title").textContent = title;
  const container = document.getElementById("select-picker-options");
  container.innerHTML = "";

  const currentValue = document.getElementById(fieldId)?.value;

  options.forEach(({ value, label }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "select-picker-option" + (value === currentValue ? " active" : "");
    btn.textContent = label;
    btn.onclick = () => {
      document.getElementById(_pickerFieldId).value = value;
      const displayBtn = document.getElementById(_pickerBtnId);
      if (displayBtn) displayBtn.textContent = label + " ▾";
      closeSelectPicker();
    };
    container.appendChild(btn);
  });

  document.getElementById("select-picker-modal").classList.remove("hidden");
}

export function closeSelectPicker() {
  document.getElementById("select-picker-modal")?.classList.add("hidden");
}

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

export function showAppModal({
  title,
  message,
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  showCancel = false,
} = {}) {
  const modal = document.getElementById("app-modal");
  const titleEl = document.getElementById("app-modal-title");
  const messageEl = document.getElementById("app-modal-message");
  const confirmBtn = document.getElementById("app-modal-confirm");
  const cancelBtn = document.getElementById("app-modal-cancel");

  if (!modal || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
    if (showCancel) {
      return Promise.resolve(globalThis.confirm(message || ""));
    }
    globalThis.alert(message || "");
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

export function showPrivacyPolicy() {
  closeHamburgerMenu();
  document.getElementById("privacy-policy-modal")?.classList.remove("hidden");
}

export function closePrivacyPolicy() {
  document.getElementById("privacy-policy-modal")?.classList.add("hidden");
}

export function showTermsOfService() {
  closeHamburgerMenu();
  document.getElementById("terms-modal")?.classList.remove("hidden");
}

export function closeTermsOfService() {
  document.getElementById("terms-modal")?.classList.add("hidden");
}

export function showCookiePolicy() {
  closeHamburgerMenu();
  document.getElementById("cookie-policy-modal")?.classList.remove("hidden");
}

export function closeCookiePolicy() {
  document.getElementById("cookie-policy-modal")?.classList.add("hidden");
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
