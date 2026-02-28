# Task 193: Foundation Setup

**Milestone**: M17 — remember-core Migration
**Status**: not_started
**Dependencies**: None
**Estimated Hours**: 2-3

---

## Objective

Install remember-core, create the service initialization bridge module, and wire core services into both server entry points without changing any tool behavior.

## Deliverables

### 1. Install `@prmichaelsen/remember-core`

Add to `package.json`:
```json
"@prmichaelsen/remember-core": "^0.12.0"
```

### 2. Create `src/core-services.ts`

Service initialization bridge that creates core services scoped to a userId:

```typescript
import { MemoryService, RelationshipService, SpaceService,
  PreferencesDatabaseService, ConfirmationTokenService, createLogger
} from '@prmichaelsen/remember-core';

export function createCoreServices(userId: string) { ... }
```

Key requirements:
- Use remember-mcp's existing `getWeaviateClient()` and `getMemoryCollection(userId)`
- Call `ensureMemoryCollection(userId)` before constructing services
- Create `ConfirmationTokenService` and `PreferencesDatabaseService` as singletons (shared across users)
- Do NOT call core's `initFirestore()` — use remember-mcp's existing init

### 3. Wire into `src/server-factory.ts`

- Create core services in `createServer()` after `ensureDatabasesInitialized()`
- Pass services to `registerHandlers()` as new parameter
- No tool handler changes yet — services are created but unused

### 4. Wire into `src/server.ts`

- Create core services per-request or use lazy cache by userId
- Pass services to tool handlers (unused initially)

## Acceptance Criteria

- [ ] `npm install` succeeds with remember-core dependency
- [ ] `npm run build` passes with no TypeScript errors
- [ ] `npm test` — all 454 tests still pass (no behavior changes)
- [ ] `createCoreServices(userId)` returns all 5 service instances
- [ ] Both server.ts and server-factory.ts create and pass services
