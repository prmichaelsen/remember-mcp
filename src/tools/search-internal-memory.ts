/**
 * remember_search_internal_memory tool
 * Wraps search_memory with auto-scoped content type and ghost source filters.
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { handleSearchMemory } from './search-memory.js';
import { buildInternalTags } from '../utils/internal-tags.js';

export const searchInternalMemoryTool = {
  name: 'remember_search_internal_memory',
  description: `Search internal memories (ghost or agent) using hybrid semantic + keyword search.

  Automatically scoped to the current session's content type and ghost source.
  In ghost mode, only shows memories from the current ghost conversation
  (e.g., only alice's ghost memories, not carol's).`,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      alpha: { type: 'number', minimum: 0, maximum: 1, description: 'Semantic vs keyword balance. Default: 0.7' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Additional tag filters' },
      limit: { type: 'number', description: 'Max results. Default: 10' },
      offset: { type: 'number' },
      deleted_filter: { type: 'string', enum: ['exclude', 'include', 'only'] },
    },
    required: ['query'],
  },
};

export interface SearchInternalMemoryArgs {
  query: string;
  alpha?: number;
  tags?: string[];
  limit?: number;
  offset?: number;
  deleted_filter?: 'exclude' | 'include' | 'only';
}

export async function handleSearchInternalMemory(
  args: SearchInternalMemoryArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_search_internal_memory', userId, operation: 'search internal memories' });
  try {
    debug.info('Tool invoked');

    const ctx = authContext?.internalContext;
    if (!ctx) {
      return JSON.stringify({ error: 'Internal context required. X-Internal-Type header must be set.' });
    }

    // Build scope tags for ghost source isolation (no override allowed)
    const allTags = buildInternalTags(authContext!);
    // Scope tags = everything except the base 'ghost' or 'agent' tag (those are covered by type filter)
    const scopeTags = allTags.filter(t => t !== 'ghost' && t !== 'agent');
    const userTags = args.tags ?? [];
    const mergedTags = [...new Set([...scopeTags, ...userTags])];

    // Delegate to search_memory with type + scope filters
    return await handleSearchMemory(
      {
        query: args.query,
        alpha: args.alpha,
        limit: args.limit,
        offset: args.offset,
        filters: {
          types: [ctx.type] as any,
          tags: mergedTags.length > 0 ? mergedTags : undefined,
        },
        deleted_filter: args.deleted_filter,
      },
      userId,
      authContext
    );
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_search_internal_memory',
      operation: 'search internal memories',
      userId,
    });
  }
}
