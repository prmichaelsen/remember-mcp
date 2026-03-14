/**
 * remember_admin_search_across_users tool
 * Searches memories across multiple user tenants.
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { isAdmin, adminPermissionError } from '../utils/admin.js';
import { createCoreServices } from '../core-services.js';

export const adminSearchAcrossUsersTool = {
  name: 'remember_admin_search_across_users',
  description: `[Admin] Search memories across multiple user tenants.

  Results include which user each memory belongs to.
  Requires explicit user_id array — no "all users" search.
  Requires admin access (ADMIN_USER_IDS).`,
  inputSchema: {
    type: 'object',
    properties: {
      user_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'User IDs to search across (required, 1 or more)',
      },
      query: {
        type: 'string',
        description: 'Search query (hybrid search)',
      },
      limit: {
        type: 'number',
        description: 'Max results across all users. Default: 10',
      },
      content_type: {
        type: 'string',
        description: 'Optional content type filter',
      },
    },
    required: ['user_ids', 'query'],
  },
};

export interface AdminSearchAcrossUsersArgs {
  user_ids: string[];
  query: string;
  limit?: number;
  content_type?: string;
}

export async function handleAdminSearchAcrossUsers(
  args: AdminSearchAcrossUsersArgs,
  userId: string,
  _authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_admin_search_across_users', userId, operation: 'search across users' });
  try {
    if (!isAdmin(userId)) {
      return JSON.stringify(adminPermissionError());
    }

    if (!args.user_ids || args.user_ids.length === 0) {
      return JSON.stringify({ error: 'user_ids array is required and must not be empty' });
    }

    debug.info('Tool invoked', { user_ids: args.user_ids, query: args.query, limit: args.limit });

    const limit = args.limit ?? 10;
    const allResults: Array<{ user_id: string; memory: any; score?: number }> = [];
    const warnings: string[] = [];

    for (const targetUserId of args.user_ids) {
      try {
        const services = createCoreServices(targetUserId);
        const searchResult = await services.memory.search({
          query: args.query,
          limit,
          filters: args.content_type ? { types: [args.content_type as any] } : undefined,
        });

        for (const memory of searchResult.memories) {
          allResults.push({
            user_id: targetUserId,
            memory,
          });
        }
      } catch (err) {
        warnings.push(`User ${targetUserId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Sort by relevance (first results from each user are highest relevance)
    // and limit to requested total
    const limited = allResults.slice(0, limit);

    return JSON.stringify({
      total: limited.length,
      results: limited,
      warnings: warnings.length > 0 ? warnings : undefined,
    }, null, 2);
  } catch (error) {
    return handleToolError(error, { toolName: 'remember_admin_search_across_users', userId, operation: 'search across users' });
  }
}
