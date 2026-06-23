/**
 * Sistema de logging centralizado con niveles de severidad.
 * Permite controlar qué mensajes se muestran según el nivel de log configurado.
 */

// Niveles de log
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Nivel de log actual (configurable)
// En producción: LOG_LEVELS.ERROR o LOG_LEVELS.WARN
// En desarrollo: LOG_LEVELS.DEBUG
let currentLogLevel = LOG_LEVELS.WARN;

/**
 * Establece el nivel de log actual.
 * @param {number} level - Nivel de log (usar LOG_LEVELS)
 */
export function setLogLevel(level) {
  if (level >= LOG_LEVELS.ERROR && level <= LOG_LEVELS.DEBUG) {
    currentLogLevel = level;
  }
}

/**
 * Obtiene el nivel de log actual.
 * @returns {number} Nivel de log actual
 */
export function getLogLevel() {
  return currentLogLevel;
}

/**
 * Activa el modo debug (muestra todos los logs).
 */
export function enableDebugMode() {
  currentLogLevel = LOG_LEVELS.DEBUG;
}

/**
 * Activa el modo producción (solo errores y warnings).
 */
export function enableProductionMode() {
  currentLogLevel = LOG_LEVELS.WARN;
}

/**
 * Logger principal con métodos para cada nivel de severidad.
 */
export const logger = {
  /**
   * Log de nivel ERROR - Siempre se muestra
   * @param {string} message - Mensaje de error
   * @param  {...any} args - Argumentos adicionales
   */
  error(message, ...args) {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  },

  /**
   * Log de nivel WARN - Se muestra en WARN y superiores
   * @param {string} message - Mensaje de advertencia
   * @param  {...any} args - Argumentos adicionales
   */
  warn(message, ...args) {
    if (currentLogLevel >= LOG_LEVELS.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },

  /**
   * Log de nivel INFO - Se muestra en INFO y superiores
   * @param {string} message - Mensaje informativo
   * @param  {...any} args - Argumentos adicionales
   */
  info(message, ...args) {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },

  /**
   * Log de nivel DEBUG - Solo se muestra en modo DEBUG
   * @param {string} message - Mensaje de debug
   * @param  {...any} args - Argumentos adicionales
   */
  debug(message, ...args) {
    if (currentLogLevel >= LOG_LEVELS.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
};

/**
 * Utilidades específicas para logging de errores comunes
 */
export const logUtils = {
  /**
   * Log de error de red/fetch
   * @param {string} context - Contexto del error
   * @param {Error} error - Objeto error
   */
  logNetworkError(context, error) {
    logger.error(`${context}: ${error.message}`, error);
  },

  /**
   * Log de error de validación
   * @param {string} field - Campo que falló la validación
   * @param {string} value - Valor inválido
   */
  logValidationError(field, value) {
    logger.warn(`Validación fallida para ${field}: ${value}`);
  },

  /**
   * Log de operación exitosa
   * @param {string} operation - Operación realizada
   * @param {*} details - Detalles adicionales
   */
  logSuccess(operation, details) {
    logger.info(`${operation} completada exitosamente`, details);
  },

  /**
   * Log de cambio de estado
   * @param {string} entity - Entidad que cambió
   * @param {string} fromState - Estado anterior
   * @param {string} toState - Nuevo estado
   */
  logStateChange(entity, fromState, toState) {
    logger.debug(`${entity}: ${fromState} -> ${toState}`);
  },
};

/**
 * Configura el logger según el entorno
 * @param {boolean} isDevelopment - true si es entorno de desarrollo
 */
export function configureLogger(isDevelopment = true) {
  if (isDevelopment) {
    enableDebugMode();
    logger.info("Logger configurado en modo DEVELOPMENT");
  } else {
    enableProductionMode();
    logger.info("Logger configurado en modo PRODUCTION");
  }
}

// Exportar LOG_LEVELS para uso externo si se necesita
export { LOG_LEVELS };
