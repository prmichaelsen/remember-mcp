/**
 * remember_query_space tool
 * 
 * RAG-optimized natural language queries for shared spaces.
 * Similar to remember_query_memory but queries space collections.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Filters } from 'weaviate-client';
import { getWeaviateClient } from '../weaviate/client.js';
import { ensurePublicCollection, isValidSpaceId } from '../weaviate/space-schema.js';
import { SUPPORTED_SPACES } from '../types/space-memory.js';
import { handleToolError } from '../utils/error-handler.js';

/**
 * Tool definition for remember_query_space
 */
export const querySpaceTool: Tool = {
  name: 'remember_query_space',
  description: `Ask natural language questions about memories in shared spaces. By default, excludes comments to focus on original content. Set include_comments: true to include discussions in answers.

⚠️ **CRITICAL - CONTENT TYPE FILTERING**: Do NOT add content_type filter unless the user explicitly requests filtering by type.
- ✅ CORRECT: User says "what's in The Void about hiking?" → { spaces: ["the_void"], question: "hiking" }
- ❌ WRONG: User says "what's in The Void about hiking?" → { spaces: ["the_void"], question: "hiking", content_type: "note" }
- ✅ CORRECT: User says "what notes are in The Void about hiking?" → { spaces: ["the_void"], question: "hiking", content_type: "note" }

Let the query algorithm find ALL relevant memories regardless of type unless explicitly requested.`,
  inputSchema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'Natural language question',
      },
      spaces: {
        type: 'array',
        items: {
          type: 'string',
          enum: SUPPORTED_SPACES,
        },
        description: 'Spaces to query (e.g., ["the_void", "dogs"])',
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
      include_comments: {
        type: 'boolean',
        description: 'Include comments in query results (default: false)',
        default: false,
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
    required: ['question', 'spaces'],
  },
};

interface QuerySpaceArgs {
  question: string;
  spaces: string[];
  content_type?: string;
  tags?: string[];
  min_weight?: number;
  date_from?: string;
  date_to?: string;
  include_comments?: boolean;
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
    // Validate all space IDs
    const invalidSpaces = args.spaces.filter(s => !isValidSpaceId(s));
    if (invalidSpaces.length > 0) {
      return JSON.stringify(
        {
          success: false,
          error: 'Invalid space IDs',
          message: `Invalid spaces: ${invalidSpaces.join(', ')}. Supported spaces: ${SUPPORTED_SPACES.join(', ')}`,
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
          message: 'Must specify at least one space to query',
        },
        null,
        2
      );
    }

    const weaviateClient = getWeaviateClient();
    const publicCollection = await ensurePublicCollection(weaviateClient);

    // Build filters
    const filterList: any[] = [];

    // Filter by spaces array (memory must be in at least one requested space)
    filterList.push(publicCollection.filter.byProperty('spaces').containsAny(args.spaces));

    // Filter by doc_type (memory) - space_memory concept was removed
    filterList.push(publicCollection.filter.byProperty('doc_type').equal('memory'));

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

    // Apply weight filter
    if (args.min_weight !== undefined) {
      filterList.push(publicCollection.filter.byProperty('weight').greaterOrEqual(args.min_weight));
    }

    // Apply date filters
    if (args.date_from) {
      filterList.push(publicCollection.filter.byProperty('created_at').greaterOrEqual(new Date(args.date_from)));
    }

    if (args.date_to) {
      filterList.push(publicCollection.filter.byProperty('created_at').lessOrEqual(new Date(args.date_to)));
    }

    const whereFilter = filterList.length > 0 ? Filters.and(...filterList) : undefined;

    // Execute semantic search using nearText
    const searchResults = await publicCollection.query.nearText(args.question, {
      limit: args.limit || 10,
      ...(whereFilter && { where: whereFilter }),
    });

    // Format results based on requested format
    const format = args.format || 'detailed';

    if (format === 'compact') {
      // Compact format: text summary for LLM context
      const summaries = searchResults.objects.map((obj: any, idx: number) => {
        const props = obj.properties;
        return `${idx + 1}. ${props.title || props.content?.substring(0, 100) || 'Untitled'}`;
      });

      const result = {
        question: args.question,
        spaces_queried: args.spaces,
        format: 'compact',
        summary: summaries.join('\n'),
        count: searchResults.objects.length,
      };

      return JSON.stringify(result, null, 2);
    } else {
      // Detailed format: full objects
      const memories = searchResults.objects.map((obj: any) => ({
        id: obj.uuid,
        ...obj.properties,
        _distance: obj.metadata?.distance,
      }));

      const result = {
        question: args.question,
        spaces_queried: args.spaces,
        format: 'detailed',
        memories,
        total: memories.length,
      };

      return JSON.stringify(result, null, 2);
    }
  } catch (error) {
    return handleToolError(error, {
      toolName: 'remember_query_space',
      operation: 'query spaces',
      spaces: args.spaces,
      question: args.question,
    });
  }
}
