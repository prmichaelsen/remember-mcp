# Task 42: Create Tests for Shared Spaces

**Milestone**: M10 - Shared Spaces & Confirmation Flow
**Estimated Time**: 4 hours
**Dependencies**: Tasks 34-40 (All implementation tasks)
**Status**: Not Started

---

## Objective

Create comprehensive test suite for shared spaces functionality, including unit tests, integration tests, and end-to-end workflow tests.

---

## Steps

### 1. Review Existing Tests

Understand current test patterns.

**Actions**:
- Review existing unit tests in `tests/unit/`
- Review test utilities and mocks
- Understand Jest configuration
- Note testing patterns used

**Expected Outcome**: Test patterns understood

### 2. Create Integration Test File

Create end-to-end test for publish workflow.

**Actions**:
- Create `tests/integration/publish-workflow.test.ts`
- Test complete flow: publish → confirm → verify
- Test complete flow: publish → deny → verify
- Use actual Weaviate and Firestore (or emulators)
- Clean up test data after each test

**Expected Outcome**: Integration tests created

### 3. Test Token Service

Comprehensive tests for confirmation tokens.

**Actions**:
- Verify `tests/unit/confirmation-token.service.test.ts` exists
- Test token creation
- Test token validation
- Test token expiry
- Test confirm/deny/retract flows
- Test cleanup function
- Mock Firestore calls

**Expected Outcome**: Token service fully tested

### 4. Test Space Schema

Test space collection management.

**Actions**:
- Verify `tests/unit/space-schema.test.ts` exists
- Test `ensureSpaceCollection()`
- Test collection name generation
- Test space ID sanitization
- Test display name mapping
- Mock Weaviate client

**Expected Outcome**: Space schema fully tested

### 5. Test All Tools

Verify all 5 new tools have tests.

**Actions**:
- Verify `tests/unit/publish.test.ts` exists
- Verify `tests/unit/confirm.test.ts` exists
- Verify `tests/unit/deny.test.ts` exists
- Verify `tests/unit/search-space.test.ts` exists
- Verify `tests/unit/query-space.test.ts` exists
- Ensure comprehensive coverage
- Test success and error cases

**Expected Outcome**: All tools fully tested

### 6. Test Multi-User Scenarios

Test discovery across users.

**Actions**:
- User A publishes memory
- User B searches space and finds it
- User B queries space about it
- Verify attribution (author_id)
- Verify original memory unchanged

**Expected Outcome**: Multi-user discovery working

### 7. Test Security

Verify security constraints.

**Actions**:
- Test user can only publish own memories
- Test tokens are one-time use
- Test tokens expire correctly
- Test permission denied errors
- Test token replay attacks fail

**Expected Outcome**: Security verified

### 8. Run All Tests

Execute complete test suite.

**Actions**:
- Run `npm test` (unit tests)
- Run `npm run test:e2e` (integration tests)
- Verify all tests passing
- Check test coverage
- Fix any failing tests

**Expected Outcome**: All tests passing

### 9. Update Test Documentation

Document test coverage and patterns.

**Actions**:
- Update README with test instructions
- Document test data setup
- Document emulator usage (if applicable)
- Note coverage goals

**Expected Outcome**: Test documentation complete

---

## Verification

- [ ] Integration test file created
- [ ] Token service tests complete
- [ ] Space schema tests complete
- [ ] All 5 tool tests complete
- [ ] Multi-user scenarios tested
- [ ] Security tests complete
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Test coverage adequate (>70%)
- [ ] Test documentation updated

---

## Test Structure

```
tests/
├── unit/
│   ├── confirmation-token.service.test.ts
│   ├── space-schema.test.ts
│   ├── publish.test.ts
│   ├── confirm.test.ts
│   ├── deny.test.ts
│   ├── search-space.test.ts
│   └── query-space.test.ts
└── integration/
    └── publish-workflow.test.ts
```

---

## Example Integration Test

```typescript
describe('Publish Workflow', () => {
  it('should publish memory to space with confirmation', async () => {
    // 1. Create test memory
    const memory = await createTestMemory(userId);
    
    // 2. Request publish
    const publishResult = await handlePublish({
      memory_id: memory.id,
      target: 'the_void'
    }, userId);
    
    const { token } = JSON.parse(publishResult);
    expect(token).toBeDefined();
    
    // 3. Confirm publish
    const confirmResult = await handleConfirm({ token }, userId);
    const { space_memory_id } = JSON.parse(confirmResult).payload;
    
    // 4. Verify in space
    const spaceMemory = await getSpaceMemory('the_void', space_memory_id);
    expect(spaceMemory).toBeDefined();
    expect(spaceMemory.author_id).toBe(userId);
    
    // 5. Verify original unchanged
    const originalMemory = await getUserMemory(userId, memory.id);
    expect(originalMemory).toBeDefined();
  });
});
```

---

## Related Files

- Design: [`agent/design/publish-tools-confirmation-flow.md`](../design/publish-tools-confirmation-flow.md)
- Jest Config: [`jest.config.js`](../../jest.config.js)
- E2E Config: [`jest.e2e.config.js`](../../jest.e2e.config.js)

---

**Next Task**: Task 43 - Update Documentation
