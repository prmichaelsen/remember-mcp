/**
 * remember_update_ghost_memory tool
 * Updates a ghost memory after validating content_type
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';
import { getMemoryCollection } from '../weaviate/schema.js';

export const updateGhostMemoryTool = {
  name: 'remember_update_ghost_memory',
  description: 'Update a ghost memory. Only works on memories with content_type: ghost.',
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: { type: 'string', description: 'Ghost memory ID to update' },
      content: { type: 'string' },
      title: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      weight: { type: 'number', minimum: 0, maximum: 1 },
      trust: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['memory_id'],
  },
};

export interface UpdateGhostMemoryArgs {
  memory_id: string;
  content?: string;
  title?: string;
  tags?: string[];
  weight?: number;
  trust?: number;
}

export async function handleUpdateGhostMemory(
  args: UpdateGhostMemoryArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_update_ghost_memory', userId, operation: 'update ghost memory' });
  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    // Validate the memory is a ghost memory
    const collection = getMemoryCollection(userId);
    const existing = await collection.query.fetchObjectById(args.memory_id);
    if (!existing) {
      return JSON.stringify({ error: `Memory ${args.memory_id} not found` });
    }
    if ((existing.properties as any).content_type !== 'ghost') {
      return JSON.stringify({
        error: `Memory ${args.memory_id} is not a ghost memory (content_type: ${(existing.properties as any).content_type}). Use remember_update_memory for non-ghost memories.`,
      });
    }

    const { memory } = createCoreServices(userId);
    const result = await memory.update({
      memory_id: args.memory_id,
      content: args.content,
      title: args.title,
      tags: args.tags,
      weight: args.weight,
      trust: args.trust,
    });

    return JSON.stringify({
      memory_id: result.memory_id,
      updated_at: result.updated_at,
      version: result.version,
      updated_fields: result.updated_fields,
      message: `Ghost memory updated successfully. Updated fields: ${result.updated_fields.join(', ')}`,
    }, null, 2);
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_update_ghost_memory',
      operation: 'update ghost memory',
      userId,
      memoryId: args.memory_id,
    });
  }
}
