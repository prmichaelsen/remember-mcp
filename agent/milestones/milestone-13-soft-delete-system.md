# Milestone 13: Soft Delete System

**Goal**: Implement safe deletion with confirmation flow and recovery capabilities
**Duration**: 2-3 weeks
**Dependencies**: M10 (Shared Spaces - for confirmation token service)
**Status**: Not Started
**Priority**: Highest

---

## Overview

Implement a comprehensive soft delete system that prevents accidental data loss by requiring confirmation before deletion and marking memories as deleted rather than permanently removing them. This enables future recovery features and maintains data integrity while providing a safer deletion workflow.

**Key Innovation**: Reuse existing confirmation token service from `remember_publish` for a consistent user experience across all destructive operations.

---

## Deliverables

### 1. Schema Updates (3 new fields)
- Add `deleted_at` field (date, nullable) - Timestamp of deletion
- Add `deleted_by` field (text) - User ID who deleted the memory
- Add `deletion_reason` field (text) - Optional reason for deletion

### 2. Confirmation Flow
- Modify `remember_delete_memory` to create confirmation token
- Enhance `remember_confirm` to handle `delete_memory` action
- Include deletion preview (content, relationship count, orphaned relationships)

### 3. Search Tool Updates (4 tools)
- Add `deleted_filter` parameter to `remember_search_memory`
- Add `deleted_filter` parameter to `remember_query_memory`
- Add `deleted_filter` parameter to `remember_find_similar`
- Add `deleted_filter` parameter to `remember_search_relationship`

### 4. Relationship Handling
- Mark relationships as "orphaned" when memory deleted
- Prevent creating relationships with deleted memories
- Exclude deleted memories from relationship searches by default

### 5. Error Handling
- Return error when updating deleted memory
- Return error when creating relationship with deleted memory
- Clear error messages with actionable guidance

### 6. Documentation Updates
- Update README with new deletion workflow
- Document breaking changes in CHANGELOG (v3.0.0)
- Update tool descriptions
- Add migration guide

### 7. Testing
- Unit tests for schema fields
- Unit tests for confirmation flow
- Unit tests for deleted_filter parameter
- Unit tests for relationship orphaning
- Integration tests for full deletion workflow

---

## Success Criteria

- [ ] Schema has 3 new fields: `deleted_at`, `deleted_by`, `deletion_reason`
- [ ] `remember_delete_memory` creates confirmation token (not immediate delete)
- [ ] `remember_confirm` handles `delete_memory` action
- [ ] Deletion preview shows content and relationship impact
- [ ] All 4 search tools have `deleted_filter` parameter
- [ ] Default behavior excludes deleted memories from all searches
- [ ] `deleted_filter: "include"` shows all memories (deleted + active)
- [ ] `deleted_filter: "only"` shows only deleted memories
- [ ] Relationships marked as orphaned when memory deleted
- [ ] Cannot create relationship with deleted memory (returns error)
- [ ] Cannot update deleted memory (returns error)
- [ ] All existing tests still passing
- [ ] New soft delete tests passing
- [ ] TypeScript compiles without errors
- [ ] Build successful
- [ ] Documentation updated with examples
- [ ] CHANGELOG documents breaking changes
- [ ] Version bumped to v3.0.0 (major version)

---

## Key Files to Create/Modify

```
src/
├── weaviate/
│   ├── schema.ts                    # Add 3 new fields to Memory schema
│   └── space-schema.ts              # Add 3 new fields to Memory_public
├── tools/
│   ├── delete-memory.ts             # Modify to create confirmation token
│   ├── confirm.ts                   # Enhance to handle delete_memory action
│   ├── search-memory.ts             # Add deleted_filter parameter
│   ├── query-memory.ts              # Add deleted_filter parameter
│   ├── find-similar.ts              # Add deleted_filter parameter
│   ├── search-relationship.ts       # Add deleted_filter parameter
│   ├── create-relationship.ts       # Prevent relationships with deleted memories
│   └── update-memory.ts             # Prevent updating deleted memories
├── utils/
│   └── weaviate-filters.ts          # Add deleted_filter helper functions
└── types/
    └── memory.ts                    # Add DeletedFilter type

tests/
└── unit/
    ├── schema.test.ts               # Test new fields
    ├── space-schema.test.ts         # Test new fields in public collection
    ├── delete-memory.test.ts        # Test confirmation flow
    ├── confirm.test.ts              # Test delete_memory action
    ├── search-memory.test.ts        # Test deleted_filter
    ├── query-memory.test.ts         # Test deleted_filter
    ├── find-similar.test.ts         # Test deleted_filter
    └── search-relationship.test.ts  # Test deleted_filter

agent/
└── design/
    └── soft-delete-system.md        # ✅ Already created
```

---

## Implementation Tasks

