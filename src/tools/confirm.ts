/**
 * remember_confirm tool
 *
 * Generic confirmation tool that executes any pending action.
 * This is the second phase of the confirmation workflow.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { confirmationTokenService, type ConfirmationRequest } from '../services/confirmation-token.service.js';
import { getWeaviateClient, getMemoryCollectionName, fetchMemoryWithAllProperties, sanitizeUserId } from '../weaviate/client.js';
import { ensurePublicCollection } from '../weaviate/space-schema.js';
import { handleToolError } from '../utils/error-handler.js';
import { logger } from '../utils/logger.js';
import { createDebugLogger } from '../utils/debug.js';

/**
 * Tool definition for remember_confirm
 *
 * CRITICAL SAFETY: This tool must ONLY be called after explicit user confirmation
 * in a separate message. Never chain with other tools or call immediately after
 * receiving a token. The confirmation workflow requires:
 *
 * 1. Agent calls remember_publish (or other confirmable action)
 * 2. Agent receives token in response
 * 3. Agent presents details to user and asks for confirmation
 * 4. User responds in SEPARATE message with explicit yes/no
 * 5. Agent calls remember_confirm or remember_deny in NEW response
 *
 * Chaining confirmations bypasses user consent and violates security model.
 */
export const confirmTool: Tool = {
  name: 'remember_confirm',
  description: `Confirm and execute a pending action using the token. Works for any action that requires confirmation (publish, delete, etc.).

⚠️ CRITICAL SAFETY REQUIREMENTS:
Before executing this tool, you MUST:
1. Have received the confirmation token in a PREVIOUS tool response
2. Have presented the token details to the user for review
3. Have received EXPLICIT user confirmation in a SEPARATE user message
4. NEVER chain this tool with other tool calls in the same response
5. ALWAYS treat confirmations as standalone, deliberate actions

Violating these requirements bypasses user consent and is a security violation.`,
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
  const debug = createDebugLogger({
    tool: 'remember_confirm',
    userId,
    operation: 'confirm_action',
  });

  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { token: args.token });
    
    logger.info('Starting confirmation', {
      tool: 'remember_confirm',
      userId,
      token: args.token,
    });
    
    // Validate and confirm token
    debug.debug('Validating confirmation token');
    const request = await debug.time('Confirm token', async () => {
      return await confirmationTokenService.confirmRequest(userId, args.token);
    });
    
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

    // Handle delete_memory action
    if (request.action === 'delete_memory') {
      return await executeDeleteMemory(request, userId);
    }

    // Add other action types here as needed
    // if (request.action === 'retract_memory') {
    //   return await executeRetractMemory(request, userId);
    // }

    throw new Error(`Unknown action type: ${request.action}`);
  } catch (error) {
    debug.error('Tool failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
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
  const debug = createDebugLogger({
    tool: 'remember_confirm',
    userId,
    operation: 'execute_publish',
  });

  try {
    debug.debug('Executing publish memory action', {
      memoryId: request.payload.memory_id,
      spaces: request.payload.spaces,
    });
    
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

    const originalMemory = await debug.time('Fetch original memory', async () => {
      return await fetchMemoryWithAllProperties(
        userCollection,
        request.payload.memory_id
      );
    });
    
    logger.info('Original memory fetch result', {
      function: 'executePublishMemory',
      found: !!originalMemory,
      memoryId: request.payload.memory_id,
      hasProperties: !!originalMemory?.properties,
      propertyCount: originalMemory?.properties ? Object.keys(originalMemory.properties).length : 0,
      propertyKeys: originalMemory?.properties ? Object.keys(originalMemory.properties) : [],
      hasTitle: !!originalMemory?.properties?.title,
      hasContent: !!originalMemory?.properties?.content,
      hasUserId: !!originalMemory?.properties?.user_id,
      hasTags: !!originalMemory?.properties?.tags,
      hasWeight: !!originalMemory?.properties?.weight,
      contentLength: originalMemory?.properties?.content?.length || 0,
      titleValue: originalMemory?.properties?.title || 'NO_TITLE',
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

    // Check if memory has already been published
    if (originalMemory.properties.space_memory_id) {
      const requestedSpaces = request.payload.spaces?.join(', ') || 'unknown';
      logger.warn('Memory already published', {
        function: 'executePublishMemory',
        memoryId: request.payload.memory_id,
        existingSpaceMemoryId: originalMemory.properties.space_memory_id,
        requestedSpaces: request.payload.spaces,
      });
      return JSON.stringify(
        {
          success: false,
          error: 'Already published',
          message: `This memory has already been published to this space. Space memory ID: ${originalMemory.properties.space_memory_id}`,
          space_memory_id: originalMemory.properties.space_memory_id,
          requested_spaces: request.payload.spaces,
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

    // Validate payload has required fields
    if (!request.payload.spaces || !Array.isArray(request.payload.spaces) || request.payload.spaces.length === 0) {
      throw new Error('Payload missing required field: spaces');
    }
    
    // Create published memory - preserve ALL original properties
    const publishedMemory = {
      ...originalMemory.properties,
      // Add space-specific fields (don't overwrite existing properties)
      spaces: request.payload.spaces,  // Required field (validated above)
      author_id: userId, // Track original author
      published_at: new Date().toISOString(),
      discovery_count: 0,
      attribution: 'user' as const,
      // Merge additional tags with original tags
      tags: [...originalTags, ...additionalTags],
      // Keep doc_type as 'memory' (space_memory concept was removed)
      // Keep original created_at, updated_at, version (don't overwrite)
    };

    logger.info('Inserting memory into Memory_public', {
      function: 'executePublishMemory',
      spaces: request.payload.spaces,
      spaceCount: request.payload.spaces?.length || 0,
      memoryId: request.payload.memory_id,
      hasUserId: !!(publishedMemory as any).user_id,
      hasAuthorId: !!publishedMemory.author_id,
      publishedMemoryKeys: Object.keys(publishedMemory),
      publishedMemoryKeyCount: Object.keys(publishedMemory).length,
      hasContent: !!publishedMemory.content,
      hasTitle: !!publishedMemory.title,
      contentLength: publishedMemory.content?.length || 0,
      titleValue: publishedMemory.title || 'NO_TITLE',
    });
    
    // Insert directly into unified public collection
    // CRITICAL: Weaviate insert API expects {properties: {...}}, not the properties directly!
    const result = await debug.time('Insert into Memory_public', async () => {
      return await publicCollection.data.insert({
        properties: publishedMemory,
      });
    });
    
    logger.info('Memory published successfully', {
      function: 'executePublishMemory',
      spaceMemoryId: result,
      spaces: request.payload.spaces,
    });
    
    debug.info('Memory published successfully', {
      spaceMemoryId: result,
      spaces: request.payload.spaces,
    });

    // Update original memory with space_memory_id for bidirectional linking
    try {
      await userCollection.data.update({
        id: request.payload.memory_id,
        properties: {
          space_memory_id: result,
        },
      });
      
      logger.info('Updated original memory with space_memory_id', {
        function: 'executePublishMemory',
        memoryId: request.payload.memory_id,
        spaceMemoryId: result,
      });
    } catch (updateError) {
      logger.warn('Failed to update original memory with space_memory_id', {
        function: 'executePublishMemory',
        memoryId: request.payload.memory_id,
        spaceMemoryId: result,
        error: updateError instanceof Error ? updateError.message : String(updateError),
      });
      // Don't fail the publish if this update fails - it's not critical
    }

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
    debug.error('Execute publish failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    handleToolError(error, {
      toolName: 'remember_confirm',
      userId,
      operation: 'execute publish_memory',
      action: 'publish_memory',
    });
  }
}

/**
 * Execute delete memory action
 */
async function executeDeleteMemory(
  request: ConfirmationRequest & { request_id: string },
  userId: string
): Promise<string> {
  try {
    logger.info('Executing delete memory action', {
      function: 'executeDeleteMemory',
      userId,
      memoryId: request.payload.memory_id,
      hasReason: !!request.payload.reason,
    });

    const { memory_id, reason } = request.payload;

    // Soft delete the memory
    const client = getWeaviateClient();
    const collectionName = `Memory_${sanitizeUserId(userId)}`;
    const collection = client.collections.get(collectionName);

    await collection.data.update({
      id: memory_id,
      properties: {
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        deletion_reason: reason || null,
      },
    });

    logger.info('Memory soft-deleted successfully', {
      function: 'executeDeleteMemory',
      userId,
      memoryId: memory_id,
      deletedAt: new Date().toISOString(),
    });

    return JSON.stringify(
      {
        success: true,
        memory_id,
        message: 'Memory deleted successfully',
      },
      null,
      2
    );
  } catch (error) {
    logger.error('Failed to execute delete memory', {
      function: 'executeDeleteMemory',
      userId,
      memoryId: request.payload.memory_id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
