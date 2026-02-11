#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { config, validateConfig } from './config.js';
import { initWeaviateClient, testWeaviateConnection, getWeaviateClient } from './weaviate/client.js';
import { initFirestore, testFirestoreConnection } from './firestore/init.js';
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
  initFirestore();

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

    try {
      let result: string;

      switch (name) {
        case 'health_check':
          result = await handleHealthCheck();
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
 * Health check handler
 */
async function handleHealthCheck(): Promise<string> {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: {
      name: 'remember-mcp',
      version: '0.1.0',
    },
    databases: {
      weaviate: {
        connected: false,
        url: config.weaviate.url,
      },
      firestore: {
        connected: false,
        projectId: config.firebase.projectId,
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
    // Test Firestore connection
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

/**
 * Main server startup
 */
async function main(): Promise<void> {
  try {
    logger.info('Starting remember-mcp server...');

    // Initialize server
    const server = await initServer();

    // Start with stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('Server running on stdio transport');

    // Note: When using stdio transport, avoid console.log as it interferes with JSON-RPC
    // The logger is configured to handle this appropriately
  } catch (error) {
    logger.error('Server startup failed:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
function setupShutdownHandlers(server: Server): void {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await server.close();
      logger.info('Server closed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Start the server
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
