/**
 * remember_moderate tool
 *
 * Allows moderators to approve, reject, or remove published memories
 * in spaces and groups. Requires can_moderate permission.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';

type ModerationAction = 'approve' | 'reject' | 'remove';

export const moderateTool: Tool = {
  name: 'remember_moderate',
  description: `Approve, reject, or remove a published memory. Requires moderator permissions (can_moderate).

Actions:
- approve: Mark a pending memory as approved (visible in default searches)
- reject: Reject a pending memory (hidden from default searches)
- remove: Remove a previously approved memory (hidden from default searches)

Must specify either space_id or group_id to identify where the memory is published.`,
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: {
        type: 'string',
        description: 'UUID or composite ID of the published memory',
      },
      space_id: {
        type: 'string',
        description: 'Space containing the memory (searches Memory_spaces_public filtered by space_ids)',
      },
      group_id: {
        type: 'string',
        description: 'Group containing the memory (searches Memory_groups_{groupId})',
      },
      action: {
        type: 'string',
        enum: ['approve', 'reject', 'remove'],
        description: 'Moderation action to perform',
      },
      reason: {
        type: 'string',
        description: 'Optional reason for the moderation action',
      },
    },
    required: ['memory_id', 'action'],
  },
};

interface ModerateArgs {
  memory_id: string;
  space_id?: string;
  group_id?: string;
  action: ModerationAction;
  reason?: string;
}

export async function handleModerate(
  args: ModerateArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({
    tool: 'remember_moderate',
    userId,
    operation: 'moderate',
  });

  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    const { space } = createCoreServices(userId);
    const result = await space.moderate(
      {
        memory_id: args.memory_id,
        space_id: args.space_id,
        group_id: args.group_id,
        action: args.action as any,
        reason: args.reason,
      },
      authContext as any
    );

    return JSON.stringify(
      {
        success: true,
        memory_id: result.memory_id,
        action: result.action,
        moderation_status: result.moderation_status,
        moderated_by: result.moderated_by,
        moderated_at: result.moderated_at,
        reason: args.reason || undefined,
        location: result.location,
      },
      null,
      2
    );
  } catch (error) {
    debug.error('Tool failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return handleToolError(error, {
      toolName: 'remember_moderate',
      operation: 'moderate memory',
      memoryId: args.memory_id,
      action: args.action,
    });
  }
}
