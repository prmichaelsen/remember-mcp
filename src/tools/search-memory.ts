/**
 * remember_search_memory tool
 * Search memories AND relationships using hybrid semantic + keyword search
 */

import type { Memory, Relationship, SearchOptions, SearchResult, SearchFilters } from '../types/memory.js';
import { getMemoryCollection } from '../weaviate/schema.js';
import { logger } from '../utils/logger.js';
import { handleToolError } from '../utils/error-handler.js';
import { buildCombinedSearchFilters, buildMemoryOnlyFilters, buildDeletedFilter, combineFiltersWithAnd } from '../utils/weaviate-filters.js';
import { buildTrustFilter } from '../services/trust-enforcement.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';

/** Ghost conversation context for trust-filtered cross-user searches */
export interface GhostContext {
  owner_user_id: string;
  accessor_user_id: string;
  accessor_trust_level: number;
}

/**
 * Tool definition for remember_search_memory
 */
export const searchMemoryTool = {
  name: 'remember_search_memory',
  description: `Search memories AND relationships using hybrid semantic and keyword search.
  
  **BEST FOR**: Precise searches with specific keywords or exact phrases. Good for finding specific items when you know what you're looking for.
  
  By default, searches BOTH memories and relationships to provide comprehensive results.
  Relationships contain valuable context in their observations.
  
  Supports:
  - Semantic search (meaning-based) across memory content and relationship observations
  - Keyword search (exact matches)
  - Hybrid search (balanced with alpha parameter)
  - Filtering by type, tags, weight, trust, date range
  - Returns both memories and relationships in separate arrays
  
  Examples:
  - "Find memories about camping trips" → returns memories + relationships about camping
  - "Search for recipes I saved" → returns recipe memories + related relationships
  - "Show me notes from last week" → returns notes + any relationships created that week
  
  **AGENT GUIDANCE**:
  - ⚠️ **CRITICAL - CONTENT TYPE FILTERING**: Do NOT add filters.types unless the user explicitly requests filtering by content type.
    * ✅ CORRECT: User says "search for hiking" → { query: "hiking" }
    * ❌ WRONG: User says "search for hiking" → { query: "hiking", filters: { types: ["note"] } }
    * ✅ CORRECT: User says "search for note memories about hiking" → { query: "hiking", filters: { types: ["note"] } }
    * Let the search algorithm find ALL relevant memories regardless of type unless explicitly requested.
  - If search results are too narrow or miss relevant content, try remember_query_memory instead - it uses pure semantic search which is better for broader, concept-based queries. You can inform the user: "I didn't find what you're looking for with keyword search. Let me try a broader semantic search using the query tool."
  - **CRITICAL**: If no results are returned, DO NOT make up or fabricate memories. Only report what was actually found. Tell the user honestly that no matching memories were found and suggest they:
    * Create a new memory with the information they're looking for
    * Try the other search tool (remember_query_memory for broader semantic search)
    * Remove or relax filters if they applied any
    * Increase the limit parameter to see more results
    * Try different search terms or keywords
  `,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query',
      },
      alpha: {
        type: 'number',
        description: 'Balance between semantic (1.0) and keyword (0.0) search. Default: 0.7',
        minimum: 0,
        maximum: 1,
        default: 0.7,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results. Default: 10',
        minimum: 1,
        maximum: 100,
        default: 10,
      },
      offset: {
        type: 'number',
        description: 'Pagination offset. Default: 0',
        minimum: 0,
        default: 0,
      },
      filters: {
        type: 'object',
        description: 'Optional filters',
        properties: {
          types: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by content types',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by tags',
          },
          weight_min: {
            type: 'number',
            description: 'Minimum weight (0-1)',
          },
          trust_min: {
            type: 'number',
            description: 'Minimum trust level (0-1)',
          },
          date_from: {
            type: 'string',
            description: 'Start date (ISO 8601)',
          },
          date_to: {
            type: 'string',
            description: 'End date (ISO 8601)',
          },
        },
      },
      include_relationships: {
        type: 'boolean',
        description: 'Include relationships in results. Default: true (searches both memories and relationships)',
        default: true,
      },
      deleted_filter: {
        type: 'string',
        enum: ['exclude', 'include', 'only'],
        default: 'exclude',
        description: 'Filter deleted memories: "exclude" (default, hide deleted), "include" (show all), "only" (show only deleted)',
      },
      ghost_context: {
        type: 'object',
        description: 'Ghost conversation context (injected by system, not user-facing). When present, applies trust filtering.',
        properties: {
          owner_user_id: { type: 'string', description: 'Ghost owner user ID (whose memories to search)' },
          accessor_user_id: { type: 'string', description: 'User chatting with the ghost' },
          accessor_trust_level: { type: 'number', description: 'Trust level of accessor (0-1)' },
        },
      },
    },
    required: ['query'],
  },
};

