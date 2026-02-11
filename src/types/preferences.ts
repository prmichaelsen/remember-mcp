/**
 * User preferences types
 * Stored in Firestore at users/{userId}/preferences
 */

/**
 * Template preferences
 */
export interface TemplatePreferences {
  auto_suggest: boolean;
  suggestion_threshold: number;
  max_suggestions: number;
  show_preview: boolean;
  remember_choice: boolean;
  suppressed_categories?: string[];
  suppressed_templates?: string[];
  always_suggest?: string[];
}

/**
 * Search preferences
 */
export interface SearchPreferences {
  default_limit: number;
  include_low_trust: boolean;
  weight_by_access: boolean;
  weight_by_recency: boolean;
  default_alpha: number;
}

/**
 * Location preferences
 */
export interface LocationPreferences {
  auto_capture: boolean;
  precision: 'exact' | 'approximate' | 'city' | 'none';
  share_with_memories: boolean;
}

/**
 * Privacy preferences
 */
export interface PrivacyPreferences {
  default_trust_level: number;
  allow_cross_user_access: boolean;
  auto_approve_requests: boolean;
  audit_logging: boolean;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  trust_violations: boolean;
  access_requests: boolean;
  memory_reminders: boolean;
  relationship_suggestions: boolean;
}

/**
 * Display preferences
 */
export interface DisplayPreferences {
  date_format: string;
  time_format: string;
  timezone: string;
  language: string;
}

/**
 * Complete user preferences
 */
export interface UserPreferences {
  user_id: string;
  templates: TemplatePreferences;
  search: SearchPreferences;
  location: LocationPreferences;
  privacy: PrivacyPreferences;
  notifications: NotificationPreferences;
  display: DisplayPreferences;
  created_at: string;
  updated_at: string;
}

/**
 * Default preferences
 */
export const DEFAULT_PREFERENCES: Omit<UserPreferences, 'user_id' | 'created_at' | 'updated_at'> = {
  templates: {
    auto_suggest: true,
    suggestion_threshold: 0.6,
    max_suggestions: 3,
    show_preview: true,
    remember_choice: true,
    suppressed_categories: [],
    suppressed_templates: [],
    always_suggest: [],
  },
  search: {
    default_limit: 10,
    include_low_trust: false,
    weight_by_access: true,
    weight_by_recency: true,
    default_alpha: 0.7,
  },
  location: {
    auto_capture: true,
    precision: 'approximate',
    share_with_memories: true,
  },
  privacy: {
    default_trust_level: 0.5,
    allow_cross_user_access: false,
    auto_approve_requests: false,
    audit_logging: true,
  },
  notifications: {
    trust_violations: true,
    access_requests: true,
    memory_reminders: false,
    relationship_suggestions: true,
  },
  display: {
    date_format: 'MM/DD/YYYY',
    time_format: '12h',
    timezone: 'America/Los_Angeles',
    language: 'en',
  },
};

/**
 * Valid preference categories
 */
export const PREFERENCE_CATEGORIES = [
  'templates',
  'search',
  'location',
  'privacy',
  'notifications',
  'display',
] as const;

export type PreferenceCategory = typeof PREFERENCE_CATEGORIES[number];

/**
 * Preference field descriptions for dynamic tool schema generation
 */
