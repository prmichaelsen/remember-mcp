/**
 * Unit tests for debug utility
 */

import { createDebugLogger, DebugLogger } from './debug';
import { DebugLevel } from '../config';
import { logger } from './logger';

// Mock logger
jest.mock('./logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock config
jest.mock('../config', () => {
  let mockLevel = 0; // NONE by default
  
  return {
    DebugLevel: {
      NONE: 0,
      ERROR: 1,
      WARN: 2,
      INFO: 3,
      DEBUG: 4,
      TRACE: 5,
    },
    debugConfig: {
      get level() {
        return mockLevel;
      },
      set level(value: number) {
        mockLevel = value;
      },
      enabled: (level: number) => mockLevel >= level,
    },
    // Re-export setMockDebugLevel for tests
    __setMockDebugLevel: (level: number) => {
      mockLevel = level;
    },
  };
});

const { __setMockDebugLevel } = require('../config');

describe('DebugLogger', () => {
  let debug: DebugLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    __setMockDebugLevel(DebugLevel.NONE);
    debug = createDebugLogger({
      tool: 'test_tool',
      userId: 'user123',
      operation: 'test_operation',
    });
  });

  describe('Debug Level Filtering', () => {
    it('should not log anything when level is NONE', () => {
      __setMockDebugLevel(DebugLevel.NONE);
      
      debug.trace('trace message');
      debug.debug('debug message');
      debug.info('info message');
      debug.warn('warn message');
      debug.error('error message');

      expect(logger.debug).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should only log errors when level is ERROR', () => {
      __setMockDebugLevel(DebugLevel.ERROR);
      
      debug.trace('trace message');
      debug.debug('debug message');
      debug.info('info message');
      debug.warn('warn message');
      debug.error('error message');

      expect(logger.debug).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('should log warnings and errors when level is WARN', () => {
      __setMockDebugLevel(DebugLevel.WARN);
      
      debug.trace('trace message');
      debug.debug('debug message');
      debug.info('info message');
      debug.warn('warn message');
      debug.error('error message');

      expect(logger.debug).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('should log info, warnings, and errors when level is INFO', () => {
      __setMockDebugLevel(DebugLevel.INFO);
      
      debug.trace('trace message');
      debug.debug('debug message');
      debug.info('info message');
      debug.warn('warn message');
      debug.error('error message');

      expect(logger.debug).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('should log debug, info, warnings, and errors when level is DEBUG', () => {
      __setMockDebugLevel(DebugLevel.DEBUG);
      
      debug.trace('trace message');
      debug.debug('debug message');
      debug.info('info message');
      debug.warn('warn message');
      debug.error('error message');

      expect(logger.debug).toHaveBeenCalledTimes(1); // debug only
      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('should log everything including trace when level is TRACE', () => {
      __setMockDebugLevel(DebugLevel.TRACE);
      
      debug.trace('trace message');
      debug.debug('debug message');
      debug.info('info message');
      debug.warn('warn message');
      debug.error('error message');

      expect(logger.debug).toHaveBeenCalledTimes(2); // trace + debug
      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('Context Propagation', () => {
    it('should include context in all log calls', () => {
      __setMockDebugLevel(DebugLevel.DEBUG);
      
      debug.debug('test message', { extra: 'data' });

      expect(logger.debug).toHaveBeenCalledWith(
        '[DEBUG] test message',
        expect.objectContaining({
          tool: 'test_tool',
          userId: 'user123',
          operation: 'test_operation',
          extra: 'data',
          debugLevel: 'DEBUG',
        })
      );
    });
  });

  describe('dump()', () => {
    it('should only dump objects at TRACE level', () => {
      __setMockDebugLevel(DebugLevel.DEBUG);
      
      debug.dump('test object', { foo: 'bar' });
      expect(logger.debug).not.toHaveBeenCalled();

      __setMockDebugLevel(DebugLevel.TRACE);
      debug.dump('test object', { foo: 'bar' });
      
      expect(logger.debug).toHaveBeenCalledWith(
        '[DUMP] test object',
        expect.objectContaining({
          dump: expect.stringContaining('"foo": "bar"'),
        })
      );
    });
  });

  describe('time()', () => {
    it('should not add timing overhead when debug is disabled', async () => {
      __setMockDebugLevel(DebugLevel.NONE);
      
      const result = await debug.time('test operation', async () => {
        return 'result';
      });

      expect(result).toBe('result');
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should log timing when DEBUG level is enabled', async () => {
      __setMockDebugLevel(DebugLevel.DEBUG);
      
      const result = await debug.time('test operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'result';
      });

      expect(result).toBe('result');
      expect(logger.debug).toHaveBeenCalledWith(
        '[DEBUG] test operation - Starting',
        expect.any(Object)
      );
      expect(logger.debug).toHaveBeenCalledWith(
        '[DEBUG] test operation - Completed',
        expect.objectContaining({
          durationMs: expect.any(Number),
        })
      );
    });

    it('should log errors with timing on failure', async () => {
      __setMockDebugLevel(DebugLevel.DEBUG);
      
      const error = new Error('test error');
      
      await expect(
        debug.time('test operation', async () => {
          throw error;
        })
      ).rejects.toThrow('test error');

      expect(logger.error).toHaveBeenCalledWith(
        '[ERROR] test operation - Failed',
        expect.objectContaining({
          durationMs: expect.any(Number),
          error: 'test error',
        })
      );
    });
  });

  describe('createDebugLogger()', () => {
    it('should create a DebugLogger instance with context', () => {
      const logger = createDebugLogger({
        tool: 'test_tool',
        userId: 'user123',
      });

      expect(logger).toBeInstanceOf(DebugLogger);
    });
  });
});
