# Task 9: Create Server Factory for mcp-auth Compatibility

**Milestone**: M1 - Project Foundation  
**Estimated Time**: 2 hours  
**Dependencies**: Task 5 ✅  
**Status**: Not Started

---

## Objective

Create a server factory function that exports a `createServer(accessToken, userId, options?)` function compatible with mcp-auth wrapping pattern. This enables the server to be wrapped by mcp-auth for multi-tenant production deployments.

---

## Background

According to [`agent/patterns/bootstrap.md`](../patterns/bootstrap.md) and mcp-auth documentation, servers should export a factory function that:
- Accepts `(accessToken: string, userId: string, options?: ServerOptions)`
- Returns a configured `Server` instance (not connected to transport)
- Creates isolated instances with no shared state
- Scopes all operations to the provided userId

This pattern enables:
- ✅ Multi-tenant deployments via mcp-auth
- ✅ SSE/HTTP transports (not just stdio)
- ✅ Per-user server instances
- ✅ Integration with agentbase.me platform

---

## Steps

### 1. Create Server Factory

**src/server-factory.ts**:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { getWeaviateClient } from './weaviate/client.js';
import { logger } from './utils/logger.js';

export interface ServerOptions {
  name?: string;
  version?: string;
}

/**
 * Create a server instance for a specific user/tenant
 * 
 * This factory function is compatible with mcp-auth wrapping pattern.
 * It creates isolated server instances with no shared state.
 * 
 * @param accessToken - User's access token (not used yet, reserved for future external APIs)
 * @param userId - User identifier for scoping operations
 * @param options - Optional server configuration
 * @returns Configured MCP Server instance (not connected to transport)
 * 
 * @example
 * ```typescript
 * // Direct usage
 * const server = createServer('token', 'user123');
 * const transport = new StdioServerTransport();
 * await server.connect(transport);
 * 
 * // With mcp-auth
 * import { wrapServer } from '@prmichaelsen/mcp-auth';
 * const wrapped = wrapServer({
 *   serverFactory: createServer,
 *   authProvider: new JWTAuthProvider({ ... }),
 *   tokenResolver: new APITokenResolver({ ... }),
 *   resourceType: 'remember',
 *   transport: { type: 'sse', port: 3000 }
 * });
 * ```
 */
export function createServer(
  accessToken: string,
  userId: string,
  options: ServerOptions = {}
): Server {
  if (!accessToken) {
    throw new Error('accessToken is required');
  }
  
  if (!userId) {
    throw new Error('userId is required');
  }
  
  logger.debug('Creating server instance', { userId });
  
  // Create MCP server
  const server = new Server(
    {
      name: options.name || 'remember-mcp',
      version: options.version || '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  
  // Register handlers with userId scope
  registerHandlers(server, userId, accessToken);
  
  return server;
}

/**
 * Register MCP handlers scoped to userId
 */
function registerHandlers(server: Server, userId: string, accessToken: string): void {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'health_check',
          description: 'Check server health and database connections',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      switch (name) {
        case 'health_check':
          result = await handleHealthCheck(userId);
          break;

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${name}`
          );
      }

      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      logger.error(`Tool execution failed for ${name}:`, error);
      throw new McpError(
        ErrorCode.InternalError,
        `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

/**
 * Health check handler (scoped to userId)
 */
async function handleHealthCheck(userId: string): Promise<string> {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    userId: userId,
    server: {
      name: 'remember-mcp',
      version: '0.1.0',
    },
    databases: {
      weaviate: {
        connected: false,
        userCollection: `Memory_${userId}`,
      },
      firestore: {
        connected: false,
        userPath: `users/${userId}`,
      },
    },
  };

  try {
    // Test Weaviate connection
    const weaviateClient = getWeaviateClient();
    health.databases.weaviate.connected = await weaviateClient.isReady();
  } catch (error) {
    logger.error('Weaviate health check failed:', error);
    health.databases.weaviate.connected = false;
  }

  try {
    // Test Firestore connection (import dynamically to avoid initialization issues)
    const { testFirestoreConnection } = await import('./firestore/init.js');
    health.databases.firestore.connected = await testFirestoreConnection();
  } catch (error) {
    logger.error('Firestore health check failed:', error);
    health.databases.firestore.connected = false;
  }

  // Overall status
  const allHealthy =
    health.databases.weaviate.connected &&
    health.databases.firestore.connected;

  health.status = allHealthy ? 'healthy' : 'degraded';

  return JSON.stringify(health, null, 2);
}
```

### 2. Update package.json Exports

**package.json**:
```json
{
  "main": "dist/server.js",
  "exports": {
    ".": {
      "types": "./dist/server.d.ts",
      "import": "./dist/server.js"
    },
    "./factory": {
      "types": "./dist/server-factory.d.ts",
      "import": "./dist/server-factory.js"
    }
  }
}
```

### 3. Update esbuild.build.js

**esbuild.build.js**:
```javascript
import * as esbuild from 'esbuild';

// Build standalone server (bundled)
await esbuild.build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/server.js',
  sourcemap: true,
  external: [
    'weaviate-client',
    '@prmichaelsen/firebase-admin-sdk-v8',
    '@modelcontextprotocol/sdk'
  ],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
  },
  alias: {
    '@': './src'
  }
});

