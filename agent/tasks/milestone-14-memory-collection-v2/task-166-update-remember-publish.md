# Task 166: Implement remember_publish Tool

**Milestone**: Milestone 14 - Memory Collection Pattern v2
**Estimated Time**: 6-8 hours
**Dependencies**: [Task 165: Core Infrastructure Setup](task-165-core-infrastructure-setup.md)
**Status**: Completed
**Completed**: 2026-02-26

---

## Objective

Implement the `remember_publish` tool to support multi-space and multi-group publication with composite IDs and tracking arrays.

---

## Steps

### 1. Create Tool Schema

**File**: `src/tools/remember-publish.ts`

**Actions**:
- Update input schema to accept `spaces` array (multiple spaces)
- Update input schema to accept `groups` array (multiple groups)
- Keep `memory_id` parameter (source memory ID)
- Add optional `user_id` parameter (defaults to current user)
- Update tool description to explain multi-publication

**Expected Schema**:
```typescript
{
  memory_id: string,
  spaces?: string[],  // ["cooking", "recipes"]
  groups?: string[],  // ["{group-id-1}", "{group-id-2}"]
  user_id?: string    // Defaults to current user
}
```

### 2. Implement Multi-Space Publication

**Actions**:
- Load source memory from `Memory_users_{userId}/{memory_id}`
- Generate composite ID: `{userId}.{memory_id}`
- For each space in `spaces` array:
  - Check if memory already exists in `Memory_spaces_public` with composite ID
  - If exists: Update `space_ids` array (add new space)
  - If not exists: Create new memory with composite ID and `space_ids` array
- Update source memory's `space_ids` array
- Return success with published locations

**Expected Behavior**:
```typescript
// Publish to multiple spaces
remember_publish({
  memory_id: "my-recipe",
  spaces: ["cooking", "recipes"]
})

// Creates/updates:
// 1. Memory_spaces_public/user123.my-recipe with space_ids=["cooking", "recipes"]
// 2. Memory_users_user123/my-recipe with space_ids=["cooking", "recipes"]
```

### 3. Implement Multi-Group Publication

**Actions**:
- Load source memory from `Memory_users_{userId}/{memory_id}`
- Generate composite ID: `{userId}.{memory_id}`
- For each group in `groups` array:
  - Check if memory already exists in `Memory_groups_{groupId}` with composite ID
  - If exists: Update `group_ids` array (add new group)
  - If not exists: Create new memory with composite ID and `group_ids` array
- Update source memory's `group_ids` array
- Return success with published locations

**Expected Behavior**:
```typescript
// Publish to multiple groups
remember_publish({
  memory_id: "my-recipe",
  groups: ["{foodie-group}", "{recipe-club}"]
})

// Creates/updates:
// 1. Memory_groups_{foodie-group}/user123.my-recipe
// 2. Memory_groups_{recipe-club}/user123.my-recipe
// 3. Memory_users_user123/my-recipe with group_ids=["{foodie-group}", "{recipe-club}"]
```

### 4. Implement Dual Publication

**Actions**:
- Support publishing to both spaces and groups simultaneously
- Ensure `space_ids` and `group_ids` arrays are synchronized across all copies
- Handle partial failures gracefully (rollback on error)

**Expected Behavior**:
```typescript
// Publish to both spaces and groups
remember_publish({
  memory_id: "my-recipe",
  spaces: ["cooking"],
  groups: ["{foodie-group}"]
})

// Creates/updates:
// 1. Memory_spaces_public/user123.my-recipe with space_ids=["cooking"], group_ids=["{foodie-group}"]
// 2. Memory_groups_{foodie-group}/user123.my-recipe with space_ids=["cooking"], group_ids=["{foodie-group}"]
// 3. Memory_users_user123/my-recipe with space_ids=["cooking"], group_ids=["{foodie-group}"]
```

### 5. Add Error Handling

**Actions**:
- Validate source memory exists
- Validate spaces and groups arrays are not empty
- Validate user has permission to publish to spaces/groups
- Handle Weaviate connection errors
- Rollback on partial failure (transaction-like behavior)
- Return clear error messages

### 6. Write Integration Tests

**File**: `tests/integration/remember-publish.test.ts`

**Actions**:
- Test single space publication
- Test multi-space publication
- Test single group publication
- Test multi-group publication
- Test dual publication (spaces + groups)
- Test updating existing published memory
- Test error cases (missing source, invalid IDs, etc.)
- Test rollback on partial failure

**Expected Output**: All tests passing

---

## Verification

- [ ] Tool schema updated correctly
- [ ] Multi-space publication works
- [ ] Multi-group publication works
- [ ] Dual publication works (spaces + groups)
- [ ] Composite IDs generated correctly
- [ ] Tracking arrays updated correctly
- [ ] Source memory updated with publication locations
- [ ] Error handling works correctly
- [ ] Rollback works on partial failure
- [ ] Integration tests passing
- [ ] TypeScript compiles without errors
- [ ] Tool description updated in MCP manifest

---

## Expected Output

### Files Modified
- `src/tools/remember-publish-v2.ts` (~250 lines)

### Files Created
- `tests/integration/remember-publish.test.ts` (~200 lines)

### Test Output
```
✓ Single space publication (3 tests)
✓ Multi-space publication (4 tests)
✓ Single group publication (3 tests)
✓ Multi-group publication (4 tests)
✓ Dual publication (5 tests)
✓ Error handling (6 tests)

Total: 25 tests passing
```

---

## Notes

- This is a breaking change from v1 (single space only)
- Consider maintaining v1 compatibility layer temporarily
- Composite IDs must be used for all published memories
- Tracking arrays must be synchronized across all copies
- Transaction-like behavior prevents partial failures
- Clear error messages help debugging

---

**Next Task**: [Task 167: Update remember_retract Tool](task-167-update-remember-retract.md)
