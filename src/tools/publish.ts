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
import { handleToolError } from '../utils/error-handler.js';
import { SUPPORTED_SPACES } from '../types/space-memory.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';

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
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({
    tool: 'remember_publish',
    userId,
    operation: 'publish_request',
  });

  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    const { space } = createCoreServices(userId);
    const result = await space.publish({
      memory_id: args.memory_id,
      spaces: args.spaces,
      groups: args.groups,
      additional_tags: args.additional_tags,
    });

    return JSON.stringify(
      {
        success: true,
        token: result.token,
        request_id: result.request_id,
        created_at: result.created_at,
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
