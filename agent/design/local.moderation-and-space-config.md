# Moderation System & Per-Space Configuration

**Concept**: Content moderation workflow with per-space/group behavioral config, owned by remember-mcp
**Created**: 2026-02-27
**Status**: Proposal

---

## Overview

Published memories in shared spaces and groups currently have no moderation workflow — anything published is immediately visible. This design introduces a moderation status lifecycle for published memories and a per-space/group configuration system that controls behavioral rules like whether moderation is required.

The key architectural decision is **separation of concerns**:
- **agentbase.me** owns ACL: "Who are you, and what are you allowed to do?" (identity, membership, `can_moderate`, `can_publish`)
- **remember-mcp** owns behavior: "When you do it, what happens?" (require moderation, default visibility, retention rules)

---

## Problem Statement

- Published memories are immediately visible to all users in a space/group — no review step exists
- No mechanism to flag, reject, or remove inappropriate content
- Existing `moderation_flags: TEXT_ARRAY` field (from M12) is a flat array with no status lifecycle
- No per-space/group behavioral configuration — all spaces behave identically
- Moderators have no way to search for pending or rejected content

---

## Solution

### 1. Moderation Status Lifecycle

Replace the flat `moderation_flags` concept with structured moderation fields on published memories:

```
pending → approved → removed
pending → rejected
```

- **pending**: Published but awaiting moderator review (when `require_moderation: true`)
- **approved**: Visible in default searches (set automatically or by moderator)
- **rejected**: Moderator declined — invisible in all default searches
- **removed**: Was approved, then removed by moderator post-publication

### 2. Flat Weaviate Fields (Not JSON)

Weaviate cannot efficiently filter on nested objects. Use flat fields for queryability:

| Field | Type | Description |
|-------|------|-------------|
| `moderation_status` | TEXT | `pending` \| `approved` \| `rejected` \| `removed` |
| `moderation_flags` | TEXT_ARRAY | Free-form flags (existing field, keep for tagging) |
| `moderated_by` | TEXT | userId of the moderator who last acted |
| `moderated_at` | DATE | Timestamp of last moderation action |

All nullable. `null` status treated as `approved` (backward compat with existing published memories).

### 3. `can_moderate` Permission

Add to `GroupPermissions` in `src/types/auth.ts`:

```typescript
export interface GroupPermissions {
  can_read: boolean;
  can_publish: boolean;
  can_revise: boolean;
  can_propose: boolean;
  can_overwrite: boolean;
  can_comment: boolean;
  can_retract_own: boolean;
  can_retract_any: boolean;
  can_manage_members: boolean;
  can_moderate: boolean;  // NEW
}
```

Returned by agentbase.me in the credentials response. remember-mcp checks this permission before allowing moderation actions.

### 4. Per-Space/Group Config in Firestore

Firestore document at `spaces/{spaceId}/config` or `groups/{groupId}/config`:

```typescript
interface SpaceConfig {
  require_moderation: boolean;   // false = auto-approve on publish
  default_write_mode: WriteMode; // 'owner_only' | 'group_editors' | 'anyone'
  // future:
  // retention_days?: number;
  // max_memories?: number;
  // allowed_content_types?: string[];
}
```

**Default** (when no config document exists): `{ require_moderation: false, default_write_mode: 'owner_only' }` — backward compatible, all existing spaces continue to work.

### 5. Search Visibility Rules

| moderation_status | Default search | Moderator search |
|-------------------|---------------|-----------------|
| `approved` (or null) | visible | visible |
| `pending` | hidden | visible |
| `rejected` | hidden | visible |
| `removed` | hidden | visible |

- `remember_search_space` and `remember_query_space` add `moderation_status` filter
- Default behavior: only return `approved` or `null` (backward compat)
- New parameter: `moderation_filter?: 'approved' | 'pending' | 'rejected' | 'removed' | 'all'`
- `pending`/`rejected`/`removed`/`all` require `can_moderate` permission (checked via `authContext`)

---

## Implementation

### Schema Changes — `src/schema/v2-collections.ts`

Add to `PUBLISHED_MEMORY_PROPERTIES`:

```typescript
// Moderation
{ name: 'moderation_status', dataType: configure.dataType.TEXT },
{ name: 'moderated_by', dataType: configure.dataType.TEXT },
{ name: 'moderated_at', dataType: configure.dataType.DATE },
// moderation_flags already exists in COMMON_MEMORY_PROPERTIES
```

### Publish Flow Changes

In `confirm.ts` `executePublishMemory()`:

1. Read space/group config from Firestore
2. If `require_moderation: true` → set `moderation_status: 'pending'`
3. If `require_moderation: false` (or no config) → set `moderation_status: 'approved'`

### Search Filter Changes

In `search-space.ts` and `query-space.ts`:

