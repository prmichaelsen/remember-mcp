# Task 53: Add Multi-Space Unit Tests

**Milestone**: M11 - Unified Public Collection
**Estimated Time**: 3 hours
**Dependencies**: Task 52
**Status**: Not Started

---

## Objective

Create comprehensive unit tests for the multi-space architecture, covering all scenarios including single-space, multi-space, edge cases, and error conditions.

---

## Steps

### 1. Test Space Schema

**File**: `src/weaviate/space-schema.spec.ts`

**Add tests**:
```typescript
describe('Unified Public Collection', () => {
  it('should create Memory_public collection', async () => {
    // Test ensurePublicCollection()
  });
  
  it('should have spaces array field in schema', () => {
    // Verify schema includes spaces: text[]
  });
  
  it('should support backward compatibility', () => {
    // Test old getSpaceCollectionName() still works
  });
});
```

### 2. Test remember_publish

**File**: `tests/unit/publish.test.ts`

**Add tests**:
```typescript
describe('remember_publish multi-space', () => {
  it('should accept single space', async () => {
    const result = await handlePublish({
      memory_id: 'mem123',
      spaces: ['the_void']
    }, 'user123');
    // Verify token generated
  });
  
  it('should accept multiple spaces', async () => {
    const result = await handlePublish({
      memory_id: 'mem123',
      spaces: ['the_void', 'dogs', 'cats']
    }, 'user123');
    // Verify token generated with spaces array
  });
  
  it('should reject invalid spaces', async () => {
    const result = await handlePublish({
      memory_id: 'mem123',
      spaces: ['invalid_space']
    }, 'user123');
    // Verify error returned
  });
  
  it('should reject empty spaces array', async () => {
    const result = await handlePublish({
      memory_id: 'mem123',
      spaces: []
    }, 'user123');
    // Verify error returned
  });
});
```

### 3. Test remember_confirm

**File**: `tests/unit/confirm.test.ts`

**Add tests**:
```typescript
describe('remember_confirm multi-space', () => {
  it('should publish to single space', async () => {
    // Mock token with spaces: ['the_void']
    // Verify memory inserted into Memory_public
    // Verify spaces field is ['the_void']
  });
  
  it('should publish to multiple spaces', async () => {
    // Mock token with spaces: ['the_void', 'dogs']
    // Verify memory inserted once
    // Verify spaces field is ['the_void', 'dogs']
  });
  
  it('should include all spaces in response', async () => {
    // Verify response includes spaces array
  });
});
```

### 4. Test remember_search_space

**File**: `tests/unit/search-space.test.ts`

**Add tests**:
```typescript
describe('remember_search_space multi-space', () => {
  it('should search single space', async () => {
    // Search spaces: ['the_void']
    // Verify containsAny filter used
  });
  
  it('should search multiple spaces', async () => {
    // Search spaces: ['the_void', 'dogs']
    // Verify results from both spaces
  });
  
  it('should find memories published to multiple spaces', async () => {
    // Memory with spaces: ['the_void', 'dogs']
    // Search spaces: ['the_void']
    // Verify memory found
  });
  
  it('should not find memories from other spaces', async () => {
    // Memory with spaces: ['cats']
    // Search spaces: ['dogs']
    // Verify memory not found
  });
});
```

### 5. Test remember_query_space

**File**: `tests/unit/query-space.test.ts`

**Add tests**:
```typescript
describe('remember_query_space multi-space', () => {
  it('should query single space', async () => {
    // Query spaces: ['the_void']
  });
  
  it('should query multiple spaces', async () => {
    // Query spaces: ['the_void', 'dogs']
    // Verify RAG results from both spaces
  });
});
```

### 6. Test Edge Cases

**Add tests for**:
- Duplicate spaces in array: `['the_void', 'the_void']`
- Case sensitivity: `['The_Void']` vs `['the_void']`
- Special characters in space names
- Very long spaces array (100+ spaces)
- Spaces array with null/undefined values

---

## Verification

- [ ] All space schema tests passing
- [ ] All publish tests passing (single + multi-space)
- [ ] All confirm tests passing (single + multi-space)
- [ ] All search tests passing (single + multi-space)
- [ ] All query tests passing (single + multi-space)
- [ ] Edge cases covered
- [ ] Test coverage increased
- [ ] All tests passing
- [ ] TypeScript compiles without errors
- [ ] Build successful

---

## Files Modified

- `src/weaviate/space-schema.spec.ts` - Add unified collection tests

## Files Created

- `tests/unit/publish.test.ts` - Multi-space publish tests (if doesn't exist)
- `tests/unit/confirm.test.ts` - Multi-space confirm tests (if doesn't exist)
- `tests/unit/search-space.test.ts` - Multi-space search tests (if doesn't exist)
- `tests/unit/query-space.test.ts` - Multi-space query tests (if doesn't exist)

---

**Next Task**: Task 54 - Update Documentation for Multi-Space
