/**
 * remember_request_set_trust_level tool
 * Requests a trust level change for a memory via confirmation flow.
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';
import { elicitConfirmation } from '../utils/elicitation.js';

export const requestSetTrustLevelTool = {
  name: 'remember_request_set_trust_level',
  description: `Request a trust level change for a memory. Returns a confirmation token.

Trust levels (1-5 integer scale):
  1 = PUBLIC — anyone can see
  2 = INTERNAL — friends/known users
  3 = CONFIDENTIAL — trusted friends
  4 = RESTRICTED — close/intimate contacts
  5 = SECRET — owner only (default for new memories)

After requesting, use remember_confirm with the returned token to apply the change.
Lowering trust (e.g. 5→1) makes the memory MORE visible. Raising trust makes it LESS visible.

This is the ONLY way to change a memory's trust level. Trust cannot be set during creation or update.`,
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: {
        type: 'string',
        description: 'ID of the memory to change trust level for',
      },
      trust_level: {
        type: 'integer',
        description: 'New trust level (1-5)',
        minimum: 1,
        maximum: 5,
      },
    },
    required: ['memory_id', 'trust_level'],
  },
};

interface RequestSetTrustLevelArgs {
  memory_id: string;
  trust_level: number;
}

export async function handleRequestSetTrustLevel(
  args: RequestSetTrustLevelArgs,
  userId: string,
  authContext?: AuthContext,
  server?: Server
): Promise<string> {
  const debug = createDebugLogger({
    tool: 'remember_request_set_trust_level',
    userId,
    operation: 'request set trust level',
  });

  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    // Validate trust level is integer 1-5
    if (!Number.isInteger(args.trust_level) || args.trust_level < 1 || args.trust_level > 5) {
      return JSON.stringify({
        error: 'Invalid trust level',
        message: 'Trust level must be an integer from 1 (PUBLIC) to 5 (SECRET).',
      }, null, 2);
    }

    const { memory } = createCoreServices(userId);

    const result = await memory.requestSetTrustLevel({
      memory_id: args.memory_id,
      trust_level: args.trust_level,
    });

    const TRUST_NAMES: Record<number, string> = {
      1: 'PUBLIC',
      2: 'INTERNAL',
      3: 'CONFIDENTIAL',
      4: 'RESTRICTED',
      5: 'SECRET',
    };

    const currentName = TRUST_NAMES[result.current_trust_level] || 'UNKNOWN';
    const requestedName = TRUST_NAMES[result.requested_trust_level] || 'UNKNOWN';

    const confirmation = await elicitConfirmation({
      server,
      message: `Change trust level for memory "${args.memory_id}" from ${currentName} (${result.current_trust_level}) to ${requestedName} (${result.requested_trust_level})?`,
    });

    if (confirmation.type === 'confirmed') {
      const confirmResult = await memory.confirmSetTrustLevel(result.token);
      return JSON.stringify({
        success: true,
        memory_id: confirmResult.memory_id,
        previous_trust_level: confirmResult.previous_trust_level,
        new_trust_level: confirmResult.new_trust_level,
        updated_at: confirmResult.updated_at,
        message: `Trust level changed from ${TRUST_NAMES[confirmResult.previous_trust_level] || confirmResult.previous_trust_level} to ${TRUST_NAMES[confirmResult.new_trust_level] || confirmResult.new_trust_level}`,
      }, null, 2);
    }

    if (confirmation.type === 'declined') {
      return JSON.stringify({
        success: false,
        message: 'Trust level change cancelled by user.',
      }, null, 2);
    }

    // Fallback: return token for legacy confirm/deny flow
    return JSON.stringify({
      token: result.token,
      request_id: result.request_id,
      created_at: result.created_at,
      memory_id: result.memory_id,
      current_trust_level: result.current_trust_level,
      requested_trust_level: result.requested_trust_level,
      current_trust_name: currentName,
      requested_trust_name: requestedName,
      expires_at: result.expires_at,
      message: `Trust level change requested: ${currentName} (${result.current_trust_level}) → ${requestedName} (${result.requested_trust_level}). Confirm with token to apply.`,
    }, null, 2);
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_request_set_trust_level',
      operation: 'request set trust level',
      userId,
      memoryId: args.memory_id,
    });
    return JSON.stringify({ error: 'Unexpected error' });
  }
}
