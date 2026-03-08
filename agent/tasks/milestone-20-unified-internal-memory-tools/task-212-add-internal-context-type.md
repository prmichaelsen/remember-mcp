# Task 212: Add InternalContext Type and Agent Content Type

**Milestone**: M20 — Unified Internal Memory Tools
**Status**: Not Started
**Estimated Hours**: 2-3
**Dependencies**: None

---

## Objective

Add the `InternalContext` interface to `src/types/auth.ts` and add `'agent'` to the `ContentType` enum in remember-core. These are foundational types required by all subsequent tasks.

## Context

The unified internal tool suite needs a server-side context object (`InternalContext`) that captures header-derived information about whether the current session is ghost or agent, and what type of ghost. The `'agent'` content type parallels the existing `'ghost'` content type.

## Design Reference

- [Unified Internal Memory Tools — Section 2: Server Context](../design/local.unified-internal-memory-tools.md)

## Steps

1. Add `InternalContext` interface to `src/types/auth.ts` (absorbs all former `GhostModeContext` fields):
   ```typescript
   export interface InternalContext {
     type: 'ghost' | 'agent';
     ghost_type?: 'user' | 'space' | 'group';
     ghost_space?: string;
     ghost_group?: string;
     owner_user_id?: string;        // ghost owner (user ghosts)
     accessor_user_id: string;      // who is conversing
     accessor_trust_level?: number;  // resolved trust (ghost only)
   }
   ```

2. Replace `ghostMode?: GhostModeContext` with `internalContext?: InternalContext` on `AuthContext`

3. Remove `GhostModeContext` interface (superseded by `InternalContext`)

4. Add `'agent'` to the `ContentType` enum/type in remember-core:
   - If remember-core owns the enum, submit a PR to remember-core
   - If remember-mcp extends it locally, add it to the local extension

5. Export `InternalContext` from the types module

## Verification

- [ ] `InternalContext` interface exists in `src/types/auth.ts` with all absorbed ghostMode fields
- [ ] `GhostModeContext` removed
- [ ] `AuthContext.ghostMode` replaced by `AuthContext.internalContext`
- [ ] `'agent'` is a valid `ContentType` value
- [ ] TypeScript compiles without errors
- [ ] Existing tests still pass (no breaking changes)
