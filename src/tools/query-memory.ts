/**
 * remember_query_memory tool
 * RAG (Retrieval-Augmented Generation) queries with natural language
 */

import type { Memory, SearchFilters } from '../types/memory.js';
import { getMemoryCollection } from '../weaviate/schema.js';
import { logger } from '../utils/logger.js';
import { buildCombinedSearchFilters } from '../utils/weaviate-filters.js';

/**
 * Tool definition for remember_query_memory
 */
export const queryMemoryTool = {
  name: 'remember_query_memory',
  description: `Query memories using natural language for RAG (Retrieval-Augmented Generation).
  
  This tool is optimized for LLM context retrieval. It returns relevant memories
  with their full content and context, formatted for easy consumption by LLMs.
  
  Use this when you need to:
  - Answer questions based on stored memories
  - Provide context for conversations
  - Retrieve information for decision-making
  - Build responses using past knowledge
  
  Examples:
  - "What do I know about camping?"
  - "Tell me about the recipes I've saved"
  - "What meetings did I have last week?"
  - "What are my project goals?"
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
}

/**
 * Memory with relevance score
 */
export interface RelevantMemory extends Partial<Memory> {
  relevance: number; // 0-1 relevance score
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
  userId: string
): Promise<string> {
  try {
    // Validate query is not empty
    if (!args.query || args.query.trim() === '') {
      throw new Error('Query cannot be empty');
    }

    logger.info('Querying memories', { userId, query: args.query });

    const collection = getMemoryCollection(userId);
    const limit = args.limit ?? 5;
    const minRelevance = args.min_relevance ?? 0.6;
    const includeContext = args.include_context ?? true;
    const format = args.format ?? 'detailed';

    // Build filters using v3 API - search both memories and relationships
    const filters = buildCombinedSearchFilters(collection, args.filters);

    // Build search options
    const searchOptions: any = {
      limit: limit,
      distance: 1 - minRelevance, // Convert relevance to distance
      returnMetadata: ['distance'],
    };

    // Add filters if present
    if (filters) {
      searchOptions.filters = filters;
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
        const type = mem.type ? ` [${mem.type}]` : '';
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
    logger.error('Failed to query memories:', error);
    throw new Error(`Failed to query memories: ${error instanceof Error ? error.message : String(error)}`);
  }
}
