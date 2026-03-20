/**
 * remember_deny tool
 * 
 * Generic denial tool for any pending action.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';

/**
 * Tool definition for remember_deny
 *
 * CRITICAL SAFETY: This tool must ONLY be called after explicit user denial
 * in a separate message. Never chain with other tools or call immediately after
 * receiving a token. The denial workflow requires:
 *
 * 1. Agent calls remember_publish (or other confirmable action)
 * 2. Agent receives token in response
 * 3. Agent presents details to user and asks for confirmation
 * 4. User responds in SEPARATE message with explicit denial
 * 5. Agent calls remember_deny in NEW response
 *
 * Proper user consent workflow must be followed.
 */
export const denyTool: Tool = {
  name: 'remember_deny',
  description: `Deny a pending action. The request will be marked as denied and the token invalidated. Works for any action that requires confirmation.

⚠️ CRITICAL SAFETY REQUIREMENTS:
Before executing this tool, you MUST:
1. Have received the confirmation token in a PREVIOUS tool response
2. Have presented the token details to the user for review
3. Have received EXPLICIT user denial in a SEPARATE user message
4. NEVER chain this tool with other tool calls in the same response
5. ALWAYS treat denials as standalone, deliberate actions

This ensures proper user consent workflow is followed.`,
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

interface DenyArgs {
  token: string;
  secret_token?: string;
}

/**
 * Handle remember_deny tool execution
 */
export async function handleDeny(
  args: DenyArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({ tool: 'remember_deny', userId, operation: 'deny action' });
  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    const { space } = createCoreServices(userId);
    const result = await space.deny({ token: args.token, secret_token: args.secret_token });

    return JSON.stringify(
      {
        success: result.success,
      },
      null,
      2
    );
  } catch (error) {
    debug.error('Tool failed', { error: error instanceof Error ? error.message : String(error) });
    handleToolError(error, {
      toolName: 'remember_deny',
      userId,
      operation: 'deny action',
      token: args.token,
    });
  }
}
