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
import type { AuthContext } from './types/auth.js';
import { credentialsProvider } from './services/credentials-provider.js';

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
import { searchByTool, handleSearchBy } from './tools/search-by.js';

// Import unified internal memory tools
import { createInternalMemoryTool, handleCreateInternalMemory } from './tools/create-internal-memory.js';
import { updateInternalMemoryTool, handleUpdateInternalMemory } from './tools/update-internal-memory.js';
import { searchInternalMemoryTool, handleSearchInternalMemory } from './tools/search-internal-memory.js';
import { queryInternalMemoryTool, handleQueryInternalMemory } from './tools/query-internal-memory.js';
import { searchInternalMemoryByTool, handleSearchInternalMemoryBy } from './tools/search-internal-memory-by.js';

// Import core introspection tools
import { getCoreTool, handleGetCore } from './tools/get-core.js';
import { searchSpaceByTool, handleSearchSpaceBy } from './tools/search-space-by.js';

// Import services (static — avoids dynamic import overhead on hot path)
import { getGhostConfig } from './services/ghost-config.service.js';
import { resolveAccessorTrustLevel } from './services/access-control.js';

// Admin utilities
import { isAdmin, adminPermissionError } from './utils/admin.js';

// Admin tools
import { adminGetWeaviateSchemaTool, handleAdminGetWeaviateSchema } from './tools/admin-get-weaviate-schema.js';
import { adminListCollectionsTool, handleAdminListCollections } from './tools/admin-list-collections.js';
import { adminCollectionStatsTool, handleAdminCollectionStats } from './tools/admin-collection-stats.js';
import { adminInspectMemoryTool, handleAdminInspectMemory } from './tools/admin-inspect-memory.js';
import { adminSearchAcrossUsersTool, handleAdminSearchAcrossUsers } from './tools/admin-search-across-users.js';
import {
  adminInspectUserPreferencesTool, handleAdminInspectUserPreferences,
  adminInspectUserGhostConfigsTool, handleAdminInspectUserGhostConfigs,
  adminInspectUserEscalationRecordsTool, handleAdminInspectUserEscalationRecords,
  adminInspectUserApiTokensTool, handleAdminInspectUserApiTokens,
} from './tools/admin-inspect-user.js';
import { adminHealthTool, handleAdminHealth } from './tools/admin-health.js';
import { adminDetectWeaviateDriftTool, handleAdminDetectWeaviateDrift } from './tools/admin-detect-weaviate-drift.js';

