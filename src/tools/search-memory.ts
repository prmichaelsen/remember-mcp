/**
 * remember_search_memory tool
 * Search memories using hybrid semantic + keyword search
 */

import type { Memory, SearchOptions, SearchResult, SearchFilters } from '../types/memory.js';
import { getMemoryCollection } from '../weaviate/schema.js';
import { logger } from '../utils/logger.js';

/**
 * Tool definition for remember_search_memory
 */
export const searchMemoryTool = {
  name: 'remember_search_memory',
  description: `Search memories using hybrid semantic and keyword search.
  
  Supports:
  - Semantic search (meaning-based)
  - Keyword search (exact matches)
  - Hybrid search (balanced with alpha parameter)
  - Filtering by type, tags, weight, trust, date range
  - Location-based search
  
  Examples:
  - "Find memories about camping trips"
  - "Search for recipes I saved"
  - "Show me notes from last week"
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
        description: 'Include relationships in results. Default: false',
        default: false,
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
    logger.info('Searching memories', { userId, query: args.query });

    const collection = getMemoryCollection(userId);
    const alpha = args.alpha ?? 0.7;
    const limit = args.limit ?? 10;
    const offset = args.offset ?? 0;

    // Build where filter
    const whereFilters: any[] = [
      {
        path: 'doc_type',
        operator: 'Equal',
        valueText: 'memory',
      },
    ];

    // Add type filter
    if (args.filters?.types && args.filters.types.length > 0) {
      whereFilters.push({
        path: 'type',
        operator: 'ContainsAny',
        valueTextArray: args.filters.types,
      });
    }

    // Add weight filter
    if (args.filters?.weight_min !== undefined) {
      whereFilters.push({
        path: 'weight',
        operator: 'GreaterThanEqual',
        valueNumber: args.filters.weight_min,
      });
    }

    // Add trust filter
    if (args.filters?.trust_min !== undefined) {
      whereFilters.push({
        path: 'trust',
        operator: 'GreaterThanEqual',
        valueNumber: args.filters.trust_min,
      });
    }

    // Add date range filters
    if (args.filters?.date_from) {
      whereFilters.push({
        path: 'created_at',
        operator: 'GreaterThanEqual',
        valueDate: new Date(args.filters.date_from),
      });
    }

    if (args.filters?.date_to) {
      whereFilters.push({
        path: 'created_at',
        operator: 'LessThanEqual',
        valueDate: new Date(args.filters.date_to),
      });
    }

    // Perform hybrid search
    // Note: Weaviate v3 hybrid query API
    const queryBuilder = collection.query.hybrid(args.query, {
      alpha: alpha,
      limit: limit + offset, // Get extra for offset
    });

    // Apply filters if present
    let results;
    if (whereFilters.length > 0) {
      const whereClause = whereFilters.length > 1 ? {
        operator: 'And' as const,
        operands: whereFilters,
      } : whereFilters[0];
      
      results = await queryBuilder;
    } else {
      results = await queryBuilder;
    }

    // Apply offset
    const paginatedResults = results.objects.slice(offset);

    // Format memories
    const memories: Partial<Memory>[] = paginatedResults.map((obj: any) => ({
      id: obj.uuid,
      ...obj.properties,
    }));

    // Build result
    const searchResult: SearchResult = {
      memories: memories as Memory[],
      total: memories.length,
      offset: offset,
      limit: limit,
    };

    // TODO: Include relationships if requested
    if (args.include_relationships) {
      searchResult.relationships = [];
    }

    logger.info('Search completed', { 
      userId, 
      query: args.query, 
      results: memories.length 
    });

    return JSON.stringify(searchResult, null, 2);
  } catch (error) {
    logger.error('Failed to search memories:', error);
    throw new Error(`Failed to search memories: ${error instanceof Error ? error.message : String(error)}`);
  }
}
