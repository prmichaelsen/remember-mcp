/**
 * remember_ghost_config tool
 *
 * Manage ghost/persona configuration: enable/disable ghost,
 * set trust defaults, manage per-user trust, block/unblock users.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import type { TrustEnforcementMode } from '../types/ghost-config.js';
import {
  getGhostConfig,
  setGhostConfigFields,
  setUserTrust,
  removeUserTrust,
  blockUser,
  unblockUser,
  validateGhostConfigUpdate,
} from '../services/ghost-config.service.js';

type GhostConfigAction = 'get' | 'set' | 'set_trust' | 'remove_trust' | 'block' | 'unblock';

export const ghostConfigTool: Tool = {
  name: 'remember_ghost_config',
  description: `Manage ghost/persona configuration. Controls who can interact with your ghost and at what trust level.

Actions:
- get: View current ghost configuration
- set: Update ghost settings (enabled, trust defaults, enforcement mode)
- set_trust: Set a per-user trust level override (1-5 integer)
- remove_trust: Remove a per-user trust override (revert to default)
- block: Block a user from ghost access entirely
- unblock: Unblock a previously blocked user

Trust levels (1-5 integer scale) control what information your ghost can share:
- 1 (PUBLIC): Full access (all content revealed)
- 2 (INTERNAL): Partial access (content with sensitive fields redacted)
- 3 (CONFIDENTIAL): Summary only (AI-generated summary, no raw content)
- 4 (RESTRICTED): Metadata only (tags, type, dates — no content)
- 5 (SECRET): Existence only ("A memory exists about this")

Ghost is disabled by default. Enable it to allow others to chat with your AI representation.`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['get', 'set', 'set_trust', 'remove_trust', 'block', 'unblock'],
        description: 'Action to perform',
      },
      // For 'set' action
      enabled: {
        type: 'boolean',
        description: 'Enable/disable ghost conversations (for "set" action)',
      },
      public_ghost_enabled: {
        type: 'boolean',
        description: 'Allow non-friends to chat with ghost (for "set" action)',
      },
      default_friend_trust: {
        type: 'integer',
        description: 'Default trust level for friends (1-5 integer, for "set" action)',
        minimum: 1,
        maximum: 5,
      },
      default_public_trust: {
        type: 'integer',
        description: 'Default trust level for strangers (1-5 integer, for "set" action)',
        minimum: 1,
        maximum: 5,
      },
      enforcement_mode: {
        type: 'string',
        enum: ['query', 'prompt', 'hybrid'],
        description: 'Trust enforcement mode (for "set" action). "query" (default) is most secure.',
      },
      // For 'set_trust' / 'remove_trust' / 'block' / 'unblock' actions
      target_user_id: {
        type: 'string',
        description: 'Target user ID (for set_trust, remove_trust, block, unblock)',
      },
      trust_level: {
        type: 'integer',
        description: 'Trust level to assign (1-5 integer, for "set_trust" action)',
        minimum: 1,
        maximum: 5,
      },
    },
    required: ['action'],
  },
};

interface GhostConfigArgs {
  action: GhostConfigAction;
  enabled?: boolean;
  public_ghost_enabled?: boolean;
  default_friend_trust?: number;
  default_public_trust?: number;
  enforcement_mode?: TrustEnforcementMode;
  target_user_id?: string;
  trust_level?: number;
}

/**
 * Handle remember_ghost_config tool
 */
export async function handleGhostConfig(
  args: GhostConfigArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_ghost_config', userId, operation: args.action });
  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    switch (args.action) {
      case 'get': {
        const config = await getGhostConfig(userId);
        return JSON.stringify({
          success: true,
          config,
          trust_tier_guide: {
            '0.0': 'Existence only',
            '0.25': 'Metadata only (default friend trust)',
            '0.5': 'Summary only',
            '0.75': 'Partial access',
            '1.0': 'Full access',
          },
        }, null, 2);
      }

      case 'set': {
        const updates: any = {};
        if (args.enabled !== undefined) updates.enabled = args.enabled;
        if (args.public_ghost_enabled !== undefined) updates.public_ghost_enabled = args.public_ghost_enabled;
        if (args.default_friend_trust !== undefined) updates.default_friend_trust = args.default_friend_trust;
        if (args.default_public_trust !== undefined) updates.default_public_trust = args.default_public_trust;
        if (args.enforcement_mode !== undefined) updates.enforcement_mode = args.enforcement_mode;

        if (Object.keys(updates).length === 0) {
          throw new Error('No fields to update. Provide at least one of: enabled, public_ghost_enabled, default_friend_trust, default_public_trust, enforcement_mode');
        }

        validateGhostConfigUpdate(updates);
        const config = await setGhostConfigFields(userId, updates);

        return JSON.stringify({
          success: true,
          message: 'Ghost configuration updated',
          updated_fields: Object.keys(updates),
          config,
        }, null, 2);
      }

      case 'set_trust': {
        if (!args.target_user_id) {
          throw new Error('target_user_id is required for set_trust action');
        }
        if (args.trust_level === undefined) {
          throw new Error('trust_level is required for set_trust action');
        }

        await setUserTrust(userId, args.target_user_id, args.trust_level);

        return JSON.stringify({
          success: true,
          message: `Trust level for ${args.target_user_id} set to ${args.trust_level}`,
          target_user_id: args.target_user_id,
          trust_level: args.trust_level,
        }, null, 2);
      }

      case 'remove_trust': {
        if (!args.target_user_id) {
          throw new Error('target_user_id is required for remove_trust action');
        }

        await removeUserTrust(userId, args.target_user_id);

        return JSON.stringify({
          success: true,
          message: `Trust override for ${args.target_user_id} removed (reverted to default)`,
          target_user_id: args.target_user_id,
        }, null, 2);
      }

      case 'block': {
        if (!args.target_user_id) {
          throw new Error('target_user_id is required for block action');
        }

        await blockUser(userId, args.target_user_id);

        return JSON.stringify({
          success: true,
          message: `${args.target_user_id} blocked from ghost access`,
          target_user_id: args.target_user_id,
        }, null, 2);
      }

      case 'unblock': {
        if (!args.target_user_id) {
          throw new Error('target_user_id is required for unblock action');
        }

        await unblockUser(userId, args.target_user_id);

        return JSON.stringify({
          success: true,
          message: `${args.target_user_id} unblocked from ghost access`,
          target_user_id: args.target_user_id,
        }, null, 2);
      }

      default:
        throw new Error(`Unknown action: ${args.action}. Valid actions: get, set, set_trust, remove_trust, block, unblock`);
    }
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_ghost_config',
      operation: args.action,
      userId,
    });
    throw error; // handleToolError may not throw
  }
}
