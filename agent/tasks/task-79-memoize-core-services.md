# Task 79: Memoize createCoreServices per userId

**Milestone**: M18 - Performance Tuning
**Estimated Time**: 1 hour
**Dependencies**: None
**Status**: Not Started

---

## Objective

Cache `CoreServices` instances per `userId` so that repeated tool calls don't instantiate new `MemoryService`, `RelationshipService`, and `SpaceService` objects on every invocation.

---

## Context

`src/core-services.ts` `createCoreServices(userId)` is called by every tool handler. Each call creates 3 new service instances and calls `getMemoryCollection(userId)` (which calls `client.collections.get()`). In factory mode, the server is scoped to one userId, making all these allocations pure overhead after the first call.

---

## Steps

### 1. Add Map cache

**File**: `src/core-services.ts`

```typescript
const coreServicesCache = new Map<string, CoreServices>();

export function createCoreServices(userId: string): CoreServices {
  const cached = coreServicesCache.get(userId);
  if (cached) return cached;

  const collection = getMemoryCollection(userId);
  const weaviateClient = getWeaviateClient();

  const services: CoreServices = {
    memory: new MemoryService(collection, userId, coreLogger),
    relationship: new RelationshipService(collection, userId, coreLogger),
    space: new SpaceService(weaviateClient, collection, userId, tokenService, coreLogger),
    preferences: preferencesService,
    token: tokenService,
  };

  coreServicesCache.set(userId, services);
  return services;
}
```

### 2. Export invalidation for tests

```typescript
export function invalidateCoreServicesCache(): void {
  coreServicesCache.clear();
}
```

### 3. Verify all tests pass

---

## Verification

- [ ] Second call for same userId returns cached instance
- [ ] Different userIds get different instances
- [ ] All existing tests pass
- [ ] TypeScript compiles without errors

---

## Expected Output

**Files Modified**:
- `src/core-services.ts`
