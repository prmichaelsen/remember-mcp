/**
 * remember_create_internal_memory tool
 * Creates a ghost or agent memory based on the current session's InternalContext.
 * Content type and tags are derived from platform HTTP headers, not tool args.
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';
import { buildInternalTags } from '../utils/internal-tags.js';

export const createInternalMemoryTool = {
  name: 'remember_create_internal_memory',
  description: `Create an internal memory (ghost observation or agent note) based on the current session context.

  In ghost mode: creates a ghost memory tracking conversation observations, impressions,
  and insights. Automatically tagged with ghost source isolation tags.

  In agent mode: creates an agent memory for AI observations and notes.
  Automatically tagged with agent tags.

  Content type and tags are determined by the platform session context.
  This tool errors if no internal session context is present.`,
  inputSchema: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'Memory content' },
      title: { type: 'string', description: 'Optional title' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Additional tags (internal tags added automatically)' },
      weight: { type: 'number', minimum: 0, maximum: 1, description: 'Significance (0-1)' },
      trust: { type: 'number', minimum: 0, maximum: 1, description: 'Trust level (0-1)' },
      feel_salience: { type: 'number', minimum: 0, maximum: 1 },
      feel_social_weight: { type: 'number', minimum: 0, maximum: 1 },
      feel_narrative_importance: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['content'],
  },
};

export interface CreateInternalMemoryArgs {
  content: string;
  title?: string;
  tags?: string[];
  weight?: number;
  trust?: number;
  [key: string]: any;
}

export async function handleCreateInternalMemory(
  args: CreateInternalMemoryArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_create_internal_memory', userId, operation: 'create internal memory' });
  try {
    debug.info('Tool invoked');

    const ctx = authContext?.internalContext;
    if (!ctx) {
      return JSON.stringify({ error: 'Internal context required. X-Internal-Type header must be set.' });
    }

    const { memory } = createCoreServices(userId);

    // Build tags from internal context (ghost source isolation or agent)
    const internalTags = buildInternalTags(authContext!);
    const userTags = args.tags ?? [];
    const mergedTags = [...new Set([...internalTags, ...userTags])];

    // Extract feel_* fields
    const feelFields: Record<string, number> = {};
    for (const [key, value] of Object.entries(args)) {
      if (key.startsWith('feel_') && typeof value === 'number') {
        feelFields[key] = value;
      }
    }

    const result = await memory.create({
      content: args.content,
      title: args.title,
      type: ctx.type as any,
      weight: args.weight,
      trust: args.trust,
      tags: mergedTags,
      context_summary: `Internal memory created via MCP (${ctx.type})`,
      ...feelFields,
    } as any);

    return JSON.stringify({
      memory_id: result.memory_id,
      created_at: result.created_at,
      content_type: ctx.type,
      tags: mergedTags,
      message: `${ctx.type} memory created successfully with ID: ${result.memory_id}`,
    }, null, 2);
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_create_internal_memory',
      operation: 'create internal memory',
      userId,
    });
  }
}
