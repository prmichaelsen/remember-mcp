# Task 180: Access Result & Trust Configuration Types

**Milestone**: M7 — Trust & Permissions
**Status**: pending
**Dependencies**: None (types only)
**Updated**: 2026-02-27 (aligned with ghost/persona design)

---

## Objective

Create the discriminated union AccessResult type and GhostConfig interface used throughout M7 and M16 (ghost/persona system).

> **Design change (2026-02-27)**: The original `UserPermission` interface was replaced by
> `GhostConfig` per clarification-2/3. Cross-user access is mediated through ghost conversations,
> not direct permission grants.

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

### 2. `src/types/ghost-config.ts`

GhostConfig interface for Firestore storage at `users/{ownerUserId}/ghost_config` (see `agent/design/local.ghost-persona-system.md`):

```typescript
interface GhostConfig {
  enabled: boolean;                    // false by default
  public_ghost_enabled: boolean;       // allow non-friends to chat
  default_friend_trust: number;        // default 0.25
  default_public_trust: number;        // default 0 (strangers see nothing)
  per_user_trust: Record<string, number>; // userId → trust level overrides
  blocked_users: string[];             // users blocked from ghost access
  enforcement_mode: 'query' | 'prompt' | 'hybrid'; // default 'query'
}

type TrustEnforcementMode = 'query' | 'prompt' | 'hybrid';
```

### 3. Add 'ghost' to content types

Add `'ghost'` to `CONTENT_TYPES` array in `src/constants/content-types.ts` and ensure it's part of the `ContentType` union. Also verify `'comment'` is present (currently missing from types despite being used in filters).

### 4. Tests — `src/types/access-result.spec.ts`

- Type narrowing works correctly for each AccessResult variant
- GhostConfig default values are correct
- Helper functions (if any) behave as expected

## Acceptance Criteria

- [ ] AccessResult type exported and usable
- [ ] GhostConfig interface matches Firestore schema from ghost design
- [ ] TrustEnforcementMode type exported
- [ ] 'ghost' and 'comment' in ContentType union
- [ ] Types compile without errors
- [ ] Tests pass
