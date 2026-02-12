# Task: Fix Weaviate "Or" Operator Query Bug

**Project**: remember-mcp  
**Estimated Time**: 1-2 hours  
**Priority**: High  
**Status**: Not Started

---

## Problem

Weaviate query failing with error:
```
no children for operator "Or"
```

This occurs when searching memories, indicating the query builder is creating an "Or" operator with an empty children array, which is invalid in Weaviate.

## Root Cause

The Weaviate query construction in remember-mcp is building a filter with an "Or" operator but not adding any child conditions to it. This happens when:
- Building complex filters with multiple conditions
- Conditional logic results in empty filter arrays
- Or operator is created before checking if there are conditions to add

## Investigation Steps

1. **Find where "Or" operator is used**
   - Search for `.or(` or `Or(` in remember-mcp codebase
   - Check search-memory.ts, query-memory.ts, find-similar.ts

2. **Identify the query construction logic**
   - Look for filter building code
   - Find where Or operator is created
   - Check if children array is validated before creating operator

3. **Reproduce locally**
   - Test search with various parameters
   - Identify which search parameters trigger the bug
   - Confirm the empty Or operator

## Expected Fix

Add validation before creating Or operator:
```typescript
// Before (buggy):
const orFilter = weaviate.filter.or(...conditions);

// After (fixed):
if (conditions.length === 0) {
  // Skip Or operator if no conditions
  return baseQuery;
} else if (conditions.length === 1) {
  // Use single condition directly
  return baseQuery.withWhere(conditions[0]);
} else {
  // Use Or operator only when multiple conditions
  return baseQuery.withWhere(weaviate.filter.or(...conditions));
}
```

## Files to Check

- `src/tools/search-memory.ts` - Main search implementation
- `src/tools/query-memory.ts` - Query tool
- `src/tools/find-similar.ts` - Similarity search
- `src/weaviate/client.ts` - Weaviate client wrapper
- Any file that builds Weaviate filters

## Verification

- [ ] Or operator only created when conditions.length > 1
- [ ] Empty conditions array handled gracefully
- [ ] Single condition doesn't use Or operator
- [ ] All search tools work without errors
- [ ] Tests pass

---

**Impact**: High - blocks all search functionality  
**Complexity**: Medium - requires understanding Weaviate query API  
**Location**: remember-mcp project (not remember-mcp-server)
