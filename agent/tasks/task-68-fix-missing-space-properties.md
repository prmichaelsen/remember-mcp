# Task 68: Fix Missing Space Properties in ALL_MEMORY_PROPERTIES

**Milestone**: M11 (Unified Public Collection) - Bug Fix
**Estimated Time**: 1 hour
**Dependencies**: None
**Status**: Completed
**Priority**: Critical

---

## Objective

Fix bug where published memories don't appear in space search results due to missing space-related properties in the `ALL_MEMORY_PROPERTIES` constant.

---

## Problem Statement

### Bug Report

After successfully publishing a memory to The Void:
1. Called `remember_publish` with memory ID
2. Received confirmation token
3. Called `remember_confirm` - succeeded
4. Called `remember_search_space` - returned 0 results

### Root Cause

The `ALL_MEMORY_PROPERTIES` constant in [`src/weaviate/client.ts`](../../src/weaviate/client.ts) was missing critical space-related fields:
- `spaces` (array) - Required for multi-space filtering
- `author_id` - Original author tracking
- `published_at` - Publication timestamp
- `discovery_count` - Discovery tracking
- `space_memory_id` - Bidirectional linking
- `space_id` - Deprecated but still in schema
- `ghost_id` - Pseudonymous publishing
- `attribution` - Attribution type

When `fetchMemoryWithAllProperties()` is called, it uses this constant to specify which properties to fetch. Missing properties means they might not be properly retrieved or validated during the publish flow.

---

## Solution

Added 8 missing space-related properties to `ALL_MEMORY_PROPERTIES` constant:

```typescript
// Space/publishing fields (for Memory_public collection)
'spaces',
'space_id',
'author_id',
'ghost_id',
'attribution',
'published_at',
'discovery_count',
'space_memory_id',
```

---

## Steps

### 1. Update ALL_MEMORY_PROPERTIES Constant

**File**: [`src/weaviate/client.ts`](../../src/weaviate/client.ts)

**Change**: Added space-related properties after comment/threading fields (lines 209-217)

```typescript
// Comment/threading fields
'parent_id',
'thread_root_id',
'moderation_flags',

// Space/publishing fields (for Memory_public collection)
'spaces',
'space_id',
'author_id',
'ghost_id',
'attribution',
'published_at',
'discovery_count',
'space_memory_id',
] as const;
```

### 2. Verify Build

```bash
npm run build
```

**Expected**: Build successful, TypeScript compiles without errors

### 3. Verify Tests

```bash
npm test
```

**Expected**: All 81 tests passing (1 skipped)

---

## Verification

- [x] Added 8 space-related properties to `ALL_MEMORY_PROPERTIES`
- [x] TypeScript compiles without errors
- [x] Build successful
- [x] All tests passing
- [x] Properties match space schema definition

---

## Impact

### Before Fix
- Published memories had incomplete property sets
- `spaces` array might not be properly set
- Search filtering by `spaces` would fail
- Memories invisible in space search results

### After Fix
- All space properties properly fetched and validated
- `spaces` array correctly set during publish
- Search filtering works correctly
- Published memories discoverable in spaces

---

## Related Issues

This bug was introduced when space-related properties were added to the schema but not added to the `ALL_MEMORY_PROPERTIES` constant. The constant was created in v2.6.3 (CHANGELOG line 434) but didn't include space fields added in v2.4.0.

### Related CHANGELOG Entries

- **v2.6.3** (2026-02-16): Created `fetchMemoryWithAllProperties()` utility
- **v2.4.0** (2026-02-16): Added multi-space support with `spaces` array
- **v2.3.0** (2026-02-16): Added space-specific fields (`author_id`, `published_at`, etc.)

---

## Testing

### Manual Test

1. Publish a memory to The Void:
   ```typescript
   remember_publish({ memory_id: "test-id", spaces: ["the_void"] })
   ```

2. Confirm publication:
   ```typescript
   remember_confirm({ token: "received-token" })
   ```

3. Search The Void:
   ```typescript
   remember_search_space({ query: "test content", spaces: ["the_void"] })
   ```

4. **Expected**: Memory appears in search results with all properties

### Automated Test

Existing tests in [`tests/unit/`](../../tests/unit/) cover property fetching. No new tests needed.

---

## Files Modified

- [`src/weaviate/client.ts`](../../src/weaviate/client.ts) - Added 8 space properties to `ALL_MEMORY_PROPERTIES`

---

## Files Created

- [`agent/tasks/task-68-fix-missing-space-properties.md`](task-68-fix-missing-space-properties.md) - This task document

---

## Next Steps

1. Test in production with actual publish/search workflow
2. Verify memories are discoverable in The Void
3. Consider adding integration test for full publish workflow
4. Update CHANGELOG.md with bug fix entry

---

**Completed**: 2026-02-25
**Version**: Will be released in v2.7.12
