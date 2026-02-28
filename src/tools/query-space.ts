/**
 * remember_query_space tool
 * 
 * RAG-optimized natural language queries for shared spaces.
 * Similar to remember_query_memory but queries space collections.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SUPPORTED_SPACES } from '../types/space-memory.js';
import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';

export type ModerationFilter = 'approved' | 'pending' | 'rejected' | 'removed' | 'all';

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
      moderation_filter: {
        type: 'string',
        enum: ['approved', 'pending', 'rejected', 'removed', 'all'],
        description: 'Filter by moderation status. Default: "approved" (only shows approved/unmoderated). Non-approved filters require moderator permissions.',
        default: 'approved',
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
  moderation_filter?: ModerationFilter;
  include_comments?: boolean;
  limit?: number;
  format?: 'detailed' | 'compact';
}

/**
 * Handle remember_query_space tool execution
 */
export async function handleQuerySpace(
  args: QuerySpaceArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({
    tool: 'remember_query_space',
    userId,
    operation: 'query_spaces',
  });

  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    const { space } = createCoreServices(userId);
    const coreResult = await space.query(
      {
        question: args.question,
        spaces: args.spaces,
        content_type: args.content_type,
        tags: args.tags,
        min_weight: args.min_weight,
        date_from: args.date_from,
        date_to: args.date_to,
        moderation_filter: args.moderation_filter as any,
        include_comments: args.include_comments,
        limit: args.limit,
      },
      authContext as any
    );

    // Format results based on requested format
    const format = args.format || 'detailed';

    if (format === 'compact') {
      const summaries = coreResult.memories.map((mem: any, idx: number) => {
        return `${idx + 1}. ${mem.title || mem.content?.substring(0, 100) || 'Untitled'}`;
      });

      const result = {
        question: args.question,
        spaces_queried: coreResult.spaces_queried,
        format: 'compact',
        summary: summaries.join('\n'),
        count: coreResult.memories.length,
      };

      return JSON.stringify(result, null, 2);
    } else {
      const result = {
        question: args.question,
        spaces_queried: coreResult.spaces_queried,
        format: 'detailed',
        memories: coreResult.memories,
        total: coreResult.total,
      };

      debug.info('Tool completed successfully', {
        resultCount: coreResult.total,
        format: 'detailed',
      });

      return JSON.stringify(result, null, 2);
    }
  } catch (error) {
    debug.error('Tool failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return handleToolError(error, {
      toolName: 'remember_query_space',
      operation: 'query spaces',
      spaces: args.spaces,
      question: args.question,
    });
  }
}
