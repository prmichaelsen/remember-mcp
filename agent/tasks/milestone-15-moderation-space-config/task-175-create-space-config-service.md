# Task 175: Create SpaceConfig Service

**Milestone**: M15 - Moderation & Space Config
**Estimated Hours**: 3-4
**Dependencies**: None
**Status**: Not Started

---

## Objective

Create a Firestore-backed service for per-space/group behavioral configuration with sensible defaults.

---

## Steps

### 1. Create `src/services/space-config.service.ts`

```typescript
export interface SpaceConfig {
  require_moderation: boolean;
  default_write_mode: WriteMode;
}

const DEFAULT_CONFIG: SpaceConfig = {
  require_moderation: false,
  default_write_mode: 'owner_only',
};

export async function getSpaceConfig(
  id: string,
  type: 'space' | 'group'
): Promise<SpaceConfig>;

export async function setSpaceConfig(
  id: string,
  type: 'space' | 'group',
  config: Partial<SpaceConfig>
): Promise<void>;
```

- Firestore path: `spaces/{spaceId}/config/settings` or `groups/{groupId}/config/settings`
- Default fallback when no document exists
- Partial updates via `setSpaceConfig`

### 2. Create `src/services/space-config.service.spec.ts`

Tests:
- `getSpaceConfig` returns defaults when no Firestore doc exists
- `getSpaceConfig` returns merged config when doc exists (partial override)
- `setSpaceConfig` writes to correct Firestore path
- Correct Firestore paths for spaces vs groups

---

## Verification

- [ ] `getSpaceConfig()` returns defaults when no config exists
- [ ] `getSpaceConfig()` merges partial config with defaults
- [ ] `setSpaceConfig()` writes to Firestore
- [ ] Space vs group paths are correct
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
