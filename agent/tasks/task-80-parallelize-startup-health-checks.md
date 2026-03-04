# Task 80: Parallelize Startup Health Checks

**Milestone**: M18 - Performance Tuning
**Estimated Time**: 0.5 hours
**Dependencies**: None
**Status**: Not Started

---

## Objective

Run `testWeaviateConnection()` and `testFirestoreConnection()` in parallel during server startup to reduce init latency.

---

## Context

`src/server.ts` lines 61-63 run these two independent health checks sequentially. Each is a network round-trip (50-200ms). Running them in parallel saves the latency of the slower one.

---

## Steps

### 1. Update server.ts

**File**: `src/server.ts`

Replace:
```typescript
const weaviateOk = await testWeaviateConnection();
const firestoreOk = await testFirestoreConnection();
```

With:
```typescript
const [weaviateOk, firestoreOk] = await Promise.all([
  testWeaviateConnection(),
  testFirestoreConnection(),
]);
```

### 2. Verify startup works

---

## Verification

- [ ] Server starts successfully
- [ ] Both connection tests still run
- [ ] TypeScript compiles without errors

---

## Expected Output

**Files Modified**:
- `src/server.ts`
