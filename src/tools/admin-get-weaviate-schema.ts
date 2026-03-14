/**
 * remember_admin_get_weaviate_schema tool
 * Inspects a Weaviate collection's schema, property types, and index config.
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { isAdmin, adminPermissionError } from '../utils/admin.js';
import { getWeaviateClient } from '../weaviate/client.js';

export const adminGetWeaviateSchemaTool = {
  name: 'remember_admin_get_weaviate_schema',
  description: `[Admin] Inspect a Weaviate collection's schema — property names, types, and configuration.

  Requires admin access (ADMIN_USER_IDS).`,
  inputSchema: {
    type: 'object',
    properties: {
      collection_name: {
        type: 'string',
        description: 'Collection name (e.g. "Memory_users_abc123", "Memory_spaces_public")',
      },
    },
    required: ['collection_name'],
  },
};

export interface AdminGetWeaviateSchemaArgs {
  collection_name: string;
}

export async function handleAdminGetWeaviateSchema(
  args: AdminGetWeaviateSchemaArgs,
  userId: string,
  _authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_admin_get_weaviate_schema', userId, operation: 'get schema' });
  try {
    if (!isAdmin(userId)) {
      return JSON.stringify(adminPermissionError());
    }

    debug.info('Tool invoked', { collection_name: args.collection_name });

    const client = getWeaviateClient();
    const collection = client.collections.get(args.collection_name);
    const config = await collection.config.get();

    return JSON.stringify({
      collection_name: args.collection_name,
      properties: config.properties.map((p: any) => ({
        name: p.name,
        dataType: p.dataType,
        description: p.description,
        indexFilterable: p.indexFilterable,
        indexSearchable: p.indexSearchable,
        tokenization: p.tokenization,
      })),
      vectorizers: config.vectorizers,
      generative: config.generative,
      multiTenancy: config.multiTenancy,
      replication: config.replication,
    }, null, 2);
  } catch (error) {
    return handleToolError(error, { toolName: 'remember_admin_get_weaviate_schema', userId, operation: 'get schema' });
  }
}
