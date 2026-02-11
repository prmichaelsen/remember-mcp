# Cross-Database ID Strategy

**Concept**: Reuse Weaviate UUIDs as Firestore document IDs for consistency  
**Created**: 2026-02-11  
**Status**: Design Specification

---

## Overview

When data is stored in both Weaviate and Firestore, we use the **Weaviate-generated UUID as the primary identifier** for both databases. This creates a single source of truth for IDs and simplifies cross-database operations.

---

## Strategy: Weaviate ID as Primary

### Principle

**Weaviate generates the ID, Firestore reuses it**

```
1. Create document in Weaviate → Get UUID
2. Use that UUID as Firestore document ID
3. Both databases reference same ID
4. No ID mapping table needed
```

---

## Implementation

### Creating a Template

```typescript
async function createTemplate(
  template: Template,
  user_id: string
): Promise<string> {
  // 1. Create in Weaviate (generates UUID)
  const weaviateId = await weaviateClient
    .collection(`Template_${user_id}`)
    .data.insert({
      ...template,
      user_id,
      created_at: new Date()
    });
  
  // 2. Use same ID in Firestore
  await firestore
    .collection('templates')
    .doc(weaviateId)  // ✅ Reuse Weaviate ID
    .set({
      template_id: weaviateId,
      owner_user_id: user_id,
      template_name: template.template_name,
      visibility: 'private',
      created_at: Timestamp.now()
    });
  
  return weaviateId;  // Return single ID
}
```

### Creating a Memory

```typescript
async function createMemory(
  memory: Memory,
  user_id: string
): Promise<string> {
  // 1. Create in Weaviate (generates UUID)
  const memoryId = await weaviateClient
    .collection(`Memory_${user_id}`)
    .data.insert({
      ...memory,
      user_id,
      created_at: new Date()
    });
  
  // 2. If memory needs Firestore metadata (e.g., for permissions)
  if (memory.needs_firestore_metadata) {
    await firestore
      .collection('memories')
      .doc(memoryId)  // ✅ Reuse Weaviate ID
      .set({
        memory_id: memoryId,
        user_id,
        trust_overrides: {},
        access_log: [],
        created_at: Timestamp.now()
      });
  }
  
  return memoryId;
}
```

### Updating Across Databases

```typescript
async function updateTemplate(
  template_id: string,
  updates: Partial<Template>
): Promise<void> {
  // 1. Update in Weaviate
  await weaviateClient
    .collection(`Template_${user_id}`)
    .data.update({
      id: template_id,
      properties: updates
    });
  
  // 2. Update in Firestore (same ID)
  await firestore
    .collection('templates')
    .doc(template_id)  // ✅ Same ID
    .update({
      ...updates,
      updated_at: Timestamp.now()
    });
}
```

### Querying Across Databases

```typescript
async function getTemplateWithMetadata(
  template_id: string
): Promise<TemplateWithMetadata> {
  // Parallel fetch using same ID
  const [weaviateData, firestoreData] = await Promise.all([
    weaviateClient
      .collection('Template_system')
      .data.getById(template_id),
    firestore
      .collection('templates')
      .doc(template_id)  // ✅ Same ID
      .get()
  ]);
  
  return {
    ...weaviateData.properties,
    ...firestoreData.data(),
    id: template_id  // Single consistent ID
  };
}
```

---

## Benefits

### 1. **Simplicity**
- Single ID to track
- No ID mapping table needed
- No synchronization issues
- Clear primary key

### 2. **Consistency**
- Same ID in both databases
- Easy to correlate data
- Simpler debugging
- Clear data lineage

### 3. **Performance**
- Parallel queries using same ID
- No lookup overhead
- Efficient joins
- Fast cross-database operations

### 4. **Maintainability**
- Less code complexity
- Fewer edge cases
- Easier to reason about
- Simpler migrations

---

## Firestore Collection Structure

### Recommended Structure

