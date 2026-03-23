/**
 * remember_delete_memory tool
 * Request to delete a memory (requires confirmation)
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';
import { getWeaviateClient, getMemoryCollectionName } from '../weaviate/client.js';
import { elicitConfirmation } from '../utils/elicitation.js';

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
  authContext?: AuthContext,
  server?: Server
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_delete_memory', userId, operation: 'delete memory' });
  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    const { token: tokenService } = createCoreServices(userId);

    // Create confirmation token via core service
    const { token } = await tokenService.createRequest(
      userId,
      'delete_memory',
      {
        memory_id: args.memory_id,
        reason: args.reason || null,
      }
    );

    const confirmation = await elicitConfirmation({
      server,
      message: `Delete memory "${args.memory_id}"${args.reason ? ` (reason: ${args.reason})` : ''}?`,
    });

    if (confirmation.type === 'confirmed') {
      // Consume the token and execute deletion
      const confirmed = await tokenService.confirmRequest(userId, token);
      if (!confirmed) {
        return JSON.stringify(
          { success: false, error: 'Token already consumed', message: 'The confirmation token has already been used.' },
          null,
          2
        );
      }

      const { memory_id, reason } = confirmed.payload;
      const client = getWeaviateClient();
      const collectionName = getMemoryCollectionName(userId);
      const collection = client.collections.get(collectionName);

      await collection.data.update({
        id: memory_id,
        properties: {
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
          deletion_reason: reason || null,
        },
      });

      return JSON.stringify(
        { success: true, memory_id, message: 'Memory deleted successfully' },
        null,
        2
      );
    }

    if (confirmation.type === 'declined') {
      return JSON.stringify(
        { success: false, message: 'Deletion cancelled by user.' },
        null,
        2
      );
    }

    // Fallback: return token for legacy confirm/deny flow
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    return JSON.stringify(
      {
        success: true,
        token,
        expires_at: expiresAt.toISOString(),
        memory_id: args.memory_id,
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
