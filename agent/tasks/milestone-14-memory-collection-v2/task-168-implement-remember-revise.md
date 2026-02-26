# Task 168: Implement remember_revise Tool

**Milestone**: Milestone 14 - Memory Collection Pattern v2
**Estimated Time**: 6-8 hours
**Dependencies**: [Task 165: Core Infrastructure Setup](task-165-core-infrastructure-setup.md), [Task 166: Update remember_publish Tool](task-166-update-remember-publish.md)
**Status**: Completed
**Completed**: 2026-02-26

---

## Objective

Implement the new `remember_revise` tool to synchronize content updates across all published copies of a memory (spaces and groups), maintaining revision history.

---

## Steps

### 1. Create Tool Schema

**File**: `src/tools/remember-revise.ts`

**Actions**:
- Create input schema with `memory_id` parameter
- Add optional `user_id` parameter (defaults to current user)
- Add tool description explaining revision synchronization
- Register tool in MCP manifest

**Expected Schema**:
```typescript
{
  memory_id: string,
  user_id?: string    // Defaults to current user
}
```

### 2. Implement Content Synchronization

**Actions**:
- Load source memory from `Memory_users_{userId}/{memory_id}`
- Get current content from source memory
- Generate composite ID: `{userId}.{memory_id}`
- Find all published locations from source memory's tracking arrays:
  - `space_ids` → `Memory_spaces_public`
  - `group_ids` → `Memory_groups_{groupId}`
- For each published location:
  - Load published memory
  - Save current content to `revision_history` array
  - Update content with source content
  - Set `revised_at` timestamp
- Return success with revision details

**Expected Behavior**:
```typescript
// User updates source
remember_update_memory({ id: "my-recipe", content: "Updated recipe" })

// Revise all published versions
remember_revise({ memory_id: "my-recipe" })

// Updates:
// 1. Memory_spaces_public/user123.my-recipe: content updated, old added to revision_history
// 2. Memory_groups_{foodie-group}/user123.my-recipe: content updated, old added to revision_history
// 3. Both get revised_at timestamp
```

### 3. Implement Revision History Management

**Actions**:
- Add old content to `revision_history` array before updating
- Include timestamp with each revision
- Limit revision history to last 10 versions (configurable)
- Compress old revisions if needed

**Expected Structure**:
```typescript
{
  revision_history: [
    { content: "Old content 1", revised_at: "2026-02-25T10:00:00Z" },
    { content: "Old content 2", revised_at: "2026-02-26T14:30:00Z" }
  ]
}
```

### 4. Handle Partial Failures

**Actions**:
- Track which locations were successfully revised
- Track which locations failed
- Rollback on critical failures
- Return detailed status for each location

**Expected Behavior**:
```typescript
// Partial failure scenario
remember_revise({ memory_id: "my-recipe" })

// Returns:
{
  success: true,
  revised: [
    { location: "Memory_spaces_public", status: "success" },
    { location: "Memory_groups_{foodie-group}", status: "success" },
    { location: "Memory_groups_{recipe-club}", status: "failed", error: "Connection timeout" }
  ],
  warnings: ["Failed to revise 1 of 3 locations"]
}
```

### 5. Add Error Handling

**Actions**:
- Validate source memory exists
- Validate memory is published (has space_ids or group_ids)
- Handle Weaviate connection errors
- Handle missing published memories (orphaned references)
- Return clear error messages

### 6. Write Integration Tests

**File**: `tests/integration/remember-revise.test.ts`

**Actions**:
- Test revision to single space
- Test revision to multiple spaces
- Test revision to single group
- Test revision to multiple groups
- Test revision to spaces + groups
- Test revision history management
- Test partial failure handling
- Test error cases (not published, missing source, etc.)

**Expected Output**: All tests passing

---

## Verification

- [ ] Tool schema created correctly
- [ ] Content synchronization works
- [ ] Revision history managed correctly
- [ ] All published copies updated
- [ ] Timestamps set correctly
- [ ] Partial failures handled gracefully
- [ ] Error handling works correctly
- [ ] Integration tests passing
- [ ] TypeScript compiles without errors
- [ ] Tool registered in MCP manifest

---

## Expected Output

### Files Created
- `src/tools/remember-revise.ts` (~250 lines)
- `tests/integration/remember-revise.test.ts` (~180 lines)

### Test Output
```
✓ Single space revision (3 tests)
✓ Multi-space revision (3 tests)
✓ Single group revision (3 tests)
✓ Multi-group revision (3 tests)
✓ Dual revision (spaces + groups) (4 tests)
✓ Revision history management (5 tests)
✓ Partial failure handling (3 tests)
✓ Error handling (4 tests)

Total: 28 tests passing
```

---

## Notes

- This is a new tool (not in v1)
- Critical for maintaining consistency across published copies
- Revision history enables rollback if needed
- Partial failures should not prevent successful revisions
- Consider adding `remember_get_revision_history` tool in future

---

**Next Task**: [Task 169: Update remember_search_space Tool](task-169-update-remember-search-space.md)
