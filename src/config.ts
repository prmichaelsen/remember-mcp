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
 * Auth scheme configuration — discriminated union.
 *
 * - 'service': Current behavior, JWT via mcp-auth (deployed behind remember-mcp-server)
 * - 'oauth': Local mode, exchanges API token for JWT via OAuth endpoint
 */
type ServiceAuthConfig = { scheme: 'service' };
type OAuthAuthConfig = {
  scheme: 'oauth';
  oauthEndpoint: string;
  apiToken: string;
};
export type AuthSchemeConfig = ServiceAuthConfig | OAuthAuthConfig;

/**
 * Load auth scheme config from environment variables.
 * Validates at startup — fails fast with descriptive errors.
 *
 * Note: apiToken may be empty here when scheme=oauth.
 * The config-resolver (T517) fills it from .remember/config if not set via env var.
 */
export function loadAuthSchemeConfig(): AuthSchemeConfig {
  const scheme = process.env.REMEMBER_AUTH_SCHEME ?? 'service';

  if (scheme === 'service') {
    return { scheme };
  }

  if (scheme !== 'oauth') {
    throw new Error(
      `Invalid REMEMBER_AUTH_SCHEME: "${scheme}". Valid values: "service", "oauth"`
    );
  }

  const oauthEndpoint = process.env.REMEMBER_OAUTH_ENDPOINT;
  if (!oauthEndpoint) {
    throw new Error(
      'REMEMBER_OAUTH_ENDPOINT is required when REMEMBER_AUTH_SCHEME=oauth'
    );
  }

  const apiToken = process.env.REMEMBER_API_TOKEN ?? '';

  return { scheme, oauthEndpoint, apiToken };
}

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
