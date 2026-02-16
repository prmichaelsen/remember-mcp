import dotenv from 'dotenv';

dotenv.config();

export type LLMProvider = 'bedrock' | 'openai' | 'anthropic' | 'cohere' | 'custom';

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

  // LLM Provider Configuration
  llm: {
    provider: (process.env.LLM_PROVIDER || 'bedrock') as LLMProvider,
    model: process.env.LLM_MODEL || 'anthropic.claude-sonnet-4-5-20250929-v1:0',
    
    // Bedrock configuration
    bedrock: {
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      sessionToken: process.env.AWS_SESSION_TOKEN || '',
    },
    
    // OpenAI configuration (for future use)
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      orgId: process.env.OPENAI_ORG_ID || '',
    },
    
    // Anthropic configuration (for future use)
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    },
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

  console.log('[Config] Configuration validated');
}
