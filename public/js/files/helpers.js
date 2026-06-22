/**
 * Parsea una respuesta JSON de forma segura.
 * @param {Response} response - Objeto Response de fetch.
 * @returns {Object|null} Objeto JSON parseado o null si hay error.
 */
export async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

/**
 * Parsea el texto de visualización de una canción.
 * @param {string} displayText - Texto en formato "Artista - Título".
 * @returns {Object} Objeto con artist y title.
 */
export function parseDisplay(displayText) {
  if (!displayText || typeof displayText !== "string") {
    return { artist: "", title: "" };
  }

  const parts = displayText.split(" - ");
  if (parts.length < 2) {
    return { artist: displayText, title: "" };
  }
  return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
}

/**
 * Valida si un email tiene un formato válido.
 * @param {string} email - Email a validar.
 * @returns {boolean} True si el email es válido.
 */
export function isValidEmail(email) {
  if (!email || typeof email !== "string") {
    return false;
  }

  const re =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

/**
 * Formatea una fecha de juego online para mostrar al usuario.
 * @param {string|Date} dateValue - Valor de fecha a formatear.
 * @returns {string} Fecha formateada o cadena vacía si no es válida.
 */
export function formatOnlineGameDate(dateValue) {
  if (!dateValue) return "";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Justo ahora";
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  if (diffDays < 7) return `Hace ${diffDays} d`;

  return date.toLocaleDateString("es-ES");
}

/**
 * Trunca un texto a una longitud máxima y añade ellipsis.
 * @param {string} text - Texto a truncar.
 * @param {number} maxLength - Longitud máxima.
 * @returns {string} Texto truncado con ellipsis si es necesario.
 */
export function truncateText(text, maxLength = 50) {
  if (!text || typeof text !== "string") return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

/**
 * Genera un ID único.
 * @returns {string} ID único.
 */
export function generateUniqueId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Formatea un número con separadores de miles.
 * @param {number} num - Número a formatear.
 * @returns {string} Número formateado.
 */
export function formatNumber(num) {
  if (typeof num !== "number" || Number.isNaN(num)) return "0";
  return num.toLocaleString("es-ES");
}

/**
 * Capitaliza la primera letra de una cadena.
 * @param {string} str - Cadena a capitalizar.
 * @returns {string} Cadena con primera letra mayúscula.
 */
export function capitalize(str) {
  if (!str || typeof str !== "string") return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Verifica si un objeto está vacío (sin propiedades propias).
 * @param {Object} obj - Objeto a verificar.
 * @returns {boolean} True si el objeto está vacío.
 */
export function isEmptyObject(obj) {
  if (!obj || typeof obj !== "object") return true;
  return Object.keys(obj).length === 0;
}

/**
 * Clona profundamente un objeto (deep clone).
 * @param {*} obj - Objeto a clonar.
 * @returns {*} Objeto clonado.
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map((item) => deepClone(item));
  if (obj instanceof Object) {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
}

/**
 * Debounce: retrasa la ejecución de una función.
 * @param {Function} func - Función a ejecutar.
 * @param {number} wait - Tiempo de espera en ms.
 * @returns {Function} Función con debounce.
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle: limita la frecuencia de ejecución de una función.
 * @param {Function} func - Función a ejecutar.
 * @param {number} limit - Tiempo mínimo entre ejecuciones en ms.
 * @returns {Function} Función con throttle.
 */
export function throttle(func, limit = 300) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
