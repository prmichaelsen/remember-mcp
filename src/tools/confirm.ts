/**
 * remember_confirm tool
 *
 * Generic confirmation tool that executes any pending action.
 * This is the second phase of the confirmation workflow.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { confirmationTokenService, type ConfirmationRequest } from '../services/confirmation-token.service.js';
import { getWeaviateClient, getMemoryCollectionName } from '../weaviate/client.js';
import { ensurePublicCollection } from '../weaviate/space-schema.js';
import { handleToolError } from '../utils/error-handler.js';
import { logger } from '../utils/logger.js';

/**
 * Tool definition for remember_confirm
 */
export const confirmTool: Tool = {
  name: 'remember_confirm',
  description: 'Confirm and execute a pending action using the token. Works for any action that requires confirmation (publish, delete, etc.).',
  inputSchema: {
    type: 'object',
    properties: {
      token: {
        type: 'string',
        description: 'The confirmation token from the action tool',
      },
    },
    required: ['token'],
  },
};

interface ConfirmArgs {
  token: string;
}

/**
 * Handle remember_confirm tool execution
 */
export async function handleConfirm(
  args: ConfirmArgs,
  userId: string
): Promise<string> {
  try {
    logger.info('Starting confirmation', {
      tool: 'remember_confirm',
      userId,
      token: args.token,
    });
    
    // Validate and confirm token
    const request = await confirmationTokenService.confirmRequest(userId, args.token);
    
    logger.debug('Token validation result', {
      tool: 'remember_confirm',
      requestFound: !!request,
      action: request?.action,
    });

    if (!request) {
      logger.info('Token invalid or expired', {
        tool: 'remember_confirm',
        userId,
      });
      return JSON.stringify(
        {
          success: false,
          error: 'Invalid or expired token',
          message: 'The confirmation token is invalid, expired, or has already been used.',
        },
        null,
        2
      );
    }

    logger.info('Executing confirmed action', {
      tool: 'remember_confirm',
      action: request.action,
      userId,
    });

    // GENERIC: Execute action based on type
    // This is where the generic pattern delegates to action-specific executors
    if (request.action === 'publish_memory') {
      return await executePublishMemory(request, userId);
    }

    // Add other action types here as needed
    // if (request.action === 'retract_memory') {
    //   return await executeRetractMemory(request, userId);
    // }

    throw new Error(`Unknown action type: ${request.action}`);
  } catch (error) {
    handleToolError(error, {
      toolName: 'remember_confirm',
      userId,
      operation: 'confirm action',
      token: args.token,
    });
  }
}

/**
 * Execute publish memory action
 */
async function executePublishMemory(
  request: ConfirmationRequest & { request_id: string },
  userId: string
): Promise<string> {
  try {
    logger.info('Executing publish memory action', {
      function: 'executePublishMemory',
      userId,
      memoryId: request.payload.memory_id,
      spaces: request.payload.spaces,
      spaceCount: request.payload.spaces?.length || 0,
    });
    
    // Fetch the memory NOW (during confirmation, not from stored payload)
    const weaviateClient = getWeaviateClient();
    const userCollection = weaviateClient.collections.get(
      getMemoryCollectionName(userId)
    );
    
    logger.debug('Fetching original memory', {
      function: 'executePublishMemory',
      collectionName: getMemoryCollectionName(userId),
      memoryId: request.payload.memory_id,
    });

    const originalMemory = await userCollection.query.fetchObjectById(
      request.payload.memory_id
    );
    
    logger.debug('Original memory fetch result', {
      function: 'executePublishMemory',
      found: !!originalMemory,
      memoryId: request.payload.memory_id,
    });

    if (!originalMemory) {
      logger.info('Original memory not found', {
        function: 'executePublishMemory',
        memoryId: request.payload.memory_id,
      });
      return JSON.stringify(
        {
          success: false,
          error: 'Memory not found',
          message: `Original memory ${request.payload.memory_id} no longer exists`,
        },
        null,
        2
      );
    }

    // Verify ownership again
    if (originalMemory.properties.user_id !== userId) {
      logger.warn('Permission denied - wrong owner', {
        function: 'executePublishMemory',
        memoryId: request.payload.memory_id,
        memoryOwner: originalMemory.properties.user_id,
        requestingUser: userId,
      });
      return JSON.stringify(
        {
          success: false,
          error: 'Permission denied',
          message: 'You can only publish your own memories',
        },
        null,
        2
      );
    }
    
    logger.debug('Ensuring public collection exists', {
      function: 'executePublishMemory',
    });

    // Get unified public collection
    const publicCollection = await ensurePublicCollection(weaviateClient);
    
    logger.debug('Public collection ready', {
      function: 'executePublishMemory',
      collectionName: 'Memory_public',
    });

    // Create published memory (copy with modifications)
    const originalTags = Array.isArray(originalMemory.properties.tags)
      ? originalMemory.properties.tags
      : [];
    const additionalTags = Array.isArray(request.payload.additional_tags)
      ? request.payload.additional_tags
      : [];

    // Create published memory with space-specific fields
    const publishedMemory = {
      ...originalMemory.properties,
      // Add space-specific fields
      spaces: request.payload.spaces || ['the_void'],  // ✅ Array of spaces!
      author_id: userId, // Track original author
      published_at: new Date().toISOString(),
      discovery_count: 0,
      doc_type: 'space_memory',
      attribution: 'user' as const,
      // Merge additional tags
      tags: [...originalTags, ...additionalTags],
      // Update timestamps
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
    };

    logger.info('Inserting memory into Memory_public', {
      function: 'executePublishMemory',
      spaces: request.payload.spaces,
      spaceCount: request.payload.spaces?.length || 0,
      memoryId: request.payload.memory_id,
      hasUserId: !!(publishedMemory as any).user_id,
      hasAuthorId: !!publishedMemory.author_id,
    });
    
    // Insert directly into unified public collection
    const result = await publicCollection.data.insert(publishedMemory as any);
    
    logger.info('Memory published successfully', {
      function: 'executePublishMemory',
      spaceMemoryId: result,
      spaces: request.payload.spaces,
    });

    // Return minimal response with spaces array
    return JSON.stringify(
      {
        success: true,
        space_memory_id: result,
        spaces: request.payload.spaces || ['the_void'],
      },
      null,
      2
    );
  } catch (error) {
    handleToolError(error, {
      toolName: 'remember_confirm',
      userId,
      operation: 'execute publish_memory',
      action: 'publish_memory',
    });
  }
}
