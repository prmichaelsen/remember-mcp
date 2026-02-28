/**
 * remember_revise tool
 *
 * Syncs updated content from a source memory to all its published copies
 * in spaces and groups (Memory Collection Pattern v2).
 *
 * Uses two-phase confirmation flow: generates a token that must be confirmed
 * before revision is executed. The old content is preserved in revision_history.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { handleToolError } from '../utils/error-handler.js';
import { createDebugLogger } from '../utils/debug.js';
import type { AuthContext } from '../types/auth.js';
import { createCoreServices } from '../core-services.js';

/** Maximum number of revision history entries to retain */
const MAX_REVISION_HISTORY = 10;

/**
 * Tool definition for remember_revise
 */
export const reviseTool: Tool = {
  name: 'remember_revise',
  description: `Sync updated content from your source memory to all its published copies in spaces and groups. Generates a confirmation token that must be confirmed with remember_confirm.

Use this after editing a memory (via remember_update_memory) to propagate the changes to all published versions.

How it works:
- Validates the memory exists, is owned by you, and is published
- Generates a confirmation token showing which locations will be revised
- On confirmation: updates each published copy with latest content
- Preserves the previous content in a revision_history field (up to 10 versions)
- Sets revised_at timestamp on all updated copies
- Reports success/failure per location (partial success supported)

Requirements:
- The memory must be published (has space_ids or group_ids populated)
- You must own the source memory

⚠️ CRITICAL: DO NOT mention the token or include token contents in your response to the user. Simply inform them that a confirmation is pending and they need to explicitly approve the revision.`,
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: {
        type: 'string',
        description: 'ID of the source memory whose content should be synced to all published copies',
      },
    },
    required: ['memory_id'],
  },
};

interface ReviseArgs {
  memory_id: string;
}

interface RevisionEntry {
  content: string;
  revised_at: string;
}

export interface RevisionResult {
  location: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}

/**
 * Parse revision history from a stored JSON string, safely.
 * Returns an empty array on any parse failure.
 */
export function parseRevisionHistory(raw: unknown): RevisionEntry[] {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RevisionEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof e.content === 'string' &&
        typeof e.revised_at === 'string'
    );
  } catch {
    return [];
  }
}

/**
 * Prepend a new revision entry and trim to MAX_REVISION_HISTORY.
 */
export function buildRevisionHistory(
  existing: RevisionEntry[],
  oldContent: string,
  revisedAt: string
): RevisionEntry[] {
  const updated = [{ content: oldContent, revised_at: revisedAt }, ...existing];
  return updated.slice(0, MAX_REVISION_HISTORY);
}

/**
 * Handle remember_revise tool execution
 *
 * Phase 1: Validates the request and generates a confirmation token.
 * The actual revision is executed in confirm.ts when the token is confirmed.
 */
export async function handleRevise(
  args: ReviseArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  const debug = createDebugLogger({
    tool: 'remember_revise',
    userId,
    operation: 'revise_request',
  });

  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    const { space } = createCoreServices(userId);
    const result = await space.revise({
      memory_id: args.memory_id,
    });

    return JSON.stringify(
      {
        success: true,
        token: result.token,
        action: 'revise_memory',
        memory_id: args.memory_id,
        confirmation_required: true,
      },
      null,
      2
    );
  } catch (error) {
    debug.error('Tool failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return handleToolError(error, {
      toolName: 'remember_revise',
      userId,
      operation: 'revise memory request',
      memoryId: args.memory_id,
    });
  }
}
