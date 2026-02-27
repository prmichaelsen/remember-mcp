# Memory ACL Schema

**Concept**: Memory-level access control fields on Weaviate collections and space configuration in Firestore
**Created**: 2026-02-27
**Status**: Design Specification

---

## Overview

This document specifies the schema additions needed to support memory-level ACLs, collaborative editing, and group-based permissions in remember-mcp. It covers:

1. Four new Weaviate fields on `PUBLISHED_MEMORY_PROPERTIES`
2. Revision history format change to track revisers
3. Space configuration Firestore collection
4. Three-layer permission resolution algorithm

**Key principle**: remember-mcp owns memory-level ACL fields (Weaviate) and space config (Firestore). Group membership and roles are resolved via agentbase.me's credentials API — remember-mcp never stores or manages group metadata.

---

## Problem Statement

The current schema supports publish/retract/revise but assumes only the original author can modify published memories. There is no mechanism for:

- Granting write access to other users on a published memory
- Tracking who last revised a published copy (needed for conflict detection)
- Transferring ownership of a published memory
- Configuring space-level moderation and publishing policies

Without these fields, collaborative memory editing and group-based workflows cannot be safely implemented.

---

## Solution

### New Weaviate Fields

Add four fields to `PUBLISHED_MEMORY_PROPERTIES` in `src/schema/v2-collections.ts`:

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `write_mode` | text | `null` (→ `"owner_only"`) | Controls who can revise: `"owner_only"` / `"group_editors"` / `"anyone"` |
| `overwrite_allowed_ids` | text[] | `[]` | Per-memory explicit overwrite grants (user IDs) |
| `last_revised_by` | text | `null` | User ID of last reviser — enables `remember_sync` conflict detection |
| `owner_id` | text | `null` (→ `author_id`) | Supports ownership transfer without changing `author_id` |

**No `moderation_status` field** — reuse existing `moderation_flags` text[] in `COMMON_MEMORY_PROPERTIES`. Moderation flags use the format `"{space_id}:{flag_type}"` which already supports per-space moderation states.

**No changes to `COMMON_MEMORY_PROPERTIES`** — all new fields are publish-only concerns.

### Revision History Format Change

Current format:
```json
{ "content": "old text", "revised_at": "2026-02-27T12:00:00Z" }
```

New format:
```json
{ "content": "old text", "revised_at": "2026-02-27T12:00:00Z", "revised_by": "user123" }
```

The `revised_by` field tracks which user made each historical revision. Existing entries without `revised_by` are treated as revisions by the original author.

### Space Configuration (Firestore)

New Firestore collection for space-level settings:

**`{BASE}.spaces/{spaceId}`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `space_id` | string | yes | Space identifier (matches SUPPORTED_SPACES) |
| `name` | string | yes | Display name |
| `description` | string | no | Space description |
| `moderation_enabled` | boolean | yes | Whether moderation is active |
| `moderator_ids` | string[] | yes | User IDs with moderation power |
| `publish_policy` | string | yes | `"open"` / `"approved_only"` / `"invite_only"` |
| `approved_publisher_ids` | string[] | no | For `"approved_only"` policy |

Group membership/roles come from the agentbase.me credentials API, NOT from remember-mcp Firestore.

---

## Implementation

### Schema Changes (`src/schema/v2-collections.ts`)

```typescript
const PUBLISHED_MEMORY_PROPERTIES = [
  // Existing fields
  { name: 'published_at', dataType: 'date' as any },
  { name: 'revised_at', dataType: 'date' as any },
  { name: 'author_id', dataType: 'text' as any },
  { name: 'ghost_id', dataType: 'text' as any },
  { name: 'attribution', dataType: 'text' as any },
  { name: 'discovery_count', dataType: 'int' as any },
  { name: 'revision_count', dataType: 'int' as any },
  { name: 'original_memory_id', dataType: 'text' as any },
  { name: 'spaces', dataType: 'text[]' as any },
  { name: 'space_id', dataType: 'text' as any },
  { name: 'space_memory_id', dataType: 'text' as any },

  // NEW: Memory-level ACL fields
  { name: 'write_mode', dataType: 'text' as any },
  { name: 'overwrite_allowed_ids', dataType: 'text[]' as any },
  { name: 'last_revised_by', dataType: 'text' as any },
  { name: 'owner_id', dataType: 'text' as any },
];
```

### Write Mode Semantics

| Value | Who can revise | Who can overwrite | Use case |
|-------|---------------|-------------------|----------|
| `"owner_only"` (default) | `owner_id` (or `author_id`) only | `owner_id` + `overwrite_allowed_ids` | Personal memories shared for reading |
| `"group_editors"` | Users with `can_revise` permission from credentials API | Users with `can_overwrite` permission or in `overwrite_allowed_ids` | Collaborative group documents |
| `"anyone"` | Any authenticated user | Any authenticated user | Wiki-style open editing |

