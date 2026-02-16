/**
 * remember_search_space tool
 * 
 * Search shared spaces to discover memories from other users.
 * Similar to remember_search_memory but searches space collections.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Filters } from 'weaviate-client';
import { getWeaviateClient } from '../weaviate/client.js';
import { ensurePublicCollection, isValidSpaceId } from '../weaviate/space-schema.js';
import { SUPPORTED_SPACES } from '../types/space-memory.js';
import { handleToolError } from '../utils/error-handler.js';
import type { SearchFilters } from '../types/memory.js';

/**
 * Tool definition for remember_search_space
 */
export const searchSpaceTool: Tool = {
  name: 'remember_search_space',
  description: 'Search one or more shared spaces to discover thoughts, ideas, and memories. By default, excludes comments to keep discovery clean. Set include_comments: true to include threaded discussions. Can search multiple spaces in a single query.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (semantic + keyword hybrid)',
      },
      spaces: {
        type: 'array',
        items: {
          type: 'string',
          enum: SUPPORTED_SPACES,
        },
        description: 'Spaces to search (e.g., ["the_void", "dogs"]). Can search multiple spaces at once.',
        minItems: 1,
        default: ['the_void'],
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
    required: ['query', 'spaces'],
  },
};

interface SearchSpaceArgs {
  query: string;
  spaces: string[];
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
 * Handle remember_search_space tool execution
 */
export async function handleSearchSpace(
  args: SearchSpaceArgs,
  userId: string  // May be used for private spaces in future
): Promise<string> {
  try {
    // Validate all space IDs
    const invalidSpaces = args.spaces.filter(s => !isValidSpaceId(s));
    if (invalidSpaces.length > 0) {
      return JSON.stringify(
        {
          success: false,
          error: 'Invalid space IDs',
          message: `Invalid spaces: ${invalidSpaces.join(', ')}. Supported spaces: ${SUPPORTED_SPACES.join(', ')}`,
          context: {
            invalid_spaces: invalidSpaces,
            provided_spaces: args.spaces,
            supported_spaces: SUPPORTED_SPACES,
          },
        },
        null,
        2
      );
    }
    
    // Validate not empty
    if (args.spaces.length === 0) {
      return JSON.stringify(
        {
          success: false,
          error: 'Empty spaces array',
          message: 'Must specify at least one space to search',
        },
        null,
        2
      );
    }

    const weaviateClient = getWeaviateClient();
    const publicCollection = await ensurePublicCollection(weaviateClient);

    // Build filters for space search
    const filterList: any[] = [];

    // Filter by spaces array (memory must be in at least one requested space)
    filterList.push(publicCollection.filter.byProperty('spaces').containsAny(args.spaces));

    // Filter by doc_type (space_memory)
    filterList.push(publicCollection.filter.byProperty('doc_type').equal('space_memory'));

    // Apply content type filter
    if (args.content_type) {
      filterList.push(publicCollection.filter.byProperty('type').equal(args.content_type));
    }

    // Exclude comments by default (unless explicitly included)
    if (!args.include_comments && !args.content_type) {
      // Only exclude comments if not filtering by content_type
      // (if content_type is set, user has explicit control)
      filterList.push(publicCollection.filter.byProperty('type').notEqual('comment'));
    }

    // Apply tags filter
    if (args.tags && args.tags.length > 0) {
      args.tags.forEach(tag => {
        filterList.push(publicCollection.filter.byProperty('tags').containsAny([tag]));
      });
    }

    // Apply weight filters
    if (args.min_weight !== undefined) {
      filterList.push(publicCollection.filter.byProperty('weight').greaterOrEqual(args.min_weight));
    }

    if (args.max_weight !== undefined) {
      filterList.push(publicCollection.filter.byProperty('weight').lessOrEqual(args.max_weight));
    }

    // Apply date filters (convert ISO strings to Date objects)
    if (args.date_from) {
      filterList.push(publicCollection.filter.byProperty('created_at').greaterOrEqual(new Date(args.date_from)));
    }

    if (args.date_to) {
      filterList.push(publicCollection.filter.byProperty('created_at').lessOrEqual(new Date(args.date_to)));
    }

    const whereFilter = filterList.length > 0 ? Filters.and(...filterList) : undefined;

    // Execute hybrid search
    const searchResults = await publicCollection.query.hybrid(args.query, {
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
      spaces_searched: args.spaces,
      query: args.query,
      memories,
      total: memories.length,
      offset: args.offset || 0,
      limit: args.limit || 10,
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    return handleToolError(error, {
      toolName: 'remember_search_space',
      operation: 'search spaces',
      spaces: args.spaces,
      query: args.query,
    });
  }
}
