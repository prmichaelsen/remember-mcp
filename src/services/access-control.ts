/**
 * Access control service — per-memory access checks with escalation prevention.
 *
 * In ghost mode (default), query-level filtering handles trust at the Weaviate layer.
 * This service is needed for:
 * 1. Trust escalation penalty tracking
 * 2. Block management
 * 3. Prompt/hybrid enforcement modes (per-memory access checks)
 * 4. Future direct access tools
 *
 * See agent/design/access-control-result-pattern.md
 * See agent/design/local.ghost-persona-system.md
 */

import type { Memory } from '../types/memory.js';
import type { AccessResult } from '../types/access-result.js';
import type { GhostConfig } from '../types/ghost-config.js';
import { DEFAULT_GHOST_CONFIG } from '../types/ghost-config.js';
import { isTrustSufficient } from '@prmichaelsen/remember-core';

// ─── Types ─────────────────────────────────────────────────────────────────

/** Block record for a specific (accessor, memory) pair */
export interface MemoryBlock {
  blocked_at: string; // ISO 8601
  reason: string;
  attempt_count: number;
}

/** Attempt record for escalation tracking */
export interface AttemptRecord {
  count: number;
  last_attempt_at: string; // ISO 8601
}

/**
 * Provider interface for GhostConfig lookups.
 * In-memory stub now, Firestore implementation in M16.
 */
export interface GhostConfigProvider {
  getGhostConfig(ownerUserId: string): Promise<GhostConfig | null>;
}

/**
 * Provider interface for block and attempt tracking.
 * In-memory stub now, Firestore implementation in M16.
 */
export interface EscalationStore {
  getBlock(ownerUserId: string, accessorUserId: string, memoryId: string): Promise<MemoryBlock | null>;
  setBlock(ownerUserId: string, accessorUserId: string, memoryId: string, block: MemoryBlock): Promise<void>;
  removeBlock(ownerUserId: string, accessorUserId: string, memoryId: string): Promise<void>;
  getAttempts(ownerUserId: string, accessorUserId: string, memoryId: string): Promise<AttemptRecord | null>;
  incrementAttempts(ownerUserId: string, accessorUserId: string, memoryId: string): Promise<AttemptRecord>;
}

// ─── In-Memory Implementations ────────────────────────────────────────────

/** Stub GhostConfig provider — returns null (ghost not configured) */
export class StubGhostConfigProvider implements GhostConfigProvider {
  private configs: Map<string, GhostConfig> = new Map();

  async getGhostConfig(ownerUserId: string): Promise<GhostConfig | null> {
    return this.configs.get(ownerUserId) ?? null;
  }

  /** Test helper: set a GhostConfig for a user */
  setGhostConfig(ownerUserId: string, config: GhostConfig): void {
    this.configs.set(ownerUserId, config);
  }
}

/** In-memory escalation store for development/testing */
export class InMemoryEscalationStore implements EscalationStore {
  private blocks: Map<string, MemoryBlock> = new Map();
  private attempts: Map<string, AttemptRecord> = new Map();

  private key(ownerUserId: string, accessorUserId: string, memoryId: string): string {
    return `${ownerUserId}:${accessorUserId}:${memoryId}`;
  }

  async getBlock(ownerUserId: string, accessorUserId: string, memoryId: string): Promise<MemoryBlock | null> {
    return this.blocks.get(this.key(ownerUserId, accessorUserId, memoryId)) ?? null;
  }

  async setBlock(ownerUserId: string, accessorUserId: string, memoryId: string, block: MemoryBlock): Promise<void> {
    this.blocks.set(this.key(ownerUserId, accessorUserId, memoryId), block);
  }

  async removeBlock(ownerUserId: string, accessorUserId: string, memoryId: string): Promise<void> {
    this.blocks.delete(this.key(ownerUserId, accessorUserId, memoryId));
  }

  async getAttempts(ownerUserId: string, accessorUserId: string, memoryId: string): Promise<AttemptRecord | null> {
    return this.attempts.get(this.key(ownerUserId, accessorUserId, memoryId)) ?? null;
  }

  async incrementAttempts(ownerUserId: string, accessorUserId: string, memoryId: string): Promise<AttemptRecord> {
    const k = this.key(ownerUserId, accessorUserId, memoryId);
    const existing = this.attempts.get(k);
    const record: AttemptRecord = {
      count: (existing?.count ?? 0) + 1,
      last_attempt_at: new Date().toISOString(),
    };
    this.attempts.set(k, record);
    return record;
  }
}

// ─── Constants ─────────────────────────────────────────────────────────────

/** Trust penalty applied per failed access attempt */
const TRUST_PENALTY = 0.1;

/** Number of failed attempts before blocking */
const MAX_ATTEMPTS_BEFORE_BLOCK = 3;

// ─── Core Access Control ───────────────────────────────────────────────────

/**
 * Check if an accessor has permission to access a specific memory.
 *
 * Flow:
 * 1. Self-access → always granted (owner)
 * 2. Ghost not enabled → no_permission
 * 3. Accessor blocked by owner → no_permission
 * 4. Memory-specific block → blocked
 * 5. Insufficient trust → insufficient_trust (+ penalty, possible block)
 * 6. Sufficient trust → granted (trusted; trust 1.0 memories capped to existence-only by formatting layer)
 */
