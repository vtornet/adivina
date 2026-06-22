import { showAppAlert } from "./modal-functions.js";
import { showScreen } from "./screen-functions.js";
import { getDecadeLabel, getCategoryLabel } from "./app-info-functions.js";
import { DECADES_WITH_SPECIALS, CATEGORY_ORDER } from "../constants/app-constants.js";
import { hasPremiumAccess, showPremiumModal, isPremiumCategory, isPremiumSelection } from "./premium-functions.js";

/**
 * Parsea el texto de visualización de una canción.
 * @param {string} displayText - Texto en formato "Artista - Título".
 * @returns {Object} Objeto con artist y title.
 */
export function parseDisplay(displayText) {
  const parts = displayText.split(" - ");
  if (parts.length < 2) {
    return { artist: displayText, title: "" };
  }
  return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
}

/**
 * Muestra la pantalla para seleccionar una categoría y década para ver el listado de canciones.
 */
export async function showSongsListCategorySelection() {
  showScreen("songs-list-category-screen");
  const container = document.getElementById("songs-list-category-buttons");
  container.innerHTML = "";

  const decadesToLoad = DECADES_WITH_SPECIALS.filter((decadeId) => decadeId !== "Todas" && decadeId !== "verano");
  const loadPromises = decadesToLoad.flatMap((decadeId) =>
    CATEGORY_ORDER.map((categoryId) =>
      window.loadSongsForDecadeAndCategory(decadeId, categoryId).catch((error) => {
        console.warn(`No se pudo cargar la categoría ${categoryId} para la década ${decadeId}.`, error);
        return null;
      }),
    ),
  );

  await Promise.allSettled(loadPromises);

  DECADES_WITH_SPECIALS.forEach((decadeId) => {
    if (decadeId === "Todas" || decadeId === "verano") {
      const allButtonDiv = document.createElement("div");
      allButtonDiv.style.gridColumn = "1 / -1";
      allButtonDiv.style.marginTop = "20px";
      const allButton = document.createElement("button");
      allButton.className = "category-btn tertiary";
      allButton.innerText = getDecadeLabel(decadeId);
      allButton.onclick = () => displaySongsForCategory(decadeId, "consolidated");
      if (!hasPremiumAccess()) {
        allButton.classList.add("locked");
      }
      allButtonDiv.appendChild(allButton);
      container.appendChild(allButtonDiv);
      return;
    }

    const decadeCategorySongs = window.configuracionCanciones[decadeId];
    if (decadeCategorySongs) {
      const decadeHeader = document.createElement("h3");
      decadeHeader.textContent = getDecadeLabel(decadeId);
      decadeHeader.style.color = "var(--secondary-color)";
      decadeHeader.style.marginTop = "20px";
      decadeHeader.style.marginBottom = "10px";
      container.appendChild(decadeHeader);

      const categoryButtonsForDecadeDiv = document.createElement("div");
      categoryButtonsForDecadeDiv.style.display = "grid";
      categoryButtonsForDecadeDiv.style.gridTemplateColumns = "1fr 1fr";
      categoryButtonsForDecadeDiv.style.gap = "10px";
      container.appendChild(categoryButtonsForDecadeDiv);

      CATEGORY_ORDER.forEach((categoryId) => {
        const songsArray = decadeCategorySongs[categoryId];
        if (Array.isArray(songsArray) && songsArray.length > 0) {
          const button = document.createElement("button");
          button.className = "category-btn";
          button.innerText = getCategoryLabel(categoryId);
          button.onclick = () => displaySongsForCategory(decadeId, categoryId);
          if (isPremiumCategory(categoryId) && !hasPremiumAccess()) {
            button.classList.add("locked");
          }
          categoryButtonsForDecadeDiv.appendChild(button);
        }
      });
    }
  });
}

/**
 * Muestra la lista de canciones para una década y categoría específicas.
 * @param {string} decadeId - La década de las canciones a mostrar.
 * @param {string} categoryId - La categoría de las canciones a mostrar.
 */
