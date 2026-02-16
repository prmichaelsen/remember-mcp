/**
 * remember_deny tool
 * 
 * Generic denial tool for any pending action.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { confirmationTokenService } from '../services/confirmation-token.service.js';
import { handleToolError } from '../utils/error-handler.js';

/**
 * Tool definition for remember_deny
 */
export const denyTool: Tool = {
  name: 'remember_deny',
  description: 'Deny a pending action. The request will be marked as denied and the token invalidated. Works for any action that requires confirmation.',
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

interface DenyArgs {
  token: string;
}

/**
 * Handle remember_deny tool execution
 */
export async function handleDeny(
  args: DenyArgs,
  userId: string
): Promise<string> {
  try {
    const success = await confirmationTokenService.denyRequest(userId, args.token);

    if (!success) {
      return JSON.stringify(
        {
          success: false,
          error: 'Invalid token',
          message: 'Token not found or already used',
        },
        null,
        2
      );
    }

    return JSON.stringify(
      {
        success: true,
      },
      null,
      2
    );
  } catch (error) {
    handleToolError(error, {
      toolName: 'remember_deny',
      userId,
      operation: 'deny action',
      token: args.token,
    });
  }
}
