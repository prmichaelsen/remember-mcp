/**
 * remember_find_similar tool
 * Find similar memories using vector similarity search
 */

import type { Memory, DeletedFilter } from '../types/memory.js';
import { getMemoryCollection } from '../weaviate/schema.js';
import { logger } from '../utils/logger.js';
import { handleToolError } from '../utils/error-handler.js';
import { buildDeletedFilter } from '../utils/weaviate-filters.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';

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
    logger.info('Finding similar memories', { userId, memoryId: args.memory_id, hasText: !!args.text });

    // Validate input
    if (!args.memory_id && !args.text) {
      throw new Error('Either memory_id or text must be provided');
    }

    if (args.memory_id && args.text) {
      throw new Error('Provide either memory_id or text, not both');
    }

    const collection = getMemoryCollection(userId);
    const limit = args.limit ?? 10;
    const minSimilarity = args.min_similarity ?? 0.7;

    // Build deleted filter
    const deletedFilter = buildDeletedFilter(collection, args.deleted_filter || 'exclude');

    let results: any;

    if (args.memory_id) {
      // Find similar to existing memory
      // First get the memory to verify ownership
      const memory = await collection.query.fetchObjectById(args.memory_id, {
        returnProperties: ['user_id', 'doc_type', 'content'],
      });

      if (!memory) {
        throw new Error(`Memory not found: ${args.memory_id}`);
      }

      // Verify ownership
      if (memory.properties.user_id !== userId) {
        throw new Error('Unauthorized: Cannot access another user\'s memory');
      }

      // Verify it's a memory
      if (memory.properties.doc_type !== 'memory') {
        throw new Error('Can only find similar memories for memory documents, not relationships');
      }

      // Find similar using nearObject
      const searchOptions: any = {
        limit: limit + 1, // +1 to exclude the source memory itself
        distance: 1 - minSimilarity, // Convert similarity to distance
        returnMetadata: ['distance'],
      };

      // Add deleted filter if present
      if (deletedFilter) {
        searchOptions.filters = deletedFilter;
      }

      results = await collection.query.nearObject(args.memory_id, searchOptions);

      // Filter out the source memory
      results.objects = results.objects.filter((obj: any) => obj.uuid !== args.memory_id);
    } else {
      // Find similar to text
      const searchOptions: any = {
        limit: limit,
        distance: 1 - minSimilarity,
        returnMetadata: ['distance'],
      };

      // Add deleted filter if present
      if (deletedFilter) {
        searchOptions.filters = deletedFilter;
      }

      results = await collection.query.nearText(args.text!, searchOptions);
    }

    // Filter to only memories (not relationships) unless requested
    if (!args.include_relationships) {
      results.objects = results.objects.filter(
        (obj: any) => obj.properties.doc_type === 'memory'
      );
    }

    // Format results with similarity scores
    const similarMemories: SimilarMemory[] = results.objects.map((obj: any) => {
      const similarity = 1 - (obj.metadata?.distance ?? 0); // Convert distance back to similarity
      return {
        id: obj.uuid,
        ...obj.properties,
        similarity: Math.max(0, Math.min(1, similarity)), // Clamp to [0, 1]
      };
    });

    // Sort by similarity (highest first)
    similarMemories.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

    // Limit results
    const limitedResults = similarMemories.slice(0, limit);

    logger.info('Similar memories found', {
      userId,
      query: args.memory_id || args.text,
      results: limitedResults.length,
    });

    const result: FindSimilarResult = {
      query: {
        memory_id: args.memory_id,
        text: args.text,
      },
      similar_memories: limitedResults,
      total: limitedResults.length,
      min_similarity: minSimilarity,
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
