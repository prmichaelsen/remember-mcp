# Task 55: Add Comment Fields to Weaviate Schema

**Milestone**: M12 (Comment System - Phase 1)
**Estimated Time**: 2 hours
**Dependencies**: M11 (Unified Public Collection)
**Status**: Not Started

---

## Objective

Add 3 new fields to the Weaviate schema to support threaded comments: `parent_id`, `thread_root_id`, and `moderation_flags`. These fields enable infinite nesting, efficient thread queries, and per-space moderation.

---

## Steps

### 1. Update Memory Schema ([`src/weaviate/schema.ts`](../../src/weaviate/schema.ts))

Add 3 new properties to the Memory collection schema:

```typescript
{
  name: 'parent_id',
  dataType: 'text' as any,
  description: 'ID of parent memory or comment (for threading)',
},
{
  name: 'thread_root_id',
  dataType: 'text' as any,
  description: 'Root memory ID for fetching entire thread',
},
{
  name: 'moderation_flags',
  dataType: 'text[]' as any,
  description: 'Per-space moderation flags (format: "{space_id}:{flag_type}")',
}
```

**Location**: Add after existing properties, before the closing bracket

### 2. Update Space Schema ([`src/weaviate/space-schema.ts`](../../src/weaviate/space-schema.ts))

Add the same 3 properties to the public collection schema:

```typescript
{
  name: 'parent_id',
  dataType: 'text' as any,
  description: 'ID of parent memory or comment (for threading)',
},
{
  name: 'thread_root_id',
  dataType: 'text' as any,
  description: 'Root memory ID for fetching entire thread',
},
{
  name: 'moderation_flags',
  dataType: 'text[]' as any,
  description: 'Per-space moderation flags (format: "{space_id}:{flag_type}")',
}
```

**Location**: Add to `createSpaceCollection` function's properties array

### 3. Verify Schema Updates

**Check**:
- Both schemas have all 3 new fields
- Field names match exactly
- Data types are correct (`text` for IDs, `text[]` for flags)
- Descriptions are clear and consistent

### 4. Test Schema Creation

Run existing tests to ensure schema creation still works:

```bash
npm test -- schema.test.ts
npm test -- space-schema.test.ts
```

**Expected**: All existing tests pass, no errors

---

## Verification

- [ ] `parent_id` field added to both schemas
- [ ] `thread_root_id` field added to both schemas
- [ ] `moderation_flags` field added to both schemas
- [ ] Field data types are correct
- [ ] Descriptions are clear
- [ ] TypeScript compiles without errors
- [ ] All existing schema tests passing
- [ ] No breaking changes to existing functionality

---

## Implementation Notes

### Field Purposes

**`parent_id`**:
- Points to immediate parent (memory or comment)
- Enables infinite nesting
- Used by UI to build tree structure
- Optional (null for root memories)

**`thread_root_id`**:
- Always points to root memory
- Enables efficient "get all comments in thread" queries
- Same as `parent_id` for direct replies to memories
- Optional (null for root memories)

**`moderation_flags`**:
- Array of strings in format `"{space_id}:{flag_type}"`
- Enables per-space moderation
- Examples: `["the_void:hidden", "dogs:spam"]`
- Empty array by default

### Example Comment

```typescript
{
  id: "comment123",
  type: "comment",
  content: "Great post!",
  parent_id: "memory456",        // ✅ New field
  thread_root_id: "memory456",   // ✅ New field
  moderation_flags: [],          // ✅ New field
  spaces: ["the_void"],
  author_id: "user789",
  // ... other standard fields
}
```

### Example Nested Comment

```typescript
{
  id: "comment789",
  type: "comment",
  content: "I agree!",
  parent_id: "comment123",       // ✅ Points to parent comment
  thread_root_id: "memory456",   // ✅ Still points to root memory
  moderation_flags: [],
  spaces: ["the_void"],
  author_id: "user999",
  // ... other standard fields
}
```

---

## Files Modified

- [`src/weaviate/schema.ts`](../../src/weaviate/schema.ts) - Add 3 fields to Memory schema
- [`src/weaviate/space-schema.ts`](../../src/weaviate/space-schema.ts) - Add 3 fields to public collection

---

## Files Created

None (schema updates only)

---

## Next Task

Task 56: Update remember_search_space for Comments
