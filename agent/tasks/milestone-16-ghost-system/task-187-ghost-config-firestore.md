# Task 187: GhostConfig Firestore CRUD

**Milestone**: M16 — Ghost System
**Status**: not_started
**Dependencies**: Task 180 (GhostConfig types — done)

---

## Objective

Implement Firestore CRUD operations for GhostConfig, enabling users to enable/disable their ghost, set trust levels, and manage blocked users.

## Deliverables

### 1. Create `src/services/ghost-config.service.ts`

- `getGhostConfig(ownerUserId: string): Promise<GhostConfig | null>` — read from Firestore
- `setGhostConfig(ownerUserId: string, config: Partial<GhostConfig>): Promise<GhostConfig>` — upsert
- `setUserTrust(ownerUserId: string, targetUserId: string, trustLevel: number): Promise<void>` — set per-user trust
- `blockUser(ownerUserId: string, targetUserId: string): Promise<void>` — add to blocked_users
- `unblockUser(ownerUserId: string, targetUserId: string): Promise<void>` — remove from blocked_users
- `isGhostEnabled(ownerUserId: string): Promise<boolean>` — convenience check

**Firestore path**: `users/{ownerUserId}/ghost_config` (single document)

### 2. Wire into access-control.ts

- Replace `StubGhostConfigProvider` with `FirestoreGhostConfigProvider` that uses the service
- Keep `StubGhostConfigProvider` for tests

### 3. Tests

- `src/services/ghost-config.service.spec.ts` — unit tests with Firestore mocks

## Acceptance Criteria

- [ ] GhostConfig CRUD operations work against Firestore
- [ ] Default values applied when config doesn't exist
- [ ] Per-user trust overrides work
- [ ] Blocked user management works
- [ ] Tests pass
