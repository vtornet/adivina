const decadeNames = {
    '80s': 'Década de los 80',
    '90s': 'Década de los 90',
    '00s': 'Década de los 2000',
    '10s': 'Década de los 2010',
    'Actual': 'Década Actual', // 2020s en adelante
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
let userAccumulatedScores = {}; 
let gameHistory = []; 

function getCurrentUserData() {
    const userDataString = localStorage.getItem("userData");
    if (!userDataString) return null;
    return JSON.parse(userDataString);
}

// main.js - Función showScreen
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');

    // Si es la pantalla de crear partida online, cargar selects
    if (screenId === 'create-online-screen') {
        populateOnlineSelectors();
    }
    if (screenId === 'invite-online-screen') {
        populateInviteSelectors();
    }
    // MODIFICACIÓN CLAVE AQUÍ:
    if (screenId === 'pending-games-screen' || screenId === 'online-mode-screen') { //
        loadPlayerOnlineGames(); //
    }
}

// =====================================================================
// FUNCIONES DE AUTENTICACIÓN (Registro y Login)
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
            localStorage.setItem('userData', JSON.stringify(currentUser));

            alert(`¡Bienvenido, ${currentUser.playerName || currentUser.email}!`);
            emailInput.value = '';
            passwordInput.value = '';

            await loadUserScores(currentUser.email);
            await loadGameHistory(currentUser.email);

            if (currentUser.playerName) {
                showScreen('decade-selection-screen'); 
                // AHORA: Llamamos a generateDecadeButtons solo cuando sabemos que vamos a esa pantalla
                generateDecadeButtons(); 
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
    localStorage.removeItem('userData'); // <-- AÑADE ESTA LÍNEA
    localStorage.removeItem('currentOnlineGameData'); // <-- AÑADE ESTA LÍNEA
    alert('Sesión cerrada correctamente.');
    showScreen('home-screen');
}

// main.js - Nuevas funciones para borrar historial de partidas online
function confirmClearOnlineGameHistory() {
    const confirmed = confirm("¿Estás seguro de que quieres borrar TODO tu historial de partidas online? Esta acción es irreversible.");
    if (confirmed) {
        clearOnlineGameHistory();
    }
}

async function clearOnlineGameHistory() {
    const playerData = getCurrentUserData();
    if (!playerData || !playerData.email) {
        alert("Debes iniciar sesión para borrar tu historial.");
        showScreen('login-screen');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/online-games/clear-history/${playerData.email}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (response.ok) {
            alert(result.message);
            loadPlayerOnlineGames(); // Recargar la lista de partidas para mostrar el cambio
        } else {
            alert(`Error al borrar historial: ${result.message}`);
        }
    } catch (error) {
        console.error('Error de red al borrar historial de partidas online:', error);
        alert('Error de conexión. Intenta de nuevo más tarde.');
    }
}

// main.js - Función endOnlineModeAndGoHome
// main.js - Función endOnlineModeAndGoHome
function endOnlineModeAndGoHome() {
    if (isOnlineMode) {
        isOnlineMode = false;
        currentOnlineGameCode = null;
        currentOnlineSongs = [];
        currentOnlineEmail = null;
        currentOnlinePlayerName = null;
        localStorage.removeItem('currentOnlineGameData');
        // Redirigir a la selección de década cuando se sale del modo online por este botón
        showScreen('decade-selection-screen'); // <--- DEBE SER ESTA LÍNEA
    } else {
        // Lógica para el modo offline, volver a la selección de década/categoría
        if (gameState.selectedDecade === 'Todas') {
            showScreen('decade-selection-screen');
        } else {
            showScreen('category-screen');
        }
    }
}

const RECENT_SONGS_HISTORY_LENGTH = 8; // Número de partidas hacia atrás para evitar repeticiones

