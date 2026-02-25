# Soft Delete System

**Concept**: Implement soft delete with confirmation flow for memory deletion
**Created**: 2026-02-25
**Status**: Design Specification

---

## Overview

Implement a soft delete system that prevents accidental data loss by requiring confirmation before deletion and marking memories as deleted rather than permanently removing them. This enables recovery and maintains data integrity while providing a safer deletion workflow.

---

## Problem Statement

Current deletion implementation has critical issues:
- **No confirmation flow**: Memories are instantly deleted without user confirmation
- **No recovery**: Deleted memories cannot be recovered
- **No visibility**: Cannot search or view deleted memories
- **Data loss risk**: Accidental deletions result in permanent data loss

---

## Solution

Implement a comprehensive soft delete system with:

1. **Confirmation Flow**: Reuse existing token-based confirmation system
2. **Soft Delete Schema**: Add `deleted_at`, `deleted_by`, `deletion_reason` fields
3. **Default Filtering**: Exclude deleted memories from all searches by default
4. **Explicit Override**: `deleted_filter` parameter to include/only show deleted memories
5. **Relationship Handling**: Mark relationships as "orphaned" when memories deleted
6. **Breaking Change**: Immediate migration to new behavior (no feature flags)

---

## Implementation

### Schema Changes

Add three new fields to Memory schema (both `Memory_{user_id}` and `Memory_public`):

```typescript
{
  name: 'deleted_at',
  dataType: 'date' as any,
  description: 'Timestamp when memory was soft-deleted (null = not deleted)'
},
{
  name: 'deleted_by',
  dataType: 'text' as any,
  description: 'User ID who deleted the memory'
},
{
  name: 'deletion_reason',
  dataType: 'text' as any,
  description: 'Optional reason for deletion'
}
```

**Note**: `deleted_at` is nullable. `null` or missing = not deleted.

### Tool Modifications

#### `remember_delete_memory` (Modified)

**Old Behavior**: Immediately deletes memory from Weaviate

**New Behavior**: Creates confirmation token and returns it

```typescript
// Input
{
  memory_id: string;
  reason?: string;  // Optional deletion reason
}

// Output
{
  success: true;
  token: string;
  expires_at: string;
  preview: {
    memory_id: string;
    content: string;
    relationships_count: number;
    will_orphan: string[];  // IDs of relationships that will be orphaned
  }
}
```

#### `remember_confirm` (Enhanced)

Already handles confirmation. Will be enhanced to support `delete_memory` action:

```typescript
// When confirming deletion
{
  action: 'delete_memory',
  payload: {
    memory_id: string;
    reason?: string;
  }
}

// Execution:
// 1. Update memory: deleted_at = now(), deleted_by = user_id, deletion_reason = reason
// 2. Mark relationships as orphaned (implementation TBD)
// 3. Return success
```

#### `remember_deny` (No Changes)

Already handles denial of any pending action.

### Search Tool Modifications

All search tools get new `deleted_filter` parameter:

```typescript
deleted_filter?: 'exclude' | 'include' | 'only'
// Default: 'exclude'
```

**Affected Tools**:
- `remember_search_memory`
- `remember_query_memory`
- `remember_find_similar`
- `remember_search_relationship`

**Filter Implementation** (Weaviate query level):

```typescript
// deleted_filter: 'exclude' (default)
.where(Filters.or(
  collection.filter.byProperty('deleted_at').isNull(true),
  // ... other filters
))

// deleted_filter: 'include'
// No filter applied

// deleted_filter: 'only'
.where(
  collection.filter.byProperty('deleted_at').isNull(false)
)
```

### Relationship Handling

**When memory is soft-deleted**:
- Relationships remain in database
- Relationships are marked as "orphaned" (implementation TBD - may use a flag or computed property)
- Searching relationships excludes deleted memories by default

**Creating relationships**:
- Cannot create relationship with deleted memory
- Error: "Cannot create relationship: memory {id} is deleted"

**Updating deleted memories**:
- Error: "Cannot update deleted memory"
- User must restore first (future enhancement)

---

## Benefits

1. **Safety**: Confirmation flow prevents accidental deletions
2. **Recovery**: Soft delete enables future restoration feature
3. **Audit Trail**: Track who deleted what and when
4. **Flexibility**: `deleted_filter` parameter allows searching deleted memories when needed
5. **Data Integrity**: Relationships preserved (orphaned but not lost)

---

## Trade-offs

1. **Storage**: Deleted memories consume storage (acceptable trade-off)
2. **Complexity**: Additional filtering logic in all search tools
3. **Breaking Change**: Immediate behavior change (no backward compatibility)
4. **No Restoration**: Phase 1 doesn't include restoration tool (future enhancement)
5. **Shared Spaces**: Deleted published memories remain in spaces (future: `remember_retract`)

---

## Migration Strategy

### Existing Data

**Approach**: Treat missing `deleted_at` field as "not deleted"
- No migration script needed
- Existing memories implicitly have `deleted_at: null`
- Weaviate `isNull(true)` filter handles this correctly

### API Changes

**Breaking Change**: Immediate migration
- `remember_delete_memory` behavior changes immediately
- All search tools add `deleted_filter` parameter (default: 'exclude')
- No feature flags or gradual rollout
- Version bump: v2.8.0 → v3.0.0 (major version)

---

## Future Enhancements

### Phase 2: Recovery (Future)
- `remember_restore_memory` tool
- Confirmation flow for restoration
- Automatic relationship restoration

### Phase 3: Permanent Deletion (Not Planned)
- No permanent deletion feature
- Soft delete is sufficient
- Storage cost is acceptable

### Phase 4: Shared Space Integration (Future)
- `remember_retract` tool to unpublish memories
- Separate from deletion
- Requires confirmation

### Phase 5: Moderation (Future)
- Space moderators can hide memories
- Uses `moderation_flags` instead of `deleted_at`
- Separate from user deletion

---

## Security Considerations

### Access Control

**Deleted memories**:
- Only owner can search their deleted memories (`deleted_filter: 'include'` or `'only'`)
- Other users cannot see deleted memories (filtered out)
- Shared space memories remain visible until retracted (future enhancement)

**Confirmation tokens**:
- Reuse existing token service
- 5-minute expiry
- One-time use

---

## Testing Strategy

1. **Unit Tests**:
   - Schema field validation
   - Filter logic (exclude/include/only)
   - Confirmation flow
   - Relationship orphaning

2. **Integration Tests**:
   - End-to-end deletion workflow
   - Search with deleted_filter variations
   - Relationship creation with deleted memories (should fail)
   - Update deleted memory (should fail)

3. **Edge Cases**:
   - Delete already deleted memory
   - Confirm expired token
   - Search with invalid deleted_filter value

---

## Documentation Updates

1. **README.md**: Update deletion workflow examples
2. **CHANGELOG.md**: Document breaking change (v3.0.0)
3. **Tool Descriptions**: Update all affected tools
4. **Migration Guide**: Document behavior changes

---

## Open Questions

**From Clarification Document**:

1. **Agent Permission** (Item 3.2, Question 3):
   > "Should agents be able to search deleted memories without explicit user permission, or should this require a special flag?"
   > Response: "Clarification needed"

   **Recommendation**: Allow agents to search deleted memories if user explicitly requests it in natural language (e.g., "search my deleted memories"). The `deleted_filter` parameter provides the mechanism. No additional permission system needed.

---

**Status**: Design Specification Complete
**Recommendation**: Proceed with milestone and task creation
**Priority**: Highest (per user feedback)
**Estimated Effort**: 2-3 weeks
