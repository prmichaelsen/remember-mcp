# User Preferences for Remember-MCP

**Concept**: User-configurable preferences for system behavior with MCP tool support
**Created**: 2026-02-11
**Status**: Design Specification

---

## Overview

Users should be able to configure system behavior to match their preferences. These preferences are stored per-user in Firestore and can be modified through natural conversation using the `remember_update_preferences` tool.

**Key Innovation**: Agent can learn and adapt preferences through conversation without requiring UI settings changes.

---

## Preference Schema (Firestore)

**Location**: `user_preferences/{user_id}`

```typescript
interface UserPreferences {
  user_id: string;
  
  // Template Preferences
  templates: {
    auto_suggest: boolean;           // ✅ Default: true, user can disable
    suggestion_threshold: number;    // Min confidence to show suggestion (0-1)
    max_suggestions: number;         // Max templates to suggest (1-5)
    show_preview: boolean;           // Show template preview in suggestion
    remember_choice: boolean;        // Remember "don't suggest for this type"
  };
  
  // Search Preferences
  search: {
    default_limit: number;           // Default result limit (10-100)
    include_low_trust: boolean;      // Include low-trust memories in search
    weight_by_access: boolean;       // Use access count in ranking
    weight_by_recency: boolean;      // Use recency in ranking
    default_alpha: number;           // Default hybrid search alpha (0-1)
  };
  
  // Location Preferences
  location: {
    auto_capture: boolean;           // Automatically capture location
    precision: string;               // "exact", "approximate", "city", "none"
    share_with_memories: boolean;    // Include location in memories
  };
  
  // Privacy Preferences
  privacy: {
    default_trust_level: number;     // Default trust for new memories (0-1)
    allow_cross_user_access: boolean; // Allow others to request access
    auto_approve_requests: boolean;   // Auto-approve access requests
    audit_logging: boolean;          // Enable audit logging
  };
  
  // Notification Preferences
  notifications: {
    trust_violations: boolean;       // Notify on trust violations
    access_requests: boolean;        // Notify on access requests
    memory_reminders: boolean;       // Remind about important memories
    relationship_suggestions: boolean; // Suggest new relationships
  };
  
  // Display Preferences
  display: {
    date_format: string;             // From locale cookie
    time_format: string;             // From locale cookie
    timezone: string;                // From locale cookie
    language: string;                // From locale cookie
  };
  
  // Metadata
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

---

## Default Preferences

```typescript
const DEFAULT_PREFERENCES: UserPreferences = {
  templates: {
    auto_suggest: true,              // ✅ Enabled by default
    suggestion_threshold: 0.6,       // Show if >60% confident
    max_suggestions: 3,              // Show top 3
    show_preview: true,
    remember_choice: true
  },
  
  search: {
    default_limit: 10,
    include_low_trust: false,        // Don't show low-trust by default
    weight_by_access: true,
    weight_by_recency: true,
    default_alpha: 0.7               // Balanced hybrid search
  },
  
  location: {
    auto_capture: true,
    precision: "approximate",        // Privacy-friendly default
    share_with_memories: true
  },
  
  privacy: {
    default_trust_level: 0.5,        // Medium trust by default
    allow_cross_user_access: false,  // Opt-in for cross-user
    auto_approve_requests: false,
    audit_logging: true
  },
  
  notifications: {
    trust_violations: true,
    access_requests: true,
    memory_reminders: false,
    relationship_suggestions: true
  },
  
  display: {
    date_format: "MM/DD/YYYY",       // From locale
    time_format: "12h",              // From locale
    timezone: "America/Los_Angeles", // From locale
    language: "en"                   // From locale
  },
  
  created_at: Timestamp.now(),
  updated_at: Timestamp.now()
};
```

---

## Template Auto-Suggestion Behavior

### When Enabled (Default)

```typescript
// User creates memory
User: "Met Sarah at the conference"

