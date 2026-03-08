# Task 213: Update Server Factory — Replace ghostMode with InternalContext

**Milestone**: M20 — Unified Internal Memory Tools
**Status**: Not Started
**Estimated Hours**: 3-5
**Dependencies**: task-212

---

## Objective

Rewire the server factory and auth context to replace the ad-hoc `ghostMode` pattern with the more stable and extensible `InternalContext` pattern. Ghost identity, type, and source information move into `InternalContext`. Trust and cross-user access context are folded into `InternalContext` as well, eliminating the separate `ghostMode` field.

## Context

Currently `ghostMode` on `AuthContext` bundles ghost identity (`owner_user_id`, `accessor_user_id`) with resolved trust context (`accessor_trust_level`). This was fine for user-only ghosts, but doesn't extend to space/group ghosts and creates a parallel path alongside the new `InternalContext`. Rather than maintaining both, we should absorb `ghostMode` into `InternalContext` and drop the old field.

### Current ghostMode usage (7 files):

| File | Usage |
|------|-------|
| `server-factory.ts` | Creates `ghostMode` from `extras.ghost_owner`, resolves trust level |
| `types/auth.ts` | Defines `GhostModeContext` and `AuthContext.ghostMode` |
| `search-memory.ts` | `ghostMode.owner_user_id` for cross-user search, `ghostMode.accessor_trust_level` for trust filter |
| `query-memory.ts` | Same as search-memory |
| `search-by.ts` | Same pattern, passes ghost context to core services |
| `create-ghost-memory.ts` | `ghostMode.accessor_user_id` for tagging (will be deleted in task-217) |
| Tests | Mock ghostMode in test fixtures |

## Design Reference

- [Unified Internal Memory Tools — Section 2: Server Context](../../design/local.unified-internal-memory-tools.md)

## Steps

1. **Expand `InternalContext`** in `src/types/auth.ts` to absorb ghostMode fields:
   ```typescript
   export interface InternalContext {
     type: 'ghost' | 'agent';
     ghost_type?: 'user' | 'space' | 'group';
     ghost_space?: string;
     ghost_group?: string;
     // Absorbed from GhostModeContext:
     owner_user_id?: string;       // ghost owner (user ghosts)
     accessor_user_id: string;     // who is conversing
     accessor_trust_level?: number; // resolved trust (ghost only)
   }
   ```

2. **Remove `ghostMode`** from `AuthContext`:
   ```typescript
   export interface AuthContext {
     accessToken: string | null;
     credentials: UserCredentials | null;
     internalContext?: InternalContext;
     // ghostMode is gone
   }
   ```

3. **Remove `GhostModeContext`** interface (or deprecate if referenced externally)

4. **Update `server-factory.ts`**:
   - Replace `ghostMode` construction with `internalContext` construction
   - Move trust resolution into `internalContext` building:
     ```typescript
     const internalType = extras?.internal_type as string | undefined;
     let internalContext: InternalContext | undefined;

     if (internalType) {
       const ghostOwner = extras?.ghost_owner as string | undefined;
       let accessorTrustLevel: number | undefined;

       if (internalType === 'ghost' && ghostOwner) {
         const ghostConfig = await getGhostConfig(ghostOwner);
         accessorTrustLevel = await resolveAccessorTrustLevel(ghostConfig, ghostOwner, userId);
       }

       internalContext = {
         type: internalType as 'ghost' | 'agent',
         ghost_type: extras?.ghost_type as 'user' | 'space' | 'group' | undefined,
         ghost_space: extras?.ghost_space as string | undefined,
         ghost_group: extras?.ghost_group as string | undefined,
         owner_user_id: ghostOwner,
         accessor_user_id: userId,
         accessor_trust_level: accessorTrustLevel,
       };
     }

     const authContext: AuthContext = { accessToken, credentials, internalContext };
     ```

5. **Update `search-memory.ts`** — replace `ghostMode` references:
   - `ghostMode?.owner_user_id` → `internalContext?.owner_user_id`
   - `ghostMode?.accessor_trust_level` → `internalContext?.accessor_trust_level`
   - Cross-user search: `searchUserId = internalContext?.owner_user_id ?? userId`
   - Trust filter: `buildTrustFilter(collection, internalContext.accessor_trust_level)`

6. **Update `query-memory.ts`** — same pattern as search-memory

7. **Update `search-by.ts`** — same pattern, update ghost context passed to core services

8. **Update `e2e-helpers.ts`** — replace `ghostMode` test fixture with `internalContext`

9. **Update test files** — `search-by.spec.ts`, `ghost-tools.spec.ts` mock structures

## Verification

- [ ] `GhostModeContext` removed (or deprecated)
- [ ] `AuthContext.ghostMode` removed
- [ ] `AuthContext.internalContext` contains all former ghostMode fields
- [ ] `server-factory.ts` builds `internalContext` from headers, resolves trust level
- [ ] `search-memory.ts` uses `internalContext` for cross-user search and trust filtering
- [ ] `query-memory.ts` uses `internalContext` for cross-user search and trust filtering
- [ ] `search-by.ts` uses `internalContext` for ghost context
- [ ] No remaining references to `ghostMode` in src/ (except ghost tools being deleted in task-217)
- [ ] TypeScript compiles without errors
- [ ] All existing tests updated and passing
