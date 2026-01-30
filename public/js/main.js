const decadeNames = {
    '80s': 'Década de los 80',
    '90s': 'Década de los 90',
    '00s': 'Década de los 2000',
    '10s': 'Década de los 2010',
    'actual': 'Década Actual', // Estandarizado a minúscula como clave principal
    'Actual': 'Década Actual', // Mantenemos por seguridad/retrocompatibilidad
    'Todas': 'Todas las Décadas',
    'elderly': 'Modo Fácil',
    'especiales': 'Especiales'
};

const categoryNames = {
    espanol: "Canciones en Español",
    ingles: "Canciones en Inglés",
    peliculas: "BSO de Películas",
    series: "BSO de Series",
    tv: "Programas de TV",
    infantiles: "Series Infantiles",
    anuncios: "Anuncios",
    consolidated: "Todas las Categorías",
    verano: "Canciones del Verano"
};

function getDecadeLabel(decadeId) {
    return decadeNames[decadeId] || decadeId;
}

function getCategoryLabel(categoryId) {
    return categoryNames[categoryId] || categoryId;
}

// DEFINICIÓN DE ORDEN DE BOTONES
const BASE_DECADES = Array.isArray(window.allDecadesDefined)
    ? window.allDecadesDefined
    : ['80s', '90s', '00s', '10s', 'actual', 'verano'];

// CORRECCIÓN CRÍTICA AQUÍ:
// 1. Filtramos 'verano' (para moverlo dentro) y 'especiales' (por si acaso viniera de auto-scan).
// 2. Concatenamos explícitamente ['especiales'] al final para forzar que aparezca el botón.
const DECADES_ORDER = BASE_DECADES
    .filter(decade => decade !== 'verano' && decade !== 'especiales')
    .concat(['especiales']);

const DECADES_WITH_SPECIALS = [...DECADES_ORDER, 'Todas'];

// ... constantes iniciales ...
const APP_VERSION = 'Versión 55 (Total Path & Category Purge)';

const CATEGORY_ORDER = Array.isArray(window.allPossibleCategories)
    ? window.allPossibleCategories
    : ['espanol', 'ingles', 'peliculas', 'series', 'tv', 'infantiles', 'anuncios'];

function getDecadesForSelect() {
    if (Array.isArray(window.allDecadesDefined) && window.allDecadesDefined.length > 1) {
        return window.allDecadesDefined.filter(decade => decade !== 'verano');
    }
    return DECADES_ORDER;
}

function getCategoriesForSelect() {
    if (Array.isArray(window.allPossibleCategories) && window.allPossibleCategories.length > 1) {
        return window.allPossibleCategories;
    }
    return CATEGORY_ORDER;
}

let gameState = {};
let audioPlaybackTimeout;
let activeTimeUpdateListener = null;
const screens = document.querySelectorAll('.screen');
const audioPlayer = document.getElementById('audio-player');
const sfxAcierto = document.getElementById('sfx-acierto');
const sfxError = document.getElementById('sfx-error');

const CANONICAL_PROD_ORIGIN = 'https://adivinalacancion.app';

const API_BASE_URL =
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? window.location.origin
        : CANONICAL_PROD_ORIGIN;

let currentUser = null;
let useLocalApiFallback = false;
(() => {
    const savedUserJSON = localStorage.getItem('userData');
    if (savedUserJSON) {
        try {
            currentUser = JSON.parse(savedUserJSON);
            console.log("✅ Sesión persistente restaurada:", currentUser.email);
        } catch (e) {
            console.error("❌ Sesión corrupta. Limpiando localStorage.", e);
            localStorage.removeItem('userData');
            currentUser = null;
        }
    }
})();
let userAccumulatedScores = {}; 
let gameHistory = []; 
let pendingPurchaseCategory = null;

const PREMIUM_CATEGORIES = new Set(['peliculas', 'series', 'tv', 'infantiles', 'anuncios']);
const PREMIUM_DECADES = new Set(['Todas', 'verano']);
const ADMIN_EMAIL = 'vtornet@gmail.com';
const NOTIFICATIONS_STORAGE_KEY = 'localNotifications';
const NOTIFICATIONS_PROMPTED_KEY = 'inviteNotificationsPrompted';
const PERMISSIONS_STORAGE_KEY = 'userPermissions';
const FINISHED_NOTIFICATIONS_KEY = 'finishedOnlineNotifications';

function getCurrentUserData() {
    const userDataString = localStorage.getItem("userData");
    if (!userDataString) return null;
    return JSON.parse(userDataString);
}

function getUserPermissions(email) {
    const storedPermissions = JSON.parse(localStorage.getItem(PERMISSIONS_STORAGE_KEY) || '{}');
    if (!storedPermissions[email]) {
        storedPermissions[email] = {
            email,
            unlocked_sections: [],
            no_ads: false,
            is_admin: false
        };
    }

    if (email === ADMIN_EMAIL) {
        storedPermissions[email] = {
            email,
            unlocked_sections: ['premium_all'],
            no_ads: true,
            is_admin: true
        };
    }

    localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(storedPermissions));
    return storedPermissions[email];
}

function getActivePermissions() {
    // Si no hay usuario, no hay permisos
    if (!currentUser || !currentUser.email) return [];

    let localSections = [];
    let memorySections = [];

    // 1. Memoria (RAM) - Lo más inmediato
    if (currentUser.unlocked_sections && Array.isArray(currentUser.unlocked_sections)) {
        memorySections = currentUser.unlocked_sections;
    }

    // 2. Disco (LocalStorage) - La persistencia
    try {
        const storedPermsJSON = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
        if (storedPermsJSON) {
            const parsed = JSON.parse(storedPermsJSON);
            if (parsed[currentUser.email] && Array.isArray(parsed[currentUser.email].unlocked_sections)) {
                localSections = parsed[currentUser.email].unlocked_sections;
            }
        }
    } catch (e) {
        console.error("Error leyendo permisos locales:", e);
    }

    // 3. Fusión
    const combined = [...new Set([...localSections, ...memorySections])];

    // 4. Lógica Admin / Premium All
    if (combined.includes('premium_all') || currentUser.email === ADMIN_EMAIL) {
        return ['premium_all', ...combined];
    }

    return combined;
}

// --- FUNCIONES AUXILIARES (HELPER FUNCTIONS) ---
// Necesarias para validar el acceso premium gestionado por Stripe

function isPremiumCategory(categoryId) {
    return PREMIUM_CATEGORIES.has(categoryId);
}

function isPremiumDecade(decadeId) {
    return PREMIUM_DECADES.has(decadeId);
}

function hasCategoryAccess(categoryId) {
    // Verifica si el usuario tiene comprada esta categoría específica o el paquete completo
    const permissions = getActivePermissions();
    return permissions.includes('premium_all') || permissions.includes(categoryId);
}

function hasPremiumAccess() {
    // Verifica si el usuario tiene el paquete completo (necesario para modos como 'Todas' o 'Verano')
    const permissions = getActivePermissions();
    return permissions.includes('premium_all');
}

function isPremiumSelection(decade, category) {
    return isPremiumDecade(decade) || isPremiumCategory(category);
}
// ------------------------------------------------------------

function getLocalUsers() {
    return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '{}');
}

function saveLocalUsers(users) {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function getLocalScores() {
    return JSON.parse(localStorage.getItem(LOCAL_SCORES_KEY) || '{}');
}

function saveLocalScores(scores) {
    localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(scores));
}

function getLocalGameHistory() {
    return JSON.parse(localStorage.getItem(LOCAL_GAME_HISTORY_KEY) || '{}');
}

function saveLocalGameHistory(history) {
    localStorage.setItem(LOCAL_GAME_HISTORY_KEY, JSON.stringify(history));
}

async function parseJsonResponse(response) {
    try {
        return await response.json();
    } catch (error) {
        return null;
    }
}

function showPremiumModal(message, categoryKey) {
    const modal = document.getElementById('premium-modal');
    const text = document.getElementById('premium-modal-message');
    let buyBtn = document.getElementById('premium-buy-btn');

    if (!modal || !text) return;

    text.innerHTML = message || 'Desbloquea contenido Premium.';

    if (!buyBtn) {
        buyBtn = document.createElement('button');
        buyBtn.id = 'premium-buy-btn';
        buyBtn.className = 'btn'; 
        buyBtn.style.marginTop = '15px';
        buyBtn.style.background = 'linear-gradient(45deg, #6772E5, #5469D4)';
        modal.querySelector('.modal-content').insertBefore(buyBtn, modal.querySelector('.secondary'));
    }

    buyBtn.innerText = categoryKey ? `🔓 Desbloquear ${categoryKey.toUpperCase()}` : '🔓 Desbloquear TODO';
    buyBtn.onclick = () => redirectToStripe(categoryKey || 'full_pack');

    modal.classList.remove('hidden');
}

/**
 * Redirige al usuario a la pasarela de pago de Stripe.
 * @param {string} categoryKey - La clave de la categoría a comprar (ej: 'peliculas', 'full_pack')
 */
// REEMPLAZA LA FUNCIÓN redirectToStripe COMPLETA EN public/js/main.js

// EN public/js/main.js - Reemplaza la función redirectToStripe completa

async function redirectToStripe(categoryKey) {
    if (!currentUser || !currentUser.email) {
        showAppAlert("Debes iniciar sesión para realizar compras.");
        return;
    }

    const priceMap = {
        'espanol':    'price_AQUI',
        'ingles':     'price_AQUI',
        'peliculas':  'price_1Stw76AzxZ5jYRrVcSP4iFVS',
        'series':     'price_AQUI',
        'tv':         'price_AQUI',
        'infantiles': 'price_AQUI',
        'anuncios':   'price_AQUI',
        'full_pack':  'price_1SuACIAzxZ5jYRrVNKmtD0KN'
    };

    const priceId = priceMap[categoryKey];
    
    if (!priceId || priceId === 'price_AQUI') {
        console.error(`Falta configuración de precio para: ${categoryKey}`);
        showAppAlert("Esta categoría aún no está disponible para compra.");
        return;
    }

    const permissionKeyToSave = (categoryKey === 'full_pack') ? 'premium_all' : categoryKey;

    try {
        const response = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: currentUser.email,
                categoryKey: permissionKeyToSave,
                priceId: priceId,
                returnUrl: window.location.origin // <--- ¡LA CLAVE! Enviamos dónde estamos
            })
        });

        const session = await response.json();
        
        if (response.ok && session.id) {
            const stripe = Stripe('pk_test_51StvbzAzxZ5jYRrVht2VaE3PAIbqyJSDq2Ym9XPyohsv5gKjkGRBQ5OsvRR9EE3wTNvbDVQweNfIb8Z7Bc3byFXy00QVZ0iVkD'); 
            await stripe.redirectToCheckout({ sessionId: session.id });
        } else {
            throw new Error(session.error || "Error al crear sesión de pago.");
        }
    } catch (err) {
        console.error("Error Stripe:", err);
        showAppAlert("No se pudo iniciar el proceso de pago.");
    }
}

function closePremiumModal() {
    const modal = document.getElementById('premium-modal');
    if (modal) modal.classList.add('hidden');
}

function showInstructions() {
    const modal = document.getElementById('instructions-modal');
    closeHamburgerMenu();
    if (modal) modal.classList.remove('hidden');
}

function closeInstructions() {
    const modal = document.getElementById('instructions-modal');
    if (modal) modal.classList.add('hidden');
}

let appModalResolver = null;

function showAppModal({ title, message, confirmText = 'Aceptar', cancelText = 'Cancelar', showCancel = false } = {}) {
    const modal = document.getElementById('app-modal');
    const titleEl = document.getElementById('app-modal-title');
    const messageEl = document.getElementById('app-modal-message');
    const confirmBtn = document.getElementById('app-modal-confirm');
    const cancelBtn = document.getElementById('app-modal-cancel');

    if (!modal || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
        if (showCancel) {
            return Promise.resolve(window.confirm(message || ''));
        }
        window.alert(message || '');
        return Promise.resolve(true);
    }

    titleEl.textContent = title || 'Aviso';
    messageEl.textContent = message || '';
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    cancelBtn.style.display = showCancel ? 'inline-flex' : 'none';

    modal.classList.remove('hidden');

    return new Promise(resolve => {
        appModalResolver = resolve;
        confirmBtn.onclick = () => {
            modal.classList.add('hidden');
            appModalResolver?.(true);
            appModalResolver = null;
        };
        cancelBtn.onclick = () => {
            modal.classList.add('hidden');
            appModalResolver?.(false);
            appModalResolver = null;
        };
    });
}

function showAppAlert(message, options = {}) {
    return showAppModal({
        title: options.title || 'Aviso',
        message,
        confirmText: options.confirmText || 'Aceptar',
        showCancel: false
    });
}

function showAppConfirm(message, options = {}) {
    return showAppModal({
        title: options.title || 'Confirmación',
        message,
        confirmText: options.confirmText || 'Aceptar',
        cancelText: options.cancelText || 'Cancelar',
        showCancel: true
    });
}

function getNotifications() {
    const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (stored) {
        return JSON.parse(stored);
    }

    const initial = [
        {
            id: 'welcome-premium',
            message: 'Próximamente podrás desbloquear nuevas categorías.',
            date: new Date().toLocaleDateString()
        }
    ];
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(initial));
    return initial;
}

function updateNotificationBadge() {
    const notifications = getNotifications();
    // Contamos las que no tienen 'read' o 'read' es false
    const unreadCount = notifications.filter(n => !n.read).length;
    
    const badge = document.getElementById('notification-badge');
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            badge.classList.remove('hidden');
            // Efecto visual divertido para llamar la atención
            badge.style.animation = 'none';
            badge.offsetHeight; /* trigger reflow */
            badge.style.animation = 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        } else {
            badge.classList.add('hidden');
        }
    }
}

function renderNotifications() {
    const list = document.getElementById('notifications-list');
    if (!list) return;
    const notifications = getNotifications();
    list.innerHTML = '';
    if (notifications.length === 0) {
        list.innerHTML = '<p>No hay notificaciones todavía.</p>';
        return;
    }

    notifications.forEach(note => {
        const item = document.createElement('div');
        item.className = 'notification-item';
        item.innerHTML = `<p>${note.message}</p><small>${note.date}</small>`;
        if (note.type === 'invite' || note.type === 'result') {
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => {
                toggleNotificationsPanel();
                showScreen('pending-games-screen');
            });
        }
        list.appendChild(item);
    });
}

