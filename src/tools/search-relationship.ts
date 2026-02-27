/**
 * remember_search_relationship tool
 * Search relationships by observation text or type
 */

import { Filters } from 'weaviate-client';
import type { Relationship, DeletedFilter } from '../types/memory.js';
import { getMemoryCollection } from '../weaviate/schema.js';
import { logger } from '../utils/logger.js';
import { handleToolError } from '../utils/error-handler.js';
import { buildDeletedFilter, combineFiltersWithAnd } from '../utils/weaviate-filters.js';
import type { AuthContext } from '../types/auth.js';

/**
 * Tool definition for remember_search_relationship
 */
export const searchRelationshipTool = {
  name: 'remember_search_relationship',
  description: `Search relationships by observation text or relationship type.
  
  Uses semantic search on relationship observations to find connections.
  Can filter by relationship type, strength, and tags.
  Returns relationships with their connected memory IDs.
  
  Examples:
  - "Find relationships about inspiration"
  - "Search for contradicting relationships"
  - "Show me all 'caused_by' relationships"
  `,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (semantic search on observation field)',
      },
      relationship_types: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by relationship types (e.g., ["inspired_by", "caused_by"])',
      },
      strength_min: {
        type: 'number',
        description: 'Minimum strength (0-1)',
        minimum: 0,
        maximum: 1,
      },
      confidence_min: {
        type: 'number',
        description: 'Minimum confidence (0-1)',
        minimum: 0,
        maximum: 1,
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by tags',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 10)',
        minimum: 1,
        maximum: 100,
      },
      offset: {
        type: 'number',
        description: 'Offset for pagination (default: 0)',
        minimum: 0,
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
 * Search relationship arguments
 */
export interface SearchRelationshipArgs {
  query: string;
  relationship_types?: string[];
  strength_min?: number;
  confidence_min?: number;
  tags?: string[];
  limit?: number;
  offset?: number;
  deleted_filter?: DeletedFilter;
}

/**
 * Search relationship result
 */
export interface SearchRelationshipResult {
  relationships: Relationship[];
  total: number;
  offset: number;
  limit: number;
  message: string;
}

/**
 * Handle remember_search_relationship tool
 */
export async function handleSearchRelationship(
  args: SearchRelationshipArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  try {
    logger.info('Searching relationships', {
      userId,
      query: args.query,
      types: args.relationship_types
    });

    const collection = getMemoryCollection(userId);
    const limit = args.limit ?? 10;
    const offset = args.offset ?? 0;

    // Build deleted filter
    const deletedFilter = buildDeletedFilter(collection, args.deleted_filter || 'exclude');

    // Build filters using Weaviate v3 API
    const filterList: any[] = [];

    // Add deleted filter if present
    if (deletedFilter) {
      filterList.push(deletedFilter);
    }

    // Always filter by doc_type = 'relationship'
    filterList.push(
      collection.filter.byProperty('doc_type').equal('relationship')
    );

    // Add relationship type filter
    if (args.relationship_types && args.relationship_types.length > 0) {
      if (args.relationship_types.length === 1) {
        filterList.push(
          collection.filter.byProperty('relationship_type').equal(args.relationship_types[0])
        );
      } else {
        // Multiple types: use OR logic
        const typeFilters = args.relationship_types.map(type =>
          collection.filter.byProperty('relationship_type').equal(type)
        );
        filterList.push(Filters.or(...typeFilters));
      }
    }

    // Add strength filter
    if (args.strength_min !== undefined) {
      filterList.push(
        collection.filter.byProperty('strength').greaterOrEqual(args.strength_min)
      );
    }

    // Add confidence filter
    if (args.confidence_min !== undefined) {
      filterList.push(
        collection.filter.byProperty('confidence').greaterOrEqual(args.confidence_min)
      );
    }

    // Add tags filter
    if (args.tags && args.tags.length > 0) {
      filterList.push(
        collection.filter.byProperty('tags').containsAny(args.tags)
      );
    }

    // Combine all filters with AND logic using the helper
    const combinedFilters = combineFiltersWithAnd(filterList);

    // Build search options
    const searchOptions: any = {
      alpha: 1.0, // Pure semantic search for relationships
      limit: limit + offset, // Get extra for offset
    };

    // Add filters
    if (combinedFilters) {
      searchOptions.filters = combinedFilters;
    }

    // Perform hybrid search (semantic search on observation field)
    const results = await collection.query.hybrid(args.query, searchOptions);

    // Apply offset manually (Weaviate v4 doesn't have built-in offset for nearText)
    const paginatedResults = results.objects.slice(offset, offset + limit);

    // Map results to Relationship type
    const relationships: Relationship[] = paginatedResults.map((obj: any) => ({
      id: obj.uuid,
      user_id: obj.properties.user_id,
      doc_type: 'relationship',
      memory_ids: obj.properties.related_memory_ids || [],
      relationship_type: obj.properties.relationship_type,
      observation: obj.properties.observation,
      strength: obj.properties.strength,
      confidence: obj.properties.confidence,
      context: obj.properties.context || {
        timestamp: obj.properties.created_at,
        source: { type: 'api', platform: 'mcp' },
      },
      created_at: obj.properties.created_at,
      updated_at: obj.properties.updated_at,
      version: obj.properties.version,
      tags: obj.properties.tags || [],
    }));

    logger.info('Relationship search completed', { 
      userId, 
      found: relationships.length,
      total: results.objects.length
    });

    const result: SearchRelationshipResult = {
      relationships,
      total: results.objects.length,
      offset,
      limit,
      message: `Found ${relationships.length} relationship(s) matching query "${args.query}"`,
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'remember_search_relationship',
      operation: 'search relationships',
      userId,
      query: args.query,
      limit: args.limit,
    });
  }
}
