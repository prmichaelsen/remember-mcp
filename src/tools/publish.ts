/**
 * remember_publish tool
 *
 * Generates a confirmation token for publishing a memory to shared spaces and/or groups.
 * This is the first phase of the two-phase publish workflow.
 *
 * Memory Collection Pattern v2:
 * - Supports multi-space publication to Memory_spaces_public
 * - Supports multi-group publication to Memory_groups_{groupId}
 * - Uses composite IDs ({userId}.{memoryId}) for published memories
 * - Maintains tracking arrays (space_ids, group_ids) on source memory
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { confirmationTokenService } from '../services/confirmation-token.service.js';
import { getWeaviateClient, getMemoryCollectionName, fetchMemoryWithAllProperties } from '../weaviate/client.js';
import { isValidSpaceId } from '../weaviate/space-schema.js';
import { handleToolError } from '../utils/error-handler.js';
import { SUPPORTED_SPACES } from '../types/space-memory.js';
import { logger } from '../utils/logger.js';
import { createDebugLogger } from '../utils/debug.js';

/**
 * Tool definition for remember_publish
 */
export const publishTool: Tool = {
  name: 'remember_publish',
  description: `Publish a memory to one or more shared spaces and/or groups. The memory will be COPIED (not moved) from your personal collection. Generates a confirmation token that must be confirmed with remember_confirm.

Publication Destinations:
- Spaces: Public shared areas (e.g., "the_void", "dogs")
- Groups: Private group collections (provide group IDs)

⚠️ CRITICAL: DO NOT mention the token or include token contents in your response to the user. Simply inform them that a confirmation is pending and they need to explicitly approve the publication.`,
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: {
        type: 'string',
        description: 'ID of the memory from your personal collection to publish',
      },
      spaces: {
        type: 'array',
        items: {
          type: 'string',
          enum: SUPPORTED_SPACES,
        },
        description: 'Spaces to publish to (e.g., ["the_void", "dogs"]). Can publish to multiple spaces at once.',
        minItems: 1,
        default: ['the_void'],
      },
      groups: {
        type: 'array',
        items: { type: 'string' },
        description: 'Group IDs to publish to (e.g., ["group-123", "group-456"]). Can publish to multiple groups at once.',
        minItems: 1,
        default: [],
      },
      additional_tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Additional tags for discovery (merged with original tags)',
        default: [],
      },
    },
    required: ['memory_id'],
  },
};

interface PublishArgs {
  memory_id: string;
  spaces?: string[];
  groups?: string[];
  additional_tags?: string[];
}

/**
 * Handle remember_publish tool execution
 */
