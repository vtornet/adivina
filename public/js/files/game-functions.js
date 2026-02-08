export async function loadGameHistory(userEmail) {
  if (useLocalApiFallback) {
    const localHistory = getLocalGameHistory();
    gameHistory = localHistory[userEmail] || [];
    console.log("Historial local cargado:", gameHistory);
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/gamehistory/${userEmail}`);
    const data = await parseJsonResponse(response);

    if (response.ok) {
      gameHistory = data;
      console.log("Historial de partidas cargado:", gameHistory);
    } else if (response.status === 404 || response.status >= 500) {
      useLocalApiFallback = true;
      const localHistory = getLocalGameHistory();
      gameHistory = localHistory[userEmail] || [];
    } else {
      console.error("Error al cargar historial:", data?.message);
      gameHistory = [];
    }
  } catch (error) {
    console.warn("API no disponible, usando historial local:", error);
    useLocalApiFallback = true;
    const localHistory = getLocalGameHistory();
    gameHistory = localHistory[userEmail] || [];
  }
}

export async function saveGameResult(players, winnerName, decade, category) {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();
  const formattedDate = `${day}/${month}/${year}`;

  const gameResult = {
    date: formattedDate,
    players: players.map((p) => ({ name: p.name, score: p.score, email: p.email || null })),
    winner: winnerName,
    decade: decade,
    category: category,
  };

  if (useLocalApiFallback) {
    const localHistory = getLocalGameHistory();
    players.forEach((player) => {
      if (!player.email) return;
      localHistory[player.email] = localHistory[player.email] || [];
      localHistory[player.email].push(gameResult);
    });
    saveLocalGameHistory(localHistory);
    if (currentUser && currentUser.email) {
      await loadGameHistory(currentUser.email);
    }
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/gamehistory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gameResult),
    });

    const data = await parseJsonResponse(response);

    if (response.ok) {
      console.log(data.message);
      if (currentUser && currentUser.email) {
        await loadGameHistory(currentUser.email);
      }
    } else if (response.status === 404 || response.status >= 500) {
      useLocalApiFallback = true;
      await saveGameResult(players, winnerName, decade, category);
    } else {
      console.error("Error al guardar historial de partida:", data?.message);
    }
  } catch (error) {
    console.warn("API no disponible, usando historial local:", error);
    useLocalApiFallback = true;
    await saveGameResult(players, winnerName, decade, category);
  }
}
