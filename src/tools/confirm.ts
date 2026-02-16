/**
 * remember_confirm tool
 * 
 * Generic confirmation tool that executes any pending action.
 * This is the second phase of the confirmation workflow.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { confirmationTokenService, type ConfirmationRequest } from '../services/confirmation-token.service.js';
import { getWeaviateClient, getMemoryCollectionName } from '../weaviate/client.js';
import { ensureSpaceCollection } from '../weaviate/space-schema.js';
import { handleToolError } from '../utils/error-handler.js';

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
    console.log('[remember_confirm] Starting confirmation:', {
      userId,
      token: args.token,
    });
    
    // Validate and confirm token
    const request = await confirmationTokenService.confirmRequest(userId, args.token);
    
    console.log('[remember_confirm] Token validation result:', {
      requestFound: !!request,
      action: request?.action,
    });

    if (!request) {
      console.log('[remember_confirm] Token invalid or expired');
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

    console.log('[remember_confirm] Executing action:', request.action);

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
    console.log('[executePublishMemory] Starting execution:', {
      userId,
      memoryId: request.payload.memory_id,
      targetSpace: request.target_collection,
    });
    
    // Fetch the memory NOW (during confirmation, not from stored payload)
    const weaviateClient = getWeaviateClient();
    const userCollection = weaviateClient.collections.get(
      getMemoryCollectionName(userId)
    );
    
    console.log('[executePublishMemory] Fetching original memory from:', getMemoryCollectionName(userId));

    const originalMemory = await userCollection.query.fetchObjectById(
      request.payload.memory_id
    );
    
    console.log('[executePublishMemory] Original memory fetch result:', {
      found: !!originalMemory,
      memoryId: request.payload.memory_id,
    });

    if (!originalMemory) {
      console.log('[executePublishMemory] Memory not found');
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
      console.log('[executePublishMemory] Permission denied - wrong owner');
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
    
    console.log('[executePublishMemory] Ensuring space collection:', request.target_collection || 'the_void');

    // Get target collection
    const targetCollection = await ensureSpaceCollection(
      weaviateClient,
      request.target_collection || 'the_void'
    );
    
    console.log('[executePublishMemory] Space collection ready');

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
      space_id: request.target_collection || 'the_void',
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

    console.log('[executePublishMemory] Inserting into space collection:', {
      spaceId: request.target_collection || 'the_void',
      memoryId: request.payload.memory_id,
      hasUserId: !!(publishedMemory as any).user_id,
      hasAuthorId: !!publishedMemory.author_id,
      hasSpaceId: !!publishedMemory.space_id,
    });
    
    // Insert directly - publishedMemory is already the properties object
    const result = await targetCollection.data.insert(publishedMemory as any);
    
    console.log('[executePublishMemory] Insert result:', {
      success: !!result,
      spaceMemoryId: result,
    });

    // Return minimal response - agent already knows original memory
    return JSON.stringify(
      {
        success: true,
        space_memory_id: result,
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
