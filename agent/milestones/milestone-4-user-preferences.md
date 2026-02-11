# Milestone 4: User Preferences

**Goal**: Implement user preference system with conversational management  
**Duration**: 1 week  
**Dependencies**: M2 (Core Memory System)  
**Status**: Not Started

---

## Overview

Implement user preferences stored in Firestore with tools to manage preferences through natural conversation.

---

## Deliverables

### 1. Preferences Schema
- UserPreferences interface
- Default preferences
- Preference validation
- Store in users/{user_id}/preferences

### 2. Preference Tools (2 tools)
- remember_update_preferences
- remember_get_preferences

### 3. Preference Integration
- Template auto-suggest respects preferences
- Search uses preference defaults
- Trust defaults from preferences
- All tools check preferences

---

## Success Criteria

- [ ] Preferences stored in Firestore users/{user_id}/preferences
- [ ] Can update preferences via conversation
- [ ] Can query current preferences
- [ ] Template auto-suggest respects preferences.templates.auto_suggest
- [ ] Search uses preferences.search.default_limit
- [ ] New memories use preferences.privacy.default_trust_level
- [ ] Preference changes logged

---

## Key Files to Create

```
src/
├── types/
│   └── preferences.ts      # UserPreferences interface
├── firestore/
│   └── preferences.ts      # Preference CRUD
├── tools/
│   ├── update-preferences.ts
│   └── get-preferences.ts
└── services/
    └── preference-manager.ts
```

---

## Preferences Schema (Firestore)

```typescript
users/{user_id}/preferences:
  templates:
    auto_suggest: boolean (default: true)
    suggestion_threshold: number (default: 0.6)
    max_suggestions: number (default: 3)
    suppressed_categories: string[]
    
  search:
    default_limit: number (default: 10)
    default_alpha: number (default: 0.7)
    weight_by_access: boolean (default: true)
    
  privacy:
    default_trust_level: number (default: 0.5)
    allow_cross_user_access: boolean (default: false)
    
  location:
    auto_capture: boolean (default: true)
    precision: string (default: "approximate")
```

---

## Testing

- [ ] Get preferences test (with defaults)
- [ ] Update preferences test
- [ ] Preference validation test
- [ ] Integration: template auto-suggest respects preferences
- [ ] Integration: search uses preference defaults
- [ ] Conversational preference update test

---

**Next Milestone**: M5 - Template System  
**Blockers**: M2 must be complete
