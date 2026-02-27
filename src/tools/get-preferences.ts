/**
 * remember_get_preferences tool
 * Retrieve user preferences with defaults
 */

import { PreferencesDatabaseService } from '../services/preferences-database.service.js';
import { logger } from '../utils/logger.js';
import { handleToolError } from '../utils/error-handler.js';
import {
  UserPreferences,
  PreferenceCategory,
  PREFERENCE_CATEGORIES,
  getPreferenceDescription,
} from '../types/preferences.js';
import type { AuthContext } from '../types/auth.js';

/**
 * Tool definition for remember_get_preferences
 */
export const getPreferencesTool = {
  name: 'remember_get_preferences',
  description: `Get current user preferences.

Use this to understand user's current settings before suggesting changes
or to explain why system is behaving a certain way.

Returns the complete preferences object or filtered by category.
If preferences don't exist, returns defaults.

${getPreferenceDescription()}
`,
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['templates', 'search', 'location', 'privacy', 'notifications', 'display'],
        description: 'Optional category to filter preferences',
      },
    },
  },
};

/**
 * Get preferences arguments
 */
export interface GetPreferencesArgs {
  category?: PreferenceCategory;
}

/**
 * Get preferences result
 */
export interface GetPreferencesResult {
  preferences: UserPreferences | Partial<UserPreferences>;
  is_default: boolean;
  message: string;
}

/**
 * Handle remember_get_preferences tool
 */
export async function handleGetPreferences(
  args: GetPreferencesArgs,
  userId: string,
  authContext?: AuthContext
): Promise<string> {
  try {
    const { category } = args;

    logger.info('Getting preferences', { userId, category });

    // Get preferences using service layer
    const preferences = await PreferencesDatabaseService.getPreferences(userId);

    // Check if these are defaults (no created_at means they were just generated)
    const isDefault = !preferences.created_at || preferences.created_at === preferences.updated_at;

    // Filter by category if requested
    let result: UserPreferences | Partial<UserPreferences>;
    let message: string;

    if (category) {
      if (!PREFERENCE_CATEGORIES.includes(category)) {
        throw new Error(`Invalid category: ${category}. Valid categories: ${PREFERENCE_CATEGORIES.join(', ')}`);
      }

      result = {
        [category]: preferences[category],
      };
      message = isDefault
        ? `Showing default ${category} preferences (user has not customized preferences yet).`
        : `Showing current ${category} preferences.`;
    } else {
      result = preferences;
      message = isDefault
        ? 'Showing default preferences (user has not customized preferences yet).'
        : 'Showing current user preferences.';
    }

    const response: GetPreferencesResult = {
      preferences: result,
      is_default: isDefault,
      message,
    };

    logger.info('Preferences retrieved successfully', { userId, category, isDefault });

    return JSON.stringify(response, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'remember_get_preferences',
      operation: 'get preferences',
      userId,
      category: args.category,
    });
  }
}
