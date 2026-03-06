# Task 174: Wire MemoryIndexService into Core Services

**Milestone**: Unassigned (breaking change from remember-core v0.33.0)
**Estimated Time**: 0.5-1 hour
**Dependencies**: remember-core v0.33.0+
**Status**: Not Started

---

## Objective

Update `src/core-services.ts` to pass the now-required `MemoryIndexService` to both `MemoryService` and `SpaceService` constructors. remember-core v0.33.0 made `MemoryIndexService` a required parameter (no longer optional) in both services.

---

## Context

remember-core task-117 made `MemoryIndexService` required in:
- `MemoryService` constructor: 4th param `options.memoryIndex` (was optional, now required)
- `SpaceService` constructor: new 6th positional param `memoryIndexService` (before the optional `options`)

Currently `src/core-services.ts` line 52 constructs `MemoryService` with 3 args (no memoryIndex) and line 54 constructs `SpaceService` with `{ moderationClient }` as the 6th arg (which is now the 7th position).

---

## Steps

### 1. Import MemoryIndexService

Add `MemoryIndexService` to the import from `@prmichaelsen/remember-core`.

### 2. Create singleton MemoryIndexService

Add alongside the other singletons (line ~31):

```typescript
const memoryIndexService = new MemoryIndexService(coreLogger);
```

### 3. Update MemoryService constructor call

Change line 52 from:
```typescript
memory: new MemoryService(collection, userId, coreLogger),
```
to:
```typescript
memory: new MemoryService(collection, userId, coreLogger, {
  memoryIndex: memoryIndexService,
  weaviateClient,
}),
```

### 4. Update SpaceService constructor call

Change line 54 from:
```typescript
space: new SpaceService(weaviateClient, collection, userId, tokenService, coreLogger, { moderationClient }),
```
to:
```typescript
space: new SpaceService(weaviateClient, collection, userId, tokenService, coreLogger, memoryIndexService, { moderationClient }),
```

### 5. Bump remember-core dependency

Update `package.json` to require `@prmichaelsen/remember-core` >= 0.33.0.

### 6. Build and verify

- `tsc --noEmit` passes
- All tests pass

---

## Verification

- [ ] `MemoryIndexService` imported and instantiated as singleton
- [ ] `MemoryService` receives `{ memoryIndex: memoryIndexService, weaviateClient }` in options
- [ ] `SpaceService` receives `memoryIndexService` as 6th positional arg
- [ ] `tsc --noEmit` passes
- [ ] All tests pass

---

## Files Modified

- `src/core-services.ts` — add import, singleton, update constructor calls
- `package.json` — bump remember-core dependency

---

## Notes

- Single file change (`core-services.ts`) — all service construction is centralized here
- `weaviateClient` is already available in `createCoreServices()`, so passing it to MemoryService options enables `resolveById()` cross-collection resolution
- This ensures all new memories created via MCP tools are indexed in the Firestore lookup table
