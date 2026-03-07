/**
 * remember_search_ghost_memory tool
 * Wraps search_memory with hardcoded ghost type filter
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { handleSearchMemory } from './search-memory.js';

export const searchGhostMemoryTool = {
  name: 'remember_search_ghost_memory',
  description: `Search ghost memories using hybrid semantic + keyword search.
  Automatically filters to content_type: ghost. Use this to find specific
  ghost interaction records.`,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      alpha: { type: 'number', minimum: 0, maximum: 1, description: 'Semantic vs keyword balance. Default: 0.7' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
      limit: { type: 'number', description: 'Max results. Default: 10' },
      offset: { type: 'number' },
      deleted_filter: { type: 'string', enum: ['exclude', 'include', 'only'] },
    },
    required: ['query'],
  },
};

export interface SearchGhostMemoryArgs {
  query: string;
  alpha?: number;
  tags?: string[];
  limit?: number;
  offset?: number;
  deleted_filter?: 'exclude' | 'include' | 'only';
}

export async function handleSearchGhostMemory(
  args: SearchGhostMemoryArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_search_ghost_memory', userId, operation: 'search ghost memories' });
  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    // Delegate to search_memory with ghost type filter hardcoded
    return await handleSearchMemory(
      {
        query: args.query,
        alpha: args.alpha,
        limit: args.limit,
        offset: args.offset,
        filters: {
          types: ['ghost'] as any,
          tags: args.tags,
        },
        deleted_filter: args.deleted_filter,
      },
      userId,
      authContext
    );
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_search_ghost_memory',
      operation: 'search ghost memories',
      userId,
    });
  }
}
