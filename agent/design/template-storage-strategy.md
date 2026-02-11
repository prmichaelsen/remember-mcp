# Template Storage Strategy

**Concept**: Hybrid storage for user templates and default template library  
**Created**: 2026-02-11  
**Updated**: 2026-02-11 (Simplified - no sharing)  
**Status**: Design Specification (FINAL)

---

## Design Decision: No Template Sharing

**Key Decision**: Templates are either **default** (available to all) or **private** (user-only). No sharing between users.

**Rationale**:
- Avoids permission bloat (thousands of permission docs per popular template)
- Simpler security rules and queries
- Better scalability
- If a user template is good, platform promotes it to default library

---

## Firestore Structure (FINAL)

```
firestore/
├── templates/
│   └── default/
│       └── {weaviate_uuid}/        # Default templates (platform-curated)
│           ├── template_id: weaviate_uuid
│           ├── template_name
│           ├── category
│           ├── is_default: true
│           ├── is_immutable: true
│           ├── usage_count
│           └── version
│
└── users/
    └── {user_id}/
        ├── preferences/            # User preferences
        └── templates/
            └── {weaviate_uuid}/    # User's custom templates
                ├── template_id: weaviate_uuid
                ├── owner_user_id
                ├── template_name
                ├── derived_from    # If copied from default
                ├── usage_count
                └── created_at
```

**Benefits**:
- ✅ Simple, clear structure
- ✅ No permission bloat
- ✅ Easy to query user's templates: `users/{user_id}/templates/`
- ✅ Easy to query default templates: `templates/default/`
- ✅ Scales well (no per-user permission docs)
- ✅ Clear ownership model
- ✅ Reuses Weaviate UUID as Firestore doc ID

---

## Weaviate Collections

### Template Collections

**1. Template_system** - Default templates (shared across all users)
- Platform-curated templates
- Immutable
- Available to all users
- Semantic search enabled

**2. Template_{user_id}** - User-specific templates
- Created by user
- Private to owner
- Modifiable
- Semantic search enabled

---

## Template Visibility Model

### Two Types Only