See individual task documents:
- Task 70: Add Soft Delete Schema Fields
- Task 71: Implement Delete Confirmation Flow
- Task 72: Add deleted_filter to Search Tools
- Task 73: Update Relationship Handling for Deleted Memories
- Task 74: Add Unit Tests for Soft Delete
- Task 75: Update Documentation and CHANGELOG

---

## Architecture Notes

### Soft Delete vs Hard Delete

**Soft Delete** (Implemented):
- Memory remains in Weaviate
- `deleted_at` field set to current timestamp
- Filtered out by default
- Can be searched with `deleted_filter: "include"` or `"only"`
- Enables future restoration feature

**Hard Delete** (Not Implemented):
- Memory permanently removed from Weaviate
- Cannot be recovered
- Not planned for this milestone

### Confirmation Token Reuse

**Existing Service**: `ConfirmationTokenService` (from M10)
- Already handles token generation, validation, expiry
- Stores tokens in Firestore: `users/{user_id}/requests/{request_id}`
- 5-minute expiry
- One-time use

**New Action**: `delete_memory`
```typescript
{
  action: 'delete_memory',
  payload: {
    memory_id: string;
    reason?: string;
  }
}
```

### Filter Implementation

**Weaviate Query Level**:
```typescript
// deleted_filter: 'exclude' (default)
collection.query.hybrid(query)
  .where(Filters.or(
    collection.filter.byProperty('deleted_at').isNull(true),
    // ... other filters
  ))

// deleted_filter: 'include'
// No deleted_at filter applied

// deleted_filter: 'only'
collection.query.hybrid(query)
  .where(
    collection.filter.byProperty('deleted_at').isNull(false)
  )
```

### Relationship Orphaning

**Implementation Options**:
1. **Computed Property** (Recommended): Check if any memory in relationship is deleted
2. **Flag Field**: Add `is_orphaned` boolean to relationship
3. **Status Field**: Add `status: "active" | "orphaned"` to relationship

**Recommendation**: Use computed property (Option 1) - no schema changes needed, always accurate.

### Breaking Changes

**Version**: v2.8.0 → v3.0.0 (major version bump)

**Changes**:
1. `remember_delete_memory` behavior changes (immediate → confirmation)
2. All search tools add `deleted_filter` parameter
3. Default search behavior excludes deleted memories

**Migration Path**:
- No code changes required for users
- Behavior change is immediate
- Existing memories implicitly have `deleted_at: null`

---

## Testing Strategy

1. **Unit Tests**: Schema fields, filter logic, confirmation flow
2. **Integration Tests**: End-to-end deletion workflow
3. **Edge Cases**: Delete deleted memory, expired tokens, invalid filters
4. **Performance Tests**: Search with large numbers of deleted memories

---

## Future Phases

**Phase 2: Recovery** (Future - Not in M13):
- `remember_restore_memory` tool
- Confirmation flow for restoration
- Automatic relationship restoration
- Restore to original state

**Phase 3: Shared Space Integration** (Future):
- `remember_retract` tool to unpublish memories
- Separate from deletion
- Requires confirmation
- Removes from shared spaces

**Phase 4: Moderation** (Future):
- Space moderators can hide memories
- Uses `moderation_flags` instead of `deleted_at`
- Separate from user deletion
- Per-space moderation

---

## Breaking Changes

**API Changes**:
- `remember_delete_memory` now returns confirmation token (not immediate delete)
- All search tools add `deleted_filter` parameter (default: 'exclude')
- Default search behavior changes (excludes deleted memories)

**Data Changes**:
- None (existing memories implicitly have `deleted_at: null`)

**Behavior Changes**:
- Deletion requires confirmation (two-step process)
- Deleted memories remain in database (soft delete)
- Cannot update or create relationships with deleted memories

---

## Security Considerations

**Access Control**:
- Only owner can delete their memories
- Only owner can search their deleted memories
- Confirmation tokens are user-specific
- Deleted memories not visible to other users

**Data Retention**:
- Deleted memories remain in database indefinitely
- No automatic purge policy
- Storage cost is acceptable trade-off for safety

---

## Documentation Requirements

1. **README.md**: 
   - Update deletion workflow section
   - Add examples of `deleted_filter` usage
   - Document confirmation flow

2. **CHANGELOG.md**:
   - Document breaking changes (v3.0.0)
   - List all modified tools
   - Provide migration guidance

3. **Tool Descriptions**:
   - Update `remember_delete_memory` description
   - Add `deleted_filter` parameter to 4 search tools
   - Update error messages

4. **Migration Guide**:
   - Explain behavior changes
   - Provide code examples
   - Document version bump rationale

---

**Next Milestone**: M5 - Template System (deferred until M13 complete)
**Blockers**: None (builds on M10 confirmation token service)
**Priority**: Highest (per user feedback)
