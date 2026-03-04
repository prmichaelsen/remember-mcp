# Task 84: Convert Dynamic Imports to Static in server-factory

**Milestone**: M18 - Performance Tuning
**Estimated Time**: 0.5 hours
**Dependencies**: None
**Status**: Not Started

---

## Objective

Replace dynamic `import()` calls for ghost-config and access-control modules in `server-factory.ts` with static top-level imports to eliminate async module resolution overhead on the hot path.

---

## Context

`src/server-factory.ts` lines 177-179 use `await import(...)` for `ghost-config.service.js` and `access-control.js` even though both modules are statically available. Dynamic imports add unnecessary microtask overhead on every server-factory instantiation with ghost mode.

---

## Steps

### 1. Move imports to top level

**File**: `src/server-factory.ts`

Add static imports at the top:
```typescript
import { getGhostConfig } from './services/ghost-config.service.js';
import { resolveAccessorTrustLevel } from './services/access-control.js';
```

Remove the dynamic imports inside the `if (options.ghostMode)` block.

### 2. Verify tests pass

---

## Verification

- [ ] No dynamic imports for ghost-config or access-control
- [ ] Ghost mode still works correctly
- [ ] All server-factory tests pass
- [ ] TypeScript compiles without errors

---

## Expected Output

**Files Modified**:
- `src/server-factory.ts`
