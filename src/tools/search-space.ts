/**
 * remember_search_space tool (Memory Collection Pattern v2)
 *
 * Search shared spaces and/or groups to discover memories from other users.
 * Queries Memory_spaces_public (for space searches) and Memory_groups_{groupId}
 * (for group searches), then merges and deduplicates results.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Filters } from 'weaviate-client';
import { getWeaviateClient } from '../weaviate/client.js';
import { isValidSpaceId } from '../weaviate/space-schema.js';
import { SUPPORTED_SPACES } from '../types/space-memory.js';
import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import { CollectionType, getCollectionName } from '../collections/dot-notation.js';
import { logger } from '../utils/logger.js';

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
  include_comments?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Build base filters applied to all space/group collection queries.
 * Excludes soft-deleted memories and optionally filters by content type, tags, weight, and date.
 */
export function buildBaseFilters(collection: any, args: SearchSpaceArgs): any[] {
  const filterList: any[] = [];

  // Exclude soft-deleted memories (requires indexNullState: true on collection)
  filterList.push(collection.filter.byProperty('deleted_at').isNull(true));

  // Only return memories (not relationships)
  filterList.push(collection.filter.byProperty('doc_type').equal('memory'));

  // Apply content type filter
  if (args.content_type) {
    filterList.push(collection.filter.byProperty('type').equal(args.content_type));
  }

  // Exclude comments by default (unless content_type is explicitly set)
  if (!args.include_comments && !args.content_type) {
    filterList.push(collection.filter.byProperty('type').notEqual('comment'));
  }

  // Apply tags filter (AND semantics: memory must have ALL specified tags)
  if (args.tags && args.tags.length > 0) {
    args.tags.forEach(tag => {
      filterList.push(collection.filter.byProperty('tags').containsAny([tag]));
    });
  }

  // Apply weight filters
  if (args.min_weight !== undefined) {
    filterList.push(collection.filter.byProperty('weight').greaterOrEqual(args.min_weight));
  }
  if (args.max_weight !== undefined) {
    filterList.push(collection.filter.byProperty('weight').lessOrEqual(args.max_weight));
  }

  // Apply date filters (created_at stored as ISO 8601 text, sorts lexicographically)
  if (args.date_from) {
    filterList.push(collection.filter.byProperty('created_at').greaterOrEqual(new Date(args.date_from)));
  }
  if (args.date_to) {
    filterList.push(collection.filter.byProperty('created_at').lessOrEqual(new Date(args.date_to)));
  }

  return filterList;
}

/**
 * Execute a search against a Weaviate collection using the specified search type.
 */
async function executeSearch(
  collection: any,
  query: string,
  searchType: 'hybrid' | 'bm25' | 'semantic',
  whereFilter: any,
  limit: number
): Promise<any[]> {
  const opts = {
    limit,
    ...(whereFilter && { where: whereFilter }),
  };

  switch (searchType) {
    case 'bm25':
      return (await collection.query.bm25(query, opts)).objects;
    case 'semantic':
      return (await collection.query.nearText([query], opts)).objects;
    case 'hybrid':
    default:
      return (await collection.query.hybrid(query, opts)).objects;
  }
}

/**
 * Handle remember_search_space tool execution
 */
