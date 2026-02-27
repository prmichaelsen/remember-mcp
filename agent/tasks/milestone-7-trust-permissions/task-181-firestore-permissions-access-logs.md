# Task 181: Firestore Permissions & Access Logs

**Milestone**: M7 — Trust & Permissions
**Status**: pending
**Dependencies**: Task 180 (types)

---

## Objective

Implement Firestore CRUD operations for user permissions and access logging. Paths already defined in `src/firestore/paths.ts`.

## Deliverables

### 1. `src/firestore/permissions.ts`

CRUD operations for `users/{ownerUserId}/permissions/{accessorUserId}`:

- `grantPermission(ownerUserId, accessorUserId, opts)` — create/update permission doc
- `revokePermission(ownerUserId, accessorUserId, reason?)` — soft-revoke (set revoked: true)
- `getPermission(ownerUserId, accessorUserId)` — get single permission
- `listPermissions(ownerUserId)` — list all permissions granted by owner
- `listAccessibleUsers(accessorUserId)` — list all users who granted access to this accessor
- `updateTrustLevel(ownerUserId, accessorUserId, newTrust)` — update trust level (for escalation penalties)

### 2. `src/firestore/access-logs.ts`

Append-only access log at `users/{userId}/access_logs/{logId}`:

- `logAccessAttempt(entry)` — log access attempt (granted, denied, blocked)
- `getAccessLogs(userId, opts?)` — query logs with optional date range, accessor filter
- `getAttemptCount(accessorUserId, memoryId)` — count failed attempts for escalation tracking

### 3. `src/firestore/memory-blocks.ts`

Block tracking at `users/{ownerUserId}/memory_blocks/{accessorUserId}:{memoryId}`:

- `blockMemoryAccess(ownerUserId, accessorUserId, memoryId, reason)` — create block
- `isMemoryBlocked(ownerUserId, accessorUserId, memoryId)` — check if blocked
- `resetBlock(ownerUserId, accessorUserId, memoryId)` — remove block
- `listBlocks(ownerUserId)` — list all blocks for owner

### 4. Tests

- `src/firestore/permissions.spec.ts` — mock Firestore, test CRUD operations
- `src/firestore/access-logs.spec.ts` — mock Firestore, test logging and queries
- `src/firestore/memory-blocks.spec.ts` — mock Firestore, test block operations

## Acceptance Criteria

- [ ] All permission CRUD operations work
- [ ] Access logging is append-only
- [ ] Attempt counting works for escalation
- [ ] Block operations work correctly
- [ ] All tests pass
