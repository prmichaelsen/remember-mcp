# Milestone 5: Template System

**Goal**: Implement template system with default library and auto-suggestion  
**Duration**: 2 weeks  
**Dependencies**: M2 (Core Memory), M4 (Preferences)  
**Status**: Not Started

---

## Overview

Implement the template system with 15 default templates, auto-suggestion based on context, and user custom templates.

---

## Deliverables

### 1. Template Schema
- Template interface
- Field definition schema
- Trigger configuration
- Store in Template_system and Template_{user_id}

### 2. Default Template Library
- 15 curated default templates
- Person, Meeting Notes, Restaurant Review, Book Review, etc.
- Inventory Item template
- All templates include references, tags, notes fields

### 3. Template Suggestion
- Keyword matching algorithm
- Context pattern matching
- Semantic similarity matching
- Scoring and ranking
- Integration with remember_create_memory

### 4. Template Tools (6 tools)
- remember_create_template
- remember_list_templates
- remember_get_template
- remember_update_template
- remember_delete_template
- remember_copy_template

### 5. Firestore Storage
- templates/default/{weaviate_uuid} for defaults
- users/{user_id}/templates/{weaviate_uuid} for user templates
- No sharing (promotion model instead)

---

## Success Criteria

- [ ] 15 default templates available to all users
- [ ] Template suggestion works based on keywords and context
- [ ] Users can create custom templates
- [ ] Users can copy and modify default templates
- [ ] Template validation works
- [ ] Auto-suggest respects user preferences
- [ ] Templates stored correctly in Firestore and Weaviate

---

## Key Files to Create

```
src/
├── types/
│   └── template.ts
├── templates/
│   └── defaults/
│       ├── person.ts
│       ├── meeting-notes.ts
│       ├── restaurant-review.ts
│       ├── inventory-item.ts
│       └── ... (11 more)
├── services/
│   ├── template-suggestion.ts
│   └── template-manager.ts
├── tools/
│   ├── create-template.ts
│   ├── list-templates.ts
│   ├── get-template.ts
│   ├── update-template.ts
│   ├── delete-template.ts
│   └── copy-template.ts
└── firestore/
    └── templates.ts
```

---

## Default Templates (15)

1. Person - Unified personal/professional contacts
2. Meeting Notes - Work meetings
3. Project Tracker - Project management
4. Task - Action items
5. Journal Entry - Daily journaling
6. Goal - Goal tracking
7. Habit - Habit tracking
8. Inventory Item - Home organization
9. Restaurant Review - Dining experiences
10. Book Review - Books read
11. Movie Review - Movies/shows watched
12. Recipe - Cooking recipes
13. Idea - Quick ideas
14. Learning Note - Things learned
15. Travel Destination - Places visited

---

## Testing

- [ ] Template creation test
- [ ] Template suggestion test (keyword matching)
- [ ] Template suggestion test (context matching)
- [ ] Template validation test
- [ ] User template CRUD test
- [ ] Copy default template test
- [ ] Integration: create memory with template

---

**Next Milestone**: M6 - Auth & Multi-Tenancy  
**Blockers**: M2 and M4 must be complete
