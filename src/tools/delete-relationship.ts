/**
 * remember_delete_relationship tool
 * Delete a relationship and clean up references in connected memories
 */

import { getMemoryCollection } from '../weaviate/schema.js';
import { logger } from '../utils/logger.js';
import { handleToolError } from '../utils/error-handler.js';

/**
 * Tool definition for remember_delete_relationship
 */
export const deleteRelationshipTool = {
  name: 'remember_delete_relationship',
  description: `Delete a relationship from your collection.
  
  Automatically removes the relationship reference from all connected memories.
  This action cannot be undone.
  
  Examples:
  - "Delete that inspiration relationship"
  - "Remove the connection between those memories"
  `,
  inputSchema: {
    type: 'object',
    properties: {
      relationship_id: {
        type: 'string',
        description: 'ID of the relationship to delete',
      },
    },
    required: ['relationship_id'],
  },
};

/**
 * Delete relationship arguments
 */
export interface DeleteRelationshipArgs {
  relationship_id: string;
}

/**
 * Delete relationship result
 */
export interface DeleteRelationshipResult {
  relationship_id: string;
  deleted: boolean;
  memories_updated: number;
  message: string;
}

/**
 * Handle remember_delete_relationship tool
 */
export async function handleDeleteRelationship(
  args: DeleteRelationshipArgs,
  userId: string
): Promise<string> {
  try {
    logger.info('Deleting relationship', { userId, relationshipId: args.relationship_id });

    const collection = getMemoryCollection(userId);

    // Get relationship to verify ownership and get connected memory IDs
    const relationship = await collection.query.fetchObjectById(args.relationship_id, {
      returnProperties: ['user_id', 'doc_type', 'related_memory_ids', 'relationship_type'],
    });

    if (!relationship) {
      throw new Error(`Relationship not found: ${args.relationship_id}`);
    }

    // Verify ownership
    if (relationship.properties.user_id !== userId) {
      throw new Error('Unauthorized: Cannot delete another user\'s relationship');
    }

    // Verify it's a relationship (not a memory)
    if (relationship.properties.doc_type !== 'relationship') {
      throw new Error('Cannot delete memories using this tool. Use remember_delete_memory instead.');
    }

    const memoryIds = (relationship.properties.related_memory_ids as string[]) || [];
    let memoriesUpdated = 0;

    // Remove relationship reference from all connected memories
    if (memoryIds.length > 0) {
      logger.info('Cleaning up relationship references from connected memories', {
        relationshipId: args.relationship_id,
        memoryCount: memoryIds.length,
      });

      const updatePromises = memoryIds.map(async (memoryId) => {
        try {
          // Get current memory to read relationships array
          const memory = await collection.query.fetchObjectById(memoryId, {
            returnProperties: ['relationship_ids', 'doc_type'],
          });

          if (!memory || memory.properties.doc_type !== 'memory') {
            logger.warn(`Memory ${memoryId} not found or not a memory, skipping cleanup`);
            return { memoryId, success: false };
          }

          const currentRelationships = (memory.properties.relationship_ids as string[]) || [];
          const updatedRelationships = currentRelationships.filter(
            (relId) => relId !== args.relationship_id
          );

          // Only update if there was a change
          if (updatedRelationships.length !== currentRelationships.length) {
            await collection.data.update({
              id: memoryId,
              properties: {
                relationship_ids: updatedRelationships,
                updated_at: new Date().toISOString(),
              },
            });
            return { memoryId, success: true };
          }

          return { memoryId, success: false };
        } catch (error) {
          logger.warn(`Failed to update memory ${memoryId}:`, error);
          return { memoryId, success: false, error };
        }
      });

      const updateResults = await Promise.all(updatePromises);
      memoriesUpdated = updateResults.filter((r) => r.success).length;

      logger.info('Memory cleanup completed', {
        relationshipId: args.relationship_id,
        memoriesUpdated,
        totalMemories: memoryIds.length,
      });
    }

    // Delete the relationship
    await collection.data.deleteById(args.relationship_id);

    logger.info('Relationship deleted successfully', {
      userId,
      relationshipId: args.relationship_id,
      memoriesUpdated,
    });

    const result: DeleteRelationshipResult = {
      relationship_id: args.relationship_id,
      deleted: true,
      memories_updated: memoriesUpdated,
      message: `Relationship deleted successfully${memoriesUpdated > 0 ? ` (${memoriesUpdated} memories updated)` : ''}`,
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'remember_delete_relationship',
      operation: 'delete relationship',
      userId,
      relationshipId: args.relationship_id,
    });
  }
}