function addNotification(message, type = 'info') {
    const notifications = getNotifications();
    notifications.unshift({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        message,
        date: new Date().toLocaleDateString(),
        type,
        read: false // <--- NUEVO: Marcamos como NO leída
    });
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
    
    updateNotificationBadge(); // <--- NUEVO: Actualizamos el contador visualmente
}

function getFinishedNotificationsState() {
    const stored = localStorage.getItem(FINISHED_NOTIFICATIONS_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
}

function setFinishedNotificationsState(state) {
    localStorage.setItem(FINISHED_NOTIFICATIONS_KEY, JSON.stringify(state));
}

function toggleNotificationsPanel() {
    const panel = document.getElementById('notifications-panel');
    if (!panel) return;
    const isHidden = panel.classList.contains('hidden');
    
    if (isHidden) {
        // AL ABRIR: Marcamos todo como leído
        const notifications = getNotifications();
        const updatedNotifications = notifications.map(n => ({ ...n, read: true }));
        localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedNotifications));
        
        // Actualizamos UI
        updateNotificationBadge(); // El contador se pondrá a 0 y desaparecerá
        renderNotifications();     // Mostramos la lista
        
        panel.classList.remove('hidden');
    } else {
        panel.classList.add('hidden');
    }
}
function updatePremiumButtonsState() {
    const summerButton = document.getElementById('summer-songs-btn');
    if (!summerButton) return;

    if (hasPremiumAccess()) {
        summerButton.classList.remove('locked');
    } else {
        summerButton.classList.add('locked');
    }
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
    if (screenId === 'decade-selection-screen') {
        updatePremiumButtonsState();
    }
    // MODIFICACIÓN CLAVE AQUÍ:
    if (screenId === 'pending-games-screen' || screenId === 'online-mode-screen') { //
        loadPlayerOnlineGames(); //
        requestInviteNotificationPermission();
    }
}

window.showScreen = showScreen;

function populateDecadeOptions(selectElement, decades) {
    selectElement.innerHTML = '';
    decades.forEach(dec => {
        const option = document.createElement('option');
        option.value = dec;
        option.textContent = getDecadeLabel(dec);
        selectElement.appendChild(option);
    });
}

function populateCategoryOptions(selectElement, categories) {
    selectElement.innerHTML = '';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = getCategoryLabel(cat);
        selectElement.appendChild(option);
    });
}

function togglePasswordVisibility(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    button.textContent = isPassword ? '🙈' : '👁️';
    button.setAttribute('aria-pressed', String(isPassword));
}

function showPasswordRecoveryInfo() {
    openPasswordResetModal();
}

function toggleHamburgerMenu() {
    const menu = document.getElementById('hamburger-menu');
    if (!menu) return;
    menu.classList.toggle('hidden');
}

function closeHamburgerMenu() {
    const menu = document.getElementById('hamburger-menu');
    if (menu) menu.classList.add('hidden');
}

function openPasswordResetModal() {
    closeHamburgerMenu();
    const modal = document.getElementById('password-reset-modal');
    if (modal) modal.classList.remove('hidden');
}

function closePasswordResetModal() {
    const modal = document.getElementById('password-reset-modal');
    if (modal) modal.classList.add('hidden');
    const tokenInfo = document.getElementById('password-reset-token-info');
    if (tokenInfo) tokenInfo.textContent = '';
    ['password-reset-email', 'password-reset-token', 'password-reset-new-password', 'password-reset-confirm-password']
        .forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
}

function showChangePasswordModal() {
    closeHamburgerMenu();
    const modal = document.getElementById('password-change-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeChangePasswordModal() {
    const modal = document.getElementById('password-change-modal');
    if (modal) modal.classList.add('hidden');
    ['password-change-current', 'password-change-new', 'password-change-confirm']
        .forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
}

window.toggleHamburgerMenu = toggleHamburgerMenu;

async function requestPasswordReset() {
    const emailInput = document.getElementById('password-reset-email');
    const email = emailInput?.value.trim();
    const tokenInfo = document.getElementById('password-reset-token-info');

    if (!email) {
        showAppAlert('Introduce tu correo electrónico para recibir el token.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/password-reset/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const result = await response.json();

        if (response.ok) {
            if (tokenInfo) {
                tokenInfo.textContent = result.token
                    ? `Token generado: ${result.token}`
                    : (result.message || 'Si el email existe, te enviaremos un token.');
            }
            showAppAlert(result.message || 'Si el email existe, te enviaremos un token.');
        } else {
            showAppAlert(result.message || 'No se pudo solicitar el token.');
        }
    } catch (error) {
        console.error('Error al solicitar token:', error);
        showAppAlert('Error de conexión. Intenta de nuevo más tarde.');
    }
}

async function confirmPasswordReset() {
    const email = document.getElementById('password-reset-email')?.value.trim();
    const token = document.getElementById('password-reset-token')?.value.trim();
    const newPassword = document.getElementById('password-reset-new-password')?.value.trim();
    const confirmPassword = document.getElementById('password-reset-confirm-password')?.value.trim();

    if (!email || !token || !newPassword) {
        showAppAlert('Completa el email, el token y la nueva contraseña.');
        return;
    }
    if (newPassword !== confirmPassword) {
        showAppAlert('Las contraseñas no coinciden.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/password-reset/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, token, newPassword })
        });
        const result = await response.json();

        if (response.ok) {
            showAppAlert(result.message || 'Contraseña actualizada correctamente.');
            closePasswordResetModal();
        } else {
            showAppAlert(result.message || 'No se pudo cambiar la contraseña.');
        }
    } catch (error) {
        console.error('Error al confirmar reset:', error);
        showAppAlert('Error de conexión. Intenta de nuevo más tarde.');
    }
}

async function changePassword() {
    if (!currentUser || !currentUser.email) {
        showAppAlert('Debes iniciar sesión para cambiar la contraseña.');
        showScreen('login-screen');
        return;
    }

    const currentPassword = document.getElementById('password-change-current')?.value.trim();
    const newPassword = document.getElementById('password-change-new')?.value.trim();
    const confirmPassword = document.getElementById('password-change-confirm')?.value.trim();

    if (!currentPassword || !newPassword) {
        showAppAlert('Completa todos los campos para cambiar la contraseña.');
        return;
    }
    if (newPassword !== confirmPassword) {
        showAppAlert('Las contraseñas no coinciden.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/password-change`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUser.email, currentPassword, newPassword })
        });
        const result = await response.json();

        if (response.ok) {
            showAppAlert(result.message || 'Contraseña actualizada correctamente.');
            closeChangePasswordModal();
        } else {
            showAppAlert(result.message || 'No se pudo cambiar la contraseña.');
        }
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        showAppAlert('Error de conexión. Intenta de nuevo más tarde.');
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(error => {
            console.warn('No se pudo registrar el Service Worker:', error);
        });
    });
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
        showAppAlert('Por favor, introduce un email y una contraseña.');
        return;
    }
    if (!isValidEmail(email)) {
        showAppAlert('Por favor, introduce un email válido.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await parseJsonResponse(response);

        if (response.ok) {
            // CAMBIO: Si el servidor pide verificación, vamos a esa pantalla
            if (data.requireVerification) {
                showAppAlert(data.message);
                document.getElementById('verify-email-display').textContent = data.email;
                // Guardamos temporalmente el email para reenviar si hace falta
                localStorage.setItem('tempVerifyEmail', data.email); 
                showScreen('verify-email-screen');
                return;
            }

            // Comportamiento antiguo (si no hubiera verificación)
            showAppAlert(data?.message || 'Usuario registrado correctamente.');
            emailInput.value = '';
            passwordInput.value = '';
            showScreen('login-screen');
            return;
        }

        if (response.status === 404 || response.status >= 500) {
            useLocalApiFallback = true;
        }

        if (!useLocalApiFallback) {
            showAppAlert(`Error al registrar: ${data?.message || 'No se pudo completar el registro.'}`);
            return;
        }
    } catch (error) {
        console.warn('API no disponible, usando registro local:', error);
        useLocalApiFallback = true;
    }

    if (useLocalApiFallback) {
        const users = getLocalUsers();
        if (users[email]) {
            showAppAlert('Ese correo ya está registrado.');
            return;
        }
        users[email] = { email, password, playerName: null };
        saveLocalUsers(users);
        showAppAlert('Usuario registrado correctamente.');
        emailInput.value = '';
        passwordInput.value = '';
        showScreen('login-screen');
    }
}

async function loginUser() {
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        showAppAlert('Por favor, introduce tu email y contraseña.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await parseJsonResponse(response);

        if (response.status === 403 && data.requireVerification) {
        showAppAlert(data.message);
        document.getElementById('verify-email-display').textContent = data.email;
        localStorage.setItem('tempVerifyEmail', data.email);
        showScreen('verify-email-screen');
        return;
    }

        if (response.ok) {
            if (!data || !data.user || !data.user.email) {
                showAppAlert('Respuesta inválida del servidor. Intenta de nuevo más tarde.');
                return;
            }
            
            currentUser = { 
                email: data.user.email, 
                playerName: data.user.playerName,
                unlocked_sections: data.user.unlocked_sections || [] 
            };
            
            // --- Procesar Permisos del Servidor ---
            if (data.user.unlocked_sections) {
                const perms = {
                    email: data.user.email,
                    unlocked_sections: data.user.unlocked_sections,
                    is_admin: (data.user.email === ADMIN_EMAIL)
                };
                
                const allPerms = JSON.parse(localStorage.getItem(PERMISSIONS_STORAGE_KEY) || '{}');
                allPerms[data.user.email] = perms;
                localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(allPerms));
            }
            // ---------------------------------------------
            
            // --- ACTIVAR POLLING DE NOTIFICACIONES TRAS LOGIN ---
            startOnlineInvitePolling();
            // ----------------------------------------------------

        } else if (response.status === 404 || response.status >= 500) {
            useLocalApiFallback = true;
        } else {
            showAppAlert(`Error al iniciar sesión: ${data?.message || 'No se pudo iniciar sesión.'}`);
            return;
        }
    } catch (error) {
        console.warn('API no disponible, usando login local:', error);
        useLocalApiFallback = true;
    }

    // Fallback offline
    if (useLocalApiFallback) {
        const users = getLocalUsers();
        const user = users[email];
        if (!user || user.password !== password) {
            showAppAlert('Email o contraseña incorrectos.');
            return;
        }
        currentUser = { 
            email: user.email, 
            playerName: user.playerName,
            unlocked_sections: [] 
        };
    }

    if (currentUser) {
        getUserPermissions(currentUser.email);

        localStorage.setItem('loggedInUserEmail', currentUser.email);
        localStorage.setItem('userData', JSON.stringify(currentUser));
        localStorage.setItem('sessionActive', 'true');

        showAppAlert(`¡Bienvenido, ${currentUser.playerName || currentUser.email}!`);
        emailInput.value = '';
        passwordInput.value = '';

        await loadUserScores(currentUser.email);
        await loadGameHistory(currentUser.email);

        if (currentUser.playerName) {
            showScreen('decade-selection-screen'); 
            generateDecadeButtons(); 
            updatePremiumButtonsState();
        } else {
            showScreen('set-player-name-screen');
        }
    }
}
window.loginUser = loginUser;

// --- NUEVAS FUNCIONES PARA VERIFICACIÓN DE EMAIL ---

async function verifyEmailAction() {
    const code = document.getElementById('verify-code-input').value.trim();
    // Recuperamos el email que guardamos al registrar o intentar loguear
    const email = localStorage.getItem('tempVerifyEmail'); 

    if (!code || !email) {
        showAppAlert("Falta el código o el email.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });
        const result = await response.json();

        if (response.ok) {
            showAppAlert(result.message);
            // Limpieza
            document.getElementById('verify-code-input').value = '';
            localStorage.removeItem('tempVerifyEmail');
            // Mandar al usuario a loguearse
            showScreen('login-screen');
        } else {
            showAppAlert(result.message || "Código incorrecto.");
        }
    } catch (err) {
        console.error(err);
        showAppAlert("Error de conexión al verificar.");
    }
}

async function resendVerificationCode() {
    const email = localStorage.getItem('tempVerifyEmail');
    if (!email) {
        showAppAlert("No hay un email pendiente de verificación.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/resend-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const result = await response.json();
        showAppAlert(result.message || "Código reenviado.");
    } catch (err) {
        showAppAlert("Error al reenviar el código.");
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('loggedInUserEmail');
    localStorage.removeItem('userData');
    localStorage.removeItem('sessionActive');
    localStorage.removeItem('currentOnlineGameData');
    
    // --- LIMPIEZA DE PAGOS ---
    localStorage.removeItem('pending_purchase_intent');
    localStorage.removeItem('purchase_start_time');
    // -------------------------
    
    showAppAlert('Sesión cerrada correctamente.');
    showScreen('login-screen');
}

// ==========================================
// WRAPPER DE SEGURIDAD (NO ROMPER HTML)
// ==========================================
async function confirmClearOnlineGameHistory() {
    const confirmed = await showAppConfirm(
        "¿Seguro que quieres borrar TODO el historial de partidas online? Esta acción no se puede deshacer."
    );

    if (!confirmed) return;

    await clearOnlineGameHistory();
}

window.confirmClearOnlineGameHistory = confirmClearOnlineGameHistory;


async function clearOnlineGameHistory() {
    const playerData = getCurrentUserData();
    if (!playerData || !playerData.email) {
        showAppAlert("Debes iniciar sesión para borrar tu historial.");
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
            showAppAlert(result.message);
            loadPlayerOnlineGames(); // Recargar la lista de partidas para mostrar el cambio
        } else {
            showAppAlert(`Error al borrar historial: ${result.message}`);
        }
    } catch (error) {
        console.error('Error de red al borrar historial de partidas online:', error);
        showAppAlert('Error de conexión. Intenta de nuevo más tarde.');
    }
}

function endOnlineModeAndGoHome() {
    closeHamburgerMenu();
    // Siempre resetear el estado de la partida online al ir al menú principal
    isOnlineMode = false;
    currentOnlineGameCode = null;
    currentOnlineSongs = [];
    currentOnlineEmail = null;
    currentOnlinePlayerName = null;
    localStorage.removeItem('currentOnlineGameData');

    // Resetear también el estado del juego general para evitar confusiones
    gameState = {}; 
    
    // Y siempre redirigir a la pantalla de selección de década
    showScreen('decade-selection-screen'); 
    generateDecadeButtons(); // Asegurarse de que los botones de década se generen correctamente
}

function goToOnlineMenu() {
    isOnlineMode = false;
    currentOnlineGameCode = null;
    currentOnlineSongs = [];
    currentOnlineEmail = null;
    currentOnlinePlayerName = null;
    localStorage.removeItem('currentOnlineGameData');
    showScreen('online-mode-screen');
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
        showAppAlert('Por favor, introduce un nombre de jugador.');
        return;
    }

    if (currentUser) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/users/${currentUser.email}/playername`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerName: newPlayerName })
            });

            const data = await parseJsonResponse(response);

            if (response.ok) {
                currentUser.playerName = newPlayerName;
                localStorage.setItem("userData", JSON.stringify(currentUser));
                localStorage.setItem('sessionActive', 'true');
                showAppAlert(data?.message || 'Nombre de jugador actualizado.');
                playerNameInput.value = '';
                showScreen('decade-selection-screen');
                generateDecadeButtons();
                return;
            }

            if (response.status === 404 || response.status >= 500) {
                useLocalApiFallback = true;
            } else {
                showAppAlert(`Error al actualizar nombre: ${data?.message || 'No se pudo actualizar el nombre.'}`);
                return;
            }
        } catch (error) {
            console.warn('API no disponible, usando actualización local:', error);
            useLocalApiFallback = true;
        }

        if (useLocalApiFallback) {
            const users = getLocalUsers();
            if (users[currentUser.email]) {
                users[currentUser.email].playerName = newPlayerName;
                saveLocalUsers(users);
            }
            currentUser.playerName = newPlayerName;
            localStorage.setItem("userData", JSON.stringify(currentUser));
            localStorage.setItem('sessionActive', 'true');
            showAppAlert('Nombre de jugador actualizado.');
            playerNameInput.value = '';
            showScreen('decade-selection-screen');
            generateDecadeButtons();
        }
    } else {
        showAppAlert('No hay un usuario logueado. Por favor, inicia sesión primero.');
        showScreen('login-screen');
    }
}

// =====================================================================
// FUNCIONES PARA GESTIÓN DE PUNTUACIONES ACUMULADAS Y HISTORIAL
// (ACTUALIZADAS para incluir 'decade')
// =====================================================================

async function loadUserScores(userEmail) {
    if (useLocalApiFallback) {
        const localScores = getLocalScores();
        userAccumulatedScores[userEmail] = localScores[userEmail] || {};
        console.log(`Puntuaciones locales de ${userEmail} cargadas:`, userAccumulatedScores[userEmail]);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/scores/${userEmail}`);
        const data = await parseJsonResponse(response);

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
        } else if (response.status === 404 || response.status >= 500) {
            useLocalApiFallback = true;
            const localScores = getLocalScores();
            userAccumulatedScores[userEmail] = localScores[userEmail] || {};
        } else {
            console.error('Error al cargar puntuaciones:', data?.message);
            userAccumulatedScores[userEmail] = {};
        }
    } catch (error) {
        console.warn('API no disponible, usando puntuaciones locales:', error);
        useLocalApiFallback = true;
        const localScores = getLocalScores();
        userAccumulatedScores[userEmail] = localScores[userEmail] || {};
    }
}

