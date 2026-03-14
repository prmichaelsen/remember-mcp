/**
 * remember_admin_collection_stats tool
 * Returns stats for a specific Weaviate collection.
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { isAdmin, adminPermissionError } from '../utils/admin.js';
import { getWeaviateClient } from '../weaviate/client.js';

export const adminCollectionStatsTool = {
  name: 'remember_admin_collection_stats',
  description: `[Admin] Get stats for a Weaviate collection — object count, property count, configuration.

  Requires admin access (ADMIN_USER_IDS).`,
  inputSchema: {
    type: 'object',
    properties: {
      collection_name: {
        type: 'string',
        description: 'Collection name to get stats for',
      },
    },
    required: ['collection_name'],
  },
};

export interface AdminCollectionStatsArgs {
  collection_name: string;
}

export async function handleAdminCollectionStats(
  args: AdminCollectionStatsArgs,
  userId: string,
  _authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_admin_collection_stats', userId, operation: 'collection stats' });
  try {
    if (!isAdmin(userId)) {
      return JSON.stringify(adminPermissionError());
    }

    debug.info('Tool invoked', { collection_name: args.collection_name });

    const client = getWeaviateClient();
    const collection = client.collections.get(args.collection_name);

    // Get config and count in parallel
    const [config, objectCount] = await Promise.all([
      collection.config.get(),
      collection.length(),
    ]);

    return JSON.stringify({
      collection_name: args.collection_name,
      object_count: objectCount,
      property_count: config.properties.length,
      properties: config.properties.map((p: any) => p.name),
      vectorizers: config.vectorizers,
      multiTenancy: config.multiTenancy,
      replication: config.replication,
    }, null, 2);
  } catch (error) {
    return handleToolError(error, { toolName: 'remember_admin_collection_stats', userId, operation: 'collection stats' });
  }
}
