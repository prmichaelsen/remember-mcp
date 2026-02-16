# Task 63: Fix fetchObjectById Missing Properties in Publish Flow

**Milestone**: M12 (Bug Fixes)
**Estimated Time**: 1 hour
**Dependencies**: None
**Status**: Not Started
**Priority**: CRITICAL 🚨

---

## Objective

Fix critical bug where `remember_publish` and `remember_confirm` (executePublishMemory) fail to fetch all memory properties because they don't specify `returnProperties` parameter in `fetchObjectById()` calls. This causes published memories to be empty shells with only metadata and vectors.

---

## Context

**Critical Bug Discovered**: Published memories in `Memory_public` have no content!

**Symptom**:
- Space memory created with ID ✅
- Vector embedding generated ✅
- Metadata exists ✅
- **All properties missing** ❌ (no title, content, tags, etc.)

**Root Cause**:
Weaviate v3 API `fetchObjectById()` requires explicit `returnProperties` parameter. Without it, only metadata is returned, not the actual property values.

**Affected Code**:
1. [`src/tools/publish.ts:125`](src/tools/publish.ts) - `remember_publish` tool
2. [`src/tools/confirm.ts:154`](src/tools/confirm.ts) - `executePublishMemory` function

**Evidence**:
All other tools correctly specify `returnProperties`:
- `update-relationship.ts:100` ✅ Specifies properties
- `create-relationship.ts:119` ✅ Specifies properties  
- `find-similar.ts:120` ✅ Specifies properties
- `update-memory.ts:119` ✅ Specifies properties
- `delete-relationship.ts:66` ✅ Specifies properties
- `delete-memory.ts:72` ✅ Specifies properties
- **`publish.ts:125`** ❌ Missing returnProperties
- **`confirm.ts:154`** ❌ Missing returnProperties

---

## Steps

### 1. Create Utility Function for Consistent Property Fetching

Create a helper function to ensure all memory properties are always fetched:

```typescript
// src/weaviate/client.ts (add after existing functions)

/**
 * List of all memory properties to fetch
 * Centralized to ensure consistency across all tools
 */
export const ALL_MEMORY_PROPERTIES = [
  'user_id',
  'doc_type',
  'type',
  'title',
  'content',
  'tags',
  'weight',
  'base_weight',
  'trust_level',
  'context',
  'location',
  'relationships',
  'created_at',
  'updated_at',
  'version',
  'attribution',
  'source_url',
  'author',
  'parent_id',
  'thread_root_id',
  'moderation_flags',
] as const;

/**
 * Fetch a memory object by ID with all properties
 *
 * @param collection - Weaviate collection
 * @param memoryId - Memory ID to fetch
 * @returns Memory object with all properties
 */
export async function fetchMemoryWithAllProperties(
  collection: any,
  memoryId: string
) {
  return await collection.query.fetchObjectById(memoryId, {
    returnProperties: ALL_MEMORY_PROPERTIES,
  });
}
```

### 2. Fix remember_publish Tool

Update `fetchObjectById` call to return all properties:

```typescript
// src/tools/publish.ts (around line 125)

// BEFORE (BROKEN):
const memory = await userCollection.query.fetchObjectById(args.memory_id);

// AFTER (FIXED):
const memory = await userCollection.query.fetchObjectById(args.memory_id, {
  returnProperties: [
    'user_id',
    'doc_type',
    'type',
    'title',
    'content',
    'tags',
    'weight',
    'base_weight',
    'trust_level',
    'context',
    'location',
    'relationships',
    'created_at',
    'updated_at',
    'version',
    'attribution',
    'source_url',
    'author',
    'parent_id',
    'thread_root_id',
    'moderation_flags',
  ],
});
```

### 2. Fix executePublishMemory in remember_confirm

Update `fetchObjectById` call in confirm tool:

```typescript
// src/tools/confirm.ts (around line 154)

// BEFORE (BROKEN):
const originalMemory = await userCollection.query.fetchObjectById(
  request.payload.memory_id
);

// AFTER (FIXED):
const originalMemory = await userCollection.query.fetchObjectById(
  request.payload.memory_id,
  {
    returnProperties: [
      'user_id',
      'doc_type',
      'type',
      'title',
      'content',
      'tags',
      'weight',
      'base_weight',
      'trust_level',
      'context',
      'location',
      'relationships',
      'created_at',
      'updated_at',
      'version',
      'attribution',
      'source_url',
      'author',
      'parent_id',
      'thread_root_id',
      'moderation_flags',
    ],
  }
);
```

### 3. Add Logging to Verify Properties

Add debug logging to confirm properties are fetched:

```typescript
// src/tools/confirm.ts (after fetch)

logger.debug('Original memory fetch result', {
  function: 'executePublishMemory',
  found: !!originalMemory,
  memoryId: request.payload.memory_id,
  hasProperties: !!originalMemory?.properties,
  propertyCount: originalMemory?.properties ? Object.keys(originalMemory.properties).length : 0,
  hasTitle: !!originalMemory?.properties?.title,
  hasContent: !!originalMemory?.properties?.content,
});
```

