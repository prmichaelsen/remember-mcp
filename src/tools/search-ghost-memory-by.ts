/**
 * remember_search_ghost_memory_by tool
 * Wraps search_by with hardcoded ghost type filter
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { handleSearchBy } from './search-by.js';
import type { SearchByMode } from './search-by.js';

export const searchGhostMemoryByTool = {
  name: 'remember_search_ghost_memory_by',
  description: `Search ghost memories using specialized modes (byTime, byDensity,
  byProperty, byBroad, etc.). Automatically filters to content_type: ghost.`,
  inputSchema: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['byTime', 'byDensity', 'byRating', 'byDiscovery', 'byProperty', 'bySignificance', 'byRandom', 'byBroad'],
        description: 'Search mode',
      },
      query: { type: 'string', description: 'Optional search query' },
      sort_order: { type: 'string', enum: ['asc', 'desc'] },
      sort_field: { type: 'string', description: 'Property to sort by (byProperty mode)' },
      limit: { type: 'number' },
      offset: { type: 'number' },
      deleted_filter: { type: 'string', enum: ['exclude', 'include', 'only'] },
    },
    required: ['mode'],
  },
};

export interface SearchGhostMemoryByArgs {
  mode: SearchByMode;
  query?: string;
  sort_order?: 'asc' | 'desc';
  sort_field?: string;
  limit?: number;
  offset?: number;
  deleted_filter?: 'exclude' | 'include' | 'only';
}

export async function handleSearchGhostMemoryBy(
  args: SearchGhostMemoryByArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_search_ghost_memory_by', userId, operation: 'search ghost memories by mode' });
  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    // Delegate to search_by with ghost type filter hardcoded
    return await handleSearchBy(
      {
        mode: args.mode,
        query: args.query,
        sort_order: args.sort_order,
        sort_field: args.sort_field,
        limit: args.limit,
        offset: args.offset,
        filters: {
          types: ['ghost'],
        },
        deleted_filter: args.deleted_filter,
      },
      userId,
      authContext
    );
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_search_ghost_memory_by',
      operation: 'search ghost memories by mode',
      userId,
    });
  }
}
