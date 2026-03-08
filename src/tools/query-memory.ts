/**
 * remember_query_memory tool
 * RAG (Retrieval-Augmented Generation) queries with natural language
 */

import type { Memory, SearchFilters, DeletedFilter } from '../types/memory.js';
import { getMemoryCollection } from '../weaviate/schema.js';
import { logger } from '../utils/logger.js';
import { handleToolError } from '../utils/error-handler.js';
import { buildCombinedSearchFilters, buildDeletedFilter, combineFiltersWithAnd, buildTrustFilter } from '@prmichaelsen/remember-core';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';

/**
 * Tool definition for remember_query_memory
 */
export const queryMemoryTool = {
  name: 'remember_query_memory',
  description: `Query memories using natural language for RAG (Retrieval-Augmented Generation).
  
  **BEST FOR**: Broad, concept-based searches and natural language questions. Uses pure semantic search to find memories by meaning, not just keywords. Great for exploratory queries and when you're not sure of exact terms.
  
  This tool is optimized for LLM context retrieval. It returns relevant memories
  with their full content and context, formatted for easy consumption by LLMs.
  
  Use this when you need to:
  - Answer questions based on stored memories
  - Provide context for conversations
  - Retrieve information for decision-making
  - Build responses using past knowledge
  - Find memories by concept rather than exact keywords
  
  Examples:
  - "What do I know about camping?"
  - "Tell me about the recipes I've saved"
  - "What meetings did I have last week?"
  - "What are my project goals?"
  
  **AGENT GUIDANCE**:
  - ⚠️ **CRITICAL - CONTENT TYPE FILTERING**: Do NOT add filters.types unless the user explicitly requests filtering by content type.
    * ✅ CORRECT: User says "what do I know about hiking?" → { query: "hiking" }
    * ❌ WRONG: User says "what do I know about hiking?" → { query: "hiking", filters: { types: ["note"] } }
    * ✅ CORRECT: User says "what notes do I have about hiking?" → { query: "hiking", filters: { types: ["note"] } }
    * Let the query algorithm find ALL relevant memories regardless of type unless explicitly requested.
  - If query results are too broad or include irrelevant content, try remember_search_memory instead - it uses hybrid search with keyword matching which is better for precise, specific searches. You can inform the user: "The results were too broad. Let me try a more precise keyword search using the search tool."
  - **CRITICAL**: If no results are returned, DO NOT make up or fabricate memories. Only report what was actually found. Tell the user honestly that no matching memories were found and suggest they:
    * Create a new memory with the information they're looking for
    * Try the other search tool (remember_search_memory for more precise keyword-based search)
    * Remove or relax filters if they applied any
    * Increase the limit parameter to see more results
    * Lower the min_relevance threshold to include less relevant matches
    * Try rephrasing the query with different terms
  `,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language query',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of memories to retrieve. Default: 5',
        minimum: 1,
        maximum: 50,
        default: 5,
      },
      min_relevance: {
        type: 'number',
        description: 'Minimum relevance score (0-1). Default: 0.6',
        minimum: 0,
        maximum: 1,
        default: 0.6,
      },
      filters: {
        type: 'object',
        description: 'Optional filters to narrow results',
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
          rating_min: {
            type: 'number',
            description: 'Minimum Bayesian rating average',
          },
        },
      },
      include_context: {
        type: 'boolean',
        description: 'Include full context metadata. Default: true',
        default: true,
      },
      format: {
        type: 'string',
        description: 'Output format: "detailed" (full objects) or "compact" (text summary). Default: detailed',
        enum: ['detailed', 'compact'],
        default: 'detailed',
      },
      deleted_filter: {
        type: 'string',
        enum: ['exclude', 'include', 'only'],
        default: 'exclude',
        description: 'Filter deleted memories: "exclude" (default, hide deleted), "include" (show all), "only" (show only deleted)',
      },
    },
    required: ['query'],
  },
};

/**
 * Query memory arguments
 */
export interface QueryMemoryArgs {
  query: string;
  limit?: number;
  min_relevance?: number;
  filters?: SearchFilters;
  include_context?: boolean;
  format?: 'detailed' | 'compact';
  deleted_filter?: DeletedFilter;
}

/**
 * Memory with relevance score
 */
export interface RelevantMemory extends Partial<Memory> {
  relevance: number; // 0-1 relevance score
  content_type?: string; // v2 property name (v1: type)
}

/**
 * Query memory result
 */
export interface QueryMemoryResult {
  query: string;
  memories: RelevantMemory[] | string; // Array for detailed, string for compact
  total: number;
  min_relevance: number;
  context_summary?: string;
}

