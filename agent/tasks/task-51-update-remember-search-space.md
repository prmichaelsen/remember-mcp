# Task 51: Update remember_search_space for Multi-Space

**Milestone**: M11 - Unified Public Collection
**Estimated Time**: 3 hours
**Dependencies**: Task 50
**Status**: Not Started

---

## Objective

Update the `remember_search_space` tool to accept a `spaces` array parameter, enabling users to search multiple spaces in a single query.

---

## Steps

### 1. Update Tool Input Schema

**File**: `src/tools/search-space.ts`

**Change**:
```typescript
// Before
space: {
  type: 'string',
  enum: SUPPORTED_SPACES,
  default: 'the_void'
}

// After
spaces: {
  type: 'array',
  items: {
    type: 'string',
    enum: SUPPORTED_SPACES
  },
  description: 'Spaces to search (e.g., ["the_void", "dogs"])',
  minItems: 1,
  default: ['the_void']
}
```

### 2. Update handleSearchSpace Function

**File**: `src/tools/search-space.ts`

**Key Changes**:
```typescript
interface SearchSpaceArgs {
  query: string;
  spaces: string[];  // ✅ Changed from space: string
  content_type?: string;
  tags?: string[];
  // ... other filters
}

export async function handleSearchSpace(
  args: SearchSpaceArgs,
  userId: string
): Promise<string> {
  // Validate all spaces
  const invalidSpaces = args.spaces.filter(s => !isValidSpaceId(s));
  if (invalidSpaces.length > 0) {
    return JSON.stringify({
      success: false,
      error: 'Invalid space IDs',
      message: `Invalid spaces: ${invalidSpaces.join(', ')}`
    }, null, 2);
  }
  
  // Use unified public collection
  const publicCollection = await ensurePublicCollection(weaviateClient);
  
  // Build filter for spaces array
  const spacesFilter = publicCollection.filter
    .byProperty('spaces')
    .containsAny(args.spaces);  // ✅ Search multiple spaces!
  
  // Combine with other filters
  const filters = [spacesFilter, ...otherFilters];
  const combinedFilter = Filters.and(...filters);
  
  // Execute search
  const results = await publicCollection.query
    .hybrid(args.query, { alpha: 0.5 })
    .filter(combinedFilter)
    .limit(args.limit || 10)
    .offset(args.offset || 0);
  
  // ... format and return results
}
```

### 3. Update Result Formatting

**File**: `src/tools/search-space.ts`

Include which spaces were searched:
```typescript
return JSON.stringify({
  success: true,
  spaces_searched: args.spaces,  // ✅ Show what was searched
  results: formattedResults,
  total: results.length
}, null, 2);
```

### 4. Add Backward Compatibility (Optional)

Support both `space` and `spaces` during migration:
```typescript
const spaces = args.spaces || (args.space ? [args.space] : ['the_void']);
```

### 5. Update Tests

**File**: `tests/unit/search-space.test.ts` (create if doesn't exist)

**Add tests**:
- Search single space
- Search multiple spaces
- Results from all spaces returned
- Invalid space validation
- Empty spaces array error
- Filter by spaces with containsAny

---

## Verification

- [ ] Tool accepts `spaces` array parameter
- [ ] Can search single space: `spaces: ["the_void"]`
- [ ] Can search multiple spaces: `spaces: ["the_void", "dogs"]`
- [ ] Uses `containsAny` filter for spaces array
- [ ] Results include memories from all requested spaces
- [ ] Invalid spaces rejected
- [ ] Tests passing
- [ ] TypeScript compiles without errors
- [ ] Build successful

---

## Files Modified

- `src/tools/search-space.ts` - Update for multi-space search

## Files Created

- `tests/unit/search-space.test.ts` - Add multi-space tests (if doesn't exist)

---

**Next Task**: Task 52 - Update remember_query_space for Multi-Space
