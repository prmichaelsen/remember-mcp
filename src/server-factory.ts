/**
 * Server factory for mcp-auth compatibility
 * Creates isolated server instances per user/tenant
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from './utils/logger.js';

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
 * @param accessToken - User's access token (reserved for future external APIs)
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

        case 'remember_create_memory':
          result = await handleCreateMemory(args as any, userId);
          break;

        case 'remember_search_memory':
          result = await handleSearchMemory(args as any, userId);
          break;

        case 'remember_delete_memory':
          result = await handleDeleteMemory(args as any, userId);
          break;

        case 'remember_update_memory':
          result = await handleUpdateMemory(args as any, userId);
          break;

        case 'remember_find_similar':
          result = await handleFindSimilar(args as any, userId);
          break;

        case 'remember_query_memory':
          result = await handleQueryMemory(args as any, userId);
          break;

        case 'remember_create_relationship':
          result = await handleCreateRelationship(args as any, userId);
          break;

        case 'remember_update_relationship':
          result = await handleUpdateRelationship(args as any, userId);
          break;

        case 'remember_search_relationship':
          result = await handleSearchRelationship(args as any, userId);
          break;

        case 'remember_delete_relationship':
          result = await handleDeleteRelationship(args as any, userId);
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
    const { getWeaviateClient } = await import('./weaviate/client.js');
    const weaviateClient = getWeaviateClient();
    health.databases.weaviate.connected = await weaviateClient.isReady();
  } catch (error) {
    logger.error('Weaviate health check failed:', error);
    health.databases.weaviate.connected = false;
  }

  try {
    // Test Firestore connection
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
