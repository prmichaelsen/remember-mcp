/**
 * remember_search_space tool
 * 
 * Search shared spaces to discover memories from other users.
 * Similar to remember_search_memory but searches space collections.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Filters } from 'weaviate-client';
import { getWeaviateClient } from '../weaviate/client.js';
import { ensureSpaceCollection, isValidSpaceId } from '../weaviate/space-schema.js';
import { SUPPORTED_SPACES } from '../types/space-memory.js';
import { handleToolError } from '../utils/error-handler.js';
import type { SearchFilters } from '../types/memory.js';

/**
 * Tool definition for remember_search_space
 */
export const searchSpaceTool: Tool = {
  name: 'remember_search_space',
  description: 'Search shared spaces to discover thoughts, ideas, and memories. Works like remember_search_memory but searches shared spaces instead of personal memories.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (semantic + keyword hybrid)',
      },
      space: {
        type: 'string',
        description: 'Which space to search',
        enum: SUPPORTED_SPACES,
        default: 'the_void',
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
    required: ['query', 'space'],
  },
};

interface SearchSpaceArgs {
  query: string;
  space: string;
  content_type?: string;
  tags?: string[];
  min_weight?: number;
  max_weight?: number;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

/**
 * Handle remember_search_space tool execution
 */
export async function handleSearchSpace(
  args: SearchSpaceArgs,
  userId: string  // May be used for private spaces in future
): Promise<string> {
  try {
    // Validate space ID
    if (!isValidSpaceId(args.space)) {
      return JSON.stringify(
        {
          success: false,
          error: 'Invalid space ID',
          message: `Space "${args.space}" is not supported. Supported spaces: ${SUPPORTED_SPACES.join(', ')}`,
        },
        null,
        2
      );
    }

    const weaviateClient = getWeaviateClient();
    const spaceCollection = await ensureSpaceCollection(weaviateClient, args.space);

    // Build filters for space search
    const filterList: any[] = [];

    // Filter by space_id
    filterList.push(spaceCollection.filter.byProperty('space_id').equal(args.space));

    // Filter by doc_type (space_memory)
    filterList.push(spaceCollection.filter.byProperty('doc_type').equal('space_memory'));

    // Apply content type filter
    if (args.content_type) {
      filterList.push(spaceCollection.filter.byProperty('type').equal(args.content_type));
    }

    // Apply tags filter
    if (args.tags && args.tags.length > 0) {
      args.tags.forEach(tag => {
        filterList.push(spaceCollection.filter.byProperty('tags').containsAny([tag]));
      });
    }

    // Apply weight filters
    if (args.min_weight !== undefined) {
      filterList.push(spaceCollection.filter.byProperty('weight').greaterOrEqual(args.min_weight));
    }

    if (args.max_weight !== undefined) {
      filterList.push(spaceCollection.filter.byProperty('weight').lessOrEqual(args.max_weight));
    }

    // Apply date filters (convert ISO strings to Date objects)
    if (args.date_from) {
      filterList.push(spaceCollection.filter.byProperty('created_at').greaterOrEqual(new Date(args.date_from)));
    }

    if (args.date_to) {
      filterList.push(spaceCollection.filter.byProperty('created_at').lessOrEqual(new Date(args.date_to)));
    }

    const whereFilter = filterList.length > 0 ? Filters.and(...filterList) : undefined;

    // Execute hybrid search
    const searchResults = await spaceCollection.query.hybrid(args.query, {
      limit: args.limit || 10,
      offset: args.offset || 0,
      ...(whereFilter && { where: whereFilter }),
    });

    // Format results
    const memories = searchResults.objects.map((obj) => ({
      id: obj.uuid,
      ...obj.properties,
      _score: obj.metadata?.score,
    }));

    const result = {
      space: args.space,
      query: args.query,
      memories,
      total: memories.length,
      offset: args.offset || 0,
      limit: args.limit || 10,
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'remember_search_space',
      operation: 'search space',
      space: args.space,
      query: args.query,
    });
  }
}
