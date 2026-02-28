/**
 * remember_delete_relationship tool
 * Delete a relationship and clean up references in connected memories
 */

import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';

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
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_delete_relationship', userId, operation: 'delete relationship' });

  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    const { relationship } = createCoreServices(userId);
    const coreResult = await relationship.delete({
      relationship_id: args.relationship_id,
    });

    const result: DeleteRelationshipResult = {
      relationship_id: coreResult.relationship_id,
      deleted: true,
      memories_updated: coreResult.memories_updated,
      message: `Relationship deleted successfully${coreResult.memories_updated > 0 ? ` (${coreResult.memories_updated} memories updated)` : ''}`,
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_delete_relationship',
      operation: 'delete relationship',
      userId,
      relationshipId: args.relationship_id,
    });
  }
}
