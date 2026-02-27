# Memory Collection Pattern v2 — Migration Guide

**Concept**: Step-by-step guide for migrating from v1 to v2 collection patterns
**Created**: 2026-02-27
**Status**: Implemented

---

## Overview

This document provides migration guidance for transitioning from Memory Collection Pattern v1 to v2. The v2 pattern introduces dot-notation collections, composite IDs, and tracking arrays — a breaking change that requires data migration for existing deployments.

---

## Problem Statement

v1 used a flat collection structure (`Memory_{userId}`, `Memory_public`, `Memory_{spaceId}`) with no standardized relationship between source and published memories. v2 introduces a three-tier structure with referential integrity, requiring existing data to be reorganized.

---

## Solution

### What Changed

| Feature | v1 | v2 |
|---------|----|----|
| User collections | `Memory_{userId}` | `Memory_users_{userId}` |
| Space collections | `Memory_{spaceId}` (per-space) | `Memory_spaces_public` (single) |
| Group collections | N/A | `Memory_groups_{groupId}` |
| Published IDs | New UUID (no link to source) | `{userId}.{memoryId}` composite |
| Space membership | `spaces` string field | `space_ids` string[] array |
| Multi-space publish | Not supported | Supported via space_ids array |
| Revision tracking | Not supported | `revision_history`, `revision_count`, `revised_at` |
| Retraction | Delete from collection | Orphan strategy (keep with cleared arrays) |

### Breaking Changes

1. **Collection names changed** — All collection names use new dot-notation format
2. **Published memory IDs changed** — Composite format `{userId}.{memoryId}` replaces simple UUIDs
3. **`remember_publish` parameters** — Now accepts `spaces[]` and `groups[]` arrays
4. **`remember_search_space` filtering** — Uses `space_ids.containsAny()` instead of `spaces` field
5. **New tool: `remember_revise`** — Syncs content to published copies
6. **New tool: `remember_retract`** — Retracts with orphan strategy (no deletion)
7. **Memory interface** — Added `space_ids: string[]` and `group_ids: string[]` fields

---

## Implementation

### Pre-Migration Checklist

- [ ] Back up all Weaviate collections
- [ ] Record current collection names and document counts
- [ ] Update remember-mcp to v3.1.0+
- [ ] Run migration dry-run first

### Migration Steps

#### Step 1: Rename User Collections

```
Memory_{userId} → Memory_users_{userId}
```

For each existing user collection, create the new collection with v2 schema and copy all documents.

#### Step 2: Merge Space Collections

```
Memory_{spaceId} (one per space) → Memory_spaces_public (single collection)
```

All per-space collections merge into `Memory_spaces_public`. Each document gets:
- `space_ids: ["{original_spaceId}"]`
- ID converted to composite format: `{userId}.{originalId}`

#### Step 3: Migrate Memory_public

```
Memory_public → Memory_spaces_public
```

Documents from the legacy unified public collection merge into `Memory_spaces_public`.

#### Step 4: Convert Published IDs to Composite

For every published memory:
```
Simple ID: "abc-123"
→ Composite ID: "{userId}.abc-123"
```

The `author_id` or `user_id` field provides the userId component.

#### Step 5: Initialize Tracking Arrays

For every user memory that has published copies:
```typescript
// Find where this memory is published
space_ids: ["the_void", "cooking"]  // spaces it was published to
group_ids: []                        // groups (none in v1)
```

For every published memory:
```typescript
space_ids: ["{spaceId}"]  // the space it belongs to
group_ids: []
```

#### Step 6: Add Revision Fields to Published Memories

```typescript
{
  revised_at: null,
  revision_count: 0,
  revision_history: "[]"  // JSON string
}
```

#### Step 7: Create Group Collections (if applicable)

Create `Memory_groups_{groupId}` for any existing groups. v1 had no group concept, so this is typically empty after migration.

### Post-Migration Verification

- [ ] All user collections renamed (`Memory_users_*` format)
- [ ] All space memories in `Memory_spaces_public`
- [ ] All published IDs are composite format
- [ ] `space_ids` populated on user memories that were published
- [ ] `remember_search_space` returns correct results
- [ ] `remember_publish` creates composite IDs
- [ ] `remember_revise` can sync content

### Rollback

If migration fails:
1. Stop migration
2. Restore from Weaviate backup collections
3. Revert remember-mcp to pre-v3.1.0 version
4. Investigate failure before retrying

---

## Benefits

- **Referential integrity** — Composite IDs link published copies to source
- **Multi-space publishing** — One memory in many spaces via `space_ids[]`
- **Revision support** — Update published content without republishing
- **Historical preservation** — Orphaned memories kept for reference
- **Group support** — New `Memory_groups_{groupId}` collections

---

## Trade-offs

- **All-or-nothing migration** — Cannot run v1 and v2 simultaneously
- **ID format change** — External references to published memory IDs will break
- **Storage increase** — `space_ids`/`group_ids` arrays add overhead per document
- **Downtime required** — Migration should run during a maintenance window

---

## Dependencies

- remember-mcp v3.1.0+ (v2 tool implementations)
- Weaviate with backup/restore capability
- Sufficient storage for backup collections

---

## Testing Strategy

- Run dry-run migration on a copy of production data
- Verify document counts match before/after
- Verify composite IDs parse correctly
- Run full tool test suite against migrated data
- Test search_space with space_ids filtering

---

**Status**: Implemented
**Recommendation**: Run dry-run first, verify counts, then migrate production during maintenance window
**Related Documents**:
- [Memory Collection Pattern v2](local.memory-collection-pattern-v2.md) — Design rationale
- [v2 API Reference](local.v2-api-reference.md) — Tool documentation
