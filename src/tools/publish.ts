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
  description: 'Publish a memory to one or more shared spaces (like "The Void"). The memory will be COPIED (not moved) from your personal collection. Generates a confirmation token. Use remember_confirm to execute.',
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
      additional_tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Additional tags for discovery (merged with original tags)',
        default: [],
      },
    },
    required: ['memory_id', 'spaces'],
  },
};

interface PublishArgs {
  memory_id: string;
  spaces: string[];
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
    console.log('[remember_publish] Starting publish request:', {
      userId,
      memoryId: args.memory_id,
      spaces: args.spaces,
      spaceCount: args.spaces.length,
      additionalTags: args.additional_tags?.length || 0,
    });
    
    // Validate all space IDs
    const invalidSpaces = args.spaces.filter(s => !isValidSpaceId(s));
    if (invalidSpaces.length > 0) {
      console.log('[remember_publish] Invalid space IDs:', invalidSpaces);
      return JSON.stringify(
        {
          success: false,
          error: 'Invalid space IDs',
          message: `Invalid spaces: ${invalidSpaces.join(', ')}. Supported spaces: ${SUPPORTED_SPACES.join(', ')}`,
          context: {
            invalid_spaces: invalidSpaces,
            provided_spaces: args.spaces,
            supported_spaces: SUPPORTED_SPACES,
          },
        },
        null,
        2
      );
    }
    
    // Validate not empty
    if (args.spaces.length === 0) {
      console.log('[remember_publish] Empty spaces array');
      return JSON.stringify(
        {
          success: false,
          error: 'Empty spaces array',
          message: 'Must specify at least one space to publish to',
        },
        null,
        2
      );
    }

    // Verify memory exists and user owns it
    const weaviateClient = getWeaviateClient();
    const collectionName = getMemoryCollectionName(userId);
    console.log('[remember_publish] Fetching memory from collection:', collectionName);
    
    const userCollection = weaviateClient.collections.get(collectionName);

    const memory = await userCollection.query.fetchObjectById(args.memory_id);
    
    console.log('[remember_publish] Memory fetch result:', {
      found: !!memory,
      memoryId: args.memory_id,
    });

    if (!memory) {
      console.log('[remember_publish] Memory not found');
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

    // Create payload with memory_id and spaces array
    const payload = {
      memory_id: args.memory_id,
      spaces: args.spaces,
      additional_tags: args.additional_tags || [],
    };

    console.log('[remember_publish] Generating confirmation token');
    
    // Generate confirmation token
    const { requestId, token} = await confirmationTokenService.createRequest(
      userId,
      'publish_memory',
      payload,
      undefined  // No single target_collection anymore
    );
    
    console.log('[remember_publish] Token generated:', {
      requestId,
      token,
      action: 'publish_memory',
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
    return handleToolError(error, {
      toolName: 'remember_publish',
      userId,
      operation: 'publish memory',
      memory_id: args.memory_id,
      spaces: args.spaces,
    });
  }
}
