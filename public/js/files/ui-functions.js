import { DECADES_ORDER } from "../constants/app-constants.js";
import { startSummerSongsGame } from "../files/gameplay-functions.js";
import { getDecadeLabel } from "./app-info-functions.js";
import { hasPremiumAccess, showPremiumModal } from "./premium-functions.js";

export function updatePremiumButtonsState() {
  const summerButton = document.getElementById("summer-songs-btn");
  if (!summerButton) return;

  if (hasPremiumAccess()) {
    summerButton.classList.remove("locked");
  } else {
    summerButton.classList.add("locked");
  }
}

export function generateCategoryButtons() {
  const container = document.getElementById("category-buttons");
  container.innerHTML = "";

  const key = gameState.selectedDecade;

  // --- 1. Título dinámico ---
  const titleEl = document.getElementById("category-screen-title");
  if (titleEl) {
    titleEl.innerHTML =
      key === "especiales"
        ? "Selecciona una Edición Especial"
        : `Elige una Categoría (<span id="selected-decade-display">${getDecadeLabel(key)}</span>)`;
  }

  // --- 2. CASO ESPECIAL: VERANO (Mantenido igual) ---
  if (key === "especiales") {
    const btnVerano = document.createElement("button");
    btnVerano.className = "category-btn";
    btnVerano.innerText = "☀️ Canciones del Verano";

    if (!hasPremiumAccess()) {
      btnVerano.classList.add("locked");
      btnVerano.onclick = () => showPremiumModal("El modo Verano es contenido Premium.");
    } else {
      btnVerano.onclick = () => startSummerSongsGame();
    }
    container.appendChild(btnVerano);

    const infoDiv = document.createElement("div");
    infoDiv.style.marginTop = "30px";
    infoDiv.style.padding = "20px";
    infoDiv.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
    infoDiv.style.borderRadius = "12px";
    infoDiv.style.border = "1px dashed var(--secondary-color)";
    infoDiv.style.textAlign = "center";
    infoDiv.innerHTML = `
            <p style="color: var(--light-text-color); margin-bottom: 10px; font-size: 0.95rem;">
                🚀 <strong>Próximamente más categorías</strong>
            </p>
            <p style="font-size: 0.85rem; color: #ccc; line-height: 1.5;">
                Estamos trabajando en nuevas ediciones especiales.
            </p>
        `;
    container.appendChild(infoDiv);

    const backBtnEsp = document.createElement("button");
    backBtnEsp.className = "btn secondary";
    backBtnEsp.style.marginTop = "20px";
    backBtnEsp.innerText = "Volver";
    backBtnEsp.onclick = () => showScreen("decade-selection-screen");
    container.appendChild(backBtnEsp);
    return;
  }

  // --- 3. CASO ESPECIAL: TODAS LAS DÉCADAS (Mantenido igual) ---
  if (key === "Todas") {
    const catsToRender =
      typeof window.allPossibleCategories !== "undefined" ? window.allPossibleCategories : CATEGORY_ORDER;

    catsToRender.forEach((categoryId) => {
      const button = document.createElement("button");
      button.className = "category-btn";

      if (isPremiumCategory(categoryId) && !hasCategoryAccess(categoryId)) {
        button.innerText = getCategoryLabel(categoryId);
        button.classList.add("locked");
        button.onclick = () =>
          showPremiumModal(`¿Quieres desbloquear <strong>${getCategoryLabel(categoryId)}</strong>?`, categoryId);
      } else {
        button.innerText = getCategoryLabel(categoryId);
        button.onclick = () => selectCategory(categoryId);
      }
      container.appendChild(button);
    });

    const backBtn = document.createElement("button");
    backBtn.className = "btn secondary";
    backBtn.style.marginTop = "20px";
    backBtn.innerText = "Volver a Décadas";
    backBtn.onclick = () => showScreen("decade-selection-screen");
    container.appendChild(backBtn);
    return;
  }

  // --- 4. DÉCADAS NORMALES (Optimizado v.60) ---
  const internalKey = key.toLowerCase() === "actual" ? "actual" : key;

  // AQUÍ ESTÁ LA MAGIA: Leemos la whitelist en lugar de hacer 'ifs' manuales
  const allowedCategories = window.VALID_CATEGORIES_PER_DECADE ? window.VALID_CATEGORIES_PER_DECADE[internalKey] : [];

  // Mapeo seguro de datos
  if (typeof window.allSongsByDecadeAndCategory !== "undefined") {
    let dataFound = window.allSongsByDecadeAndCategory[internalKey];
    if (dataFound) configuracionCanciones[key] = dataFound;
  }

  const currentDecadeSongs = configuracionCanciones[key] || {};

  const catsToRender =
    typeof window.allPossibleCategories !== "undefined" ? window.allPossibleCategories : CATEGORY_ORDER;

  catsToRender.forEach((categoryId) => {
    const button = document.createElement("button");
    button.className = "category-btn";

    // VERIFICACIÓN: ¿Está permitido en la whitelist?
    const isAvailable = allowedCategories.includes(categoryId);

    if (!isAvailable) {
      // Lógica para categorías que NO existen en esta década (ej: Series en Actual)
      button.innerHTML = `${getCategoryLabel(categoryId)} <br><span style="font-size:0.7em; opacity:0.8; font-weight:normal;">(Próximamente)</span>`;
      button.classList.add("secondary");
      button.style.opacity = "0.6";
      button.style.cursor = "not-allowed";
      button.onclick = () => showAppAlert(`🚧 Estamos trabajando en ${getCategoryLabel(categoryId)} para esta década.`);
    } else {
      // Lógica para categorías que SÍ existen (Español, Inglés, etc.)
      const songsArray = currentDecadeSongs[categoryId];
      const hasSongs = Array.isArray(songsArray) && songsArray.length >= 4;

      if (isPremiumCategory(categoryId) && !hasCategoryAccess(categoryId)) {
        // Caso Premium Bloqueado
        button.innerText = getCategoryLabel(categoryId);
        button.classList.add("locked");
        button.onclick = () =>
          showPremiumModal(
            `¿Quieres desbloquear <strong>${getCategoryLabel(categoryId)}</strong> en todas las décadas?`,
            categoryId,
          );
      } else if (!hasSongs) {
        // Caso Error de carga o vacío
        button.innerHTML = `${getCategoryLabel(categoryId)} <br><span style="font-size:0.7em; opacity:0.8; font-weight:normal;">(Mantenimiento)</span>`;
        button.classList.add("secondary");
        button.onclick = () => showAppAlert("Estamos actualizando esta categoría. Inténtalo más tarde.");
      } else {
        // Caso OK
        button.innerText = getCategoryLabel(categoryId);
        button.onclick = () => selectCategory(categoryId);
      }
    }

    container.appendChild(button);
  });

  const backBtn = document.createElement("button");
  backBtn.className = "btn secondary";
  backBtn.style.marginTop = "20px";
  backBtn.innerText = "Volver a Décadas";
  backBtn.onclick = () => showScreen("decade-selection-screen");
  container.appendChild(backBtn);
}

