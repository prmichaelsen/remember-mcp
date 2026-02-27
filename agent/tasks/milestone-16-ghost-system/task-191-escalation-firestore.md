# Task 191: Escalation Store Firestore Implementation

**Milestone**: M16 — Ghost System
**Status**: not_started
**Dependencies**: Task 183 (access control with InMemoryEscalationStore — done)

---

## Objective

Replace InMemoryEscalationStore with Firestore-backed persistence for trust escalation tracking (attempt counts, blocks).

## Deliverables

### 1. Create `src/services/escalation.service.ts`

- Implements `EscalationStore` interface from access-control.ts
- Firestore path: `users/{ownerUserId}/ghost_escalation/{accessorUserId}`
- Fields: `attempts` (number), `blocked` (boolean), `blocked_at` (timestamp), `last_attempt_at` (timestamp)
- Auto-cleanup: stale escalation records after 30 days

### 2. Wire into access-control.ts

- Replace `InMemoryEscalationStore` with `FirestoreEscalationStore` in production
- Keep `InMemoryEscalationStore` for tests

### 3. Tests

- Firestore mock tests for escalation CRUD
- Block/unblock persistence
- Attempt tracking

## Acceptance Criteria

- [ ] Escalation data persists across requests
- [ ] Block status survives server restarts
- [ ] Attempt counts accumulate correctly
- [ ] Tests pass
