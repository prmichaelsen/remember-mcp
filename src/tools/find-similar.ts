/**
 * remember_find_similar tool
 * Find similar memories using vector similarity search
 */

import type { Memory, DeletedFilter } from '../types/memory.js';
import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';

/**
 * Tool definition for remember_find_similar
 */
export const findSimilarTool = {
  name: 'remember_find_similar',
  description: `Find memories similar to a given memory or text using vector similarity.
  
  Uses pure semantic similarity (vector distance) to find related memories.
  This is different from hybrid search - it finds memories with similar meaning,
  even if they don't share keywords.
  
  Examples:
  - "Find memories similar to this camping trip note"
  - "Show me memories related to this recipe"
  - "What other memories are like this meeting note?"
  `,
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: {
        type: 'string',
        description: 'ID of memory to find similar memories for (provide either memory_id or text)',
      },
      text: {
        type: 'string',
        description: 'Text to find similar memories for (provide either memory_id or text)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results. Default: 10',
        minimum: 1,
        maximum: 100,
        default: 10,
      },
      min_similarity: {
        type: 'number',
        description: 'Minimum similarity score (0-1). Default: 0.7',
        minimum: 0,
        maximum: 1,
        default: 0.7,
      },
      include_relationships: {
        type: 'boolean',
        description: 'Include relationships in results. Default: false',
        default: false,
      },
      deleted_filter: {
        type: 'string',
        enum: ['exclude', 'include', 'only'],
        default: 'exclude',
        description: 'Filter deleted memories: "exclude" (default, hide deleted), "include" (show all), "only" (show only deleted)',
      },
    },
  },
};

/**
 * Find similar arguments
 */
export interface FindSimilarArgs {
  memory_id?: string;
  text?: string;
  limit?: number;
  min_similarity?: number;
  include_relationships?: boolean;
  deleted_filter?: DeletedFilter;
}

/**
 * Similar memory result
 */
export interface SimilarMemory extends Partial<Memory> {
  similarity: number; // 0-1 similarity score
}

/**
 * Find similar result
 */
export interface FindSimilarResult {
  query: {
    memory_id?: string;
    text?: string;
  };
  similar_memories: SimilarMemory[];
  total: number;
  min_similarity: number;
}

/**
 * Handle remember_find_similar tool
 */
export async function handleFindSimilar(
  args: FindSimilarArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_find_similar', userId, operation: 'find similar' });
  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    const { memory } = createCoreServices(userId);
    const coreResult = await memory.findSimilar({
      memory_id: args.memory_id,
      text: args.text,
      limit: args.limit,
      min_similarity: args.min_similarity,
      include_relationships: args.include_relationships,
      deleted_filter: args.deleted_filter,
    });

    // Post-filter internal content types (core doesn't exclude ghost/agent)
    const filteredMemories = coreResult.similar_memories.filter(
      (m: any) => m.content_type !== 'ghost' && m.content_type !== 'agent'
    );

    const result: FindSimilarResult = {
      query: {
        memory_id: args.memory_id,
        text: args.text,
      },
      similar_memories: filteredMemories as unknown as SimilarMemory[],
      total: filteredMemories.length,
      min_similarity: args.min_similarity ?? 0.7,
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_find_similar',
      operation: 'find similar memories',
      userId,
      memoryId: args.memory_id,
      searchText: args.text,
      limit: args.limit,
    });
  }
}
