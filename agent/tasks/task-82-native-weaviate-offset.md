# Task 82: Use Native Weaviate Offset in search-memory

**Milestone**: M18 - Performance Tuning
**Estimated Time**: 0.5 hours
**Dependencies**: None
**Status**: Not Started

---

## Objective

Pass `offset` directly to Weaviate's hybrid search query instead of fetching `limit + offset` results and slicing in JavaScript.

---

## Context

`src/tools/search-memory.ts` currently fetches extra records and uses `slice(offset)` to implement pagination. Weaviate v3 API supports native `offset` in query options, which reduces network payload for paginated searches.

---

## Steps

### 1. Update search query options

**File**: `src/tools/search-memory.ts`

Replace:
```typescript
const searchOptions: any = {
  alpha: alpha,
  limit: limit + offset,
};
// ...
const paginatedResults = results.objects.slice(offset);
```

With:
```typescript
const searchOptions: any = {
  alpha: alpha,
  limit: limit,
  offset: offset,
};
// ... use results.objects directly
```

### 2. Check if same pattern exists in other search tools

Check `query-memory.ts`, `search-space.ts`, `query-space.ts`, `find-similar.ts` for the same pattern.

### 3. Verify tests pass

---

## Verification

- [ ] Offset handled by Weaviate, not JS slice
- [ ] Pagination still works correctly
- [ ] All search-related tests pass
- [ ] TypeScript compiles without errors

---

## Expected Output

**Files Modified**:
- `src/tools/search-memory.ts`
- Possibly other search tool files
