# Task 83: Eliminate Redundant validateToken in Confirm Flow

**Milestone**: M18 - Performance Tuning
**Estimated Time**: 1 hour
**Dependencies**: None
**Status**: Not Started

---

## Objective

Remove the redundant `validateToken` call in the confirm tool's delete_memory path, where `confirmRequest` already retrieves the full token payload.

---

## Context

`src/tools/confirm.ts` calls `tokenService.validateToken()` to peek at the token action type, then immediately calls `tokenService.confirmRequest()` which reads the token again. For the delete_memory path, this is two sequential storage reads when one would suffice.

---

## Steps

### 1. Analyze confirm.ts flow

Read `src/tools/confirm.ts` to understand all action type branches and whether `confirmRequest` returns sufficient data to eliminate the validate step.

### 2. Refactor to single call

If `confirmRequest` returns the full request payload on success, use it directly:
```typescript
const confirmed = await tokenService.confirmRequest(userId, args.token);
if (!confirmed) { return error; }
// Use confirmed.action to determine path
```

### 3. Verify all confirm-related tests pass

---

## Verification

- [ ] Only one storage read per confirm call
- [ ] All action types still handled correctly
- [ ] All confirm/deny tests pass
- [ ] TypeScript compiles without errors

---

## Expected Output

**Files Modified**:
- `src/tools/confirm.ts`
