// frontend/js/songs-loader.js
// Este objeto contendrá la configuración de canciones cargada dinámicamente
// Será lo que antes era 'configuracionCanciones'
window.allSongsByDecadeAndCategory = {};

// Las categorías existentes para la validación interna
const existingCategories = ['espanol', 'ingles', 'peliculas', 'series', 'tv', 'infantiles', 'anuncios'];

async function loadSongsForDecadeAndCategory(decade, category) {
    // Si la década es 'Todas', la lógica es diferente
    if (decade === 'Todas') {
        return loadAllSongs(); // Función para cargar todas las canciones
    }

    // Si ya tenemos las canciones cargadas, no las volvemos a cargar
    if (window.allSongsByDecadeAndCategory[decade] && window.allSongsByDecadeAndCategory[decade][category]) {
        console.log(`Canciones de ${decade}/${category} ya cargadas.`);
        return;
    }

    const scriptPath = `data/songs/${decade}/${category}.js`;
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = scriptPath;
        script.onload = () => {
            console.log(`Canciones de ${decade}/${category} cargadas exitosamente.`);
            resolve();
        };
        script.onerror = (e) => {
            console.error(`Error al cargar las canciones de ${decade}/${category}:`, e);
            // Si falla la carga de un archivo específico, inicializarlo como vacío para evitar errores
            window.allSongsByDecadeAndCategory[decade] = window.allSongsByDecadeAndCategory[decade] || {};
            window.allSongsByDecadeAndCategory[decade][category] = [];
            reject(e);
        };
        document.head.appendChild(script);
    });
}

// Nueva función para cargar todas las canciones de todas las décadas y categorías
async function loadAllSongs() {
    if (window.allSongsByDecadeAndCategory['Todas'] && window.allSongsByDecadeAndCategory['Todas']['consolidated']) {
        console.log('Todas las canciones ya consolidadas.');
        return;
    }

    let allConsolidatedSongs = [];
    let loadPromises = [];

    // Recorre todas las décadas (excepto 'Todas' si estuviera definida)
    const decadesToLoad = Object.keys(window.allSongsByDecadeAndCategory).filter(d => d !== 'Todas');
    
    // Si no se han cargado las décadas individuales, necesitamos un mecanismo para cargar TODAS.
    // Para simplificar, asumiremos que en algún momento se cargarán o ya están cargadas por las llamadas de `generateDecadeButtons`

    // Para un lazy loading real de 'Todas', tendrías que iterar sobre los nombres de carpetas
    // en data/songs y sus categorías, y cargar cada archivo individualmente.
    // Como no tenemos acceso directo al sistema de archivos aquí,
    // haremos una consolidación de lo que ya esté en `window.allSongsByDecadeAndCategory`
    // o forzaremos la carga de todas las décadas y categorías una vez.

    // Para una primera implementación, vamos a iterar sobre las décadas/categorías
    // que ya conocemos y forzar su carga si no están presentes.
    // Esto es un poco rudimentario para un "Todas" realmente lazy,
    // pero funciona con la estructura actual.
    const allDecades = ['60s', '70s', '80s', '90s', '00s', '10s', 'Actual', 'Variadas']; 

    for (const decade of allDecades) {
        if (!window.allSongsByDecadeAndCategory[decade]) {
            window.allSongsByDecadeAndCategory[decade] = {}; // Inicializa la década
        }
        for (const category of existingCategories) { // Usa las categorías globales para iterar
            // Si la categoría existe para la década
            // Y no ha sido cargada aún, añade la promesa de carga
            if (window.allSongsByDecadeAndCategory[decade][category] === undefined) {
                 // Aquí, si aún no está cargado, forzamos la carga del archivo de la categoría
                 // (esto asume que los archivos data/songs/decade/category.js existen)
                 loadPromises.push(loadSongsForDecadeAndCategory(decade, category).catch(e => {
                     console.warn(`Una categoría (${decade}/${category}.js) no se pudo cargar para 'Todas'. Se ignorará.`, e);
                     return null; // Devuelve null para que Promise.allSettled no falle
                 }));
            }
        }
    }

    // Esperar a que todos los archivos específicos de década/categoría se carguen (si es que faltan)
    await Promise.allSettled(loadPromises);

    // Una vez que potencialmente todo esté cargado, consolidar
    for (const decade of allDecades) {
        const decadeData = window.allSongsByDecadeAndCategory[decade];
        if (decadeData) {
            for (const category in decadeData) {
                if (Array.isArray(decadeData[category])) {
                    allConsolidatedSongs = allConsolidatedSongs.concat(decadeData[category]);
                }
            }
        }
    }
    
    // Almacenar el resultado consolidado en una propiedad específica
    window.allSongsByDecadeAndCategory['Todas'] = window.allSongsByDecadeAndCategory['Todas'] || {};
    window.allSongsByDecadeAndCategory['Todas']['consolidated'] = allConsolidatedSongs;
    console.log(`Consolidado 'Todas' con ${allConsolidatedSongs.length} canciones.`);
}


// `configuracionCanciones` ahora será un proxy para `window.allSongsByDecadeAndCategory`
// para no tener que cambiar todas las referencias en main.js
const configuracionCanciones = window.allSongsByDecadeAndCategory;