async function saveUserScores(userEmail, decade, category, score) {
    if (!userEmail || !decade || !category || typeof score === 'undefined') {
        console.error("Error: Datos incompletos para guardar puntuación acumulada (email, decade, category, score).");
        return;
    }

    if (useLocalApiFallback) {
        const localScores = getLocalScores();
        localScores[userEmail] = localScores[userEmail] || {};
        localScores[userEmail][decade] = localScores[userEmail][decade] || {};
        localScores[userEmail][decade][category] = score;
        saveLocalScores(localScores);
        await loadUserScores(userEmail);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/scores`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, decade, category, score })
        });

        const data = await parseJsonResponse(response);

        if (response.ok) {
            console.log(data.message);
            await loadUserScores(userEmail); 
        } else if (response.status === 404 || response.status >= 500) {
            useLocalApiFallback = true;
            await saveUserScores(userEmail, decade, category, score);
        } else {
            console.error('Error al guardar puntuación:', data?.message);
        }
    } catch (error) {
        console.warn('API no disponible, usando puntuaciones locales:', error);
        useLocalApiFallback = true;
        await saveUserScores(userEmail, decade, category, score);
    }
}

async function loadGameHistory(userEmail) {
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
            console.error('Error al cargar historial:', data?.message);
            gameHistory = [];
        }
    } catch (error) {
        console.warn('API no disponible, usando historial local:', error);
        useLocalApiFallback = true;
        const localHistory = getLocalGameHistory();
        gameHistory = localHistory[userEmail] || [];
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

    if (useLocalApiFallback) {
        const localHistory = getLocalGameHistory();
        players.forEach(player => {
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
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gameResult)
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
            console.error('Error al guardar historial de partida:', data?.message);
        }
    } catch (error) {
        console.warn('API no disponible, usando historial local:', error);
        useLocalApiFallback = true;
        await saveGameResult(players, winnerName, decade, category);
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

async function generateDecadeButtons() {
    const container = document.getElementById('decade-buttons');
    container.innerHTML = '';
    
    DECADES_ORDER.forEach(decadeId => {
        const button = document.createElement('button');
        button.className = 'category-btn';

        if (decadeId === 'especiales') {
            button.className = 'category-btn tertiary';
            button.style.border = '2px solid gold';
        }

        button.innerText = getDecadeLabel(decadeId);
        button.onclick = () => selectDecade(decadeId);
        container.appendChild(button);
    });

    const allButton = document.createElement('button');
    allButton.className = 'category-btn tertiary';
    allButton.innerText = getDecadeLabel('Todas');
    allButton.onclick = () => selectDecade('Todas');

    if (hasPremiumAccess()) {
        allButton.classList.remove('locked');
    } else {
        allButton.classList.add('locked');
    }

    container.appendChild(allButton);
}

/**
 * Maneja la selección de una década y redirige a la pantalla de categoría o de jugadores.
 * @param {string} decade - La década seleccionada.
 */
async function selectDecade(decade) {
    // 1. Verificación de Usuario
    if (!currentUser || !currentUser.playerName) {
        showAppAlert('Debes iniciar sesión y establecer tu nombre de jugador para continuar.');
        showScreen('login-screen');
        return;
    }

    // 2. NUEVA LÓGICA: Sección Especiales
    // Se coloca antes del chequeo premium general porque 'especiales' es un contenedor
    // y la validación premium se hará en cada botón interno (ej. Verano).
    if (decade === 'especiales') {
        gameState.selectedDecade = 'especiales';
        generateCategoryButtons(); // Genera el menú especial con texto de feedback
        showScreen('category-screen');
        return;
    }

    // 3. Verificación Premium (para décadas normales bloqueadas)
    if (isPremiumDecade(decade) && !hasPremiumAccess()) {
        showPremiumModal('Contenido premium. Próximamente disponible mediante desbloqueo.');
        return;
    }

    gameState.selectedDecade = decade;

     // 4. Lógica para "Todas las Décadas" (REESTRUCTURADA)
    if (decade === 'Todas') {
        gameState.selectedDecade = 'Todas';

        // NO iniciar partida
        // NO consolidated
        // NO carga directa
        // → ir a categorías
        generateCategoryButtons();
        showScreen('category-screen');
        return;
    }

    // 5. Lógica para Décadas Normales (MANTENIDA INTACTA)
    else {
        // Antes de mostrar la pantalla de categorías, cargamos todas las categorías de la década.
        // Esto evita el lag al pulsar una categoría después.
        const categoriesToLoadPromises = allPossibleCategories.map(cat => 
            loadSongsForDecadeAndCategory(decade, cat).catch(error => {
                console.warn(`No se pudo cargar la categoría ${cat} para la década ${decade}. Puede que no haya canciones o un error de archivo.`, error);
                return null; // Retorna null para que Promise.allSettled no falle por una única categoría.
            })
        );
        
        await Promise.allSettled(categoriesToLoadPromises);

        generateCategoryButtons(); // Genera los botones de categoría para la década seleccionada
        showScreen('category-screen');
    }
}

function generateCategoryButtons() {
    const container = document.getElementById('category-buttons');
    container.innerHTML = '';

    const key = gameState.selectedDecade;

    // --- Título dinámico ---
    const titleEl = document.getElementById('category-screen-title');
    if (titleEl) {
        titleEl.innerHTML = key === 'especiales'
            ? 'Selecciona una Edición Especial'
            : `Elige una Categoría (<span id="selected-decade-display">${getDecadeLabel(key)}</span>)`;
    }

    // --- RENDERIZADO PARA 'ESPECIALES' ---
    if (key === 'especiales') {
        const btnVerano = document.createElement('button');
        btnVerano.className = 'category-btn';
        btnVerano.innerText = '☀️ Canciones del Verano';

        if (!hasPremiumAccess()) {
            btnVerano.classList.add('locked');
            btnVerano.onclick = () => showPremiumModal('El modo Verano es contenido Premium.');
        } else {
            btnVerano.onclick = () => startSummerSongsGame();
        }
        container.appendChild(btnVerano);

        const infoDiv = document.createElement('div');
        infoDiv.style.marginTop = '30px';
        infoDiv.style.padding = '20px';
        infoDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        infoDiv.style.borderRadius = '12px';
        infoDiv.style.border = '1px dashed var(--secondary-color)';
        infoDiv.style.textAlign = 'center';
        infoDiv.innerHTML = `
            <p style="color: var(--light-text-color); margin-bottom: 10px; font-size: 0.95rem;">
                🚀 <strong>Próximamente más categorías</strong>
            </p>
            <p style="font-size: 0.85rem; color: #ccc; line-height: 1.5;">
                Estamos trabajando en nuevas ediciones especiales.
            </p>
        `;
        container.appendChild(infoDiv);

        const backBtnEsp = document.createElement('button');
        backBtnEsp.className = 'btn secondary';
        backBtnEsp.style.marginTop = '20px';
        backBtnEsp.innerText = 'Volver';
        backBtnEsp.onclick = () => showScreen('decade-selection-screen');
        container.appendChild(backBtnEsp);
        return;
    }

    // --- CASO ESPECIAL: TODAS LAS DÉCADAS (solo categorías, NO canciones aquí) ---
    if (key === 'Todas') {
        const catsToRender = (typeof window.allPossibleCategories !== 'undefined')
            ? window.allPossibleCategories
            : CATEGORY_ORDER;

        catsToRender.forEach(categoryId => {
            const button = document.createElement('button');
            button.className = 'category-btn';

            if (isPremiumCategory(categoryId) && !hasCategoryAccess(categoryId)) {
                button.innerText = getCategoryLabel(categoryId);
                button.classList.add('locked');
                button.onclick = () => showPremiumModal(
                    `¿Quieres desbloquear <strong>${getCategoryLabel(categoryId)}</strong>?`,
                    categoryId
                );
            } else {
                button.innerText = getCategoryLabel(categoryId);
                button.onclick = () => selectCategory(categoryId);
            }
            container.appendChild(button);
        });

        const backBtn = document.createElement('button');
        backBtn.className = 'btn secondary';
        backBtn.style.marginTop = '20px';
        backBtn.innerText = 'Volver a Décadas';
        backBtn.onclick = () => showScreen('decade-selection-screen');
        container.appendChild(backBtn);
        return;
    }

    // --- DÉCADAS NORMALES: preparar datos y pintar categorías ---
    // (mantiene tu puente de datos)
    if (typeof window.allSongsByDecadeAndCategory !== 'undefined') {
        let dataFound = window.allSongsByDecadeAndCategory[key];

        if (!dataFound) {
            if (key === 'Actual' || key === 'actual') dataFound = window.allSongsByDecadeAndCategory['actual'];
            else if (key === '2010s' || key === '10s') dataFound = window.allSongsByDecadeAndCategory['10s'];
            else if (key === '2000s' || key === '00s') dataFound = window.allSongsByDecadeAndCategory['00s'];
        }

        if (dataFound) {
            configuracionCanciones[key] = dataFound;
        }
    }

    const currentDecadeSongs = configuracionCanciones[key];
    if (!currentDecadeSongs) {
        container.innerHTML = `
            <div class="warning-text">
                <p>No se han encontrado canciones para esta década.</p>
                <small>Intenta recargar la página.</small>
            </div>`;
        const backBtnErr = document.createElement('button');
        backBtnErr.className = 'btn secondary';
        backBtnErr.style.marginTop = '20px';
        backBtnErr.innerText = 'Volver';
        backBtnErr.onclick = () => showScreen('decade-selection-screen');
        container.appendChild(backBtnErr);
        return;
    }

    const catsToRender = (typeof window.allPossibleCategories !== 'undefined')
        ? window.allPossibleCategories
        : CATEGORY_ORDER;

    catsToRender.forEach(categoryId => {
        const songsArray = currentDecadeSongs[categoryId];

        let hasEnoughSongs = Array.isArray(songsArray) && songsArray.length >= 4;

        const isActualDecade = (key === 'actual' || key === 'Actual');
        const allowedCategories = ['espanol', 'ingles'];
        if (isActualDecade && !allowedCategories.includes(categoryId)) {
            hasEnoughSongs = false;
        }

        const button = document.createElement('button');
        button.className = 'category-btn';

        if (isPremiumCategory(categoryId) && !hasCategoryAccess(categoryId)) {
            button.innerText = getCategoryLabel(categoryId);
            button.classList.add('locked');
            button.onclick = () => showPremiumModal(
                `¿Quieres desbloquear <strong>${getCategoryLabel(categoryId)}</strong> en todas las décadas?`,
                categoryId
            );
        } else if (!hasEnoughSongs) {
            button.innerHTML = `${getCategoryLabel(categoryId)} <br><span style="font-size:0.7em; opacity:0.8; font-weight:normal;">(Próximamente)</span>`;
            button.classList.add('secondary');
            button.style.opacity = '0.7';
            button.onclick = () => showAppAlert(`🚧 Estamos recopilando temas de ${getCategoryLabel(categoryId)}. ¡Pronto disponible!`);
        } else {
            button.innerText = getCategoryLabel(categoryId);
            button.onclick = () => selectCategory(categoryId);
        }

        container.appendChild(button);
    });

    const backBtn = document.createElement('button');
    backBtn.className = 'btn secondary';
    backBtn.style.marginTop = '20px';
    backBtn.innerText = 'Volver a Décadas';
    backBtn.onclick = () => showScreen('decade-selection-screen');
    container.appendChild(backBtn);
}


async function loadAllDecadesForCategory(categoryId) {
    const decadesToMerge = ['80s', '90s', '00s', '10s', 'actual', 'verano'];
    
    configuracionCanciones['Todas'] = configuracionCanciones['Todas'] || {};
    configuracionCanciones['Todas'][categoryId] = []; 

    const loads = decadesToMerge.map(dec => loadSongsForDecadeAndCategory(dec, categoryId));
    await Promise.allSettled(loads);

    const merged = [];
    decadesToMerge.forEach(dec => {
        const internalKey = dec.toLowerCase() === 'actual' ? 'actual' : dec;
        const arr = configuracionCanciones?.[internalKey]?.[categoryId];
        
        if (Array.isArray(arr)) {
            // PURGA v.55: Solo entra lo que tenga el sello de la categoría solicitada
            const filtered = arr.filter(song => song.originalCategory === categoryId);
            merged.push(...filtered);
        }
    });
    
    configuracionCanciones['Todas'][categoryId] = merged;
    console.log(`Pool 'Todas' purificado (v.55) para ${categoryId}: ${merged.length} temas.`);
}

function playAudioSnippet() {
    if (gameState.hasPlayed) return;
    
    const durations = { 3: 4.0, 2: 6.0, 1: 10.0 }; 
    const durationSecs = durations[gameState.attempts];
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const currentQuestion = currentPlayer.questions[currentPlayer.questionsAnswered];

    let fileName = typeof currentQuestion.file === 'string' ? currentQuestion.file.trim() : '';
    if (!fileName) return;

    // RECONSTRUCCIÓN v.55: Ignorar carpetas intermedias (categorías)
    if (fileName.includes('/')) {
        const parts = fileName.split('/');
        // Forzamos: decada/archivo.mp3 (eliminamos 'series', 'espanol', etc. del medio)
        if (parts.length >= 2) {
            const decadePart = parts[0].toLowerCase();
            const filePart = parts[parts.length - 1]; // Siempre el último elemento es el archivo
            fileName = `${decadePart}/${filePart}`;
        }
    }

    const playBtn = document.getElementById('play-song-btn');
    playBtn.innerText = "🎵";
    playBtn.disabled = true;
    gameState.hasPlayed = true;

    let audioSrc = fileName.startsWith('/') ? fileName : `/audio/${fileName}`;
    
    // Forzar actualización del src si es distinto
    if (!audioPlayer.src.endsWith(audioSrc)) {
        audioPlayer.src = audioSrc;
    }
    
    if (activeTimeUpdateListener) audioPlayer.removeEventListener('timeupdate', activeTimeUpdateListener);
    audioPlayer.currentTime = 0;

    const stopAudioListener = () => {
        if (audioPlayer.currentTime >= durationSecs) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0; 
            playBtn.innerText = "▶";
            audioPlayer.removeEventListener('timeupdate', stopAudioListener);
            activeTimeUpdateListener = null;
        }
    };

    activeTimeUpdateListener = stopAudioListener;
    audioPlayer.addEventListener('timeupdate', stopAudioListener);
    
    audioPlayer.play().catch(e => {
        console.error("Fallo 404 (v.55):", audioSrc);
        playBtn.disabled = false;
        playBtn.innerText = "▶";
        gameState.hasPlayed = false;
        showAppAlert(`Error 404: El archivo no existe en la ruta física: ${audioSrc}`);
    });
}


/**
 * Maneja la selección de una categoría, carga las canciones y redirige a la pantalla de selección de jugadores.
 * @param {string} category - La categoría seleccionada.
 */
async function selectCategory(category) {
    if (!currentUser || !currentUser.playerName) {
        showAppAlert('Debes iniciar sesión y establecer tu nombre de jugador para continuar.');
        showScreen('login-screen');
        return;
    }

    if (isPremiumCategory(category) && !hasCategoryAccess(category)) {
        showPremiumModal('Contenido premium. Desbloquéalo para jugar.', category);
        return;
    }

    gameState.category = category;

    try {
        if (gameState.selectedDecade === 'Todas') {
            await loadAllDecadesForCategory(gameState.category);
        } else {
            await loadSongsForDecadeAndCategory(gameState.selectedDecade, gameState.category);
        }

        const pool = configuracionCanciones?.[gameState.selectedDecade]?.[gameState.category];

        if (!Array.isArray(pool) || pool.length < 4) {
            showAppAlert(
                `No hay suficientes canciones en '${getCategoryLabel(category)}' para ${getDecadeLabel(gameState.selectedDecade)}. ` +
                `Necesitas al menos 4 canciones.`
            );
            showScreen('category-screen');
            return;
        }

        showScreen('player-selection-screen');
    } catch (error) {
        showAppAlert(
            `No se pudieron cargar las canciones para '${getCategoryLabel(category)}' en ${getDecadeLabel(gameState.selectedDecade)}. Intenta con otra.`
        );
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
        showAppAlert('Debes iniciar sesión y establecer tu nombre de jugador para continuar.');
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

    if (numPlayers === 1) {
        startGame();
        return;
    }

    showScreen('player-names-input-screen');
}

// main.js - Funciones para el modo "elderly"
let elderlyPlayerCount = 1; // Por defecto 1 jugador para el input inicial

function addElderlyPlayerInput(numPlayers) {
    elderlyPlayerCount = numPlayers;
    const otherPlayerNamesInputsDiv = document.getElementById('elderly-other-player-names-inputs');
    otherPlayerNamesInputsDiv.innerHTML = ''; // Limpiar inputs anteriores

    // Asegurarse de que el input del Jugador 1 sea editable si lo fuera
    document.getElementById('elderly-player-1-name').readOnly = false;

    for (let i = 1; i < numPlayers; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'text-input';
        input.placeholder = `Nombre del Jugador ${i + 1}`;
        input.id = `elderly-player-${i + 1}-name-input`;
        otherPlayerNamesInputsDiv.appendChild(input);
    }
}

// main.js - startElderlyModeGame (MODIFICAR)
async function startElderlyModeGame() {
    const player1Name = document.getElementById('elderly-player-1-name').value.trim();
    if (!player1Name) {
        showAppAlert('Por favor, introduce al menos el nombre del Jugador 1.');
        return;
    }
    gameState.isOnline = false; // Este modo no es online
    isElderlyMode = true; // <-- ESTABLECE ESTO A TRUE
    gameState.players = [];
    // El jugador 1 siempre es el primer input
    gameState.players.push({ 
        id: 1, 
        name: player1Name, 
        score: 0, 
        questionsAnswered: 0, 
        questions: [],
        email: null // No hay email en este modo
    });

    // Recoger nombres de jugadores adicionales
    for (let i = 1; i < elderlyPlayerCount; i++) {
        const input = document.getElementById(`elderly-player-${i + 1}-name-input`);
        const name = input.value.trim() || `Jugador ${i + 1}`; // Nombre por defecto si está vacío
        gameState.players.push({ 
            id: i + 1, 
            name: name, 
            score: 0, 
            questionsAnswered: 0, 
            questions: [] 
        });
    }

    gameState.totalQuestionsPerPlayer = 10; // O la cantidad que desees para este modo

    // *** CAMBIO CRUCIAL AQUÍ: Usar 'elderly' como década y 'consolidated' como categoría ***
    gameState.selectedDecade = 'elderly';      // <--- AHORA SÍ USA LA DÉCADA 'elderly'
    gameState.category = 'consolidated'; // <--- Y SU CATEGORÍA 'consolidated'

    try {
        // Cargar las canciones específicas para el modo fácil
        // Ahora, loadSongsForDecadeAndCategory cargará desde data/songs/elderly/consolidated.js
        await loadSongsForDecadeAndCategory(gameState.selectedDecade, gameState.category); 
        const allSongsToChooseFrom = configuracionCanciones[gameState.selectedDecade][gameState.category];

        if (!allSongsToChooseFrom || allSongsToChooseFrom.length < gameState.totalQuestionsPerPlayer * gameState.players.length) {
            showAppAlert(`No hay suficientes canciones en el modo fácil para ${elderlyPlayerCount} jugador(es). Se necesitan ${gameState.totalQuestionsPerPlayer * gameState.players.length} y solo hay ${allSongsToChooseFrom ? allSongsToChooseFrom.length : 0}. Por favor, añade más canciones a la carpeta 'elderly/consolidated'.`); // Mensaje actualizado
            showScreen('elderly-mode-intro-screen');
            return;
        }

        // Asignar preguntas aleatorias a cada jugador (igual que en startGame)
        let shuffledSongs = [...allSongsToChooseFrom].sort(() => 0.5 - Math.random());
        
        for (let i = 0; i < gameState.players.length; i++) {
            gameState.players[i].questions = shuffledSongs.splice(0, gameState.totalQuestionsPerPlayer);
        }

        gameState.currentPlayerIndex = 0;
        setupQuestion();
        showScreen('game-screen');

    } catch (error) {
        console.error('Error al iniciar el modo fácil:', error);
        showAppAlert('Error al cargar las canciones para el modo fácil. Intenta de nuevo más tarde.');
        showScreen('elderly-mode-intro-screen'); // Volver a la pantalla de inicio del modo fácil
    }
}

// main.js - Nueva función para el modo "Canciones del Verano"
// main.js - Función MODIFICADA para el modo "Canciones del Verano"
async function startSummerSongsGame() {
    if (!hasPremiumAccess()) {
        showPremiumModal('Contenido premium. Próximamente disponible mediante desbloqueo.');
        return;
    }
    if (!currentUser || !currentUser.playerName) {
        showAppAlert('Debes iniciar sesión y establecer tu nombre de jugador para continuar.');
        showScreen('login-screen');
        return;
    }

    // Limpiar el estado anterior del juego y establecer el modo de verano
    gameState = {}; // Limpiar completamente el gameState para el nuevo modo
    isOnlineMode = false;
    isElderlyMode = false;
    isSummerSongsMode = true; // Establecer esto a TRUE para que la lógica de retorno y fin de juego lo reconozca

    gameState.selectedDecade = 'verano';      // Década especial para el verano
    gameState.category = 'consolidated'; // Categoría 'consolidated' para el verano

    // Aquí precargamos las canciones y hacemos la validación ANTES de ir a la selección de jugadores.
    // Esto asegura que solo permitimos continuar si hay suficientes canciones para este modo.
    try {
        await loadSongsForDecadeAndCategory(gameState.selectedDecade, gameState.category);
        const allSongsToChooseFrom = configuracionCanciones[gameState.selectedDecade][gameState.category];

        // Para este modo, asumiremos que se necesitan al menos 10 canciones en total para poder jugar
        // con un mínimo de 1 jugador y que tenga al menos 10 preguntas.
        // Si tienes en mente un mínimo de canciones diferente (ej. para 2 jugadores, 20 canciones),
        // ajusta este número. Por ahora, 10 es un buen mínimo para un juego de una ronda.
        const minimumSongsRequired = 10; // Mínimo de canciones para empezar una partida de 1 jugador

        if (!allSongsToChooseFrom || allSongsToChooseFrom.length < minimumSongsRequired) {
            showAppAlert(`No hay suficientes canciones en el modo "Canciones del Verano". Necesitas al menos ${minimumSongsRequired} canciones para jugar.`);
            showScreen('decade-selection-screen'); // Volver si no hay suficientes
            return;
        }

        console.log(`Canciones de verano precargadas: ${allSongsToChooseFrom.length} canciones disponibles.`);

        // Si hay suficientes canciones, pasamos a la pantalla de selección de jugadores.
        // La función `selectPlayers` y luego `startGame` se encargarán de asignar las preguntas.
        showScreen('player-selection-screen');

    } catch (error) {
        console.error('Error al precargar canciones para el modo "Canciones del Verano":', error);
        showAppAlert('Error al cargar las canciones para el modo "Canciones del Verano". Intenta de nuevo más tarde.');
        showScreen('decade-selection-screen'); // Volver a la selección de década
    }
}
/**
 * Inicia una nueva partida, configurando jugadores y preguntas.
 */
function startGame() {
    if (!currentUser || !currentUser.playerName) {
        showAppAlert('Error: No se ha encontrado el nombre del jugador principal. Por favor, inicia sesión de nuevo.');
        logout();
        return;
    }
    if (!gameState.selectedDecade || !gameState.category) {
        showAppAlert('Error: No se ha seleccionado una década o categoría. Vuelve a empezar.');
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
        const mergedPool = configuracionCanciones?.['Todas']?.[gameState.category];

        if (!Array.isArray(mergedPool) || mergedPool.length < 4) {
            showAppAlert(
                `Error: No hay suficientes canciones en '${getCategoryLabel(gameState.category)}' para ${getDecadeLabel(gameState.selectedDecade)}.`
            );
            showScreen('category-screen');
            return;
        }

        allSongsToChooseFrom = [...mergedPool];
    } else {
        if (
            !configuracionCanciones[gameState.selectedDecade] ||
            !configuracionCanciones[gameState.selectedDecade][gameState.category]
        ) {
            showAppAlert(
                `Error: No se encontraron canciones para la década ${getDecadeLabel(gameState.selectedDecade)} y categoría ${getCategoryLabel(gameState.category)}.`
            );
            showScreen('decade-selection-screen');
            return;
        }

        allSongsToChooseFrom = [...configuracionCanciones[gameState.selectedDecade][gameState.category]];
    }


    const requiredSongs = gameState.totalQuestionsPerPlayer * gameState.playerCount;

    if (allSongsToChooseFrom.length < requiredSongs) {
        console.warn(`Advertencia: No hay suficientes canciones en ${getDecadeLabel(gameState.selectedDecade)} - ${getCategoryLabel(gameState.category)}. Se necesitan ${requiredSongs} y solo hay ${allSongsToChooseFrom.length}. Ajustando el número de preguntas por jugador.`);
        gameState.totalQuestionsPerPlayer = Math.floor(allSongsToChooseFrom.length / gameState.playerCount);
        if (gameState.totalQuestionsPerPlayer < 1) { 
             showAppAlert(`No hay suficientes canciones en ${getDecadeLabel(gameState.selectedDecade)} - ${getCategoryLabel(gameState.category)} para que cada jugador tenga al menos una pregunta. Elige otra década o categoría.`);
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
    
    // --- CAMBIO: Limpieza preventiva ---
    if (activeTimeUpdateListener) {
        audioPlayer.removeEventListener('timeupdate', activeTimeUpdateListener);
        activeTimeUpdateListener = null;
    }
    
    audioPlayer.pause();
    // -----------------------------------

    // ... (El resto de la función setupQuestion se mantiene IDÉNTICA a tu archivo original)
    // Solo asegúrate de copiar el bloque de limpieza al inicio.
    
    gameState.attempts = 3;
    gameState.hasPlayed = false;

    const currentQuestion = currentPlayer.questions[currentPlayer.questionsAnswered];
    
    document.getElementById("player-name-display").textContent = currentPlayer.name;
    
    // Lógica de visualización de título (Mantenemos tu lógica de especiales/elderly)
    const categoryDisplayEl = document.getElementById('category-display');
    if (gameState.selectedDecade === 'verano') {
        categoryDisplayEl.innerText = "Especiales - Canciones del Verano";
    } else if (gameState.selectedDecade === 'elderly') {
        categoryDisplayEl.innerText = "Modo Fácil - Todas las Canciones";
    } else {
        categoryDisplayEl.innerText = `${getDecadeLabel(gameState.selectedDecade)} - ${getCategoryLabel(gameState.category)}`;
    }
    
    document.getElementById('question-counter').innerText = `Pregunta ${currentPlayer.questionsAnswered + 1}/${gameState.totalQuestionsPerPlayer}`;
    document.getElementById('player-turn').innerText = `Turno de ${currentPlayer.name}`;
    document.getElementById('points-display').innerText = `Puntos: ${currentPlayer.score}`;

    updateAttemptsCounter();

    const answerButtonsContainer = document.getElementById('answer-buttons');
    answerButtonsContainer.innerHTML = '';

const allSongsToChooseFromForOptions =
    (gameState.selectedDecade === 'Todas')
        ? configuracionCanciones?.['Todas']?.[gameState.category]
        : configuracionCanciones?.[gameState.selectedDecade]?.[gameState.category];

if (!Array.isArray(allSongsToChooseFromForOptions) || allSongsToChooseFromForOptions.length < 4) {
    console.error(`Error: Pool no válido para ${gameState.selectedDecade} - ${gameState.category}`);
    showAppAlert(
        `No hay suficientes canciones en '${getCategoryLabel(gameState.category)}' para ${getDecadeLabel(gameState.selectedDecade)}.`
    );
    showScreen('category-screen');
    return;
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
/**
 * Reproduce un fragmento de audio con precisión usando timeupdate
 * Reemplaza al antiguo sistema basado en setTimeout
 */
function playAudioSnippet() {
    if (gameState.hasPlayed) return;
    
    const durations = { 3: 4.0, 2: 6.0, 1: 10.0 }; 
    const durationSecs = durations[gameState.attempts];
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const currentQuestion = currentPlayer.questions[currentPlayer.questionsAnswered];

    // 1. Limpieza y Normalización de la ruta
    let fileName = typeof currentQuestion.file === 'string' ? currentQuestion.file.trim() : '';
    
    if (!fileName || !fileName.includes('.')) {
        showAppAlert("Error: Archivo de audio no válido.");
        return;
    }

    // CORRECCIÓN LINUX (Railway): Convertimos 'Actual/' o '10s/PELICULAS/' a minúsculas
    // para que coincidan con la estructura de carpetas real y evitar 404.
    if (fileName.includes('/')) {
        const parts = fileName.split('/');
        // La década (primer parte) y categoría (segunda parte) siempre a minúsculas
        if (parts.length >= 2) {
            parts[0] = parts[0].toLowerCase();
            parts[1] = parts[1].toLowerCase();
            fileName = parts.join('/');
        }
    }

    const playBtn = document.getElementById('play-song-btn');
    playBtn.innerText = "🎵";
    playBtn.disabled = true;
    gameState.hasPlayed = true;

    // Construcción de la URL final
    let audioSrc = fileName;
    if (!fileName.startsWith('/') && !fileName.startsWith('http')) {
        audioSrc = `/audio/${fileName}`;
    }

    if (!audioPlayer.src.includes(audioSrc)) {
        audioPlayer.src = audioSrc;
    }
    
    if (activeTimeUpdateListener) {
        audioPlayer.removeEventListener('timeupdate', activeTimeUpdateListener);
        activeTimeUpdateListener = null;
    }

    audioPlayer.currentTime = 0;

    const stopAudioListener = () => {
        if (audioPlayer.currentTime >= durationSecs) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0; 
            playBtn.innerText = "▶";
            audioPlayer.removeEventListener('timeupdate', stopAudioListener);
            activeTimeUpdateListener = null;
        }
    };

    activeTimeUpdateListener = stopAudioListener;
    audioPlayer.addEventListener('timeupdate', stopAudioListener);

    audioPlayer.play().catch(e => {
        console.error("Error al reproducir audio:", audioSrc, e);
        showAppAlert("Error 404: El archivo no existe o la ruta es incorrecta.");
        playBtn.disabled = false;
        playBtn.innerText = "▶";
        gameState.hasPlayed = false; 
    });
}

/**
 * Verifica la respuesta del jugador.
 * @param {boolean} isCorrect - True si la respuesta es correcta, false si es incorrecta.
 * @param {HTMLElement} button - El botón de respuesta que se pulsó.
 */
// ==========================================
// FUNCIÓN: checkAnswer (CON BLOQUEO DE ERRORES)
// ==========================================

function checkAnswer(isCorrect, button) {
    if (!gameState.hasPlayed) {
        showAppAlert("¡Primero tienes que pulsar el botón ▶ para escuchar la canción!");
        return;
    }

    // --- LIMPIEZA DE AUDIO Y LISTENERS (Fix de tiempos) ---
    clearTimeout(audioPlaybackTimeout); 
    
    if (activeTimeUpdateListener) {
        audioPlayer.removeEventListener('timeupdate', activeTimeUpdateListener);
        activeTimeUpdateListener = null;
    }
    
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    // -------------------------------------

    // Bloqueamos TODOS momentáneamente al pulsar
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
        
        // Marcamos visualmente el error (rojo)
        button.classList.add('incorrect');
        
        gameState.attempts--;
        updateAttemptsCounter();
        
        if (gameState.attempts > 0) {
            setTimeout(() => {
                // --- CAMBIO: LÓGICA DE DESCARTES ---
                document.querySelectorAll('.answer-btn').forEach(btn => {
                    // Si el botón YA es incorrecto, lo dejamos disabled (bloqueado)
                    // Solo rehabilitamos los que no se han pulsado aún
                    if (!btn.classList.contains('incorrect')) {
                        btn.classList.remove('disabled');
                    }
                    // IMPORTANTE: No quitamos la clase 'incorrect' para que siga rojo
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

    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);

    // Lógica para determinar el ganador y mostrar el mensaje
    if (gameState.players.length === 1) {
        const player = gameState.players[0];
        winnerDisplay.textContent = `${player.name} has conseguido ${player.score} puntos.`;
        winnerDisplay.style.animation = 'none';
        winnerDisplay.style.textShadow = 'none';
        winnerDisplay.style.color = 'var(--light-text-color)';
        winnerDisplay.style.border = 'none';
        winnerDisplay.style.fontSize = '1.8rem';

        // Solo guardar puntuaciones acumuladas si es un usuario logueado (no modo elderly ni verano)
        if (currentUser && currentUser.email && !isElderlyMode && !isSummerSongsMode) { // <-- AÑADE !isSummerSongsMode
            saveUserScores(currentUser.email, gameState.selectedDecade, gameState.category, player.score);
        }

    } else { // Más de un jugador (multijugador local o online, pero online se gestiona arriba)
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

        // Solo guardar puntuaciones acumuladas si es un usuario logueado (no modo elderly ni verano)
        if (currentUser && currentUser.email && !isElderlyMode && !isSummerSongsMode) { // <-- AÑADE !isSummerSongsMode
            const loggedInPlayer = gameState.players.find(p => p.email === currentUser.email);
            if (loggedInPlayer) {
                saveUserScores(currentUser.email, gameState.selectedDecade, gameState.category, loggedInPlayer.score);
            } else {
                console.warn("Usuario logueado no encontrado en la lista de jugadores de la partida.");
            }
        }

        // Solo guardar historial de partida si no es el modo fácil, verano y es multijugador offline
        if (!isElderlyMode && !isSummerSongsMode && gameState.players.length > 1 && !isOnlineMode) { // <-- AÑADE !isSummerSongsMode
            saveGameResult(gameState.players, winnerName, gameState.selectedDecade, gameState.category, 'offline');
        }
    } // <-- ESTE CORCHETE ESTABA DUPLICADO O MAL COLOCADO PREVIAMENTE

    sortedPlayers.forEach((player, index) => {
        const medal = (gameState.players.length > 1) ? ({ 0: '🥇', 1: '🥈', 2: '🥉' }[index] || '') : '';
        finalScoresContainer.innerHTML += `<p>${medal} ${player.name}: <strong>${player.score} puntos</strong></p>`;
    });

    // Recopilar todas las canciones jugadas en esta partida por todos los jugadores
    let allPlayedSongsInThisGame = [];
    gameState.players.forEach(player => {
        allPlayedSongsInThisGame = allPlayedSongsInThisGame.concat(player.questions);
    });

    // Actualizar el historial de canciones recientes para el usuario logueado
    // Esto se mantiene, ya que guarda en localStorage y solo aplica si currentUser existe.
    if (currentUser && currentUser.email) {
        // La función `updateRecentSongsHistory` ya maneja bien el `selectedDecade` y `category`
        updateRecentSongsHistory(currentUser.email, gameState.selectedDecade, gameState.category, allPlayedSongsInThisGame);
    }

    // Ajustar el comportamiento de los botones de la pantalla de fin de juego
    document.getElementById('play-again-btn').textContent = "Jugar Otra Vez"; // Texto genérico por defecto
    document.getElementById('play-again-btn').onclick = () => {
        // Lógica para jugar de nuevo, basada en el modo
        if (isElderlyMode) {
            // Reiniciar inputs y volver a la pantalla de inicio del modo fácil
            document.getElementById('elderly-player-1-name').value = '';
            document.getElementById('elderly-other-player-names-inputs').innerHTML = '';
            elderlyPlayerCount = 1; // Resetear a 1 jugador
            showScreen('elderly-mode-intro-screen');
        } else if (isSummerSongsMode) { // <-- NUEVA LÓGICA PARA MODO VERANO
            isSummerSongsMode = false; // Resetear el estado
            gameState = {}; // Limpiar gameState
            startSummerSongsGame(); // Volver a iniciar una partida de verano
        }
        else if (isOnlineMode) {
            // Limpiar estado online y volver al menú online
            isOnlineMode = false;
            currentOnlineGameCode = null;
            currentOnlineSongs = [];
            currentOnlineEmail = null;
            currentOnlinePlayerName = null;
            localStorage.removeItem('currentOnlineGameData');
            showScreen('online-mode-screen');
        } else {
            // Modo offline normal, volver a selección de jugadores/categoría
            gameState.players.forEach(player => {
                player.score = 0;
                player.questionsAnswered = 0;
                player.questions = [];
            });
            showScreen('player-selection-screen');
        }
    };

    // La función endOnlineModeAndGoHome() se llama desde el botón "Menú Principal" en index.html.
    // Esa función ya maneja la lógica de redirección y limpieza para online/normal.
    // El botón "Salir del Juego" llama a 'logout()'.

// ... código anterior dentro de endGame ...

    // PEGAR ESTO AQUÍ:
    const shareBtn = document.getElementById('share-result-btn');
    if (shareBtn) {
        shareBtn.onclick = shareGameResultHandler;
        // Mostrar el botón (por si estaba oculto)
        shareBtn.style.display = 'inline-block'; 
    }
    // FIN PEGAR

    setOnlineMenuButtonVisibility(false);
    setEndGameNavigationButtons();
    showScreen('end-game-screen');
}

function setOnlineMenuButtonVisibility(isVisible) {
    const onlineMenuButton = document.getElementById('online-menu-btn');
    if (!onlineMenuButton) return;
    onlineMenuButton.style.display = isVisible ? 'inline-flex' : 'none';
}

function setEndGameNavigationButtons() {
    const backToCategories = document.getElementById('back-to-categories-btn');
    const backToDecades = document.getElementById('back-to-decades-btn');
    if (!backToCategories || !backToDecades) return;

    if (isOnlineMode) {
        backToCategories.style.display = 'none';
        backToDecades.style.display = 'none';
        return;
    }

    const selectedDecade = gameState?.selectedDecade;
    const showCategories = selectedDecade && selectedDecade !== 'Todas';
    backToCategories.style.display = showCategories ? 'inline-flex' : 'none';
    backToDecades.style.display = 'inline-flex';

    backToCategories.onclick = () => {
        closeHamburgerMenu();
        showScreen('category-screen');
    };

    backToDecades.onclick = () => {
        closeHamburgerMenu();
        showScreen('decade-selection-screen');
        generateDecadeButtons();
    };
}

/**
 * Permite al usuario salir del juego después de una confirmación.
 */
async function exitGame() {
    closeHamburgerMenu();
    const confirmed = await showAppConfirm('¿Seguro que quieres salir del juego? Se cerrará la sesión actual.');
    if (confirmed) {
        logout();
    }
}

/**
 * Confirma si el usuario desea regresar al menú principal, perdiendo el progreso de la partida actual.
 */
// main.js - confirmReturnToMenu
// main.js - confirmReturnToMenu
async function confirmReturnToMenu() {
    closeHamburgerMenu();
    const confirmed = await showAppConfirm("¿Estás seguro de que quieres volver al menú principal? Perderás el progreso de esta partida.");
    if (confirmed) {
        if (isOnlineMode) {
            isOnlineMode = false;
            currentOnlineGameCode = null;
            currentOnlineSongs = [];
            currentOnlineEmail = null;
            currentOnlinePlayerName = null;
            localStorage.removeItem('currentOnlineGameData');
            showScreen('online-mode-screen'); // Volver al menú online
        } else if (isElderlyMode) {
            isElderlyMode = false; // Resetear el estado
            gameState = {}; // Limpiar gameState
            document.getElementById('elderly-player-1-name').value = ''; // Limpiar input principal
            document.getElementById('elderly-other-player-names-inputs').innerHTML = ''; // Limpiar inputs extra
            showScreen('elderly-mode-intro-screen'); // Volver a la pantalla de inicio del modo fácil
        } else if (isSummerSongsMode) { // <-- NUEVA CONDICIÓN PARA MODO VERANO
            isSummerSongsMode = false; // Resetear el estado
            gameState = {}; // Limpiar gameState
            showScreen('decade-selection-screen'); // Volver a la selección de década
        }
        else { // Modo offline normal
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
        showAppAlert("Debes iniciar sesión para ver tus estadísticas.");
        showScreen('login-screen');
        return;
    }

    showScreen('statistics-screen');
    renderUserTotalScores();
    renderDuelHistory();
}

async function confirmResetStatistics() {
    if (!currentUser || !currentUser.email) {
        showAppAlert("Debes iniciar sesión para borrar tus estadísticas.");
        showScreen('login-screen');
        return;
    }

    const confirmed = await showAppConfirm(
        '¿Seguro que quieres borrar tus estadísticas? Empezarán de cero desde este momento y no podrás recuperar las actuales.'
    );
    if (!confirmed) return;

    await resetUserStatistics();
}

async function resetUserStatistics() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/scores/${currentUser.email}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (response.ok) {
            userAccumulatedScores[currentUser.email] = {};
            renderUserTotalScores();
            showAppAlert(result.message || 'Estadísticas borradas correctamente.');
        } else {
            showAppAlert(result.message || 'No se pudieron borrar las estadísticas.');
        }
    } catch (error) {
        console.error('Error de red al borrar estadísticas:', error);
        showAppAlert('Error de conexión. Intenta de nuevo más tarde.');
    }
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

    const decadesInOrder = DECADES_WITH_SPECIALS;
    let hasScoresToDisplay = false;

    decadesInOrder.forEach(decadeId => {
        const categoriesInDecade = userScores[decadeId];
        if (categoriesInDecade && Object.keys(categoriesInDecade).length > 0) {
            hasScoresToDisplay = true;
            const decadeHeader = document.createElement('h4');
            decadeHeader.style.color = 'var(--secondary-color)';
            decadeHeader.style.marginTop = '15px';
            decadeHeader.style.marginBottom = '10px';
            decadeHeader.textContent = getDecadeLabel(decadeId);
            categoryScoresList.appendChild(decadeHeader);

            const sortedCategoriesInDecade = Object.entries(categoriesInDecade).sort(([, scoreA], [, scoreB]) => scoreB - scoreA);

            sortedCategoriesInDecade.forEach(([categoryId, score]) => {
                const categoryNameDisplay = getCategoryLabel(categoryId);
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
            listItem.textContent = `Fecha: ${game.date}, Ganador: ${game.winner}, Década: ${getDecadeLabel(game.decade)}, Categoría: ${getCategoryLabel(game.category)}`;
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
async function showSongsListCategorySelection() {
    showScreen('songs-list-category-screen');
    const container = document.getElementById('songs-list-category-buttons');
    container.innerHTML = '';

    const decadesToLoad = DECADES_WITH_SPECIALS.filter(decadeId => decadeId !== 'Todas' && decadeId !== 'verano');
    const loadPromises = decadesToLoad.flatMap(decadeId => (
        CATEGORY_ORDER.map(categoryId => (
            loadSongsForDecadeAndCategory(decadeId, categoryId).catch(error => {
                console.warn(`No se pudo cargar la categoría ${categoryId} para la década ${decadeId}.`, error);
                return null;
            })
        ))
    ));

    await Promise.allSettled(loadPromises);

    DECADES_WITH_SPECIALS.forEach(decadeId => {
        if (decadeId === 'Todas' || decadeId === 'verano') {
            const allButtonDiv = document.createElement('div');
            allButtonDiv.style.gridColumn = '1 / -1'; 
            allButtonDiv.style.marginTop = '20px';
            const allButton = document.createElement('button');
            allButton.className = 'category-btn tertiary';
            allButton.innerText = getDecadeLabel(decadeId);
            allButton.onclick = () => displaySongsForCategory(decadeId, 'consolidated');
            if (!hasPremiumAccess()) {
                allButton.classList.add('locked');
            }
            allButtonDiv.appendChild(allButton);
            container.appendChild(allButtonDiv);
            return; 
        }

        const decadeCategorySongs = configuracionCanciones[decadeId];
        if (decadeCategorySongs) {
            const decadeHeader = document.createElement('h3');
            decadeHeader.textContent = getDecadeLabel(decadeId);
            decadeHeader.style.color = 'var(--secondary-color)';
            decadeHeader.style.marginTop = '20px';
            decadeHeader.style.marginBottom = '10px';
            container.appendChild(decadeHeader);

            const categoryButtonsForDecadeDiv = document.createElement('div');
            categoryButtonsForDecadeDiv.style.display = 'grid';
            categoryButtonsForDecadeDiv.style.gridTemplateColumns = '1fr 1fr';
            categoryButtonsForDecadeDiv.style.gap = '10px';
            container.appendChild(categoryButtonsForDecadeDiv);

            CATEGORY_ORDER.forEach(categoryId => {
                const songsArray = decadeCategorySongs[categoryId];
                if (Array.isArray(songsArray) && songsArray.length > 0) { 
                    const button = document.createElement('button');
                    button.className = 'category-btn';
                    button.innerText = getCategoryLabel(categoryId);
                    button.onclick = () => displaySongsForCategory(decadeId, categoryId);
                    if (isPremiumCategory(categoryId) && !hasPremiumAccess()) {
                        button.classList.add('locked');
                    }
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
       if (isPremiumSelection(decadeId, categoryId) && !hasPremiumAccess()) {
        // INDICACIÓN PRECISA: Usamos 'categoryId' que es la variable disponible en esta función
        showPremiumModal('Esta categoría es Premium. Desbloquéala para ver el listado de canciones.', categoryId);
        return;
        }
        if (gameState.selectedDecade === 'Todas') {
    const mergedPool = configuracionCanciones?.['Todas']?.[gameState.category];

    if (!Array.isArray(mergedPool) || mergedPool.length < 4) {
        console.error(`Error: Pool no válido para Todas - ${gameState.category}`);
        showAppAlert('Error interno al preparar la pregunta. Vuelve a empezar.');
        showScreen('category-screen');
        return;
    }

    allSongsPool = mergedPool;
}  else {
            await loadSongsForDecadeAndCategory(decadeId, categoryId); 
            songsToDisplay = configuracionCanciones[decadeId][categoryId];
        }
    } catch (error) {
        showAppAlert(`No se pudo cargar la lista de canciones para ${getDecadeLabel(decadeId)} - ${getCategoryLabel(categoryId)}.`);
        console.error(error);
        showScreen('songs-list-category-screen');
        return;
    }

    const songsListContainer = document.getElementById('songs-list-container');
    const songsListCategoryTitle = document.getElementById('songs-list-category-title');

    songsListContainer.innerHTML = '';
    songsListCategoryTitle.textContent = `Canciones de ${getDecadeLabel(decadeId)} - ${getCategoryLabel(categoryId)}`;

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
let isElderlyMode = false;
let isSummerSongsMode = false;
let onlineInvitePollInterval = null;
let lastInviteCodes = new Set();

// ========== CREAR PARTIDA ONLINE ==========
// main.js - Mejora en createOnlineGame
async function createOnlineGame() {
    const decade = document.getElementById('online-decade-select').value;
    const category = document.getElementById('online-category-select').value;
    const playerData = getCurrentUserData();

    if (!playerData || !playerData.email) {
        showAppAlert("Debes iniciar sesión para crear una partida.");
        return;
    }

    // Validación de acceso premium
    if (isPremiumSelection(decade, category) && !hasPremiumAccess()) {
        showPremiumModal('Esta combinación es Premium. Desbloquéala para jugar online.', category);
        return;
    }

    try {
        await loadSongsForDecadeAndCategory(decade, category);
        const songsArray = configuracionCanciones[decade][category].sort(() => 0.5 - Math.random()).slice(0, 10);

        if (songsArray.length < 10) {
            showAppAlert("No hay suficientes canciones en esta categoría.");
            return;
        }

        const response = await fetch(`${API_BASE_URL}/api/online-games`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creatorEmail: playerData.email,
                category,
                decade,
                songsUsed: songsArray,
                playerName: playerData.playerName
            })
        });

        const result = await response.json();
        
        if (response.ok) {
            currentOnlineGameCode = result.code;
            isOnlineMode = true;

            localStorage.setItem('currentOnlineGameData', JSON.stringify({
                code: result.code,
                songsUsed: songsArray,
                decade: decade,
                category: category
            }));

            // MODAL CON BOTONES DE COPIAR Y COMPARTIR
            const shareText = `¡Rétame en Adivina la Canción! 🎵\nMi código de partida es: ${result.code}\nJuega aquí: https://adivinalacancion.app`;

            const modalOptions = {
                title: '¡Partida Creada!',
                message: `Tu código es: ${result.code}\n\nComparte este código con tu rival para que pueda unirse.`,
                confirmText: 'Empezar Partida',
                cancelText: 'Copiar y Compartir',
                showCancel: true
            };

            const userChoice = await showAppModal(modalOptions);

            if (!userChoice) {
                // Si el usuario pulsa "Copiar y Compartir"
                if (navigator.share) {
                    try {
                        await navigator.share({
                            title: 'Duelo Online - Adivina la Canción',
                            text: shareText
                        });
                    } catch (err) {
                        console.log("Compartir cancelado o no disponible");
                        copyOnlineGameCode(result.code);
                    }
                } else {
                    copyOnlineGameCode(result.code);
                }
            }

            // Iniciar la partida tras la interacción
            startOnlineGame();
        } else {
            showAppAlert(result.message || "Error al crear la partida.");
        }
    } catch (err) {
        console.error("Error en createOnlineGame:", err);
        showAppAlert("Error de conexión al crear la partida.");
    }
}

