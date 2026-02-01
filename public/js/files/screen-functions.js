function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.remove("active");
  });
  document.getElementById(screenId).classList.add("active");

  // Si es la pantalla de crear partida online, cargar selects
  if (screenId === "create-online-screen") {
    populateOnlineSelectors();
  }
  if (screenId === "invite-online-screen") {
    populateInviteSelectors();
  }
  if (screenId === "decade-selection-screen") {
    updatePremiumButtonsState();
  }
  // MODIFICACIÓN CLAVE AQUÍ:
  if (screenId === "pending-games-screen" || screenId === "online-mode-screen") {
    //
    loadPlayerOnlineGames(); //
    requestInviteNotificationPermission();
  }
}

module.exports = { showScreen };