export async function displaySongsForCategory(decadeId, categoryId) {
  let songsToDisplay;

  try {
    if (isPremiumSelection(decadeId, categoryId) && !hasPremiumAccess()) {
      // INDICACIÓN PRECISA: Usamos 'categoryId' que es la variable disponible en esta función
      showPremiumModal("Esta categoría es Premium. Desbloquéala para ver el listado de canciones.", categoryId);
      return;
    }
    if (window.gameState.selectedDecade === "Todas") {
      const mergedPool = window.configuracionCanciones?.["Todas"]?.[window.gameState.category];

      if (!Array.isArray(mergedPool) || mergedPool.length < 4) {
        console.error(`Error: Pool no válido para Todas - ${window.gameState.category}`);
        showAppAlert("Error interno al preparar la pregunta. Vuelve a empezar.");
        showScreen("category-screen");
        return;
      }

      allSongsPool = mergedPool;
    } else {
      await window.loadSongsForDecadeAndCategory(decadeId, categoryId);
      songsToDisplay = window.configuracionCanciones[decadeId][categoryId];
    }
  } catch (error) {
    showAppAlert(
      `No se pudo cargar la lista de canciones para ${getDecadeLabel(decadeId)} - ${getCategoryLabel(categoryId)}.`,
    );
    console.error(error);
    showScreen("songs-list-category-screen");
    return;
  }

  const songsListContainer = document.getElementById("songs-list-container");
  const songsListCategoryTitle = document.getElementById("songs-list-category-title");

  songsListContainer.innerHTML = "";
  songsListCategoryTitle.textContent = `Canciones de ${getDecadeLabel(decadeId)} - ${getCategoryLabel(categoryId)}`;

  if (!songsToDisplay || songsToDisplay.length === 0) {
    songsListContainer.innerHTML = "<p>No hay canciones en esta categoría para la década seleccionada.</p>";
    showScreen("songs-list-display-screen");
    return;
  }

  const groupedSongs = {};
  const sortedSongs = [...songsToDisplay].sort((a, b) => {
    const nameA = parseDisplay(a.display).artist || parseDisplay(a.display).title;
    const nameB = parseDisplay(b.display).artist || parseDisplay(b.display).title;
    return nameA.localeCompare(nameB);
  });

  sortedSongs.forEach((song) => {
    const primaryName = (parseDisplay(song.display).artist || parseDisplay(song.display).title || "Sin Nombre").trim();
    const firstChar = primaryName.charAt(0).toUpperCase();
    if (!groupedSongs[firstChar]) {
      groupedSongs[firstChar] = [];
    }
    groupedSongs[firstChar].push(song);
  });

  const alphaIndexDiv = document.createElement("div");
  alphaIndexDiv.className = "alpha-index";
  songsListContainer.appendChild(alphaIndexDiv);

  const sortedLetters = Object.keys(groupedSongs).sort();
  sortedLetters.forEach((letter) => {
    const link = document.createElement("a");
    link.href = `#letter-${letter}`;
    link.textContent = letter;
    alphaIndexDiv.appendChild(link);
  });

  sortedLetters.forEach((letter) => {
    const letterHeader = document.createElement("h3");
    letterHeader.id = `letter-${letter}`;
    letterHeader.textContent = letter;
    letterHeader.style.marginTop = "30px";
    letterHeader.style.marginBottom = "15px";
    letterHeader.style.color = "var(--warning-color)";
    letterHeader.style.borderBottom = "1px solid var(--warning-color)";
    letterHeader.style.paddingBottom = "5px";
    letterHeader.style.textAlign = "left";
    songsListContainer.appendChild(letterHeader);

    groupedSongs[letter].forEach((song) => {
      const songDiv = document.createElement("div");
      songDiv.className = "song-item-card";

      const textContent = document.createElement("span");
      textContent.style.flexGrow = "1";
      textContent.innerHTML = `<strong>${parseDisplay(song.display).artist}</strong>${parseDisplay(song.display).title ? `<br>${parseDisplay(song.display).title}` : ""}`;
      songDiv.appendChild(textContent);

      if (song.listenUrl && song.listenUrl.length > 5 && !song.listenUrl.includes("URL_DE_BÚSQUEDA_PENDIENTE")) {
        const listenBtn = document.createElement("button");
        listenBtn.className = "btn small-listen-btn";

        let icon = "▶";
        let bgColor = "#FF0000";
        let shadowColor = "#FF0000";

        if (song.platform === "spotify") {
          icon = "🎧";
          bgColor = "#1DB954";
          shadowColor = "#1DB954";
        }

        listenBtn.innerHTML = icon;
        listenBtn.onclick = () => window.open(song.listenUrl, "_blank");
        listenBtn.style.backgroundImage = `linear-gradient(45deg, ${bgColor}, ${shadowColor})`;
        listenBtn.style.boxShadow = `0 0 5px ${shadowColor}`;

        songDiv.appendChild(listenBtn);
      } else {
        const noLinksText = document.createElement("span");
        noLinksText.style.fontSize = "0.8rem";
        noLinksText.style.color = "var(--warning-color)";
        noLinksText.textContent = " (Sin enlace)";
        textContent.appendChild(noLinksText);
      }

      songsListContainer.appendChild(songDiv);
    });
  });

  showScreen("songs-list-display-screen");
}

/**
 * Carga todas las décadas para una categoría específica (modo "Todas").
 * @param {string} categoryId - La categoría a cargar.
 */
export async function loadAllDecadesForCategory(categoryId) {
  const decadesToFetch = ["80s", "90s", "00s", "10s", "actual"];

  window.configuracionCanciones["Todas"] = window.configuracionCanciones["Todas"] || {};
  window.configuracionCanciones["Todas"][categoryId] = [];

  // Cargar en paralelo (songs-loader ya se encarga de ignorar lo que no esté en whitelist)
  const fetchPromises = decadesToFetch.map((dec) => window.loadSongsForDecadeAndCategory(dec, categoryId));
  await Promise.allSettled(fetchPromises);

  const consolidatedPool = [];

  decadesToFetch.forEach((dec) => {
    const internalKey = dec.toLowerCase() === "actual" ? "actual" : dec;

    const allowedInDecade = window.VALID_CATEGORIES_PER_DECADE ? window.VALID_CATEGORIES_PER_DECADE[internalKey] : [];

    if (allowedInDecade.includes(categoryId)) {
      const songsInDecade = window.configuracionCanciones?.[internalKey]?.[categoryId];
      if (Array.isArray(songsToDecade)) {
        const safeSongs = songsInDecade.filter((song) => {
          if (song.originalCategory && song.originalCategory !== categoryId) return false;
          return true;
        });
        consolidatedPool.push(...safeSongs);
      }
    }
  });

  window.configuracionCanciones["Todas"][categoryId] = consolidatedPool;
}
