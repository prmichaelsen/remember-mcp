# Firestore Users Subcollection Pattern - Best Practices

**Concept**: Organize user-specific data under `users/{user_id}/` path  
**Created**: 2026-02-11  
**Status**: Best Practice Documentation

---

## Overview

The `users/{user_id}/*` subcollection pattern is a Firestore best practice for organizing user-specific data. All user-scoped data lives under the user's document, making queries, security rules, and data management simpler.

---

## Pattern Structure

### Recommended Firestore Organization

```
firestore/
├── users/
│   └── {user_id}/
│       ├── profile/                # User profile data
│       ├── preferences/            # User preferences
│       ├── templates/              # User's custom templates
│       │   └── {template_id}/
│       ├── memories/               # Memory metadata (if needed)
│       │   └── {memory_id}/
│       ├── relationships/          # Relationship metadata (if needed)
│       │   └── {relationship_id}/
│       ├── access_logs/            # Access attempt logs
│       │   └── {log_id}/
│       └── trust_relationships/    # Who this user trusts
│           └── {accessor_user_id}/
│
├── templates/
│   └── default/                    # Default templates (shared)
│       └── {template_id}/
│
└── user_permissions/               # Cross-user permissions
    └── {owner_user_id}/
        └── allowed_accessors/
            └── {accessor_user_id}/
```

---

## Benefits of Users Subcollection Pattern

### 1. **Security Rules Simplification**

```javascript
// Simple rule: user can access their own data
match /users/{user_id}/{document=**} {
  allow read, write: if request.auth.uid == user_id;
}

// vs complex rules for flat structure
match /templates/{template_id} {
  allow read, write: if get(/databases/$(database)/documents/templates/$(template_id)).data.owner_user_id == request.auth.uid;
}
```

### 2. **Query Simplification**

```typescript
// Get all user's templates
const templates = await firestore
  .collection('users')
  .doc(user_id)
  .collection('templates')
  .get();

// vs querying flat structure with filter
const templates = await firestore
  .collection('templates')
  .where('owner_user_id', '==', user_id)
  .get();
```

### 3. **Data Locality**

All user data is co-located under their user document:
- Easier to understand data organization
- Simpler data export/deletion (GDPR compliance)
- Better for backups and migrations
- Clear data ownership

### 4. **Scalability**

```typescript
// Each user's data is isolated
// No cross-user queries needed for user-specific data
// Better Firestore performance
// Easier to shard if needed
```

### 5. **GDPR Compliance**

```typescript
// Delete all user data
async function deleteUserData(user_id: string): Promise<void> {
  // Delete entire user document and all subcollections
  await firestore
    .collection('users')
    .doc(user_id)
    .delete({ recursive: true });
  
  // All user data gone in one operation
}
```

---

## Pattern Application in Remember-MCP

### User-Specific Data (Under `users/{user_id}/`)

**1. Preferences** - `users/{user_id}/preferences`
```typescript
{
  templates: { auto_suggest: true, ... },
  search: { default_limit: 10, ... },
  privacy: { default_trust: 0.5, ... }
}
```

**2. Templates** - `users/{user_id}/templates/{template_id}`
```typescript
{
  template_id: weaviate_uuid,
  template_name: "My Custom Template",
  derived_from: default_template_id,
  usage_count: 5
}
```

**3. Access Logs** - `users/{user_id}/access_logs/{log_id}`
```typescript
{
  memory_id: string,
  accessor_user_id: string,
  result: "granted" | "denied" | "blocked",
  timestamp: Timestamp
}
```

**4. Trust Relationships** - `users/{user_id}/trust_relationships/{accessor_id}`
```typescript
{
  accessor_user_id: string,
  trust_level: float,
  trust_summary: string,
  granted_at: Timestamp
}
```

### Shared/Global Data (Outside `users/`)

**1. Default Templates** - `templates/default/{template_id}`
```typescript
{
  template_id: weaviate_uuid,
  template_name: "Person Profile",
  is_default: true,
  usage_count: 15234
}
```