```typescript
// Default: only show approved (or null for backward compat)
const moderationFilter = Filters.or(
  collection.filter.byProperty('moderation_status').equal('approved'),
  collection.filter.byProperty('moderation_status').isNull(true)
);

// If moderator requests non-approved:
// 1. Check authContext.credentials for can_moderate on the target group
// 2. Apply requested moderation_status filter instead
```

### Firestore Config Service

New service `src/services/space-config.service.ts`:

```typescript
export interface SpaceConfig {
  require_moderation: boolean;
  default_write_mode: WriteMode;
}

const DEFAULT_CONFIG: SpaceConfig = {
  require_moderation: false,
  default_write_mode: 'owner_only',
};

export async function getSpaceConfig(spaceOrGroupId: string, type: 'space' | 'group'): Promise<SpaceConfig> {
  const path = type === 'space' ? `spaces/${spaceOrGroupId}/config` : `groups/${spaceOrGroupId}/config`;
  const doc = await getDocument(path, 'settings');
  return doc ? { ...DEFAULT_CONFIG, ...doc } : DEFAULT_CONFIG;
}
```

### Moderation Tool (Future)

Not in scope for initial implementation, but the shape would be:

```typescript
// remember_moderate — set moderation status on a published memory
{
  memory_id: string;
  space_id?: string;
  group_id?: string;
  action: 'approve' | 'reject' | 'remove';
  reason?: string;
}
```

This could reuse the confirmation flow or be a direct-action tool (moderators have already been granted elevated trust).

---

## Benefits

- **Content safety**: Spaces/groups can require review before content is visible
- **Backward compatible**: Null moderation_status treated as approved — existing memories unaffected
- **Filterable**: Flat Weaviate fields enable efficient query-level filtering
- **Clean separation**: agentbase.me manages who can moderate; remember-mcp manages what moderation means
- **Extensible**: SpaceConfig pattern supports future behavioral knobs (retention, quotas, content type restrictions)

---

## Trade-offs

- **Latency**: Publish flow gains a Firestore read for space config (mitigated by caching or co-locating with existing Firestore reads)
- **Complexity**: Search tools gain a new filter parameter and permission check
- **No moderation tool yet**: Initial implementation only sets status during publish; explicit moderator actions (approve/reject/remove) require a future tool
- **Flat fields**: Less flexible than a JSON object, but necessary for Weaviate filterability

---

## Dependencies

- **v3.9.0 AuthContext foundations** (completed): `AuthContext` threaded through all handlers, `GroupPermissions` type exists
- **agentbase.me credentials endpoint**: Must return `can_moderate` permission in group memberships
- **Firestore**: Already initialized, used for confirmation tokens and preferences
- **local.memory-acl-schema.md**: ACL fields (`write_mode`, `owner_id`) already added to schema in v3.9.0

---

## Testing Strategy

- **Unit tests**: SpaceConfig service with default fallback, config override
- **Unit tests**: Publish flow sets correct moderation_status based on config
- **Unit tests**: Search filters apply moderation_status correctly
- **Unit tests**: Non-moderators cannot search for pending/rejected/removed content
- **Integration test**: End-to-end publish → moderate → search flow

---

## Migration Path

1. **Add schema fields** (`moderation_status`, `moderated_by`, `moderated_at`) — nullable, zero backfill
2. **Add SpaceConfig service** — reads from Firestore with defaults
3. **Update publish flow** — check config, set initial moderation_status
4. **Update search tools** — filter on moderation_status (default: approved/null)
5. **Add `can_moderate` to GroupPermissions** — type change only until enforcement
6. **Future**: Add `remember_moderate` tool for explicit moderator actions

---

## Future Considerations

- `remember_moderate` tool for approve/reject/remove actions
- Moderation queue UI (list pending items for a space/group)
- **Automated moderation rules** — separate Firestore document (`groups/{groupId}/config/moderation-rules`) with rules like `auto_approve_trusted` (trust_score > threshold), `auto_approve_editors`, `blocked_content_types`. Runs during publish to resolve `pending` status without human intervention. The current design supports this without changes — `require_moderation: true` sets status to `pending`, and what resolves it (human or automated) is orthogonal.
- Moderation audit log (who moderated what, when, why)
- Notification system for moderation decisions
- Appeal workflow (author can contest a rejection)
- SpaceConfig management tool (`remember_configure_space`)

---

**Status**: Proposal
**Recommendation**: Implement alongside M7 Trust & Permissions — schema fields and SpaceConfig service first, search filtering second, moderation tool third
**Related Documents**:
- [local.memory-acl-schema.md](local.memory-acl-schema.md) — ACL field design (write_mode, owner_id)
- [local.group-credentials-for-remember-mcp.md](local.group-credentials-for-remember-mcp.md) — Credentials endpoint contract
- [local.memory-collection-pattern-v2.md](local.memory-collection-pattern-v2.md) — v2 collection architecture