### Null-Fallback Strategy

All four fields are nullable. No backfill is needed for existing memories.

| Field | When null | Behavior |
|-------|-----------|----------|
| `write_mode` | Always on pre-ACL memories | Treated as `"owner_only"` |
| `owner_id` | Original author still owns it | Falls back to `author_id` |
| `last_revised_by` | No previous collaborative revision | No conflict detection available (safe to revise) |
| `overwrite_allowed_ids` | No explicit grants | Treated as empty array |

### Permission Resolution Algorithm

Three-layer check, evaluated in order:

```
Layer 1: Memory-level (Weaviate)
  │
  ├─ Read write_mode from published memory
  ├─ Read overwrite_allowed_ids from published memory
  ├─ Resolve owner: owner_id ?? author_id
  │
  ▼
Layer 2: Group-level (agentbase.me credentials API)
  │
  ├─ Only checked when write_mode === "group_editors"
  ├─ GET /api/credentials/agentbase → group_memberships_v2
  ├─ Find matching group_id → check permissions.can_revise / can_overwrite
  │
  ▼
Layer 3: User-level (Firestore)
  │
  ├─ Existing user_permissions collection
  ├─ Cross-user private access grants
  └─ Not involved in published memory ACLs (private collection only)
```

#### Resolution for `remember_revise`

```typescript
async function canRevise(userId: string, memory: PublishedMemory): Promise<boolean> {
  const owner = memory.owner_id ?? memory.author_id;

  // Owner can always revise
  if (userId === owner) return true;

  const writeMode = memory.write_mode ?? 'owner_only';

  switch (writeMode) {
    case 'owner_only':
      return false;

    case 'group_editors':
      // Check credentials API for group permission
      const credentials = await fetchCredentials(jwt);
      const groupIds = memory.group_ids ?? [];
      return groupIds.some(gid => {
        const membership = credentials.group_memberships_v2
          .find(m => m.group_id === gid);
        return membership?.permissions.can_revise === true;
      });

    case 'anyone':
      return true;
  }
}
```

#### Resolution for `remember_overwrite`

```typescript
async function canOverwrite(userId: string, memory: PublishedMemory): Promise<boolean> {
  const owner = memory.owner_id ?? memory.author_id;

  // Owner can always overwrite
  if (userId === owner) return true;

  // Explicit per-memory grant
  if ((memory.overwrite_allowed_ids ?? []).includes(userId)) return true;

  const writeMode = memory.write_mode ?? 'owner_only';

  switch (writeMode) {
    case 'owner_only':
      return false;

    case 'group_editors':
      const credentials = await fetchCredentials(jwt);
      const groupIds = memory.group_ids ?? [];
      return groupIds.some(gid => {
        const membership = credentials.group_memberships_v2
          .find(m => m.group_id === gid);
        return membership?.permissions.can_overwrite === true;
      });

    case 'anyone':
      return true;
  }
}
```

### Query-Time vs Handler-Time Filtering

**Query-time** (Weaviate filters — fast, runs on every search):
- `deleted_at IS NULL` (soft delete)
- `doc_type = 'memory'`
- `space_ids containsAny [...]`
- `moderation_flags` (filter flagged content)
- `content_type`, `tags` (user-specified filters)

**Handler-time** (TypeScript + credentials API — per-operation):
- Group membership validation
- Resolved permissions (`can_revise`, `can_overwrite`, etc.)
- `write_mode` + `overwrite_allowed_ids` checks
- Owner resolution (`owner_id ?? author_id`)

This split keeps searches fast (no external API calls during queries) while enforcing permissions on write operations.

### Impact on Existing Tools

| Tool | Change |
|------|--------|
| `remember_publish` | Set `write_mode` if provided (default: null → owner_only). Set `owner_id` to publishing user. |
| `remember_revise` | Set `last_revised_by` on each revised copy. Add `revised_by` to revision history entries. Check `canRevise()` before proceeding. |
| `remember_overwrite` | Check `canOverwrite()` before proceeding. Set `last_revised_by` on overwritten copies. |
| `remember_sync` | Use `last_revised_by` for conflict detection. Include `revised_by` in conflict details. |
| `remember_retract` | Check `can_retract_own` or `can_retract_any` for group memories. |
| `remember_search_space` | No change (ACLs are handler-time, not query-time). |
| `remember_create_memory` | No change (personal collection, no ACL fields). |
| `remember_update_memory` | No change (personal collection, no ACL fields). |

### Firestore Space Configuration

