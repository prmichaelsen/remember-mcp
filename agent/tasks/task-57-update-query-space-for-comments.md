# Task 57: Update remember_query_space for Comments

**Milestone**: M12 (Comment System - Phase 1)
**Estimated Time**: 1 hour
**Dependencies**: Task 56 (Update search_space)
**Status**: Not Started

---

## Objective

Add `include_comments` parameter to `remember_query_space` tool to control whether comments are included in RAG query results. Default behavior excludes comments to keep answers focused on original content.

---

## Steps

### 1. Update Tool Schema ([`src/tools/query-space.ts`](../../src/tools/query-space.ts))

Add new parameter to `inputSchema`:

```typescript
include_comments: {
  type: 'boolean',
  description: 'Include comments in query results (default: false)',
  default: false
}
```

**Location**: Add after existing parameters, before `required` array

### 2. Update TypeScript Interface

Add to `QuerySpaceArgs` interface:

```typescript
interface QuerySpaceArgs {
  // ... existing fields
  include_comments?: boolean;
}
```

### 3. Update Filter Logic

Modify the query logic to exclude comments by default (same as search_space):

```typescript
// After building other filters, add content type filter
if (!args.include_comments) {
  // Exclude comments by default
  filterList.push(
    publicCollection.filter.byProperty('type').notEqual('comment')
  );
}
```

**Location**: Add before executing the query, after other filters are built

### 4. Update Tool Description

Update the tool description to mention comment filtering:

```typescript
description: 'Ask natural language questions about memories in shared spaces. By default, excludes comments to focus on original content. Set include_comments: true to include discussions in answers.',
```

### 5. Test the Changes

Reuse test pattern from search_space:

```typescript
// Test 1: Default behavior (exclude comments)
const results1 = await handleQuerySpace({
  question: 'What are good hiking trails?',
  spaces: ['the_void']
  // include_comments not specified = false
}, userId);
// Should not include type: "comment" in results

// Test 2: Include comments
const results2 = await handleQuerySpace({
  question: 'What are good hiking trails?',
  spaces: ['the_void'],
  include_comments: true
}, userId);
// Should include type: "comment" in results
```

---

## Verification

- [ ] `include_comments` parameter added to schema
- [ ] Parameter has correct type (boolean)
- [ ] Parameter has correct default (false)
- [ ] Parameter has clear description
- [ ] TypeScript interface updated
- [ ] Filter logic excludes comments by default
- [ ] Filter logic includes comments when `include_comments: true`
- [ ] Tool description updated
- [ ] TypeScript compiles without errors
- [ ] All existing tests passing
- [ ] New comment filtering tests passing

---

## Implementation Notes

### Why Exclude Comments by Default?

**RAG queries focus on original content**:
- Question: "What are good hiking trails?"
- Want: Original memories about trails
- Don't want: 100 comments saying "I agree!" or "Thanks!"

**Comments add noise to RAG answers**:
- Comments are often short, low-information
- Original memories have richer content
- Better to query memories, then show comments separately

### When to Include Comments?

**Use case**: Searching within discussions

**Example**:
```typescript
remember_query_space({
  question: "What did people say about Bear Lake Trail?",
  spaces: ["the_void"],
  include_comments: true  // ✅ Include discussions
})
// Returns: Memory + all comments mentioning Bear Lake
```

### Implementation Pattern

**Same as search_space**:
- Both tools use identical filtering logic
- Consistent user experience
- Reuse filter implementation

```typescript
// Shared filter logic (consider extracting to utility)
if (!args.include_comments) {
  filterList.push(
    publicCollection.filter.byProperty('type').notEqual('comment')
  );
}
```

---

## Files Modified

- [`src/tools/query-space.ts`](../../src/tools/query-space.ts) - Add `include_comments` parameter and filter logic

---

## Files Created

None (tool update only)

---

## Next Task

Task 58: Add Comment Unit Tests
