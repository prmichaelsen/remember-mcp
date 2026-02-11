# Task 3: Set Up Weaviate Client

**Milestone**: M1 - Project Foundation  
**Estimated Time**: 3 hours  
**Dependencies**: Task 2  
**Status**: Not Started

---

## Objective

Create Weaviate client wrapper with connection management and user-scoped collection handling.

---

## Steps

### 1. Create Weaviate Client Wrapper

**src/weaviate/client.ts**:
```typescript
import weaviate, { WeaviateClient, ApiKey } from 'weaviate-client';
import { config } from '../config.js';

let client: WeaviateClient | null = null;

/**
 * Initialize Weaviate client
 */
export async function initWeaviateClient(): Promise<WeaviateClient> {
  if (client) {
    return client;
  }

  const clientConfig: any = {
    scheme: config.weaviate.url.startsWith('https') ? 'https' : 'http',
    host: config.weaviate.url.replace(/^https?:\/\//, ''),
  };

  if (config.weaviate.apiKey) {
    clientConfig.apiKey = new ApiKey(config.weaviate.apiKey);
  }

  client = await weaviate.client(clientConfig);

  console.log('[Weaviate] Client initialized');
  return client;
}

/**
 * Get Weaviate client instance
 */
export function getWeaviateClient(): WeaviateClient {
  if (!client) {
    throw new Error('Weaviate client not initialized. Call initWeaviateClient() first.');
  }
  return client;
}

/**
 * Test Weaviate connection
 */
export async function testWeaviateConnection(): Promise<boolean> {
  try {
    const client = getWeaviateClient();
    const meta = await client.misc.metaGetter().do();
    console.log('[Weaviate] Connection successful:', meta.version);
    return true;
  } catch (error) {
    console.error('[Weaviate] Connection failed:', error);
    return false;
  }
}

/**
 * Sanitize user_id for collection name
 * Weaviate collection names must start with uppercase and contain only alphanumeric
 */
export function sanitizeUserId(userId: string): string {
  // Remove special characters, keep alphanumeric
  const sanitized = userId.replace(/[^a-zA-Z0-9]/g, '_');
  // Ensure starts with uppercase
  return sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
}

/**
 * Get collection name for user's memories
 */
export function getMemoryCollectionName(userId: string): string {
  return `Memory_${sanitizeUserId(userId)}`;
}

/**
 * Get collection name for user's templates
 */
export function getTemplateCollectionName(userId: string): string {
  return `Template_${sanitizeUserId(userId)}`;
}

/**
 * Get collection name for user's audit logs
 */
export function getAuditCollectionName(userId: string): string {
  return `Audit_${sanitizeUserId(userId)}`;
}

/**
 * Check if collection exists
 */
export async function collectionExists(collectionName: string): Promise<boolean> {
  try {
    const client = getWeaviateClient();
    const schema = await client.schema.getter().do();
    return schema.classes?.some((c: any) => c.class === collectionName) ?? false;
  } catch (error) {
    console.error(`[Weaviate] Error checking collection ${collectionName}:`, error);
    return false;
  }
}

/**
 * Close Weaviate client connection
 */
export async function closeWeaviateClient(): Promise<void> {
  if (client) {
    // Weaviate client doesn't have explicit close method
    client = null;
    console.log('[Weaviate] Client closed');
  }
}
```

### 2. Create Configuration Module

**src/config.ts**:
```typescript
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
```

### 3. Create Logger Utility

**src/utils/logger.ts**:
```typescript
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
  debug: (message: string, ...args: any[]) => {
    if (shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },

  info: (message: string, ...args: any[]) => {
    if (shouldLog('info')) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },

  warn: (message: string, ...args: any[]) => {
    if (shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },

  error: (message: string, ...args: any[]) => {
    if (shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  },
};
```

### 4. Create Test File

**tests/unit/weaviate-client.test.ts**:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import {
  initWeaviateClient,
  testWeaviateConnection,
  sanitizeUserId,
  getMemoryCollectionName,
} from '../../src/weaviate/client.js';

describe('Weaviate Client', () => {
  beforeAll(async () => {
    await initWeaviateClient();
  });

  it('should initialize client', async () => {
    const result = await testWeaviateConnection();
    expect(result).toBe(true);
  });

  it('should sanitize user IDs', () => {
    expect(sanitizeUserId('user@example.com')).toBe('User_example_com');
    expect(sanitizeUserId('user-123')).toBe('User_123');
    expect(sanitizeUserId('123user')).toBe('_23user');
  });

  it('should generate collection names', () => {
    expect(getMemoryCollectionName('user123')).toBe('Memory_User123');
    expect(getMemoryCollectionName('user@test.com')).toBe('Memory_User_test_com');
  });
});
```

---

## Verification

- [ ] src/weaviate/client.ts created
- [ ] src/config.ts created
- [ ] src/utils/logger.ts created
- [ ] Tests created
- [ ] Can initialize Weaviate client
- [ ] Connection test passes
- [ ] User ID sanitization works
- [ ] Collection name generation works

---

## Testing

```bash
# Run tests
npm test

# Test connection manually
npm run dev
# Should see: [Weaviate] Client initialized
# Should see: [Weaviate] Connection successful
```

---

## Next Task

Task 4: Set Up Firestore Client
