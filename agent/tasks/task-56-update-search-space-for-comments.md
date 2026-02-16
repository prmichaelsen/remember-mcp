# Task 56: Update remember_search_space for Comments

**Milestone**: M12 (Comment System - Phase 1)
**Estimated Time**: 2 hours
**Dependencies**: Task 55 (Add Comment Fields)
**Status**: Not Started

---

## Objective

Add `include_comments` parameter to `remember_search_space` tool to control whether comments are included in search results. Default behavior excludes comments to keep discovery clean.

---

## Steps

### 1. Update Tool Schema ([`src/tools/search-space.ts`](../../src/tools/search-space.ts))

Add new parameter to `inputSchema`:

```typescript
include_comments: {
  type: 'boolean',
  description: 'Include comments in search results (default: false)',
  default: false
}
```

**Location**: Add after existing parameters, before `required` array

### 2. Update TypeScript Interface

Add to `SearchSpaceArgs` interface:

```typescript
interface SearchSpaceArgs {
  // ... existing fields
  include_comments?: boolean;
}
```

### 3. Update Filter Logic

Modify the search logic to exclude comments by default:

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
description: 'Search shared spaces to discover thoughts, ideas, and memories. By default, excludes comments to keep discovery clean. Set include_comments: true to include threaded discussions.',
```

### 5. Test the Changes

Create test cases for comment filtering:

```typescript
// Test 1: Default behavior (exclude comments)
const results1 = await handleSearchSpace({
  spaces: ['the_void'],
  query: 'test'
  // include_comments not specified = false
}, userId);
// Should not include type: "comment"

// Test 2: Include comments
const results2 = await handleSearchSpace({
  spaces: ['the_void'],
  query: 'test',
  include_comments: true
}, userId);
// Should include type: "comment"
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

### Default Behavior (Exclude Comments)

**Why**: Keep discovery experience clean
- Users searching for "hiking trails" want memories, not 100 comments
- Comments are opt-in via `include_comments: true`
- Follows positive flag pattern (explicit opt-in)

**Example**:
```typescript
remember_search_space({
  spaces: ["the_void"],
  query: "hiking trails"
  // include_comments: false (default)
})
// Returns: 10 memories (no comments)
```

### Opt-In Comments

**When to use**: Viewing a specific thread or searching within discussions

**Example**:
```typescript
remember_search_space({
  spaces: ["the_void"],
  query: "hiking trails",
  include_comments: true  // ✅ Include comments
})
// Returns: 10 memories + 50 comments = 60 results
```

### Fetching Entire Thread

**Use case**: Get all comments for a specific memory

**Example**:
```typescript
remember_search_space({
  spaces: ["the_void"],
  query: "",  // Empty query = get all
  content_type: "comment",  // Only comments
  // Add filter for thread_root_id in Weaviate query
  limit: 100
})
// Returns: All comments in the thread
```

**Note**: This requires adding support for filtering by `thread_root_id` in the Weaviate query. Consider adding a `thread_id` parameter in a future enhancement.

### Filter Implementation

**Weaviate v3 API**:
```typescript
// Exclude comments (default)
publicCollection.filter.byProperty('type').notEqual('comment')

// Or use content_type filter if already implemented
if (args.content_type) {
  // Existing content type filter
} else if (!args.include_comments) {
  // Exclude comments
  filterList.push(
    publicCollection.filter.byProperty('type').notEqual('comment')
  );
}
```

---

## Files Modified

- [`src/tools/search-space.ts`](../../src/tools/search-space.ts) - Add `include_comments` parameter and filter logic

---

## Files Created

None (tool update only)

---

## Next Task

Task 57: Update remember_query_space for Comments
