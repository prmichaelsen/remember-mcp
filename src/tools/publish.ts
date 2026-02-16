/**
 * remember_publish tool
 * 
 * Generates a confirmation token for publishing a memory to a shared space.
 * This is the first phase of the two-phase publish workflow.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { confirmationTokenService } from '../services/confirmation-token.service.js';
import { getWeaviateClient, getMemoryCollectionName } from '../weaviate/client.js';
import { isValidSpaceId } from '../weaviate/space-schema.js';
import { handleToolError } from '../utils/error-handler.js';
import { SUPPORTED_SPACES } from '../types/space-memory.js';

/**
 * Tool definition for remember_publish
 */
export const publishTool: Tool = {
  name: 'remember_publish',
  description: 'Publish a memory to a shared space (like "The Void"). The memory will be COPIED (not moved) from your personal collection. Generates a confirmation token. Use remember_confirm to execute.',
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: {
        type: 'string',
        description: 'ID of the memory from your personal collection to publish',
      },
      target: {
        type: 'string',
        description: 'Target space to publish to (snake_case ID)',
        enum: SUPPORTED_SPACES,
        default: 'the_void',
      },
      additional_tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Additional tags for discovery (merged with original tags)',
        default: [],
      },
    },
    required: ['memory_id', 'target'],
  },
};

interface PublishArgs {
  memory_id: string;
  target: string;
  additional_tags?: string[];
}

/**
 * Handle remember_publish tool execution
 */
export async function handlePublish(
  args: PublishArgs,
  userId: string
): Promise<string> {
  try {
    // Validate space ID
    if (!isValidSpaceId(args.target)) {
      return JSON.stringify(
        {
          success: false,
          error: 'Invalid space ID',
          message: `Space "${args.target}" is not supported. Supported spaces: ${SUPPORTED_SPACES.join(', ')}`,
          context: {
            provided_space: args.target,
            supported_spaces: SUPPORTED_SPACES,
          },
        },
        null,
        2
      );
    }

    // Verify memory exists and user owns it
    const weaviateClient = getWeaviateClient();
    const userCollection = weaviateClient.collections.get(
      getMemoryCollectionName(userId)
    );

    const memory = await userCollection.query.fetchObjectById(args.memory_id);

    if (!memory) {
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

    // Create payload with only memory_id (content fetched during confirmation)
    const payload = {
      memory_id: args.memory_id,
      additional_tags: args.additional_tags || [],
    };

    // Generate confirmation token
    const { requestId, token } = await confirmationTokenService.createRequest(
      userId,
      'publish_memory',
      payload,
      args.target
    );

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
    handleToolError(error, {
      toolName: 'remember_publish',
      userId,
      operation: 'publish memory',
      memory_id: args.memory_id,
      target: args.target,
    });
  }
}