export const PREFERENCE_DESCRIPTIONS = {
  templates: {
    auto_suggest: 'Automatically suggest templates when creating memories (default: true)',
    suggestion_threshold: 'Minimum confidence to show template suggestion, 0-1 (default: 0.6)',
    max_suggestions: 'Maximum number of templates to suggest, 1-5 (default: 3)',
    show_preview: 'Show template preview in suggestion (default: true)',
    remember_choice: 'Remember "don\'t suggest for this type" choices (default: true)',
    suppressed_categories: 'Categories to never suggest templates for (default: [])',
    suppressed_templates: 'Specific templates to never suggest (default: [])',
    always_suggest: 'Templates to always suggest regardless of confidence (default: [])',
  },
  search: {
    default_limit: 'Default number of search results to return, 1-100 (default: 10)',
    include_low_trust: 'Include low-trust memories in search results (default: false)',
    weight_by_access: 'Use access count in search ranking (default: true)',
    weight_by_recency: 'Use recency in search ranking (default: true)',
    default_alpha: 'Default hybrid search alpha (0=keyword, 1=semantic, default: 0.7)',
  },
  location: {
    auto_capture: 'Automatically capture location for memories (default: true)',
    precision: 'Location precision level: exact, approximate, city, none (default: approximate)',
    share_with_memories: 'Include location data in memories (default: true)',
  },
  privacy: {
    default_trust_level: 'Default trust level for new memories, 0-1 (default: 0.5)',
    allow_cross_user_access: 'Allow other users to request access to memories (default: false)',
    auto_approve_requests: 'Automatically approve access requests (default: false)',
    audit_logging: 'Enable audit logging for preference changes (default: true)',
  },
  notifications: {
    trust_violations: 'Notify on trust violations (default: true)',
    access_requests: 'Notify on access requests from other users (default: true)',
    memory_reminders: 'Send reminders about important memories (default: false)',
    relationship_suggestions: 'Suggest new relationships between memories (default: true)',
  },
  display: {
    date_format: 'Date format string (default: MM/DD/YYYY)',
    time_format: 'Time format: 12h or 24h (default: 12h)',
    timezone: 'Timezone identifier (default: America/Los_Angeles)',
    language: 'Language code (default: en)',
  },
} as const;

/**
 * Generate dynamic preference description for tool schema
 */
export function getPreferenceDescription(): string {
  const categories = Object.entries(PREFERENCE_DESCRIPTIONS)
    .map(([category, fields]) => {
      const fieldList = Object.entries(fields)
        .map(([field, desc]) => `  - ${field}: ${desc}`)
        .join('\n');
      return `${category}:\n${fieldList}`;
    })
    .join('\n\n');

  return `User preferences control system behavior. Available preference categories and fields:\n\n${categories}`;
}

/**
 * Generate JSON schema for preferences
 */
export function getPreferencesSchema() {
  return {
    type: 'object',
    properties: {
      templates: {
        type: 'object',
        description: 'Template suggestion preferences',
        properties: {
          auto_suggest: { type: 'boolean' },
          suggestion_threshold: { type: 'number', minimum: 0, maximum: 1 },
          max_suggestions: { type: 'number', minimum: 1, maximum: 5 },
          show_preview: { type: 'boolean' },
          remember_choice: { type: 'boolean' },
          suppressed_categories: { type: 'array', items: { type: 'string' } },
          suppressed_templates: { type: 'array', items: { type: 'string' } },
          always_suggest: { type: 'array', items: { type: 'string' } },
        },
      },
      search: {
        type: 'object',
        description: 'Search behavior preferences',
        properties: {
          default_limit: { type: 'number', minimum: 1, maximum: 100 },
          include_low_trust: { type: 'boolean' },
          weight_by_access: { type: 'boolean' },
          weight_by_recency: { type: 'boolean' },
          default_alpha: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
      location: {
        type: 'object',
        description: 'Location capture preferences',
        properties: {
          auto_capture: { type: 'boolean' },
          precision: { type: 'string', enum: ['exact', 'approximate', 'city', 'none'] },
          share_with_memories: { type: 'boolean' },
        },
      },
      privacy: {
        type: 'object',
        description: 'Privacy and trust preferences',
        properties: {
          default_trust_level: { type: 'number', minimum: 0, maximum: 1 },
          allow_cross_user_access: { type: 'boolean' },
          auto_approve_requests: { type: 'boolean' },
          audit_logging: { type: 'boolean' },
        },
      },
      notifications: {
        type: 'object',
        description: 'Notification preferences',
        properties: {
          trust_violations: { type: 'boolean' },
          access_requests: { type: 'boolean' },
          memory_reminders: { type: 'boolean' },
          relationship_suggestions: { type: 'boolean' },
        },
      },
      display: {
        type: 'object',
        description: 'Display format preferences',
        properties: {
          date_format: { type: 'string' },
          time_format: { type: 'string', enum: ['12h', '24h'] },
          timezone: { type: 'string' },
          language: { type: 'string' },
        },
      },
    },
  };
}