// Nueva función de apoyo P3
function shareOnlineCode(code) {
    const text = `¡Rétame en Adivina la Canción! 🎵\nMi código de partida es: ${code}\nEntra aquí: https://adivinalacancion.app`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Duelo en Adivina la Canción',
            text: text
        }).catch(() => copyOnlineGameCode(code));
    } else {
        copyOnlineGameCode(code);
    }
}

// ========== UNIRSE A UNA PARTIDA ONLINE ==========
async function joinOnlineGame() {
    const code = document.getElementById('join-code-input').value.trim().toUpperCase();
    if (!code) return showAppAlert("Introduce un código válido.");

    const playerData = getCurrentUserData(); // <-- OBTENER DATOS AQUÍ
    if (!playerData || !playerData.email || !playerData.playerName) { // <<-- ¡CUIDADO! AQUÍ DICE 'player.playerName', debe ser playerData.playerName
        showAppAlert("Debes iniciar sesión con tu nombre de jugador para jugar online.");
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
            await startOnlineGame();
        } else {
            showAppAlert(result.message || 'Error al unirse a la partida.');
        }
    } catch (err) {
        console.error(err);
        showAppAlert('Error al unirse a la partida.');
    }
}

// main.js - AÑADE ESTA NUEVA FUNCIÓN COMPLETA
// Nueva función para unirse a una partida pendiente (reutiliza lógica de joinOnlineGame)
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
            currentOnlineSongs = result.game.songsUsed;
            currentOnlineEmail = email;
            currentOnlinePlayerName = playerName;
            isOnlineMode = true;

            // Guardar info del juego online para usarla en startOnlineGame
            localStorage.setItem('currentOnlineGameData', JSON.stringify({
                code: code,
                songsUsed: result.game.songsUsed,
                decade: result.game.decade,
                category: result.game.category
            }));

            await startOnlineGame(); // Inicia el juego
        } else {
            showAppAlert(result.message || 'Error al unirse a la partida pendiente.');
            loadPlayerOnlineGames(); // Recarga la lista por si el estado cambió
        }
    } catch (err) {
        console.error('Error de red al unirse a la partida pendiente:', err);
        showAppAlert('Error de conexión. Intenta de nuevo más tarde.');
    }
}

