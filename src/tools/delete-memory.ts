/**
 * remember_delete_memory tool
 * Delete a memory from the user's collection
 */

import { getMemoryCollection } from '../weaviate/schema.js';
import { logger } from '../utils/logger.js';

/**
 * Tool definition for remember_delete_memory
 */
export const deleteMemoryTool = {
  name: 'remember_delete_memory',
  description: `Delete a memory from your collection.
  
  Optionally delete connected relationships as well.
  This action cannot be undone.
  
  Examples:
  - "Delete that old camping note"
  - "Remove the recipe I saved yesterday"
  `,
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: {
        type: 'string',
        description: 'ID of the memory to delete',
      },
      delete_relationships: {
        type: 'boolean',
        description: 'Also delete connected relationships. Default: false',
        default: false,
      },
    },
    required: ['memory_id'],
  },
};

/**
 * Delete memory arguments
 */
export interface DeleteMemoryArgs {
  memory_id: string;
  delete_relationships?: boolean;
}

/**
 * Delete memory result
 */
export interface DeleteMemoryResult {
  memory_id: string;
  deleted: boolean;
  relationships_deleted?: number;
  message: string;
}

/**
 * Handle remember_delete_memory tool
 */
export async function handleDeleteMemory(
  args: DeleteMemoryArgs,
  userId: string
): Promise<string> {
  try {
    logger.info('Deleting memory', { userId, memoryId: args.memory_id });

    const collection = getMemoryCollection(userId);

    // Get memory to verify ownership and get relationships
    const memory = await collection.query.fetchObjectById(args.memory_id, {
      returnProperties: ['user_id', 'doc_type', 'relationships'],
    });

    if (!memory) {
      throw new Error(`Memory not found: ${args.memory_id}`);
    }

    // Verify ownership
    if (memory.properties.user_id !== userId) {
      throw new Error('Unauthorized: Cannot delete another user\'s memory');
    }

    // Verify it's a memory (not a relationship)
    if (memory.properties.doc_type !== 'memory') {
      throw new Error('Cannot delete relationships using this tool. Use remember_delete_relationship instead.');
    }

    let relationshipsDeleted = 0;

    // Delete connected relationships if requested
    if (args.delete_relationships && memory.properties.relationships) {
      const relationshipIds = memory.properties.relationships as string[];
      
      for (const relId of relationshipIds) {
        try {
          await collection.data.deleteById(relId);
          relationshipsDeleted++;
        } catch (error) {
          logger.warn(`Failed to delete relationship ${relId}:`, error);
        }
      }
    }

    // Delete the memory
    await collection.data.deleteById(args.memory_id);

    logger.info('Memory deleted successfully', { 
      userId, 
      memoryId: args.memory_id,
      relationshipsDeleted 
    });

    const result: DeleteMemoryResult = {
      memory_id: args.memory_id,
      deleted: true,
      relationships_deleted: relationshipsDeleted,
      message: `Memory deleted successfully${relationshipsDeleted > 0 ? ` (${relationshipsDeleted} relationships also deleted)` : ''}`,
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    logger.error('Failed to delete memory:', error);
    throw new Error(`Failed to delete memory: ${error instanceof Error ? error.message : String(error)}`);
  }
}
