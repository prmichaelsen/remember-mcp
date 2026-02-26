# Task 167: Implement remember_retract Tool

**Milestone**: Milestone 14 - Memory Collection Pattern v2
**Estimated Time**: 4-6 hours
**Dependencies**: [Task 165: Core Infrastructure Setup](task-165-core-infrastructure-setup.md), [Task 166: Implement remember_publish Tool](task-166-update-remember-publish.md)
**Status**: Completed
**Completed**: 2026-02-26

---

## Objective

Implement the `remember_retract` tool to support selective retraction from specific spaces and groups, maintaining orphaned memories for historical reference.

---

## Steps

### 1. Create Tool Schema

**File**: `src/tools/remember-retract.ts`

**Actions**:
- Update input schema to accept `spaces` array (spaces to retract from)
- Update input schema to accept `groups` array (groups to retract from)
- Keep `memory_id` parameter (source memory ID)
- Add optional `user_id` parameter (defaults to current user)
- Update tool description to explain selective retraction

**Expected Schema**:
```typescript
{
  memory_id: string,
  spaces?: string[],  // ["cooking"] - retract from these spaces
  groups?: string[],  // ["{group-id}"] - retract from these groups
  user_id?: string    // Defaults to current user
}
```

### 2. Implement Selective Space Retraction

**Actions**:
- Load source memory from `Memory_users_{userId}/{memory_id}`
- Generate composite ID: `{userId}.{memory_id}`
- For each space in `spaces` array:
  - Load memory from `Memory_spaces_public` with composite ID
  - Remove space from `space_ids` array
  - If `space_ids` becomes empty AND `group_ids` is empty: Keep memory (orphaned)
  - If `space_ids` still has items OR `group_ids` has items: Update memory
- Update source memory's `space_ids` array (remove retracted spaces)
- Return success with retraction details

**Expected Behavior**:
```typescript
// Retract from specific space
remember_retract({
  memory_id: "my-recipe",
  spaces: ["cooking"]
})

// Updates:
// 1. Memory_spaces_public/user123.my-recipe: space_ids=["recipes"] (removed "cooking")
// 2. Memory_users_user123/my-recipe: space_ids=["recipes"]
// If space_ids becomes empty, memory remains (orphaned)
```

### 3. Implement Selective Group Retraction

**Actions**:
- Load source memory from `Memory_users_{userId}/{memory_id}`
- Generate composite ID: `{userId}.{memory_id}`
- For each group in `groups` array:
  - Load memory from `Memory_groups_{groupId}` with composite ID
  - Remove group from `group_ids` array
  - If `group_ids` becomes empty: Delete memory from this group collection
- Update source memory's `group_ids` array (remove retracted groups)
- Return success with retraction details

**Expected Behavior**:
```typescript
// Retract from specific group
remember_retract({
  memory_id: "my-recipe",
  groups: ["{foodie-group}"]
})

// Updates:
// 1. Deletes Memory_groups_{foodie-group}/user123.my-recipe
// 2. Memory_users_user123/my-recipe: group_ids=[] (removed group)
```

### 4. Implement Orphaned Memory Handling

**Actions**:
- When retracting from all spaces, keep memory in `Memory_spaces_public`
- Mark memory as orphaned (empty `space_ids` and `group_ids`)
- Add `retracted_at` timestamp
- Keep for historical reference (can still be found by composite ID)

**Expected Behavior**:
```typescript
// Retract from all spaces
remember_retract({
  memory_id: "my-recipe",
  spaces: ["cooking", "recipes"]  // All spaces
})

// Result:
// Memory_spaces_public/user123.my-recipe remains with:
// - space_ids: []
// - group_ids: []
// - retracted_at: timestamp
```

### 5. Add Error Handling

**Actions**:
- Validate source memory exists
- Validate spaces and groups arrays are not empty
- Validate memory is actually published to specified spaces/groups
- Handle Weaviate connection errors
- Return clear error messages

### 6. Write Integration Tests

**File**: `tests/integration/remember-retract.test.ts`

**Actions**:
- Test single space retraction
- Test multi-space retraction
- Test single group retraction
- Test multi-group retraction
- Test orphaned memory creation
- Test error cases (not published, invalid IDs, etc.)

**Expected Output**: All tests passing

---

## Verification

- [ ] Tool schema updated correctly
- [ ] Selective space retraction works
- [ ] Selective group retraction works
- [ ] Orphaned memories handled correctly
- [ ] Tracking arrays updated correctly
- [ ] Source memory updated correctly
- [ ] Error handling works correctly
- [ ] Integration tests passing
- [ ] TypeScript compiles without errors
- [ ] Tool description updated in MCP manifest

---

## Expected Output

### Files Modified
- `src/tools/remember-retract-v2.ts` (~200 lines)

### Files Created
- `tests/integration/remember-retract.test.ts` (~150 lines)

### Test Output
```
✓ Single space retraction (3 tests)
✓ Multi-space retraction (3 tests)
✓ Single group retraction (3 tests)
✓ Multi-group retraction (3 tests)
✓ Orphaned memory handling (4 tests)
✓ Error handling (4 tests)

Total: 20 tests passing
```

---

## Notes

- Orphaned memories remain for historical reference
- Group memories are deleted when retracted (not orphaned)
- Space memories are orphaned when all spaces retracted
- Clear distinction between space and group retraction behavior

---

**Next Task**: [Task 168: Implement remember_revise Tool](task-168-implement-remember-revise.md)
