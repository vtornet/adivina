// Lista blanca de categorías válidas por década
const VALID_CATEGORIES_PER_DECADE = {
  "80s": ["espanol", "ingles", "peliculas", "series", "tv", "infantiles", "anuncios"],
  "90s": ["espanol", "ingles", "peliculas", "series", "tv", "infantiles", "anuncios"],
  "00s": ["espanol", "ingles", "peliculas", "series", "tv"],
  "10s": ["espanol", "ingles"],
  actual: ["espanol", "ingles"],
  verano: ["consolidated"],
  elderly: ["consolidated"],
};

const allDecadesDefined = ["80s", "90s", "00s", "10s", "actual", "verano"];
const allPossibleCategories = ["espanol", "ingles", "peliculas", "series", "tv", "infantiles", "anuncios"];

globalThis.allDecadesDefined = allDecadesDefined;
globalThis.allPossibleCategories = allPossibleCategories;
// Exportamos la lista blanca para que main.js la pueda leer
globalThis.VALID_CATEGORIES_PER_DECADE = VALID_CATEGORIES_PER_DECADE;

/**
 * Carga las canciones para una década y categoría específica desde un archivo JS.
 * @param {string} decade - La década seleccionada (ej. '80s', 'Todas').
 * @param {string} category - La categoría seleccionada (ej. 'espanol', 'consolidated').
 * @returns {Promise<void>} Una promesa que se resuelve cuando las canciones han sido cargadas.
 */
async function loadSongsForDecadeAndCategory(decade, category) {
  if (decade === "Todas") {
    return loadAllSongs();
  }

  const internalKey = decade.toLowerCase() === "actual" ? "actual" : decade;

  // Inicialización segura
  globalThis.allSongsByDecadeAndCategory[internalKey] = globalThis.allSongsByDecadeAndCategory[internalKey] || {};

  // Si ya hay datos, salimos
  if (
    globalThis.allSongsByDecadeAndCategory[internalKey][category] &&
    globalThis.allSongsByDecadeAndCategory[internalKey][category].length > 0
  ) {
    return Promise.resolve();
  }

  globalThis.allSongsByDecadeAndCategory[internalKey][category] = [];

  const folderName = decade.toLowerCase() === "actual" ? "actual" : decade;

  const scriptPaths = [`/data/songs/${folderName}/${category}.js`];

  const loadScript = (paths, resolve, reject) => {
    if (paths.length === 0) {
      resolve();
      return;
    }

    const [currentPath, ...restPaths] = paths;
    const script = document.createElement("script");
    script.src = currentPath;

    script.onload = () => {
      const songsArray = globalThis.allSongsByDecadeAndCategory[internalKey][category];
      if (Array.isArray(songsArray)) {
        songsArray.forEach((song) => {
          song.originalDecade = internalKey;
          song.originalCategory = category;
        });
      }
      resolve();
    };

    script.onerror = () => {
      script.remove();
      // Si falla, intentamos rutas alternativas si las hubiera (aquí solo hay una estricta)
      if (restPaths.length > 0) {
        loadScript(restPaths, resolve, reject);
      } else {
        console.warn(`⚠️ No se pudo cargar: ${currentPath}`);
        resolve();
      }
    };
    document.head.appendChild(script);
  };

  return new Promise((resolve, reject) => {
    loadScript(scriptPaths, resolve, reject);
  });
}

/**
 * Consolida todas las canciones de todas las décadas y categorías en un solo array
 * bajo globalThis.allSongsByDecadeAndCategory['Todas']['consolidated'].
 * Carga dinámicamente los archivos si aún no están cargados.
 * @returns {Promise<void>} Una promesa que se resuelve cuando todas las canciones han sido consolidadas.
 */
async function loadAllSongs() {
  // Si ya está consolidado y tiene canciones, no volver a procesar
  if (
    globalThis.allSongsByDecadeAndCategory["Todas"] &&
    globalThis.allSongsByDecadeAndCategory["Todas"]["consolidated"] &&
    globalThis.allSongsByDecadeAndCategory["Todas"]["consolidated"].length > 0
  ) {
    console.log("Todas las canciones ya consolidadas y cargadas.");
    return;
  }

  let allConsolidatedSongs = [];
  let loadPromises = [];

  // Cargar todos los archivos de canciones específicos de cada década/categoría
  for (const decade of allDecadesDefined) {
    for (const category of allPossibleCategories) {
      loadPromises.push(
        loadSongsForDecadeAndCategory(decade, category).catch((e) => {
          return null;
        }),
      );
    }
  }

  // Esperar a que todas las promesas de carga se resuelvan (o rechacen)
  await Promise.allSettled(loadPromises);

  // Consolidar todas las canciones cargadas
  for (const decade of allDecadesDefined) {
    const internalKey = decade.toLowerCase() === "actual" ? "actual" : decade;
    const decadeData = globalThis.allSongsByDecadeAndCategory[internalKey];
    if (decadeData) {
      for (const category in decadeData) {
        const songsArray = decadeData[category];
        if (Array.isArray(songsArray)) {
          songsArray.forEach((song) => {
            if (!song.originalDecade) song.originalDecade = internalKey;
            if (!song.originalCategory) song.originalCategory = category;
          });
          allConsolidatedSongs = allConsolidatedSongs.concat(songsArray);
        }
      }
    }
  }

  // Almacenar el resultado consolidado
  globalThis.allSongsByDecadeAndCategory["Todas"] = globalThis.allSongsByDecadeAndCategory["Todas"] || {};
  globalThis.allSongsByDecadeAndCategory["Todas"]["consolidated"] = allConsolidatedSongs;
  console.log(`Consolidado 'Todas' con ${allConsolidatedSongs.length} canciones.`);
}

/**
 * Función auxiliar para obtener todas las categorías que existen para una década.
 * @param {string} decadeId - La década.
 * @returns {Array<string>} Un array de nombres de categorías esperadas para esa década.
 */
function getExpectedCategoriesForDecade(decadeId) {
  return allPossibleCategories;
}

// `configuracionCanciones` ahora es un proxy para `globalThis.allSongsByDecadeAndCategory`
const configuracionCanciones = globalThis.allSongsByDecadeAndCategory;

// Exportar variables y funciones necesarias para main.js
globalThis.configuracionCanciones = globalThis.allSongsByDecadeAndCategory;
globalThis.loadSongsForDecadeAndCategory = loadSongsForDecadeAndCategory;
