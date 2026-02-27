/**
 * remember_update_memory tool
 * Update an existing memory with partial updates
 */

import type { Memory, MemoryUpdate } from '../types/memory.js';
import { getMemoryCollection } from '../weaviate/schema.js';
import { fetchMemoryWithAllProperties } from '../weaviate/client.js';
import { logger } from '../utils/logger.js';
import { handleToolError, withErrorHandling } from '../utils/error-handler.js';
import { isValidContentType } from '../constants/content-types.js';

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
  userId: string
): Promise<string> {
  try {
    logger.info('Updating memory', { userId, memoryId: args.memory_id });

    const collection = getMemoryCollection(userId);

    // Get existing memory - fetch ALL properties for replace operation
    // We need the full object to use replace() instead of update()
    // (Weaviate bug: update() only persists if vectorized fields change)
    // Use fetchMemoryWithAllProperties() to handle schema evolution gracefully
    let existingMemory;
    try {
      existingMemory = await fetchMemoryWithAllProperties(collection, args.memory_id);
    } catch (fetchError) {
      const fetchErrorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      logger.error('Failed to fetch memory for update:', {
        error: fetchErrorMsg,
        userId,
        memoryId: args.memory_id,
        collectionName: `Memory_${userId}`,
      });
      throw new Error(`Failed to fetch memory ${args.memory_id}: ${fetchErrorMsg}`);
    }

    if (!existingMemory || !existingMemory.properties) {
      throw new Error(`Memory not found: ${args.memory_id}. It may have been deleted or never existed.`);
    }

    // Verify ownership
    if (existingMemory.properties.user_id !== userId) {
      throw new Error('Unauthorized: Cannot update another user\'s memory');
    }

    // Verify it's a memory (not a relationship)
    if (existingMemory.properties.doc_type !== 'memory') {
      throw new Error('Cannot update relationships using this tool. Use remember_update_relationship instead.');
    }

    // Check if memory is deleted
    if (existingMemory.properties.deleted_at) {
      const deletedAt = typeof existingMemory.properties.deleted_at === 'string'
        ? existingMemory.properties.deleted_at
        : new Date(existingMemory.properties.deleted_at as any).toISOString();
      throw new Error(`Cannot update deleted memory: ${args.memory_id}. Memory was deleted on ${deletedAt}.`);
    }

    // Build update object with only provided fields
    const updates: Record<string, any> = {};
    const updatedFields: string[] = [];

    // Update content fields
    if (args.content !== undefined) {
      updates.content = args.content;
      updatedFields.push('content');
    }

    if (args.title !== undefined) {
      updates.title = args.title;
      updates.summary = args.title; // Keep summary in sync with title
      updatedFields.push('title');
    }

    if (args.type !== undefined) {
      if (!isValidContentType(args.type)) {
        throw new Error(`Invalid content type: ${args.type}`);
      }
      updates.content_type = args.type;
      updatedFields.push('content_type');
    }

    // Update scoring fields
    if (args.weight !== undefined) {
      if (args.weight < 0 || args.weight > 1) {
        throw new Error('Weight must be between 0 and 1');
      }
      updates.weight = args.weight;
      updates.base_weight = args.weight;
      updates.computed_weight = args.weight; // Recalculate if needed
      updatedFields.push('weight');
    }

    if (args.trust !== undefined) {
      if (args.trust < 0 || args.trust > 1) {
        throw new Error('Trust must be between 0 and 1');
      }
      updates.trust_score = args.trust;
      updatedFields.push('trust_score');
    }

    // Update organization fields
    if (args.tags !== undefined) {
      updates.tags = args.tags;
      updatedFields.push('tags');
    }

    if (args.references !== undefined) {
      updates.references = args.references;
      updatedFields.push('references');
    }

    // Update structured content
    if (args.structured_content !== undefined) {
      updates.structured_content = args.structured_content;
      updatedFields.push('structured_content');
    }

    // NOTE: space_ids and group_ids (publication tracking arrays) are intentionally
    // NOT exposed in UpdateMemoryArgs — they are managed exclusively by
    // remember_publish and remember_retract. The spread below preserves them.

    // Update comment/threading fields
    if (args.parent_id !== undefined) {
      updates.parent_id = args.parent_id;
      updatedFields.push('parent_id');
    }

    if (args.thread_root_id !== undefined) {
      updates.thread_root_id = args.thread_root_id;
      updatedFields.push('thread_root_id');
    }

    if (args.moderation_flags !== undefined) {
      updates.moderation_flags = args.moderation_flags;
      updatedFields.push('moderation_flags');
    }

    // Check if any fields were provided
    if (updatedFields.length === 0) {
      throw new Error('No fields provided for update. At least one field must be specified.');
    }

    // Update metadata
    const now = new Date().toISOString();
    updates.updated_at = now;
    updates.version = (existingMemory.properties.version as number) + 1;

    // Merge updates with existing properties
    // Use replace() instead of update() due to Weaviate bug where update() only
    // persists if vectorized fields (content/observation) are changed
    const mergedProperties = {
      ...existingMemory.properties,
      ...updates,
    };
    
    logger.info('Calling Weaviate replace', {
      userId,
      memoryId: args.memory_id,
      updateFields: Object.keys(updates),
      updateValues: updates,
      collectionName: `Memory_${userId}`,
      totalProperties: Object.keys(mergedProperties).length,
    });
    
    try {
      await collection.data.replace({
        id: args.memory_id,
        properties: mergedProperties,
      });
      
      logger.info('Weaviate replace completed (no error thrown)', {
        userId,
        memoryId: args.memory_id,
        updatedFields: Object.keys(updates),
      });
    } catch (updateError) {
      const updateErrorMsg = updateError instanceof Error ? updateError.message : String(updateError);
      logger.error('Failed to perform Weaviate replace:', {
        error: updateErrorMsg,
        userId,
        memoryId: args.memory_id,
        updateFields: Object.keys(updates),
        collectionName: `Memory_${userId}`,
      });
      throw new Error(`Failed to update memory in Weaviate: ${updateErrorMsg}`);
    }

    logger.info('Memory updated successfully', {
      userId,
      memoryId: args.memory_id,
      version: updates.version,
      updatedFields,
    });

    const result: UpdateMemoryResult = {
      memory_id: args.memory_id,
      updated_at: now,
      version: updates.version,
      updated_fields: updatedFields,
      message: `Memory updated successfully. Updated fields: ${updatedFields.join(', ')}`,
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
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