// ========== OBTENER CANCIONES PARA LA PARTIDA ONLINE ==========
async function getSongsForOnlineMatch(decade, category) {
    await loadSongsForDecadeAndCategory(decade, category);
    // ====== MODO "TODAS LAS DÉCADAS" ======
    if (gameState.selectedDecade === 'Todas') {
        gameState.category = category;

        const allDecades = ['80s', '90s', '00s', '10s', 'Actual'];

        let mergedSongs = [];

        for (const dec of allDecades) {
            try {
                await loadSongsForDecadeAndCategory(dec, category);

                if (
                    configuracionCanciones[dec] &&
                    configuracionCanciones[dec][category] &&
                    Array.isArray(configuracionCanciones[dec][category])
                ) {
                    mergedSongs = mergedSongs.concat(configuracionCanciones[dec][category]);
                }
            } catch (e) {
                console.warn(`No se pudieron cargar canciones de ${dec} - ${category}`, e);
            }
        }

        // Guardamos mezcla global
        configuracionCanciones['Todas'] = configuracionCanciones['Todas'] || {};
        configuracionCanciones['Todas'][category] = mergedSongs;

        // Validación mínima
        if (mergedSongs.length < gameState.totalQuestionsPerPlayer) {
            showAppAlert(`No hay suficientes canciones en la categoría ${getCategoryLabel(category)} para jugar en Todas las Décadas.`);
            return;
        }

        showScreen('player-selection-screen');
        return;
    }

    const songs = configuracionCanciones[decade][category];
    const shuffled = [...songs].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 10);
}