**1. Default Templates** (`templates/default/{weaviate_uuid}`)
- Created by platform
- Available to ALL users
- Immutable (users can't modify)
- Users can copy to customize
- Examples: Person Profile, Meeting Notes, Inventory Item

**2. User Templates** (`users/{user_id}/templates/{weaviate_uuid}`)
- Created by user
- Private to that user only
- User can modify freely
- Can be derived from default templates

**No Sharing Between Users**: If a user template is valuable, platform promotes it to default library

---

## Implementation

### Create Default Template

```typescript
async function createDefaultTemplate(template: Template): Promise<string> {
  // 1. Create in Weaviate (generates UUID)
  const templateId = await weaviateClient
    .collection('Template_system')
    .data.insert({
      ...template,
      is_default: true,
      is_immutable: true,
      created_at: new Date()
    });
  
  // 2. Create in Firestore (reuse Weaviate UUID)
  await firestore
    .collection('templates')
    .doc('default')
    .collection('templates')
    .doc(templateId)  // ✅ Reuse Weaviate UUID
    .set({
      template_id: templateId,
      template_name: template.template_name,
      category: template.category,
      is_default: true,
      is_immutable: true,
      usage_count: 0,
      version: "1.0",
      created_at: Timestamp.now()
    });
  
  return templateId;
}
```

### Create User Template

```typescript
async function createUserTemplate(
  template: Template,
  user_id: string
): Promise<string> {
  // 1. Create in Weaviate (generates UUID)
  const templateId = await weaviateClient
    .collection(`Template_${user_id}`)
    .data.insert({
      ...template,
      owner_user_id: user_id,
      is_default: false,
      is_immutable: false,
      created_at: new Date()
    });
  
  // 2. Create in Firestore (reuse Weaviate UUID)
  await firestore
    .collection('users')
    .doc(user_id)
    .collection('templates')
    .doc(templateId)  // ✅ Reuse Weaviate UUID
    .set({
      template_id: templateId,
      owner_user_id: user_id,
      template_name: template.template_name,
      derived_from: template.derived_from || null,
      usage_count: 0,
      created_at: Timestamp.now()
    });
  
  return templateId;
}
```

### Copy Default Template

```typescript
async function copyDefaultTemplate(
  source_template_id: string,
  user_id: string,
  customizations?: Partial<Template>
): Promise<string> {
  // Get default template from Weaviate
  const defaultTemplate = await weaviateClient
    .collection('Template_system')
    .data.getById(source_template_id);
  
  // Create user's copy
  return await createUserTemplate({
    ...defaultTemplate.properties,
    ...customizations,
    derived_from: source_template_id
  }, user_id);
}
```

### Query Templates

```typescript
// Get user's templates
async function getUserTemplates(user_id: string): Promise<Template[]> {
  const snapshot = await firestore
    .collection('users')
    .doc(user_id)
    .collection('templates')
    .get();
  
  const templateIds = snapshot.docs.map(doc => doc.id);
  return await fetchTemplatesFromWeaviate(templateIds, `Template_${user_id}`);
}

// Get default templates
async function getDefaultTemplates(): Promise<Template[]> {
  const snapshot = await firestore
    .collectionGroup('templates')  // Query across all default templates
    .where('is_default', '==', true)
    .get();
  
  const templateIds = snapshot.docs.map(doc => doc.id);
  return await fetchTemplatesFromWeaviate(templateIds, 'Template_system');
}

// Get all available templates for user
async function getAllAvailableTemplates(user_id: string): Promise<Template[]> {
  const [defaults, userTemplates] = await Promise.all([
    getDefaultTemplates(),
    getUserTemplates(user_id)
  ]);
  
  return [...defaults, ...userTemplates];
}
```

---

## Template Promotion Model

### User Template → Default Template

```typescript
async function promoteToDefault(
  user_template_id: string,
  user_id: string,
  admin_user_id: string,
  reason: string
): Promise<string> {
  // 1. Get user template
  const userTemplate = await weaviateClient
    .collection(`Template_${user_id}`)
    .data.getById(user_template_id);
  
  // 2. Create as default template
  const defaultTemplateId = await createDefaultTemplate({
    ...userTemplate.properties,
    promoted_from: user_template_id,
    original_author: user_id,
    promoted_by: admin_user_id,
    promoted_at: new Date(),
    promotion_reason: reason
  });
  
  // 3. Notify original author
  await notifyTemplatePromotion(user_id, {
    user_template_id,
    default_template_id: defaultTemplateId,
    message: "Your template has been promoted to the default library!"
  });
  
  return defaultTemplateId;
}
```

---

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Default templates - read-only for all authenticated users
    match /templates/default/{template_id} {
      allow read: if request.auth != null;
      allow write: if false;  // Only via admin SDK
    }
    
    // User templates - full control for owner only
    match /users/{user_id}/templates/{template_id} {
      allow read, write: if request.auth.uid == user_id;
    }
    
    // User preferences
    match /users/{user_id}/preferences {
      allow read, write: if request.auth.uid == user_id;
    }
  }
}
```

---

## Default Template Library (15 Templates)

### Core Templates

1. **Person Profile** - Track people you meet (with `how_we_met` field)
2. **Professional Contact** - Business contacts
3. **Meeting Notes** - Meeting documentation
4. **Restaurant Review** - Dining experiences
5. **Book Review** - Books read
6. **Movie Review** - Movies watched
7. **Recipe** - Cooking recipes
8. **Travel Destination** - Places visited
9. **Project Tracker** - Project management
10. **Goal Tracker** - Personal/professional goals
11. **Habit Tracker** - Daily habits
12. **Inventory Item** - Home organization (NEW)
13. **Checklist Template** - Reusable checklists
14. **Journal Entry** - Daily journaling
15. **Idea Capture** - Quick ideas and brainstorms

### Template Categories

```typescript
const TEMPLATE_CATEGORIES = {
  contacts: ['person_profile', 'professional_contact'],
  work: ['meeting_notes', 'project_tracker'],
  personal: ['journal_entry', 'goal_tracker', 'habit_tracker'],
  entertainment: ['book_review', 'movie_review', 'restaurant_review'],
  organization: ['inventory_item', 'checklist_template'],
  creative: ['recipe', 'idea_capture'],
  travel: ['travel_destination']
};
```

---

## Benefits of Simplified Approach

### 1. **Scalability**
- No permission documents per user
- Avoids permission bloat
- Simple, predictable queries
- Firestore costs stay low

### 2. **Clarity**
- Clear ownership model
- Either default (all) or private (owner)
- No complex sharing logic
- Easy to understand

### 3. **Performance**
- No permission checks needed
- Faster queries
- Less Firestore reads
- Simpler caching

### 4. **Maintainability**
- Simpler code
- Fewer edge cases
- Easier to reason about
- Less testing needed

### 5. **Quality Control**
- Platform curates defaults
- Ensures template quality
- Users get credit for contributions
- Community benefits from best templates

---

## Comparison

### ❌ Complex (With Sharing - Rejected)
```
templates/{template_id}/
├── metadata
└── permissions/
    ├── {user_1}/  # Can use
    ├── {user_2}/  # Can use
    ├── {user_3}/  # Can use
    └── ... (could be thousands of permission docs!)
```

**Problems**:
- Permission bloat for popular templates
- Complex queries
- Expensive Firestore reads
- Hard to maintain

### ✅ Simple (No Sharing - Accepted)
```
templates/default/{weaviate_uuid}/
└── metadata (available to all)

users/{user_id}/templates/{weaviate_uuid}/
└── metadata (owner only)
```

**Benefits**:
- No permission documents
- Simple queries
- Scalable
- Clear ownership

---

**Status**: Design Specification (FINAL)  
**Structure**: `templates/default/` and `users/{user_id}/templates/`  
**Sharing**: Not supported - use promotion model instead  
**ID Strategy**: Reuse Weaviate UUID as Firestore document ID  
**Benefit**: Simpler, more scalable, easier to maintain
