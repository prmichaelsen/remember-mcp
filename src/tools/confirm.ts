/**
 * remember_confirm tool
 *
 * Generic confirmation tool that executes any pending action.
 * This is the second phase of the confirmation workflow.
 *
 * Memory Collection Pattern v2:
 * - Multi-space publication to Memory_spaces_public
 * - Multi-group publication to Memory_groups_{groupId}
 * - Composite IDs ({userId}.{memoryId}) for published memories
 * - Tracking arrays (space_ids, group_ids) on source and published memories
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { confirmationTokenService, type ConfirmationRequest } from '../services/confirmation-token.service.js';
import { getWeaviateClient, getMemoryCollectionName, fetchMemoryWithAllProperties } from '../weaviate/client.js';
import { ensurePublicCollection } from '../weaviate/space-schema.js';
import { handleToolError } from '../utils/error-handler.js';
import { logger } from '../utils/logger.js';
import { createDebugLogger } from '../utils/debug.js';
import { CollectionType, getCollectionName } from '../collections/dot-notation.js';
import { generateCompositeId, parseCompositeId } from '../collections/composite-ids.js';
import { addToSpaceIds, addToGroupIds, removeFromSpaceIds, removeFromGroupIds, getPublishedLocations } from '../collections/tracking-arrays.js';
import { parseRevisionHistory, buildRevisionHistory, type RevisionResult } from './revise.js';
import type { AuthContext } from '../types/auth.js';

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
  userId: string,
  authContext?: AuthContext
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

    // Handle retract_memory action
    if (request.action === 'retract_memory') {
      return await executeRetractMemory(request, userId);
    }

    // Handle revise_memory action
    if (request.action === 'revise_memory') {
      return await executeReviseMemory(request, userId);
    }

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
 *
 * Memory Collection Pattern v2:
 * - Publishes to Memory_spaces_public with composite ID
 * - Publishes to Memory_groups_{groupId} for each group
 * - Updates tracking arrays on source memory
 * - Supports rollback on partial failure
 */