// ========== EMPEZAR PARTIDA ONLINE ==========
// main.js - startOnlineGame
async function startOnlineGame() {
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
        showAppAlert("Error: No se pudo cargar la información de la década/categoría para la partida online.");
        showScreen('online-mode-screen');
        return;
    }
    try {
        await loadSongsForDecadeAndCategory(gameState.selectedDecade, gameState.category);
    } catch (error) {
        console.error('Error al cargar las canciones para la partida online:', error);
        showAppAlert('Error al cargar las canciones para la partida online. Intenta de nuevo más tarde.');
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
        showAppAlert("Error interno al enviar la puntuación.");
        return;
    }

    try {
        const storedGame = JSON.parse(localStorage.getItem('currentOnlineGameData') || '{}');
        
        const response = await fetch(`${API_BASE_URL}/api/online-games/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code: storedGame.code || currentOnlineGameCode,
            email: localPlayer.email,
            score: localPlayer.score
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
            showAppAlert(result.message || 'Error al enviar resultado.');
        }
    } catch (err) {
        console.error(err);
        showAppAlert('Error al guardar la puntuación online.');
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

    populateDecadeOptions(decadeSelect, getDecadesForSelect());
    populateCategoryOptions(categorySelect, getCategoriesForSelect());
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

    populateDecadeOptions(decadeSelect, getDecadesForSelect());
    populateCategoryOptions(categorySelect, getCategoriesForSelect());
}

function formatOnlineGameDate(dateValue) {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

function isOnlineGameFinished(game) {
    return game.players.length === 2 && (game.finished || game.players.every(player => player.finished));
}

async function invitePlayerByName() {
    const rivalName = document.getElementById('rival-name-input').value.trim();
    const decade = document.getElementById('invite-decade-select').value;
    const category = document.getElementById('invite-category-select').value;

     const playerData = getCurrentUserData(); // <-- OBTENER DATOS AQUÍ
    if (!rivalName || !playerData || !playerData.email || !playerData.playerName) {
        showAppAlert("Faltan datos o no estás logueado con un nombre de jugador.");
        showScreen('login-screen'); // <-- Redirigir a login si no está logueado
        return;
    }
    if (isPremiumSelection(decade, category) && !hasPremiumAccess()) {
    // INDICACIÓN PRECISA: Pasamos 'category' para que el modal sepa qué categoría ofrecer
    showPremiumModal('Esta categoría es Premium. Desbloquéala para invitar a tus amigos.', category);
    return;
    } 

    const songsArray = await getSongsForOnlineMatch(decade, category);
    if (!songsArray || songsArray.length < 10) {
        showAppAlert("No hay suficientes canciones.");
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
            showAppAlert("Invitación enviada a " + rivalName);
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
            await startOnlineGame();

        } else {
            showAppAlert(result.message || "Error al invitar.");
        }
    } catch (err) {
        console.error(err);
        showAppAlert("Error al enviar la invitación.");
    }
}

/**
 * Actualiza el contador rojo en el botón "Ver Partidas Recibidas"
 * del menú online.
 */
function updateOnlineInviteBadge(count) {
    const badge = document.getElementById('online-invite-count');
    if (badge) {
        badge.textContent = count;
        if (count > 0) {
            badge.hidden = false;
            badge.style.display = 'inline-flex';
        } else {
            badge.hidden = true;
            badge.style.display = 'none';
        }
    }
}

async function loadPlayerOnlineGames() {
    // 1. RECUPERACIÓN SEGURA (Crítico para móviles)
    const rawData = localStorage.getItem("userData");
    if (!rawData) {
        const activeContainer = document.getElementById('active-games-list');
        const finishedContainer = document.getElementById('finished-games-list');
        if (activeContainer) activeContainer.innerHTML = "<p>Inicia sesión para ver tus partidas.</p>";
        if (finishedContainer) finishedContainer.innerHTML = "";
        return;
    }
    
    let playerData;
    try {
        playerData = JSON.parse(rawData);
    } catch (e) {
        console.error("Error al parsear userData");
        return;
    }

    const userEmail = playerData.email ? playerData.email.trim().toLowerCase() : null;
    if (!userEmail) return;

    try {
        const emailEnc = encodeURIComponent(userEmail);
        const response = await fetch(`${API_BASE_URL}/api/online-games/player/${emailEnc}`, {
            method: 'GET',
            headers: { 
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        const data = await response.json();
        const games = Array.isArray(data) ? data : (Array.isArray(data?.games) ? data.games : []);

        const activeGamesContainer = document.getElementById('active-games-list');
        const finishedGamesContainer = document.getElementById('finished-games-list');
        
        if (activeGamesContainer) activeGamesContainer.innerHTML = ''; 
        if (finishedGamesContainer) finishedGamesContainer.innerHTML = '';

        if (games.length === 0) {
            if (activeGamesContainer) activeGamesContainer.innerHTML = "<p>No tienes partidas online activas.</p>";
            if (finishedGamesContainer) finishedGamesContainer.innerHTML = "<p>No tienes partidas online finalizadas.</p>";
            updateOnlineInviteBadge(0);
            return;
        }

        const activeGames = games.filter(game => !isOnlineGameFinished(game));
        const finishedGames = games.filter(game => isOnlineGameFinished(game));
        
        // Notificaciones y Badge
        const pendingInvites = activeGames.filter(game =>
            game.waitingFor === userEmail &&
            game.players.every(p => p.email !== userEmail)
        );
        updateOnlineInviteBadge(pendingInvites.length);
        showInviteToast(pendingInvites); 

        // 3. RENDERIZADO DE PARTIDAS ACTIVAS
        if (activeGames.length > 0 && activeGamesContainer) {
            activeGames.forEach((game) => {
                const gameDiv = document.createElement('div');
                gameDiv.className = 'online-game-item';

                // Variables de estado
                const isCreator = game.creatorEmail === userEmail;
                const currentPlayerStatus = game.players.find(p => p.email === userEmail);
                const otherPlayer = game.players.find(p => p.email !== userEmail);
                
                // LÓGICA DE NOMBRE (Optimizada)
                let displayRivalName = 'Desconocido';
                
                if (game.players.length === 2 && otherPlayer) {
                    displayRivalName = otherPlayer.name;
                } else if (game.waitingFor && isCreator) {
                    // Si el backend envía el nombre, lo usamos. Si no, usamos el email limpio.
                    displayRivalName = game.rivalPlayerName || game.waitingFor; 
                } else if (!game.waitingFor && isCreator) {
                    displayRivalName = 'Esperando rival';
                } else if (game.players.length > 0 && !isCreator) {
                    displayRivalName = game.players[0].name; 
                }

                // LÓGICA DE BOTONES Y ESTADO
                let statusText = '';
                let actionButtonsHTML = '';

                // CASO 1: Me han invitado a mí
                const isWaitingForMe = game.waitingFor === userEmail && !currentPlayerStatus;

                if (isWaitingForMe) {
                    statusText = `¡Te han invitado!`;
                    actionButtonsHTML = `
                        <button class="btn" onclick="joinOnlineGameFromPending('${game.code}', '${playerData.playerName}', '${userEmail}')">Aceptar y Unirse</button>
                        <button class="btn secondary" onclick="declineOnlineGame('${game.code}')">Declinar</button>
                    `;
                } 
                // CASO 2: Soy el Creador y estoy esperando
                else if (game.players.length === 1 && isCreator) {
                    
                    if (game.waitingFor) {
                        // A) Invitación por NOMBRE
                        statusText = `Invitación enviada.`;
                        // Solo eliminar (Correcto según tus instrucciones)
                        actionButtonsHTML = `
                            <button class="btn danger" onclick="deletePendingOnlineGame('${game.code}')">Eliminar</button>
                        `;
                    } else {
                        // B) Invitación por CÓDIGO
                        statusText = 'Esperando a que un rival se una...';
                        // Copiar código y Eliminar (Quitado Declinar que sobraba)
                        actionButtonsHTML = `
                            <button class="btn secondary" onclick="copyOnlineGameCode('${game.code}')">Copiar Código</button>
                            <button class="btn danger" onclick="deletePendingOnlineGame('${game.code}')">Eliminar</button>
                        `;
                    }

                    // Botón de rescate si el creador no jugó
                    if (currentPlayerStatus && !currentPlayerStatus.finished) {
                        statusText = "No has completado tu turno.";
                        actionButtonsHTML = `
                            <button class="btn" onclick="continueOnlineGame('${game.code}', '${playerData.playerName}', '${userEmail}')">Jugar</button>
                            ${actionButtonsHTML}
                        `;
                    }
                } 
                // CASO 3: Partida en curso (2 jugadores)
                else if (game.players.length === 2) { 
                    const otherPlayerFinished = otherPlayer ? otherPlayer.finished : false;
                    const myFinished = currentPlayerStatus ? currentPlayerStatus.finished : false;

                    if (myFinished && !otherPlayerFinished) {
                        statusText = `Esperando a ${otherPlayer ? otherPlayer.name : 'rival'}...`;
                        actionButtonsHTML = `<button class="btn secondary" onclick="goToOnlineWaitScreen('${game.code}')">Ver Estado</button>`;
                    } else if (!myFinished && otherPlayerFinished) {
                        statusText = `¡Tu turno! ${otherPlayer ? otherPlayer.name : 'Rival'} ha terminado.`;
                        actionButtonsHTML = `<button class="btn" onclick="continueOnlineGame('${game.code}', '${playerData.playerName}', '${userEmail}')">Jugar</button>`;
                    } else if (!myFinished && !otherPlayerFinished) {
                        statusText = `Partida en curso.`;
                        actionButtonsHTML = `<button class="btn" onclick="continueOnlineGame('${game.code}', '${playerData.playerName}', '${userEmail}')">Continuar</button>`;
                    }
                }

                gameDiv.innerHTML = `
                    <p><strong>Partida con:</strong> ${displayRivalName}</p>
                    <p><strong>Década:</strong> ${getDecadeLabel(game.decade)}</p>
                    <p><strong>Categoría:</strong> ${getCategoryLabel(game.category)}</p>
                    <p><strong>Estado:</strong> ${statusText}</p>
                    <div class="online-game-actions">${actionButtonsHTML}</div>
                `;
                activeGamesContainer.appendChild(gameDiv);
            });
        } else if (activeGamesContainer) {
            activeGamesContainer.innerHTML = "<p>No tienes partidas online activas.</p>";
        }

        // 4. RENDERIZADO DE PARTIDAS FINALIZADAS
        if (finishedGames.length > 0 && finishedGamesContainer) {
            finishedGames.forEach((game) => {
                const gameDiv = document.createElement('div');
                gameDiv.className = 'online-game-item';
                const otherPlayer = game.players.find(p => p.email !== userEmail);
                const otherPlayerName = otherPlayer ? otherPlayer.name : 'Rival';

                gameDiv.innerHTML = `
                    <p><strong>Partida con:</strong> ${otherPlayerName}</p>
                    <p><strong>Categoría:</strong> ${getDecadeLabel(game.decade)} - ${getCategoryLabel(game.category)}</p>
                    <p><strong>Estado:</strong> FINALIZADA</p>
                    <button class="btn" onclick="viewOnlineGameResults('${game.code}')">Ver Resultados</button>
                `;
                finishedGamesContainer.appendChild(gameDiv);
            });
        } else if (finishedGamesContainer) {
            finishedGamesContainer.innerHTML = "<p>No tienes partidas finalizadas.</p>";
        }

    } catch (err) {
        console.error("Error en el historial:", err);
        const ac = document.getElementById('active-games-list');
        if (ac) ac.innerHTML = "<p>Error de conexión al cargar partidas.</p>";
    }
}

function showInviteToast(invites) {
    if (!invites || invites.length === 0) return;

    const newInvites = invites.filter(invite => !lastInviteCodes.has(invite.code));
    if (newInvites.length === 0) return;

    newInvites.forEach(invite => lastInviteCodes.add(invite.code));

    const invite = newInvites[0];
    const invitingPlayerName = invite.players[0] ? invite.players[0].name : 'Alguien';
    addNotification(`Nueva invitación de ${invitingPlayerName}.`, 'invite');
    sendInviteNotification(invitingPlayerName);
    const toast = document.createElement('div');
    toast.className = 'invite-toast';
    toast.innerHTML = `
        <p>¡Nueva invitación de <strong>${invitingPlayerName}</strong>!</p>
        <button class="btn" type="button">Ver partidas recibidas</button>
    `;

    const button = toast.querySelector('button');
    button.addEventListener('click', () => {
        toast.remove();
        showScreen('pending-games-screen');
    });

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 200);
    }, 6000);
}

async function requestInviteNotificationPermission() {
    if (!('Notification' in window)) return;

    const dismissed = localStorage.getItem('inviteNotificationsDismissed');
    const prompted = localStorage.getItem(NOTIFICATIONS_PROMPTED_KEY);
    if (dismissed === 'true' || Notification.permission !== 'default' || prompted === 'true') {
        return;
    }

    const allowed = await showAppConfirm('¿Quieres recibir notificaciones cuando tengas invitaciones online?');
    localStorage.setItem(NOTIFICATIONS_PROMPTED_KEY, 'true');
    if (!allowed) {
        localStorage.setItem('inviteNotificationsDismissed', 'true');
        return;
    }

    Notification.requestPermission().then(result => {
        if (result !== 'granted') {
            localStorage.setItem('inviteNotificationsDismissed', 'true');
        }
    }).catch(error => {
        console.warn('No se pudo solicitar permiso de notificaciones:', error);
    });
}

function sendInviteNotification(invitingPlayerName) {
    // Verificar soporte
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    if (Notification.permission === 'granted') {
        // Usar el Service Worker para mostrar la notificación (Compatible con Android/PWA)
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification('Nueva invitación online', {
                body: `Te ha invitado ${invitingPlayerName}.`,
                icon: 'img/adivina.png',
                vibrate: [200, 100, 200],
                badge: 'img/adivina.png',
                tag: 'invite-notification'
            });
        });
    }
}
function sendGameFinishedNotification(opponentName) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const notification = new Notification('Partida online finalizada', {
        body: `${opponentName} ha terminado su partida.`,
        icon: 'img/adivina.png'
    });

    notification.onclick = () => {
        window.focus();
        showScreen('pending-games-screen');
        notification.close();
    };
}

function startOnlineInvitePolling() {
    if (onlineInvitePollInterval) return;
    onlineInvitePollInterval = setInterval(() => {
        if (currentUser && currentUser.email) {
            loadPlayerOnlineGames();
        }
    }, 15000);
}

function stopOnlineInvitePolling() {
    if (!onlineInvitePollInterval) return;
    clearInterval(onlineInvitePollInterval);
    onlineInvitePollInterval = null;
}

async function declineOnlineGame(code) {
    const playerData = getCurrentUserData();
    if (!playerData?.email) {
        showAppAlert('Debes iniciar sesión para declinar una partida.');
        showScreen('login-screen');
        return;
    }

    const confirmed = await showAppConfirm('¿Quieres declinar esta partida online? Se eliminará la invitación pendiente.');
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/online-games/decline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, email: playerData?.email })
        });
        const result = await response.json();

        if (response.ok) {
            await showAppAlert(result.message || 'Partida declinada.');
            await loadPlayerOnlineGames();
        } else {
            showAppAlert(result.message || 'No se pudo declinar la partida.');
        }
    } catch (err) {
        console.error('Error al declinar partida online:', err);
        showAppAlert('Error de conexión. Intenta de nuevo más tarde.');
    }
}

async function deletePendingOnlineGame(code) {
    const playerData = getCurrentUserData();
    if (!playerData?.email) {
        showAppAlert('Debes iniciar sesión para eliminar una partida.');
        showScreen('login-screen');
        return;
    }

    const confirmed = await showAppConfirm('¿Seguro que quieres eliminar esta partida pendiente? Esta acción es irreversible.');
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/online-games/decline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, email: playerData?.email })
        });
        const result = await response.json();

        if (response.ok) {
            await showAppAlert(result.message || 'Partida eliminada.');
            await loadPlayerOnlineGames();
        } else {
            showAppAlert(result.message || 'No se pudo eliminar la partida.');
        }
    } catch (err) {
        console.error('Error al eliminar partida online:', err);
        showAppAlert('Error de conexión. Intenta de nuevo más tarde.');
    }
}

// main.js - AÑADE ESTAS NUEVAS FUNCIONES
function copyOnlineGameCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        showAppAlert(`Código de partida copiado: ${code}`);
    }).catch(err => {
        console.error('Error al copiar el código:', err);
        showAppAlert(`No se pudo copiar el código. Por favor, cópialo manualmente: ${code}`);
    });
}

async function viewOnlineGameResults(code) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/online-games/${code}`);
        const result = await response.json();
        if (response.ok && result.finished && result.players?.length === 2) {
            // Limpiar el estado de la partida actual para evitar conflictos
            currentOnlineGameCode = null;
            currentOnlineSongs = [];
            isOnlineMode = false;
            localStorage.removeItem('currentOnlineGameData');

            showOnlineResults(result); // Reutiliza la función existente para mostrar resultados
        } else {
            showAppAlert(result.message || 'La partida aún no ha terminado o no se encontraron resultados.');
            // Recargar la lista por si el estado cambió
            loadPlayerOnlineGames();
        }
    } catch (err) {
        console.error('Error al ver resultados de partida online:', err);
        showAppAlert('Error de conexión al cargar los resultados.');
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

            await startOnlineGame(); // Inicia el juego con los datos cargados
        } else {
            showAppAlert(result.message || 'Error al cargar la partida para continuar.');
            loadPlayerOnlineGames(); // Recargar la lista por si el estado cambió
        }
    } catch (err) {
        console.error('Error de red al continuar partida online:', err);
        showAppAlert('Error de conexión. Intenta de nuevo más tarde.');
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


    const topScore = sortedPlayers[0]?.score ?? null;
    const hasTieForFirst = sortedPlayers.filter(player => player.score === topScore).length > 1;

    sortedPlayers.forEach((player, index) => {
        let medal = '';
        if (hasTieForFirst && player.score === topScore) {
            medal = '🥇';
        } else {
            medal = ({ 0: '🥇', 1: '🥈', 2: '🥉' }[index] || '');
        }
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

    // ... código anterior dentro de showOnlineResults ...

    saveOnlineGameToHistory(gameData);

    // PEGAR ESTO AQUÍ:
    // Inyectamos datos en gameState para que el compartidor los lea
    gameState.players = gameData.players;
    gameState.selectedDecade = gameData.decade;
    gameState.category = gameData.category;

    const shareBtnOnline = document.getElementById('share-result-btn');
    if (shareBtnOnline) {
        shareBtnOnline.onclick = shareGameResultHandler;
        shareBtnOnline.style.display = 'inline-block';
    }
    // FIN PEGAR

    setOnlineMenuButtonVisibility(true);
    setEndGameNavigationButtons();
    showScreen('end-game-screen'); 
}


// ==========================================
// FUNCIONES DE COMPARTIR (NUEVO)
// ==========================================

function generateShareText(players, decadeId, categoryId) {
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
                text = `🚀 ¡PALIZA MUSICAL! ${winner.name} ha arrasado con ${winner.score} puntos frente a los ${second ? second.score : 0} de ${second ? second.name : 'su rival'}.\n\n🎶 Década: ${decade}\n💿 Categoría: ${category}\n\n¿Crees que puedes ganarle? ¡Entra y juega! 😏`;
            } else {
                text = `🏁 ¡Final de infarto! ${winner.name} (${winner.score} pts) ha ganado por los pelos a ${second ? second.name : 'su rival'} (${second ? second.score : 0} pts).\n\n🎶 Década: ${decade}\n💿 Categoría: ${category}\n\n¡La revancha está servida en Adivina la Canción! 🔥`;
            }
        }
    }

    return `${text}\n\nJuega gratis aquí 👉 ${url}`;
}

