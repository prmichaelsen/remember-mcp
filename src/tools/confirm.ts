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
import { getWeaviateClient, getMemoryCollectionName } from '../weaviate/client.js';
import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';

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
      secret_token: {
        type: 'string',
        description: 'HMAC secret token for guard-protected operations. Only required when confirmation guard is enabled on the server.',
      },
    },
    required: ['token'],
  },
};

interface ConfirmArgs {
  token: string;
  secret_token?: string;
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

    const { space, token: tokenService } = createCoreServices(userId);

    // Peek at token to determine action type without consuming it
    const request = await tokenService.validateToken(userId, args.token);

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

    // Handle delete_memory separately (core's confirm doesn't support it)
    if (request.action === 'delete_memory') {
      // Consume the token
      const confirmed = await tokenService.confirmRequest(userId, args.token);
      if (!confirmed) {
        return JSON.stringify(
          {
            success: false,
            error: 'Token already consumed',
            message: 'The confirmation token has already been used.',
          },
          null,
          2
        );
      }

      const { memory_id, reason } = confirmed.payload;

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

      return JSON.stringify(
        {
          success: true,
          memory_id,
          message: 'Memory deleted successfully',
        },
        null,
        2
      );
    }

    // Handle set_trust_level via MemoryService
    if (request.action === 'set_trust_level') {
      const { memory } = createCoreServices(userId);
      const result = await (memory as any).confirmSetTrustLevel(args.token);
      return JSON.stringify(
        {
          success: true,
          memory_id: result.memory_id,
          previous_trust_level: result.previous_trust_level,
          new_trust_level: result.new_trust_level,
          updated_at: result.updated_at,
          message: `Trust level changed from ${result.previous_trust_level} to ${result.new_trust_level}`,
        },
        null,
        2
      );
    }

    // Delegate publish/retract/revise to core SpaceService
    const result = await space.confirm({ token: args.token, secret_token: args.secret_token } as any);

    // Format response based on action type
    if (result.action === 'retract_memory') {
      return JSON.stringify(
        {
          success: result.success,
          composite_id: result.composite_id,
          retracted_from: result.retracted_from,
          failed: result.failed?.length ? result.failed : undefined,
          space_ids: result.space_ids,
          group_ids: result.group_ids,
          is_orphaned: (result.space_ids?.length === 0) && (result.group_ids?.length === 0),
        },
        null,
        2
      );
    }

    if (result.action === 'revise_memory') {
      const results = result.results || [];
      const successCount = results.filter((r: any) => r.status === 'success').length;
      const failedCount = results.filter((r: any) => r.status === 'failed').length;
      const skippedCount = results.filter((r: any) => r.status === 'skipped').length;

      return JSON.stringify(
        {
          success: result.success,
          composite_id: result.composite_id,
          revised_at: result.revised_at,
          summary: {
            total: results.length,
            success: successCount,
            failed: failedCount,
            skipped: skippedCount,
          },
          results,
          ...(failedCount > 0
            ? { warnings: [`Failed to revise ${failedCount} of ${results.length} location(s)`] }
            : {}),
        },
        null,
        2
      );
    }

    // Default: publish_memory (and any future action types)
    return JSON.stringify(
      {
        success: result.success,
        composite_id: result.composite_id,
        published_to: result.published_to,
        failed: result.failed?.length ? result.failed : undefined,
        space_ids: result.space_ids,
        group_ids: result.group_ids,
      },
      null,
      2
    );
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
