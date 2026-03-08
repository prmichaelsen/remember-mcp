/**
 * remember_query_internal_memory tool
 * Wraps query_memory with auto-scoped content type and ghost source filters.
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { handleQueryMemory } from './query-memory.js';
import { buildInternalTags } from '../utils/internal-tags.js';

export const queryInternalMemoryTool = {
  name: 'remember_query_internal_memory',
  description: `Query internal memories (ghost or agent) using natural language (pure semantic search).

  Automatically scoped to the current session's content type and ghost source.`,
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

export interface QueryInternalMemoryArgs {
  query: string;
  limit?: number;
  min_relevance?: number;
}

export async function handleQueryInternalMemory(
  args: QueryInternalMemoryArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_query_internal_memory', userId, operation: 'query internal memories' });
  try {
    debug.info('Tool invoked');

    const ctx = authContext?.internalContext;
    if (!ctx) {
      return JSON.stringify({ error: 'Internal context required. X-Internal-Type header must be set.' });
    }

    // Build scope tags for ghost source isolation
    const allTags = buildInternalTags(authContext!);
    const scopeTags = allTags.filter(t => t !== 'ghost' && t !== 'agent');

    return await handleQueryMemory(
      {
        query: args.query,
        limit: args.limit,
        min_relevance: args.min_relevance,
        filters: {
          types: [ctx.type] as any,
          tags: scopeTags.length > 0 ? scopeTags : undefined,
        },
      },
      userId,
      authContext
    );
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_query_internal_memory',
      operation: 'query internal memories',
      userId,
    });
  }
}