function updateRecentSongsHistory(userEmail, decade, category, playedSongs) {
    if (!userEmail) return;

    const storageKey = `recentSongs_${userEmail}`;
    let history = JSON.parse(localStorage.getItem(storageKey)) || {};

    // Asegurarse de que la estructura para la década y categoría exista
    history[decade] = history[decade] || {};
    history[decade][category] = history[decade][category] || [];

    // Añadir las nuevas canciones jugadas al historial de esta categoría
    const newSongFiles = playedSongs.map(song => song.file);
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
function getRecentSongs(userEmail, decade, category) {
    if (!userEmail) return new Set();

    const storageKey = `recentSongs_${userEmail}`;
    const history = JSON.parse(localStorage.getItem(storageKey)) || {};

    if (history[decade] && history[decade][category]) {
        return new Set(history[decade][category]);
    }
    return new Set();
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
                localStorage.setItem("userData", JSON.stringify(currentUser));
                alert(data.message);
                playerNameInput.value = '';
                showScreen('decade-selection-screen');
                generateDecadeButtons();
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

/**
 * Genera y muestra los botones de selección de década.
 */
async function generateDecadeButtons() { // Convertir a async
    const container = document.getElementById('decade-buttons');
    container.innerHTML = '';
    // Definimos las décadas que queremos mostrar y que esperamos tener archivos .js
    const decadesOrder = ['80s', '90s', '00s', '10s', 'Actual']; 
    let generationPromises = [];

    decadesOrder.forEach(decadeId => {
        // Para cada década, intentamos cargar una categoría principal para ver si hay contenido.
        // Asumimos 'espanol' como la primera categoría para verificar.
        // Si no existe 'espanol.js' o no tiene 4 canciones, esta década no se mostrará.
        const representativeCategory = 'espanol'; // O 'peliculas', la que sea más común
        
        // No cargamos todo el contenido de la década aquí, solo intentamos cargar un archivo representativo
        // para poblar `configuracionCanciones[decadeId][representativeCategory]`
        generationPromises.push(
            loadSongsForDecadeAndCategory(decadeId, representativeCategory)
            .then(() => {
                // Una vez cargada la categoría representativa, verificamos si la década tiene suficientes canciones
                const songsInRepresentativeCat = configuracionCanciones[decadeId] && configuracionCanciones[decadeId][representativeCategory]
                                                ? configuracionCanciones[decadeId][representativeCategory].length : 0;
                
                if (songsInRepresentativeCat >= 4) {
                    const button = document.createElement('button');
                    button.className = 'category-btn'; 
                    button.innerText = decadeNames[decadeId];
                    button.onclick = () => selectDecade(decadeId);
                    container.appendChild(button);
                } else {
                    console.warn(`Década ${decadeId} - Categoría ${representativeCategory} tiene menos de 4 canciones. No se mostrará el botón de la década.`);
                }
            })
            .catch(error => {
                console.warn(`No se pudo cargar la categoría representativa (${representativeCategory}) para la década ${decadeId}. No se mostrará el botón de la década.`, error);
            })
        );
    });

    // Esperar a que todos los intentos de generación de botones de décadas terminen
    await Promise.allSettled(generationPromises);

    // Añadir el botón "Todas"
    // Lo hacemos aparecer siempre, y loadAllSongs() se encargará de consolidar las disponibles.
    // Verificamos al inicio de startGame si hay suficientes en total.
    const allButton = document.createElement('button');
    allButton.className = 'category-btn tertiary'; 
    allButton.innerText = decadeNames['Todas'];
    allButton.onclick = () => selectDecade('Todas');
    container.appendChild(allButton);
}

/**
 * Maneja la selección de una década y redirige a la pantalla de categoría o de jugadores.
 * @param {string} decade - La década seleccionada.
 */
async function selectDecade(decade) {
    if (!currentUser || !currentUser.playerName) {
        alert('Debes iniciar sesión y establecer tu nombre de jugador para continuar.');
        showScreen('login-screen');
        return;
    }
    gameState.selectedDecade = decade;
    
    if (decade === 'Todas') {
        gameState.category = 'consolidated'; // Categoría especial para "Todas"
        try {
            await loadSongsForDecadeAndCategory('Todas', 'consolidated'); // Carga/consolida todas las canciones
            // Verificar que hay suficientes canciones para empezar una partida en modo "Todas"
            // (10 preguntas por jugador, por lo tanto, mínimo 10 canciones si hay 1 jugador)
            if (configuracionCanciones['Todas']['consolidated'].length < gameState.totalQuestionsPerPlayer) {
                alert(`No hay suficientes canciones para jugar en la opción '${decadeNames['Todas']}'. Necesitas al menos ${gameState.totalQuestionsPerPlayer} canciones en total.`);
                showScreen('decade-selection-screen'); // Vuelve si no hay suficientes
                return;
            }
            showScreen('player-selection-screen');
        } catch (error) {
            alert('Error al cargar todas las canciones. Intenta de nuevo.');
            console.error(error);
            showScreen('decade-selection-screen'); // Volver a la selección de década
        }
    } else {
        // *** INICIO DE LA MODIFICACIÓN ***
        // Antes de mostrar la pantalla de categorías, cargamos todas las categorías de la década.
        const categoriesToLoadPromises = allPossibleCategories.map(cat => 
            loadSongsForDecadeAndCategory(decade, cat).catch(error => {
                console.warn(`No se pudo cargar la categoría ${cat} para la década ${decade}. Puede que no haya canciones o un error de archivo.`, error);
                return null; // Retorna null para que Promise.allSettled no falle por una única categoría.
            })
        );
        
        await Promise.allSettled(categoriesToLoadPromises);
        // *** FIN DE LA MODIFICACIÓN ***

        generateCategoryButtons(); // Genera los botones de categoría para la década seleccionada
        showScreen('category-screen');
    }
}

/**
 * Genera y muestra los botones de categoría para la década seleccionada.
 */
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

/**
 * Maneja la selección de una categoría, carga las canciones y redirige a la pantalla de selección de jugadores.
 * @param {string} category - La categoría seleccionada.
 */
async function selectCategory(category) {
    if (!currentUser || !currentUser.playerName) {
        alert('Debes iniciar sesión y establecer tu nombre de jugador para continuar.');
        showScreen('login-screen');
        return;
    }
    gameState.category = category;

    try {
        await loadSongsForDecadeAndCategory(gameState.selectedDecade, gameState.category);
        // Verificar si la categoría tiene suficientes canciones después de la carga
        if (configuracionCanciones[gameState.selectedDecade][gameState.category].length < 4) {
            alert(`No hay suficientes canciones en la categoría '${categoryNames[category]}' para la década ${decadeNames[gameState.selectedDecade]}. Necesitas al menos 4 canciones.`);
            showScreen('category-screen'); // Volver a la selección de categoría
            return;
        }
        showScreen('player-selection-screen');
    }  catch (error) {
        alert(`No se pudieron cargar las canciones para la categoría ${categoryNames[category]} en la década ${decadeNames[gameState.selectedDecade]}. Intenta con otra.`);
        console.error(error);
        showScreen('category-screen');
    }
}

/**
 * Permite al usuario seleccionar el número de jugadores y prepara los inputs para sus nombres.
 * @param {number} numPlayers - El número de jugadores seleccionado.
 */
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

/**
 * Inicia una nueva partida, configurando jugadores y preguntas.
 */
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
    
    // ... (dentro de startGame function)

    // Obtener el historial de canciones recientes para el usuario y la categoría/década actuales
    const recentSongFiles = getRecentSongs(currentUser.email, gameState.selectedDecade, gameState.category);
    console.log("Canciones recientes a evitar:", recentSongFiles);

    // Separar canciones en "no recientes" y "recientes"
    let nonRecentSongs = allSongsToChooseFrom.filter(song => !recentSongFiles.has(song.file));
    let recentSongs = allSongsToChooseFrom.filter(song => recentSongFiles.has(song.file));

    console.log("Canciones no recientes:", nonRecentSongs.length);
    console.log("Canciones recientes (para usar si es necesario):", recentSongs.length);

    // Priorizar canciones no recientes, luego añadir de las recientes si no hay suficientes
    let songsForThisGame = nonRecentSongs.sort(() => 0.5 - Math.random()); // Baraja las no recientes

    const totalRequiredSongs = requiredSongs; // Usamos la variable ya calculada

    // Si no hay suficientes canciones "no recientes", añadimos de las "recientes"
    if (songsForThisGame.length < totalRequiredSongs) {
        const needed = totalRequiredSongs - songsForThisGame.length;
        // Barajamos las recientes y tomamos las más antiguas (si el slice(-maxSongsInHistory) funcionó bien)
        // O simplemente tomamos las que queden para asegurar la cantidad
        const additionalSongs = recentSongs.sort(() => 0.5 - Math.random()).slice(0, needed); 
        songsForThisGame = songsForThisGame.concat(additionalSongs);
        console.warn(`Advertencia: No hay suficientes canciones no recientes. Se han añadido ${additionalSongs.length} canciones recientes.`);
    }

    // Asegurarse de que el array final esté barajado si se combinaron listas
    songsForThisGame.sort(() => 0.5 - Math.random());

    // Asignar preguntas a los jugadores
    for (let i = 0; i < gameState.playerCount; i++) {
        if (songsForThisGame.length >= gameState.totalQuestionsPerPlayer) {
            gameState.players[i].questions = songsForThisGame.splice(0, gameState.totalQuestionsPerPlayer);
        } else {
            gameState.players[i].questions = [...songsForThisGame];
            console.warn(`No se pudieron asignar ${gameState.totalQuestionsPerPlayer} preguntas al jugador ${gameState.players[i].name}. Solo se asignaron ${songsForThisGame.length} preguntas.`);
            songsForThisGame = [];
            gameState.totalQuestionsPerPlayer = gameState.players[i].questions.length; // Ajusta si se asignan menos
        }
    }

    gameState.currentPlayerIndex = 0;
    setupQuestion();
    showScreen('game-screen');

    // **IMPORTANTE**: Actualizar el historial de canciones recientes DESPUÉS de que la partida comience
    // y se asignen las canciones.
    // Esto se hará cuando la partida termine en `endGame()` o cuando un turno de jugador finalice.
    // Para simplificar, lo haremos al final de la partida en `endGame()`.
}

/**
 * Configura la siguiente pregunta del juego.
 */
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
            console.error(`Error: Opciones de canciones no encontradas para ${gameState.selectedDecade} - ${gameState.category}.`);
            alert('Error interno al cargar las opciones de respuesta. Intenta de nuevo.');
            showScreen('decade-selection-screen'); 
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

/**
 * Actualiza el contador de intentos y su color.
 */
function updateAttemptsCounter() {
    const counter = document.getElementById('attempts-counter');
    counter.innerText = `Intentos: ${gameState.attempts}`;
    if (gameState.attempts === 3) counter.style.backgroundColor = 'var(--correct-color)';
    else if (gameState.attempts === 2) counter.style.backgroundColor = 'var(--warning-color)';
    else counter.style.backgroundColor = 'var(--incorrect-color)';
}

/**
 * Reproduce un fragmento de audio de la canción actual.
 */
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
        return; 
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

/**
 * Verifica la respuesta del jugador.
 * @param {boolean} isCorrect - True si la respuesta es correcta, false si es incorrecta.
 * @param {HTMLElement} button - El botón de respuesta que se pulsó.
 */
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

/**
 * Avanza al siguiente jugador o finaliza la partida si todos han jugado.
 */
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

/**
 * Continúa el turno del siguiente jugador después de una pantalla de transición.
 */
function continueToNextPlayerTurn() {
    setupQuestion();
    showScreen('game-screen');
}

/**
 * Finaliza la partida, calcula el ganador y guarda los resultados.
 */
function endGame() {
    if (isOnlineMode) {
        submitOnlineScore(); // Si es online, envía la puntuación al servidor y espera/muestra resultados
        return; // Detener la ejecución de esta función
    }

    const finalScoresContainer = document.getElementById('final-scores');
    finalScoresContainer.innerHTML = '<h3>Puntuaciones Finales</h3>';
    const winnerDisplay = document.getElementById('winner-display');

    // === MODIFICACIÓN CLAVE: Definir sortedPlayers aquí ===
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
    // ====================================================

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
    // ... (dentro de endGame function, casi al final)
    // Recopilar todas las canciones jugadas en esta partida por todos los jugadores
    let allPlayedSongsInThisGame = [];
    gameState.players.forEach(player => {
        allPlayedSongsInThisGame = allPlayedSongsInThisGame.concat(player.questions);
    });

    // Actualizar el historial de canciones recientes para el usuario logueado
    if (currentUser && currentUser.email) {
        updateRecentSongsHistory(currentUser.email, gameState.selectedDecade, gameState.category, allPlayedSongsInThisGame);
    }

    showScreen('end-game-screen');
}

/**
 * Permite al usuario salir del juego después de una confirmación.
 */
function exitGame() {
    const confirmed = confirm('¿Seguro que quieres salir del juego? Se cerrará la sesión actual.');
    if (confirmed) {
        logout();
    }
}

/**
 * Confirma si el usuario desea regresar al menú principal, perdiendo el progreso de la partida actual.
 */
// main.js - confirmReturnToMenu
function confirmReturnToMenu() {
    const confirmed = confirm("¿Estás seguro de que quieres volver al menú principal? Perderás el progreso de esta partida.");
    if (confirmed) {
        if (isOnlineMode) { // <-- AÑADE ESTA CONDICIÓN
            // Limpiar estado online al salir
            isOnlineMode = false;
            currentOnlineGameCode = null;
            currentOnlineSongs = [];
            currentOnlineEmail = null;
            currentOnlinePlayerName = null;
            localStorage.removeItem('currentOnlineGameData');
            showScreen('online-mode-screen'); // Volver al menú online
        } else {
            if (gameState.selectedDecade === 'Todas') {
                showScreen('decade-selection-screen');
            } else {
                showScreen('category-screen');
            }
        }
    }
}

// =====================================================================
// FUNCIONES DE PANTALLA DE ESTADÍSTICAS (ACTUALIZADAS para décadas y categorías)
// =====================================================================

/**
 * Muestra la pantalla de estadísticas del usuario actual.
 */
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

/**
 * Renderiza las puntuaciones totales del usuario por década y categoría.
 */
function renderUserTotalScores() {
    const categoryScoresList = document.getElementById('category-scores-list');
    categoryScoresList.innerHTML = '';

    const userScores = userAccumulatedScores[currentUser.email];

    if (!userScores || Object.keys(userScores).length === 0) {
        categoryScoresList.innerHTML = '<p style="color: var(--text-color);">Aún no tienes puntos acumulados. ¡Juega para empezar a sumar!</p>';
        return;
    }

    const decadesInOrder = ['80s', '90s', '00s', '10s', 'Actual', 'Todas']; // Orden de las décadas a mostrar
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


/**
 * Renderiza el historial de duelos del usuario.
 */
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
            // Usa .slice() para crear una copia de los jugadores antes de ordenar, para no modificar el original
            duelPairs[pairKey] = { players: game.players.slice().sort((a,b) => a.name.localeCompare(b.name)), games: [] }; 
        }
        duelPairs[pairKey].games.push(game);
    });

    for (const key in duelPairs) {
        const pair = duelPairs[key];
        // Asegúrate de que p1Obj y p2Obj sean objetos con la propiedad 'name'
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

/**
 * Muestra la pantalla para seleccionar una categoría y década para ver el listado de canciones.
 */
function showSongsListCategorySelection() {
    showScreen('songs-list-category-screen');
    const container = document.getElementById('songs-list-category-buttons');
    container.innerHTML = '';

    const decadesOrder = ['80s', '90s', '00s', '10s', 'Actual', 'Todas']; // Solo las décadas que quieres mostrar aquí

    decadesOrder.forEach(decadeId => {
        if (decadeId === 'Todas') {
            const allButtonDiv = document.createElement('div');
            allButtonDiv.style.gridColumn = '1 / -1'; 
            allButtonDiv.style.marginTop = '20px';
            const allButton = document.createElement('button');
            allButton.className = 'category-btn tertiary';
            allButton.innerText = decadeNames[decadeId];
            allButton.onclick = () => displaySongsForCategory(decadeId, 'consolidated');
            allButtonDiv.appendChild(allButton);
            container.appendChild(allButtonDiv);
            return; 
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
                if (Array.isArray(songsArray) && songsArray.length > 0) { 
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

/**
 * Muestra la lista de canciones para una década y categoría específicas.
 * @param {string} decadeId - La década de las canciones a mostrar.
 * @param {string} categoryId - La categoría de las canciones a mostrar.
 */
async function displaySongsForCategory(decadeId, categoryId) {
    let songsToDisplay;

    try {
        if (decadeId === 'Todas') {
            await loadSongsForDecadeAndCategory('Todas', 'consolidated'); 
            songsToDisplay = configuracionCanciones['Todas']['consolidated'];
        } else {
            await loadSongsForDecadeAndCategory(decadeId, categoryId); 
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
            textContent.innerHTML = `<strong>${parseDisplay(song.display).artist}</strong>${parseDisplay(song.display).title ? `<br>${parseDisplay(song.display).title}` : ''}`;
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

// ========== VARIABLES PARA EL MODO ONLINE ==========
let currentOnlineGameCode = null;
let currentOnlineSongs = [];
let currentOnlineEmail = null;
let currentOnlinePlayerName = null;
let isOnlineMode = false;

// ========== CREAR PARTIDA ONLINE ==========
async function createOnlineGame() {
    const decade = document.getElementById('online-decade-select').value;
    const category = document.getElementById('online-category-select').value;

    const playerData = getCurrentUserData(); // <-- OBTENER DATOS AQUÍ
    if (!playerData || !playerData.email || !playerData.playerName) {
        alert("Debes iniciar sesión con tu nombre de jugador para crear partidas online.");
        showScreen('login-screen'); // <-- Redirigir a login si no está logueado
        return;
    }

    const songsArray = await getSongsForOnlineMatch(decade, category);
    if (!songsArray || songsArray.length < 10) {
        alert("No hay suficientes canciones en esta categoría para crear una partida (mínimo 10).");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/online-games`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creatorEmail: playerData.email,
                category,
                decade,
                songsUsed: songsArray,
                playerName: playerData.playerName // Asegurarse de enviar el playerName
            })
        });

        const result = await response.json();
        if (response.ok) {
            currentOnlineGameCode = result.code;
            currentOnlineSongs = songsArray;
            currentOnlineEmail = playerData.email;
            currentOnlinePlayerName = playerData.playerName;
            isOnlineMode = true;

            localStorage.setItem('currentOnlineGameData', JSON.stringify({
                code: result.code,
                songsUsed: songsArray,
                decade: decade, // <-- AÑADE ESTO
                category: category // <-- AÑADE ESTO
    }));

            alert(`Partida creada con éxito. Comparte este código con tu amigo: ${currentOnlineGameCode}`);
            startOnlineGame();
        } else {
            alert(result.message || 'Error al crear la partida.');
        }
    } catch (err) {
        console.error(err);
        alert('Error al crear la partida online. Por favor, revisa tu conexión o intenta de nuevo.'); 
    }
}

// ========== UNIRSE A UNA PARTIDA ONLINE ==========
async function joinOnlineGame() {
    const code = document.getElementById('join-code-input').value.trim().toUpperCase();
    if (!code) return alert("Introduce un código válido.");

    const playerData = getCurrentUserData(); // <-- OBTENER DATOS AQUÍ
    if (!playerData || !playerData.email || !playerData.playerName) { // <<-- ¡CUIDADO! AQUÍ DICE 'player.playerName', debe ser playerData.playerName
        alert("Debes iniciar sesión con tu nombre de jugador para jugar online.");
        showScreen('login-screen'); // <-- Redirigir a login si no está logueado
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/online-games/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code,
                playerName: playerData.playerName,
                email: playerData.email
            })
        });

        const result = await response.json();
        if (response.ok) {
            currentOnlineGameCode = code;
            currentOnlineSongs = result.game.songsUsed;
            currentOnlineEmail = playerData.email;
            currentOnlinePlayerName = playerData.playerName;
            isOnlineMode = true;
            localStorage.setItem('currentOnlineGameData', JSON.stringify({
                code: code,
                songsUsed: result.game.songsUsed,
                decade: result.game.decade, // <-- AÑADE ESTO
                category: result.game.category // <-- AÑADE ESTO
            }));
            startOnlineGame();
        } else {
            alert(result.message || 'Error al unirse a la partida.');
        }
    } catch (err) {
        console.error(err);
        alert('Error al unirse a la partida.');
    }
}

// main.js - AÑADE ESTA NUEVA FUNCIÓN COMPLETA
// Nueva función para unirse a una partida pendiente (reutiliza lógica de joinOnlineGame)
// main.js - Función joinOnlineGameFromPending (VERIFICAR ESTA LÍNEA)
async function joinOnlineGameFromPending(code, playerName, email) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/online-games/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: code,
                playerName: playerName,
                email: email
            })
        });

        const result = await response.json(); // result es { game: {...} }
        if (response.ok) {
            // Si la unión es exitosa, establece las variables de juego online
            currentOnlineGameCode = code;
            currentOnlineSongs = result.game.songsUsed; // <-- VERIFICA ESTA LÍNEA. Si el server devuelve { game: {...} }, entonces es result.game.songsUsed
            currentOnlineEmail = email;
            currentOnlinePlayerName = playerName;
            isOnlineMode = true;

            // Guardar info del juego online para usarla en startOnlineGame
            localStorage.setItem('currentOnlineGameData', JSON.stringify({
                code: code,
                songsUsed: result.game.songsUsed, // <-- VERIFICA ESTA LÍNEA
                decade: result.game.decade,
                category: result.game.category
            }));

            startOnlineGame(); // Inicia el juego
        } else {
            alert(result.message || 'Error al unirse a la partida pendiente.');
            loadPlayerOnlineGames(); // Recarga la lista por si el estado cambió
        }
    } catch (err) {
        console.error('Error de red al unirse a la partida pendiente:', err);
        alert('Error de conexión. Intenta de nuevo más tarde.');
    }
}

// ========== OBTENER CANCIONES PARA LA PARTIDA ONLINE ==========
async function getSongsForOnlineMatch(decade, category) {
    await loadSongsForDecadeAndCategory(decade, category);
    const songs = configuracionCanciones[decade][category];
    const shuffled = [...songs].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 10);
}

// ========== EMPEZAR PARTIDA ONLINE ==========
// main.js - startOnlineGame
function startOnlineGame() {
    // Reiniciar el gameState para una partida online
    gameState = {
        players: [],
        totalQuestionsPerPlayer: 10, // Por ahora, fijo para online
        currentPlayerIndex: 0,
        selectedDecade: null,
        category: null,
        isOnline: true, // Indica que es una partida online
        onlineGameCode: currentOnlineGameCode // Almacenar el código aquí también
    };

    const localPlayer = {
        id: 1,
        name: currentOnlinePlayerName,
        score: 0,
        questionsAnswered: 0,
        questions: currentOnlineSongs, // Las canciones ya vienen del servidor
        email: currentOnlineEmail,
        finishedOnline: false // Nuevo campo para controlar el estado online del jugador
    };
    gameState.players.push(localPlayer);

    // Si es una partida de dos jugadores, necesitaríamos al rival aquí.
    // Por ahora, solo tenemos al jugador local, la lógica del rival se manejará en el submit/poll
    // (La lógica del rival en el cliente puede ser más compleja o se maneja desde el servidor al comparar scores)

    // Configurar la primera pregunta
    // La información de decade y category debe venir con currentOnlineGame
    // Para esto, necesitaríamos que `joinOnlineGameFromPending` pase también la década y categoría.
    // O que `currentOnlineGame` las almacene globalmente.

    // Añadir decade y category a gameState desde el juego online
    const gameData = JSON.parse(localStorage.getItem('currentOnlineGameData')); // Recuperar datos del juego
    if (gameData) {
        gameState.selectedDecade = gameData.decade;
        gameState.category = gameData.category;
    } else {
        console.error("No se encontraron datos de la partida online en localStorage.");
        alert("Error: No se pudo cargar la información de la década/categoría para la partida online.");
        showScreen('online-mode-screen');
        return;
    }


    setupQuestion();
    showScreen('game-screen');
}

// ========== ENVIAR RESULTADO AL TERMINAR ==========
async function submitOnlineScore() {
    // Asegurarse de que tenemos los datos del jugador actual
    const localPlayer = gameState.players.find(p => p.email === currentOnlineEmail);
    if (!localPlayer) {
        console.error("Error: Jugador local no encontrado en gameState para submitOnlineScore.");
        alert("Error interno al enviar la puntuación.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/online-games/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: currentOnlineGameCode,
                email: localPlayer.email, // Usar el email del jugador del gameState
                score: localPlayer.score // Usar la puntuación del jugador del gameState
            })
        });

        const result = await response.json();
        if (response.ok) {
            if (result.finished) {
                // Si ambos jugadores terminaron, mostrar resultados
                // Aquí llamaremos a una función de final de juego online
                showOnlineResults(result.game); // Nueva función para resultados online
            } else {
                // Si el otro jugador aún no termina, esperar
                showScreen('online-wait-screen');
                pollOnlineGameStatus();
            }
        } else {
            alert(result.message || 'Error al enviar resultado.');
        }
    } catch (err) {
        console.error(err);
        alert('Error al guardar la puntuación online.');
    }
}

function pollOnlineGameStatus() {
    const interval = setInterval(async () => {
        try {
            // currentOnlineGameCode debe estar disponible globalmente
            if (!currentOnlineGameCode) {
                clearInterval(interval);
                console.error("No hay código de partida online para consultar.");
                // Podríamos redirigir a una pantalla de error o menú principal aquí
                showScreen('online-mode-screen');
                return;
            }

            const response = await fetch(`${API_BASE_URL}/api/online-games/${currentOnlineGameCode}`);
            const result = await response.json();

            if (!response.ok) {
                console.error('Error al consultar estado de partida:', result.message);
                // Podrías mostrar una alerta o simplemente dejar que siga intentando
                return;
            }

            if (result.finished) {
                clearInterval(interval); // Detener la consulta
                // Aquí, ambos jugadores han terminado. Mostrar los resultados.
                showOnlineResults(result); // result ya contiene game.players, game.decade, etc.
            } else {
                // Si aún no han terminado, podríamos actualizar el estado en pantalla si quisiéramos
                // Por ahora, el mensaje "Esperando..." es suficiente.
                console.log("Esperando al otro jugador...");
            }
        } catch (err) {
            console.error('Error de red al comprobar estado online:', err);
            // Si hay un error de red persistente, podríamos ofrecer una opción al usuario.
            // clearInterval(interval); // No limpiar el intervalo en errores de red temporales.
        }
    }, 3000); // Comprueba cada 3 segundos (antes 5 segundos, 3 es más rápido)
}

function populateOnlineSelectors() {
    const decadeSelect = document.getElementById('online-decade-select');
    const categorySelect = document.getElementById('online-category-select');

    const decades = ['80s', '90s', '00s', '10s', 'Actual'];
    const categories = [
        { value: 'espanol', text: 'Canciones en Español' },
        { value: 'ingles', text: 'Canciones en Inglés' },
        { value: 'peliculas', text: 'Bandas Sonoras de Películas' },
        { value: 'series', text: 'Intros de Series' },
        { value: 'infantiles', text: 'Series y Programas Infantiles' },
        { value: 'anuncios', text: 'Anuncios de TV' },
        { value: 'tv', text: 'Programas de Televisión' }
    ];

    // Limpiar y añadir décadas
    decadeSelect.innerHTML = '';
    decades.forEach(dec => {
        const option = document.createElement('option');
        option.value = dec;
        option.textContent = dec;
        decadeSelect.appendChild(option);
    });

    // Limpiar y añadir categorías
    categorySelect.innerHTML = '';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.value;
        option.textContent = cat.text;
        categorySelect.appendChild(option);
    });
}

async function saveOnlineGameToHistory(gameData) {
    try {
        const payload = {
            date: new Date().toISOString(),
            players: gameData.players,
            winner: getWinnerName(gameData.players),
            decade: gameData.decade,
            category: gameData.category
        };

        await fetch(`${API_BASE_URL}/api/gamehistory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

    } catch (err) {
        console.error("Error al guardar historial online:", err);
    }
}

function getWinnerName(players) {
    if (players.length !== 2) return "Desconocido";
    const [a, b] = players;
    if (a.score > b.score) return a.name;
    if (b.score > a.score) return b.name;
    return "Empate";
}

function populateInviteSelectors() {
    const decadeSelect = document.getElementById('invite-decade-select');
    const categorySelect = document.getElementById('invite-category-select');

    const decades = ['80s', '90s', '00s', '10s', 'Actual'];
    const categories = [
        { value: 'espanol', text: 'Canciones en Español' },
        { value: 'ingles', text: 'Canciones en Inglés' },
        { value: 'peliculas', text: 'Bandas Sonoras de Películas' },
        { value: 'series', text: 'Intros de Series' },
        { value: 'infantiles', text: 'Series y Programas Infantiles' },
        { value: 'anuncios', text: 'Anuncios de TV' },
        { value: 'tv', text: 'Programas de Televisión' }
    ];

    decadeSelect.innerHTML = '';
    decades.forEach(dec => {
        const option = document.createElement('option');
        option.value = dec;
        option.textContent = dec;
        decadeSelect.appendChild(option);
    });

    categorySelect.innerHTML = '';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.value;
        option.textContent = cat.text;
        categorySelect.appendChild(option);
    });
}

async function invitePlayerByName() {
    const rivalName = document.getElementById('rival-name-input').value.trim();
    const decade = document.getElementById('invite-decade-select').value;
    const category = document.getElementById('invite-category-select').value;

     const playerData = getCurrentUserData(); // <-- OBTENER DATOS AQUÍ
    if (!rivalName || !playerData || !playerData.email || !playerData.playerName) {
        alert("Faltan datos o no estás logueado con un nombre de jugador.");
        showScreen('login-screen'); // <-- Redirigir a login si no está logueado
        return;
    }

    const songsArray = await getSongsForOnlineMatch(decade, category);
    if (!songsArray || songsArray.length < 10) {
        alert("No hay suficientes canciones.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/online-games/by-username`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creatorEmail: playerData.email,
                rivalPlayerName: rivalName,
                category,
                decade,
                songsUsed: songsArray,
                playerName: playerData.playerName
            })
        });

        const result = await response.json();
        if (response.ok) {
            alert("Invitación enviada a " + rivalName);
            currentOnlineGameCode = result.code; // El código debe ser devuelto por el servidor en by-username
            currentOnlineSongs = songsArray; // Las canciones ya las tenemos
            currentOnlineEmail = playerData.email;
            currentOnlinePlayerName = playerData.playerName;
            isOnlineMode = true;

            // Guardar la información del juego online para usarla en startOnlineGame
            localStorage.setItem('currentOnlineGameData', JSON.stringify({
                code: result.code,
                songsUsed: songsArray,
                decade: decade,
                category: category
            }));

        } else {
            alert(result.message || "Error al invitar.");
        }
    } catch (err) {
        console.error(err);
        alert("Error al enviar la invitación.");
    }
}

async function loadPlayerOnlineGames() {
    const playerData = getCurrentUserData();
    if (!playerData || !playerData.email || !playerData.playerName) {
         console.warn("No hay datos de jugador para cargar partidas online.");
         document.getElementById('active-games-list').innerHTML = "<p>Debes iniciar sesión para ver tus partidas online.</p>";
         document.getElementById('finished-games-list').innerHTML = ""; // Limpiar el otro contenedor
         showScreen('login-screen');
         return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/online-games/player/${playerData.email}`);
        const games = await response.json();

        const activeGamesContainer = document.getElementById('active-games-list');
        const finishedGamesContainer = document.getElementById('finished-games-list');
        
        activeGamesContainer.innerHTML = ''; // Limpiar ambos contenedores
        finishedGamesContainer.innerHTML = '';

        if (games.length === 0) {
            activeGamesContainer.innerHTML = "<p>No tienes partidas online activas.</p>";
            finishedGamesContainer.innerHTML = "<p>No tienes partidas online finalizadas.</p>";
            return;
        }

        const activeGames = games.filter(game => !game.finished);
        const finishedGames = games.filter(game => game.finished);

        // Renderizar partidas activas
        if (activeGames.length > 0) {
            activeGames.forEach((game) => {
                const gameDiv = document.createElement('div');
                gameDiv.className = 'online-game-item'; // Clase para estilos CSS (opcional)

                const invitingPlayerName = game.players[0] ? game.players[0].name : 'Desconocido';
                const isCreator = game.creatorEmail === playerData.email;
                const otherPlayer = game.players.find(p => p.email !== playerData.email);
                const otherPlayerName = otherPlayer ? otherPlayer.name : 'Esperando rival';
                const currentPlayerFinished = game.players.find(p => p.email === playerData.email)?.finished;
                const otherPlayerFinished = otherPlayer?.finished;

                let statusText = '';
                let buttonHtml = '';
                 const isWaitingForCurrentPlayer = game.waitingFor === playerData.email && game.players.every(p => p.email !== playerData.email);

                if (isWaitingForCurrentPlayer) {
                    statusText = `¡Te han invitado a jugar contra ${invitingPlayerName}!`;
                    buttonHtml = `<button class="btn" onclick="joinOnlineGameFromPending('${game.code}', '${playerData.playerName}', '${playerData.email}')">Aceptar y Unirse</button>`;
                } else if (game.players.length === 1) { // Partida creada por el jugador actual, esperando rival
                    statusText = 'Esperando a que un rival se una...';
                    buttonHtml = `<button class="btn secondary" onclick="copyOnlineGameCode('${game.code}')">Copiar Código</button>`;
                } else if (game.players.length === 2) { // Partida con dos jugadores
                    if (currentPlayerFinished && !otherPlayerFinished) {
                        statusText = `Esperando a que ${otherPlayerName} termine...`;
                        buttonHtml = `<button class="btn secondary" onclick="goToOnlineWaitScreen('${game.code}')">Ver Estado</button>`;
                    } else if (!currentPlayerFinished && otherPlayerFinished) {
                        statusText = `¡Tu turno! ${otherPlayerName} ha terminado.`;
                        // Se necesitan los datos del jugador actual para continuar la partida
                        buttonHtml = `<button class="btn" onclick="continueOnlineGame('${game.code}', '${playerData.playerName}', '${playerData.email}')">Continuar Partida</button>`;
                    } else if (!currentPlayerFinished && !otherPlayerFinished) {
                        statusText = `Partida en curso con ${otherPlayerName}.`;
                        buttonHtml = `<button class="btn" onclick="continueOnlineGame('${game.code}', '${playerData.playerName}', '${playerData.email}')">Continuar Partida</button>`;
                    }
                }

                gameDiv.innerHTML = `
                    <p><strong>Partida con:</strong> ${isCreator ? otherPlayerName : invitingPlayerName}</p>
                    <p><strong>Categoría:</strong> ${decadeNames[game.decade]} - ${categoryNames[game.category]}</p>
                    <p><strong>Estado:</strong> ${statusText}</p>
                    ${buttonHtml}
                `;
                activeGamesContainer.appendChild(gameDiv);
            });
        } else {
            activeGamesContainer.innerHTML = "<p>No tienes partidas online activas.</p>";
        }

        // Renderizar partidas finalizadas
        if (finishedGames.length > 0) {
            finishedGames.forEach((game) => {
                const gameDiv = document.createElement('div');
                gameDiv.className = 'online-game-item';

                const invitingPlayerName = game.players[0] ? game.players[0].name : 'Desconocido';
                const otherPlayer = game.players.find(p => p.email !== playerData.email);
                const otherPlayerName = otherPlayer ? otherPlayer.name : 'Rival Desconocido'; // Por si el rival no está
                const isCreator = game.creatorEmail === playerData.email;


                gameDiv.innerHTML = `
                    <p><strong>Partida con:</strong> ${isCreator ? otherPlayerName : invitingPlayerName}</p>
                    <p><strong>Categoría:</strong> ${decadeNames[game.decade]} - ${categoryNames[game.category]}</p>
                    <p><strong>Estado:</strong> FINALIZADA</p>
                    <button class="btn" onclick="viewOnlineGameResults('${game.code}')">Ver Resultados</button>
                `;
                finishedGamesContainer.appendChild(gameDiv);
            });
        } else {
            finishedGamesContainer.innerHTML = "<p>No tienes partidas online finalizadas.</p>";
        }

    } catch (err) {
        console.error("Error cargando partidas online del jugador:", err);
        document.getElementById('active-games-list').innerHTML = "<p>Error al cargar tus partidas activas.</p>";
        document.getElementById('finished-games-list').innerHTML = "<p>Error al cargar tus partidas finalizadas.</p>";
    }
}

// main.js - AÑADE ESTAS NUEVAS FUNCIONES
function copyOnlineGameCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        alert(`Código de partida copiado: ${code}`);
    }).catch(err => {
        console.error('Error al copiar el código:', err);
        alert(`No se pudo copiar el código. Por favor, cópialo manualmente: ${code}`);
    });
}

async function viewOnlineGameResults(code) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/online-games/${code}`);
        const result = await response.json();
        if (response.ok && result.finished) {
            // Limpiar el estado de la partida actual para evitar conflictos
            currentOnlineGameCode = null;
            currentOnlineSongs = [];
            isOnlineMode = false;
            localStorage.removeItem('currentOnlineGameData');

            showOnlineResults(result); // Reutiliza la función existente para mostrar resultados
        } else {
            alert(result.message || 'La partida aún no ha terminado o no se encontraron resultados.');
            // Recargar la lista por si el estado cambió
            loadPlayerOnlineGames();
        }
    } catch (err) {
        console.error('Error al ver resultados de partida online:', err);
        alert('Error de conexión al cargar los resultados.');
    }
}

async function goToOnlineWaitScreen(code) {
    currentOnlineGameCode = code; // Establecer el código para que pollOnlineGameStatus funcione
    showScreen('online-wait-screen');
    pollOnlineGameStatus(); // Iniciar el polling
}

// main.js - Función continueOnlineGame
async function continueOnlineGame(code, playerName, email) {
    try {
        // Obtener los datos completos de la partida del servidor
        const response = await fetch(`${API_BASE_URL}/api/online-games/${code}`);
        const result = await response.json(); // result es { finished: ..., players: [...], decade: ..., category: ..., songsUsed: [...] }

        if (response.ok) {
            // Establecer las variables globales para la partida
            currentOnlineGameCode = code;
            currentOnlineSongs = result.songsUsed; // Las canciones vienen de la respuesta del servidor
            currentOnlineEmail = email;
            currentOnlinePlayerName = playerName;
            isOnlineMode = true;

            // Guardar la información del juego online para usarla en startOnlineGame
            localStorage.setItem('currentOnlineGameData', JSON.stringify({
                code: code,
                songsUsed: result.songsUsed,
                decade: result.decade,
                category: result.category
            }));

            // Limpiar el gameState actual antes de iniciar una nueva/continuar
            gameState = {
                players: [],
                totalQuestionsPerPlayer: 10,
                currentPlayerIndex: 0,
                selectedDecade: null,
                category: null,
                isOnline: true,
                onlineGameCode: currentOnlineGameCode
            };

            // Añadir al jugador local al gameState
            const localPlayer = {
                id: 1,
                name: currentOnlinePlayerName,
                score: 0, // La puntuación se actualizará desde el servidor
                questionsAnswered: 0, // Las preguntas respondidas también se actualizarán
                questions: currentOnlineSongs,
                email: currentOnlineEmail,
                finishedOnline: false
            };
            gameState.players.push(localPlayer);

            // Si la partida ya tiene datos de jugadores, actualiza el gameState con ellos
            const serverPlayer = result.players.find(p => p.email === currentOnlineEmail);
            if (serverPlayer) {
                localPlayer.score = serverPlayer.score;
                localPlayer.finishedOnline = serverPlayer.finished;
                // Si el servidor guarda el progreso de las preguntas respondidas, lo aplicaríamos aquí.
                // Por ahora, asumimos que si está en curso, el jugador simplemente retoma su turno.
                // Si la partida tiene un player.currentQuestionIndex, se usaría aquí.
                // Como no lo tiene, se inicializa a 0. Esto es una simplificación.
                // Un sistema robusto persistiría el currentQuestionIndex por jugador.
            }

            // También añade al otro jugador al gameState para que `endGame` sepa que hay 2 jugadores
            const otherPlayer = result.players.find(p => p.email !== currentOnlineEmail);
            if (otherPlayer) {
                gameState.players.push({
                    id: 2, // Asignar un ID diferente
                    name: otherPlayer.name,
                    score: otherPlayer.score,
                    questionsAnswered: otherPlayer.questionsAnswered || 0, // Si no se guarda, inicializar a 0
                    questions: [], // Las canciones del rival no son relevantes para el juego local
                    email: otherPlayer.email,
                    finishedOnline: otherPlayer.finished
                });
            }

            startOnlineGame(); // Inicia el juego con los datos cargados
        } else {
            alert(result.message || 'Error al cargar la partida para continuar.');
            loadPlayerOnlineGames(); // Recargar la lista por si el estado cambió
        }
    } catch (err) {
        console.error('Error de red al continuar partida online:', err);
        alert('Error de conexión. Intenta de nuevo más tarde.');
    }
}

// main.js - Añade esta nueva función
// main.js - Función showOnlineResults
function showOnlineResults(gameData) {
    const finalScoresContainer = document.getElementById('final-scores');
    finalScoresContainer.innerHTML = '<h3>Resultados de la Partida Online</h3>';

    const sortedPlayers = [...gameData.players].sort((a, b) => b.score - a.score);
    const winnerDisplay = document.getElementById('winner-display');

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


    sortedPlayers.forEach((player, index) => {
        const medal = ({ 0: '🥇', 1: '🥈', 2: '🥉' }[index] || '');
        finalScoresContainer.innerHTML += `<p>${medal} ${player.name}: <strong>${player.score} puntos</strong></p>`;
    });

    // Opciones de botón después de partida online: Volver al menú principal
    document.getElementById('play-again-btn').onclick = () => {
        // Limpiar estado online y volver al menú online para jugar otra partida online
        currentOnlineGameCode = null;
        currentOnlineSongs = [];
        isOnlineMode = false; // Importante resetear este estado
        localStorage.removeItem('currentOnlineGameData');
        showScreen('online-mode-screen'); // <--- ESTO LLEVA AL MENÚ ONLINE
    };
    document.getElementById('play-again-btn').textContent = "Jugar Otra Vez Online"; // Cambiar texto del botón

    // Aquí guardamos el resultado de la partida online
    saveOnlineGameToHistory(gameData);

    // Asegurarse de que el botón "Menú Principal" de la pantalla end-game-screen
    // (que está en index.html) sigue apuntando a endOnlineModeAndGoHome()
    // que a su vez te llevará a decade-selection-screen.
    // No necesitamos modificarlo aquí, solo asegurarnos de que la función existe y funciona.

    showScreen('end-game-screen'); // Reutilizar la pantalla de fin de juego
}

function showStats() {
  showStatisticsScreen();
}
function showAllSongs() {
  showSongsListCategorySelection();
}
function showOnlineMenu() {
  showScreen("online-mode-screen");
}

window.showStats = showStats;
window.showAllSongs = showAllSongs;
window.showOnlineMenu = showOnlineMenu;

// =====================================================================
// INICIALIZACIÓN
// =====================================================================

window.onload = async () => {
    const userDataString = localStorage.getItem('userData'); // <-- LEER userData
    if (userDataString) {
        const storedUser = JSON.parse(userDataString);
        currentUser = storedUser; // <-- ASIGNAR EL OBJETO COMPLETO A currentUser

        // Cargamos las estadísticas y el historial siempre que haya un usuario logueado
        await loadUserScores(currentUser.email);
        await loadGameHistory(currentUser.email);

        if (currentUser.playerName) {
            showScreen('decade-selection-screen');
            generateDecadeButtons();
        } else {
            showScreen('set-player-name-screen');
        }
    } else {
        showScreen('home-screen'); // Si no hay userData, vamos a la pantalla de inicio
    }
window.showStatisticsScreen = showStatisticsScreen;
window.showSongsListCategorySelection = showSongsListCategorySelection;
};