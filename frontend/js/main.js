const categoryNames = { espanol: "Canciones en Español", ingles: "Canciones en Inglés", peliculas: "BSO de Películas", series: "BSO de Series", tv: "Programas de TV", infantiles: "Series Infantiles", anuncios: "Anuncios"};
let gameState = {};
let audioPlaybackTimeout;
const screens = document.querySelectorAll('.screen');
const audioPlayer = document.getElementById('audio-player');
const sfxAcierto = document.getElementById('sfx-acierto');
const sfxError = document.getElementById('sfx-error');

// Asegúrate de que esta URL sea la de tu backend de Railway
const API_BASE_URL = 'https://accomplished-balance-production.up.railway.app';

// Estado global para el usuario logueado
let currentUser = null; // Almacenará { email: '', playerName: '' }
// Objetos para almacenar las puntuaciones acumuladas y el historial de partidas en memoria
// Su estructura será: { 'email@dominio.com': { 'espanol': 150, 'peliculas': 200, ... } }
let userAccumulatedScores = {};
let gameHistory = []; // Almacena resultados de partidas multijugador

// Función para mostrar pantallas
function showScreen(screenId) {
    screens.forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    // Ocultar inputs de nombres de jugador al volver a la selección de jugadores
    if (screenId === 'player-selection-screen') {
        document.getElementById('other-player-names-inputs').innerHTML = ''; // Limpiar inputs
        document.getElementById('logged-in-player-name').textContent = ''; // Limpiar nombre del jugador logueado
    }
}

// =====================================================================
// FUNCIONES DE AUTENTICACIÓN (Registro y Login)
// =====================================================================

// Función para validar formato de email
function isValidEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

// Función de registro de usuario
async function registerUser() {
    const emailInput = document.getElementById('register-email');
    const passwordInput = document.getElementById('register-password');
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        alert('Por favor, introduce un email y una contraseña.');
        return;
    }
    if (!isValidEmail(email)) {
        alert('Por favor, introduce un email válido.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            emailInput.value = '';
            passwordInput.value = '';
            showScreen('login-screen');
        } else {
            alert(`Error al registrar: ${data.message}`);
        }
    } catch (error) {
        console.error('Error de red durante el registro:', error);
        alert('Error de conexión. Intenta de nuevo más tarde.');
    }
}

// Función de login de usuario
async function loginUser() {
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        alert('Por favor, introduce tu email y contraseña.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            currentUser = { email: data.user.email, playerName: data.user.playerName };
            localStorage.setItem('loggedInUserEmail', data.user.email); // Mantén esto para el auto-login

            alert(`¡Bienvenido, ${currentUser.playerName || currentUser.email}!`);
            emailInput.value = '';
            passwordInput.value = '';

            // Cargar puntuaciones e historial DE LA BASE DE DATOS
            await loadUserScores(currentUser.email);
            await loadGameHistory(currentUser.email);

            if (currentUser.playerName) {
                showScreen('category-screen');
            } else {
                showScreen('set-player-name-screen');
            }
        } else {
            alert(`Error al iniciar sesión: ${data.message}`);
        }
    } catch (error) {
        console.error('Error de red durante el login:', error);
        alert('Error de conexión. Intenta de nuevo más tarde.');
    }
}

// Función para cerrar sesión
function logout() {
    currentUser = null;
    localStorage.removeItem('loggedInUserEmail');
    alert('Sesión cerrada correctamente.');
    showScreen('home-screen'); // Vuelve a la pantalla de inicio
}

// Función para establecer el nombre de jugador
async function setPlayerName() {
    const playerNameInput = document.getElementById('player-name-input');
    const newPlayerName = playerNameInput.value.trim();

    if (!newPlayerName) {
        alert('Por favor, introduce un nombre de jugador.');
        return;
    }

    if (currentUser) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/users/${currentUser.email}/playername`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerName: newPlayerName })
            });

            const data = await response.json();

            if (response.ok) {
                currentUser.playerName = newPlayerName; // Actualiza el objeto currentUser en memoria
                alert(data.message);
                playerNameInput.value = '';
                showScreen('category-screen');
            } else {
                alert(`Error al actualizar nombre: ${data.message}`);
            }
        } catch (error) {
            console.error('Error de red al establecer nombre de jugador:', error);
            alert('Error de conexión. Intenta de nuevo más tarde.');
        }
    } else {
        alert('No hay un usuario logueado. Por favor, inicia sesión primero.');
        showScreen('login-screen');
    }
}


// =====================================================================
// FUNCIONES PARA GESTIÓN DE PUNTUACIONES ACUMULADAS Y HISTORIAL
// =====================================================================

// Función para cargar las puntuaciones de un usuario
async function loadUserScores(userEmail) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/scores/${userEmail}`);
        const data = await response.json();

        if (response.ok) {
            userAccumulatedScores[userEmail] = data;
            console.log(`Puntuaciones de ${userEmail} cargadas:`, userAccumulatedScores[userEmail]);
        } else {
            console.error('Error al cargar puntuaciones:', data.message);
            userAccumulatedScores[userEmail] = {}; // Inicializa vacío en caso de error
        }
    } catch (error) {
        console.error('Error de red al cargar puntuaciones:', error);
        userAccumulatedScores[userEmail] = {}; // Inicializa vacío en caso de error de red
    }
}

