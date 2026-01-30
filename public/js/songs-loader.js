// frontend/js/songs-loader.js
// Este objeto contendrá la configuración de canciones cargada dinámicamente
// Será lo que antes era 'configuracionCanciones'
window.allSongsByDecadeAndCategory = {};

// Las categorías que esperamos en cada década
const allPossibleCategories = ['espanol', 'ingles', 'peliculas', 'series', 'tv', 'infantiles', 'anuncios'];
// Las décadas que esperamos (ajustado a tus décadas existentes)
const allDecadesDefined = ['80s', '90s', '00s', '10s', 'actual', 'verano']; 

window.allPossibleCategories = allPossibleCategories;
window.allDecadesDefined = allDecadesDefined;

/**
 * Carga las canciones para una década y categoría específica desde un archivo JS.
 * Si la década es 'Todas', llama a loadAllSongs().
 * @param {string} decade - La década seleccionada (ej. '80s', 'Todas').
 * @param {string} category - La categoría seleccionada (ej. 'espanol', 'consolidated').
 * @returns {Promise<void>} Una promesa que se resuelve cuando las canciones han sido cargadas.
 */
async function loadSongsForDecadeAndCategory(decade, category) {
    // Si la década es 'Todas', la categoría siempre es 'consolidated'.
    // En este caso, delegamos la carga a loadAllSongs(), que se encarga de consolidar.
    if (decade === 'Todas') {
        return loadAllSongs();
    }

    // Inicializa la estructura para la década si no existe.
    // Esto es crucial para asegurar que window.allSongsByDecadeAndCategory[decade] no sea 'undefined'
    // antes de intentar acceder a window.allSongsByDecadeAndCategory[decade][category].
    const internalKey = decade.toLowerCase() === 'actual' ? 'actual' : decade;
    window.allSongsByDecadeAndCategory[internalKey] = window.allSongsByDecadeAndCategory[internalKey] || {};

    // Si ya tenemos las canciones cargadas para esta combinación (decade/category)
    // y el array no está vacío, no las volvemos a cargar y resolvemos la promesa inmediatamente.
    if (window.allSongsByDecadeAndCategory[internalKey][category] && window.allSongsByDecadeAndCategory[internalKey][category].length > 0) {
        console.log(`Canciones de ${internalKey}/${category} ya cargadas.`);
        return Promise.resolve(); 
    }

    // Asegura que el array para esta categoría específica exista y esté vacío.
    // Esto es importante por si el archivo JS que se va a cargar falla o está vacío.
    window.allSongsByDecadeAndCategory[internalKey][category] = [];

    // Construye la ruta al archivo JavaScript de canciones.
    // NORMALIZACIÓN: Usamos 'Actual' con mayúscula para el sistema de archivos Linux.
    const folderName = (decade.toLowerCase() === 'actual') ? 'Actual' : decade;
    const scriptPaths = [
        `/data/songs/${folderName}/${category}.js`,
        `data/songs/${folderName}/${category}.js`
    ];

    const loadScript = (paths, resolve, reject) => {
        if (paths.length === 0) {
            reject(new Error(`No se pudo cargar el archivo de canciones para ${decade}/${category}.`));
            return;
        }

        const [currentPath, ...restPaths] = paths;
        const script = document.createElement('script');
        script.src = currentPath;
        script.onload = () => {
            const songsArray = window.allSongsByDecadeAndCategory[internalKey][category];

            if (Array.isArray(songsArray)) {
                songsArray.forEach(song => {
                    // SELLADO DE METADATOS v.57
                    // Marcamos de forma inamovible la categoría y década de origen
                    song.originalDecade = internalKey;
                    song.originalCategory = category;
                });
            }
            console.log(`Sello v.57 aplicado: ${decade}/${category}`);
            resolve();
        };

        script.onerror = () => {
            script.remove();
            // Si el archivo no existe (404), Railway devuelve HTML y causa errores de sintaxis.
            // Limpiamos el array para evitar datos corruptos.
            window.allSongsByDecadeAndCategory[internalKey][category] = [];
            console.warn(`Aviso: Archivo inexistente /data/songs/${folderName}/${category}.js. Omitiendo.`);
            resolve(); // Resolvemos para que el flujo de consolidación no se detenga
        };
        // Añade el script al <head> del documento para que se cargue y ejecute.
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