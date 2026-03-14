/**
 * remember_admin_inspect_memory tool
 * Fetches a raw memory object by UUID using the Firestore index for collection resolution.
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { isAdmin, adminPermissionError } from '../utils/admin.js';
import { getWeaviateClient } from '../weaviate/client.js';
import { MemoryIndexService, createLogger } from '@prmichaelsen/remember-core';

const indexService = new MemoryIndexService(createLogger('info'));

export const adminInspectMemoryTool = {
  name: 'remember_admin_inspect_memory',
  description: `[Admin] Fetch a raw memory object by UUID — all fields including internal metadata.

  Uses the Firestore index to resolve which collection the memory lives in.
  Optionally includes the vector embedding.
  Requires admin access (ADMIN_USER_IDS).`,
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: {
        type: 'string',
        description: 'Memory UUID',
      },
      include_vector: {
        type: 'boolean',
        description: 'Include the vector embedding in the response. Default: false',
      },
    },
    required: ['memory_id'],
  },
};

export interface AdminInspectMemoryArgs {
  memory_id: string;
  include_vector?: boolean;
}

export async function handleAdminInspectMemory(
  args: AdminInspectMemoryArgs,
  userId: string,
  _authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_admin_inspect_memory', userId, operation: 'inspect memory' });
  try {
    if (!isAdmin(userId)) {
      return JSON.stringify(adminPermissionError());
    }

    debug.info('Tool invoked', { memory_id: args.memory_id, include_vector: args.include_vector });

    // Resolve collection from index
    const collectionName = await indexService.lookup(args.memory_id);
    if (!collectionName) {
      return JSON.stringify({ error: `Memory not found in index: ${args.memory_id}` });
    }

    // Fetch raw object from Weaviate
    const client = getWeaviateClient();
    const collection = client.collections.get(collectionName);
    const result = await collection.query.fetchObjectById(args.memory_id, {
      includeVector: args.include_vector ?? false,
    });

    if (!result) {
      return JSON.stringify({
        error: `Memory indexed in ${collectionName} but not found in Weaviate: ${args.memory_id}`,
        collection_name: collectionName,
      });
    }

    return JSON.stringify({
      id: result.uuid,
      collection_name: collectionName,
      properties: result.properties,
      vectors: args.include_vector ? result.vectors : undefined,
      metadata: result.metadata,
    }, null, 2);
  } catch (error) {
    return handleToolError(error, { toolName: 'remember_admin_inspect_memory', userId, operation: 'inspect memory' });
  }
}
