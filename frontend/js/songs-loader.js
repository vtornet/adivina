// frontend/js/songs-loader.js
// Este objeto contendrá la configuración de canciones cargada dinámicamente
// Será lo que antes era 'configuracionCanciones'
window.allSongsByDecadeAndCategory = {};

// Las categorías que esperamos en cada década
const allPossibleCategories = ['espanol', 'ingles', 'peliculas', 'series', 'tv', 'infantiles', 'anuncios'];
// Las décadas que esperamos
const allDecadesDefined = ['60s', '70s', '80s', '90s', '00s', '10s', 'Actual', 'Variadas'];

/**
 * Carga las canciones para una década y categoría específica desde un archivo JS.
 * Si la década es 'Todas', llama a loadAllSongs().
 * @param {string} decade - La década seleccionada (ej. '80s', 'Todas').
 * @param {string} category - La categoría seleccionada (ej. 'espanol', 'consolidated').
 * @returns {Promise<void>} Una promesa que se resuelve cuando las canciones han sido cargadas.
 */
async function loadSongsForDecadeAndCategory(decade, category) {
    if (decade === 'Todas') {
        return loadAllSongs();
    }

    // Si ya tenemos las canciones cargadas, no las volvemos a cargar
    if (window.allSongsByDecadeAndCategory[decade] && window.allSongsByDecadeAndCategory[decade][category]) {
        console.log(`Canciones de ${decade}/${category} ya cargadas.`);
        return;
    }

    // Inicializa la estructura para la década y categoría si no existe, para evitar errores si la carga falla
    window.allSongsByDecadeAndCategory[decade] = window.allSongsByDecadeAndCategory[decade] || {};
    window.allSongsByDecadeAndCategory[decade][category] = []; 

    const scriptPath = `data/songs/${decade}/${category}.js`;
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = scriptPath;
        script.onload = () => {
            console.log(`Canciones de ${decade}/${category} cargadas exitosamente.`);
            // El script cargado ya habrá poblado `window.allSongsByDecadeAndCategory`
            resolve();
        };
        script.onerror = (e) => {
            console.error(`Error al cargar las canciones de ${decade}/${category} desde ${scriptPath}:`, e);
            // Si la carga falla, asegúrate de que el array quede vacío o lo que prefieras
            window.allSongsByDecadeAndCategory[decade][category] = []; 
            reject(new Error(`No se pudo cargar el archivo de canciones para ${decade}/${category}.`));
        };
        document.head.appendChild(script);
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
            // Intentar cargar cada combinación década/categoría.
            // El .catch() en la promesa evitará que Promise.allSettled falle si un archivo no existe.
            loadPromises.push(loadSongsForDecadeAndCategory(decade, category).catch(e => {
                // El error ya se loguea dentro de loadSongsForDecadeAndCategory
                return null; 
            }));
        }
    }

    // Esperar a que todas las promesas de carga se resuelvan (o rechacen)
    // `Promise.allSettled` es mejor aquí porque no detiene la ejecución si alguna carga individual falla.
    await Promise.allSettled(loadPromises);

    // Consolidar todas las canciones cargadas
    for (const decade of allDecadesDefined) {
        const decadeData = window.allSongsByDecadeAndCategory[decade];
        if (decadeData) {
            for (const category in decadeData) {
                const songsArray = decadeData[category];
                if (Array.isArray(songsArray)) {
                    // Añadir las propiedades originalDecade y originalCategory a cada canción
                    // Esto es VITAL para que playAudioSnippet() pueda encontrar la ruta correcta.
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

// `configuracionCanciones` ahora es un proxy para `window.allSongsByDecadeAndCategory`
// Esto permite que main.js siga usando 'configuracionCanciones'
// como si fuera el objeto completo, pero los datos se cargan bajo demanda.
const configuracionCanciones = window.allSongsByDecadeAndCategory;