export interface ServerOptions {
  name?: string;
  version?: string;
  /**
   * Internal context for ghost/agent sessions. When set, the server provides
   * unified internal memory tools with behavior driven by the context type.
   *
   * Populated from platform HTTP headers via mcp-auth extras:
   *   X-Internal-Type → type ('ghost' | 'agent')
   *   X-Ghost-Owner   → owner_user_id
   *   X-Ghost-Type    → ghost_type ('user' | 'space' | 'group')
   *   X-Ghost-Space   → ghost_space
   *   X-Ghost-Group   → ghost_group
   *
   * Trust level is resolved server-side from GhostConfig (Firestore).
   * The LLM never has access to set or override these values.
   */
  internalContext?: {
    type: 'ghost' | 'agent';
    ghost_type?: 'user' | 'space' | 'group';
    ghost_space?: string;
    ghost_group?: string;
    owner_user_id?: string;
    accessor_user_id: string;
  };
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
/**
 * Normalize flat mcp-auth extras into structured ServerOptions.
 *
 * mcp-auth strips X- prefix and converts hyphens to underscores:
 *   X-Internal-Type → internal_type
 *   X-Ghost-Owner   → ghost_owner
 *   X-Ghost-Type    → ghost_type
 *   X-Ghost-Space   → ghost_space
 *   X-Ghost-Group   → ghost_group
 */
function normalizeOptions(
  raw: ServerOptions | Record<string, string | string[] | undefined>,
  userId: string
): ServerOptions {
  // Already structured — has internalContext or no internal_type key
  if ('internalContext' in raw || !('internal_type' in raw)) {
    return raw as ServerOptions;
  }

  // Flat extras from mcp-auth
  const extras = raw as Record<string, string | string[] | undefined>;
  const internalType = extras.internal_type as string | undefined;

  if (!internalType) {
    return {};
  }

  return {
    internalContext: {
      type: internalType as 'ghost' | 'agent',
      ghost_type: extras.ghost_type as 'user' | 'space' | 'group' | undefined,
      ghost_space: extras.ghost_space as string | undefined,
      ghost_group: extras.ghost_group as string | undefined,
      owner_user_id: extras.ghost_owner as string | undefined,
      accessor_user_id: userId,
    },
  };
}

export async function createServer(
  accessToken: string,
  userId: string,
  options: ServerOptions | Record<string, string | string[] | undefined> = {}
): Promise<Server> {
  // Note: accessToken is not used by remember-mcp (self-managed data)
  // but required by mcp-auth contract. Can be any value including empty string.

  if (!userId) {
    throw new Error('userId is required');
  }

  // Normalize: mcp-auth passes flat extras (e.g. { internal_type: 'ghost', ghost_owner: 'alice' })
  // Direct callers pass structured ServerOptions (e.g. { internalContext: { type: 'ghost', ... } })
  const opts = normalizeOptions(options, userId);

  logger.debug('Creating server instance', { userId });

  // Ensure databases are initialized (happens once globally)
  // Initialization must succeed or server creation fails
  await ensureDatabasesInitialized();

  // Create MCP server
  const server = new Server(
    {
      name: opts.name || 'remember-mcp',
      version: opts.version || '0.2.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Resolve internal context with trust level from Firestore if ghost mode
  let resolvedInternalContext: import('./types/auth.js').InternalContext | undefined;
  if (opts.internalContext) {
    const ic = opts.internalContext;
    let accessorTrustLevel: number | undefined;

    if (ic.type === 'ghost' && ic.owner_user_id) {
      const ghostConfig = await getGhostConfig(ic.owner_user_id);
      accessorTrustLevel = await resolveAccessorTrustLevel(ghostConfig, ic.owner_user_id, ic.accessor_user_id);
    }

    resolvedInternalContext = {
      type: ic.type,
      ghost_type: ic.ghost_type,
      ghost_space: ic.ghost_space,
      ghost_group: ic.ghost_group,
      owner_user_id: ic.owner_user_id,
      accessor_user_id: ic.accessor_user_id,
      accessor_trust_level: accessorTrustLevel,
    };
    logger.info('Internal context resolved', {
      type: resolvedInternalContext.type,
      ghostType: resolvedInternalContext.ghost_type,
      ownerUserId: resolvedInternalContext.owner_user_id,
      accessorUserId: resolvedInternalContext.accessor_user_id,
      trustLevel: resolvedInternalContext.accessor_trust_level,
    });
  }

  // Register handlers with userId scope
  registerHandlers(server, userId, accessToken, resolvedInternalContext);

  return server;
}

/**
 * Register MCP handlers scoped to userId
 */
function registerHandlers(
  server: Server,
  userId: string,
  accessToken: string,
  internalContext?: import('./types/auth.js').InternalContext
): void {
  // Admin tool definitions (hidden from non-admin users)
  const adminTools = [
    adminGetWeaviateSchemaTool,
    adminListCollectionsTool,
    adminCollectionStatsTool,
    adminInspectMemoryTool,
    adminSearchAcrossUsersTool,
    adminInspectUserPreferencesTool,
    adminInspectUserGhostConfigsTool,
    adminInspectUserEscalationRecordsTool,
    adminInspectUserApiTokensTool,
    adminHealthTool,
    adminDetectWeaviateDriftTool,
  ];

  // List available tools (admin tools conditionally included)
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = [
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
      // Search modes
      searchByTool,
      // Unified internal memory tools
      createInternalMemoryTool,
      updateInternalMemoryTool,
      searchInternalMemoryTool,
      queryInternalMemoryTool,
      searchInternalMemoryByTool,
      // Core introspection
      getCoreTool,
      // Space search modes
      searchSpaceByTool,
    ];

    // Only include admin tools for admin users
    if (isAdmin(userId)) {
      tools.push(...adminTools as typeof tools);
    }

    return { tools };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      // Resolve credentials once per request
      const credentials = await credentialsProvider.getCredentials(accessToken, userId);
      const authContext: AuthContext = { accessToken, credentials, internalContext };

      let result: string;

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

        case 'remember_search_by':
          result = await handleSearchBy(args as any, userId, authContext);
          break;

        case 'remember_create_internal_memory':
          result = await handleCreateInternalMemory(args as any, userId, authContext);
          break;

        case 'remember_update_internal_memory':
          result = await handleUpdateInternalMemory(args as any, userId, authContext);
          break;

        case 'remember_search_internal_memory':
          result = await handleSearchInternalMemory(args as any, userId, authContext);
          break;

        case 'remember_query_internal_memory':
          result = await handleQueryInternalMemory(args as any, userId, authContext);
          break;

        case 'remember_search_internal_memory_by':
          result = await handleSearchInternalMemoryBy(args as any, userId, authContext);
          break;

        case 'remember_get_core':
          result = await handleGetCore(args as any, userId, authContext);
          break;

        case 'remember_search_space_by':
          result = await handleSearchSpaceBy(args as any, userId, authContext);
          break;

        // Admin tools (gated by isAdmin check inside each handler)
        case 'remember_admin_get_weaviate_schema':
          result = await handleAdminGetWeaviateSchema(args as any, userId, authContext);
          break;

        case 'remember_admin_list_collections':
          result = await handleAdminListCollections(args as any, userId, authContext);
          break;

        case 'remember_admin_collection_stats':
          result = await handleAdminCollectionStats(args as any, userId, authContext);
          break;

        case 'remember_admin_inspect_memory':
          result = await handleAdminInspectMemory(args as any, userId, authContext);
          break;

        case 'remember_admin_search_across_users':
          result = await handleAdminSearchAcrossUsers(args as any, userId, authContext);
          break;

        case 'remember_admin_inspect_user_preferences':
          result = await handleAdminInspectUserPreferences(args as any, userId, authContext);
          break;

        case 'remember_admin_inspect_user_ghost_configs':
          result = await handleAdminInspectUserGhostConfigs(args as any, userId, authContext);
          break;

        case 'remember_admin_inspect_user_escalation_records':
          result = await handleAdminInspectUserEscalationRecords(args as any, userId, authContext);
          break;

        case 'remember_admin_inspect_user_api_tokens':
          result = await handleAdminInspectUserApiTokens(args as any, userId, authContext);
          break;

        case 'remember_admin_health':
          result = await handleAdminHealth(args as any, userId, authContext);
          break;

        case 'remember_admin_detect_weaviate_drift':
          result = await handleAdminDetectWeaviateDrift(args as any, userId, authContext);
          break;

        default:
          // Admin tool gate: reject non-admin users calling admin tools
          if (name.startsWith('remember_admin_')) {
            if (!isAdmin(userId)) {
              return adminPermissionError();
            }
          }
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

