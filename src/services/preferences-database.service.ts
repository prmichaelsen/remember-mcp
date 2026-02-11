/**
 * Preferences Database Service
 * Handles all Firestore operations for user preferences
 */

import { getDocument, setDocument } from '../firestore/init.js';
import { getUserPreferencesPath } from '../firestore/paths.js';
import { logger } from '../utils/logger.js';
import {
  UserPreferences,
  DEFAULT_PREFERENCES,
} from '../types/preferences.js';

export class PreferencesDatabaseService {
  /**
   * Get user preferences
   * Returns defaults if preferences don't exist
   */
  static async getPreferences(userId: string): Promise<UserPreferences> {
    try {
      const pathParts = getUserPreferencesPath(userId).split('/');
      const docId = pathParts.pop()!;
      const collectionPath = pathParts.join('/');

      const doc = await getDocument(collectionPath, docId);

      if (!doc) {
        // Return defaults with user_id
        const now = new Date().toISOString();
        return {
          user_id: userId,
          ...DEFAULT_PREFERENCES,
          created_at: now,
          updated_at: now,
        };
      }

      return doc as UserPreferences;
    } catch (error) {
      logger.error('Failed to get preferences:', error);
      throw new Error(`Failed to get preferences: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update user preferences (partial update with merge)
   * Creates with defaults if preferences don't exist
   */
  static async updatePreferences(
    userId: string,
    updates: Partial<Omit<UserPreferences, 'user_id' | 'created_at'>>
  ): Promise<UserPreferences> {
    try {
      const pathParts = getUserPreferencesPath(userId).split('/');
      const docId = pathParts.pop()!;
      const collectionPath = pathParts.join('/');

      const now = new Date().toISOString();
      const doc = await getDocument(collectionPath, docId);

      if (!doc) {
        // Create with defaults + updates
        const newPrefs: UserPreferences = {
          user_id: userId,
          ...DEFAULT_PREFERENCES,
          ...updates,
          created_at: now,
          updated_at: now,
        };

        await setDocument(collectionPath, docId, newPrefs);
        logger.info('Preferences created with defaults', { userId });
        return newPrefs;
      }

      // Update existing preferences with merge
      const updateData = {
        ...updates,
        updated_at: now,
      };

      await setDocument(collectionPath, docId, updateData, { merge: true });
      logger.info('Preferences updated', { userId });

      // Return updated preferences
      const updatedDoc = await getDocument(collectionPath, docId);
      return updatedDoc as UserPreferences;
    } catch (error) {
      logger.error('Failed to update preferences:', error);
      throw new Error(`Failed to update preferences: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create preferences with defaults
   */
  static async createPreferences(userId: string): Promise<UserPreferences> {
    try {
      const pathParts = getUserPreferencesPath(userId).split('/');
      const docId = pathParts.pop()!;
      const collectionPath = pathParts.join('/');

      const now = new Date().toISOString();
      const preferences: UserPreferences = {
        user_id: userId,
        ...DEFAULT_PREFERENCES,
        created_at: now,
        updated_at: now,
      };

      await setDocument(collectionPath, docId, preferences);
      logger.info('Preferences created', { userId });

      return preferences;
    } catch (error) {
      logger.error('Failed to create preferences:', error);
      throw new Error(`Failed to create preferences: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
