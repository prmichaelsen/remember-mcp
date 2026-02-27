/**
 * remember_moderate tool
 *
 * Allows moderators to approve, reject, or remove published memories
 * in spaces and groups. Requires can_moderate permission.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getWeaviateClient, fetchMemoryWithAllProperties } from '../weaviate/client.js';
import { ensurePublicCollection } from '../weaviate/space-schema.js';
import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import { logger } from '../utils/logger.js';
import { CollectionType, getCollectionName } from '../collections/dot-notation.js';
import type { AuthContext } from '../types/auth.js';
import { canModerate, canModerateAny } from '../utils/auth-helpers.js';

type ModerationAction = 'approve' | 'reject' | 'remove';

const ACTION_TO_STATUS: Record<ModerationAction, string> = {
  approve: 'approved',
  reject: 'rejected',
  remove: 'removed',
};

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

    const { memory_id, space_id, group_id, action, reason } = args;

    // Validate: must specify either space_id or group_id
    if (!space_id && !group_id) {
      return JSON.stringify(
        {
          success: false,
          error: 'Missing destination',
          message: 'Must specify either space_id or group_id',
        },
        null,
        2
      );
    }

    // Validate action
    if (!ACTION_TO_STATUS[action]) {
      return JSON.stringify(
        {
          success: false,
          error: 'Invalid action',
          message: `Action must be one of: approve, reject, remove`,
        },
        null,
        2
      );
    }

    // Permission check
    if (group_id) {
      if (!canModerate(authContext, group_id)) {
        return JSON.stringify(
          {
            success: false,
            error: 'Permission denied',
            message: `Moderator access required for group ${group_id}`,
          },
          null,
          2
        );
      }
    } else if (space_id) {
      if (!canModerateAny(authContext)) {
        return JSON.stringify(
          {
            success: false,
            error: 'Permission denied',
            message: `Moderator access required to moderate memories in spaces`,
          },
          null,
          2
        );
      }
    }

    // Get the collection
    const weaviateClient = getWeaviateClient();
    let collection: any;

    if (group_id) {
      const collectionName = getCollectionName(CollectionType.GROUPS, group_id);
      collection = weaviateClient.collections.get(collectionName);
    } else {
      collection = await ensurePublicCollection(weaviateClient);
    }

    // Fetch the memory
    const memory = await fetchMemoryWithAllProperties(collection, memory_id);

    if (!memory) {
      return JSON.stringify(
        {
          success: false,
          error: 'Memory not found',
          message: `Published memory ${memory_id} not found in ${group_id ? `group ${group_id}` : `space ${space_id}`}`,
        },
        null,
        2
      );
    }

    // Update moderation fields
    const newStatus = ACTION_TO_STATUS[action];
    const now = new Date().toISOString();

    await collection.data.update({
      id: memory_id,
      properties: {
        moderation_status: newStatus,
        moderated_by: userId,
        moderated_at: now,
      },
    });

    logger.info('Memory moderated', {
      tool: 'remember_moderate',
      userId,
      memoryId: memory_id,
      action,
      newStatus,
      spaceId: space_id,
      groupId: group_id,
      reason,
    });

    return JSON.stringify(
      {
        success: true,
        memory_id,
        action,
        moderation_status: newStatus,
        moderated_by: userId,
        moderated_at: now,
        reason: reason || undefined,
        location: group_id ? `group:${group_id}` : `space:${space_id}`,
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
