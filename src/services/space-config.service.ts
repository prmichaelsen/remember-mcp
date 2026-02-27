/**
 * Space/Group Configuration Service
 *
 * Per-space and per-group behavioral configuration stored in Firestore.
 * Controls moderation requirements, write modes, and other behavioral rules.
 */

import { getDocument, setDocument } from '../firestore/init.js';
import { logger } from '../utils/logger.js';
import type { WriteMode } from '../types/auth.js';

export interface SpaceConfig {
  require_moderation: boolean;
  default_write_mode: WriteMode;
}

export const DEFAULT_SPACE_CONFIG: SpaceConfig = {
  require_moderation: false,
  default_write_mode: 'owner_only',
};

/**
 * Get the Firestore path for a space or group config document.
 */
function getConfigPath(id: string, type: 'space' | 'group'): { collectionPath: string; docId: string } {
  const prefix = type === 'space' ? 'spaces' : 'groups';
  return {
    collectionPath: `${prefix}/${id}/config`,
    docId: 'settings',
  };
}

/**
 * Get configuration for a space or group.
 * Returns defaults merged with any stored config.
 */
export async function getSpaceConfig(
  id: string,
  type: 'space' | 'group'
): Promise<SpaceConfig> {
  try {
    const { collectionPath, docId } = getConfigPath(id, type);
    const doc = await getDocument(collectionPath, docId);

    if (!doc) {
      return { ...DEFAULT_SPACE_CONFIG };
    }

    return { ...DEFAULT_SPACE_CONFIG, ...doc };
  } catch (error) {
    logger.error('Failed to get space config', {
      service: 'SpaceConfigService',
      id,
      type,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ...DEFAULT_SPACE_CONFIG };
  }
}

/**
 * Set configuration for a space or group.
 * Merges partial config with existing values.
 */
export async function setSpaceConfig(
  id: string,
  type: 'space' | 'group',
  config: Partial<SpaceConfig>
): Promise<void> {
  const { collectionPath, docId } = getConfigPath(id, type);
  await setDocument(collectionPath, docId, config, { merge: true });

  logger.info('Space config updated', {
    service: 'SpaceConfigService',
    id,
    type,
    updatedKeys: Object.keys(config),
  });
}