// System automatically suggests
System: "💡 Would you like to use the 'Person Profile' template?
        Includes fields for: name, company, job_title, how_we_met
        [Use Template] [Skip] [Don't suggest for contacts]"

// If user clicks "Don't suggest for contacts"
await updatePreference(user_id, {
  'templates.suppressed_categories': ['contacts']
});
```

### When Disabled

```typescript
// User has disabled auto-suggest
preferences.templates.auto_suggest = false;

// User creates memory
User: "Met Sarah at the conference"

// System creates memory without suggestion
System: "Memory created."

// User can still manually request template
User: "Use a template for this"
System: "Which template? [Person Profile] [Professional Contact] [Other]"
```

### Per-Category Control

```typescript
interface TemplateSuggestionPreferences {
  auto_suggest: boolean;             // Global toggle
  suppressed_categories: string[];   // Don't suggest for these categories
  suppressed_templates: string[];    // Don't suggest these specific templates
  always_suggest: string[];          // Always suggest these templates
}

// Example
preferences.templates = {
  auto_suggest: true,
  suppressed_categories: ['work'],   // Don't suggest work templates
  suppressed_templates: ['recipe'],  // Don't suggest recipe template
  always_suggest: ['inventory_item'] // Always suggest inventory
};
```

---

## Preference Management API

### Get Preferences

```typescript
async function getUserPreferences(user_id: string): Promise<UserPreferences> {
  const doc = await firestore
    .collection('user_preferences')
    .doc(user_id)
    .get();
  
  if (!doc.exists) {
    // Create with defaults
    await firestore
      .collection('user_preferences')
      .doc(user_id)
      .set(DEFAULT_PREFERENCES);
    
    return DEFAULT_PREFERENCES;
  }
  
  return doc.data() as UserPreferences;
}
```

### Update Preferences

```typescript
async function updateUserPreferences(
  user_id: string,
  updates: Partial<UserPreferences>
): Promise<void> {
  await firestore
    .collection('user_preferences')
    .doc(user_id)
    .update({
      ...updates,
      updated_at: Timestamp.now()
    });
}

// Example: Disable template auto-suggestion
await updateUserPreferences(user_id, {
  'templates.auto_suggest': false
});

// Example: Change default trust level
await updateUserPreferences(user_id, {
  'privacy.default_trust_level': 0.8
});
```

---

## Using Preferences in Tools

### In `remember_create_memory`

```typescript
async function createMemory(
  args: CreateMemoryArgs,
  context: RequestContext
): Promise<CreateMemoryResult> {
  // Get user preferences
  const prefs = await getUserPreferences(context.user_id);
  
  // Check if template suggestion enabled
  if (prefs.templates.auto_suggest && !args.skip_template_suggestion) {
    // Suggest templates
    const suggestions = await suggestTemplates(
      args.content,
      context,
      prefs.templates.suggestion_threshold
    );
    
    if (suggestions.length > 0) {
      return {
        status: 'template_suggested',
        suggestions: suggestions.slice(0, prefs.templates.max_suggestions),
        message: 'Would you like to use a template?'
      };
    }
  }
  
  // Create memory without template
  return await createMemoryDirect(args, context, prefs);
}
```

### In `remember_search_memory`

```typescript
async function searchMemory(
  args: SearchMemoryArgs,
  context: RequestContext
): Promise<SearchResult> {
  // Get user preferences
  const prefs = await getUserPreferences(context.user_id);
  
  // Apply preference-based defaults
  const limit = args.limit || prefs.search.default_limit;
  const alpha = args.alpha || prefs.search.default_alpha;
  
  // Apply weighting preferences
  const useAccessWeighting = prefs.search.weight_by_access;
  const useRecencyWeighting = prefs.search.weight_by_recency;
  
  // Search with preferences
  return await searchWithPreferences(args, prefs);
}
```

---

## Preference UI

### Settings Page

```typescript
// User settings interface
interface SettingsPage {
  sections: [
    {
      title: "Templates",
      settings: [
        {
          key: "auto_suggest",
          label: "Automatically suggest templates",
          type: "toggle",
          default: true,
          description: "System will suggest relevant templates when creating memories"
        },
        {
          key: "suggestion_threshold",
          label: "Suggestion confidence threshold",
          type: "slider",
          min: 0,
          max: 1,
          default: 0.6,
          description: "Only suggest templates with confidence above this level"
        }
      ]
    },
    {
      title: "Privacy",
      settings: [
        {
          key: "default_trust_level",
          label: "Default trust level for new memories",
          type: "slider",
          min: 0,
          max: 1,
          default: 0.5,
          description: "Trust level assigned to new memories by default"
        }
      ]
    }
  ]
}
```

---

## MCP Tool: `remember_update_preferences`

### Tool Definition

```typescript
{
  name: 'remember_update_preferences',
  description: `Update user preferences for system behavior through natural conversation.
  
  This tool allows the agent to learn and adapt to user preferences without requiring
  the user to navigate settings UI. Preferences are stored in Firestore and affect
  how the system operates.
  
  Common use cases:
  - User: "Stop suggesting templates" → disable auto_suggest
  - User: "Don't suggest work templates" → suppress work category
  - User: "Always use high trust for new memories" → set default_trust_level
  - User: "Show me 20 results by default" → set default_limit
  
  Args:
      preference_path: Dot-notation path to preference (e.g., "templates.auto_suggest")
      value: New value for the preference (boolean, number, string, or array)
      reason: Optional reason for the change (for audit trail)
  
  Returns:
      UpdatePreferencesResult with:
          - success: boolean
          - preference_path: string
          - old_value: any
          - new_value: any
          - message: string
  `,
  inputSchema: {
    type: 'object',
    properties: {
      preference_path: {
        type: 'string',
        description: 'Dot-notation path (e.g., "templates.auto_suggest")',
        examples: [
          'templates.auto_suggest',
          'templates.suppressed_categories',
          'search.default_limit',
          'privacy.default_trust_level'
        ]
      },
      value: {
        description: 'New value (type depends on preference)',
        oneOf: [
          { type: 'boolean' },
          { type: 'number' },
          { type: 'string' },
          { type: 'array' }
        ]
      },
      reason: {
        type: 'string',
        description: 'Optional reason for the change'
      }
    },
    required: ['preference_path', 'value']
  }
}
```

### Implementation

```typescript
async function updatePreferences(
  args: UpdatePreferencesArgs,
  context: RequestContext
): Promise<UpdatePreferencesResult> {
  const { preference_path, value, reason } = args;
  const user_id = context.user_id;
  
  // Get current preferences
  const currentPrefs = await getUserPreferences(user_id);
  
  // Get old value
  const oldValue = getNestedValue(currentPrefs, preference_path);
  
  // Validate preference path
  if (!isValidPreferencePath(preference_path)) {
    return {
      success: false,
      preference_path,
      old_value: oldValue,
      new_value: value,
      error: `Invalid preference path: ${preference_path}`
    };
  }
  
  // Validate value type
  if (!isValidValueType(preference_path, value)) {
    return {
      success: false,
      preference_path,
      old_value: oldValue,
      new_value: value,
      error: `Invalid value type for ${preference_path}`
    };
  }
  
  // Update in Firestore
  await firestore
    .collection('user_preferences')
    .doc(user_id)
    .update({
      [preference_path]: value,
      updated_at: Timestamp.now()
    });
  
  // Log change
  await logPreferenceChange({
    user_id,
    preference_path,
    old_value: oldValue,
    new_value: value,
    reason,
    timestamp: new Date(),
    conversation_id: context.conversation_id
  });
  
  return {
    success: true,
    preference_path,
    old_value: oldValue,
    new_value: value,
    message: formatPreferenceChangeMessage(preference_path, oldValue, value)
  };
}
```

### Natural Language Examples

#### Example 1: Disable Template Suggestions
```
User: "Stop suggesting templates, they're annoying"

Agent: remember_update_preferences({
  preference_path: "templates.auto_suggest",
  value: false,
  reason: "User finds template suggestions annoying"
})

Result: {
  success: true,
  message: "Template suggestions disabled. You can re-enable them anytime by saying 'suggest templates again'."
}
```

#### Example 2: Suppress Category
```
User: "Don't suggest work templates anymore"

Agent: remember_update_preferences({
  preference_path: "templates.suppressed_categories",
  value: ["work"],
  reason: "User doesn't want work template suggestions"
})

Result: {
  success: true,
  message: "Work templates will no longer be suggested. Other templates will still be suggested."
}
```

#### Example 3: Change Default Trust
```
User: "Make my new memories more private by default"

Agent: remember_update_preferences({
  preference_path: "privacy.default_trust_level",
  value: 0.2,
  reason: "User wants more privacy for new memories"
})

Result: {
  success: true,
  old_value: 0.5,
  new_value: 0.2,
  message: "Default trust level changed from 0.5 to 0.2. New memories will be more private."
}
```

#### Example 4: Change Search Limit
```
User: "Show me 20 results when I search"

Agent: remember_update_preferences({
  preference_path: "search.default_limit",
  value: 20,
  reason: "User wants more search results"
})

Result: {
  success: true,
  old_value: 10,
  new_value: 20,
  message: "Search results limit changed to 20."
}
```

---

## Preference Change Logging

```typescript
interface PreferenceChangeLog {
  user_id: string;
  preference_path: string;
  old_value: any;
  new_value: any;
  reason: string | null;
  timestamp: datetime;
  conversation_id: string | null;
  changed_via: 'mcp_tool' | 'ui' | 'api';
}

// Store in Firestore
// user_preferences/{user_id}/change_history/{change_id}
```

---

## Tool: `remember_get_preferences`

```typescript
{
  name: 'remember_get_preferences',
  description: `Get current user preferences.
  
  Use this to understand user's current settings before suggesting changes
  or to explain why system is behaving a certain way.
  
  Args:
      category: Optional category to filter (templates, search, privacy, etc.)
  
  Returns:
      Current preferences object or filtered by category
  `,
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['templates', 'search', 'location', 'privacy', 'notifications', 'display'],
        description: 'Optional category to filter preferences'
      }
    }
  }
}

