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
    // Validate and confirm token
    const request = await confirmationTokenService.confirmRequest(userId, args.token);

    if (!request) {
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
    // Fetch the memory NOW (during confirmation, not from stored payload)
    const weaviateClient = getWeaviateClient();
    const userCollection = weaviateClient.collections.get(
      getMemoryCollectionName(userId)
    );

    const originalMemory = await userCollection.query.fetchObjectById(
      request.payload.memory_id
    );

    if (!originalMemory) {
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

    // Get target collection
    const targetCollection = await ensureSpaceCollection(
      weaviateClient,
      request.target_collection || 'the_void'
    );

    // Create published memory (copy with modifications)
    const originalTags = Array.isArray(originalMemory.properties.tags)
      ? originalMemory.properties.tags
      : [];
    const additionalTags = Array.isArray(request.payload.additional_tags)
      ? request.payload.additional_tags
      : [];

    const publishedMemory = {
      ...originalMemory.properties,
      // Override specific fields
      space_id: request.target_collection || 'the_void',
      author_id: userId, // Always attributed
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

    const result = await targetCollection.data.insert({
      properties: publishedMemory as any,
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
