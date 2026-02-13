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
import { initWeaviateClient } from './weaviate/client.js';
import { initFirestore } from './firestore/init.js';

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

export interface ServerOptions {
  name?: string;
  version?: string;
}

// Global initialization flag to ensure databases are initialized once
let databasesInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize databases (called once globally)
 */
async function ensureDatabasesInitialized(): Promise<void> {
  if (databasesInitialized) {
    return;
  }
  
  // If initialization is in progress, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }
  
  // Start initialization
  initializationPromise = (async () => {
    try {
      logger.info('Initializing databases...');
      await initWeaviateClient();
      initFirestore();
      databasesInitialized = true;
      logger.info('Databases initialized successfully');
    } catch (error) {
      // Format error as single-line JSON for better cloud logging
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Database initialization failed', {
        error: errorMessage,
        stack: errorStack,
        type: error instanceof Error ? error.constructor.name : 'Unknown'
      });
      
      throw new Error(`Database initialization failed: ${errorMessage}`);
    } finally {
      initializationPromise = null;
    }
  })();
  
  return initializationPromise;
}

/**
 * Create a server instance for a specific user/tenant
 *
 * This factory function is compatible with mcp-auth wrapping pattern.
 * It creates isolated server instances with no shared state.
 *
 * Note: Databases (Weaviate + Firestore) are initialized once globally on first call.
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
export async function createServer(
  accessToken: string,
  userId: string,
  options: ServerOptions = {}
): Promise<Server> {
  // Note: accessToken is not used by remember-mcp (self-managed data)
  // but required by mcp-auth contract. Can be any value including empty string.
  
  if (!userId) {
    throw new Error('userId is required');
  }
  
  logger.debug('Creating server instance', { userId });
  
  // Ensure databases are initialized (happens once globally)
  // Initialization must succeed or server creation fails
  await ensureDatabasesInitialized();
  
  // Create MCP server
  const server = new Server(
    {
      name: options.name || 'remember-mcp',
      version: options.version || '0.2.0',
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
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      switch (name) {
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

        case 'remember_set_preference':
          result = await handleSetPreference(args as any, userId);
          break;

        case 'remember_get_preferences':
          result = await handleGetPreferences(args as any, userId);
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