// Example
User: "What are my template settings?"

Agent: remember_get_preferences({
  category: "templates"
})

Result: {
  auto_suggest: true,
  suggestion_threshold: 0.6,
  max_suggestions: 3,
  suppressed_categories: [],
  suppressed_templates: []
}
```

---

## Benefits

### For Users
- **Control**: Customize system behavior
- **Privacy**: Control default trust and sharing
- **Efficiency**: Disable features they don't use
- **Personalization**: System adapts to preferences
- **Natural Interface**: Change settings through conversation

### For System
- **Flexibility**: Support different user workflows
- **Adoption**: Users can ease into features
- **Feedback**: Learn what features users value
- **Optimization**: Reduce unnecessary processing
- **Learning**: Agent learns user preferences over time

### For Agent
- **Adaptive**: Can adjust behavior based on user feedback
- **Conversational**: No need to direct users to settings UI
- **Context-Aware**: Can suggest preference changes at appropriate times
- **Transparent**: Can explain why system behaves certain way

---

## Updated Tool Count

**Remember-MCP Tools** (now 13 total):

**Memory Operations** (6):
1. remember_create_memory
2. remember_update_memory
3. remember_delete_memory
4. remember_search_memory
5. remember_find_similar
6. remember_query_memory

**Relationship Operations** (4):
7. remember_create_relationship
8. remember_update_relationship
9. remember_search_relationship
10. remember_delete_relationship

**Preferences** (2 NEW):
11. **remember_update_preferences** ← NEW
12. **remember_get_preferences** ← NEW

**Templates** (optional, Phase 3):
13. remember_create_template
14. remember_list_templates
15. remember_update_template
16. remember_delete_template

---

**Status**: Design Specification
**Storage**: Firestore (`user_preferences/{user_id}`)
**Default**: Template auto-suggest enabled, user can disable via tool
**Key Innovation**: Preferences manageable through natural conversation
