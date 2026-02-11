/**
 * remember_set_preference tool
 * Update user preferences through natural conversation
 */

import { PreferencesDatabaseService } from '../services/preferences-database.service.js';
import { logger } from '../utils/logger.js';
import {
  UserPreferences,
  getPreferenceDescription,
  getPreferencesSchema,
} from '../types/preferences.js';

/**
 * Tool definition for remember_set_preference
 */
export const setPreferenceTool = {
  name: 'remember_set_preference',
  description: `Update user preferences for system behavior through natural conversation.

This tool allows bulk updates to user preferences. Provide a partial preferences object
with only the fields you want to update. All updates are merged with existing preferences.

${getPreferenceDescription()}

Common examples:
- Disable template suggestions: { templates: { auto_suggest: false } }
- Change search defaults: { search: { default_limit: 20, default_alpha: 0.8 } }
- Update privacy: { privacy: { default_trust_level: 0.8 } }
- Suppress categories: { templates: { suppressed_categories: ["work", "personal"] } }
`,
  inputSchema: {
    type: 'object',
    properties: {
      preferences: {
        ...getPreferencesSchema(),
        description: 'Partial preferences object with fields to update',
      },
    },
    required: ['preferences'],
  },
};

/**
 * Set preference arguments
 */
export interface SetPreferenceArgs {
  preferences: Partial<Omit<UserPreferences, 'user_id' | 'created_at' | 'updated_at'>>;
}

/**
 * Set preference result
 */
export interface SetPreferenceResult {
  success: boolean;
  updated_preferences: UserPreferences;
  message: string;
  error?: string;
}

/**
 * Format a user-friendly message about the preference changes
 */
function formatPreferenceChangeMessage(updates: Partial<UserPreferences>): string {
  const changes: string[] = [];

  if (updates.templates) {
    if (updates.templates.auto_suggest !== undefined) {
      changes.push(
        updates.templates.auto_suggest
          ? 'Template suggestions enabled'
          : 'Template suggestions disabled'
      );
    }
    if (updates.templates.suppressed_categories) {
      changes.push(`Suppressed categories: ${updates.templates.suppressed_categories.join(', ')}`);
    }
  }

  if (updates.search) {
    if (updates.search.default_limit !== undefined) {
      changes.push(`Search limit set to ${updates.search.default_limit}`);
    }
    if (updates.search.default_alpha !== undefined) {
      changes.push(`Search alpha set to ${updates.search.default_alpha}`);
    }
  }

  if (updates.privacy) {
    if (updates.privacy.default_trust_level !== undefined) {
      changes.push(`Default trust level set to ${updates.privacy.default_trust_level}`);
    }
  }

  if (updates.location) {
    if (updates.location.auto_capture !== undefined) {
      changes.push(
        updates.location.auto_capture
          ? 'Location auto-capture enabled'
          : 'Location auto-capture disabled'
      );
    }
  }

  if (changes.length === 0) {
    return 'Preferences updated successfully';
  }

  return `Preferences updated: ${changes.join(', ')}`;
}

/**
 * Handle remember_set_preference tool
 */
export async function handleSetPreference(
  args: SetPreferenceArgs,
  userId: string
): Promise<string> {
  try {
    const { preferences } = args;

    logger.info('Setting preferences', { userId, updates: Object.keys(preferences) });

    // Update preferences using service layer
    const updatedPreferences = await PreferencesDatabaseService.updatePreferences(
      userId,
      preferences
    );

    const message = formatPreferenceChangeMessage(preferences);

    const result: SetPreferenceResult = {
      success: true,
      updated_preferences: updatedPreferences,
      message,
    };

    logger.info('Preferences set successfully', { userId });

    return JSON.stringify(result, null, 2);
  } catch (error) {
    logger.error('Failed to set preferences:', error);
    throw new Error(`Failed to set preferences: ${error instanceof Error ? error.message : String(error)}`);
  }
}