### 4. Test the Fix

Manual test to verify properties are copied:

```bash
# 1. Create a test memory
remember_create_memory({
  type: "note",
  title: "Test Memory",
  content: "This is test content",
  tags: ["test"]
})

# 2. Publish it
remember_publish({
  memory_id: "<memory_id>",
  spaces: ["the_void"]
})

# 3. Confirm publication
remember_confirm({
  token: "<token>"
})

# 4. Search for it
remember_search_space({
  spaces: ["the_void"],
  query: "test content",
  include_comments: false
})

# 5. Verify result has title, content, tags
```

### 5. Update Tests

Add test case for property copying:

```typescript
// tests/unit/publish.test.ts

describe('remember_publish', () => {
  it('should fetch all memory properties', async () => {
    const mockMemory = {
      properties: {
        user_id: 'test-user',
        title: 'Test Title',
        content: 'Test Content',
        tags: ['tag1', 'tag2'],
        // ... all properties
      },
    };

    mockCollection.query.fetchObjectById.mockResolvedValue(mockMemory);

    await handlePublish({ memory_id: 'test-id', spaces: ['the_void'] }, 'test-user');

    expect(mockCollection.query.fetchObjectById).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        returnProperties: expect.arrayContaining([
          'title',
          'content',
          'tags',
          'user_id',
          'doc_type',
        ]),
      })
    );
  });
});
```

---

## Verification

- [ ] Created `fetchMemoryWithAllProperties` utility function in `src/weaviate/client.ts`
- [ ] Created `ALL_MEMORY_PROPERTIES` constant with all 20+ properties
- [ ] `remember_publish` uses `fetchMemoryWithAllProperties`
- [ ] `executePublishMemory` uses `fetchMemoryWithAllProperties`
- [ ] Utility function exported from client module
- [ ] Debug logging shows property count > 0
- [ ] Debug logging shows `hasTitle: true` and `hasContent: true`
- [ ] Manual test: Published memory has title, content, tags
- [ ] Search returns published memory with full content
- [ ] TypeScript compiles without errors
- [ ] Build successful
- [ ] All tests passing

---

## Expected Output

**Before Fix** (Current - BROKEN):
```json
{
  "id": "9b536938-1188-4e69-b3cd-4362d84fff1c",
  "vector": [...],
  // ❌ NO PROPERTIES - Empty shell
}
```

**After Fix**:
```json
{
  "id": "9b536938-1188-4e69-b3cd-4362d84fff1c",
  "vector": [...],
  "properties": {
    "title": "Breaking the Mold of Boredom",
    "content": "i feel like i'm boring...",
    "type": "note",
    "tags": ["self-discovery", "societal norms", "breaking free"],
    "author_id": "MnOyIarhz5b8n06TsTovM582NSG2",
    "spaces": ["the_void"],
    "published_at": "2026-02-16T21:44:39Z",
    // ... all other properties
  }
}
```

---

## Impact Analysis

**Severity**: CRITICAL 🚨

**Affected Users**: ALL users who published memories since v2.4.0

**Data Loss**: 
- All published memories are empty shells
- Content exists in user collections but not in public space
- Search returns no results (no content to match)
- Discovery completely broken

**Workaround**: None - memories must be re-published after fix

**Migration**: 
- Option 1: Users re-publish memories manually
- Option 2: Create migration script to re-publish all memories
- Option 3: Backfill from user collections (requires tracking original IDs)

---

## Common Issues and Solutions

### Issue 1: TypeScript error about returnProperties

**Cause**: Type definition might not include all properties
**Solution**: Use `as any` if needed or update type definition

### Issue 2: Some properties still missing

**Cause**: Property list incomplete
**Solution**: Check schema.ts for all property names

### Issue 3: Old memories still empty

**Cause**: This fix only affects new publications
**Solution**: Users must re-publish or run migration script

---

## Resources

- [Weaviate v3 Query API](https://weaviate.io/developers/weaviate/api/graphql/get)
- [Memory Schema](../src/weaviate/schema.ts)
- [Space Schema](../src/weaviate/space-schema.ts)
- [Other fetchObjectById Examples](../src/tools/)

---

## Notes

- **This is more critical than Task 62** (response storage)
- Task 62 affects audit trail, Task 63 affects core functionality
- Without this fix, the entire publish/space feature is broken
- This bug has been in production since shared spaces were released
- All published memories need to be re-published after fix
- Consider adding integration test to catch this in future
- ✅ Created `fetchMemoryWithAllProperties` helper function
- This prevents the bug from recurring in future code
- Consider migrating other tools to use the utility function
- Consider adding ESLint rule to prevent direct `fetchObjectById` usage

---

## Related Tasks

- **Task 62**: Fix confirmation response storage (audit trail)
- **Task 58**: Add comment unit tests
- **Task 59**: Update documentation

---

**Status**: Not Started
**Recommendation**: FIX IMMEDIATELY - This breaks core functionality
**Priority**: CRITICAL - Must be fixed before any other M12 tasks
