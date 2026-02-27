# Task 183: Access Control Service

**Milestone**: M7 — Trust & Permissions
**Status**: pending
**Dependencies**: Task 180 (types), Task 182 (trust enforcement)
**Updated**: 2026-02-27 (aligned with ghost/persona design)

---

## Objective

Implement the main access control check using the discriminated union result pattern. See `agent/design/access-control-result-pattern.md`.

> **Design change (2026-02-27)**: In ghost mode (default), query-level filtering handles trust
> enforcement at the Weaviate layer — `checkMemoryAccess()` is not called per-memory. However,
> this service is still needed for: (1) trust escalation penalty tracking, (2) block management,
> (3) future direct access tools, and (4) prompt/hybrid enforcement modes where memories are
> returned and need per-memory access checks.

## Deliverables

### 1. `src/services/access-control.ts`

Core function: `checkMemoryAccess(memoryId, accessorUserId, memory)` → `Promise<AccessResult>`:

```
1. If accessor === memory.user_id → { status: 'granted', access_level: 'owner' }
2. Check if ghost enabled for accessor → { status: 'no_permission' } if not
3. Check if blocked → { status: 'blocked' }
4. Check trust level → { status: 'insufficient_trust' } if too low
5. All checks pass → { status: 'granted', access_level: 'trusted' }
```

**Trust escalation** (applies to ghost conversations):
- `handleInsufficientTrust(ownerUserId, accessorUserId, memoryId)` — apply -0.1 penalty, block after 3 attempts
- `isMemoryBlocked(ownerUserId, accessorUserId, memoryId)` — check block status
- `resetBlock(ownerUserId, accessorUserId, memoryId)` — clear block (via grant_access)

**Utility**:
- `formatAccessResultMessage(result: AccessResult)` — human-readable message for each result type
- `resolveAccessorTrustLevel(ownerUserId, accessorUserId)` — look up trust from GhostConfig (per_user_trust → default_friend_trust → default_public_trust → 0)

Key rules:
- Self-access ALWAYS succeeds (no trust check)
- In query mode: this service handles escalation tracking, not per-memory filtering
- In prompt/hybrid mode: this service does per-memory access checks
- Trust penalties are -0.1 per failed attempt
- Block after 3 failed attempts on same memory
- Blocks are memory-specific, not user-wide

### 2. Tests — `src/services/access-control.spec.ts`

- Self-access always granted
- Cross-user access with sufficient trust → granted
- Cross-user access with insufficient trust → insufficient_trust + penalty
- Block after 3 attempts
- Ghost not enabled → no_permission
- Trust resolution: per_user_trust > default_friend_trust > default_public_trust > 0
- Trust penalty reduces trust by 0.1
- Block is memory-specific (other memories still accessible)
- formatAccessResultMessage for each variant

## Acceptance Criteria

- [ ] All AccessResult variants returned correctly
- [ ] Self-access always works
- [ ] Trust resolution from GhostConfig works
- [ ] Trust penalties applied
- [ ] Blocking works after 3 attempts
- [ ] Tests pass
