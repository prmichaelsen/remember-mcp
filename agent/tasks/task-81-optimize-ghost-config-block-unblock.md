# Task 81: Optimize ghost-config block/unblock with FieldValue

**Milestone**: M18 - Performance Tuning
**Estimated Time**: 1 hour
**Dependencies**: None
**Status**: Not Started

---

## Objective

Replace read-modify-write pattern in `blockUser` and `unblockUser` with Firestore `FieldValue.arrayUnion` / `FieldValue.arrayRemove` to eliminate the read RPC.

---

## Context

`src/services/ghost-config.service.ts` `blockUser()` and `unblockUser()` each:
1. Read the entire GhostConfig document from Firestore
2. Modify the `blocked_users` array in memory
3. Write the document back

Firestore's `FieldValue.arrayUnion/arrayRemove` can atomically add/remove array elements without reading first, halving the RPC count for these operations.

---

## Steps

### 1. Update blockUser

**File**: `src/services/ghost-config.service.ts`

Replace read-modify-write with:
```typescript
await setDocument(collectionPath, docId, {
  blocked_users: FieldValue.arrayUnion(targetUserId),
}, { merge: true });
```

### 2. Update unblockUser

```typescript
await setDocument(collectionPath, docId, {
  blocked_users: FieldValue.arrayRemove(targetUserId),
}, { merge: true });
```

### 3. Verify ghost-config tests pass

---

## Verification

- [ ] blockUser works without reading first
- [ ] unblockUser works without reading first
- [ ] All ghost-config tests pass
- [ ] TypeScript compiles without errors

---

## Expected Output

**Files Modified**:
- `src/services/ghost-config.service.ts`
