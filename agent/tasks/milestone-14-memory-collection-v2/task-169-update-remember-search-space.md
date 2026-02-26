# Task 169: Implement remember_search_space Tool

**Milestone**: Milestone 14 - Memory Collection Pattern v2
**Estimated Time**: 4-6 hours
**Dependencies**: [Task 165: Core Infrastructure Setup](task-165-core-infrastructure-setup.md)
**Status**: Not Started

---

## Objective

Implement the `remember_search_space` tool to query memories using space_ids filtering and support group searches.

---

## Steps

### 1. Create Tool Schema

**File**: `src/tools/remember-search-space.ts`

**Actions**:
- Update input schema to accept `spaces` array (filter by spaces)
- Add `groups` array parameter (filter by groups)
- Keep `query` parameter (search query)
- Add `search_type` parameter (hybrid, bm25, semantic)
- Update tool description

**Expected Schema**:
```typescript
{
  query: string,
  spaces?: string[],      // ["cooking", "recipes"]
  groups?: string[],      // ["{group-id}"]
  search_type?: string,   // "hybrid" | "bm25" | "semantic"
  limit?: number
}
```

### 2. Implement Space Filtering

**Actions**:
- Query `Memory_spaces_public` collection
- Filter by `space_ids` array contains any of specified spaces
- Use Weaviate's array filtering capabilities
- Return memories with composite IDs

**Expected Behavior**:
```typescript
// Search specific spaces
remember_search_space({
  query: "recipe",
  spaces: ["cooking", "recipes"]
})

// Queries: Memory_spaces_public WHERE space_ids contains "cooking" OR "recipes"
```

### 3. Implement Group Filtering

**Actions**:
- Query specific `Memory_groups_{groupId}` collections
- Combine results from multiple group collections
- Return memories with composite IDs

**Expected Behavior**:
```typescript
// Search specific groups
remember_search_space({
  query: "recipe",
  groups: ["{foodie-group}", "{recipe-club}"]
})

// Queries: Memory_groups_{foodie-group} AND Memory_groups_{recipe-club}
```

### 4. Implement Combined Search

**Actions**:
- Support searching both spaces and groups simultaneously
- Merge results from both query types
- Deduplicate by composite ID
- Sort by relevance score

**Expected Behavior**:
```typescript
// Search both spaces and groups
remember_search_space({
  query: "recipe",
  spaces: ["cooking"],
  groups: ["{foodie-group}"]
})

// Queries both Memory_spaces_public and Memory_groups_{foodie-group}
// Returns merged, deduplicated results
```

### 5. Implement All-Public Search

**Actions**:
- When no spaces or groups specified, search all public memories
- Query entire `Memory_spaces_public` collection
- Return all matching memories regardless of space_ids

**Expected Behavior**:
```typescript
// Search all public memories
remember_search_space({
  query: "recipe"
})

// Queries: Memory_spaces_public (all memories)
```

### 6. Write Integration Tests

**File**: `tests/integration/remember-search-space.test.ts`

**Actions**:
- Test space filtering (single and multiple)
- Test group filtering (single and multiple)
- Test combined search (spaces + groups)
- Test all-public search
- Test deduplication
- Test search types (hybrid, bm25, semantic)
- Test error cases

**Expected Output**: All tests passing

---

## Verification

- [ ] Tool schema updated correctly
- [ ] Space filtering works correctly
- [ ] Group filtering works correctly
- [ ] Combined search works correctly
- [ ] All-public search works correctly
- [ ] Deduplication works correctly
- [ ] Search types work correctly
- [ ] Integration tests passing
- [ ] TypeScript compiles without errors
- [ ] Tool description updated in MCP manifest

---

## Expected Output

### Files Modified
- `src/tools/remember-search-space-v2.ts` (~220 lines)

### Files Created
- `tests/integration/remember-search-space.test.ts` (~180 lines)

### Test Output
```
✓ Space filtering (4 tests)
✓ Group filtering (4 tests)
✓ Combined search (4 tests)
✓ All-public search (3 tests)
✓ Deduplication (3 tests)
✓ Search types (3 tests)
✓ Error handling (3 tests)

Total: 24 tests passing
```

---

## Notes

- This is a breaking change from v1 (single space only)
- Deduplication critical for combined searches
- Consider caching frequently searched spaces
- Performance testing needed for large collections

---

**Next Task**: [Task 170: Update remember_create_memory Tool](task-170-update-remember-create-memory.md)
