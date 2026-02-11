# Task 5: Create Basic MCP Server

**Milestone**: M1 - Project Foundation  
**Estimated Time**: 3 hours  
**Dependencies**: Tasks 3, 4  
**Status**: Not Started

---

## Objective

Create a basic MCP server with stdio transport, health check, and database initialization.

---

## Steps

### 1. Create Server Entry Point

**src/server.ts**:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { config, validateConfig } from './config.js';
import { initWeaviateClient, testWeaviateConnection } from './weaviate/client.js';
import { initFirestore, testFirestoreConnection } from './firestore/client.js';
import { logger } from './utils/logger.js';

/**
 * Initialize remember-mcp server
 */
async function initServer(): Promise<Server> {
  logger.info('Initializing remember-mcp server...');

  // Validate configuration
  validateConfig();

  // Initialize databases
  logger.info('Connecting to databases...');
  await initWeaviateClient();
  await initFirestore();

  // Test connections
  const weaviateOk = await testWeaviateConnection();
  const firestoreOk = await testFirestoreConnection();

  if (!weaviateOk || !firestoreOk) {
    throw new Error('Database connection failed');
  }

  logger.info('Database connections established');

  // Create MCP server
  const server = new Server(
    {
      name: 'remember-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register handlers
  registerHandlers(server);

  logger.info('Server initialized successfully');
  return server;
}

/**
 * Register MCP handlers
 */
function registerHandlers(server: Server): void {
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

    switch (name) {
      case 'health_check':
        return await handleHealthCheck();

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });
}

/**
 * Health check handler
 */
async function handle