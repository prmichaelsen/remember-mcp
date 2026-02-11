import { config } from '../config.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[config.server.logLevel as LogLevel] ?? LOG_LEVELS.info;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= currentLevel;
}

export const logger = {
  debug: (message: string, data?: any) => {
    if (shouldLog('debug')) {
      if (data) {
        console.debug(JSON.stringify({ level: 'DEBUG', message, ...data }));
      } else {
        console.debug(`[DEBUG] ${message}`);
      }
    }
  },

  info: (message: string, data?: any) => {
    if (shouldLog('info')) {
      if (data) {
        console.info(JSON.stringify({ level: 'INFO', message, ...data }));
      } else {
        console.info(`[INFO] ${message}`);
      }
    }
  },

  warn: (message: string, data?: any) => {
    if (shouldLog('warn')) {
      if (data) {
        console.warn(JSON.stringify({ level: 'WARN', message, ...data }));
      } else {
        console.warn(`[WARN] ${message}`);
      }
    }
  },

  error: (message: string, data?: any) => {
    if (shouldLog('error')) {
      if (data) {
        // Structured logging for cloud environments
        console.error(JSON.stringify({ level: 'ERROR', message, ...data }));
      } else {
        console.error(`[ERROR] ${message}`);
      }
    }
  },
};
