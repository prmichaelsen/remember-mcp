# Task 183: Access Control Service

**Milestone**: M7 — Trust & Permissions
**Status**: pending
**Dependencies**: Task 180 (types), Task 181 (Firestore), Task 182 (trust enforcement)

---

## Objective

Implement the main access control check using the discriminated union result pattern. See `agent/design/access-control-result-pattern.md`.

## Deliverables

### 1. `src/services/access-control.ts`

Core function: `checkMemoryAccess(memoryId, accessorUserId, memory)` → `Promise<AccessResult>`:

```
1. If accessor === memory.user_id → { status: 'granted', access_level: 'owner' }
2. Check permission exists → { status: 'no_permission' } if not
3. Check if blocked → { status: 'blocked' }
4. Check trust level → { status: 'insufficient_trust' } if too low
5. All checks pass → { status: 'granted', access_level: 'trusted' }
```

Additional functions:
- `handleInsufficientTrust(ownerUserId, accessorUserId, memoryId, permission)` — apply -0.1 penalty, block after 3 attempts
- `formatAccessResultMessage(result: AccessResult)` — human-readable message for each result type

Key rules:
- Self-access ALWAYS succeeds (no trust check)
- Trust penalties are -0.1 per failed attempt
- Block after 3 failed attempts on same memory
- Blocks are memory-specific, not user-wide
- All attempts are logged

### 2. Tests — `src/services/access-control.spec.ts`

- Self-access always granted
- Cross-user access with sufficient trust → granted
- Cross-user access with insufficient trust → insufficient_trust + penalty
- Block after 3 attempts
- No permission → no_permission
- Deleted memory → deleted
- Not found → not_found
- Trust penalty reduces trust by 0.1
- Block is memory-specific (other memories still accessible)

## Acceptance Criteria

- [ ] All AccessResult variants returned correctly
- [ ] Self-access always works
- [ ] Trust penalties applied
- [ ] Blocking works after 3 attempts
- [ ] All attempts logged
- [ ] Tests pass
