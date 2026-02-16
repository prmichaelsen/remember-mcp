/**
 * Preferences Database Service
 * Handles all Firestore operations for user preferences
 */

import { getFirestore } from '../firestore/init.js';
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
      const db = getFirestore();
      const pathParts = getUserPreferencesPath(userId).split('/');
      const docId = pathParts.pop()!;
      const collectionPath = pathParts.join('/');

      const doc = await db.doc(`${collectionPath}/${docId}`).get();

      if (!doc.exists) {
        // Return defaults with user_id
        const now = new Date().toISOString();
        return {
          user_id: userId,
          ...DEFAULT_PREFERENCES,
          created_at: now,
          updated_at: now,
        };
      }

      return doc.data() as UserPreferences;
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
      const db = getFirestore();
      const pathParts = getUserPreferencesPath(userId).split('/');
      const docId = pathParts.pop()!;
      const collectionPath = pathParts.join('/');
      const docRef = db.doc(`${collectionPath}/${docId}`);

      const now = new Date().toISOString();
      const doc = await docRef.get();

      if (!doc.exists) {
        // Create with defaults + updates
        const newPrefs: UserPreferences = {
          user_id: userId,
          ...DEFAULT_PREFERENCES,
          ...updates,
          created_at: now,
          updated_at: now,
        };

        await docRef.set(newPrefs);
        logger.info('Preferences created with defaults', { userId });
        return newPrefs;
      }

      // Update existing preferences with merge
      const updateData = {
        ...updates,
        updated_at: now,
      };

      await docRef.set(updateData, { merge: true });
      logger.info('Preferences updated', { userId });

      // Return updated preferences
      const updatedDoc = await docRef.get();
      return updatedDoc.data() as UserPreferences;
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
      const db = getFirestore();
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

      await db.doc(`${collectionPath}/${docId}`).set(preferences);
      logger.info('Preferences created', { userId });

      return preferences;
    } catch (error) {
      logger.error('Failed to create preferences:', error);
      throw new Error(`Failed to create preferences: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
