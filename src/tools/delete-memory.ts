/**
 * remember_delete_memory tool
 * Request to delete a memory (requires confirmation)
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';

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

    // Calculate expiry time (5 minutes from now)
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