/**
 * Handle remember_search_memory tool
 */
export async function handleSearchMemory(
  args: SearchOptions & { ghost_context?: GhostContext },
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const ghostContext = args.ghost_context;
  // In ghost mode, search the ghost owner's collection instead of the caller's
  const searchUserId = ghostContext?.owner_user_id ?? userId;
  const debug = createDebugLogger({ tool: 'remember_search_memory', userId: searchUserId, operation: ghostContext ? 'ghost search' : 'search memory' });
  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args, ghostMode: !!ghostContext });
    // Validate query is not empty
    if (!args.query || args.query.trim() === '') {
      throw new Error('Query cannot be empty');
    }

    const includeRelationships = args.include_relationships !== false; // Default true

    logger.info('Searching memories and relationships', {
      userId: searchUserId,
      query: args.query,
      includeRelationships,
      ghostMode: !!ghostContext,
    });

    const collection = getMemoryCollection(searchUserId);
    const alpha = args.alpha ?? 0.7;
    const limit = args.limit ?? 10;
    const offset = args.offset ?? 0;

    // Build deleted filter
    const deletedFilter = buildDeletedFilter(collection, args.deleted_filter || 'exclude');

    // Build trust filter for ghost mode
    const trustFilter = ghostContext
      ? buildTrustFilter(collection, ghostContext.accessor_trust_level)
      : null;

    // Build filters using v3 API
    // Use OR logic to search both memories and relationships
    const searchFilters = includeRelationships
      ? buildCombinedSearchFilters(collection, args.filters)
      : buildMemoryOnlyFilters(collection, args.filters);

    // Exclude ghost memories by default (unless explicitly searching for them)
    const hasExplicitTypeFilter = args.filters?.types && args.filters.types.length > 0;
    const ghostExclusionFilter = !hasExplicitTypeFilter
      ? collection.filter.byProperty('content_type').notEqual('ghost')
      : null;

    // Combine deleted filter, trust filter, ghost exclusion, and search filters
    const combinedFilters = combineFiltersWithAnd([deletedFilter, trustFilter, ghostExclusionFilter, searchFilters].filter(f => f !== null));

    // Build search options
    const searchOptions: any = {
      alpha: alpha,
      limit: limit + offset, // Get extra for offset
    };

    // Add filters if present
    if (combinedFilters) {
      searchOptions.filters = combinedFilters;
    }

    // Log the query for debugging
    logger.info('Weaviate query', {
      query: args.query,
      searchOptions: JSON.stringify(searchOptions, null, 2),
      hasFilters: !!combinedFilters,
      deletedFilter: args.deleted_filter || 'exclude',
    });

    // Perform hybrid search with Weaviate v3 API
    const results = await collection.query.hybrid(args.query, searchOptions);

    // Apply offset
    const paginatedResults = results.objects.slice(offset);

    // Separate memories and relationships
    const memories: Partial<Memory>[] = [];
    const relationships: Partial<Relationship>[] = [];

    for (const obj of paginatedResults) {
      const doc: any = {
        id: obj.uuid,
        ...obj.properties,
      };

      if (doc.doc_type === 'memory') {
        memories.push(doc as Memory);
      } else if (doc.doc_type === 'relationship') {
        relationships.push(doc as Relationship);
      }
    }

    // Build result
    const searchResult: SearchResult = {
      memories: memories as Memory[],
      relationships: includeRelationships ? (relationships as Relationship[]) : undefined,
      total: memories.length + relationships.length,
      offset: offset,
      limit: limit,
    };

    logger.info('Search completed', {
      userId,
      query: args.query,
      memoriesFound: memories.length,
      relationshipsFound: relationships.length,
      total: searchResult.total
    });

    return JSON.stringify(searchResult, null, 2);
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_search_memory',
      operation: 'search memories',
      userId,
      query: args.query,
      includeRelationships: args.include_relationships,
    });
  }
}
