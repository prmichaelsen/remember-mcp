# Memory Collection Pattern v2 — Migration Guide

**Concept**: Step-by-step guide for migrating from v1 to v2 collection patterns
**Created**: 2026-02-27
**Updated**: 2026-02-27
**Status**: Implemented

---

## Overview

This document provides migration guidance for transitioning from Memory Collection Pattern v1 to v2. The v2 pattern introduces dot-notation collections, composite IDs, and tracking arrays — a breaking change that requires data migration for existing deployments.

---

## Problem Statement

v1 used a flat collection structure (`Memory_{SanitizedUserId}`, `Memory_public`, `Memory_{spaceId}`) with no standardized relationship between source and published memories. v2 introduces a three-tier structure with referential integrity, requiring existing data to be reorganized.

---

## V1 → V2 Collection Mapping

| V1 | V2 | Notes |
|----|-----|-------|
| `Memory_{SanitizedUserId}` | `Memory_users_{literalUserId}` | Uses literal userId (no sanitization) + adds tracking arrays |
| `Memory_public` | `Memory_spaces_public` | Rename + composite IDs + revision fields |
| `Memory_{spaceId}` (per-space) | `Memory_spaces_public` (merged) | Merge into single collection |
| _(none)_ | `Memory_groups_{groupId}` | New, no data to migrate |

**Key change**: V2 drops `sanitizeUserId()` — collection names use the literal userId. The migration script resolves the original userId by reading `user_id` from documents inside each v1 collection.

## V1 → V2 Property Renames

| V1 Property | V2 Property | Action |
|-------------|------------|--------|
| `type` | `content_type` | Rename during migration |
| `trust` | `trust_score` | Rename during migration |
| `location_gps_lat` | `location_lat` | Rename during migration |
| `location_gps_lng` | `location_lon` | Rename during migration |
| `relationships` | `relationship_ids` | Rename during migration |
| `memory_ids` | `related_memory_ids` | Rename during migration |

## Schema Reconciliation

The v2 schema (`src/schema/v2-collections.ts`) is a **superset** of v1 — it includes both v1 and v2 property names in `COMMON_MEMORY_PROPERTIES`. This ensures:
- No data loss during migration
- No tool breakage during the hybrid period
- Both old and new data can coexist in v2 collections

Properties added for v1 compatibility: `title`, `summary`, `type`, `trust`, `base_weight`, `computed_weight`, `confidence`, `location_gps_lat`, `location_gps_lng`, `location_address`, `location_city`, `location_country`, `location_source`, `locale_language`, `locale_timezone`, `context_summary`, `context_timestamp`, `relationships`, `memory_ids`, `access_count`, `last_accessed_at`, `references`, `template_id`, `strength`.

---

## Migration Script

**File**: `scripts/migrate-v1-to-v2.ts`

### CLI Interface
```
npx tsx scripts/migrate-v1-to-v2.ts [options]
  --dry-run         Preview changes without writing
  --skip-backup     Skip backup step (if already backed up)
  --verify-only     Only run verification checks
  --batch-size N    Documents per batch (default: 100)
```

### State File
`.v1-to-v2-migration-state.yaml` — YAML state file for resumability. Created on first run, cleaned up on success.

### Migration Steps

1. **Discover** — List all `Memory_*` collections, classify as user/public/space by inspecting document properties
2. **Backup** — Create `Backup_Memory_*` copies of each collection (preserves vectors and UUIDs)
3. **Create v2 collections** — `Memory_users_*`, `Memory_spaces_public` using v2 schema from `v2-collections.ts`
4. **Copy user memories** — For each `Memory_{SanitizedUserId}`:
   - Read first document to get literal `user_id` property
   - Create `Memory_users_{literalUserId}` (using v2 schema)
   - Copy all documents with vectors, renaming v1→v2 properties
   - Add `space_ids: []`, `group_ids: []`
5. **Copy/merge published memories** — For `Memory_public` and each `Memory_{spaceId}`:
   - Copy all documents with vectors to `Memory_spaces_public`
   - Generate composite ID: `{author_id}.{originalUUID}`
   - Set `space_ids` from existing `spaces` field or `[spaceId]`
   - Add revision fields: `revision_count: 0`, `revised_at: null`
6. **Backfill tracking arrays** — For each composite ID in spaces, update source user memory's `space_ids`
7. **Verify** — Document count match, composite ID format check, tracking array consistency

---

## Code Switch

After migration, the codebase switches from v1 to v2 naming:

| File | Change |
|------|--------|
| `src/weaviate/client.ts` | `getMemoryCollectionName()` → returns `Memory_users_${userId}` (literal, no sanitization) |
| `src/weaviate/client.ts` | `sanitizeUserId()` deprecated (kept for migration script only) |
| `src/weaviate/client.ts` | `ALL_MEMORY_PROPERTIES` includes both v1 and v2 names |
| `src/weaviate/schema.ts` | `createMemoryCollection()` uses v2 schema from `v2-collections.ts` |
| `src/weaviate/space-schema.ts` | `PUBLIC_COLLECTION_NAME` → `'Memory_spaces_public'` |
| `src/weaviate/space-schema.ts` | `ensurePublicCollection()` uses v2 schema |
| Tool files | `type`→`content_type`, `trust`→`trust_score`, `relationships`→`relationship_ids`, `memory_ids`→`related_memory_ids` |

---

## Execution Order

### Phase 1: Pre-Migration Prep (no downtime)
1. Schema reconciliation (v2-collections.ts includes all v1 properties)
2. Build migration script
3. Run unit tests to verify schema changes don't break existing tests
4. Run `--dry-run` against production to preview

### Phase 2: Data Migration (brief maintenance window)
1. Run migration script: backup → create v2 → copy data → verify
2. V1 collections are NEVER modified (safe rollback)

### Phase 3: Code Switch (deploy)
1. Apply code changes (collection names, property renames)
2. Run full test suite
3. Deploy

### Phase 4: Cleanup (post-verification)
1. Verify production functionality manually
2. Delete v1 collections
3. Delete backup collections

---

## Rollback Strategy

- **Phase 2 failure**: Delete partially-created v2 collections. V1 untouched.
- **Phase 3 failure**: `git revert` code changes, redeploy. V1 collections still exist.
- **Catastrophic**: Restore from `Backup_Memory_*` copies.

**Key safety**: V1 collections are never modified or deleted until Phase 4 (after full verification).

---

## Verification

- `npm test` — all unit tests pass after schema reconciliation + code switch
- `npm run test:e2e` — all E2E tests pass
- Migration script `--verify-only`: document count match, composite ID validity, tracking array consistency
- Manual smoke test: create, search, publish, search_space, revise against migrated data

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

- remember-mcp v3.8.0+ (v2 collection naming + property renames)
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
