const decadeNames = {
    '60s': 'Década de los 60',
    '70s': 'Década de los 70',
    '80s': 'Década de los 80',
    '90s': 'Década de los 90',
    '00s': 'Década de los 2000',
    '10s': 'Década de los 2010',
    'Actual': 'Década Actual', // 2020s en adelante
    'Variadas': 'Variadas (TV, Infantiles, Anuncios)', // Década para categorías no temporales
    'Todas': 'Todas las Décadas' // Nueva opción
};

const categoryNames = {
    espanol: "Canciones en Español",
    ingles: "Canciones en Inglés",
    peliculas: "BSO de Películas",
    series: "BSO de Series",
    tv: "Programas de TV",
    infantiles: "Series Infantiles",
    anuncios: "Anuncios",
    consolidated: "Todas las Categorías" // Usado para la opción 'Todas'
};

let gameState = {};
let audioPlaybackTimeout;
const screens = document.querySelectorAll('.screen');
const audioPlayer = document.getElementById('audio-player');
const sfxAcierto = document.getElementById('sfx-acierto');
const sfxError = document.getElementById('sfx-error');

const API_BASE_URL = 'https://accomplished-balance-production.up.railway.app';

let currentUser = null;
// userAccumulatedScores almacenará { email: { 'decada': { 'categoria': score } } }
let userAccumulatedScores = {}; 
// gameHistory contendrá 'decade' en cada objeto de partida
let gameHistory = []; 

function showScreen(screenId) {
    screens.forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    if (screenId === 'player-selection-screen') {
        document.getElementById('other-player-names-inputs').innerHTML = '';
        document.getElementById('logged-in-player-name').textContent = '';
    } else if (screenId === 'category-screen') {
        document.getElementById('selected-decade-display').textContent = decadeNames[gameState.selectedDecade] || '';
    }
}

// =====================================================================
// FUNCIONES DE AUTENTICACIÓN (Registro y Login) - SIN CAMBIOS DE LÓGICA AQUÍ
// =====================================================================

function isValidEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

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
            localStorage.setItem('loggedInUserEmail', data.user.email);

            alert(`¡Bienvenido, ${currentUser.playerName || currentUser.email}!`);
            emailInput.value = '';
            passwordInput.value = '';

            await loadUserScores(currentUser.email);
            await loadGameHistory(currentUser.email);

            if (currentUser.playerName) {
                showScreen('decade-selection-screen'); // Ir a la selección de década
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

function logout() {
    currentUser = null;
    localStorage.removeItem('loggedInUserEmail');
    alert('Sesión cerrada correctamente.');
    showScreen('home-screen');
}

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
                currentUser.playerName = newPlayerName;
                alert(data.message);
                playerNameInput.value = '';
                showScreen('decade-selection-screen'); // Ir a la selección de década
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
// (ACTUALIZADAS para incluir 'decade')
// =====================================================================

async function loadUserScores(userEmail) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/scores/${userEmail}`);
        const data = await response.json();

        if (response.ok) {
            const scoresByDecade = {};
            // El backend ahora devuelve un array de objetos { email, decade, category, score }
            data.forEach(item => { 
                if (!scoresByDecade[item.decade]) {
                    scoresByDecade[item.decade] = {};
                }
                scoresByDecade[item.decade][item.category] = item.score;
            });
            userAccumulatedScores[userEmail] = scoresByDecade;
            console.log(`Puntuaciones de ${userEmail} cargadas:`, userAccumulatedScores[userEmail]);
        } else {
            console.error('Error al cargar puntuaciones:', data.message);
            userAccumulatedScores[userEmail] = {};
        }
    } catch (error) {
        console.error('Error de red al cargar puntuaciones:', error);
        userAccumulatedScores[userEmail] = {};
    }
}

async function saveUserScores(userEmail, decade, category, score) {
    if (!userEmail || !decade || !category || typeof score === 'undefined') {
        console.error("Error: Datos incompletos para guardar puntuación acumulada (email, decade, category, score).");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/scores`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, decade, category, score })
        });

        const data = await response.json();

        if (response.ok) {
            console.log(data.message);
            await loadUserScores(userEmail); 
        } else {
            console.error('Error al guardar puntuación:', data.message);
        }
    } catch (error) {
        console.error('Error de red al guardar puntuación:', error);
    }
}