// Función para guardar una puntuación acumulada
async function saveUserScores(userEmail, category, score) {
    if (!userEmail || !category || typeof score !== 'number') {
        console.error("Error: Datos incompletos para guardar puntuación acumulada.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/scores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, category, score })
        });

        const data = await response.json();

        if (response.ok) {
            console.log(data.message);
            // Opcional: Recargar la puntuación después de guardar para mantener userAccumulatedScores sincronizado
            await loadUserScores(userEmail); // Recarga para actualizar el estado local
        } else {
            console.error('Error al guardar puntuación:', data.message);
        }
    } catch (error) {
        console.error('Error de red al guardar puntuación:', error);
    }
}

// Función para cargar el historial de partidas de un usuario
async function loadGameHistory(userEmail) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/gamehistory/${userEmail}`);
        const data = await response.json();

        if (response.ok) {
            gameHistory = data; // Asigna directamente el array de historial
            console.log("Historial de partidas cargado:", gameHistory);
        } else {
            console.error('Error al cargar historial:', data.message);
            gameHistory = []; // Inicializa vacío en caso de error
        }
    } catch (error) {
        console.error('Error de red al cargar historial:', error);
        gameHistory = []; // Inicializa vacío en caso de error de red
    }
}

// Función para guardar un resultado de partida multijugador
async function saveGameResult(players, winnerName, category) {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Meses son 0-11
    const year = today.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;

    const gameResult = {
        date: formattedDate,
        // Importante: mapea los jugadores para enviar solo lo necesario y el email si existe
        players: players.map(p => ({ name: p.name, score: p.score, email: p.email || null })),
        winner: winnerName,
        category: category
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/gamehistory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gameResult)
        });

        const data = await response.json();

        if (response.ok) {
            console.log(data.message);
            // Opcional: Recargar el historial después de guardar, si el currentUser está logueado
            if (currentUser && currentUser.email) {
                await loadGameHistory(currentUser.email);
            }
        } else {
            console.error('Error al guardar historial de partida:', data.message);
        }
    } catch (error) {
        console.error('Error de red al guardar historial de partida:', error);
    }
}

// Función para calcular victorias entre dos jugadores específicos (para la futura pantalla de stats)
function calculateDuelWins(player1Name, player2Name) {
    let wins1 = 0;
    let wins2 = 0;
    
    // Convertir a minúsculas para una comparación insensible a mayúsculas/minúsculas
    const p1 = player1Name.toLowerCase();
    const p2 = player2Name.toLowerCase();

    gameHistory.forEach(game => {
        // Asegurarse de que el juego sea un "duelo" y que los jugadores coincidan
        if (game.players.length === 2) {
            // Modificado para acceder a 'name' dentro del objeto de jugador
            const gamePlayersLower = game.players.map(p => p.name.toLowerCase()).sort(); 
            const sortedDuelPlayers = [p1, p2].sort();

            if (gamePlayersLower[0] === sortedDuelPlayers[0] && gamePlayersLower[1] === sortedDuelPlayers[1]) {
                // Es un duelo entre estos dos jugadores
                if (game.winner && game.winner.toLowerCase() === p1) {
                    wins1++;
                } else if (game.winner && game.winner.toLowerCase() === p2) {
                    wins2++;
                }
            }
        }
    });
    return { [player1Name]: wins1, [player2Name]: wins2 };
}

// =====================================================================
// FUNCIONES DEL JUEGO (MODIFICADAS: loginUser, endGame, inicialización)
// =====================================================================

function parseDisplay(displayText) {
    const parts = displayText.split(' - ');
    if (parts.length < 2) {
        return { artist: displayText, title: '' };
    }
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
}

function generateCategoryButtons() {
    const container = document.getElementById('category-buttons');
    container.innerHTML = '';
    for (const categoryId in categoryNames) {
        // configuracionCanciones no está definida aquí, ya que se encuentra en songs.js
        // Asegúrate de que songs.js se cargue ANTES de main.js en index.html
        if (typeof configuracionCanciones !== 'undefined' && configuracionCanciones[categoryId] && configuracionCanciones[categoryId].length >= 4) {
            const button = document.createElement('button');
            button.className = 'category-btn';
            button.innerText = categoryNames[categoryId];
            button.onclick = () => selectCategory(categoryId);
            container.appendChild(button);
        }
    }
}

function selectCategory(category) {
    if (!currentUser || !currentUser.playerName) {
        alert('Debes iniciar sesión y establecer tu nombre de jugador para continuar.');
        showScreen('login-screen');
        return;
    }
    gameState.category = category;
    showScreen('player-selection-screen');
}

// Función para seleccionar el número de jugadores y generar inputs de nombres
function selectPlayers(numPlayers) {
    if (!currentUser || !currentUser.playerName) {
        alert('Debes iniciar sesión y establecer tu nombre de jugador para continuar.');
        showScreen('login-screen');
        return;
    }

    gameState.playerCount = numPlayers;
    const otherPlayerNamesInputsDiv = document.getElementById('other-player-names-inputs');
    otherPlayerNamesInputsDiv.innerHTML = ''; // Limpiar inputs anteriores
    
    // Mostrar el nombre del usuario logueado como el primer jugador
    document.getElementById('logged-in-player-name').textContent = currentUser.playerName;

    // Generar inputs para los jugadores adicionales (si hay)
    for (let i = 1; i < numPlayers; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'text-input';
        input.placeholder = `Nombre del Jugador ${i + 1}`;
        input.id = `player-${i + 1}-name-input`;
        otherPlayerNamesInputsDiv.appendChild(input);
    }

    showScreen('player-names-input-screen'); // Mostrar la pantalla para introducir nombres
}

function startGame() {
    if (!currentUser || !currentUser.playerName) {
        alert('Error: No se ha encontrado el nombre del jugador principal. Por favor, inicia sesión de nuevo.');
        logout(); // Forzar cierre de sesión y redirigir
        return;
    }

    gameState.players = [];
    // Añadir el usuario logueado como el primer jugador
    gameState.players.push({ 
        id: 1, 
        name: currentUser.playerName, 
        score: 0, 
        questionsAnswered: 0, 
        questions: [],
        email: currentUser.email // Asegura que el email del jugador logueado se guarda
    });

    // Recopilar nombres de otros jugadores si existen
    for (let i = 1; i < gameState.playerCount; i++) {
        const input = document.getElementById(`player-${i + 1}-name-input`);
        const name = input.value.trim() || `Jugador ${i + 1}`;
        gameState.players.push({ 
            id: i + 1, 
            name: name, 
            score: 0, 
            questionsAnswered: 0, 
            questions: [] 
            // No hay email para jugadores no logueados
        });
    }

    gameState.totalQuestionsPerPlayer = 10; // Cada jugador responderá 10 preguntas
    // Comprobar si hay suficientes canciones para la categoría seleccionada y el número de jugadores
    // Asegúrate de que `configuracionCanciones` esté disponible (cargando songs.js antes de main.js)
    const allSongsInCat = [...configuracionCanciones[gameState.category]];
    const requiredSongs = gameState.totalQuestionsPerPlayer * gameState.playerCount;

    if (allSongsInCat.length < requiredSongs) {
        console.warn(`Advertencia: No hay suficientes canciones en la categoría (${categoryNames[gameState.category]}) para ${gameState.playerCount} jugadores, cada uno con ${gameState.totalQuestionsPerPlayer} preguntas. Se necesitan ${requiredSongs} y solo hay ${allSongsInCat.length}. Ajustando el número de preguntas por jugador.`);
        gameState.totalQuestionsPerPlayer = Math.floor(allSongsInCat.length / gameState.playerCount);
        if (gameState.totalQuestionsPerPlayer < 1) { 
             alert('No hay suficientes canciones para que cada jugador tenga al menos una pregunta. Elige otra categoría o menos jugadores.');
             showScreen('category-screen');
             return;
        }
    }
    
    let shuffledSongs = allSongsInCat.sort(() => 0.5 - Math.random());

    // Asignar 10 preguntas aleatorias a cada jugador desde el inicio de la partida
    for (let i = 0; i < gameState.playerCount; i++) {
        // Asegurarse de que haya suficientes canciones para cortar
        if (shuffledSongs.length >= gameState.totalQuestionsPerPlayer) {
            gameState.players[i].questions = shuffledSongs.splice(0, gameState.totalQuestionsPerPlayer);
        } else {
            // Si no hay suficientes, asignar las restantes y avisar
            gameState.players[i].questions = [...shuffledSongs];
            console.warn(`No se pudieron asignar ${gameState.totalQuestionsPerPlayer} preguntas al jugador ${gameState.players[i].name}. Solo se asignaron ${shuffledSongs.length} preguntas.`);
            shuffledSongs = []; // Vaciar el array para asegurar que no se reusen
            gameState.totalQuestionsPerPlayer = gameState.players[i].questions.length; // Ajustar para este jugador si es necesario
        }
    }
    
    gameState.currentPlayerIndex = 0; // Siempre empezar por el primer jugador
    setupQuestion();
    showScreen('game-screen');
}

function setupQuestion() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    // Verificar si el jugador actual ha respondido todas sus preguntas
    if (currentPlayer.questionsAnswered >= gameState.totalQuestionsPerPlayer) {
        nextPlayerOrEndGame(); // Si ya terminó, pasar al siguiente jugador o finalizar
        return;
    }
    
    clearTimeout(audioPlaybackTimeout);
    audioPlayer.pause(); // Pausar cualquier audio en reproducción
    gameState.attempts = 3;
    gameState.hasPlayed = false;

    // Obtener la pregunta actual para este jugador
    const currentQuestion = currentPlayer.questions[currentPlayer.questionsAnswered];
    
    // Actualizar la interfaz del juego
    document.getElementById("player-name-display").textContent = currentPlayer.name;
    document.getElementById('category-display').innerText = categoryNames[gameState.category];
    document.getElementById('question-counter').innerText = `Pregunta ${currentPlayer.questionsAnswered + 1}/${gameState.totalQuestionsPerPlayer}`;
    document.getElementById('player-turn').innerText = `Turno de ${currentPlayer.name}`;
    document.getElementById('points-display').innerText = `Puntos: ${currentPlayer.score}`;

    updateAttemptsCounter();

    const answerButtonsContainer = document.getElementById('answer-buttons');
    answerButtonsContainer.innerHTML = ''; // Limpiar botones anteriores

    // Asegúrate de que `configuracionCanciones` esté disponible (cargando songs.js antes de main.js)
    const allSongsInCat = [...configuracionCanciones[gameState.category]];
    let options = [currentQuestion];
    while (options.length < 4) {
        const randomSong = allSongsInCat[Math.floor(Math.random() * allSongsInCat.length)];
        // Asegurarse de que la opción aleatoria no sea la respuesta correcta y no esté ya en las opciones
        if (!options.some(opt => opt.file === randomSong.file) && randomSong.file !== currentQuestion.file) {
            options.push(randomSong);
        }
    }
    options.sort(() => 0.5 - Math.random());

    options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'btn answer-btn';
        const parsedDisplay = parseDisplay(option.display);
        button.innerHTML = `<strong>${parsedDisplay.artist}</strong>${parsedDisplay.title}`;
        button.onclick = () => checkAnswer(option.file === currentQuestion.file, button);
        answerButtonsContainer.appendChild(button);
    });

    const playBtn = document.getElementById('play-song-btn');
    playBtn.onclick = playAudioSnippet;
    playBtn.disabled = false;
    playBtn.innerText = "▶";
}

function updateAttemptsCounter() {
    const counter = document.getElementById('attempts-counter');
    counter.innerText = `Intentos: ${gameState.attempts}`;
    if (gameState.attempts === 3) counter.style.backgroundColor = 'var(--correct-color)';
    else if (gameState.attempts === 2) counter.style.backgroundColor = 'var(--warning-color)';
    else counter.style.backgroundColor = 'var(--incorrect-color)';
}

function playAudioSnippet() {
    if (gameState.hasPlayed) return;
    gameState.hasPlayed = true;
    const durations = { 3: 4000, 2: 6000, 1: 10000 };
    const duration = durations[gameState.attempts];
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const currentQuestion = currentPlayer.questions[currentPlayer.questionsAnswered];

    audioPlayer.src = `audio/${gameState.category}/${currentQuestion.file}`;
    audioPlayer.currentTime = 0;
    audioPlayer.play();

    const playBtn = document.getElementById('play-song-btn');
    playBtn.innerText = "🎵";
    playBtn.disabled = true;

    audioPlaybackTimeout = setTimeout(() => {
        audioPlayer.pause();
        playBtn.innerText = "▶";
    }, duration);
}

function checkAnswer(isCorrect, button) {
    if (!gameState.hasPlayed) {
        alert("¡Primero tienes que pulsar el botón ▶ para escuchar la canción!");
        return;
    }
    clearTimeout(audioPlaybackTimeout);
    audioPlayer.pause();
    document.querySelectorAll('.answer-btn').forEach(btn => btn.classList.add('disabled'));

    if (isCorrect) {
        sfxAcierto.currentTime = 0;
        sfxAcierto.play();
        const points = { 3: 3, 2: 2, 1: 1 };
        gameState.players[gameState.currentPlayerIndex].score += points[gameState.attempts];
        button.classList.add('correct');
        // Incrementar las preguntas respondidas para el jugador actual
        gameState.players[gameState.currentPlayerIndex].questionsAnswered++;
        
        // Esperar antes de pasar al siguiente turno/jugador
        setTimeout(nextPlayerOrEndGame, 1500); // Llama directamente a la lógica de avance
    } else {
        sfxError.currentTime = 0;
        sfxError.play();
        button.classList.add('incorrect');
        gameState.attempts--;
        updateAttemptsCounter();
        if (gameState.attempts > 0) {
            setTimeout(() => {
                document.querySelectorAll('.answer-btn').forEach(btn => {
                    btn.classList.remove('disabled', 'incorrect', 'correct'); 
                });
                gameState.hasPlayed = false;
                const playBtn = document.getElementById('play-song-btn');
                playBtn.disabled = false;
                playBtn.innerText = "▶";
            }, 1500);
        } else {
            // Si no quedan intentos, el jugador actual no acertó esta pregunta, pasar al siguiente turno
            gameState.players[gameState.currentPlayerIndex].questionsAnswered++;
            setTimeout(nextPlayerOrEndGame, 1500); // Llama directamente a la lógica de avance
        }
    }
}

function nextPlayerOrEndGame() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    // Caso de un solo jugador: siempre va directamente a la siguiente pregunta o finaliza
    if (gameState.players.length === 1) {
        if (currentPlayer.questionsAnswered >= gameState.totalQuestionsPerPlayer) {
            endGame(); // Si el único jugador ha terminado, finaliza el juego
        } else {
            setupQuestion(); // Si el único jugador tiene más preguntas, configura la siguiente para él
        }
        return; // Salir de la función después de manejar el caso de un solo jugador
    }

    // Lógica para MÚLTIPLES jugadores
    // Si el jugador actual ha respondido todas sus preguntas
    if (currentPlayer.questionsAnswered >= gameState.totalQuestionsPerPlayer) {
        gameState.currentPlayerIndex++; // Intentar pasar al siguiente jugador

        // Verificar si hay más jugadores después del actual
        if (gameState.currentPlayerIndex < gameState.players.length) {
            // Hay otro jugador: mostrar pantalla de transición
            document.getElementById('current-player-score-summary').textContent = 
                `${currentPlayer.name} ha terminado su turno con ${currentPlayer.score} puntos.`;
            document.getElementById('next-player-prompt').textContent = 
                `Siguiente jugador: ${gameState.players[gameState.currentPlayerIndex].name}, ¿preparado para comenzar?`;
            showScreen('player-transition-screen');
        } else {
            // Todos los jugadores han terminado sus preguntas
            endGame();
        }
    } else {
        // El jugador actual aún tiene preguntas por responder
        setupQuestion();
    }
}

// Nueva función para continuar el turno del siguiente jugador
function continueToNextPlayerTurn() {
    setupQuestion(); // Configurar el juego para el jugador que sigue
    showScreen('game-screen'); // Volver a la pantalla de juego
}


function endGame() {
    const finalScoresContainer = document.getElementById('final-scores');
    finalScoresContainer.innerHTML = '<h3>Puntuaciones Finales</h3>';
    
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
    const winnerDisplay = document.getElementById('winner-display');

    if (gameState.players.length === 1) {
        // Caso de un solo jugador
        const player = gameState.players[0];
        winnerDisplay.textContent = `${player.name} has conseguido ${player.score} puntos.`;
        // Asegurarse de quitar los estilos de neón si vienen de una partida anterior
        winnerDisplay.style.animation = 'none'; 
        winnerDisplay.style.textShadow = 'none';
        winnerDisplay.style.color = 'var(--light-text-color)'; 
        winnerDisplay.style.border = 'none'; 
        winnerDisplay.style.fontSize = '1.8rem'; 

        // Guardar la puntuación acumulada para el usuario logueado
        if (currentUser && currentUser.email) {
            saveUserScores(currentUser.email, gameState.category, player.score);
        }

    } else {
        // Caso de múltiples jugadores (lógica existente para ganador/empate)
        let winnerName = 'Empate'; // Valor por defecto si hay empate
        if (sortedPlayers.length > 0) {
            const topScore = sortedPlayers[0].score;
            const winners = sortedPlayers.filter(player => player.score === topScore);

            if (winners.length > 1) {
                const winnerNames = winners.map(winner => winner.name).join(' y ');
                winnerDisplay.textContent = `¡Hay un EMPATE! Los GANADORES son ${winnerNames} con ${topScore} puntos!`;
                // winnerName ya es 'Empate'
            } else {
                winnerDisplay.textContent = `¡El GANADOR es ${sortedPlayers[0].name} con ${sortedPlayers[0].score} puntos!`;
                winnerName = sortedPlayers[0].name; // Obtener el nombre del ganador
            }
        } else {
            winnerDisplay.textContent = 'No hay ganador en esta partida.';
            winnerName = 'Nadie'; // Si no hay jugadores o puntuaciones, lo indicamos así
        }
        // Asegurarse de que los estilos de neón estén activos para multijugador
        winnerDisplay.style.animation = 'neonGlow 1.5s ease-in-out infinite alternate';
        winnerDisplay.style.textShadow = '0 0 8px var(--secondary-color), 0 0 15px var(--secondary-color)';
        winnerDisplay.style.color = 'var(--secondary-color)';
        winnerDisplay.style.borderBottom = '2px solid var(--secondary-color)';
        winnerDisplay.style.borderTop = '2px solid var(--secondary-color)';
        winnerDisplay.style.fontSize = '2.5rem';

        // Guardar la puntuación acumulada para el usuario logueado si participó
        if (currentUser && currentUser.email) {
            const loggedInPlayer = gameState.players.find(p => p.email === currentUser.email); // Usar email para identificar al jugador logueado
            if (loggedInPlayer) {
                saveUserScores(currentUser.email, gameState.category, loggedInPlayer.score);
            } else {
                // Si el jugador logueado no está en gameState.players (ej. en partidas de invitados sin loguearse)
                console.warn("Usuario logueado no encontrado en la lista de jugadores de la partida.");
            }
        }
        
        // Guardar el resultado de la partida multijugador
        saveGameResult(gameState.players, winnerName, gameState.category);
    }

    // Mostrar todas las puntuaciones (siempre)
    sortedPlayers.forEach((player, index) => {
        const medal = (gameState.players.length > 1) ? ({ 0: '🥇', 1: '🥈', 2: '🥉' }[index] || '') : ''; 
        finalScoresContainer.innerHTML += `<p>${medal} ${player.name}: <strong>${player.score} puntos</strong></p>`; 
    });
    
    document.getElementById('play-again-btn').onclick = () => { 
        // Reiniciar el estado de los jugadores para una nueva partida
        gameState.players.forEach(player => {
            player.score = 0;
            player.questionsAnswered = 0;
            player.questions = []; // Importante para que startGame vuelva a asignar nuevas preguntas
        });
        showScreen('player-selection-screen'); 
    };
    showScreen('end-game-screen');
}

function exitGame() {
    const confirmed = confirm('¿Seguro que quieres salir del juego? Se cerrará la sesión actual.');
    if (confirmed) {
        logout();
    }
}

function confirmReturnToMenu() {
    const confirmed = confirm("¿Estás seguro de que quieres volver al menú principal? Perderás el progreso de esta partida.");
    if (confirmed) {
        showScreen('category-screen');
    }
}

// =====================================================================
// FUNCIONES DE PANTALLA DE ESTADÍSTICAS
// =====================================================================

function showStatisticsScreen() {
    if (!currentUser || !currentUser.email) {
        alert("Debes iniciar sesión para ver tus estadísticas.");
        showScreen('login-screen');
        return;
    }

    showScreen('statistics-screen');
    renderUserTotalScores();
    renderDuelHistory();
}

// =====================================================================
// FUNCIONES DE PANTALLA DE LISTADO DE CANCIONES (NUEVAS Y MODIFICADAS)
// =====================================================================

function showSongsListCategorySelection() {
    showScreen('songs-list-category-screen');
    const container = document.getElementById('songs-list-category-buttons');
    container.innerHTML = ''; // Limpiar botones anteriores

    for (const categoryId in categoryNames) {
        if (typeof configuracionCanciones !== 'undefined' && configuracionCanciones[categoryId] && configuracionCanciones[categoryId].length > 0) {
            const button = document.createElement('button');
            button.className = 'category-btn';
            button.innerText = categoryNames[categoryId];
            button.onclick = () => displaySongsForCategory(categoryId);
            container.appendChild(button);
        }
    }
}

function displaySongsForCategory(categoryId) {
    const songs = configuracionCanciones[categoryId];

    const songsListContainer = document.getElementById('songs-list-container');
    const songsListCategoryTitle = document.getElementById('songs-list-category-title');

    songsListContainer.innerHTML = ''; // Limpiar lista anterior
    songsListCategoryTitle.textContent = `Canciones de ${categoryNames[categoryId]}`; // Título de la categoría

    if (!songs || songs.length === 0) {
        songsListContainer.innerHTML = '<p>No hay canciones en esta categoría.</p>';
        showScreen('songs-list-display-screen');
        return;
    }

    // Agrupar y ordenar canciones por letra inicial del artista/título
    const groupedSongs = {};
    const sortedSongs = [...songs].sort((a, b) => {
        const nameA = parseDisplay(a.display).artist || parseDisplay(a.display).title;
        const nameB = parseDisplay(b.display).artist || parseDisplay(b.display).title;
        return nameA.localeCompare(nameB);
    });

    sortedSongs.forEach(song => {
        const primaryName = (parseDisplay(song.display).artist || parseDisplay(song.display).title || 'Sin Nombre').trim();
        const firstChar = primaryName.charAt(0).toUpperCase();
        if (!groupedSongs[firstChar]) {
            groupedSongs[firstChar] = [];
        }
        groupedSongs[firstChar].push(song);
    });

    // Generar índice alfabético
    const alphaIndexDiv = document.createElement('div');
    alphaIndexDiv.className = 'alpha-index'; // Clase para CSS
    songsListContainer.appendChild(alphaIndexDiv);

    const sortedLetters = Object.keys(groupedSongs).sort();
    sortedLetters.forEach(letter => {
        const link = document.createElement('a');
        link.href = `#letter-${letter}`;
        link.textContent = letter;
        alphaIndexDiv.appendChild(link);
    });

    // Mostrar canciones agrupadas por letra
    sortedLetters.forEach(letter => {
        const letterHeader = document.createElement('h3');
        letterHeader.id = `letter-${letter}`;
        letterHeader.textContent = letter;
        letterHeader.style.marginTop = '30px';
        letterHeader.style.marginBottom = '15px';
        letterHeader.style.color = 'var(--warning-color)';
        letterHeader.style.borderBottom = '1px solid var(--warning-color)';
        letterHeader.style.paddingBottom = '5px';
        letterHeader.style.textAlign = 'left';
        songsListContainer.appendChild(letterHeader);

        groupedSongs[letter].forEach(song => {
            const songDiv = document.createElement('div');
            songDiv.className = 'song-item-card'; 
            
            const textContent = document.createElement('span');
            textContent.style.flexGrow = '1';
            textContent.innerHTML = `<strong>${parseDisplay(song.display).artist}</strong>${parsedDisplay(song.display).title ? `<br>${parseDisplay(song.display).title}` : ''}`;
            songDiv.appendChild(textContent);

            // Botón de "Oír" único
            // Solo muestra el botón si listenUrl existe y no es el placeholder de búsqueda
            if (song.listenUrl && song.listenUrl.length > 5 && !song.listenUrl.includes('URL_DE_BÚSQUEDA_PENDIENTE')) {
                const listenBtn = document.createElement('button');
                listenBtn.className = 'btn small-listen-btn';
                
                let icon = '▶'; // Icono por defecto (YouTube)
                let bgColor = '#FF0000'; // Rojo de YouTube
                let shadowColor = '#FF0000';

                if (song.platform === 'spotify') {
                    icon = '🎧'; // Icono de Spotify
                    bgColor = '#1DB954'; // Verde de Spotify
                    shadowColor = '#1DB954';
                }

                listenBtn.innerHTML = icon;
                listenBtn.onclick = () => window.open(song.listenUrl, '_blank');
                // Los estilos inline se mueven a CSS si es posible, pero para los colores dinámicos se pueden mantener aquí
                listenBtn.style.backgroundImage = `linear-gradient(45deg, ${bgColor}, ${shadowColor})`;
                listenBtn.style.boxShadow = `0 0 5px ${shadowColor}`;
                
                songDiv.appendChild(listenBtn);
            } else {
                // Opcional: Mostrar un texto "Sin enlace" si no hay URL válida
                const noLinksText = document.createElement('span');
                noLinksText.style.fontSize = '0.8rem';
                noLinksText.style.color = 'var(--warning-color)';
                noLinksText.textContent = ' (Sin enlace)';
                textContent.appendChild(noLinksText);
            }

            songsListContainer.appendChild(songDiv);
        });
    });

    showScreen('songs-list-display-screen');
}

