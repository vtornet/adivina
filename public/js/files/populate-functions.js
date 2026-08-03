import { getDecadeLabel, getCategoryLabel } from "./app-info-functions.js";

export function populateDecadeOptions(btnId, hiddenId, decades) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const options = decades.map((dec) => ({ value: dec, label: getDecadeLabel(dec) }));
  if (options.length > 0) {
    document.getElementById(hiddenId).value = options[0].value;
    btn.textContent = options[0].label + " ▾";
  }
  btn.onclick = () => globalThis.openSelectPicker(hiddenId, btnId, "Selecciona Década", options);
}

export function populateCategoryOptions(btnId, hiddenId, categories) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const options = categories.map((cat) => ({ value: cat, label: getCategoryLabel(cat) }));
  if (options.length > 0) {
    document.getElementById(hiddenId).value = options[0].value;
    btn.textContent = options[0].label + " ▾";
  }
  btn.onclick = () => globalThis.openSelectPicker(hiddenId, btnId, "Selecciona Categoría", options);
}