async function loadGameHistory(userEmail) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/gamehistory/${userEmail}`);
        const data = await response.json();

        if (response.ok) {
            gameHistory = data;
            console.log("Historial de partidas cargado:", gameHistory);
        } else {
            console.error('Error al cargar historial:', data.message);
            gameHistory = [];
        }
    } catch (error) {
        console.error('Error de red al cargar historial:', error);
        gameHistory = [];
    }
}

async function saveGameResult(players, winnerName, decade, category) {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;

    const gameResult = {
        date: formattedDate,
        players: players.map(p => ({ name: p.name, score: p.score, email: p.email || null })),
        winner: winnerName,
        decade: decade, 
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

function calculateDuelWins(player1Name, player2Name) {
    let wins1 = 0;
    let wins2 = 0;
    
    const p1 = player1Name.toLowerCase();
    const p2 = player2Name.toLowerCase();

    gameHistory.forEach(game => {
        if (game.players.length === 2) {
            const gamePlayersLower = game.players.map(p => p.name.toLowerCase()).sort();
            const sortedDuelPlayers = [p1, p2].sort();

            if (gamePlayersLower[0] === sortedDuelPlayers[0] && gamePlayersLower[1] === sortedDuelPlayers[1]) {
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
// FUNCIONES DEL JUEGO (MODIFICADAS para incluir 'decade' y 'Todas')
// =====================================================================

function parseDisplay(displayText) {
    const parts = displayText.split(' - ');
    if (parts.length < 2) {
        return { artist: displayText, title: '' };
    }
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
}

function generateDecadeButtons() {
    const container = document.getElementById('decade-buttons');
    container.innerHTML = '';
    const decadesOrder = ['60s', '70s', '80s', '90s', '00s', '10s', 'Actual', 'Variadas']; 

    decadesOrder.forEach(decadeId => {
        // Solo si hay categorías y canciones para esa década
        // Hay que asegurarse de que la década y al menos una de sus categorías tenga 4 canciones
        let hasEnoughSongsInAnyCategory = false;
        if (configuracionCanciones[decadeId]) {
            for (const catId in configuracionCanciones[decadeId]) {
                const songsInCat = configuracionCanciones[decadeId][catId];
                if (Array.isArray(songsInCat) && songsInCat.length >= 4) {
                    hasEnoughSongsInAnyCategory = true;
                    break;
                }
            }
        }

        if (hasEnoughSongsInAnyCategory) {
            const button = document.createElement('button');
            button.className = 'category-btn'; // Se puede usar la misma clase de estilo
            button.innerText = decadeNames[decadeId];
            button.onclick = () => selectDecade(decadeId);
            container.appendChild(button);
        }
    });

    // Añadir el botón "Todas"
    // Solo si hay al menos 4 canciones consolidadas en total.
    // Esto es defensivo; loadAllSongs se encargará de rellenar 'Todas'
    // La primera vez que se carga la página o se pulsa 'Todas', puede que aún no esté consolidado,
    // pero selectDecade('Todas') lo forzará.
    const allSongsCount = (configuracionCanciones['Todas'] && configuracionCanciones['Todas']['consolidated']) 
                          ? configuracionCanciones['Todas']['consolidated'].length : 0;
    if (allSongsCount >= 4 || true) { // Permitimos que aparezca siempre y loadAllSongs() lo maneje
        const allButton = document.createElement('button');
        allButton.className = 'category-btn tertiary'; 
        allButton.innerText = decadeNames['Todas'];
        allButton.onclick = () => selectDecade('Todas');
        container.appendChild(allButton);
    }
}

async function selectDecade(decade) {
    if (!currentUser || !currentUser.playerName) {
        alert('Debes iniciar sesión y establecer tu nombre de jugador para continuar.');
        showScreen('login-screen');
        return;
    }
    gameState.selectedDecade = decade;
    
    if (decade === 'Todas') {
        gameState.category = 'consolidated'; 
        try {
            await loadSongsForDecadeAndCategory('Todas', 'consolidated'); 
            showScreen('player-selection-screen');
        } catch (error) {
            alert('Error al cargar todas las canciones. Intenta de nuevo.');
            console.error(error);
            showScreen('decade-selection-screen'); 
        }
    } else {
        generateCategoryButtons(); 
        showScreen('category-screen');
    }
}

function generateCategoryButtons() {
    const container = document.getElementById('category-buttons');
    container.innerHTML = '';
    const currentDecadeSongs = configuracionCanciones[gameState.selectedDecade];

    if (!currentDecadeSongs) {
        container.innerHTML = '<p class="warning-text">No hay categorías disponibles para esta década.</p>';
        return;
    }

    const categoryOrder = ['espanol', 'ingles', 'peliculas', 'series', 'tv', 'infantiles', 'anuncios'];

    categoryOrder.forEach(categoryId => {
        const songsArray = currentDecadeSongs[categoryId]; // Asegurarse de obtener el array de canciones
        if (Array.isArray(songsArray) && songsArray.length >= 4) { // Validar que sea un array y tenga suficientes canciones
            const button = document.createElement('button');
            button.className = 'category-btn';
            button.innerText = categoryNames[categoryId];
            button.onclick = () => selectCategory(categoryId);
            container.appendChild(button);
        }
    });

    if (container.innerHTML === '') {
        container.innerHTML = '<p class="warning-text">No hay categorías con suficientes canciones para jugar en esta década. Por favor, vuelve y elige otra década o categoría.</p>';
    }
}

async function selectCategory(category) {
    if (!currentUser || !currentUser.playerName) {
        alert('Debes iniciar sesión y establecer tu nombre de jugador para continuar.');
        showScreen('login-screen');
        return;
    }
    gameState.category = category;

    try {
        await loadSongsForDecadeAndCategory(gameState.selectedDecade, gameState.category);
        showScreen('player-selection-screen');
    } catch (error) {
        alert(`No se pudieron cargar las canciones para la categoría ${categoryNames[category]} en la década ${decadeNames[gameState.selectedDecade]}. Intenta con otra.`);
        console.error(error);
        showScreen('category-screen');
    }
}

function selectPlayers(numPlayers) {
    if (!currentUser || !currentUser.playerName) {
        alert('Debes iniciar sesión y establecer tu nombre de jugador para continuar.');
        showScreen('login-screen');
        return;
    }

    gameState.playerCount = numPlayers;
    const otherPlayerNamesInputsDiv = document.getElementById('other-player-names-inputs');
    otherPlayerNamesInputsDiv.innerHTML = '';
    
    document.getElementById('logged-in-player-name').textContent = currentUser.playerName;

    for (let i = 1; i < numPlayers; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'text-input';
        input.placeholder = `Nombre del Jugador ${i + 1}`;
        input.id = `player-${i + 1}-name-input`;
        otherPlayerNamesInputsDiv.appendChild(input);
    }

    showScreen('player-names-input-screen');
}

function startGame() {
    if (!currentUser || !currentUser.playerName) {
        alert('Error: No se ha encontrado el nombre del jugador principal. Por favor, inicia sesión de nuevo.');
        logout();
        return;
    }
    if (!gameState.selectedDecade || !gameState.category) {
        alert('Error: No se ha seleccionado una década o categoría. Vuelve a empezar.');
        showScreen('decade-selection-screen');
        return;
    }

    gameState.players = [];
    gameState.players.push({ 
        id: 1, 
        name: currentUser.playerName, 
        score: 0, 
        questionsAnswered: 0, 
        questions: [],
        email: currentUser.email
    });

    for (let i = 1; i < gameState.playerCount; i++) {
        const input = document.getElementById(`player-${i + 1}-name-input`);
        const name = input.value.trim() || `Jugador ${i + 1}`;
        gameState.players.push({ 
            id: i + 1, 
            name: name, 
            score: 0, 
            questionsAnswered: 0, 
            questions: [] 
        });
    }

    gameState.totalQuestionsPerPlayer = 10;
    
    let allSongsToChooseFrom;
    if (gameState.selectedDecade === 'Todas') {
        allSongsToChooseFrom = [...configuracionCanciones['Todas']['consolidated']];
    } else {
        // Asegurarse de que la propiedad exista antes de intentar acceder a ella
        if (!configuracionCanciones[gameState.selectedDecade] || !configuracionCanciones[gameState.selectedDecade][gameState.category]) {
            alert(`Error: No se encontraron canciones para la década ${decadeNames[gameState.selectedDecade]} y categoría ${categoryNames[gameState.category]}.`);
            showScreen('decade-selection-screen');
            return;
        }
        allSongsToChooseFrom = [...configuracionCanciones[gameState.selectedDecade][gameState.category]];
    }

    const requiredSongs = gameState.totalQuestionsPerPlayer * gameState.playerCount;

    if (allSongsToChooseFrom.length < requiredSongs) {
        console.warn(`Advertencia: No hay suficientes canciones en ${decadeNames[gameState.selectedDecade]} - ${categoryNames[gameState.category]}. Se necesitan ${requiredSongs} y solo hay ${allSongsToChooseFrom.length}. Ajustando el número de preguntas por jugador.`);
        gameState.totalQuestionsPerPlayer = Math.floor(allSongsToChooseFrom.length / gameState.playerCount);
        if (gameState.totalQuestionsPerPlayer < 1) { 
             alert(`No hay suficientes canciones en ${decadeNames[gameState.selectedDecade]} - ${categoryNames[gameState.category]} para que cada jugador tenga al menos una pregunta. Elige otra década o categoría.`);
             showScreen('decade-selection-screen');
             return;
        }
    }
    
    let shuffledSongs = allSongsToChooseFrom.sort(() => 0.5 - Math.random());

    for (let i = 0; i < gameState.playerCount; i++) {
        if (shuffledSongs.length >= gameState.totalQuestionsPerPlayer) {
            gameState.players[i].questions = shuffledSongs.splice(0, gameState.totalQuestionsPerPlayer);
        } else {
            gameState.players[i].questions = [...shuffledSongs];
            console.warn(`No se pudieron asignar ${gameState.totalQuestionsPerPlayer} preguntas al jugador ${gameState.players[i].name}. Solo se asignaron ${shuffledSongs.length} preguntas.`);
            shuffledSongs = [];
            gameState.totalQuestionsPerPlayer = gameState.players[i].questions.length;
        }
    }
    
    gameState.currentPlayerIndex = 0;
    setupQuestion();
    showScreen('game-screen');
}

function setupQuestion() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    if (currentPlayer.questionsAnswered >= gameState.totalQuestionsPerPlayer) {
        nextPlayerOrEndGame();
        return;
    }
    
    clearTimeout(audioPlaybackTimeout);
    audioPlayer.pause();
    gameState.attempts = 3;
    gameState.hasPlayed = false;

    const currentQuestion = currentPlayer.questions[currentPlayer.questionsAnswered];
    
    document.getElementById("player-name-display").textContent = currentPlayer.name;
    document.getElementById('category-display').innerText = `${decadeNames[gameState.selectedDecade]} - ${categoryNames[gameState.category]}`;
    document.getElementById('question-counter').innerText = `Pregunta ${currentPlayer.questionsAnswered + 1}/${gameState.totalQuestionsPerPlayer}`;
    document.getElementById('player-turn').innerText = `Turno de ${currentPlayer.name}`;
    document.getElementById('points-display').innerText = `Puntos: ${currentPlayer.score}`;

    updateAttemptsCounter();

    const answerButtonsContainer = document.getElementById('answer-buttons');
    answerButtonsContainer.innerHTML = '';

    let allSongsToChooseFromForOptions;
    if (gameState.selectedDecade === 'Todas') {
        allSongsToChooseFromForOptions = [...configuracionCanciones['Todas']['consolidated']];
    } else {
         if (!configuracionCanciones[gameState.selectedDecade] || !configuracionCanciones[gameState.selectedDecade][gameState.category]) {
            // Esto no debería ocurrir si selectCategory ya hizo el load y validó, pero es una seguridad.
            console.error(`Error: Opciones de canciones no encontradas para ${gameState.selectedDecade} - ${gameState.category}.`);
            alert('Error interno al cargar las opciones de respuesta. Intenta de nuevo.');
            showScreen('decade-selection-screen'); // Volver al inicio
            return;
        }
        allSongsToChooseFromForOptions = [...configuracionCanciones[gameState.selectedDecade][gameState.category]];
    }

    let options = [currentQuestion];
    while (options.length < 4) {
        const randomSong = allSongsToChooseFromForOptions[Math.floor(Math.random() * allSongsToChooseFromForOptions.length)];
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

    // USAMOS originalDecade y originalCategory para la ruta del audio
    if (!currentQuestion.originalDecade || !currentQuestion.originalCategory) {
        console.error("Error: Canción sin decade/category original para la reproducción:", currentQuestion);
        alert("Error al reproducir el audio de la canción. Por favor, revisa la consola para más detalles.");
        return; // Detener la reproducción
    }
    audioPlayer.src = `audio/${currentQuestion.originalDecade}/${currentQuestion.originalCategory}/${currentQuestion.file}`;

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
        gameState.players[gameState.currentPlayerIndex].questionsAnswered++;
        
        setTimeout(nextPlayerOrEndGame, 1500);
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
            gameState.players[gameState.currentPlayerIndex].questionsAnswered++;
            setTimeout(nextPlayerOrEndGame, 1500);
        }
    }
}

function nextPlayerOrEndGame() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    if (gameState.players.length === 1) {
        if (currentPlayer.questionsAnswered >= gameState.totalQuestionsPerPlayer) {
            endGame();
        } else {
            setupQuestion();
        }
        return;
    }

    if (currentPlayer.questionsAnswered >= gameState.totalQuestionsPerPlayer) {
        gameState.currentPlayerIndex++;

        if (gameState.currentPlayerIndex < gameState.players.length) {
            document.getElementById('current-player-score-summary').textContent = 
                `${currentPlayer.name} ha terminado su turno con ${currentPlayer.score} puntos.`;
            document.getElementById('next-player-prompt').textContent = 
                `Siguiente jugador: ${gameState.players[gameState.currentPlayerIndex].name}, ¿preparado para comenzar?`;
            showScreen('player-transition-screen');
        } else {
            endGame();
        }
    } else {
        setupQuestion();
    }
}

function continueToNextPlayerTurn() {
    setupQuestion();
    showScreen('game-screen');
}

function endGame() {
    const finalScoresContainer = document.getElementById('final-scores');
    finalScoresContainer.innerHTML = '<h3>Puntuaciones Finales</h3>';
    
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
    const winnerDisplay = document.getElementById('winner-display');

    if (gameState.players.length === 1) {
        const player = gameState.players[0];
        winnerDisplay.textContent = `${player.name} has conseguido ${player.score} puntos.`;
        winnerDisplay.style.animation = 'none'; 
        winnerDisplay.style.textShadow = 'none';
        winnerDisplay.style.color = 'var(--light-text-color)'; 
        winnerDisplay.style.border = 'none'; 
        winnerDisplay.style.fontSize = '1.8rem'; 

        if (currentUser && currentUser.email) {
            saveUserScores(currentUser.email, gameState.selectedDecade, gameState.category, player.score);
        }

    } else {
        let winnerName = 'Empate';
        if (sortedPlayers.length > 0) {
            const topScore = sortedPlayers[0].score;
            const winners = sortedPlayers.filter(player => player.score === topScore);

            if (winners.length > 1) {
                const winnerNames = winners.map(winner => winner.name).join(' y ');
                winnerDisplay.textContent = `¡Hay un EMPATE! Los GANADORES son ${winnerNames} con ${topScore} puntos!`;
            } else {
                winnerDisplay.textContent = `¡El GANADOR es ${sortedPlayers[0].name} con ${sortedPlayers[0].score} puntos!`;
                winnerName = sortedPlayers[0].name;
            }
        } else {
            winnerDisplay.textContent = 'No hay ganador en esta partida.';
            winnerName = 'Nadie';
        }
        winnerDisplay.style.animation = 'neonGlow 1.5s ease-in-out infinite alternate';
        winnerDisplay.style.textShadow = '0 0 8px var(--secondary-color), 0 0 15px var(--secondary-color)';
        winnerDisplay.style.color = 'var(--secondary-color)';
        winnerDisplay.style.borderBottom = '2px solid var(--secondary-color)';
        winnerDisplay.style.borderTop = '2px solid var(--secondary-color)';
        winnerDisplay.style.fontSize = '2.5rem';

        if (currentUser && currentUser.email) {
            const loggedInPlayer = gameState.players.find(p => p.email === currentUser.email);
            if (loggedInPlayer) {
                saveUserScores(currentUser.email, gameState.selectedDecade, gameState.category, loggedInPlayer.score);
            } else {
                console.warn("Usuario logueado no encontrado en la lista de jugadores de la partida.");
            }
        }
        
        saveGameResult(gameState.players, winnerName, gameState.selectedDecade, gameState.category);
    }

    sortedPlayers.forEach((player, index) => {
        const medal = (gameState.players.length > 1) ? ({ 0: '🥇', 1: '🥈', 2: '🥉' }[index] || '') : ''; 
        finalScoresContainer.innerHTML += `<p>${medal} ${player.name}: <strong>${player.score} puntos</strong></p>`; 
    });
    
    document.getElementById('play-again-btn').onclick = () => { 
        gameState.players.forEach(player => {
            player.score = 0;
            player.questionsAnswered = 0;
            player.questions = [];
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
        if (gameState.selectedDecade === 'Todas') {
            showScreen('decade-selection-screen'); 
        } else {
            showScreen('category-screen'); 
        }
    }
}

// =====================================================================
// FUNCIONES DE PANTALLA DE ESTADÍSTICAS (ACTUALIZADAS para décadas y categorías)
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

function renderUserTotalScores() {
    const categoryScoresList = document.getElementById('category-scores-list');
    categoryScoresList.innerHTML = '';

    const userScores = userAccumulatedScores[currentUser.email];

    if (!userScores || Object.keys(userScores).length === 0) {
        categoryScoresList.innerHTML = '<p style="color: var(--text-color);">Aún no tienes puntos acumulados. ¡Juega para empezar a sumar!</p>';
        return;
    }

    const decadesInOrder = ['60s', '70s', '80s', '90s', '00s', '10s', 'Actual', 'Variadas', 'Todas']; 
    let hasScoresToDisplay = false;

    decadesInOrder.forEach(decadeId => {
        const categoriesInDecade = userScores[decadeId];
        if (categoriesInDecade && Object.keys(categoriesInDecade).length > 0) {
            hasScoresToDisplay = true;
            const decadeHeader = document.createElement('h4');
            decadeHeader.style.color = 'var(--secondary-color)';
            decadeHeader.style.marginTop = '15px';
            decadeHeader.style.marginBottom = '10px';
            decadeHeader.textContent = decadeNames[decadeId];
            categoryScoresList.appendChild(decadeHeader);

            const sortedCategoriesInDecade = Object.entries(categoriesInDecade).sort(([, scoreA], [, scoreB]) => scoreB - scoreA);

            sortedCategoriesInDecade.forEach(([categoryId, score]) => {
                const categoryNameDisplay = categoryNames[categoryId] || categoryId;
                const p = document.createElement('p');
                p.className = 'score-item';
                p.innerHTML = `• ${categoryNameDisplay}: <strong>${score} puntos</strong>`;
                categoryScoresList.appendChild(p);
            });
        }
    });

    if (!hasScoresToDisplay) {
        categoryScoresList.innerHTML = '<p style="color: var(--text-color);">Aún no tienes puntos acumulados. ¡Juega para empezar a sumar!</p>';
    }
}


function renderDuelHistory() {
    const duelList = document.getElementById('duel-list');
    duelList.innerHTML = '';

    const duels = gameHistory.filter(game => game.players.length === 2);

    if (duels.length === 0) {
        duelList.innerHTML = '<p style="color: var(--text-color);">Aún no tienes duelos registrados. ¡Desafía a un amigo!</p>';
        return;
    }

    const duelPairs = {};
    duels.forEach(game => {
        const playerNames = game.players.map(p => p.name.toLowerCase()).sort();
        const pairKey = playerNames.join('_');

        if (!duelPairs[pairKey]) {
            duelPairs[pairKey] = { players: game.players.sort((a,b) => a.name.localeCompare(b.name)), games: [] }; 
        }
        duelPairs[pairKey].games.push(game);
    });

    for (const key in duelPairs) {
        const pair = duelPairs[key];
        const [p1Obj, p2Obj] = pair.players;
        const p1Name = p1Obj.name;
        const p2Name = p2Obj.name;
        const duelWins = calculateDuelWins(p1Name, p2Name);

        const duelSummaryDiv = document.createElement('div');
        duelSummaryDiv.className = 'duel-summary-card';
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
        pair.games.sort((a, b) => {
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
            listItem.textContent = `Fecha: ${game.date}, Ganador: ${game.winner}, Década: ${decadeNames[game.decade] || game.decade}, Categoría: ${categoryNames[game.category] || game.category}`;
            detailsList.appendChild(listItem);
        });

        duelList.appendChild(duelSummaryDiv);
    }
}

// =====================================================================
// FUNCIONES DE PANTALLA DE LISTADO DE CANCIONES (ACTUALIZADAS para décadas y categorías)
// =====================================================================

function showSongsListCategorySelection() {
    showScreen('songs-list-category-screen');
    const container = document.getElementById('songs-list-category-buttons');
    container.innerHTML = '';

    const decadesOrder = ['60s', '70s', '80s', '90s', '00s', '10s', 'Actual', 'Variadas', 'Todas']; 

    decadesOrder.forEach(decadeId => {
        // Para la opción "Todas", solo mostrarla como una categoría general
        if (decadeId === 'Todas') {
            const allButtonDiv = document.createElement('div');
            allButtonDiv.style.gridColumn = '1 / -1'; // Para que ocupe todo el ancho
            allButtonDiv.style.marginTop = '20px';
            const allButton = document.createElement('button');
            allButton.className = 'category-btn tertiary';
            allButton.innerText = decadeNames[decadeId];
            allButton.onclick = () => displaySongsForCategory(decadeId, 'consolidated'); // Usar 'consolidated' como categoría especial
            allButtonDiv.appendChild(allButton);
            container.appendChild(allButtonDiv);
            return; // No procesar más categorías para 'Todas' aquí
        }

        const decadeCategorySongs = configuracionCanciones[decadeId];
        if (decadeCategorySongs) {
            const decadeHeader = document.createElement('h3');
            decadeHeader.textContent = decadeNames[decadeId];
            decadeHeader.style.color = 'var(--secondary-color)';
            decadeHeader.style.marginTop = '20px';
            decadeHeader.style.marginBottom = '10px';
            container.appendChild(decadeHeader);

            const categoryButtonsForDecadeDiv = document.createElement('div');
            categoryButtonsForDecadeDiv.style.display = 'grid';
            categoryButtonsForDecadeDiv.style.gridTemplateColumns = '1fr 1fr';
            categoryButtonsForDecadeDiv.style.gap = '10px';
            container.appendChild(categoryButtonsForDecadeDiv);

            const categoryOrder = ['espanol', 'ingles', 'peliculas', 'series', 'tv', 'infantiles', 'anuncios'];

            categoryOrder.forEach(categoryId => {
                const songsArray = decadeCategorySongs[categoryId];
                if (Array.isArray(songsArray) && songsArray.length > 0) { // Asegurarse de que sea un array y tenga contenido
                    const button = document.createElement('button');
                    button.className = 'category-btn';
                    button.innerText = categoryNames[categoryId];
                    button.onclick = () => displaySongsForCategory(decadeId, categoryId);
                    categoryButtonsForDecadeDiv.appendChild(button);
                }
            });
        }
    });
}

async function displaySongsForCategory(decadeId, categoryId) {
    let songsToDisplay;

    try {
        if (decadeId === 'Todas') {
            await loadSongsForDecadeAndCategory('Todas', 'consolidated'); // Carga/consolida todas las canciones
            songsToDisplay = configuracionCanciones['Todas']['consolidated'];
        } else {
            await loadSongsForDecadeAndCategory(decadeId, categoryId); // Carga la específica
            songsToDisplay = configuracionCanciones[decadeId][categoryId];
        }
    } catch (error) {
        alert(`No se pudo cargar la lista de canciones para ${decadeNames[decadeId]} - ${categoryNames[categoryId]}.`);
        console.error(error);
        showScreen('songs-list-category-screen');
        return;
    }

    const songsListContainer = document.getElementById('songs-list-container');
    const songsListCategoryTitle = document.getElementById('songs-list-category-title');

    songsListContainer.innerHTML = '';
    songsListCategoryTitle.textContent = `Canciones de ${decadeNames[decadeId]} - ${categoryNames[categoryId]}`;

    if (!songsToDisplay || songsToDisplay.length === 0) {
        songsListContainer.innerHTML = '<p>No hay canciones en esta categoría para la década seleccionada.</p>';
        showScreen('songs-list-display-screen');
        return;
    }

    const groupedSongs = {};
    const sortedSongs = [...songsToDisplay].sort((a, b) => {
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

    const alphaIndexDiv = document.createElement('div');
    alphaIndexDiv.className = 'alpha-index';
    songsListContainer.appendChild(alphaIndexDiv);

    const sortedLetters = Object.keys(groupedSongs).sort();
    sortedLetters.forEach(letter => {
        const link = document.createElement('a');
        link.href = `#letter-${letter}`;
        link.textContent = letter;
        alphaIndexDiv.appendChild(link);
    });

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

            if (song.listenUrl && song.listenUrl.length > 5 && !song.listenUrl.includes('URL_DE_BÚSQUEDA_PENDIENTE')) {
                const listenBtn = document.createElement('button');
                listenBtn.className = 'btn small-listen-btn';
                
                let icon = '▶';
                let bgColor = '#FF0000';
                let shadowColor = '#FF0000';

                if (song.platform === 'spotify') {
                    icon = '🎧';
                    bgColor = '#1DB954';
                    shadowColor = '#1DB954';
                }

                listenBtn.innerHTML = icon;
                listenBtn.onclick = () => window.open(song.listenUrl, '_blank');
                listenBtn.style.backgroundImage = `linear-gradient(45deg, ${bgColor}, ${shadowColor})`;
                listenBtn.style.boxShadow = `0 0 5px ${shadowColor}`;
                
                songDiv.appendChild(listenBtn);
            } else {
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
    
// =====================================================================
// INICIALIZACIÓN (Modificada para gestionar sesión)
// =====================================================================

window.onload = async () => {
    generateCategoryButtons();
    const loggedInUserEmail = localStorage.getItem('loggedInUserEmail');

    if (loggedInUserEmail) {
        try {
            // *** ESTA ES LA LÓGICA CORRECTA PARA CARGAR EL USUARIO DESDE LA API ***
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