export async function handleSearchSpace(
  args: SearchSpaceArgs,
  userId: string
): Promise<string> {
  const debug = createDebugLogger({
    tool: 'remember_search_space',
    userId,
    operation: 'search_spaces',
  });

  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    const spaces = args.spaces || [];
    const groups = args.groups || [];
    const searchType = args.search_type || 'hybrid';
    const limit = args.limit || 10;
    const offset = args.offset || 0;

    // Validate space IDs
    if (spaces.length > 0) {
      const invalidSpaces = spaces.filter(s => !isValidSpaceId(s));
      if (invalidSpaces.length > 0) {
        return JSON.stringify(
          {
            success: false,
            error: 'Invalid space IDs',
            message: `Invalid spaces: ${invalidSpaces.join(', ')}. Supported spaces: ${SUPPORTED_SPACES.join(', ')}`,
            context: {
              invalid_spaces: invalidSpaces,
              provided_spaces: spaces,
              supported_spaces: SUPPORTED_SPACES,
            },
          },
          null,
          2
        );
      }
    }

    // Validate group IDs
    if (groups.length > 0) {
      const invalidGroups = groups.filter(g => !g || g.includes('.') || g.trim() === '');
      if (invalidGroups.length > 0) {
        return JSON.stringify(
          {
            success: false,
            error: 'Invalid group IDs',
            message: 'Group IDs cannot be empty or contain dots',
            context: { invalid_groups: invalidGroups },
          },
          null,
          2
        );
      }
    }

    const weaviateClient = getWeaviateClient();
    // Fetch enough results before pagination so we can deduplicate across sources
    const fetchLimit = (limit + offset) * Math.max(1, groups.length + (spaces.length > 0 || groups.length === 0 ? 1 : 0));
    const allObjects: any[] = [];

    logger.info('Starting space/group search', {
      tool: 'remember_search_space',
      userId,
      spaces,
      groups,
      searchType,
      query: args.query,
    });

    // --- Space collection search ---
    // Runs when spaces are specified, OR when neither spaces nor groups are specified (all-public)
    if (spaces.length > 0 || groups.length === 0) {
      const spacesCollectionName = getCollectionName(CollectionType.SPACES);
      const spacesCollection = weaviateClient.collections.get(spacesCollectionName);

      const filterList = buildBaseFilters(spacesCollection, args);

      // Filter by space_ids array when specific spaces are requested
      if (spaces.length > 0) {
        filterList.push(spacesCollection.filter.byProperty('space_ids').containsAny(spaces));
      }
      // When spaces.length === 0 and groups.length === 0: no space_ids filter → all-public search

      const whereFilter = filterList.length > 0 ? Filters.and(...filterList) : undefined;

      debug.debug('Searching Memory_spaces_public', {
        filterCount: filterList.length,
        spaces,
        allPublic: spaces.length === 0,
        searchType,
      });

      const spaceObjects = await debug.time('Space collection search', async () => {
        return await executeSearch(spacesCollection, args.query, searchType, whereFilter, fetchLimit);
      });

      allObjects.push(...spaceObjects);

      logger.info('Space collection search complete', {
        tool: 'remember_search_space',
        collectionName: spacesCollectionName,
        resultCount: spaceObjects.length,
      });
    }

    // --- Group collection searches ---
    for (const groupId of groups) {
      const groupCollectionName = getCollectionName(CollectionType.GROUPS, groupId);

      // Skip if the group collection doesn't exist yet
      const exists = await weaviateClient.collections.exists(groupCollectionName);
      if (!exists) {
        debug.warn('Group collection not found, skipping', { groupId, groupCollectionName });
        continue;
      }

      const groupCollection = weaviateClient.collections.get(groupCollectionName);
      const filterList = buildBaseFilters(groupCollection, args);
      const whereFilter = filterList.length > 0 ? Filters.and(...filterList) : undefined;

      debug.debug('Searching group collection', {
        groupId,
        groupCollectionName,
        filterCount: filterList.length,
        searchType,
      });

      const groupObjects = await debug.time(`Group collection search: ${groupId}`, async () => {
        return await executeSearch(groupCollection, args.query, searchType, whereFilter, fetchLimit);
      });

      allObjects.push(...groupObjects);

      logger.info('Group collection search complete', {
        tool: 'remember_search_space',
        groupId,
        collectionName: groupCollectionName,
        resultCount: groupObjects.length,
      });
    }

    // --- Deduplicate by UUID (composite ID) ---
    const seen = new Set<string>();
    const deduplicated = allObjects.filter(obj => {
      if (seen.has(obj.uuid)) return false;
      seen.add(obj.uuid);
      return true;
    });

    // --- Sort by relevance score descending ---
    deduplicated.sort((a, b) => {
      const scoreA = a.metadata?.score ?? 0;
      const scoreB = b.metadata?.score ?? 0;
      return scoreB - scoreA;
    });

    // --- Apply pagination ---
    const paginated = deduplicated.slice(offset, offset + limit);

    // Format results
    const memories = paginated.map(obj => ({
      id: obj.uuid,
      ...obj.properties,
      _score: obj.metadata?.score,
    }));

    const isAllPublic = spaces.length === 0 && groups.length === 0;

    const result = {
      spaces_searched: isAllPublic ? 'all_public' : spaces,
      groups_searched: groups,
      query: args.query,
      search_type: searchType,
      memories,
      total: memories.length,
      offset,
      limit,
    };

    debug.info('Tool completed successfully', {
      resultCount: memories.length,
      spaces,
      groups,
    });

    return JSON.stringify(result, null, 2);
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
