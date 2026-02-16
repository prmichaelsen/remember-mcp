# Task 52: Update remember_query_space for Multi-Space

**Milestone**: M11 - Unified Public Collection
**Estimated Time**: 2 hours
**Dependencies**: Task 51
**Status**: Not Started

---

## Objective

Update the `remember_query_space` tool to accept a `spaces` array parameter, enabling RAG queries across multiple spaces simultaneously.

---

## Steps

### 1. Update Tool Input Schema

**File**: `src/tools/query-space.ts`

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
  description: 'Spaces to query (e.g., ["the_void", "dogs"])',
  minItems: 1,
  default: ['the_void']
}
```

### 2. Update handleQuerySpace Function

**File**: `src/tools/query-space.ts`

**Key Changes**:
```typescript
interface QuerySpaceArgs {
  question: string;
  spaces: string[];  // ✅ Changed from space: string
  content_type?: string;
  tags?: string[];
  // ... other filters
}

export async function handleQuerySpace(
  args: QuerySpaceArgs,
  userId: string
): Promise<string> {
  // Validate all spaces
  const invalidSpaces = args.spaces.filter(s => !isValidSpaceId(s));
  if (invalidSpaces.length > 0) {
    return JSON.stringify({
      success: false,
      error: 'Invalid space IDs'
    }, null, 2);
  }
  
  // Use unified public collection
  const publicCollection = await ensurePublicCollection(weaviateClient);
  
  // Build filter for spaces array
  const spacesFilter = publicCollection.filter
    .byProperty('spaces')
    .containsAny(args.spaces);  // ✅ Query multiple spaces!
  
  // ... rest of RAG query logic
}
```

### 3. Update Response Format

**File**: `src/tools/query-space.ts`

Include which spaces were queried:
```typescript
return JSON.stringify({
  success: true,
  spaces_queried: args.spaces,  // ✅ Show what was queried
  question: args.question,
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

**File**: `tests/unit/query-space.test.ts` (create if doesn't exist)

**Add tests**:
- Query single space
- Query multiple spaces
- Results from all spaces returned
- Invalid space validation
- RAG query works across spaces

---

## Verification

- [ ] Tool accepts `spaces` array parameter
- [ ] Can query single space: `spaces: ["the_void"]`
- [ ] Can query multiple spaces: `spaces: ["the_void", "dogs"]`
- [ ] Uses `containsAny` filter for spaces array
- [ ] RAG results include memories from all requested spaces
- [ ] Invalid spaces rejected
- [ ] Tests passing
- [ ] TypeScript compiles without errors
- [ ] Build successful

---

## Files Modified

- `src/tools/query-space.ts` - Update for multi-space query

## Files Created

- `tests/unit/query-space.test.ts` - Add multi-space tests (if doesn't exist)

---

**Next Task**: Task 53 - Add Multi-Space Unit Tests