export async function generateDecadeButtons() {
  const container = document.getElementById("decade-buttons");
  container.innerHTML = "";

  DECADES_ORDER.forEach((decadeId) => {
    const button = document.createElement("button");
    button.className = "category-btn";

    if (decadeId === "especiales") {
      button.className = "category-btn tertiary";
      button.style.border = "2px solid gold";
    }

    button.innerText = getDecadeLabel(decadeId);
    button.onclick = () => selectDecade(decadeId);
    container.appendChild(button);
  });

  const allButton = document.createElement("button");
  allButton.className = "category-btn tertiary";
  allButton.innerText = getDecadeLabel("Todas");
  allButton.onclick = () => selectDecade("Todas");

  if (hasPremiumAccess()) {
    allButton.classList.remove("locked");
  } else {
    allButton.classList.add("locked");
  }

  container.appendChild(allButton);
}

export function populateOnlineSelectors() {
  const decadeSelect = document.getElementById("online-decade-select");
  const categorySelect = document.getElementById("online-category-select");

  popu(decadeSelect, getDe());
  populateCategoryOptions(categorySelect, getCategoriesForSelect());
}

export function populateInviteSelectors() {
  const decadeSelect = document.getElementById("invite-decade-select");
  const categorySelect = document.getElementById("invite-category-select");

  populateDecadeOptions(decadeSelect, getDecadesForSelect());
  populateCategoryOptions(categorySelect, getCategoriesForSelect());
}
