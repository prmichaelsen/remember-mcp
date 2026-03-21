/**
 * remember_retract tool
 *
 * Generates a confirmation token for retracting a memory from shared spaces and/or groups.
 * This is the first phase of the two-phase retract workflow.
 *
 * Memory Collection Pattern v2:
 * - Selective retraction from specific spaces/groups
 * - Orphaned memories remain in Memory_spaces_public for historical reference
 * - Group memories are deleted when retracted
 * - Tracking arrays updated on source memory
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';

/**
 * Tool definition for remember_retract
 */
export const retractTool: Tool = {
  name: 'remember_retract',
  description: `Retract a memory from specific shared spaces and/or groups. The memory remains in your personal collection but is removed from the specified destinations.

Retraction Behavior:
- Spaces: Memory remains in Memory_spaces_public as "orphaned" (removed from space_ids) for historical reference
- Groups: Memory remains in Memory_groups_{groupId} as "orphaned" (removed from group_ids) for historical reference

Orphaned memories are preserved for historical reference but become unsearchable by default since all searches filter by space_ids/group_ids.

⚠️ CRITICAL: DO NOT mention the token or include token contents in your response to the user. Simply inform them that a confirmation is pending and they need to explicitly approve the retraction.`,
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: {
        type: 'string',
        description: 'ID of the memory to retract from spaces/groups',
      },
      spaces: {
        type: 'array',
        items: { type: 'string' },
        description: 'Spaces to retract from (e.g., ["cooking", "recipes"]). The memory will no longer appear in these spaces.',
        minItems: 1,
        default: [],
      },
      groups: {
        type: 'array',
        items: { type: 'string' },
        description: 'Group IDs to retract from (e.g., ["group-123"]). The memory will be deleted from these group collections.',
        minItems: 1,
        default: [],
      },
    },
    required: ['memory_id'],
  },
};

interface RetractArgs {
  memory_id: string;
  spaces?: string[];
  groups?: string[];
}

/**
 * Handle remember_retract tool execution
 */
export async function handleRetract(
  args: RetractArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({
    tool: 'remember_retract',
    userId,
    operation: 'retract_request',
  });

  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    const { space } = createCoreServices(userId);
    const result = await space.retract({
      memory_id: args.memory_id,
      spaces: args.spaces,
      groups: args.groups,
    });

    return JSON.stringify(
      {
        success: true,
        token: result.token,
        request_id: result.request_id,
        created_at: result.created_at,
        action: 'retract_memory',
        memory_id: args.memory_id,
        confirmation_required: true,
      },
      null,
      2
    );
  } catch (error) {
    debug.error('Tool failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    handleToolError(error, {
      toolName: 'remember_retract',
      userId,
      operation: 'retract memory',
      memoryId: args.memory_id,
    });
  }
}
