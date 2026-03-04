# Task 78: Add TTL Cache to checkIfFriend

**Milestone**: M18 - Performance Tuning
**Estimated Time**: 1 hour
**Dependencies**: Task 77
**Status**: Not Started

---

## Objective

Cache friend status lookups with a short TTL so repeated ghost mode access checks for the same user pair don't hit Firestore on every memory.

---

## Context

`checkIfFriend` is called from `resolveAccessorTrustLevel` → `checkMemoryAccess`, which runs per-memory in prompt/hybrid enforcement modes. Friend status rarely changes during a session. A 60-second TTL cache eliminates redundant Firestore reads.

---

## Steps

### 1. Add TTL Map cache

**File**: `src/services/access-control.ts`

```typescript
const friendCache = new Map<string, { result: boolean; expiresAt: number }>();
const FRIEND_CACHE_TTL_MS = 60_000; // 60 seconds
```

### 2. Check cache before querying

In `checkIfFriend`, check both directions (key `a:b` and `b:a` are the same friendship):
```typescript
const key = [ownerUserId, accessorUserId].sort().join(':');
const cached = friendCache.get(key);
if (cached && Date.now() < cached.expiresAt) return cached.result;
```

### 3. Store result in cache after query

```typescript
friendCache.set(key, { result, expiresAt: Date.now() + FRIEND_CACHE_TTL_MS });
```

### 4. Export cache invalidation for tests

```typescript
export function invalidateFriendCache(): void {
  friendCache.clear();
}
```

### 5. Add tests

- Cache hit returns without Firestore call
- Cache expires after TTL
- `invalidateFriendCache()` clears cache

---

## Verification

- [ ] Repeated calls for same user pair don't hit Firestore
- [ ] Cache expires after 60 seconds
- [ ] invalidateFriendCache works
- [ ] All existing tests pass
- [ ] New cache tests pass

---

## Expected Output

**Files Modified**:
- `src/services/access-control.ts`
- `src/services/access-control.spec.ts`
