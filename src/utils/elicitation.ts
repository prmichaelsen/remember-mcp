/**
 * MCP Elicitation helper for confirmation flows.
 *
 * Checks if the connected client supports elicitation, issues a
 * confirmation-only prompt via server.elicitInput(), and returns a
 * discriminated result.  Falls back gracefully when the client (or
 * server reference) doesn't support elicitation.
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

export interface ElicitConfirmParams {
  server?: Server;
  message: string;
}

export type ElicitConfirmResult =
  | { type: 'confirmed' }
  | { type: 'declined'; reason: string }
  | { type: 'unsupported' };

/**
 * Ask the user for confirmation via MCP elicitation.
 *
 * - Returns `{ type: 'confirmed' }` when the user accepts.
 * - Returns `{ type: 'declined', reason }` when the user declines or cancels.
 * - Returns `{ type: 'unsupported' }` when elicitation is unavailable
 *   (no server, client lacks capability, or elicitation throws).
 */
export async function elicitConfirmation(
  params: ElicitConfirmParams
): Promise<ElicitConfirmResult> {
  const { server, message } = params;

  if (!server) return { type: 'unsupported' };

  const caps = server.getClientCapabilities();
  if (!caps?.elicitation) return { type: 'unsupported' };

  try {
    const result = await server.elicitInput({
      message,
      requestedSchema: { type: 'object', properties: {} },
    });

    if (result.action === 'accept') return { type: 'confirmed' };
    return { type: 'declined', reason: result.action };
  } catch {
    // If elicitation throws (e.g. transport doesn't support it),
    // fall back to token flow rather than failing the tool call.
    return { type: 'unsupported' };
  }
}
