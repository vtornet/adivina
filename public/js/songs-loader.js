// frontend/js/songs-loader.js
// Este objeto contendrá la configuración de canciones cargada dinámicamente
// Será lo que antes era 'configuracionCanciones'
window.allSongsByDecadeAndCategory = {};

// Las categorías que esperamos en cada década
const allPossibleCategories = ['espanol', 'ingles', 'peliculas', 'series', 'tv', 'infantiles', 'anuncios'];
// Las décadas que esperamos (ajustado a tus décadas existentes)
const allDecadesDefined = ['80s', '90s', '00s', '10s', 'actual', 'verano']; // <-- AÑADE 'verano'

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
    window.allSongsByDecadeAndCategory[decade] = window.allSongsByDecadeAndCategory[decade] || {};

    // Si ya tenemos las canciones cargadas para esta combinación (decade/category)
    // y el array no está vacío, no las volvemos a cargar y resolvemos la promesa inmediatamente.
    if (window.allSongsByDecadeAndCategory[decade][category] && window.allSongsByDecadeAndCategory[decade][category].length > 0) {
        console.log(`Canciones de ${decade}/${category} ya cargadas.`);
        return Promise.resolve(); // Resuelve la promesa inmediatamente
    }

    // Asegura que el array para esta categoría específica exista y esté vacío.
    // Esto es importante por si el archivo JS que se va a cargar falla o está vacío.
    // Así, si el script no define completamente la estructura, el programa no fallará al intentar
    // acceder a una lista de canciones inexistente.
    window.allSongsByDecadeAndCategory[decade][category] = [];

    // Construye la ruta al archivo JavaScript de canciones.
    // Para 'verano' y 'consolidated' será: data/songs/verano/consolidated.js
    // Para '80s' y 'espanol' será: data/songs/80s/espanol.js
    const scriptPaths = [
        `/data/songs/${decade}/${category}.js`,
        `data/songs/${decade}/${category}.js`,
        `../data/songs/${decade}/${category}.js`
    ];

    const loadScript = (paths, resolve, reject) => {
        const [currentPath, ...restPaths] = paths;
        const script = document.createElement('script');
        script.src = currentPath;
        script.onload = () => {
    const songsArray = window.allSongsByDecadeAndCategory[decade][category];

    if (Array.isArray(songsArray)) {
        songsArray.forEach(song => {
            if (!song.originalDecade) song.originalDecade = decade;
            if (!song.originalCategory) song.originalCategory = category;
        });
    }

    console.log(`Canciones de ${decade}/${category} cargadas exitosamente.`);
    resolve();
};
        script.onerror = (e) => {
            script.remove();
            if (restPaths.length > 0) {
                loadScript(restPaths, resolve, reject);
                return;
            }
            // Si hay un error al cargar el script (ej. archivo no encontrado, error de sintaxis),
            // registramos el error y rechazamos la promesa.
            // El array para esta categoría ya está inicializado como vacío arriba, lo cual es seguro.
            console.error(`Error al cargar las canciones de ${decade}/${category} desde ${currentPath}:`, e);
            reject(new Error(`No se pudo cargar el archivo de canciones para ${decade}/${category}.`));
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
        const decadeData = window.allSongsByDecadeAndCategory[decade];
        if (decadeData) {
            for (const category in decadeData) {
                const songsArray = decadeData[category];
                if (Array.isArray(songsArray)) {
                    songsArray.forEach(song => {
                        if (!song.originalDecade) song.originalDecade = decade;
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
 * Esto es para que main.js pueda pedir la lista de categorías sin cargarlas todas.
 * @param {string} decadeId - La década.
 * @returns {Array<string>} Un array de nombres de categorías esperadas para esa década.
 */
function getExpectedCategoriesForDecade(decadeId) {
    // Esta función debería ser más inteligente si las categorías varían mucho por década.
    // Por ahora, asumimos que todas las décadas pueden tener todas las categorías.
    // La verdadera validación de si hay canciones se hace al cargar los archivos.
    return allPossibleCategories; 
}


// `configuracionCanciones` ahora es un proxy para `window.allSongsByDecadeAndCategory`
const configuracionCanciones = window.allSongsByDecadeAndCategory;
