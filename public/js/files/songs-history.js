import { logger } from "./logger.js";

const PLAYED_KEY_PREFIX = "songsPlayed";

function storageKey(userEmail, decade, category) {
  return `${PLAYED_KEY_PREFIX}_${userEmail}_${decade}_${category}`;
}

function loadPlayedSet(userEmail, decade, category) {
  const stored = localStorage.getItem(storageKey(userEmail, decade, category));
  return stored ? new Set(JSON.parse(stored)) : new Set();
}

export function getRecentSongs(userEmail, decade, category) {
  if (!userEmail) return new Set();
  return loadPlayedSet(userEmail, decade, category);
}

export function updateRecentSongsHistory(userEmail, decade, category, playedSongs) {
  if (!userEmail) return;
  const played = loadPlayedSet(userEmail, decade, category);
  playedSongs.forEach((song) => played.add(song.file));
  localStorage.setItem(storageKey(userEmail, decade, category), JSON.stringify([...played]));
  logger.debug(`Historial actualizado: ${played.size} canciones jugadas en ${decade}-${category}.`);
}

export function resetSongHistory(userEmail, decade, category) {
  if (!userEmail) return;
  localStorage.removeItem(storageKey(userEmail, decade, category));
  logger.debug(`Historial reiniciado para ${decade}-${category}.`);
}
