// frontend/js/songs-loader.js
window.allSongsByDecadeAndCategory = {};

// Las categorías que esperamos en cada década
const allPossibleCategories = ['espanol', 'ingles', 'peliculas', 'series', 'tv', 'infantiles', 'anuncios'];
// Las décadas que esperamos
const allDecadesDefined = ['60s', '70s', '80s', '90s', '00s', '10s', 'Actual', 'Variadas'];

async function loadSongsForDecadeAndCategory(decade, category) {
    if (decade === 'Todas') {
        return loadAllSongs();
    }

    // Si ya tenemos las canciones cargadas, no las volvemos a cargar
    if (window.allSongsByDecadeAndCategory[decade] && window.allSongsByDecadeAndCategory[decade][category]) {
        console.log(`Canciones de ${decade}/${category} ya cargadas.`);
        return;
    }

    // Inicializa la estructura para la década y categoría si no existe
    window.allSongsByDecadeAndCategory[decade] = window.allSongsByDecadeAndCategory[decade] || {};
    window.allSongsByDecadeAndCategory[decade][category] = []; // Asegura que el array esté vacío al principio por si falla la carga

    const scriptPath = `data/songs/${decade}/${category}.js`;
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = scriptPath;
        script.onload = () => {
            console.log(`Canciones de ${decade}/${category} cargadas exitosamente.`);
            // No se necesita hacer nada más aquí, el script cargado ya pobló `window.allSongsByDecadeAndCategory`
            resolve();
        };
        script.onerror = (e) => {
            console.error(`Error al cargar las canciones de ${decade}/${category} desde ${scriptPath}:`, e);
            reject(new Error(`No se pudo cargar el archivo de canciones para ${decade}/${category}.`));
        };
        document.head.appendChild(script);
    });
}

async function loadAllSongs() {
    if (window.allSongsByDecadeAndCategory['Todas'] && window.allSongsByDecadeAndCategory['Todas']['consolidated'] && window.allSongsByDecadeAndCategory['Todas']['consolidated'].length > 0) {
        console.log('Todas las canciones ya consolidadas y cargadas.');
        return;
    }

    let allConsolidatedSongs = [];
    let loadPromises = [];

    // Cargar todos los archivos de canciones específicos de cada década/categoría
    for (const decade of allDecadesDefined) {
        for (const category of allPossibleCategories) {
            // Solo intenta cargar si se espera que haya canciones en esa categoría para esa década
            // (esto es una heurística; un sistema más avanzado tendría un índice)
            // Por ahora, asumimos que si el archivo JS existe, lo intentamos cargar.
            // La función loadSongsForDecadeAndCategory ya maneja el caso de que la URL no exista,
            // pero es mejor tener esto como un punto de control.
            // Para ser más precisos, deberías tener un JSON de metadatos de categorías/décadas válidas.
            
            // Para la demo, simplemente intentamos cargar y el onerror de loadSongsForDecadeAndCategory gestiona fallos.
            loadPromises.push(loadSongsForDecadeAndCategory(decade, category).catch(e => {
                // Captura el error para que Promise.allSettled no aborte si un archivo falta.
                // El error ya se loguea dentro de loadSongsForDecadeAndCategory
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
                    // **Añadir las propiedades originalDecade y originalCategory a cada canción**
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
const configuracionCanciones = window.allSongsByDecadeAndCategory;