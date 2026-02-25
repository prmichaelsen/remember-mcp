import dotenv from 'dotenv';
import { logger } from './utils/logger.js';

dotenv.config();

/**
 * Debug levels for tool logging
 */
export enum DebugLevel {
  NONE = 0,      // No debug output (production default)
  ERROR = 1,     // Only errors
  WARN = 2,      // Warnings and errors
  INFO = 3,      // Info, warnings, and errors
  DEBUG = 4,     // Debug, info, warnings, and errors
  TRACE = 5,     // Everything including parameter dumps
}

/**
 * Debug configuration
 */
export const debugConfig = {
  level: ((): DebugLevel => {
    const level = process.env.REMEMBER_MCP_DEBUG_LEVEL?.toUpperCase();
    switch (level) {
      case 'TRACE': return DebugLevel.TRACE;
      case 'DEBUG': return DebugLevel.DEBUG;
      case 'INFO': return DebugLevel.INFO;
      case 'WARN': return DebugLevel.WARN;
      case 'ERROR': return DebugLevel.ERROR;
      case 'NONE': return DebugLevel.NONE;
      default: return DebugLevel.NONE;
    }
  })(),
  enabled: (level: DebugLevel): boolean => {
    return debugConfig.level >= level;
  },
};

export const config = {
  // Weaviate
  weaviate: {
    url: process.env.WEAVIATE_REST_URL || 'http://localhost:8080',
    apiKey: process.env.WEAVIATE_API_KEY || '',
  },

  // OpenAI (for embeddings)
  openai: {
    apiKey: process.env.OPENAI_EMBEDDINGS_API_KEY || process.env.OPENAI_APIKEY || '',
  },

  // Firebase (using firebase-admin-sdk-v8)
  firebase: {
    serviceAccount: process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
  },

  // Server
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },

  // MCP
  mcp: {
    transport: process.env.MCP_TRANSPORT || 'sse',
  },
} as const;

/**
 * Validate required configuration
 */
export function validateConfig(): void {
  const required = [
    { key: 'WEAVIATE_REST_URL', value: config.weaviate.url },
    { key: 'OPENAI_EMBEDDINGS_API_KEY', value: config.openai.apiKey },
    { key: 'FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY', value: config.firebase.serviceAccount },
    { key: 'FIREBASE_PROJECT_ID', value: config.firebase.projectId },
  ];

  const missing = required.filter((r) => !r.value || r.value === 'http://localhost:8080');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.map((m) => m.key).join(', ')}`
    );
  }

  // Import logger here to avoid circular dependency
  // Use dynamic import synchronously (logger is already loaded by this point)
  import('./utils/logger.js').then(({ logger }) => {
    logger.info('Configuration validated', {
      module: 'config',
    });
  });
}