async function executePublishMemory(
  request: ConfirmationRequest & { request_id: string },
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({
    tool: 'remember_confirm',
    userId,
    operation: 'execute_publish',
  });

  try {
    // Normalize arrays (handle undefined)
    const spaces = request.payload.spaces || [];
    const groups = request.payload.groups || [];
    
    debug.debug('Executing publish memory action', {
      memoryId: request.payload.memory_id,
      spaces,
      groups,
    });
    
    logger.info('Executing publish memory action', {
      function: 'executePublishMemory',
      userId,
      memoryId: request.payload.memory_id,
      spaces,
      groups,
      spaceCount: spaces.length,
      groupCount: groups.length,
    });
    
    // Validate that at least one destination is provided
    if (spaces.length === 0 && groups.length === 0) {
      return JSON.stringify(
        {
          success: false,
          error: 'No destinations',
          message: 'Must specify at least one space or group to publish to',
        },
        null,
        2
      );
    }
    
    // Fetch the memory NOW (during confirmation, not from stored payload)
    const weaviateClient = getWeaviateClient();
    const userCollectionName = getMemoryCollectionName(userId);
    const userCollection = weaviateClient.collections.get(userCollectionName);
    
    logger.debug('Fetching original memory', {
      function: 'executePublishMemory',
      collectionName: userCollectionName,
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

    // Generate composite ID for published memories
    const compositeId = generateCompositeId(userId, request.payload.memory_id);
    
    logger.debug('Generated composite ID', {
      function: 'executePublishMemory',
      compositeId,
      userId,
      memoryId: request.payload.memory_id,
    });
    
    // Get existing tracking arrays from source memory
    const existingSpaceIds: string[] = Array.isArray(originalMemory.properties.space_ids)
      ? originalMemory.properties.space_ids
      : [];
    const existingGroupIds: string[] = Array.isArray(originalMemory.properties.group_ids)
      ? originalMemory.properties.group_ids
      : [];
    
    // Prepare tags
    const originalTags = Array.isArray(originalMemory.properties.tags)
      ? originalMemory.properties.tags
      : [];
    const additionalTags = Array.isArray(request.payload.additional_tags)
      ? request.payload.additional_tags
      : [];
    const mergedTags = [...originalTags, ...additionalTags];
    
    // Track publication results for rollback
    const publicationResults: {
      spaces?: { success: boolean; id?: string; error?: string };
      groups: Array<{ groupId: string; success: boolean; id?: string; error?: string }>;
    } = { groups: [] };
    
    // STEP 1: Publish to spaces (Memory_spaces_public)
    if (spaces.length > 0) {
      logger.debug('Ensuring public spaces collection exists', {
        function: 'executePublishMemory',
      });

      const publicCollection = await ensurePublicCollection(weaviateClient);
      
      // Check if memory already exists in spaces collection with this composite ID
      let existingSpaceMemory = null;
      try {
        existingSpaceMemory = await fetchMemoryWithAllProperties(publicCollection, compositeId);
      } catch (e) {
        // Memory doesn't exist, which is fine
      }
      
      // Calculate new space_ids array
      const newSpaceIds = [...new Set([...existingSpaceIds, ...spaces])];
      
      // Create published memory with tracking arrays
      const publishedMemory: Record<string, any> = {
        ...originalMemory.properties,
        // Use composite ID as the document ID
        id: compositeId,
        // Tracking arrays (v2 feature)
        space_ids: newSpaceIds,
        group_ids: existingGroupIds,
        // Legacy compatibility
        spaces: spaces,
        // Publication metadata
        author_id: userId,
        published_at: new Date().toISOString(),
        discovery_count: 0,
        attribution: 'user' as const,
        // Merge tags
        tags: mergedTags,
      };
      
      // Remove internal Weaviate properties
      delete publishedMemory._additional;
      
      logger.info('Publishing memory to Memory_spaces_public', {
        function: 'executePublishMemory',
        compositeId,
        spaces,
        spaceIds: newSpaceIds,
      });
      
      try {
        if (existingSpaceMemory) {
          // Update existing memory
          await publicCollection.data.update({
            id: compositeId,
            properties: publishedMemory,
          });
          publicationResults.spaces = { success: true, id: compositeId };
        } else {
          // Insert new memory with specific ID
          await publicCollection.data.insert({
            id: compositeId,
            properties: publishedMemory,
          });
          publicationResults.spaces = { success: true, id: compositeId };
        }
        
        logger.info('Memory published to spaces successfully', {
          function: 'executePublishMemory',
          compositeId,
          spaces,
        });
      } catch (spaceError) {
        logger.error('Failed to publish to spaces', {
          function: 'executePublishMemory',
          error: spaceError instanceof Error ? spaceError.message : String(spaceError),
        });
        publicationResults.spaces = {
          success: false,
          error: spaceError instanceof Error ? spaceError.message : String(spaceError)
        };
      }
    }
    
    // STEP 2: Publish to groups (Memory_groups_{groupId})
    for (const groupId of groups) {
      const groupCollectionName = getCollectionName(CollectionType.GROUPS, groupId);
      
      logger.debug('Publishing to group collection', {
        function: 'executePublishMemory',
        groupId,
        collectionName: groupCollectionName,
      });
      
      try {
        const groupCollection = weaviateClient.collections.get(groupCollectionName);
        
        // Check if memory already exists in this group
        let existingGroupMemory = null;
        try {
          existingGroupMemory = await fetchMemoryWithAllProperties(groupCollection, compositeId);
        } catch (e) {
          // Memory doesn't exist in this group
        }
        
        // Calculate new group_ids array (for this group publication)
        const newGroupIds = [...new Set([...existingGroupIds, groupId])];
        
        // Create published memory for group
        const groupMemory: Record<string, any> = {
          ...originalMemory.properties,
          // Use composite ID
          id: compositeId,
          // Tracking arrays
          space_ids: existingSpaceIds,
          group_ids: newGroupIds,
          // Publication metadata
          author_id: userId,
          published_at: new Date().toISOString(),
          discovery_count: 0,
          attribution: 'user' as const,
          // Merge tags
          tags: mergedTags,
        };
        
        // Remove internal Weaviate properties
        delete groupMemory._additional;
        
        if (existingGroupMemory) {
          await groupCollection.data.update({
            id: compositeId,
            properties: groupMemory,
          });
        } else {
          await groupCollection.data.insert({
            id: compositeId,
            properties: groupMemory,
          });
        }
        
        publicationResults.groups.push({ groupId, success: true, id: compositeId });
        
        logger.info('Memory published to group successfully', {
          function: 'executePublishMemory',
          compositeId,
          groupId,
        });
      } catch (groupError) {
        logger.error('Failed to publish to group', {
          function: 'executePublishMemory',
          groupId,
          error: groupError instanceof Error ? groupError.message : String(groupError),
        });
        publicationResults.groups.push({
          groupId,
          success: false,
          error: groupError instanceof Error ? groupError.message : String(groupError)
        });
      }
    }
    
    // STEP 3: Update source memory with tracking arrays
    const finalSpaceIds = publicationResults.spaces?.success
      ? [...new Set([...existingSpaceIds, ...spaces])]
      : existingSpaceIds;
    
    const successfulGroups = publicationResults.groups
      .filter(g => g.success)
      .map(g => g.groupId);
    const finalGroupIds = [...new Set([...existingGroupIds, ...successfulGroups])];
    
    // Only update if there are changes
    if (finalSpaceIds.length > existingSpaceIds.length || finalGroupIds.length > existingGroupIds.length) {
      try {
        await userCollection.data.update({
          id: request.payload.memory_id,
          properties: {
            space_ids: finalSpaceIds,
            group_ids: finalGroupIds,
          },
        });
        
        logger.info('Updated source memory with tracking arrays', {
          function: 'executePublishMemory',
          memoryId: request.payload.memory_id,
          spaceIds: finalSpaceIds,
          groupIds: finalGroupIds,
        });
      } catch (updateError) {
        logger.warn('Failed to update source memory tracking arrays', {
          function: 'executePublishMemory',
          memoryId: request.payload.memory_id,
          error: updateError instanceof Error ? updateError.message : String(updateError),
        });
        // Don't fail the publish if this update fails
      }
    }
    
    // Build response
    const successfulPublications: string[] = [];
    const failedPublications: string[] = [];
    
    if (spaces.length > 0) {
      if (publicationResults.spaces?.success) {
        successfulPublications.push(`spaces: ${spaces.join(', ')}`);
      } else {
        failedPublications.push(`spaces: ${publicationResults.spaces?.error || 'unknown error'}`);
      }
    }
    
    for (const groupResult of publicationResults.groups) {
      if (groupResult.success) {
        successfulPublications.push(`group: ${groupResult.groupId}`);
      } else {
        failedPublications.push(`group ${groupResult.groupId}: ${groupResult.error || 'unknown error'}`);
      }
    }
    
    // Return result
    if (successfulPublications.length > 0) {
      return JSON.stringify(
        {
          success: true,
          composite_id: compositeId,
          published_to: successfulPublications,
          failed: failedPublications.length > 0 ? failedPublications : undefined,
          space_ids: finalSpaceIds,
          group_ids: finalGroupIds,
        },
        null,
        2
      );
    } else {
      return JSON.stringify(
        {
          success: false,
          error: 'Publication failed',
          message: 'Failed to publish to any destination',
          details: failedPublications,
        },
        null,
        2
      );
    }
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
  userId: string,
  authContext?: AuthContext
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
    const collectionName = getMemoryCollectionName(userId);
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

/**
 * Execute retract memory action
 *
 * Memory Collection Pattern v2:
 * - Selective retraction from specific spaces/groups
 * - Space memories are orphaned (remain in Memory_spaces_public with empty tracking arrays)
 * - Group memories are deleted from group collections
 * - Tracking arrays updated on source memory
 */
async function executeRetractMemory(
  request: ConfirmationRequest & { request_id: string },
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({
    tool: 'remember_confirm',
    userId,
    operation: 'execute_retract',
  });

  try {
    // Normalize arrays (handle undefined)
    const spaces = request.payload.spaces || [];
    const groups = request.payload.groups || [];

    debug.debug('Executing retract memory action', {
      memoryId: request.payload.memory_id,
      spaces,
      groups,
    });

    logger.info('Executing retract memory action', {
      function: 'executeRetractMemory',
      userId,
      memoryId: request.payload.memory_id,
      spaces,
      groups,
      spaceCount: spaces.length,
      groupCount: groups.length,
    });

    // Fetch the source memory
    const weaviateClient = getWeaviateClient();
    const userCollectionName = getMemoryCollectionName(userId);
    const userCollection = weaviateClient.collections.get(userCollectionName);

    const sourceMemory = await fetchMemoryWithAllProperties(
      userCollection,
      request.payload.memory_id
    );

    if (!sourceMemory) {
      logger.info('Source memory not found for retraction', {
        function: 'executeRetractMemory',
        memoryId: request.payload.memory_id,
      });
      return JSON.stringify(
        {
          success: false,
          error: 'Memory not found',
          message: `Source memory ${request.payload.memory_id} no longer exists`,
        },
        null,
        2
      );
    }

    // Get current tracking arrays
    const currentSpaceIds: string[] = Array.isArray(sourceMemory.properties.space_ids)
      ? sourceMemory.properties.space_ids
      : [];
    const currentGroupIds: string[] = Array.isArray(sourceMemory.properties.group_ids)
      ? sourceMemory.properties.group_ids
      : [];

    // Generate composite ID for published memories
    const compositeId = generateCompositeId(userId, request.payload.memory_id);

    // Track retraction results
    const retractionResults: {
      spaces?: { success: boolean; error?: string };
      groups: Array<{ groupId: string; success: boolean; error?: string }>;
    } = { groups: [] };

    // STEP 1: Retract from spaces (Memory_spaces_public)
    // Space memories are ORPHANED, not deleted, for historical reference
    if (spaces.length > 0) {
      try {
        const publicCollection = weaviateClient.collections.get(
          getCollectionName(CollectionType.SPACES)
        );

        // Fetch the published memory from spaces
        const publishedMemory = await fetchMemoryWithAllProperties(publicCollection, compositeId);

        if (publishedMemory) {
          // Calculate new space_ids (remove retracted spaces)
          const newSpaceIds = currentSpaceIds.filter(id => !spaces.includes(id));

          // Update the published memory with new tracking arrays
          // Memory remains even if space_ids becomes empty (orphaned)
          await publicCollection.data.update({
            id: compositeId,
            properties: {
              space_ids: newSpaceIds,
              retracted_at: new Date().toISOString(),
            },
          });

          retractionResults.spaces = { success: true };

          logger.info('Memory retracted from spaces (orphaned)', {
            function: 'executeRetractMemory',
            compositeId,
            retractedSpaces: spaces,
            remainingSpaces: newSpaceIds,
            isOrphaned: newSpaceIds.length === 0 && currentGroupIds.length === 0,
          });
        } else {
          // Memory not found in spaces collection
          retractionResults.spaces = {
            success: false,
            error: 'Memory not found in spaces collection',
          };
          logger.warn('Memory not found in spaces collection', {
            function: 'executeRetractMemory',
            compositeId,
          });
        }
      } catch (spaceError) {
        logger.error('Failed to retract from spaces', {
          function: 'executeRetractMemory',
          error: spaceError instanceof Error ? spaceError.message : String(spaceError),
        });
        retractionResults.spaces = {
          success: false,
          error: spaceError instanceof Error ? spaceError.message : String(spaceError),
        };
      }
    }

    // STEP 2: Retract from groups (Memory_groups_{groupId})
    // Group memories are ORPHANED (same as spaces), not deleted
    // This preserves historical data while making it unsearchable by default
    for (const groupId of groups) {
      const groupCollectionName = getCollectionName(CollectionType.GROUPS, groupId);

      try {
        const groupCollection = weaviateClient.collections.get(groupCollectionName);

        // Check if memory exists in this group
        const groupMemory = await fetchMemoryWithAllProperties(groupCollection, compositeId);

        if (groupMemory) {
          // Get current group_ids from the group memory
          const groupMemoryGroupIds: string[] = Array.isArray(groupMemory.properties.group_ids)
            ? groupMemory.properties.group_ids
            : [];
          
          // Remove this group from the group_ids array
          const newGroupIds = groupMemoryGroupIds.filter(id => id !== groupId);
          
          // Update the memory with new tracking arrays (orphan if empty)
          await groupCollection.data.update({
            id: compositeId,
            properties: {
              group_ids: newGroupIds,
              retracted_at: new Date().toISOString(),
            },
          });

          retractionResults.groups.push({ groupId, success: true });

          logger.info('Memory retracted from group (orphaned)', {
            function: 'executeRetractMemory',
            compositeId,
            groupId,
            remainingGroups: newGroupIds,
            isOrphaned: newGroupIds.length === 0,
          });
        } else {
          // Memory not found in this group
          retractionResults.groups.push({
            groupId,
            success: false,
            error: 'Memory not found in group',
          });
          logger.warn('Memory not found in group collection', {
            function: 'executeRetractMemory',
            compositeId,
            groupId,
          });
        }
      } catch (groupError) {
        logger.error('Failed to retract from group', {
          function: 'executeRetractMemory',
          groupId,
          error: groupError instanceof Error ? groupError.message : String(groupError),
        });
        retractionResults.groups.push({
          groupId,
          success: false,
          error: groupError instanceof Error ? groupError.message : String(groupError),
        });
      }
    }

    // STEP 3: Update source memory tracking arrays
    const finalSpaceIds = retractionResults.spaces?.success
      ? currentSpaceIds.filter(id => !spaces.includes(id))
      : currentSpaceIds;

    const successfulGroupRetractions = retractionResults.groups
      .filter(g => g.success)
      .map(g => g.groupId);
    const finalGroupIds = currentGroupIds.filter(id => !successfulGroupRetractions.includes(id));

    // Update source memory
    try {
      await userCollection.data.update({
        id: request.payload.memory_id,
        properties: {
          space_ids: finalSpaceIds,
          group_ids: finalGroupIds,
        },
      });

      logger.info('Updated source memory tracking arrays after retraction', {
        function: 'executeRetractMemory',
        memoryId: request.payload.memory_id,
        spaceIds: finalSpaceIds,
        groupIds: finalGroupIds,
      });
    } catch (updateError) {
      logger.warn('Failed to update source memory tracking arrays after retraction', {
        function: 'executeRetractMemory',
        memoryId: request.payload.memory_id,
        error: updateError instanceof Error ? updateError.message : String(updateError),
      });
      // Don't fail the retraction if this update fails
    }

    // Build response
    const successfulRetractions: string[] = [];
    const failedRetractions: string[] = [];

    if (spaces.length > 0) {
      if (retractionResults.spaces?.success) {
        successfulRetractions.push(`spaces: ${spaces.join(', ')}`);
      } else {
        failedRetractions.push(`spaces: ${retractionResults.spaces?.error || 'unknown error'}`);
      }
    }

    for (const groupResult of retractionResults.groups) {
      if (groupResult.success) {
        successfulRetractions.push(`group: ${groupResult.groupId}`);
      } else {
        failedRetractions.push(`group ${groupResult.groupId}: ${groupResult.error || 'unknown error'}`);
      }
    }

    // Return result
    if (successfulRetractions.length > 0) {
      return JSON.stringify(
        {
          success: true,
          composite_id: compositeId,
          retracted_from: successfulRetractions,
          failed: failedRetractions.length > 0 ? failedRetractions : undefined,
          space_ids: finalSpaceIds,
          group_ids: finalGroupIds,
          is_orphaned: finalSpaceIds.length === 0 && finalGroupIds.length === 0,
        },
        null,
        2
      );
    } else {
      return JSON.stringify(
        {
          success: false,
          error: 'Retraction failed',
          message: 'Failed to retract from any destination',
          details: failedRetractions,
        },
        null,
        2
      );
    }
  } catch (error) {
    debug.error('Execute retract failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    handleToolError(error, {
      toolName: 'remember_confirm',
      userId,
      operation: 'execute retract_memory',
      action: 'retract_memory',
    });
  }
}

/**
 * Execute revise memory action
 *
 * Memory Collection Pattern v2:
 * - Syncs content from source memory to all published copies
 * - Preserves old content in revision_history (max 10 entries)
 * - Updates revised_at and revision_count on each copy
 * - Supports partial success (some locations may fail)
 */
async function executeReviseMemory(
  request: ConfirmationRequest & { request_id: string },
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({
    tool: 'remember_confirm',
    userId,
    operation: 'execute_revise',
  });

  try {
    const { memory_id, space_ids = [], group_ids = [] } = request.payload;

    debug.debug('Executing revise memory action', {
      memoryId: memory_id,
      spaceIds: space_ids,
      groupIds: group_ids,
    });

    logger.info('Executing revise memory action', {
      function: 'executeReviseMemory',
      userId,
      memoryId: memory_id,
      spaceCount: space_ids.length,
      groupCount: group_ids.length,
    });

    // Fetch source memory
    const weaviateClient = getWeaviateClient();
    const userCollectionName = getMemoryCollectionName(userId);
    const userCollection = weaviateClient.collections.get(userCollectionName);

    const sourceMemory = await fetchMemoryWithAllProperties(
      userCollection,
      memory_id
    );

    if (!sourceMemory) {
      return JSON.stringify(
        {
          success: false,
          error: 'Memory not found',
          message: `Source memory ${memory_id} no longer exists`,
        },
        null,
        2
      );
    }

    // Verify ownership again
    if (sourceMemory.properties.user_id !== userId) {
      return JSON.stringify(
        {
          success: false,
          error: 'Permission denied',
          message: 'You can only revise your own memories',
        },
        null,
        2
      );
    }

    const newContent = String(sourceMemory.properties.content ?? '');
    const revisedAt = new Date().toISOString();
    const compositeId = generateCompositeId(userId, memory_id);
    const results: RevisionResult[] = [];

    logger.info('Revising published copies', {
      function: 'executeReviseMemory',
      compositeId,
      spaceCount: space_ids.length > 0 ? 1 : 0,
      groupCount: group_ids.length,
    });

    /**
     * Update content + revision tracking in a single collection.
     */
    async function reviseInCollection(
      collectionName: string,
      locationLabel: string
    ): Promise<void> {
      try {
        const collection = weaviateClient.collections.get(collectionName);
        const publishedMemory = await fetchMemoryWithAllProperties(
          collection,
          compositeId
        );

        if (!publishedMemory) {
          results.push({
            location: locationLabel,
            status: 'skipped',
            error: 'Published copy not found (may have been deleted)',
          });
          logger.warn('Published copy not found in collection', {
            function: 'executeReviseMemory',
            collectionName,
            compositeId,
          });
          return;
        }

        const oldContent = String(publishedMemory.properties.content ?? '');

        // Build updated revision history (only if content actually changed)
        let revisionHistory = parseRevisionHistory(
          publishedMemory.properties.revision_history
        );
        if (oldContent !== newContent) {
          revisionHistory = buildRevisionHistory(
            revisionHistory,
            oldContent,
            revisedAt
          );
        }

        const currentRevisionCount =
          typeof publishedMemory.properties.revision_count === 'number'
            ? publishedMemory.properties.revision_count
            : 0;

        await collection.data.update({
          id: compositeId,
          properties: {
            content: newContent,
            revised_at: revisedAt,
            revision_count: currentRevisionCount + 1,
            revision_history: JSON.stringify(revisionHistory),
          },
        });

        results.push({ location: locationLabel, status: 'success' });

        logger.info('Revised published memory in collection', {
          function: 'executeReviseMemory',
          collectionName,
          compositeId,
          revisionCount: currentRevisionCount + 1,
          contentChanged: oldContent !== newContent,
        });
      } catch (err) {
        results.push({
          location: locationLabel,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
        logger.error('Failed to revise in collection', {
          function: 'executeReviseMemory',
          collectionName,
          compositeId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Revise in Memory_spaces_public (single collection for all spaces)
    if (space_ids.length > 0) {
      await reviseInCollection(
        getCollectionName(CollectionType.SPACES),
        'Memory_spaces_public'
      );
    }

    // Revise in each group's collection
    for (const groupId of group_ids) {
      await reviseInCollection(
        getCollectionName(CollectionType.GROUPS, groupId),
        `Memory_groups_${groupId}`
      );
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    logger.info('Revise execution complete', {
      function: 'executeReviseMemory',
      userId,
      memoryId: memory_id,
      successCount,
      failedCount,
      skippedCount,
    });

    return JSON.stringify(
      {
        success: successCount > 0,
        composite_id: compositeId,
        revised_at: revisedAt,
        summary: {
          total: results.length,
          success: successCount,
          failed: failedCount,
          skipped: skippedCount,
        },
        results,
        ...(failedCount > 0
          ? {
              warnings: [
                `Failed to revise ${failedCount} of ${results.length} location(s)`,
              ],
            }
          : {}),
      },
      null,
      2
    );
  } catch (error) {
    debug.error('Execute revise failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    handleToolError(error, {
      toolName: 'remember_confirm',
      userId,
      operation: 'execute revise_memory',
      action: 'revise_memory',
    });
  }
}
