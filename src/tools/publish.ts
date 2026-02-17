/**
 * remember_publish tool
 *
 * Generates a confirmation token for publishing a memory to a shared space.
 * This is the first phase of the two-phase publish workflow.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { confirmationTokenService } from '../services/confirmation-token.service.js';
import { getWeaviateClient, getMemoryCollectionName, fetchMemoryWithAllProperties } from '../weaviate/client.js';
import { isValidSpaceId } from '../weaviate/space-schema.js';
import { handleToolError } from '../utils/error-handler.js';
import { SUPPORTED_SPACES } from '../types/space-memory.js';
import { logger } from '../utils/logger.js';

/**
 * Tool definition for remember_publish
 */
export const publishTool: Tool = {
  name: 'remember_publish',
  description: `Publish a memory to one or more shared spaces (like "The Void"). The memory will be COPIED (not moved) from your personal collection. Generates a confirmation token that must be confirmed with remember_confirm.

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
    logger.info('Starting publish request', {
      tool: 'remember_publish',
      userId,
      memoryId: args.memory_id,
      spaces: args.spaces,
      spaceCount: args.spaces.length,
      additionalTags: args.additional_tags?.length || 0,
    });
    
    // Validate all space IDs
    const invalidSpaces = args.spaces.filter(s => !isValidSpaceId(s));
    if (invalidSpaces.length > 0) {
      logger.warn('Invalid space IDs provided', {
        tool: 'remember_publish',
        invalidSpaces,
        providedSpaces: args.spaces,
      });
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
      logger.warn('Empty spaces array provided', {
        tool: 'remember_publish',
        userId,
      });
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
    logger.debug('Fetching memory from collection', {
      tool: 'remember_publish',
      collectionName,
      memoryId: args.memory_id,
    });
    
    const userCollection = weaviateClient.collections.get(collectionName);

    const memory = await fetchMemoryWithAllProperties(userCollection, args.memory_id);
    
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

    // Create payload with memory_id and spaces array
    const payload = {
      memory_id: args.memory_id,
      spaces: args.spaces,
      additional_tags: args.additional_tags || [],
    };

    logger.info('Generating confirmation token', {
      tool: 'remember_publish',
      userId,
      memoryId: args.memory_id,
      spaces: args.spaces,
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
      spaces: args.spaces,
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