// Build factory for library usage (unbundled)
await esbuild.build({
  entryPoints: ['src/server-factory.ts'],
  bundle: false,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outdir: 'dist',
  outbase: 'src',
  sourcemap: true,
  alias: {
    '@': './src'
  }
});

console.log('✓ Build complete');
```

### 4. Create Unit Tests

**src/server-factory.spec.ts**:
```typescript
import { describe, it, expect } from '@jest/globals';
import { createServer } from './server-factory.js';

describe('Server Factory', () => {
  it('should create server instance', () => {
    const server = createServer('test-token', 'user123');
    expect(server).toBeDefined();
  });

  it('should require accessToken', () => {
    expect(() => createServer('', 'user123')).toThrow('accessToken is required');
  });

  it('should require userId', () => {
    expect(() => createServer('token', '')).toThrow('userId is required');
  });

  it('should accept custom options', () => {
    const server = createServer('token', 'user123', {
      name: 'custom-name',
      version: '2.0.0'
    });
    expect(server).toBeDefined();
  });
});
```

### 5. Update README.md

**README.md** - Add usage section:
```markdown
## Usage

### Standalone (stdio)
```bash
npm start
```

### With mcp-auth (multi-tenant)
```typescript
import { wrapServer, JWTAuthProvider, APITokenResolver } from '@prmichaelsen/mcp-auth';
import { createServer } from '@prmichaelsen/remember-mcp/factory';

const wrapped = wrapServer({
  serverFactory: createServer,
  authProvider: new JWTAuthProvider({ jwtSecret: process.env.JWT_SECRET }),
  tokenResolver: new APITokenResolver({ 
    tenantManagerUrl: process.env.TENANT_MANAGER_URL 
  }),
  resourceType: 'remember',
  transport: { type: 'sse', port: 3000 }
});

await wrapped.start();
```
```

---

## Verification

- [ ] src/server-factory.ts created
- [ ] Exports createServer function with correct signature
- [ ] Server instances are isolated (no shared state)
- [ ] All operations scoped to userId
- [ ] package.json exports updated
- [ ] esbuild builds both server.js and server-factory.js
- [ ] Unit tests passing
- [ ] TypeScript compiles without errors
- [ ] README.md updated with usage examples

---

## Testing

```bash
# Type check
npm run typecheck

# Build
npm run build

# Test
npm test

# Verify exports
node -e "import('./dist/server-factory.js').then(m => console.log(typeof m.createServer))"
# Should output: function
```

---

## Next Task

Task 6: Create Integration Tests

---

## Notes

This task makes remember-mcp compatible with mcp-auth for production multi-tenant deployments while maintaining the standalone server for local development and testing.

**Key Design**: 
- `src/server.ts` - Standalone server with stdio (for local dev)
- `src/server-factory.ts` - Factory function (for mcp-auth wrapping)
- Both patterns supported simultaneously
