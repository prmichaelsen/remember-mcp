/**
 * Firestore-backed Escalation Store
 *
 * Persists trust escalation tracking (attempt counts, blocks) to Firestore.
 * Replaces InMemoryEscalationStore for production use.
 *
 * Firestore path: {BASE}.users/{ownerUserId}/ghost_escalation/{accessorUserId}:{memoryId}
 *
 * See agent/design/local.ghost-persona-system.md
 */

import { getDocument, setDocument, deleteDocument } from '../firestore/init.js';
import { BASE } from '../firestore/paths.js';
import { logger } from '../utils/logger.js';
import type { EscalationStore, MemoryBlock, AttemptRecord } from './access-control.js';

const SERVICE = 'EscalationService';

/**
 * Get Firestore collection path for escalation data.
 */
function getEscalationPath(ownerUserId: string): string {
  return `${BASE}.users/${ownerUserId}/ghost_escalation`;
}

/**
 * Build a document ID from accessor and memory.
 * Uses colon separator (safe in Firestore doc IDs).
 */
function docId(accessorUserId: string, memoryId: string): string {
  return `${accessorUserId}:${memoryId}`;
}

/**
 * Firestore-backed escalation store for production use.
 */
export class FirestoreEscalationStore implements EscalationStore {
  async getBlock(ownerUserId: string, accessorUserId: string, memoryId: string): Promise<MemoryBlock | null> {
    try {
      const doc = await getDocument(
        getEscalationPath(ownerUserId),
        docId(accessorUserId, memoryId)
      );

      if (!doc || !doc.blocked) {
        return null;
      }

      return {
        blocked_at: doc.blocked_at,
        reason: doc.reason || 'Trust escalation limit reached',
        attempt_count: doc.attempt_count || 0,
      };
    } catch (error) {
      logger.error('Failed to get block', {
        service: SERVICE,
        ownerUserId,
        accessorUserId,
        memoryId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async setBlock(ownerUserId: string, accessorUserId: string, memoryId: string, block: MemoryBlock): Promise<void> {
    await setDocument(
      getEscalationPath(ownerUserId),
      docId(accessorUserId, memoryId),
      {
        blocked: true,
        blocked_at: block.blocked_at,
        reason: block.reason,
        attempt_count: block.attempt_count,
        accessor_user_id: accessorUserId,
        memory_id: memoryId,
      },
      { merge: true }
    );

    logger.info('User blocked from memory', {
      service: SERVICE,
      ownerUserId,
      accessorUserId,
      memoryId,
      reason: block.reason,
    });
  }

  async removeBlock(ownerUserId: string, accessorUserId: string, memoryId: string): Promise<void> {
    await deleteDocument(
      getEscalationPath(ownerUserId),
      docId(accessorUserId, memoryId)
    );

    logger.info('Block removed', {
      service: SERVICE,
      ownerUserId,
      accessorUserId,
      memoryId,
    });
  }

  async getAttempts(ownerUserId: string, accessorUserId: string, memoryId: string): Promise<AttemptRecord | null> {
    try {
      const doc = await getDocument(
        getEscalationPath(ownerUserId),
        docId(accessorUserId, memoryId)
      );

      if (!doc || doc.attempt_count === undefined) {
        return null;
      }

      return {
        count: doc.attempt_count,
        last_attempt_at: doc.last_attempt_at,
      };
    } catch (error) {
      logger.error('Failed to get attempts', {
        service: SERVICE,
        ownerUserId,
        accessorUserId,
        memoryId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async incrementAttempts(ownerUserId: string, accessorUserId: string, memoryId: string): Promise<AttemptRecord> {
    const existing = await this.getAttempts(ownerUserId, accessorUserId, memoryId);
    const newCount = (existing?.count ?? 0) + 1;
    const now = new Date().toISOString();

    await setDocument(
      getEscalationPath(ownerUserId),
      docId(accessorUserId, memoryId),
      {
        attempt_count: newCount,
        last_attempt_at: now,
        accessor_user_id: accessorUserId,
        memory_id: memoryId,
      },
      { merge: true }
    );

    return { count: newCount, last_attempt_at: now };
  }
}
