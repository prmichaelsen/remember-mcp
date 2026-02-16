/**
 * remember_query_space tool
 * 
 * RAG-optimized natural language queries for shared spaces.
 * Similar to remember_query_memory but queries space collections.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Filters } from 'weaviate-client';
import { getWeaviateClient } from '../weaviate/client.js';
import { ensureSpaceCollection, isValidSpaceId } from '../weaviate/space-schema.js';
import { SUPPORTED_SPACES } from '../types/space-memory.js';
import { handleToolError } from '../utils/error-handler.js';

/**
 * Tool definition for remember_query_space
 */
export const querySpaceTool: Tool = {
  name: 'remember_query_space',
  description: 'Ask natural language questions about memories in shared spaces. Works like remember_query_memory but queries shared spaces.',
  inputSchema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'Natural language question',
      },
      space: {
        type: 'string',
        description: 'Which space to query',
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
        description: 'Filter by tags',
      },
      min_weight: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Minimum weight/significance (0-1)',
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
      format: {
        type: 'string',
        enum: ['detailed', 'compact'],
        default: 'detailed',
        description: 'Output format: detailed (full objects) or compact (text summary)',
      },
    },
    required: ['question', 'space'],
  },
};

interface QuerySpaceArgs {
  question: string;
  space: string;
  content_type?: string;
  tags?: string[];
  min_weight?: number;
  date_from?: string;
  date_to?: string;
  limit?: number;
  format?: 'detailed' | 'compact';
}

/**
 * Handle remember_query_space tool execution
 */
export async function handleQuerySpace(
  args: QuerySpaceArgs,
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

    // Build filters
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

    // Apply weight filter
    if (args.min_weight !== undefined) {
      filterList.push(spaceCollection.filter.byProperty('weight').greaterOrEqual(args.min_weight));
    }

    // Apply date filters
    if (args.date_from) {
      filterList.push(spaceCollection.filter.byProperty('created_at').greaterOrEqual(new Date(args.date_from)));
    }

    if (args.date_to) {
      filterList.push(spaceCollection.filter.byProperty('created_at').lessOrEqual(new Date(args.date_to)));
    }

    const whereFilter = filterList.length > 0 ? Filters.and(...filterList) : undefined;

    // Execute semantic search using nearText
    const searchResults = await spaceCollection.query.nearText(args.question, {
      limit: args.limit || 10,
      ...(whereFilter && { where: whereFilter }),
    });

    // Format results based on requested format
    const format = args.format || 'detailed';

    if (format === 'compact') {
      // Compact format: text summary for LLM context
      const summaries = searchResults.objects.map((obj, idx) => {
        const props = obj.properties;
        return `${idx + 1}. ${props.title || props.content?.substring(0, 100) || 'Untitled'}`;
      });

      const result = {
        question: args.question,
        space: args.space,
        format: 'compact',
        summary: summaries.join('\n'),
        count: searchResults.objects.length,
      };

      return JSON.stringify(result, null, 2);
    } else {
      // Detailed format: full objects
      const memories = searchResults.objects.map((obj) => ({
        id: obj.uuid,
        ...obj.properties,
        _distance: obj.metadata?.distance,
      }));

      const result = {
        question: args.question,
        space: args.space,
        format: 'detailed',
        memories,
        total: memories.length,
      };

      return JSON.stringify(result, null, 2);
    }
  } catch (error) {
    handleToolError(error, {
      toolName: 'remember_query_space',
      operation: 'query space',
      space: args.space,
      question: args.question,
    });
  }
}
