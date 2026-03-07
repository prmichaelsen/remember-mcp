/**
 * remember_create_ghost_memory tool
 * Creates a ghost memory with hardcoded content_type and ghost-specific tags
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';

export const createGhostMemoryTool = {
  name: 'remember_create_ghost_memory',
  description: `Create a ghost memory (cross-user interaction record).

  Ghost memories track what happened during ghost conversations — observations,
  impressions, and insights about the accessor. Automatically sets content_type
  to 'ghost' and adds ghost-specific tags.

  Ghost memories are excluded from default searches. They are only visible when
  explicitly searching with content_type: 'ghost' or using ghost memory tools.`,
  inputSchema: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'Ghost memory content' },
      title: { type: 'string', description: 'Optional title' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Additional tags (ghost-specific tags added automatically)' },
      weight: { type: 'number', minimum: 0, maximum: 1, description: 'Significance (0-1)' },
      trust: { type: 'number', minimum: 0, maximum: 1, description: 'Trust level (0-1)' },
      feel_salience: { type: 'number', minimum: 0, maximum: 1, description: 'How unexpected/novel (0-1)' },
      feel_social_weight: { type: 'number', minimum: 0, maximum: 1, description: 'Relationship/reputation impact (0-1)' },
      feel_narrative_importance: { type: 'number', minimum: 0, maximum: 1, description: 'Story arc importance (0-1)' },
    },
    required: ['content'],
  },
};

export interface CreateGhostMemoryArgs {
  content: string;
  title?: string;
  tags?: string[];
  weight?: number;
  trust?: number;
  [key: string]: any;
}

export async function handleCreateGhostMemory(
  args: CreateGhostMemoryArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_create_ghost_memory', userId, operation: 'create ghost memory' });
  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    const { memory } = createCoreServices(userId);

    // Build ghost-specific tags
    const accessorUserId = authContext?.ghostMode?.accessor_user_id;
    const ghostTags = ['ghost'];
    if (accessorUserId) {
      ghostTags.push(`ghost:${accessorUserId}`);
    }

    // Merge user tags with ghost tags (avoid duplicates)
    const userTags = args.tags ?? [];
    const mergedTags = [...new Set([...ghostTags, ...userTags])];

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
      type: 'ghost' as any,
      weight: args.weight,
      trust: args.trust,
      tags: mergedTags,
      context_summary: 'Ghost memory created via MCP',
      ...feelFields,
    } as any);

    return JSON.stringify({
      memory_id: result.memory_id,
      created_at: result.created_at,
      content_type: 'ghost',
      tags: mergedTags,
      message: `Ghost memory created successfully with ID: ${result.memory_id}`,
    }, null, 2);
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_create_ghost_memory',
      operation: 'create ghost memory',
      userId,
    });
  }
}