function renderUserTotalScores() {
    const categoryScoresList = document.getElementById('category-scores-list');
    categoryScoresList.innerHTML = ''; // Limpiar contenido anterior

    const userScores = userAccumulatedScores[currentUser.email];

    if (!userScores || Object.keys(userScores).length === 0) {
        categoryScoresList.innerHTML = '<p style="color: var(--text-color);">Aún no tienes puntos acumulados. ¡Juega para empezar a sumar!</p>';
        return;
    }

    // Convertir el objeto de puntuaciones a un array para ordenar
    const sortedCategories = Object.entries(userScores).sort(([, scoreA], [, scoreB]) => scoreB - scoreA);

    sortedCategories.forEach(([categoryId, score]) => {
        const categoryName = categoryNames[categoryId] || categoryId; // Obtener nombre legible
        const p = document.createElement('p');
        p.className = 'score-item'; // Puedes añadir CSS para esto después si quieres
        p.innerHTML = `${categoryName}: <strong>${score} puntos</strong>`;
        categoryScoresList.appendChild(p);
    });
}

function renderDuelHistory() {
    const duelList = document.getElementById('duel-list');
    duelList.innerHTML = ''; // Limpiar contenido anterior

    // Filtrar solo los duelos (partidas de 2 jugadores)
    const duels = gameHistory.filter(game => game.players.length === 2);

    if (duels.length === 0) {
        duelList.innerHTML = '<p style="color: var(--text-color);">Aún no tienes duelos registrados. ¡Desafía a un amigo!</p>';
        return;
    }

    // Agrupar duelos por pares de jugadores para calcular victorias entre ellos
    const duelPairs = {}; // Clave: "JugadorA_JugadorB" (ordenado alfabéticamente)
    duels.forEach(game => {
        // Normalizar nombres para la clave del par (insensible a mayúsculas y minúsculas)
        const playerNames = game.players.map(p => p.name.toLowerCase()).sort();
        const pairKey = playerNames.join('_');

        if (!duelPairs[pairKey]) {
            duelPairs[pairKey] = { players: [...game.players].sort((a,b) => a.name.localeCompare(b.name)), games: [] }; 
        }
        duelPairs[pairKey].games.push(game);
    });

    // Mostrar estadísticas para cada par de duelos
    for (const key in duelPairs) {
        const pair = duelPairs[key];
        const [p1Obj, p2Obj] = pair.players; // Son objetos {name, score, email}
        const p1Name = p1Obj.name;
        const p2Name = p2Obj.name;
        const duelWins = calculateDuelWins(p1Name, p2Name); // Usa la función ya existente

        const duelSummaryDiv = document.createElement('div');
        duelSummaryDiv.className = 'duel-summary-card'; // Para CSS
        duelSummaryDiv.style.background = 'rgba(0, 0, 0, 0.2)';
        duelSummaryDiv.style.padding = '10px';
        duelSummaryDiv.style.borderRadius = '8px';
        duelSummaryDiv.style.marginBottom = '15px';
        duelSummaryDiv.style.border = '1px solid var(--primary-color)';
        
        duelSummaryDiv.innerHTML = `
            <p style="font-size: 1.1rem; font-weight: bold; color: var(--secondary-color); margin-bottom: 5px;">${p1Name} vs ${p2Name}</p>
            <p style="font-size: 0.95rem;">${p1Name}: <strong>${duelWins[p1Name]} victorias</strong> | ${p2Name}: <strong>${duelWins[p2Name]} victorias</strong></p>
            <details style="margin-top: 10px; text-align: left;">
                <summary style="font-size: 0.9rem; cursor: pointer; color: var(--warning-color);">Ver historial detallado</summary>
                <ul style="list-style-type: none; padding-left: 0;">
                </ul>
            </details>
        `;
        const detailsList = duelSummaryDiv.querySelector('ul');
        // Ordenar los juegos dentro del duelo por fecha (más reciente primero)
        pair.games.sort((a, b) => {
            // Asumiendo formato DD/MM/YYYY
            const [dayA, monthA, yearA] = a.date.split('/').map(Number);
            const [dayB, monthB, yearB] = b.date.split('/').map(Number);
            const dateA = new Date(yearA, monthA - 1, dayA);
            const dateB = new Date(yearB, monthB - 1, dayB);
            return dateB.getTime() - dateA.getTime();
        });

        pair.games.forEach(game => {
            const listItem = document.createElement('li');
            listItem.style.fontSize = '0.85rem';
            listItem.style.marginBottom = '3px';
            listItem.style.color = 'var(--text-color)';
            listItem.textContent = `Fecha: ${game.date}, Ganador: ${game.winner}, Categoría: ${categoryNames[game.category]}`;
            detailsList.appendChild(listItem);
        });

        duelList.appendChild(duelSummaryDiv);
    }
}
    
// =====================================================================
// INICIALIZACIÓN (Modificada para gestionar sesión)
// =====================================================================

window.onload = async () => {
    generateCategoryButtons();
    const loggedInUserEmail = localStorage.getItem('loggedInUserEmail');

    if (loggedInUserEmail) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/users/${loggedInUserEmail}`);
            const data = await response.json();

            if (response.ok && data.user) {
                currentUser = { email: data.user.email, playerName: data.user.playerName };
                await loadUserScores(currentUser.email);
                await loadGameHistory(currentUser.email);

                if (currentUser.playerName) {
                    showScreen('category-screen');
                } else {
                    showScreen('set-player-name-screen');
                }
            } else {
                console.warn(`No se pudo cargar el perfil del usuario ${loggedInUserEmail} desde la API:`, data.message || 'Error desconocido.');
                localStorage.removeItem('loggedInUserEmail'); // Limpia si la API no lo encuentra
                showScreen('login-screen');
            }
        } catch (error) {
            console.error('Error de red al cargar el perfil del usuario al inicio:', error);
            localStorage.removeItem('loggedInUserEmail'); // Limpiar si hay problemas de red
            showScreen('login-screen');
        }
    } else {
        showScreen('home-screen');
    }
};