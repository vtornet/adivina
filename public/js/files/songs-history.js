const RECENT_SONGS_HISTORY_LENGTH = 8; // Número de partidas hacia atrás para evitar repeticiones

/**
 * Actualiza el historial de canciones recientes para un usuario.
 * @param {string} userEmail - El email del usuario.
 * @param {string} decade - La década de la partida.
 * @param {string} category - La categoría de la partida.
 * @param {Array} playedSongs - Las canciones jugadas en la partida.
 */
export function updateRecentSongsHistory(userEmail, decade, category, playedSongs) {
  if (!userEmail) return;

  const storageKey = `recentSongs_${userEmail}`;
  let history = JSON.parse(localStorage.getItem(storageKey)) || {};

  // Asegurarse de que la estructura para la década y categoría exista
  history[decade] = history[decade] || {};
  history[decade][category] = history[decade][category] || [];

  // Añadir las nuevas canciones jugadas al historial de esta categoría
  const newSongFiles = playedSongs.map((song) => song.file);
  history[decade][category] = history[decade][category].concat(newSongFiles);

  // Limitar el historial a la longitud deseada (evita que crezca indefinidamente)
  const maxSongsInHistory = RECENT_SONGS_HISTORY_LENGTH * gameState.totalQuestionsPerPlayer;
  if (history[decade][category].length > maxSongsInHistory) {
    history[decade][category] = history[decade][category].slice(-maxSongsInHistory);
  }

  localStorage.setItem(storageKey, JSON.stringify(history));
  console.log(`Historial de canciones recientes actualizado para ${decade}-${category}.`);
}

/**
 * Obtiene las canciones jugadas recientemente para un usuario, década y categoría.
 * @param {string} userEmail - El email del usuario.
 * @param {string} decade - La década de la partida.
 * @param {string} category - La categoría de la partida.
 * @returns {Set<string>} Un Set de nombres de archivo de canciones jugadas recientemente.
 */
export function getRecentSongs(userEmail, decade, category) {
  if (!userEmail) return new Set();

  const storageKey = `recentSongs_${userEmail}`;
  const history = JSON.parse(localStorage.getItem(storageKey)) || {};

  if (history[decade] && history[decade][category]) {
    return new Set(history[decade][category]);
  }
  return new Set();
}
