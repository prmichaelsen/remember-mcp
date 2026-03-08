/**
 * remember_update_internal_memory tool
 * Updates a ghost or agent memory after validating content_type matches session context.
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';
import { getMemoryCollection } from '../weaviate/schema.js';

export const updateInternalMemoryTool = {
  name: 'remember_update_internal_memory',
  description: `Update an internal memory (ghost or agent). Only works on memories matching
  the current session's content type. Use remember_update_memory for regular memories.`,
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: { type: 'string', description: 'Memory ID to update' },
      content: { type: 'string' },
      title: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      weight: { type: 'number', minimum: 0, maximum: 1 },
      trust: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['memory_id'],
  },
};

export interface UpdateInternalMemoryArgs {
  memory_id: string;
  content?: string;
  title?: string;
  tags?: string[];
  weight?: number;
  trust?: number;
}

export async function handleUpdateInternalMemory(
  args: UpdateInternalMemoryArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_update_internal_memory', userId, operation: 'update internal memory' });
  try {
    debug.info('Tool invoked');

    const ctx = authContext?.internalContext;
    if (!ctx) {
      return JSON.stringify({ error: 'Internal context required. X-Internal-Type header must be set.' });
    }

    // Validate the memory matches the current content type
    const collection = getMemoryCollection(userId);
    const existing = await collection.query.fetchObjectById(args.memory_id);
    if (!existing) {
      return JSON.stringify({ error: `Memory ${args.memory_id} not found` });
    }
    const existingType = (existing.properties as any).content_type;
    if (existingType !== ctx.type) {
      return JSON.stringify({
        error: `Memory ${args.memory_id} is content_type: ${existingType}, but current session is ${ctx.type}. Use remember_update_memory for non-internal memories.`,
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
      message: `${ctx.type} memory updated successfully. Updated fields: ${result.updated_fields.join(', ')}`,
    }, null, 2);
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_update_internal_memory',
      operation: 'update internal memory',
      userId,
      memoryId: args.memory_id,
    });
  }
}
