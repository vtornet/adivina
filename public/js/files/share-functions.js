import { getDecadeLabel, getCategoryLabel } from "./app-info-functions.js";
import { showAppAlert } from "./modal-functions.js";

/**
 * Genera el texto para compartir los resultados del juego.
 * @param {Array} players - Array de jugadores.
 * @param {string} decadeId - ID de la década.
 * @param {string} categoryId - ID de la categoría.
 * @returns {string} Texto formateado para compartir.
 */
export function generateShareText(players, decadeId, categoryId) {
  const decade = getDecadeLabel(decadeId);
  const category = getCategoryLabel(categoryId);
  const url = "www.adivinalacancion.app";

  // Ordenar jugadores por puntuación
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const second = sorted[1]; // Puede ser undefined si es 1 jugador

  let text = "";

  // --- LÓGICA 1 JUGADOR ---
  if (players.length === 1) {
    const score = winner.score;
    if (score === 30) {
      text = `🏆 ¡INCREÍBLE! He conseguido un PLENO PERFECTO (30/30) en Adivina la Canción.\n\n🎶 Década: ${decade}\n💿 Categoría: ${category}\n\n¿Alguien se atreve a igualarme? 😎`;
    } else if (score >= 25) {
      text = `🔥 ¡Casi perfecto! He conseguido ${score} puntos en Adivina la Canción.\n\n🎶 Década: ${decade}\n💿 Categoría: ${category}\n\nHe estado rozando la gloria. ¿Puedes superarme? 💪`;
    } else if (score >= 15) {
      text = `🎵 He conseguido ${score} puntos en Adivina la Canción.\n\n🎶 Década: ${decade}\n💿 Categoría: ${category}\n\nNo está mal, pero voy a por más. ¡Inténtalo tú! 😜`;
    } else {
      text = `😅 He sacado ${score} puntos en Adivina la Canción. La categoría ${category} (${decade}) se me resiste...\n\n¿Sabes tú más música que yo? Demuéstralo. 👇`;
    }
  }
  // --- LÓGICA MULTIJUGADOR ---
  else {
    if (winner.score === (second ? second.score : -1)) {
      text = `⚔️ ¡DUELO DE TITANES! Hemos empatado a ${winner.score} puntos en Adivina la Canción.\n\n👤 ${winner.name} 🆚 👤 ${second.name}\n🎶 Temática: ${category} (${decade})\n\n¿Quién desempatará? ¡Únete y reta a tus amigos! 🤼`;
    } else {
      const diff = winner.score - (second ? second.score : 0);
      if (diff > 10) {
        text = `🚀 ¡PALIZA MUSICAL! ${winner.name} ha arrasado con ${winner.score} puntos frente a los ${second ? second.score : 0} de ${second ? second.name : "su rival"}.\n\n🎶 Década: ${decade}\n💿 Categoría: ${category}\n\n¿Crees que puedes ganarle? ¡Entra y juega! 😏`;
      } else {
        text = `🏁 ¡Final de infarto! ${winner.name} (${winner.score} pts) ha ganado por los pelos a ${second ? second.name : "su rival"} (${second ? second.score : 0} pts).\n\n🎶 Década: ${decade}\n💿 Categoría: ${category}\n\n¡La revancha está servida en Adivina la Canción! 🔥`;
      }
    }
  }

  return `${text}\n\nJuega gratis aquí 👉 ${url}`;
}

/**
 * Maneja el compartir los resultados del juego.
 */
export async function shareGameResultHandler() {
  let playersToShare, decadeToShare, categoryToShare;

  // Recuperamos datos dependiendo del modo
  if (isOnlineMode && localStorage.getItem("currentOnlineGameData")) {
    // Intentamos leer de la memoria local si el gameState se ha limpiado
    try {
      const savedData = JSON.parse(localStorage.getItem("currentOnlineGameData"));
      // Si gameState.players está vacío, usamos lo que tengamos en memoria o lo que hayamos inyectado
      playersToShare = gameState.players && gameState.players.length > 0 ? gameState.players : [];
      // Si no hay jugadores en gameState, esto fallará, pero lo hemos parcheado en showOnlineResults
      decadeToShare = savedData.decade;
      categoryToShare = savedData.category;
    } catch (e) {
      console.error("Error leyendo datos online para compartir", e);
      return;
    }
  } else {
    playersToShare = gameState.players;
    decadeToShare = gameState.selectedDecade;
    categoryToShare = gameState.category;
  }

  if (!playersToShare || playersToShare.length === 0) {
    showAppAlert("No hay resultados para compartir.");
    return;
  }

  const text = generateShareText(playersToShare, decadeToShare, categoryToShare);

  if (navigator.share) {
    try {
      await navigator.share({
        title: "Adivina la Canción - Resultado",
        text: text,
      });
    } catch (err) {
      console.log("Compartir cancelado:", err);
    }
  } else {
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    globalThis.open(whatsappUrl, "_blank");
  }
}
