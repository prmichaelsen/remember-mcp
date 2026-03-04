/**
 * GhostConfig Firestore Service
 *
 * CRUD operations for ghost/persona configuration stored in Firestore.
 * Implements GhostConfigProvider interface from access-control.ts.
 *
 * Firestore path: {BASE}.users/{ownerUserId}/ghost_config/settings
 *
 * See agent/design/local.ghost-persona-system.md
 */

import { getDocument, setDocument, FieldValue } from '../firestore/init.js';
import { BASE } from '../firestore/paths.js';
import { logger } from '../utils/logger.js';
import type { GhostConfig, TrustEnforcementMode } from '../types/ghost-config.js';
import { DEFAULT_GHOST_CONFIG } from '../types/ghost-config.js';
import type { GhostConfigProvider } from './access-control.js';

const SERVICE = 'GhostConfigService';

/**
 * Get the Firestore collection path for a user's ghost config.
 */
function getGhostConfigPath(ownerUserId: string): { collectionPath: string; docId: string } {
  return {
    collectionPath: `${BASE}.users/${ownerUserId}/ghost_config`,
    docId: 'settings',
  };
}

/**
 * Get a user's ghost configuration.
 * Returns defaults merged with stored config, or null if no config exists.
 */
export async function getGhostConfig(ownerUserId: string): Promise<GhostConfig> {
  try {
    const { collectionPath, docId } = getGhostConfigPath(ownerUserId);
    const doc = await getDocument(collectionPath, docId);

    if (!doc) {
      return { ...DEFAULT_GHOST_CONFIG };
    }

    return { ...DEFAULT_GHOST_CONFIG, ...doc } as GhostConfig;
  } catch (error) {
    logger.error('Failed to get ghost config', {
      service: SERVICE,
      ownerUserId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ...DEFAULT_GHOST_CONFIG };
  }
}

/**
 * Set (upsert) a user's ghost configuration.
 * Merges partial config with existing values.
 */
export async function setGhostConfigFields(
  ownerUserId: string,
  config: Partial<GhostConfig>
): Promise<GhostConfig> {
  const { collectionPath, docId } = getGhostConfigPath(ownerUserId);
  await setDocument(collectionPath, docId, config, { merge: true });

  logger.info('Ghost config updated', {
    service: SERVICE,
    ownerUserId,
    updatedKeys: Object.keys(config),
  });

  return getGhostConfig(ownerUserId);
}

/**
 * Set a per-user trust level override.
 */
export async function setUserTrust(
  ownerUserId: string,
  targetUserId: string,
  trustLevel: number
): Promise<void> {
  if (trustLevel < 0 || trustLevel > 1) {
    throw new Error(`Trust level must be between 0 and 1, got ${trustLevel}`);
  }

  const current = await getGhostConfig(ownerUserId);
  const per_user_trust = { ...current.per_user_trust, [targetUserId]: trustLevel };

  const { collectionPath, docId } = getGhostConfigPath(ownerUserId);
  await setDocument(collectionPath, docId, { per_user_trust }, { merge: true });

  logger.info('User trust level set', {
    service: SERVICE,
    ownerUserId,
    targetUserId,
    trustLevel,
  });
}

/**
 * Remove a per-user trust override (reverts to default).
 */
export async function removeUserTrust(
  ownerUserId: string,
  targetUserId: string
): Promise<void> {
  const current = await getGhostConfig(ownerUserId);
  const per_user_trust = { ...current.per_user_trust };
  delete per_user_trust[targetUserId];

  const { collectionPath, docId } = getGhostConfigPath(ownerUserId);
  await setDocument(collectionPath, docId, { per_user_trust }, { merge: true });

  logger.info('User trust override removed', {
    service: SERVICE,
    ownerUserId,
    targetUserId,
  });
}

/**
 * Block a user from ghost access.
 * Uses FieldValue.arrayUnion for atomic add without reading first (idempotent).
 */
export async function blockUser(
  ownerUserId: string,
  targetUserId: string
): Promise<void> {
  const { collectionPath, docId } = getGhostConfigPath(ownerUserId);
  await setDocument(collectionPath, docId, {
    blocked_users: FieldValue.arrayUnion(targetUserId),
  }, { merge: true });

  logger.info('User blocked from ghost access', {
    service: SERVICE,
    ownerUserId,
    targetUserId,
  });
}

/**
 * Unblock a user from ghost access.
 * Uses FieldValue.arrayRemove for atomic remove without reading first (safe if not present).
 */
export async function unblockUser(
  ownerUserId: string,
  targetUserId: string
): Promise<void> {
  const { collectionPath, docId } = getGhostConfigPath(ownerUserId);
  await setDocument(collectionPath, docId, {
    blocked_users: FieldValue.arrayRemove(targetUserId),
  }, { merge: true });

  logger.info('User unblocked from ghost access', {
    service: SERVICE,
    ownerUserId,
    targetUserId,
  });
}

/**
 * Check if a user's ghost is enabled.
 */
export async function isGhostEnabled(ownerUserId: string): Promise<boolean> {
  const config = await getGhostConfig(ownerUserId);
  return config.enabled;
}

/**
 * Validate a partial GhostConfig update.
 * Throws if any field values are invalid.
 */
export function validateGhostConfigUpdate(config: Partial<GhostConfig>): void {
  if (config.default_friend_trust !== undefined) {
    if (config.default_friend_trust < 0 || config.default_friend_trust > 1) {
      throw new Error(`default_friend_trust must be between 0 and 1, got ${config.default_friend_trust}`);
    }
  }
  if (config.default_public_trust !== undefined) {
    if (config.default_public_trust < 0 || config.default_public_trust > 1) {
      throw new Error(`default_public_trust must be between 0 and 1, got ${config.default_public_trust}`);
    }
  }
  if (config.enforcement_mode !== undefined) {
    const valid: TrustEnforcementMode[] = ['query', 'prompt', 'hybrid'];
    if (!valid.includes(config.enforcement_mode)) {
      throw new Error(`enforcement_mode must be one of ${valid.join(', ')}, got ${config.enforcement_mode}`);
    }
  }
  if (config.per_user_trust !== undefined) {
    for (const [userId, level] of Object.entries(config.per_user_trust)) {
      if (level < 0 || level > 1) {
        throw new Error(`Trust level for ${userId} must be between 0 and 1, got ${level}`);
      }
    }
  }
}

/**
 * Firestore-backed GhostConfigProvider implementation.
 * Replaces StubGhostConfigProvider for production use.
 */
export class FirestoreGhostConfigProvider implements GhostConfigProvider {
  async getGhostConfig(ownerUserId: string): Promise<GhostConfig | null> {
    const config = await getGhostConfig(ownerUserId);
    // If ghost is not enabled, return null (same contract as StubGhostConfigProvider)
    if (!config.enabled) {
      return null;
    }
    return config;
  }
}
