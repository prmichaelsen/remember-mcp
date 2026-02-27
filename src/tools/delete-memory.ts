/**
 * remember_delete_memory tool
 * Request to delete a memory (requires confirmation)
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Filters } from 'weaviate-client';
import { getWeaviateClient, getMemoryCollectionName, fetchMemoryWithAllProperties } from '../weaviate/client.js';
import { confirmationTokenService } from '../services/confirmation-token.service.js';
import { logger } from '../utils/logger.js';
import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';

/**
 * Tool definition for remember_delete_memory
 */
export const deleteMemoryTool: Tool = {
  name: 'remember_delete_memory',
  description: `Request to delete a memory. Requires confirmation via remember_confirm.
  
⚠️ **IMPORTANT**: This is a two-step process:
1. Call remember_delete_memory to request deletion (returns token)
2. User must confirm via remember_confirm with the token

The memory will be soft-deleted (marked as deleted but not removed from database).

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
      reason: {
        type: 'string',
        description: 'Optional reason for deletion',
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
  reason?: string;
}

/**
 * Handle remember_delete_memory tool
 * Creates confirmation token and returns preview
 */
export async function handleDeleteMemory(
  args: DeleteMemoryArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_delete_memory', userId, operation: 'delete memory' });
  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });
    logger.info('Requesting memory deletion', {
      userId, 
      memoryId: args.memory_id,
      hasReason: !!args.reason,
    });

    const { memory_id, reason } = args;
    const client = getWeaviateClient();
    const collectionName = getMemoryCollectionName(userId);
    const collection = client.collections.get(collectionName);

    // Fetch memory to verify ownership and get preview
    const memory = await fetchMemoryWithAllProperties(collection, memory_id);

    if (!memory) {
      throw new Error(`Memory not found: ${memory_id}`);
    }

    // Verify ownership
    if (memory.properties.user_id !== userId) {
      throw new Error(`Cannot delete memory: not owned by user ${userId}`);
    }

    // Verify it's a memory (not a relationship)
    if (memory.properties.doc_type !== 'memory') {
      throw new Error('Cannot delete relationships using this tool. Use remember_delete_relationship instead.');
    }

    // Check if already deleted
    if (memory.properties.deleted_at) {
      throw new Error(`Memory ${memory_id} is already deleted`);
    }

    // Find relationships that will be orphaned
    const relationshipsResult = await collection.query.fetchObjects({
      filters: Filters.and(
        collection.filter.byProperty('doc_type').equal('relationship'),
        collection.filter.byProperty('related_memory_ids').containsAny([memory_id])
      ),
      limit: 100,
    });

    const orphanedRelationships = relationshipsResult.objects.map(r => r.uuid);

    logger.info('Found relationships to orphan', {
      userId,
      memoryId: memory_id,
      relationshipCount: orphanedRelationships.length,
    });

    // Create confirmation token
    const { requestId, token } = await confirmationTokenService.createRequest(
      userId,
      'delete_memory',
      {
        memory_id,
        reason: reason || null,
      }
    );

    // Calculate expiry time (5 minutes from now)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    logger.info('Delete confirmation token created', {
      userId,
      memoryId: memory_id,
      requestId,
      token,
      expiresAt: expiresAt.toISOString(),
    });

    // Return token and preview
    return JSON.stringify(
      {
        success: true,
        token,
        expires_at: expiresAt.toISOString(),
        preview: {
          memory_id,
          content: memory.properties.content?.substring(0, 200) + (memory.properties.content?.length > 200 ? '...' : ''),
          content_type: memory.properties.content_type,
          relationships_count: orphanedRelationships.length,
          will_orphan: orphanedRelationships,
        },
        message: `Deletion requested. Use remember_confirm with token to complete deletion. Token expires in 5 minutes.`,
      },
      null,
      2
    );
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_delete_memory',
      userId,
      operation: 'request delete',
      memoryId: args.memory_id,
    });
  }
}
