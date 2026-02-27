# Task 180: Access Result & Permission Types

**Milestone**: M7 — Trust & Permissions
**Status**: pending
**Dependencies**: None (types only)

---

## Objective

Create the discriminated union AccessResult type and UserPermission interface used throughout M7.

## Deliverables

### 1. `src/types/access-result.ts`

Discriminated union for type-safe access control responses (see `agent/design/access-control-result-pattern.md`):

```typescript
type AccessResult =
  | { status: 'granted'; memory: Memory; access_level: 'owner' | 'trusted' }
  | { status: 'insufficient_trust'; memory_id: string; required_trust: number; actual_trust: number; attempts_remaining: number }
  | { status: 'blocked'; memory_id: string; reason: string; blocked_at: string }
  | { status: 'no_permission'; owner_user_id: string; accessor_user_id: string }
  | { status: 'not_found'; memory_id: string }
  | { status: 'deleted'; memory_id: string; deleted_at: string }
```

### 2. `src/types/permission.ts`

UserPermission interface for Firestore storage (see `agent/design/permissions-storage-architecture.md`):

```typescript
interface UserPermission {
  owner_user_id: string;
  accessor_user_id: string;
  trust_level: number;       // 0-1, determines what accessor can see
  access_scope: 'all' | 'tagged';
  allowed_tags?: string[];
  excluded_tags?: string[];
  granted_at: string;
  expires_at?: string | null;
  last_accessed?: string;
  access_count: number;
  granted_by: string;        // 'owner' or admin userId
  revoked: boolean;
  revoked_at?: string | null;
  revoked_reason?: string | null;
}
```

### 3. Tests — `src/types/access-result.spec.ts`

- Type narrowing works correctly for each AccessResult variant
- Helper functions (if any) behave as expected

## Acceptance Criteria

- [ ] AccessResult type exported and usable
- [ ] UserPermission interface matches Firestore schema
- [ ] Types compile without errors
- [ ] Tests pass
