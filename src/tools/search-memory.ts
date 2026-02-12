/**
 * remember_search_memory tool
 * Search memories AND relationships using hybrid semantic + keyword search
 */

import type { Memory, Relationship, SearchOptions, SearchResult, SearchFilters } from '../types/memory.js';
import { getMemoryCollection } from '../weaviate/schema.js';
import { logger } from '../utils/logger.js';
import { buildCombinedSearchFilters, buildMemoryOnlyFilters } from '../utils/weaviate-filters.js';

/**
 * Tool definition for remember_search_memory
 */
export const searchMemoryTool = {
  name: 'remember_search_memory',
  description: `Search memories AND relationships using hybrid semantic and keyword search.
  
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
    },
    required: ['query'],
  },
};

/**
 * Handle remember_search_memory tool
 */
export async function handleSearchMemory(
  args: SearchOptions,
  userId: string
): Promise<string> {
  try {
    // Validate query is not empty
    if (!args.query || args.query.trim() === '') {
      throw new Error('Query cannot be empty');
    }

    const includeRelationships = args.include_relationships !== false; // Default true
    
    logger.info('Searching memories and relationships', {
      userId,
      query: args.query,
      includeRelationships
    });

    const collection = getMemoryCollection(userId);
    const alpha = args.alpha ?? 0.7;
    const limit = args.limit ?? 10;
    const offset = args.offset ?? 0;

    // Build filters using v3 API
    // Use OR logic to search both memories and relationships
    // const filters = includeRelationships
    //   ? buildCombinedSearchFilters(collection, args.filters)
    //   : buildMemoryOnlyFilters(collection, args.filters);

    // Build search options
    const searchOptions: any = {
      alpha: alpha,
      limit: limit + offset, // Get extra for offset
    };

    // Add filters if present
    // if (filters) {
    //   searchOptions.filters = filters;
    // }

    // Log the query for debugging
    logger.info('Weaviate query', {
      query: args.query,
      searchOptions: JSON.stringify(searchOptions, null, 2),
      // hasFilters: !!filters,
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to search memories:', { error: errorMessage, userId, query: args.query });
    throw new Error(`Failed to search memories: ${errorMessage}`);
  }
}
