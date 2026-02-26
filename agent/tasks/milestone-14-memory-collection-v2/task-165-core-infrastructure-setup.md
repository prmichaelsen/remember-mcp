# Task 165: Core Infrastructure Setup

**Milestone**: Milestone 14 - Memory Collection Pattern v2
**Estimated Time**: 8-10 hours
**Dependencies**: None
**Status**: Not Started

---

## Objective

Set up the core infrastructure for Memory Collection Pattern v2, including dot notation collection utilities, composite ID generation, and tracking array management. This provides the foundation for all subsequent tool updates.

---

## Steps

### 1. Create Dot Notation Collection Utilities

**File**: `src/collections/dot-notation.ts`

**Actions**:
- Create `CollectionType` enum: `USERS`, `SPACES`, `GROUPS`
- Implement `getCollectionName(type, id?)` function
  - `USERS` → `Memory_users_{userId}`
  - `SPACES` → `Memory_spaces_public`
  - `GROUPS` → `Memory_groups_{groupId}`
- Implement `parseCollectionName(name)` function (reverse mapping)
- Implement `validateCollectionName(name)` function
- Add TypeScript types for collection metadata

**Expected Output**:
```typescript
// Example usage
getCollectionName('USERS', 'user123') // → 'Memory_users_user123'
getCollectionName('SPACES') // → 'Memory_spaces_public'
getCollectionName('GROUPS', 'group456') // → 'Memory_groups_group456'
```

### 2. Create Composite ID Utilities

**File**: `src/collections/composite-ids.ts`

**Actions**:
- Implement `generateCompositeId(userId, memoryId)` function
  - Format: `{userId}.{memoryId}`
  - Validation: No dots in userId or memoryId
- Implement `parseCompositeId(compositeId)` function
  - Returns: `{ userId, memoryId }`
- Implement `isCompositeId(id)` function (boolean check)
- Implement `validateCompositeId(id)` function (throws on invalid)
- Add TypeScript types for composite ID components

**Expected Output**:
```typescript
// Example usage
generateCompositeId('user123', 'my-recipe') // → 'user123.my-recipe'
parseCompositeId('user123.my-recipe') // → { userId: 'user123', memoryId: 'my-recipe' }
isCompositeId('user123.my-recipe') // → true
isCompositeId('simple-id') // → false
```

### 3. Create Tracking Array Management

**File**: `src/collections/tracking-arrays.ts`

**Actions**:
- Implement `addToSpaceIds(memory, spaceId)` function
- Implement `removeFromSpaceIds(memory, spaceId)` function
- Implement `addToGroupIds(memory, groupId)` function
- Implement `removeFromGroupIds(memory, groupId)` function
- Implement `isPublishedToSpace(memory, spaceId)` function
- Implement `isPublishedToGroup(memory, groupId)` function
- Implement `getPublishedLocations(memory)` function
- Add TypeScript types for tracking metadata

**Expected Output**:
```typescript
// Example usage
const memory = { space_ids: ['cooking'], group_ids: [] }
addToSpaceIds(memory, 'recipes') // → { space_ids: ['cooking', 'recipes'], ... }
isPublishedToSpace(memory, 'cooking') // → true
getPublishedLocations(memory) // → { spaces: ['cooking', 'recipes'], groups: [] }
```

### 4. Create Weaviate Schema Definitions

**File**: `src/schema/v2-collections.ts`

**Actions**:
- Define schema for `Memory_users_{userId}` collections
  - Properties: id, content, content_type, space_ids, group_ids, created_at, updated_at, etc.
- Define schema for `Memory_spaces_public` collection
  - Properties: id (composite), content, content_type, space_ids, group_ids, published_at, revised_at, revision_history, etc.
- Define schema for `Memory_groups_{groupId}` collections
  - Properties: id (composite), content, content_type, space_ids, group_ids, published_at, revised_at, revision_history, etc.
- Add vector indexing configuration
- Add property indexing configuration
- Export schema creation functions

**Expected Output**:
```typescript
// Example usage
const userSchema = createUserCollectionSchema('user123')
const spaceSchema = createSpaceCollectionSchema()
const groupSchema = createGroupCollectionSchema('group456')
```

### 5. Write Unit Tests

**File**: `tests/unit/core-infrastructure.test.ts`

**Actions**:
- Test dot notation utilities (all functions)
- Test composite ID utilities (all functions)
- Test tracking array utilities (all functions)
- Test schema definitions (valid structure)
- Test edge cases (empty arrays, invalid IDs, etc.)
- Achieve >95% code coverage

**Expected Output**: All tests passing

---

## Verification

- [ ] Dot notation utilities work correctly for all collection types
- [ ] Composite IDs generated and parsed correctly
- [ ] Tracking arrays add/remove items correctly
- [ ] Weaviate schemas valid and complete
- [ ] Unit tests passing (>95% coverage)
- [ ] TypeScript compiles without errors
- [ ] No linting errors
- [ ] Documentation comments added to all public functions

---

## Expected Output

### Files Created
- `src/collections/dot-notation.ts` (~150 lines)
- `src/collections/composite-ids.ts` (~100 lines)
- `src/collections/tracking-arrays.ts` (~120 lines)
- `src/schema/v2-collections.ts` (~200 lines)
- `tests/unit/core-infrastructure.test.ts` (~300 lines)

### Test Output
```
✓ Dot notation utilities (15 tests)
✓ Composite ID utilities (12 tests)
✓ Tracking array utilities (18 tests)
✓ Schema definitions (8 tests)

Total: 53 tests passing
Coverage: 97%
```

---

## Notes

- This task provides the foundation for all subsequent tasks
- Focus on correctness and test coverage
- Composite IDs must be validated to prevent dots in components
- Tracking arrays should be immutable (return new objects)
- Schema definitions should match Weaviate v3 requirements
- Consider adding JSDoc comments for better IDE support

---

**Next Task**: [Task 166: Update remember_publish Tool](task-166-update-remember-publish.md)
