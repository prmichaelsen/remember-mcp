# Task 77: Parallelize checkIfFriend Firestore Queries

**Milestone**: M18 - Performance Tuning
**Estimated Time**: 0.5 hours
**Dependencies**: None
**Status**: Not Started

---

## Objective

Run the two directional friendship queries in `checkIfFriend` concurrently with `Promise.all` instead of sequentially, cutting worst-case latency from ~400ms to ~200ms.

---

## Context

`src/services/access-control.ts` `checkIfFriend()` queries Firestore twice sequentially (owner→accessor, then accessor→owner). These are independent queries that can run in parallel.

---

## Steps

### 1. Refactor checkIfFriend to use Promise.all

**File**: `src/services/access-control.ts`

Replace the sequential pattern:
```typescript
const results = await queryDocuments(...forward...);
if (results.length > 0) return true;
const reverseResults = await queryDocuments(...reverse...);
return reverseResults.length > 0;
```

With parallel:
```typescript
const [forward, reverse] = await Promise.all([
  queryDocuments(...forward...),
  queryDocuments(...reverse...),
]);
return forward.length > 0 || reverse.length > 0;
```

### 2. Verify tests pass

Run `npx jest --testPathPattern=access-control`.

---

## Verification

- [ ] Both queries run in parallel via Promise.all
- [ ] All access-control tests pass
- [ ] TypeScript compiles without errors

---

## Expected Output

**Files Modified**:
- `src/services/access-control.ts`
