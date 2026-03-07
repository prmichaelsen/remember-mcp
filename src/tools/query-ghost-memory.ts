/**
 * remember_query_ghost_memory tool
 * Wraps query_memory with hardcoded ghost type filter
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { handleQueryMemory } from './query-memory.js';

export const queryGhostMemoryTool = {
  name: 'remember_query_ghost_memory',
  description: `Query ghost memories using natural language (pure semantic search).
  Automatically filters to content_type: ghost.`,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural language question' },
      limit: { type: 'number', description: 'Max results. Default: 5' },
      min_relevance: { type: 'number', description: 'Minimum relevance score. Default: 0.6' },
    },
    required: ['query'],
  },
};

export interface QueryGhostMemoryArgs {
  query: string;
  limit?: number;
  min_relevance?: number;
}

export async function handleQueryGhostMemory(
  args: QueryGhostMemoryArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_query_ghost_memory', userId, operation: 'query ghost memories' });
  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    // Delegate to query_memory with ghost type filter hardcoded
    return await handleQueryMemory(
      {
        query: args.query,
        limit: args.limit,
        min_relevance: args.min_relevance,
        filters: {
          types: ['ghost'] as any,
        },
      },
      userId,
      authContext
    );
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_query_ghost_memory',
      operation: 'query ghost memories',
      userId,
    });
  }
}
