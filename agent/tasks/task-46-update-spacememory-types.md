# Task 46: Update SpaceMemory Types for Multi-Space

**Milestone**: M11 - Unified Public Collection
**Estimated Time**: 1 hour
**Dependencies**: None
**Status**: Not Started

---

## Objective

Update the `SpaceMemory` interface to use `spaces: string[]` instead of `space_id: string`, enabling memories to belong to multiple spaces simultaneously.

---

## Steps

### 1. Update SpaceMemory Interface

**File**: `src/types/space-memory.ts`

**Changes**:
```typescript
// Before
export interface SpaceMemory extends Omit<Memory, 'user_id' | 'doc_type'> {
  space_id: string;  // ❌ Single space
  author_id: string;
  // ...
}

// After
export interface SpaceMemory extends Omit<Memory, 'user_id' | 'doc_type'> {
  spaces: string[];  // ✅ Multiple spaces!
  author_id: string;
  // ...
}
```

### 2. Update Type Exports

**File**: `src/types/space-memory.ts`

- Update `SpaceSearchOptions` if needed
- Update `SpaceSearchResult` if needed
- Keep `SpaceId` type and `SUPPORTED_SPACES` constant

### 3. Add Backward Compatibility (Optional)

Consider adding a migration helper:
```typescript
export function migrateSpaceMemory(old: any): SpaceMemory {
  if (old.space_id && !old.spaces) {
    return {
      ...old,
      spaces: [old.space_id],
    };
  }
  return old;
}
```

### 4. Update Type Tests

**File**: Create `src/types/space-memory.spec.ts` if needed

Test that:
- SpaceMemory interface has `spaces` array
- Type checking works correctly
- Migration helper works (if implemented)

---

## Verification

- [ ] `SpaceMemory` interface uses `spaces: string[]`
- [ ] No `space_id` field in interface
- [ ] Type exports updated
- [ ] TypeScript compiles without errors
- [ ] No breaking changes to existing code (yet)
- [ ] Documentation comments updated

---

## Files Modified

- `src/types/space-memory.ts` - Update interface

## Files Created

- `src/types/space-memory.spec.ts` - Type tests (optional)

---

**Next Task**: Task 47 - Update Space Schema with Spaces Array