async function shareGameResultHandler() {
    let playersToShare, decadeToShare, categoryToShare;

    // Recuperamos datos dependiendo del modo
    if (isOnlineMode && localStorage.getItem('currentOnlineGameData')) {
         // Intentamos leer de la memoria local si el gameState se ha limpiado
         try {
             const savedData = JSON.parse(localStorage.getItem('currentOnlineGameData'));
             // Si gameState.players está vacío, usamos lo que tengamos en memoria o lo que hayamos inyectado
             playersToShare = (gameState.players && gameState.players.length > 0) ? gameState.players : []; 
             // Si no hay jugadores en gameState, esto fallará, pero lo hemos parcheado en showOnlineResults
             decadeToShare = savedData.decade;
             categoryToShare = savedData.category;
         } catch(e) {
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
                title: 'Adivina la Canción - Resultado',
                text: text
            });
        } catch (err) {
            console.log('Compartir cancelado:', err);
        }
    } else {
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        window.open(whatsappUrl, '_blank');
    }
}

function showStats() {
  closeHamburgerMenu();
  showStatisticsScreen();
}
function showAllSongs() {
  closeHamburgerMenu();
  showSongsListCategorySelection();
}
function showOnlineMenu() {
  closeHamburgerMenu();
  showScreen("online-mode-screen");
}

