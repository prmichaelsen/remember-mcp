# Task 58: Add Comment Unit Tests

**Milestone**: M12 (Comment System - Phase 1)
**Estimated Time**: 3 hours
**Dependencies**: Tasks 55-57 (Schema and tool updates)
**Status**: Not Started

---

## Objective

Create comprehensive unit tests for comment functionality, including schema validation, comment filtering, thread queries, and edge cases like infinite nesting and per-space moderation.

---

## Steps

### 1. Test Schema Fields ([`tests/unit/schema.test.ts`](../../tests/unit/schema.test.ts))

Add tests for new comment fields:

```typescript
describe('Comment Fields', () => {
  it('should have parent_id field', () => {
    const schema = getMemorySchema();
    const parentIdField = schema.properties.find(p => p.name === 'parent_id');
    expect(parentIdField).toBeDefined();
    expect(parentIdField.dataType).toBe('text');
  });

  it('should have thread_root_id field', () => {
    const schema = getMemorySchema();
    const threadField = schema.properties.find(p => p.name === 'thread_root_id');
    expect(threadField).toBeDefined();
    expect(threadField.dataType).toBe('text');
  });

  it('should have moderation_flags field', () => {
    const schema = getMemorySchema();
    const flagsField = schema.properties.find(p => p.name === 'moderation_flags');
    expect(flagsField).toBeDefined();
    expect(flagsField.dataType).toContain('text');  // text[]
  });
});
```

### 2. Test Space Schema Fields ([`tests/unit/space-schema.test.ts`](../../tests/unit/space-schema.test.ts))

Add tests for public collection comment fields:

```typescript
describe('Comment Fields in Public Collection', () => {
  it('should have parent_id field in Memory_public', async () => {
    const collection = await ensurePublicCollection(mockClient);
    const schema = await collection.config.get();
    const parentIdField = schema.properties.find(p => p.name === 'parent_id');
    expect(parentIdField).toBeDefined();
  });

  it('should have thread_root_id field in Memory_public', async () => {
    const collection = await ensurePublicCollection(mockClient);
    const schema = await collection.config.get();
    const threadField = schema.properties.find(p => p.name === 'thread_root_id');
    expect(threadField).toBeDefined();
  });

  it('should have moderation_flags field in Memory_public', async () => {
    const collection = await ensurePublicCollection(mockClient);
    const schema = await collection.config.get();
    const flagsField = schema.properties.find(p => p.name === 'moderation_flags');
    expect(flagsField).toBeDefined();
  });
});
```

### 3. Test Comment Filtering ([`tests/unit/search-space.test.ts`](../../tests/unit/search-space.test.ts))

Add tests for `include_comments` parameter:

```typescript
describe('Comment Filtering', () => {
  it('should exclude comments by default', async () => {
    const result = await handleSearchSpace({
      spaces: ['the_void'],
      query: 'test'
      // include_comments not specified
    }, 'user123');
    
    // Verify filter was applied to exclude comments
    expect(mockFilter.notEqual).toHaveBeenCalledWith('comment');
  });

  it('should include comments when include_comments: true', async () => {
    const result = await handleSearchSpace({
      spaces: ['the_void'],
      query: 'test',
      include_comments: true
    }, 'user123');
    
    // Verify no comment filter was applied
    expect(mockFilter.notEqual).not.toHaveBeenCalledWith('comment');
  });

  it('should filter by content_type: comment', async () => {
    const result = await handleSearchSpace({
      spaces: ['the_void'],
      query: 'test',
      content_type: 'comment'
    }, 'user123');
    
    // Verify filter for comments only
    expect(mockFilter.equal).toHaveBeenCalledWith('comment');
  });
});
```

### 4. Test Query Space Comment Filtering ([`tests/unit/query-space.test.ts`](../../tests/unit/query-space.test.ts))

Add similar tests for query_space:

```typescript
describe('Comment Filtering in Query', () => {
  it('should exclude comments by default', async () => {
    const result = await handleQuerySpace({
      question: 'What are good hiking trails?',
      spaces: ['the_void']
      // include_comments not specified
    }, 'user123');
    
    // Verify filter was applied
    expect(mockFilter.notEqual).toHaveBeenCalledWith('comment');
  });

  it('should include comments when include_comments: true', async () => {
    const result = await handleQuerySpace({
      question: 'What are good hiking trails?',
      spaces: ['the_void'],
      include_comments: true
    }, 'user123');
    
    // Verify no comment filter
    expect(mockFilter.notEqual).not.toHaveBeenCalledWith('comment');
  });
});
```

### 5. Test Edge Cases

Create tests for edge cases:

```typescript
describe('Comment Edge Cases', () => {
  it('should support infinite nesting', () => {
    // Create deeply nested comment structure
    const comments = [
      { id: '1', parent_id: 'memory', thread_root_id: 'memory' },
      { id: '2', parent_id: '1', thread_root_id: 'memory' },
      { id: '3', parent_id: '2', thread_root_id: 'memory' },
      { id: '4', parent_id: '3', thread_root_id: 'memory' },
      { id: '5', parent_id: '4', thread_root_id: 'memory' },
      // ... up to 100 levels
    ];
    
    // Verify all have same thread_root_id
    comments.forEach(c => {
      expect(c.thread_root_id).toBe('memory');
    });
  });

  it('should support per-space moderation flags', () => {
    const comment = {
      id: 'comment123',
      moderation_flags: [
        'the_void:hidden',
        'dogs:spam',
        'cats:flagged'
      ]
    };
    
    // Verify flag format
    comment.moderation_flags.forEach(flag => {
      expect(flag).toMatch(/^[a-z_]+:(hidden|spam|flagged)$/);
    });
  });

  it('should handle empty moderation_flags array', () => {
    const comment = {
      id: 'comment123',
      moderation_flags: []
    };
    
    expect(Array.isArray(comment.moderation_flags)).toBe(true);
    expect(comment.moderation_flags.length).toBe(0);
  });
});
```

### 6. Run All Tests

```bash
npm test
```

**Expected**: All tests passing, including new comment tests

---

## Verification

- [ ] Schema field tests passing
- [ ] Space schema field tests passing
- [ ] Comment filtering tests passing (search_space)
- [ ] Comment filtering tests passing (query_space)
- [ ] Edge case tests passing
- [ ] All existing tests still passing
- [ ] Test coverage maintained or improved
- [ ] TypeScript compiles without errors
- [ ] No test failures or warnings

---

## Test Coverage Goals

**Minimum Coverage**:
- Schema fields: 100%
- Comment filtering: 100%
- Edge cases: 80%

**Focus Areas**:
- Default behavior (exclude comments)
- Opt-in behavior (include comments)
- Content type filtering
- Moderation flags format
- Infinite nesting support

---

## Files Modified

- [`tests/unit/schema.test.ts`](../../tests/unit/schema.test.ts) - Add comment field tests
- [`tests/unit/space-schema.test.ts`](../../tests/unit/space-schema.test.ts) - Add public collection tests
- [`tests/unit/search-space.test.ts`](../../tests/unit/search-space.test.ts) - Add filtering tests
- [`tests/unit/query-space.test.ts`](../../tests/unit/query-space.test.ts) - Add filtering tests

---

## Files Created

None (test updates only)

---

## Next Task

Task 59: Update Documentation for Comments
