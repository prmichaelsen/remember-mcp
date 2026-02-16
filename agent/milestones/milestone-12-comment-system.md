# Milestone 12: Comment System (Phase 1 - Basic Comments)

**Goal**: Enable threaded discussions in shared spaces using existing content type
**Duration**: 1 week
**Dependencies**: M11 (Unified Public Collection)
**Status**: Not Started

---

## Overview

Implement basic comment functionality for shared spaces using the existing `comment` content type. This milestone requires **zero new tools** - we'll extend the Weaviate schema with 3 new fields and add an `include_comments` parameter to existing search tools.

**Key Innovation**: Reuse `remember_create_memory` with `type: "comment"` instead of creating new tools. This keeps the API surface small while enabling rich threaded discussions.

---

## Deliverables

### 1. Schema Updates (3 new fields)
- Add `parent_id` field (text) - ID of parent memory or comment
- Add `thread_root_id` field (text) - Root memory ID for thread queries
- Add `moderation_flags` field (text[]) - Per-space moderation flags

### 2. Search Tool Updates (2 tools)
- Update `remember_search_space` - Add `include_comments` parameter (default: false)
- Update `remember_query_space` - Add `include_comments` parameter (default: false)

### 3. Documentation Updates
- Update design document with implementation details
- Add comment examples to README
- Document comment creation workflow
- Add API examples for threaded discussions

### 4. Testing
- Unit tests for comment filtering
- Unit tests for thread queries
- Integration tests for comment workflows
- Test infinite nesting support

---

## Success Criteria

- [ ] Schema has 3 new fields: `parent_id`, `thread_root_id`, `moderation_flags`
- [ ] Can create comments using `remember_create_memory` with `type: "comment"`
- [ ] Comments have `parent_id` and `thread_root_id` populated
- [ ] `remember_search_space` excludes comments by default
- [ ] `remember_search_space` includes comments when `include_comments: true`
- [ ] `remember_query_space` excludes comments by default
- [ ] `remember_query_space` includes comments when `include_comments: true`
- [ ] Can fetch entire thread by filtering on `thread_root_id`
- [ ] Comments support infinite nesting (no depth limit)
- [ ] Moderation flags are per-space (array field)
- [ ] All existing tests still passing
- [ ] New comment tests passing
- [ ] TypeScript compiles without errors
- [ ] Build successful
- [ ] Documentation updated with examples

---

## Key Files to Modify

```
src/
├── weaviate/
│   ├── schema.ts                    # Add 3 new fields to schema
│   └── space-schema.ts              # Add 3 new fields to public collection
└── tools/
    ├── search-space.ts              # Add include_comments parameter
    └── query-space.ts               # Add include_comments parameter

tests/
└── unit/
    ├── schema.test.ts               # Test new fields
    ├── space-schema.test.ts         # Test new fields in public collection
    ├── search-space.test.ts         # Test comment filtering
    └── query-space.test.ts          # Test comment filtering

agent/
└── design/
    └── comment-memory-type.md       # Update with implementation notes
```

---

## Implementation Tasks

See individual task documents:
- Task 55: Add Comment Fields to Weaviate Schema
- Task 56: Update remember_search_space for Comments
- Task 57: Update remember_query_space for Comments
- Task 58: Add Comment Unit Tests
- Task 59: Update Documentation for Comments

---

## Architecture Notes

### Zero New Tools Required

**Create comment** (use existing tool):
```typescript
remember_create_memory({
  type: "comment",              // ✅ Existing content type!
  content: "Great post!",
  parent_id: "memory123",       // ✅ New field
  thread_root_id: "memory123",  // ✅ New field
  spaces: ["the_void"]          // ✅ Inherited from parent
})
```

**Fetch thread** (use existing search):
```typescript
remember_search_space({
  spaces: ["the_void"],
  query: "",
  content_type: "comment",
  // Filter by thread_root_id in Weaviate
  limit: 100
})
```

**Search without comments** (default behavior):
```typescript
remember_search_space({
  spaces: ["the_void"],
  query: "hiking trails"
  // include_comments: false (default)
})
// Returns only memories, not comments
```

**Search with comments** (opt-in):
```typescript
remember_search_space({
  spaces: ["the_void"],
  query: "hiking trails",
  include_comments: true  // ✅ Include comments in results
})
// Returns memories + comments
```

### Schema Changes

**New Fields**:
```typescript
{
  name: 'parent_id',
  dataType: 'text' as any,
  description: 'ID of parent memory or comment (for threading)'
},
{
  name: 'thread_root_id',
  dataType: 'text' as any,
  description: 'Root memory ID for fetching entire thread'
},
{
  name: 'moderation_flags',
  dataType: 'text[]' as any,
  description: 'Per-space moderation flags (e.g., ["the_void:hidden", "dogs:spam"])'
}
```

### Moderation Flags (Per-Space)

**Format**: `"{space_id}:{flag_type}"`

**Examples**:
- `"the_void:hidden"` - Hidden in The Void space
- `"dogs:spam"` - Marked as spam in Dogs space
- `"cats:flagged"` - Flagged for review in Cats space

**Why per-space?**: A comment might be inappropriate in one space but fine in another. Moderators manage their own spaces independently.

### Infinite Nesting Support

**No depth limit**: Comments can nest infinitely
- `parent_id` points to immediate parent
- `thread_root_id` always points to root memory
- UI builds tree structure from flat list

**Example**:
```
Memory (root)
├─ Comment 1 (parent_id: memory_id)
│  ├─ Comment 2 (parent_id: comment1_id)
│  │  └─ Comment 3 (parent_id: comment2_id)
│  │     └─ Comment 4 (parent_id: comment3_id)
│  │        └─ ... (infinite nesting)
│  └─ Comment 5 (parent_id: comment1_id)
└─ Comment 6 (parent_id: memory_id)
```

All comments have `thread_root_id: memory_id` for efficient thread fetching.

---

## Testing Strategy

1. **Unit Tests**: Schema fields, filtering logic
2. **Integration Tests**: Full comment workflow
3. **Performance Tests**: Large threads (1000+ comments)
4. **Edge Cases**: Infinite nesting, moderation flags

---

## Future Phases

**Phase 2: Engagement (v2.7.0)** - Deferred
- Voting system (requires ACL)
- Sort by popularity
- Vote tracking in Firestore

**Phase 3: Moderation (v2.8.0)** - Deferred
- Moderator tools (requires ACL)
- Auto-hide spam
- Moderator dashboard

**Phase 4: Notifications (v2.9.0)** - Deferred
- Notify authors of comments
- Email/push notifications
- Notification preferences

---

## Breaking Changes

**None** - This is a backward-compatible addition:
- Existing tools continue to work unchanged
- New fields are optional
- Default behavior (exclude comments) maintains current UX
- Opt-in via `include_comments: true`

---

**Next Milestone**: M13 - Comment Engagement (Voting & Popularity)
**Blockers**: None (builds on M11)