```
firestore/
├── templates/
│   ├── default/
│   │   ├── {weaviate_uuid_1}/      # ✅ Weaviate ID as doc ID
│   │   │   ├── metadata
│   │   │   └── permissions/
│   │   └── {weaviate_uuid_2}/
│   │       └── ...
│   └── users/
│       └── {user_id}/
│           └── templates/
│               └── {weaviate_uuid_3}/  # ✅ Weaviate ID as doc ID
│                   ├── metadata
│                   └── permissions/
│
├── memories/
│   └── {weaviate_uuid}/           # ✅ Only if metadata needed
│       ├── trust_overrides/
│       └── access_log/
│
└── user_preferences/
    └── {user_id}/
        └── preferences
```

**Alternative Simpler Structure**:
```
firestore/
├── templates/
│   ├── {weaviate_uuid}/           # ✅ All templates, default and user
│   │   ├── owner_user_id
│   │   ├── is_default: boolean
│   │   └── permissions/
│   └── {weaviate_uuid}/
│       └── ...
│
└── user_preferences/
    └── {user_id}/
```

---

## Comparison

### ❌ Bad: Separate IDs

```typescript
// Weaviate
{
  id: "weav_abc123",  // Weaviate-generated
  template_name: "Person Profile"
}

// Firestore
{
  firestore_id: "fire_xyz789",  // Firestore-generated
  weaviate_id: "weav_abc123",   // Reference to Weaviate
  template_name: "Person Profile"
}

// Problems:
// - Two IDs to track
// - Need mapping table
// - Synchronization complexity
// - More error-prone
```

### ✅ Good: Shared ID

```typescript
// Weaviate
{
  id: "abc123-def456-ghi789",  // Weaviate-generated UUID
  template_name: "Person Profile"
}

// Firestore
{
  // Document ID: "abc123-def456-ghi789"  ✅ Same as Weaviate
  template_id: "abc123-def456-ghi789",
  owner_user_id: "user_123",
  visibility: "private"
}

// Benefits:
// - Single ID
// - No mapping needed
// - Simple queries
// - Clear relationship
```

---

## Edge Cases

### 1. Weaviate ID Conflicts

**Q**: What if Weaviate UUID conflicts with Firestore?  
**A**: Extremely unlikely (UUID collision probability ~10^-18)

### 2. Firestore Document Already Exists

```typescript
// Handle race conditions
try {
  await firestore
    .collection('templates')
    .doc(weaviateId)
    .create({  // Use .create() not .set()
      ...metadata
    });
} catch (error) {
  if (error.code === 'already-exists') {
    // Document exists, update instead
    await firestore
      .collection('templates')
      .doc(weaviateId)
      .update(metadata);
  }
}
```

### 3. Orphaned Records

```typescript
// If Weaviate insert succeeds but Firestore fails
async function createWithRollback(data: any): Promise<string> {
  let weaviateId: string | null = null;
  
  try {
    // 1. Create in Weaviate
    weaviateId = await weaviateClient.insert(data);
    
    // 2. Create in Firestore
    await firestore.doc(weaviateId).set(metadata);
    
    return weaviateId;
  } catch (error) {
    // Rollback Weaviate if Firestore fails
    if (weaviateId) {
      await weaviateClient.delete(weaviateId);
    }
    throw error;
  }
}
```

---

## Recommendation

**Use Weaviate UUID as primary ID for both databases**

### For Templates:
```
Weaviate: Template_system/{uuid}
Firestore: templates/{uuid}  ✅ Same ID
```

### For Memories (if Firestore metadata needed):
```
Weaviate: Memory_{user_id}/{uuid}
Firestore: memories/{uuid}  ✅ Same ID
```

### For User Preferences:
```
Firestore: user_preferences/{user_id}  ← User ID, not Weaviate ID
```

---

**Status**: Design Specification  
**Strategy**: Weaviate generates UUID, Firestore reuses it  
**Benefit**: Single consistent ID across databases