window.showStats = showStats;
window.showAllSongs = showAllSongs;
window.showOnlineMenu = showOnlineMenu;
window.confirmResetStatistics = confirmResetStatistics;

Object.assign(window, {
    togglePasswordVisibility,
    toggleNotificationsPanel,
    toggleHamburgerMenu,
    closeHamburgerMenu,
    showPasswordRecoveryInfo,
    showChangePasswordModal,
    showInstructions,
    closeInstructions,
    closePremiumModal,
    closePasswordResetModal,
    confirmPasswordReset,
    requestPasswordReset,
    closeChangePasswordModal,
    changePassword,
    loginUser,
    registerUser,
    setPlayerName,
    startSummerSongsGame,
    showOnlineMenu,
    createOnlineGame,
    joinOnlineGame,
    invitePlayerByName,
    confirmClearOnlineGameHistory,
    goToOnlineMenu,
    endOnlineModeAndGoHome,
    showSongsListCategorySelection,
    selectPlayers,
    startGame,
    continueToNextPlayerTurn,
    confirmReturnToMenu,
    addElderlyPlayerInput,
    startElderlyModeGame,
    exitGame,
    acceptCookieConsent
});

// =====================================================================
// INICIALIZACIÓN
// =====================================================================

// ... (resto del código)

// ==========================================
// GESTIÓN DE COOKIES (HUEVOS DE PASCUA)
// ==========================================

function checkCookieConsent() {
    // Comprobamos si ya aceptó el trato
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
        const banner = document.getElementById('cookie-consent-banner');
        if (banner) {
            // Pequeño retraso para que la animación luzca al cargar la web
            setTimeout(() => {
                banner.classList.remove('hidden');
            }, 1500);
        }
    }
}

function acceptCookieConsent() {
    // Guardamos que ha aceptado
    localStorage.setItem('cookieConsent', 'true');
    const banner = document.getElementById('cookie-consent-banner');
    if (banner) {
        // Efecto de salida (opcional, simplemente ocultamos)
        banner.style.opacity = '0';
        banner.style.transform = 'translate(-50%, 50px)';
        setTimeout(() => banner.classList.add('hidden'), 300);
    }
}


// Sustituye la función existente syncUserPermissions por esta:
async function syncUserPermissions() {
    // 1. Asegurar que tenemos usuario
    if (!currentUser || !currentUser.email) {
        const stored = getCurrentUserData();
        if (stored && stored.email) {
            currentUser = stored;
        } else {
            return; 
        }
    }

    const safeEmail = currentUser.email.trim();

    try {
        console.log(`🔄 Sincronizando permisos para ${safeEmail}...`);
        
        // Fetch con Cache Busting agresivo
        const response = await fetch(`${API_BASE_URL}/api/users/${safeEmail}?t=${Date.now()}`, {
            cache: "no-store",
            headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.user && Array.isArray(data.user.unlocked_sections)) {
                
                // 1. Leemos lo que tenemos localmente (incluyendo el desbloqueo optimista reciente)
                const activeNow = getActivePermissions(); // Usamos el helper
                const serverSections = data.user.unlocked_sections;
                
                // 2. FUSIÓN (MERGE): Local (Optimista) + Servidor (Persistente)
                const mergedSections = [...new Set([...activeNow, ...serverSections])];

                // 3. ACTUALIZAR MEMORIA (CRÍTICO PARA LA UI INMEDIATA)
                if (currentUser) {
                    currentUser.unlocked_sections = mergedSections;
                    // Opcional: Actualizar también userData en localStorage si lo usas para persistir sesión
                    const userData = JSON.parse(localStorage.getItem("userData") || '{}');
                    userData.unlocked_sections = mergedSections;
                    localStorage.setItem("userData", JSON.stringify(userData));
                }

                // 4. ACTUALIZAR ALMACÉN DE PERMISOS
                const allPerms = JSON.parse(localStorage.getItem(PERMISSIONS_STORAGE_KEY) || '{}');
                allPerms[safeEmail] = {
                    email: safeEmail,
                    unlocked_sections: mergedSections,
                    is_admin: (safeEmail === ADMIN_EMAIL)
                };
                localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(allPerms));
                
                console.log("✅ Permisos sincronizados (Fusión):", mergedSections);
                
                // 5. REDIBUJAR UI (Solo si es necesario)
                const currentScreen = document.querySelector('.screen.active');
                if (currentScreen) {
                    if (currentScreen.id === 'category-screen') generateCategoryButtons();
                    if (currentScreen.id === 'decade-selection-screen') updatePremiumButtonsState();
                    if (currentScreen.id === 'songs-list-category-screen') showSongsListCategorySelection();
                }
            }
        }
    } catch (error) {
        console.warn("❌ Error al sincronizar perfil:", error);
    }
}


let isSyncing = false;


// ==========================================
// SISTEMA DE PAGOS Y EVENTOS (CORREGIDO)
// ==========================================

function setupPaymentListeners() {
    // Verificamos si venimos de un pago exitoso de Stripe
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');

    if (sessionId) {
        console.log("💳 Detectado retorno de pago Stripe. Sincronizando...");
        syncUserPermissions();
        // Limpiamos la URL para no re-procesar el éxito al recargar
        window.history.replaceState({}, document.title, window.location.pathname);
        showAppAlert("¡Gracias por tu compra! Tu contenido se está desbloqueando.");
    }
}

// ==========================================
// HELPER GLOBAL PARA REFRESCAR UI
// (Debe estar FUERA de setupPaymentListeners)
// ==========================================
function refreshUI() {
    const currentScreen = document.querySelector('.screen.active');
    if (currentScreen) {
        if (currentScreen.id === 'category-screen') generateCategoryButtons();
        if (currentScreen.id === 'decade-selection-screen') updatePremiumButtonsState();
        if (currentScreen.id === 'songs-list-category-screen') showSongsListCategorySelection();
    }
}

// ==========================================
// ARRANQUE UNIFICADO (PERSISTENCIA DE SESIÓN)
// ==========================================
async function startApp(source = 'boot') {
    window.startApp = startApp;
    const versionEl = document.getElementById('app-version');
    if (versionEl) versionEl.textContent = APP_VERSION;
    // source: 'boot' | 'user'
    // - boot  => si NO hay sesión, mostrar home-screen
    // - user  => si NO hay sesión, mostrar login-screen

    // Rehidratación defensiva (no confiamos en RAM)
    let restored = null;
    try {
        const savedUserJSON = localStorage.getItem('userData');
        if (savedUserJSON) restored = JSON.parse(savedUserJSON);
    } catch (e) {
        console.error("❌ userData corrupto. Limpiando.", e);
        localStorage.removeItem('userData');
        localStorage.removeItem('loggedInUserEmail');
        localStorage.removeItem('sessionActive');
        restored = null;
    }

    // Validación mínima
    if (restored && restored.email) {
        currentUser = restored;
        localStorage.setItem('sessionActive', 'true');

        // --- ACTIVAR POLLING DE NOTIFICACIONES ---
        startOnlineInvitePolling(); 
        // -----------------------------------------

        // Cargar datos del usuario (sin bloquear el enrutamiento si falla)
        try { await loadUserScores(currentUser.email); } catch (e) { console.warn("Scores no cargados:", e); }
        try { await loadGameHistory(currentUser.email); } catch (e) { console.warn("Historial no cargado:", e); }

        // Enrutamiento
        if (currentUser.playerName) {
            showScreen('decade-selection-screen');
            if (typeof generateDecadeButtons === 'function') generateDecadeButtons();
            if (typeof updatePremiumButtonsState === 'function') updatePremiumButtonsState();
        } else {
            showScreen('set-player-name-screen');
        }
        return;
    }

    // Sin sesión
    if (source === 'user') {
        showScreen('login-screen');
    } else {
        showScreen('home-screen');
    }
}
// ==========================================
// INICIALIZACIÓN BLINDADA (SESIÓN + PAGOS)
// ==========================================
window.onload = async () => {
    console.log("🚀 Iniciando aplicación (boot) - Sesión persistente.");

    // 0. Registrar Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(registration => {
            console.log('SW registrado:', registration.scope);
            // Forzar actualización si hay uno nuevo esperando
            if (registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
        }).catch(err => {
            console.warn('SW fallo:', err);
        });
    }

    // 1. GESTIÓN DE COOKIES
    if (typeof checkCookieConsent === 'function') {
        checkCookieConsent();
    }

    // 2. RETORNO DE PAGO (Stripe)
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');

    if (sessionId) {
    console.log("💳 Retorno de pago detectado.");

    // Rehidratamos sesión y sincronizamos permisos si procede
    await startApp('boot');

    if (currentUser && typeof syncUserPermissions === 'function') {
        await syncUserPermissions();

        showAppAlert(
            "¡Pago realizado con éxito! 🎉\n\n" +
            "Las categorías premium se están desbloqueando en este momento. " +
            "Este proceso puede tardar unos segundos.\n\n" +
            "Si no ves el contenido desbloqueado inmediatamente, " +
            "espera un momento o refresca la página para actualizar el estado.",
            { confirmText: 'Entendido' }
        );
    }

    // Limpiar URL (elimina ?session_id)
    window.history.replaceState({}, document.title, window.location.pathname);
    return;
}


    // 3. ARRANQUE NORMAL (con persistencia)
    await startApp('boot');
};