**2. Cross-User Permissions** - `user_permissions/{owner_id}/allowed_accessors/{accessor_id}`
```typescript
{
  owner_user_id: string,
  accessor_user_id: string,
  trust_level: float,
  can_access: boolean
}
```

**Note**: Cross-user permissions can't go under `users/{user_id}/` because they involve two users

---

## Query Patterns

### Get All User Data

```typescript
// Get all subcollections for a user
async function getAllUserData(user_id: string): Promise<UserData> {
  const [profile, preferences, templates, accessLogs] = await Promise.all([
    firestore.collection('users').doc(user_id).collection('profile').get(),
    firestore.collection('users').doc(user_id).collection('preferences').get(),
    firestore.collection('users').doc(user_id).collection('templates').get(),
    firestore.collection('users').doc(user_id).collection('access_logs').get()
  ]);
  
  return {
    profile: profile.docs.map(d => d.data()),
    preferences: preferences.docs.map(d => d.data()),
    templates: templates.docs.map(d => d.data()),
    access_logs: accessLogs.docs.map(d => d.data())
  };
}
```

### List All Users with Templates

```typescript
// Collection group query across all users
const usersWithTemplates = await firestore
  .collectionGroup('templates')
  .get();

// Returns templates from all users
// Each doc has path: users/{user_id}/templates/{template_id}
```

---

## Anti-Patterns to Avoid

### ❌ Flat Structure with Owner Field

```
// DON'T DO THIS
templates/{template_id}
  owner_user_id: string
  
// Problems:
// - Need to filter by owner_user_id on every query
// - Security rules more complex
// - Harder to delete all user data
// - Less clear ownership
```

### ❌ User ID in Document ID

```
// DON'T DO THIS
templates/{user_id}_{template_id}

// Problems:
// - Ugly document IDs
// - Can't reuse Weaviate UUID
// - Harder to parse
// - No clear structure
```

### ✅ Subcollection Pattern

```
// DO THIS
users/{user_id}/templates/{template_id}

// Benefits:
// - Clear structure
// - Simple security rules
// - Easy queries
// - Clean IDs
```

---

## Migration Considerations

### Moving to Users Pattern

If you have existing flat structure:

```typescript
// Migrate templates to users subcollection
async function migrateTemplatesToUsers(): Promise<void> {
  const templates = await firestore.collection('templates').get();
  
  for (const doc of templates.docs) {
    const template = doc.data();
    
    if (!template.is_default) {
      // Move to users subcollection
      await firestore
        .collection('users')
        .doc(template.owner_user_id)
        .collection('templates')
        .doc(doc.id)
        .set(template);
      
      // Delete from flat structure
      await doc.ref.delete();
    }
  }
}
```

---

## Best Practices Summary

### ✅ DO

1. **Use `users/{user_id}/` for all user-specific data**
2. **Keep shared/global data outside `users/`**
3. **Use subcollections for different data types**
4. **Reuse external IDs (like Weaviate UUID) as doc IDs**
5. **Keep security rules simple with path-based access**

### ❌ DON'T

1. **Don't use flat structure with owner_user_id field**
2. **Don't embed user_id in document IDs**
3. **Don't mix user data with shared data**
4. **Don't create permission documents for every user**
5. **Don't use complex security rules when simple path-based rules work**

---

## Complete Firestore Structure for Remember-MCP

```
firestore/
├── templates/
│   └── default/
│       └── {weaviate_uuid}/        # Default templates
│
├── users/
│   └── {user_id}/
│       ├── preferences             # User preferences (single doc)
│       ├── templates/              # User's custom templates
│       │   └── {weaviate_uuid}/
│       ├── access_logs/            # Access attempt logs
│       │   └── {log_id}/
│       └── trust_relationships/    # Who this user trusts
│           └── {accessor_user_id}/
│
└── user_permissions/               # Cross-user permissions
    └── {owner_user_id}/
        └── allowed_accessors/
            └── {accessor_user_id}/
```

**Note**: `user_permissions` is outside `users/` because it involves two users (owner and accessor)

---

**Status**: Best Practice Documentation  
**Pattern**: `users/{user_id}/*` for all user-specific data  
**Benefit**: Simpler, more scalable, better security, easier maintenance
