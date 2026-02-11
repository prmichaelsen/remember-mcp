import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Weaviate
  weaviate: {
    url: process.env.WEAVIATE_URL || 'http://localhost:8080',
    apiKey: process.env.WEAVIATE_API_KEY || '',
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_APIKEY || '',
  },

  // Firebase
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccount.json',
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
    { key: 'OPENAI_APIKEY', value: config.openai.apiKey },
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
