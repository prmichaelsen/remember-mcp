# Task 67: Migrate Memory_public Collection Schema

**Milestone**: M12 (Comment System)
**Estimated Time**: 1 hour
**Dependencies**: Task 55, Task 66
**Status**: Not Started
**Priority**: High

---

## Objective

Update the existing `Memory_public` collection in Weaviate Cloud to include the missing comment fields (`parent_id` and `thread_root_id`). Currently, only `moderation_flags` exists in the production schema.

---

## Problem

The `Memory_public` collection was created before comment fields were added to the schema. Weaviate doesn't support adding properties to existing collections, so we need to migrate the data.

**Current State** (Production):
- ✅ `moderation_flags` field exists
- ❌ `parent_id` field missing
- ❌ `thread_root_id` field missing

**Expected State** (Code):
- ✅ All three fields defined in `src/weaviate/space-schema.ts` (lines 261-275)

---

## Impact

**Without Migration**:
- Cannot create comments in shared spaces
- Cannot thread discussions
- Published memories missing comment fields
- Schema mismatch between code and production

**With Migration**:
- Full comment system functionality in shared spaces
- Threaded discussions work correctly
- Schema matches code definition

---

## Migration Options

### Option 1: Delete and Recreate (DESTRUCTIVE)

**Steps**:
1. Backup all data from `Memory_public`
2. Delete `Memory_public` collection
3. Recreate with updated schema (automatic via `ensurePublicCollection`)
4. Restore data with new fields initialized

**Pros**:
- Clean schema
- Simple process

**Cons**:
- ⚠️ **LOSES ALL DATA** if backup fails
- Downtime during migration
- Risky for production

### Option 2: Create New Collection and Migrate (SAFE)

**Steps**:
1. Create `Memory_public_v2` with updated schema
2. Copy all data from `Memory_public` to `Memory_public_v2`
3. Initialize comment fields: `parent_id: null`, `thread_root_id: null`, `moderation_flags: []`
4. Test `Memory_public_v2` thoroughly
5. Update code to use `Memory_public_v2`
6. Delete old `Memory_public` after verification

**Pros**:
- ✅ Zero data loss
- ✅ Can rollback if issues
- ✅ Test before switching

**Cons**:
- More complex
- Temporary storage duplication

### Option 3: Live with Current Schema (NOT RECOMMENDED)

**Steps**:
- Do nothing
- Comment system only works for personal memories
- Shared spaces don't support comments

**Pros**:
- No migration needed

**Cons**:
- ❌ Incomplete feature
- ❌ Schema mismatch
- ❌ Technical debt

---

## Recommended Approach: Option 2 (Safe Migration)

### Step 1: Create Backup Collection

```typescript
// Create Memory_public_v2 with full schema
const client = getWeaviateClient();
await client.collections.create({
  name: 'Memory_public_v2',
  // ... full schema from space-schema.ts including comment fields
});
```

### Step 2: Migrate Data

```typescript
// Fetch all objects from Memory_public
const oldCollection = client.collections.get('Memory_public');
const objects = await oldCollection.query.fetchObjects({ limit: 10000 });

// Insert into Memory_public_v2 with comment fields
const newCollection = client.collections.get('Memory_public_v2');
for (const obj of objects.objects) {
  await newCollection.data.insert({
    ...obj.properties,
    parent_id: null,           // Initialize to null
    thread_root_id: null,      // Initialize to null
    moderation_flags: obj.properties.moderation_flags || [], // Preserve existing
  });
}
```

### Step 3: Update Code

```typescript
// src/weaviate/space-schema.ts
export const PUBLIC_COLLECTION_NAME = 'Memory_public_v2'; // Changed from 'Memory_public'
```

### Step 4: Verify and Cleanup

```bash
# Test the new collection
# Verify all data migrated correctly
# Check comment fields exist

# After verification (wait 24-48 hours):
# Delete old Memory_public collection
```

---

## Verification

- [ ] `Memory_public_v2` collection created with full schema
- [ ] All data migrated from `Memory_public`
- [ ] Comment fields present: `parent_id`, `thread_root_id`, `moderation_flags`
- [ ] All existing memories have `parent_id: null`, `thread_root_id: null`
- [ ] `moderation_flags` preserved from original data
- [ ] Code updated to use `Memory_public_v2`
- [ ] All tests passing
- [ ] Can create comments in shared spaces
- [ ] Can publish memories with comment fields
- [ ] Old `Memory_public` collection deleted (after verification period)

---

## Rollback Plan

If issues occur:

1. **Immediate Rollback**:
   ```typescript
   export const PUBLIC_COLLECTION_NAME = 'Memory_public'; // Revert to old
   ```

2. **Keep Both Collections**:
   - Old collection still exists
   - Can switch back instantly
   - No data loss

3. **After Verification**:
   - Only delete old collection after 24-48 hours
   - Ensure new collection works correctly

---

## Alternative: Manual Schema Update (If Supported)

**Note**: Weaviate typically doesn't support adding properties to existing collections. Check Weaviate documentation for your version to see if schema evolution is supported.

If supported:
```bash
# Use Weaviate API to add properties
# This is version-dependent and may not be available
```

---

## Production Checklist

- [ ] Backup current `Memory_public` data
- [ ] Create `Memory_public_v2` with full schema
- [ ] Migrate all data with comment fields initialized
- [ ] Test new collection thoroughly
- [ ] Update `PUBLIC_COLLECTION_NAME` constant
- [ ] Deploy updated code
- [ ] Verify in production
- [ ] Monitor for 24-48 hours
- [ ] Delete old `Memory_public` collection

---

## Notes

- This migration is required for comment system to work in shared spaces
- Personal memory collections (`Memory_{user_id}`) don't need migration if created after Task 55
- Old personal collections may also need migration (separate task)
- Consider running migration during low-traffic period
- Document migration in CHANGELOG.md

---

**Status**: Not Started
**Recommendation**: Execute Option 2 (safe migration) during next deployment window
**Priority**: High - Blocks comment system in shared spaces