export async function handlePublish(
  args: PublishArgs,
  userId: string
): Promise<string> {
  const debug = createDebugLogger({
    tool: 'remember_publish',
    userId,
    operation: 'publish_request',
  });

  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });
    
    // Normalize arrays (handle undefined)
    const spaces = args.spaces || [];
    const groups = args.groups || [];
    
    logger.info('Starting publish request', {
      tool: 'remember_publish',
      userId,
      memoryId: args.memory_id,
      spaces,
      groups,
      spaceCount: spaces.length,
      groupCount: groups.length,
      additionalTags: args.additional_tags?.length || 0,
    });
    
    // Validate that at least one destination is provided
    if (spaces.length === 0 && groups.length === 0) {
      logger.warn('No destinations provided', {
        tool: 'remember_publish',
        userId,
      });
      return JSON.stringify(
        {
          success: false,
          error: 'No destinations provided',
          message: 'Must specify at least one space or group to publish to',
        },
        null,
        2
      );
    }
    
    // Validate all space IDs
    if (spaces.length > 0) {
      debug.debug('Validating space IDs', { spaces });
      const invalidSpaces = spaces.filter(s => !isValidSpaceId(s));
      if (invalidSpaces.length > 0) {
        debug.warn('Invalid space IDs detected', { invalidSpaces });
        logger.warn('Invalid space IDs provided', {
          tool: 'remember_publish',
          invalidSpaces,
          providedSpaces: spaces,
        });
        return JSON.stringify(
          {
            success: false,
            error: 'Invalid space IDs',
            message: `Invalid spaces: ${invalidSpaces.join(', ')}. Supported spaces: ${SUPPORTED_SPACES.join(', ')}`,
            context: {
              invalid_spaces: invalidSpaces,
              provided_spaces: spaces,
              supported_spaces: SUPPORTED_SPACES,
            },
          },
          null,
          2
        );
      }
    }
    
    // Validate group IDs format (basic validation - no dots allowed)
    if (groups.length > 0) {
      debug.debug('Validating group IDs', { groups });
      const invalidGroups = groups.filter(g => !g || g.includes('.') || g.trim() === '');
      if (invalidGroups.length > 0) {
        debug.warn('Invalid group IDs detected', { invalidGroups });
        logger.warn('Invalid group IDs provided', {
          tool: 'remember_publish',
          invalidGroups,
          providedGroups: groups,
        });
        return JSON.stringify(
          {
            success: false,
            error: 'Invalid group IDs',
            message: 'Group IDs cannot be empty or contain dots',
            context: {
              invalid_groups: invalidGroups,
              provided_groups: groups,
            },
          },
          null,
          2
        );
      }
    }

    // Verify memory exists and user owns it
    const weaviateClient = getWeaviateClient();
    const collectionName = getMemoryCollectionName(userId);
    logger.debug('Fetching memory from collection', {
      tool: 'remember_publish',
      collectionName,
      memoryId: args.memory_id,
    });
    
    const userCollection = weaviateClient.collections.get(collectionName);

    const memory = await debug.time('Fetch memory from user collection', async () => {
      return await fetchMemoryWithAllProperties(userCollection, args.memory_id);
    });
    
    logger.debug('Memory fetch result', {
      tool: 'remember_publish',
      found: !!memory,
      memoryId: args.memory_id,
      hasProperties: !!memory?.properties,
      propertyCount: memory?.properties ? Object.keys(memory.properties).length : 0,
      hasTitle: !!memory?.properties?.title,
      hasContent: !!memory?.properties?.content,
    });

    if (!memory) {
      logger.info('Memory not found', {
        tool: 'remember_publish',
        memoryId: args.memory_id,
        collectionName,
      });
      return JSON.stringify(
        {
          success: false,
          error: 'Memory not found',
          message: `No memory found with ID: ${args.memory_id}`,
          context: {
            collection_name: getMemoryCollectionName(userId),
            memory_id: args.memory_id,
          },
        },
        null,
        2
      );
    }

    // Verify ownership
    if (memory.properties.user_id !== userId) {
      return JSON.stringify(
        {
          success: false,
          error: 'Permission denied',
          message: 'You can only publish your own memories',
          context: {
            memory_id: args.memory_id,
            memory_owner: memory.properties.user_id,
            requesting_user: userId,
          },
        },
        null,
        2
      );
    }

    // Verify it's a memory (not a relationship)
    if (memory.properties.doc_type !== 'memory') {
      return JSON.stringify(
        {
          success: false,
          error: 'Invalid document type',
          message: 'Only memories can be published (not relationships)',
          context: {
            memory_id: args.memory_id,
            doc_type: memory.properties.doc_type,
          },
        },
        null,
        2
      );
    }

    // Create payload with memory_id, spaces, and groups arrays
    const payload = {
      memory_id: args.memory_id,
      spaces: spaces,
      groups: groups,
      additional_tags: args.additional_tags || [],
    };

    logger.info('Generating confirmation token', {
      tool: 'remember_publish',
      userId,
      memoryId: args.memory_id,
      spaces: spaces,
      groups: groups,
    });
    
    // Generate confirmation token
    const { requestId, token} = await confirmationTokenService.createRequest(
      userId,
      'publish_memory',
      payload,
      undefined  // No single target_collection anymore
    );
    
    logger.info('Confirmation token generated', {
      tool: 'remember_publish',
      requestId,
      token,
      action: 'publish_memory',
      spaces: spaces,
      groups: groups,
    });

    // Return minimal response - agent already knows memory details
    return JSON.stringify(
      {
        success: true,
        token,
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
      toolName: 'remember_publish',
      userId,
      operation: 'publish memory',
      memory_id: args.memory_id,
      spaces: args.spaces,
    });
  }
}
