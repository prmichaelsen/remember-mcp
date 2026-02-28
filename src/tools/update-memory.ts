/**
 * remember_update_memory tool
 * Update an existing memory with partial updates
 */

import type { Memory, MemoryUpdate } from '../types/memory.js';
import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';

/**
 * Tool definition for remember_update_memory
 */
export const updateMemoryTool = {
  name: 'remember_update_memory',
  description: `Update an existing memory with partial updates.
  
  Supports updating any field except id, user_id, doc_type, created_at.
  Version number is automatically incremented and updated_at is set.
  Only provided fields are updated (partial updates supported).
  
  Examples:
  - "Update that camping note to add more details"
  - "Change the weight of my recipe memory"
  - "Add tags to the meeting note from yesterday"
  `,
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: {
        type: 'string',
        description: 'ID of the memory to update',
      },
      content: {
        type: 'string',
        description: 'Updated memory content',
      },
      title: {
        type: 'string',
        description: 'Updated title',
      },
      type: {
        type: 'string',
        description: 'Updated content type',
      },
      weight: {
        type: 'number',
        description: 'Updated significance/priority (0-1)',
        minimum: 0,
        maximum: 1,
      },
      trust: {
        type: 'number',
        description: 'Updated access control level (0-1)',
        minimum: 0,
        maximum: 1,
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Updated tags (replaces existing tags)',
      },
      references: {
        type: 'array',
        items: { type: 'string' },
        description: 'Updated source URLs (replaces existing references)',
      },
      structured_content: {
        type: 'object',
        description: 'Updated structured content',
      },
      parent_id: {
        type: 'string',
        description: 'Update parent ID (for threading)',
      },
      thread_root_id: {
        type: 'string',
        description: 'Update thread root ID',
      },
      moderation_flags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Update moderation flags',
      },
    },
    required: ['memory_id'],
  },
};

/**
 * Update memory arguments
 */
export interface UpdateMemoryArgs {
  memory_id: string;
  content?: string;
  title?: string;
  type?: string;
  weight?: number;
  trust?: number;
  tags?: string[];
  references?: string[];
  structured_content?: Record<string, any>;
  // Comment/threading fields
  parent_id?: string | null;
  thread_root_id?: string | null;
  moderation_flags?: string[];
}

/**
 * Update memory result
 */
export interface UpdateMemoryResult {
  memory_id: string;
  updated_at: string;
  version: number;
  updated_fields: string[];
  message: string;
}

/**
 * Handle remember_update_memory tool
 */
export async function handleUpdateMemory(
  args: UpdateMemoryArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_update_memory', userId, operation: 'update memory' });
  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    const { memory } = createCoreServices(userId);
    const result = await memory.update({
      memory_id: args.memory_id,
      content: args.content,
      title: args.title,
      type: args.type,
      weight: args.weight,
      trust: args.trust,
      tags: args.tags,
      references: args.references,
      parent_id: args.parent_id,
      thread_root_id: args.thread_root_id,
      moderation_flags: args.moderation_flags,
    });

    const response: UpdateMemoryResult = {
      memory_id: result.memory_id,
      updated_at: result.updated_at,
      version: result.version,
      updated_fields: result.updated_fields,
      message: `Memory updated successfully. Updated fields: ${result.updated_fields.join(', ')}`,
    };

    return JSON.stringify(response, null, 2);
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_update_memory',
      operation: 'update memory',
      userId,
      memoryId: args.memory_id,
      providedFields: Object.keys(args).filter(k => k !== 'memory_id').join(', '),
      updateCount: Object.keys(args).filter(k => k !== 'memory_id').length,
    });
  }
}
