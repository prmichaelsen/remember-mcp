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
import { confirmationTokenService } from '../services/confirmation-token.service.js';
import { getWeaviateClient, getMemoryCollectionName, fetchMemoryWithAllProperties } from '../weaviate/client.js';
import { handleToolError } from '../utils/error-handler.js';
import { logger } from '../utils/logger.js';
import { createDebugLogger } from '../utils/debug.js';

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
  userId: string
): Promise<string> {
  const debug = createDebugLogger({
    tool: 'remember_retract',
    userId,
    operation: 'retract_request',
  });

  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    // Normalize arrays (handle undefined)
    const spaces = args.spaces || [];
    const groups = args.groups || [];

    logger.info('Starting retract request', {
      tool: 'remember_retract',
      userId,
      memoryId: args.memory_id,
      spaces,
      groups,
      spaceCount: spaces.length,
      groupCount: groups.length,
    });

    // Validate that at least one destination is provided
    if (spaces.length === 0 && groups.length === 0) {
      logger.warn('No destinations provided for retraction', {
        tool: 'remember_retract',
        userId,
      });
      return JSON.stringify(
        {
          success: false,
          error: 'No destinations provided',
          message: 'Must specify at least one space or group to retract from',
        },
        null,
        2
      );
    }

    // Validate group IDs (no dots allowed)
    if (groups.length > 0) {
      const invalidGroups = groups.filter(g => g.includes('.'));
      if (invalidGroups.length > 0) {
        logger.warn('Invalid group IDs detected', {
          tool: 'remember_retract',
          invalidGroups,
        });
        return JSON.stringify(
          {
            success: false,
            error: 'Invalid group IDs',
            message: `Group IDs cannot contain dots: ${invalidGroups.join(', ')}`,
            context: {
              invalid_groups: invalidGroups,
            },
          },
          null,
          2
        );
      }
    }

    // Verify the memory exists and belongs to the user
    const weaviateClient = getWeaviateClient();
    const collectionName = getMemoryCollectionName(userId);
    const collection = weaviateClient.collections.get(collectionName);

    logger.debug('Fetching memory for retraction', {
      tool: 'remember_retract',
      collectionName,
      memoryId: args.memory_id,
    });

    const memory = await fetchMemoryWithAllProperties(collection, args.memory_id);

    if (!memory) {
      logger.info('Memory not found for retraction', {
        tool: 'remember_retract',
        memoryId: args.memory_id,
      });
      return JSON.stringify(
        {
          success: false,
          error: 'Memory not found',
          message: `Memory ${args.memory_id} does not exist`,
        },
        null,
        2
      );
    }

    // Verify ownership
    if (memory.properties.user_id !== userId) {
      logger.warn('Permission denied - wrong owner', {
        tool: 'remember_retract',
        memoryId: args.memory_id,
        memoryOwner: memory.properties.user_id,
        requestingUser: userId,
      });
      return JSON.stringify(
        {
          success: false,
          error: 'Permission denied',
          message: 'You can only retract your own memories',
        },
        null,
        2
      );
    }

    // Check current publication status
    const currentSpaceIds: string[] = Array.isArray(memory.properties.space_ids)
      ? memory.properties.space_ids
      : [];
    const currentGroupIds: string[] = Array.isArray(memory.properties.group_ids)
      ? memory.properties.group_ids
      : [];

    // Validate that memory is actually published to the specified destinations
    const notPublishedSpaces = spaces.filter(s => !currentSpaceIds.includes(s));
    const notPublishedGroups = groups.filter(g => !currentGroupIds.includes(g));

    if (notPublishedSpaces.length > 0 || notPublishedGroups.length > 0) {
      logger.warn('Memory not published to some destinations', {
        tool: 'remember_retract',
        notPublishedSpaces,
        notPublishedGroups,
        currentSpaceIds,
        currentGroupIds,
      });
      return JSON.stringify(
        {
          success: false,
          error: 'Not published to destinations',
          message: 'Memory is not published to some of the specified destinations',
          context: {
            not_published_spaces: notPublishedSpaces,
            not_published_groups: notPublishedGroups,
            current_spaces: currentSpaceIds,
            current_groups: currentGroupIds,
          },
        },
        null,
        2
      );
    }

    // Create confirmation request
    const { requestId, token } = await confirmationTokenService.createRequest(
      userId,
      'retract_memory',
      {
        memory_id: args.memory_id,
        spaces,
        groups,
        current_space_ids: currentSpaceIds,
        current_group_ids: currentGroupIds,
      }
    );

    logger.info('Retract confirmation request created', {
      tool: 'remember_retract',
      requestId,
      userId,
      memoryId: args.memory_id,
      spaces,
      groups,
    });

    // Build summary for user
    const destinations: string[] = [];
    if (spaces.length > 0) {
      destinations.push(`spaces: ${spaces.join(', ')}`);
    }
    if (groups.length > 0) {
      destinations.push(`groups: ${groups.join(', ')}`);
    }

    return JSON.stringify(
      {
        success: true,
        message: 'Retraction request created. Please confirm to proceed.',
        action: 'retract_memory',
        memory_id: args.memory_id,
        destinations: destinations.join('; '),
        retraction_details: {
          spaces: spaces.length > 0 ? {
            action: 'orphan',
            description: 'Memory will remain in Memory_spaces_public with updated tracking arrays (removed from space_ids)',
            spaces,
          } : null,
          groups: groups.length > 0 ? {
            action: 'orphan',
            description: 'Memory will remain in Memory_groups_{groupId} with updated tracking arrays (removed from group_ids)',
            groups,
          } : null,
        },
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
