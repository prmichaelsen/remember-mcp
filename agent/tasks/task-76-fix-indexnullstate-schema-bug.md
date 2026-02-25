# Task 76: Fix indexNullState Schema Configuration Bug

**Milestone**: M13 (Soft Delete System)
**Estimated Time**: 1 hour
**Dependencies**: Task 70 (Soft Delete Schema Fields)
**Status**: Completed
**Priority**: Critical

---

## Objective

Fix critical Weaviate schema configuration bug where `deleted_at` field filtering fails because `indexNullState: true` was not configured in the inverted index. This prevents filtering on null values, which is required for the soft delete system's default behavior (exclude deleted memories).

---

## Problem

**Error Message**:
```
WeaviateQueryError: Query call with protocol gRPC failed with message: 
/weaviate.v1.Weaviate/Search UNKNOWN: object search at index memory_mnoyiarhz5b8n06tstovm582nsg2: 
local shard object search memory_mnoyiarhz5b8n06tstovm582nsg2_12vqVNds7o70: 
resolve doc ids for prop/value pair: nested AND/OR query: nested child 0: 
Nullstate must be indexed to be filterable! 
Add `indexNullState: true` to the invertedIndexConfig
```

**Root Cause**:
- Soft delete system (v3.0.0) added `deleted_at` field to schema
- Default filter uses `deleted_at IS NULL` to exclude deleted memories
- Weaviate requires `indexNullState: true` to filter on null values
- Schema was created without this configuration

**Impact**:
- 🚨 **CRITICAL**: All memory searches fail with gRPC error
- Affects all users attempting to search memories
- Soft delete system completely non-functional
- Production service down

---

## Solution

Add `invertedIndex` configuration with `indexNullState: true` to both schema files.

**Note**: Existing collections must be recreated - this configuration cannot be updated on existing collections.

---

## Steps

### 1. Fix Memory Schema ([`src/weaviate/schema.ts`](../../src/weaviate/schema.ts))

Add inverted index configuration:

```typescript
await client.collections.create({
  name: collectionName,
  
  // Vectorizer configuration
  vectorizers: weaviate.configure.vectorizer.text2VecOpenAI({
    model: 'text-embedding-3-small',
    sourceProperties: ['content', 'title', 'summary', 'observation'],
  }),

  // Inverted index configuration
  // indexNullState: true is required for filtering on null values (e.g., deleted_at IS NULL)
  invertedIndex: weaviate.configure.invertedIndex({
    indexNullState: true,
  }),

  properties: [
    // ... existing properties
  ]
});
```

### 2. Fix Space Schema ([`src/weaviate/space-schema.ts`](../../src/weaviate/space-schema.ts))

Add same configuration to public collection:

```typescript
await client.collections.create({
  name: collectionName,

  // Vectorizer configuration
  vectorizers: weaviate.configure.vectorizer.text2VecOpenAI({
    model: 'text-embedding-3-small',
    sourceProperties: ['content', 'title', 'summary', 'observation'],
  }),

  // Inverted index configuration
  // indexNullState: true is required for filtering on null values (e.g., deleted_at IS NULL)
  invertedIndex: weaviate.configure.invertedIndex({
    indexNullState: true,
  }),

  properties: [
    // ... existing properties
  ]
});
```

### 3. Build and Test

```bash
npm run build
npm test
```

**Expected**: All tests passing, TypeScript compiles without errors

---

## Verification

- [x] Added `invertedIndex` configuration to [`src/weaviate/schema.ts`](../../src/weaviate/schema.ts)
- [x] Added `invertedIndex` configuration to [`src/weaviate/space-schema.ts`](../../src/weaviate/space-schema.ts)
- [x] Used correct API: `weaviate.configure.invertedIndex()` (not `invertedIndexConfig`)
- [x] TypeScript compiles without errors
- [x] Build successful
- [x] All 93 tests passing

---

## Migration Notes

**For Existing Collections**:

⚠️ **CRITICAL**: Existing Weaviate collections must be recreated to apply this configuration change.

**Migration Steps**:
1. Export existing data from old collections
2. Delete old collections
3. Restart server (creates new collections with correct config)
4. Re-import data

**Alternative**: If no production data exists, simply delete collections and let them be recreated.

**Command to delete collection** (use with caution):
```typescript
await client.collections.delete('Memory_{user_id}');
await client.collections.delete('Memory_public');
```

---

## Technical Details

**Weaviate v3 API**:
- Configuration uses `weaviate.configure.invertedIndex()` helper
- Property is `invertedIndex` (not `invertedIndexConfig`)
- `indexNullState: true` enables filtering on null values
- Cannot be updated on existing collections (requires recreation)

**Why This is Required**:
- Soft delete uses `deleted_at IS NULL` filter to exclude deleted memories
- Without `indexNullState: true`, Weaviate cannot filter on null values
- Results in gRPC error: "Nullstate must be indexed to be filterable"

**Performance Impact**:
- Minimal - indexing null state adds small overhead
- Required for soft delete functionality
- Trade-off is acceptable for data safety

---

## Files Modified

- [`src/weaviate/schema.ts`](../../src/weaviate/schema.ts) - Added invertedIndex config (line 55-58)
- [`src/weaviate/space-schema.ts`](../../src/weaviate/space-schema.ts) - Added invertedIndex config (line 107-110)

---

## Related Issues

**User Feedback**: "worked but gave this new error on next memory search"

**Root Cause**: Task 70 added `deleted_at` field but didn't configure null state indexing

**Prevention**: Always add `indexNullState: true` when creating nullable fields that will be filtered

---

## Next Steps

1. Document this in CHANGELOG as patch release (v3.0.1)
2. Notify users they need to recreate collections
3. Add migration guide to README
4. Consider adding collection recreation utility

---

**Status**: Completed (2026-02-25)
**Version**: v3.0.1 (patch release)
**Impact**: Critical bug fix - restores search functionality