```typescript
// src/services/space-config.service.ts

interface SpaceConfig {
  space_id: string;
  name: string;
  description?: string;
  moderation_enabled: boolean;
  moderator_ids: string[];
  publish_policy: 'open' | 'approved_only' | 'invite_only';
  approved_publisher_ids?: string[];
}

// Firestore path: {BASE}/spaces/{spaceId}
```

Space config is checked during `remember_publish` when publishing to a space:
- `publish_policy: "open"` → anyone can publish
- `publish_policy: "approved_only"` → check `approved_publisher_ids`
- `publish_policy: "invite_only"` → space must be created with explicit invites (future)

---

## Benefits

- **Nullable defaults**: Zero-migration deployment — all existing memories work unchanged
- **Separation of concerns**: Memory-level ACLs in Weaviate, group membership in agentbase.me, space config in Firestore
- **Conflict tracking**: `last_revised_by` enables safe collaborative editing via `remember_sync`
- **Flexible write modes**: From locked-down (`owner_only`) to wiki-style (`anyone`)
- **Per-memory overrides**: `overwrite_allowed_ids` for granting specific users force-push access

---

## Trade-offs

- **No query-time ACL filtering**: Write permissions are checked at handler-time, not in Weaviate queries (mitigated: write ops are infrequent compared to reads)
- **Credentials API dependency**: Every group permission check requires a network call (mitigated: ~50-100ms, only on write operations)
- **Schema growth**: Four new fields on every published memory (mitigated: nullable, no storage cost when null)
- **No field-level permissions**: Can't grant "edit tags but not content" (mitigated: premature for current needs)

---

## Dependencies

- agentbase.me credentials endpoint with resolved permissions ([`local.group-credentials-for-remember-mcp.md`](../../../.acp/projects/agentbase.me-e1/agent/design/local.group-credentials-for-remember-mcp.md))
- Memory Collection Pattern v2 (M14) — composite IDs, tracking arrays, revision history
- `remember_revise` confirmation flow (v3.7.0)
- Collaborative Memory Sync proposal ([`local.collaborative-memory-sync.md`](local.collaborative-memory-sync.md))

---

## Testing Strategy

**Unit Tests**:
- `canRevise()` for each `write_mode` value with various user/owner combinations
- `canOverwrite()` with explicit `overwrite_allowed_ids` grants
- Null-fallback behavior (all fields null → owner_only semantics)
- Revision history format with `revised_by` field
- Space config validation (`publish_policy` enforcement)

**Integration Tests**:
- Publish with `write_mode: "group_editors"` → non-member cannot revise → editor can revise
- Publish with `write_mode: "anyone"` → any user can revise
- `overwrite_allowed_ids` grant → specific user can overwrite
- Ownership transfer via `owner_id` change
- `last_revised_by` set correctly after collaborative revision
- `remember_sync` detects conflict from different `last_revised_by`

---

## Migration Path

1. **Add schema fields** — Add 4 new properties to `PUBLISHED_MEMORY_PROPERTIES` in `v2-collections.ts`
2. **Update revision logic** — Set `last_revised_by` and `revised_by` in `confirm.ts` `executeReviseMemory`
3. **Add permission utilities** — Create `src/services/permission-resolver.ts` with `canRevise()`, `canOverwrite()`
4. **Create space config service** — `src/services/space-config.service.ts` for Firestore space settings
5. **Wire into tools** — Add permission checks to `remember_revise`, `remember_overwrite`, `remember_retract`
6. **Expose write_mode** — Allow setting `write_mode` during `remember_publish`
7. **No backfill needed** — null defaults handle all existing memories

---

## Future Considerations

- **Ownership transfer tool**: Explicit `remember_transfer_ownership` tool to change `owner_id`
- **Per-field permissions**: Grant access to modify specific fields (tags, weight) without full content access
- **Moderation queue**: Space moderators review flagged content before it's visible
- **Audit log**: Record all permission checks and write operations for compliance
- **Group-level write_mode defaults**: Groups could set a default `write_mode` for all memories published to them

---

**Status**: Design Specification
**Recommendation**: Implement schema fields first (step 1-2), then permission utilities (step 3-5) alongside agentbase.me credentials endpoint
**Related Documents**:
- [Collaborative Memory Sync](local.collaborative-memory-sync.md) — `remember_sync` and `remember_overwrite` proposals
- [v2 API Reference](local.v2-api-reference.md) — Current tool documentation
- [Memory Collection Pattern v2](local.memory-collection-pattern-v2.md) — Foundation architecture
- agentbase.me [Group Credentials for remember-mcp](../../../.acp/projects/agentbase.me-e1/agent/design/local.group-credentials-for-remember-mcp.md) — Credentials endpoint design
