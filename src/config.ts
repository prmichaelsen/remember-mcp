import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Weaviate
  weaviate: {
    url: process.env.WEAVIATE_URL || 'http://localhost:8080',
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
    { key: 'WEAVIATE_URL', value: config.weaviate.url },
    { key: 'OPENAI_EMBEDDINGS_API_KEY', value: config.openai.apiKey },
    { key: 'FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY', value: config.firebase.serviceAccount },
    { key: 'FIREBASE_PROJECT_ID', value: config.firebase.projectId },
  ];

  const missing = required.filter((r) => !r.value);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.map((m) => m.key).join(', ')}`
    );
  }

  console.log('[Config] Configuration validated');
}
