// frontend/js/songs-loader.js
// Este objeto contendrá la configuración de canciones cargada dinámicamente
// Será lo que antes era 'configuracionCanciones'
window.allSongsByDecadeAndCategory = {};

// === LISTA BLANCA ESTRICTA (v.60) ===
// Define QUÉ categorías existen realmente. Si no está aquí, se bloquea.
const VALID_CATEGORIES_PER_DECADE = {
    '80s':    ['espanol', 'ingles', 'peliculas', 'series', 'tv', 'infantiles', 'anuncios'],
    '90s':    ['espanol', 'ingles', 'peliculas', 'series', 'tv', 'infantiles', 'anuncios'],
    '00s':    ['espanol', 'ingles', 'peliculas', 'series', 'tv'], // Sin infantiles/anuncios
    '10s':    ['espanol', 'ingles'], // Solo música
    'actual': ['espanol', 'ingles'], // Solo música
    'verano': ['consolidated'],
    'elderly': ['consolidated']
};

const allDecadesDefined = ['80s', '90s', '00s', '10s', 'actual', 'verano']; 
const allPossibleCategories = ['espanol', 'ingles', 'peliculas', 'series', 'tv', 'infantiles', 'anuncios'];

window.allDecadesDefined = allDecadesDefined;
window.allPossibleCategories = allPossibleCategories;
// Exportamos la lista blanca para que main.js la pueda leer
window.VALID_CATEGORIES_PER_DECADE = VALID_CATEGORIES_PER_DECADE;

/**
 * Carga las canciones para una década y categoría específica desde un archivo JS.
 * Si la década es 'Todas', llama a loadAllSongs().
 * @param {string} decade - La década seleccionada (ej. '80s', 'Todas').
 * @param {string} category - La categoría seleccionada (ej. 'espanol', 'consolidated').
 * @returns {Promise<void>} Una promesa que se resuelve cuando las canciones han sido cargadas.
 */
/**
 * Carga las canciones verificando primero la Lista Blanca (v.60).
 */
/**
 * Carga las canciones verificando primero la Lista Blanca.
 * v.61: Incluye PUENTE DE REPARACIÓN para mayúsculas/minúsculas (Actual vs actual).
 */
async function loadSongsForDecadeAndCategory(decade, category) {
    if (decade === 'Todas') {
        return loadAllSongs();
    }

    const internalKey = decade.toLowerCase() === 'actual' ? 'actual' : decade;
    
    // 1. CHEQUEO DE LISTA BLANCA
    const allowed = VALID_CATEGORIES_PER_DECADE[internalKey];
    if (!allowed || !allowed.includes(category)) {
        window.allSongsByDecadeAndCategory[internalKey] = window.allSongsByDecadeAndCategory[internalKey] || {};
        window.allSongsByDecadeAndCategory[internalKey][category] = [];
        return Promise.resolve();
    }

    window.allSongsByDecadeAndCategory[internalKey] = window.allSongsByDecadeAndCategory[internalKey] || {};

    // Si ya están cargadas, salimos
    if (window.allSongsByDecadeAndCategory[internalKey][category] && window.allSongsByDecadeAndCategory[internalKey][category].length > 0) {
        return Promise.resolve(); 
    }

    window.allSongsByDecadeAndCategory[internalKey][category] = [];

    const folderName = (decade.toLowerCase() === 'actual') ? 'Actual' : decade;
    const scriptPaths = [
        `/data/songs/${folderName}/${category}.js`,
        `data/songs/${folderName}/${category}.js`
    ];

    const loadScript = (paths, resolve, reject) => {
        if (paths.length === 0) {
            resolve();
            return;
        }

        const [currentPath, ...restPaths] = paths;
        const script = document.createElement('script');
        script.src = currentPath;
        
        script.onload = () => {
            // === PUENTE DE REPARACIÓN (v.61) ===
            // Si el archivo guardó los datos en 'Actual' (Mayúscula), los movemos a 'actual' (minúscula).
            if (internalKey === 'actual') {
                if (window.allSongsByDecadeAndCategory['Actual'] && 
                    window.allSongsByDecadeAndCategory['Actual'][category] &&
                    window.allSongsByDecadeAndCategory['Actual'][category].length > 0) {
                    
                    console.log(`🔧 Puente activado: Moviendo datos de Actual -> actual para ${category}`);
                    window.allSongsByDecadeAndCategory['actual'][category] = window.allSongsByDecadeAndCategory['Actual'][category];
                }
            }

            const songsArray = window.allSongsByDecadeAndCategory[internalKey][category];
            if (Array.isArray(songsArray)) {
                songsArray.forEach(song => {
                    song.originalDecade = internalKey;
                    song.originalCategory = category;
                });
            }
            resolve();
        };

        script.onerror = () => {
            script.remove();
            loadScript(restPaths, resolve, reject);
        };
        document.head.appendChild(script);
    };

    return new Promise((resolve, reject) => {
        loadScript(scriptPaths, resolve, reject);
    });
}

/**
 * Consolida todas las canciones de todas las décadas y categorías en un solo array
 * bajo window.allSongsByDecadeAndCategory['Todas']['consolidated'].
 * Carga dinámicamente los archivos si aún no están cargados.
 * @returns {Promise<void>} Una promesa que se resuelve cuando todas las canciones han sido consolidadas.
 */
async function loadAllSongs() {
    // Si ya está consolidado y tiene canciones, no volver a procesar
    if (window.allSongsByDecadeAndCategory['Todas'] && 
        window.allSongsByDecadeAndCategory['Todas']['consolidated'] && 
        window.allSongsByDecadeAndCategory['Todas']['consolidated'].length > 0) {
        console.log('Todas las canciones ya consolidadas y cargadas.');
        return;
    }

    let allConsolidatedSongs = [];
    let loadPromises = [];

    // Cargar todos los archivos de canciones específicos de cada década/categoría
    for (const decade of allDecadesDefined) {
        for (const category of allPossibleCategories) {
            loadPromises.push(loadSongsForDecadeAndCategory(decade, category).catch(e => {
                return null; 
            }));
        }
    }

    // Esperar a que todas las promesas de carga se resuelvan (o rechacen)
    await Promise.allSettled(loadPromises);

    // Consolidar todas las canciones cargadas
    for (const decade of allDecadesDefined) {
        const internalKey = decade.toLowerCase() === 'actual' ? 'actual' : decade;
        const decadeData = window.allSongsByDecadeAndCategory[internalKey];
        if (decadeData) {
            for (const category in decadeData) {
                const songsArray = decadeData[category];
                if (Array.isArray(songsArray)) {
                    songsArray.forEach(song => {
                        if (!song.originalDecade) song.originalDecade = internalKey;
                        if (!song.originalCategory) song.originalCategory = category;
                    });
                    allConsolidatedSongs = allConsolidatedSongs.concat(songsArray);
                }
            }
        }
    }
    
    // Almacenar el resultado consolidado
    window.allSongsByDecadeAndCategory['Todas'] = window.allSongsByDecadeAndCategory['Todas'] || {};
    window.allSongsByDecadeAndCategory['Todas']['consolidated'] = allConsolidatedSongs;
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

// `configuracionCanciones` ahora es un proxy para `window.allSongsByDecadeAndCategory`
const configuracionCanciones = window.allSongsByDecadeAndCategory;