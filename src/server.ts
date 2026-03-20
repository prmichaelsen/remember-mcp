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
import type { AuthContext } from './types/auth.js';

// Import memory tools
import { createMemoryTool, handleCreateMemory } from './tools/create-memory.js';
import { searchMemoryTool, handleSearchMemory } from './tools/search-memory.js';
import { deleteMemoryTool, handleDeleteMemory } from './tools/delete-memory.js';
import { updateMemoryTool, handleUpdateMemory } from './tools/update-memory.js';
import { findSimilarTool, handleFindSimilar } from './tools/find-similar.js';
import { queryMemoryTool, handleQueryMemory } from './tools/query-memory.js';

// Import relationship tools
import { createRelationshipTool, handleCreateRelationship } from './tools/create-relationship.js';
import { updateRelationshipTool, handleUpdateRelationship } from './tools/update-relationship.js';
import { searchRelationshipTool, handleSearchRelationship } from './tools/search-relationship.js';
import { deleteRelationshipTool, handleDeleteRelationship } from './tools/delete-relationship.js';

// Import preference tools
import { setPreferenceTool, handleSetPreference } from './tools/set-preference.js';
import { getPreferencesTool, handleGetPreferences } from './tools/get-preferences.js';

// Import space tools
import { publishTool, handlePublish } from './tools/publish.js';
import { retractTool, handleRetract } from './tools/retract.js';
import { reviseTool, handleRevise } from './tools/revise.js';
import { confirmTool, handleConfirm } from './tools/confirm.js';
import { denyTool, handleDeny } from './tools/deny.js';
import { searchSpaceTool, handleSearchSpace } from './tools/search-space.js';
import { querySpaceTool, handleQuerySpace } from './tools/query-space.js';
import { moderateTool, handleModerate } from './tools/moderate.js';
import { ghostConfigTool, handleGhostConfig } from './tools/ghost-config.js';
import { requestSetTrustLevelTool, handleRequestSetTrustLevel } from './tools/request-set-trust-level.js';

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

  // Test connections in parallel
  const [weaviateOk, firestoreOk] = await Promise.all([
    testWeaviateConnection(),
    testFirestoreConnection(),
  ]);

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
        // Memory tools
        createMemoryTool,
        searchMemoryTool,
        deleteMemoryTool,
        updateMemoryTool,
        findSimilarTool,
        queryMemoryTool,
        // Relationship tools
        createRelationshipTool,
        updateRelationshipTool,
        searchRelationshipTool,
        deleteRelationshipTool,
        // Preference tools
        setPreferenceTool,
        getPreferencesTool,
        // Space tools
        publishTool,
        retractTool,
        reviseTool,
        confirmTool,
        denyTool,
        searchSpaceTool,
        querySpaceTool,
        moderateTool,
        ghostConfigTool,
        requestSetTrustLevelTool,
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      // Extract userId from args or use default for now
      // TODO: Get userId from authentication context in M6
      const userId = (args as any).user_id || 'default_user';

      // Standalone mode: no access token or credentials
      const authContext: AuthContext = { accessToken: null, credentials: null };

      switch (name) {
        case 'remember_create_memory':
          result = await handleCreateMemory(args as any, userId, authContext);
          break;

        case 'remember_search_memory':
          result = await handleSearchMemory(args as any, userId, authContext);
          break;

        case 'remember_delete_memory':
          result = await handleDeleteMemory(args as any, userId, authContext);
          break;

        case 'remember_update_memory':
          result = await handleUpdateMemory(args as any, userId, authContext);
          break;

        case 'remember_find_similar':
          result = await handleFindSimilar(args as any, userId, authContext);
          break;

        case 'remember_query_memory':
          result = await handleQueryMemory(args as any, userId, authContext);
          break;

        case 'remember_create_relationship':
          result = await handleCreateRelationship(args as any, userId, authContext);
          break;

        case 'remember_update_relationship':
          result = await handleUpdateRelationship(args as any, userId, authContext);
          break;

        case 'remember_search_relationship':
          result = await handleSearchRelationship(args as any, userId, authContext);
          break;

        case 'remember_delete_relationship':
          result = await handleDeleteRelationship(args as any, userId, authContext);
          break;

        case 'remember_set_preference':
          result = await handleSetPreference(args as any, userId, authContext);
          break;

        case 'remember_get_preferences':
          result = await handleGetPreferences(args as any, userId, authContext);
          break;

        case 'remember_publish':
          result = await handlePublish(args as any, userId, authContext);
          break;

        case 'remember_retract':
          result = await handleRetract(args as any, userId, authContext);
          break;

        case 'remember_revise':
          result = await handleRevise(args as any, userId, authContext);
          break;

        case 'remember_confirm':
          result = await handleConfirm(args as any, userId, authContext);
          break;

        case 'remember_deny':
          result = await handleDeny(args as any, userId, authContext);
          break;

        case 'remember_search_space':
          result = await handleSearchSpace(args as any, userId, authContext);
          break;

        case 'remember_query_space':
          result = await handleQuerySpace(args as any, userId, authContext);
          break;

        case 'remember_moderate':
          result = await handleModerate(args as any, userId, authContext);
          break;

        case 'remember_ghost_config':
          result = await handleGhostConfig(args as any, userId, authContext);
          break;

        case 'remember_request_set_trust_level':
          result = await handleRequestSetTrustLevel(args as any, userId, authContext);
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
 * Main server startup
 */
async function main(): Promise<void> {
  try {
    logger.info('Starting remember-mcp server...');

    // Initialize server (standalone mode — used behind mcp-auth or for direct stdio)
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