/**
 * Handle remember_query_memory tool
 */
export async function handleQueryMemory(
  args: QueryMemoryArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const internalContext = authContext?.internalContext;
  const searchUserId = internalContext?.owner_user_id ?? userId;
  const debug = createDebugLogger({ tool: 'remember_query_memory', userId: searchUserId, operation: internalContext ? 'internal query' : 'query memory' });
  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args, internalContext: !!internalContext });
    // Validate query is not empty
    if (!args.query || args.query.trim() === '') {
      throw new Error('Query cannot be empty');
    }

    logger.info('Querying memories', { userId: searchUserId, query: args.query, internalContext: !!internalContext });

    const collection = getMemoryCollection(searchUserId);
    const limit = args.limit ?? 5;
    const minRelevance = args.min_relevance ?? 0.6;
    const includeContext = args.include_context ?? true;
    const format = args.format ?? 'detailed';

    // Build deleted filter
    const deletedFilter = buildDeletedFilter(collection, args.deleted_filter || 'exclude');

    // Build trust filter for ghost mode (resolved server-side, never from tool args)
    const trustFilter = internalContext?.accessor_trust_level != null
      ? buildTrustFilter(collection, internalContext.accessor_trust_level)
      : null;

    // Build filters using v3 API - search both memories and relationships
    const searchFilters = buildCombinedSearchFilters(collection, args.filters);

    // Exclude ghost and agent memories by default (unless explicitly searching for them)
    const hasExplicitTypeFilter = args.filters?.types && args.filters.types.length > 0;
    const internalExclusionFilter = !hasExplicitTypeFilter
      ? combineFiltersWithAnd([
          collection.filter.byProperty('content_type').notEqual('ghost'),
          collection.filter.byProperty('content_type').notEqual('agent'),
        ])
      : null;

    // Combine deleted filter, trust filter, internal exclusion, and search filters
    const combinedFilters = combineFiltersWithAnd([deletedFilter, trustFilter, internalExclusionFilter, searchFilters].filter(f => f !== null));

    // Build search options
    const searchOptions: any = {
      limit: limit,
      distance: 1 - minRelevance, // Convert relevance to distance
      returnMetadata: ['distance'],
    };

    // Add filters if present
    if (combinedFilters) {
      searchOptions.filters = combinedFilters;
    }

    // Perform semantic search using nearText
    const results = await collection.query.nearText(args.query, searchOptions);

    // Format memories with relevance scores
    const relevantMemories: RelevantMemory[] = results.objects.map((obj: any) => {
      const relevance = 1 - (obj.metadata?.distance ?? 0); // Convert distance to relevance
      const memory: RelevantMemory = {
        id: obj.uuid,
        ...obj.properties,
        relevance: Math.max(0, Math.min(1, relevance)), // Clamp to [0, 1]
      };

      // Remove context if not requested
      if (!includeContext) {
        delete memory.context;
        delete memory.location;
      }

      return memory;
    });

    // Sort by relevance (highest first)
    relevantMemories.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));

    logger.info('Query completed', {
      userId,
      query: args.query,
      results: relevantMemories.length,
    });

    // Format output based on requested format
    let formattedMemories: RelevantMemory[] | string;
    let contextSummary: string | undefined;

    if (format === 'compact') {
      // Compact format: text summary for easy LLM consumption
      const summaryParts = relevantMemories.map((mem, idx) => {
        const title = mem.title ? `"${mem.title}"` : `Memory ${idx + 1}`;
        const type = mem.content_type ? ` [${mem.content_type}]` : '';
        const relevancePercent = Math.round((mem.relevance ?? 0) * 100);
        const content = mem.content || '(no content)';
        const tags = mem.tags && mem.tags.length > 0 ? `\nTags: ${mem.tags.join(', ')}` : '';
        
        return `${idx + 1}. ${title}${type} (${relevancePercent}% relevant)\n${content}${tags}`;
      });

      formattedMemories = summaryParts.join('\n\n---\n\n');
      
      contextSummary = `Found ${relevantMemories.length} relevant memories for query: "${args.query}"`;
    } else {
      // Detailed format: full objects
      formattedMemories = relevantMemories;
      
      contextSummary = `Retrieved ${relevantMemories.length} memories with relevance >= ${Math.round(minRelevance * 100)}%`;
    }

    const result: QueryMemoryResult = {
      query: args.query,
      memories: formattedMemories,
      total: relevantMemories.length,
      min_relevance: minRelevance,
      context_summary: contextSummary,
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_query_memory',
      operation: 'query memories',
      userId,
      query: args.query,
      format: args.format,
    });
  }
}