export async function checkMemoryAccess(
  accessorUserId: string,
  memory: Memory,
  ghostConfigProvider: GhostConfigProvider,
  escalationStore: EscalationStore,
): Promise<AccessResult> {
  const ownerUserId = memory.user_id;
  const memoryId = memory.id;

  // 1. Self-access always granted
  if (accessorUserId === ownerUserId) {
    return { status: 'granted', memory, access_level: 'owner' };
  }

  // 2. Check if ghost is enabled for owner
  const ghostConfig = await ghostConfigProvider.getGhostConfig(ownerUserId);
  if (!ghostConfig || !ghostConfig.enabled) {
    return { status: 'no_permission', owner_user_id: ownerUserId, accessor_user_id: accessorUserId };
  }

  // 3. Check if accessor is user-wide blocked
  if (ghostConfig.blocked_users.includes(accessorUserId)) {
    return { status: 'no_permission', owner_user_id: ownerUserId, accessor_user_id: accessorUserId };
  }

  // 4. Check memory-specific block
  const block = await escalationStore.getBlock(ownerUserId, accessorUserId, memoryId);
  if (block) {
    return {
      status: 'blocked',
      memory_id: memoryId,
      reason: block.reason,
      blocked_at: block.blocked_at,
    };
  }

  // 5. Check trust level
  const accessorTrust = resolveAccessorTrustLevel(ghostConfig, accessorUserId);
  const memoryTrust = memory.trust;

  if (!isTrustSufficient(memoryTrust, accessorTrust)) {
    // Apply escalation
    const result = await handleInsufficientTrust(
      ownerUserId, accessorUserId, memoryId, memoryTrust, accessorTrust, escalationStore
    );
    return result;
  }

  // 6. All checks pass (trust 1.0 memories capped to existence-only by formatting layer)
  return { status: 'granted', memory, access_level: 'trusted' };
}

// ─── Trust Escalation ──────────────────────────────────────────────────────

/**
 * Handle an insufficient trust access attempt.
 * Applies -0.1 penalty, blocks after 3 attempts.
 */
export async function handleInsufficientTrust(
  ownerUserId: string,
  accessorUserId: string,
  memoryId: string,
  requiredTrust: number,
  actualTrust: number,
  escalationStore: EscalationStore,
): Promise<AccessResult> {
  const attempt = await escalationStore.incrementAttempts(ownerUserId, accessorUserId, memoryId);

  // Block after MAX_ATTEMPTS_BEFORE_BLOCK
  if (attempt.count >= MAX_ATTEMPTS_BEFORE_BLOCK) {
    const block: MemoryBlock = {
      blocked_at: new Date().toISOString(),
      reason: `Access blocked after ${attempt.count} unauthorized attempts`,
      attempt_count: attempt.count,
    };
    await escalationStore.setBlock(ownerUserId, accessorUserId, memoryId, block);
    return {
      status: 'blocked',
      memory_id: memoryId,
      reason: block.reason,
      blocked_at: block.blocked_at,
    };
  }

  return {
    status: 'insufficient_trust',
    memory_id: memoryId,
    required_trust: requiredTrust,
    actual_trust: Math.max(0, actualTrust - TRUST_PENALTY),
    attempts_remaining: MAX_ATTEMPTS_BEFORE_BLOCK - attempt.count,
  };
}

/**
 * Check if access to a specific memory is blocked.
 */
export async function isMemoryBlocked(
  ownerUserId: string,
  accessorUserId: string,
  memoryId: string,
  escalationStore: EscalationStore,
): Promise<boolean> {
  const block = await escalationStore.getBlock(ownerUserId, accessorUserId, memoryId);
  return block !== null;
}

/**
 * Reset a memory-specific block (e.g., via grant_access).
 */
export async function resetBlock(
  ownerUserId: string,
  accessorUserId: string,
  memoryId: string,
  escalationStore: EscalationStore,
): Promise<void> {
  await escalationStore.removeBlock(ownerUserId, accessorUserId, memoryId);
}

// ─── Trust Resolution ──────────────────────────────────────────────────────

/**
 * Resolve the trust level for an accessor from GhostConfig.
 *
 * Priority: per_user_trust → default_friend_trust → default_public_trust → 0
 *
 * Note: "friend" vs "public" distinction will be determined by the calling
 * context in M16 (friend list, social graph). For now, non-per_user accessors
 * fall through to default_public_trust.
 */
export function resolveAccessorTrustLevel(ghostConfig: GhostConfig, accessorUserId: string): number {
  // 1. Per-user override
  if (accessorUserId in ghostConfig.per_user_trust) {
    return ghostConfig.per_user_trust[accessorUserId];
  }

  // 2. Fall through to public trust (friend detection deferred to M16)
  return ghostConfig.default_public_trust ?? 0;
}

// ─── Message Formatting ───────────────────────────────────────────────────

/**
 * Format an AccessResult into a human-readable message.
 */
export function formatAccessResultMessage(result: AccessResult): string {
  switch (result.status) {
    case 'granted':
      return result.access_level === 'owner'
        ? 'Access granted (owner).'
        : 'Access granted (trusted).';
    case 'insufficient_trust':
      return `Insufficient trust level. Required: ${result.required_trust.toFixed(2)}, actual: ${result.actual_trust.toFixed(2)}. ${result.attempts_remaining} attempt(s) remaining before access is blocked.`;
    case 'blocked':
      return `Access blocked: ${result.reason}`;
    case 'no_permission':
      return 'No permission to access this user\'s memories.';
    case 'not_found':
      return `Memory ${result.memory_id} not found.`;
    case 'deleted':
      return `Memory ${result.memory_id} was deleted on ${result.deleted_at}.`;
  }
}
