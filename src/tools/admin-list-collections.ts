/**
 * remember_admin_list_collections tool
 * Lists all Weaviate collections with type categorization.
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { isAdmin, adminPermissionError } from '../utils/admin.js';
import { getWeaviateClient } from '../weaviate/client.js';

export const adminListCollectionsTool = {
  name: 'remember_admin_list_collections',
  description: `[Admin] List all Weaviate collections with type categorization (user, space, group).

  Optionally filter by prefix (e.g. "Memory_users_", "Memory_spaces_").
  Requires admin access (ADMIN_USER_IDS).`,
  inputSchema: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        description: 'Optional prefix filter (e.g. "Memory_users_", "Memory_spaces_")',
      },
    },
  },
};

export interface AdminListCollectionsArgs {
  filter?: string;
}

function categorizeCollection(name: string): string {
  if (name.startsWith('Memory_users_')) return 'user';
  if (name.startsWith('Memory_spaces_')) return 'space';
  if (name.startsWith('Memory_groups_')) return 'group';
  if (name.startsWith('Memory_friends_')) return 'friends';
  return 'other';
}

export async function handleAdminListCollections(
  args: AdminListCollectionsArgs,
  userId: string,
  _authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_admin_list_collections', userId, operation: 'list collections' });
  try {
    if (!isAdmin(userId)) {
      return JSON.stringify(adminPermissionError());
    }

    debug.info('Tool invoked', { filter: args.filter });

    const client = getWeaviateClient();
    const allCollections = await client.collections.listAll();

    let collections = allCollections.map((c: any) => ({
      name: c.name,
      type: categorizeCollection(c.name),
    }));

    if (args.filter) {
      collections = collections.filter((c: any) => c.name.startsWith(args.filter!));
    }

    return JSON.stringify({
      total: collections.length,
      collections,
    }, null, 2);
  } catch (error) {
    return handleToolError(error, { toolName: 'remember_admin_list_collections', userId, operation: 'list collections' });
  }
}
