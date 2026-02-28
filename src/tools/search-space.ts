/**
 * remember_search_space tool (Memory Collection Pattern v2)
 *
 * Search shared spaces and/or groups to discover memories from other users.
 * Queries Memory_spaces_public (for space searches) and Memory_groups_{groupId}
 * (for group searches), then merges and deduplicates results.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Filters } from 'weaviate-client';
import { SUPPORTED_SPACES } from '../types/space-memory.js';
import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';

/**
 * Tool definition for remember_search_space
 */
export const searchSpaceTool: Tool = {
  name: 'remember_search_space',
  description: `Search shared spaces and/or groups to discover memories from other users.

Destinations:
- Spaces: Public shared areas (e.g., "the_void", "dogs") — queries Memory_spaces_public filtered by space_ids
- Groups: Private group collections — queries Memory_groups_{groupId} for each specified group
- Neither specified: Searches all public memories across Memory_spaces_public

Results from multiple sources are merged and deduplicated by composite ID, sorted by relevance.

⚠️ **CRITICAL - CONTENT TYPE FILTERING**: Do NOT add content_type filter unless the user explicitly requests filtering by type.
- ✅ CORRECT: User says "search The Void for hiking" → { spaces: ["the_void"], query: "hiking" }
- ❌ WRONG: User says "search The Void for hiking" → { spaces: ["the_void"], query: "hiking", content_type: "note" }
- ✅ CORRECT: User says "search The Void for note memories about hiking" → { spaces: ["the_void"], query: "hiking", content_type: "note" }

Let the search algorithm find ALL relevant memories regardless of type unless explicitly requested.`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query',
      },
      spaces: {
        type: 'array',
        items: {
          type: 'string',
          enum: SUPPORTED_SPACES,
        },
        description: 'Spaces to search (e.g., ["the_void", "dogs"]). Omit to search all public spaces.',
        minItems: 1,
      },
      groups: {
        type: 'array',
        items: { type: 'string' },
        description: 'Group IDs to search (e.g., ["group-123"]). Searches Memory_groups_{groupId} for each.',
        minItems: 1,
      },
      search_type: {
        type: 'string',
        enum: ['hybrid', 'bm25', 'semantic'],
        description: 'Search algorithm: "hybrid" (default), "bm25" (keyword only), or "semantic" (vector only)',
        default: 'hybrid',
      },
      content_type: {
        type: 'string',
        description: 'Filter by content type',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by tags (must have all specified tags)',
      },
      min_weight: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Minimum weight/significance (0-1)',
      },
      max_weight: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Maximum weight/significance (0-1)',
      },
      date_from: {
        type: 'string',
        description: 'Filter memories created after this date (ISO 8601)',
      },
      date_to: {
        type: 'string',
        description: 'Filter memories created before this date (ISO 8601)',
      },
      moderation_filter: {
        type: 'string',
        enum: ['approved', 'pending', 'rejected', 'removed', 'all'],
        description: 'Filter by moderation status. Default: "approved" (only shows approved/unmoderated). Non-approved filters require moderator permissions.',
        default: 'approved',
      },
      include_comments: {
        type: 'boolean',
        description: 'Include comments in search results (default: false)',
        default: false,
      },
      limit: {
        type: 'number',
        default: 10,
        description: 'Maximum number of results',
      },
      offset: {
        type: 'number',
        default: 0,
        description: 'Offset for pagination',
      },
    },
    required: ['query'],
  },
};

export type ModerationFilter = 'approved' | 'pending' | 'rejected' | 'removed' | 'all';

/**
 * Build the moderation status filter for a Weaviate collection query.
 * @deprecated Kept for test compatibility — logic now lives in remember-core SpaceService
 */
export function buildModerationFilter(collection: any, moderationFilter: ModerationFilter = 'approved'): any | null {
  if (moderationFilter === 'all') return null;
  if (moderationFilter === 'approved') {
    return Filters.or(
      collection.filter.byProperty('moderation_status').equal('approved'),
      collection.filter.byProperty('moderation_status').isNull(true)
    );
  }
  return collection.filter.byProperty('moderation_status').equal(moderationFilter);
}

/**
 * Build base filters applied to all space/group collection queries.
 * @deprecated Kept for test compatibility — logic now lives in remember-core SpaceService
 */
export function buildBaseFilters(collection: any, args: SearchSpaceArgs): any[] {
  const filterList: any[] = [];
  filterList.push(collection.filter.byProperty('deleted_at').isNull(true));
  filterList.push(collection.filter.byProperty('doc_type').equal('memory'));
  const moderationFilter = buildModerationFilter(collection, args.moderation_filter);
  if (moderationFilter) filterList.push(moderationFilter);
  if (args.content_type) filterList.push(collection.filter.byProperty('content_type').equal(args.content_type));
  if (!args.include_comments && !args.content_type) filterList.push(collection.filter.byProperty('content_type').notEqual('comment'));
  if (!args.content_type) filterList.push(collection.filter.byProperty('content_type').notEqual('ghost'));
  if (args.tags && args.tags.length > 0) args.tags.forEach(tag => filterList.push(collection.filter.byProperty('tags').containsAny([tag])));
  if (args.min_weight !== undefined) filterList.push(collection.filter.byProperty('weight').greaterOrEqual(args.min_weight));
  if (args.max_weight !== undefined) filterList.push(collection.filter.byProperty('weight').lessOrEqual(args.max_weight));
  if (args.date_from) filterList.push(collection.filter.byProperty('created_at').greaterOrEqual(new Date(args.date_from)));
  if (args.date_to) filterList.push(collection.filter.byProperty('created_at').lessOrEqual(new Date(args.date_to)));
  return filterList;
}

interface SearchSpaceArgs {
  query: string;
  spaces?: string[];
  groups?: string[];
  search_type?: 'hybrid' | 'bm25' | 'semantic';
  content_type?: string;
  tags?: string[];
  min_weight?: number;
  max_weight?: number;
  date_from?: string;
  date_to?: string;
  moderation_filter?: ModerationFilter;
  include_comments?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Handle remember_search_space tool execution
 */
export async function handleSearchSpace(
  args: SearchSpaceArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({
    tool: 'remember_search_space',
    userId,
    operation: 'search_spaces',
  });

  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    const { space } = createCoreServices(userId);
    const result = await space.search(
      {
        query: args.query,
        spaces: args.spaces,
        groups: args.groups,
        search_type: args.search_type,
        content_type: args.content_type,
        tags: args.tags,
        min_weight: args.min_weight,
        max_weight: args.max_weight,
        date_from: args.date_from,
        date_to: args.date_to,
        moderation_filter: args.moderation_filter as any,
        include_comments: args.include_comments,
        limit: args.limit,
        offset: args.offset,
      },
      authContext as any
    );

    const response = {
      spaces_searched: result.spaces_searched,
      groups_searched: result.groups_searched,
      query: args.query,
      search_type: args.search_type || 'hybrid',
      memories: result.memories,
      total: result.total,
      offset: result.offset,
      limit: result.limit,
    };

    debug.info('Tool completed successfully', {
      resultCount: result.total,
    });

    return JSON.stringify(response, null, 2);
  } catch (error) {
    debug.error('Tool failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return handleToolError(error, {
      toolName: 'remember_search_space',
      operation: 'search spaces',
      spaces: args.spaces,
      groups: args.groups,
      query: args.query,
    });
  }
}
