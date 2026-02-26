/**
 * remember_revise tool
 *
 * Syncs updated content from a source memory to all its published copies
 * in spaces and groups (Memory Collection Pattern v2).
 *
 * No confirmation flow needed — content sync is non-destructive.
 * The old content is preserved in revision_history before being replaced.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  getWeaviateClient,
  getMemoryCollectionName,
  fetchMemoryWithAllProperties,
} from '../weaviate/client.js';
import { handleToolError } from '../utils/error-handler.js';
import { logger } from '../utils/logger.js';
import { createDebugLogger } from '../utils/debug.js';
import { CollectionType, getCollectionName } from '../collections/dot-notation.js';
import { generateCompositeId } from '../collections/composite-ids.js';

/** Maximum number of revision history entries to retain */
const MAX_REVISION_HISTORY = 10;

/**
 * Tool definition for remember_revise
 */
export const reviseTool: Tool = {
  name: 'remember_revise',
  description: `Sync updated content from your source memory to all its published copies in spaces and groups.

Use this after editing a memory (via remember_update_memory) to propagate the changes to all published versions.

How it works:
- Loads the latest content from your personal Memory_users_{userId} collection
- Updates each published copy in Memory_spaces_public (for spaces) and Memory_groups_{groupId} (for groups)
- Preserves the previous content in a revision_history field (up to 10 versions)
- Sets revised_at timestamp on all updated copies
- Reports success/failure per location (partial success supported)

Requirements:
- The memory must be published (has space_ids or group_ids populated)
- You must own the source memory`,
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
 */
export async function handleRevise(
  args: ReviseArgs,
  userId: string
): Promise<string> {
  const debug = createDebugLogger({
    tool: 'remember_revise',
    userId,
    operation: 'revise',
  });

  try {
    debug.info('Tool invoked');
    debug.trace('Arguments', { args });

    logger.info('Starting revise operation', {
      tool: 'remember_revise',
      userId,
      memoryId: args.memory_id,
    });

    // Load source memory from user's personal collection
    const weaviateClient = getWeaviateClient();
    const userCollectionName = getMemoryCollectionName(userId);
    const userCollection = weaviateClient.collections.get(userCollectionName);

    const sourceMemory = await fetchMemoryWithAllProperties(
      userCollection,
      args.memory_id
    );

    if (!sourceMemory) {
      logger.info('Source memory not found', {
        tool: 'remember_revise',
        memoryId: args.memory_id,
      });
      return JSON.stringify(
        {
          success: false,
          error: 'Memory not found',
          message: `Memory ${args.memory_id} does not exist`,
        },
        null,
        2
      );
    }

    // Verify ownership
    if (sourceMemory.properties.user_id !== userId) {
      logger.warn('Permission denied', {
        tool: 'remember_revise',
        memoryId: args.memory_id,
        memoryOwner: sourceMemory.properties.user_id,
        requestingUser: userId,
      });
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

    // Get tracking arrays
    const spaceIds: string[] = Array.isArray(sourceMemory.properties.space_ids)
      ? sourceMemory.properties.space_ids
      : [];
    const groupIds: string[] = Array.isArray(sourceMemory.properties.group_ids)
      ? sourceMemory.properties.group_ids
      : [];

    // Validate the memory is published somewhere
    if (spaceIds.length === 0 && groupIds.length === 0) {
      logger.info('Memory has no published copies', {
        tool: 'remember_revise',
        memoryId: args.memory_id,
      });
      return JSON.stringify(
        {
          success: false,
          error: 'Not published',
          message:
            'Memory has no published copies to revise. Publish first with remember_publish.',
          context: {
            memory_id: args.memory_id,
            space_ids: [],
            group_ids: [],
          },
        },
        null,
        2
      );
    }

    const newContent = String(sourceMemory.properties.content ?? '');
    const revisedAt = new Date().toISOString();
    const compositeId = generateCompositeId(userId, args.memory_id);
    const results: RevisionResult[] = [];

    logger.info('Revising published copies', {
      tool: 'remember_revise',
      compositeId,
      spaceCount: spaceIds.length > 0 ? 1 : 0, // all spaces share one collection
      groupCount: groupIds.length,
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
            tool: 'remember_revise',
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
          tool: 'remember_revise',
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
          tool: 'remember_revise',
          collectionName,
          compositeId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Revise in Memory_spaces_public (single collection for all spaces)
    if (spaceIds.length > 0) {
      await reviseInCollection(
        getCollectionName(CollectionType.SPACES),
        'Memory_spaces_public'
      );
    }

    // Revise in each group's collection
    for (const groupId of groupIds) {
      await reviseInCollection(
        getCollectionName(CollectionType.GROUPS, groupId),
        `Memory_groups_${groupId}`
      );
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    logger.info('Revise operation complete', {
      tool: 'remember_revise',
      userId,
      memoryId: args.memory_id,
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
    debug.error('Tool failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    handleToolError(error, {
      toolName: 'remember_revise',
      userId,
      operation: 'revise memory',
      memoryId: args.memory_id,
    });
  }
}
