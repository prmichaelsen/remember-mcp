# Task 170: Implement remember_create_memory and remember_update_memory Tools

**Milestone**: Milestone 14 - Memory Collection Pattern v2
**Estimated Time**: 3-4 hours
**Dependencies**: [Task 165: Core Infrastructure Setup](task-165-core-infrastructure-setup.md)
**Status**: Completed 2026-02-27

---

## Objective

Implement `remember_create_memory` and `remember_update_memory` tools to initialize and maintain tracking arrays (space_ids, group_ids) in user memories.

---

## Steps

### 1. Implement remember_create_memory Tool

**File**: `src/tools/remember-create-memory.ts`

**Actions**:
- Add `space_ids: []` to new memory objects (empty array)
- Add `group_ids: []` to new memory objects (empty array)
- Ensure memories created in `Memory_users_{userId}` collection
- Keep all existing functionality

**Expected Behavior**:
```typescript
// Create new memory
remember_create_memory({
  content: "My recipe",
  content_type: "note"
})

// Creates in Memory_users_{userId}:
{
  id: "auto-generated-id",
  content: "My recipe",
  content_type: "note",
  space_ids: [],      // ← New field
  group_ids: [],      // ← New field
  created_at: timestamp,
  updated_at: timestamp
}
```

### 2. Implement remember_update_memory Tool

**File**: `src/tools/remember-update-memory.ts`

**Actions**:
- Preserve `space_ids` and `group_ids` arrays during updates
- Don't allow direct modification of tracking arrays (use publish/retract instead)
- Update `updated_at` timestamp
- Keep all existing functionality

**Expected Behavior**:
```typescript
// Update memory content
remember_update_memory({
  id: "my-recipe",
  content: "Updated recipe"
})

// Updates in Memory_users_{userId}:
{
  id: "my-recipe",
  content: "Updated recipe",  // ← Updated
  space_ids: ["cooking"],     // ← Preserved
  group_ids: [],              // ← Preserved
  updated_at: timestamp       // ← Updated
}
```

### 3. Add Validation

**Actions**:
- Validate `space_ids` and `group_ids` are arrays
- Prevent direct modification of tracking arrays
- Ensure arrays are initialized on create
- Handle migration of old memories without tracking arrays

### 4. Write Unit Tests

**File**: `tests/unit/remember-create-update.test.ts`

**Actions**:
- Test memory creation with tracking arrays
- Test memory update preserves tracking arrays
- Test validation of tracking arrays
- Test error cases

**Expected Output**: All tests passing

---

## Verification

- [ ] remember_create_memory initializes tracking arrays
- [ ] remember_update_memory preserves tracking arrays
- [ ] Tracking arrays cannot be directly modified
- [ ] Validation works correctly
- [ ] Unit tests passing
- [ ] TypeScript compiles without errors
- [ ] Tool descriptions updated

---

## Expected Output

### Files Modified
- `src/tools/remember-create-memory-v2.ts` (~150 lines)
- `src/tools/remember-update-memory-v2.ts` (~150 lines)

### Files Created
- `tests/unit/remember-create-update.test.ts` (~100 lines)

### Test Output
```
✓ Memory creation (5 tests)
✓ Memory update (5 tests)
✓ Tracking array validation (4 tests)
✓ Error handling (3 tests)

Total: 17 tests passing
```

---

## Notes

- Minimal changes to existing tools
- Tracking arrays managed by publish/retract/revise tools
- Backward compatibility for old memories without tracking arrays

---

**Next Task**: [Task 171: Implement Migration Script](task-171-implement-migration-script.md)
