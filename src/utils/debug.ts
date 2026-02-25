/**
 * Debug logging utility for remember-mcp
 * 
 * Provides configurable debug logging via REMEMBER_MCP_DEBUG_LEVEL environment variable.
 * Levels: NONE (default), ERROR, WARN, INFO, DEBUG, TRACE
 */

import { debugConfig, DebugLevel } from '../config.js';
import { logger } from './logger.js';

export interface DebugContext {
  tool: string;
  userId?: string;
  operation?: string;
  [key: string]: any;
}

export class DebugLogger {
  private context: DebugContext;

  constructor(context: DebugContext) {
    this.context = context;
  }

  trace(message: string, data?: any): void {
    if (debugConfig.enabled(DebugLevel.TRACE)) {
      logger.debug(`[TRACE] ${message}`, {
        ...this.context,
        ...data,
        debugLevel: 'TRACE',
      });
    }
  }

  debug(message: string, data?: any): void {
    if (debugConfig.enabled(DebugLevel.DEBUG)) {
      logger.debug(`[DEBUG] ${message}`, {
        ...this.context,
        ...data,
        debugLevel: 'DEBUG',
      });
    }
  }

  info(message: string, data?: any): void {
    if (debugConfig.enabled(DebugLevel.INFO)) {
      logger.info(`[INFO] ${message}`, {
        ...this.context,
        ...data,
        debugLevel: 'INFO',
      });
    }
  }

  warn(message: string, data?: any): void {
    if (debugConfig.enabled(DebugLevel.WARN)) {
      logger.warn(`[WARN] ${message}`, {
        ...this.context,
        ...data,
        debugLevel: 'WARN',
      });
    }
  }

  error(message: string, data?: any): void {
    if (debugConfig.enabled(DebugLevel.ERROR)) {
      logger.error(`[ERROR] ${message}`, {
        ...this.context,
        ...data,
        debugLevel: 'ERROR',
      });
    }
  }

  /**
   * Dump full object (TRACE only)
   * Use with caution - may expose sensitive data
   */
  dump(label: string, obj: any): void {
    if (debugConfig.enabled(DebugLevel.TRACE)) {
      logger.debug(`[DUMP] ${label}`, {
        ...this.context,
        dump: JSON.stringify(obj, null, 2),
        debugLevel: 'TRACE',
      });
    }
  }

  /**
   * Time an async operation (DEBUG and above)
   * Logs start, completion, and duration
   */
  async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    if (!debugConfig.enabled(DebugLevel.DEBUG)) {
      return fn();
    }

    const start = Date.now();
    this.debug(`${label} - Starting`);
    
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.debug(`${label} - Completed`, { durationMs: duration });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`${label} - Failed`, { 
        durationMs: duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

/**
 * Create a debug logger with context
 * 
 * @param context - Context information (tool name, userId, operation, etc.)
 * @returns DebugLogger instance
 * 
 * @example
 * const debug = createDebugLogger({
 *   tool: 'remember_create_memory',
 *   userId: 'user123',
 *   operation: 'create',
 * });
 * 
 * debug.info('Tool invoked');
 * debug.trace('Arguments', { args });
 * const result = await debug.time('Database operation', async () => {
 *   return await collection.insert(data);
 * });
 */
export function createDebugLogger(context: DebugContext): DebugLogger {
  return new DebugLogger(context);
}
