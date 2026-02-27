# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.10.0] - 2026-02-27

### Added

**Moderation System & Per-Space Configuration (M15)**

- `remember_moderate` tool — approve, reject, or remove published memories (requires `can_moderate` permission)
- `moderation_status`, `moderated_by`, `moderated_at` schema fields on published memory collections
- `can_moderate` permission added to `GroupPermissions` type
- Per-space/group configuration via Firestore (`SpaceConfig` service with `require_moderation` and `default_write_mode`)
- Publish flow sets `moderation_status` based on space/group `require_moderation` config
- `moderation_filter` parameter on `remember_search_space` and `remember_query_space` tools (default: `approved`)
- `canModerate` and `canModerateAny` auth helper utilities
- 20 MCP tools total (was 19)
- 32 new tests (281 total: 280 passed, 1 skipped)

## [3.9.0] - 2026-02-27

### Added

**Auth Context & Credentials Provider Foundations**

- `src/types/auth.ts` — `AuthContext`, `UserCredentials`, `GroupMembership`, `GroupPermissions`, `CredentialsProvider`, `WriteMode` types
- `src/services/credentials-provider.ts` — `StubCredentialsProvider` with `createCredentialsProvider()` factory and singleton export
- 4 ACL schema fields on `PUBLISHED_MEMORY_PROPERTIES`: `write_mode`, `owner_id`, `overwrite_allowed_ids`, `last_revised_by`
- `authContext?: AuthContext` parameter threaded through all 19 tool handler signatures
- `server-factory.ts` resolves credentials per request and passes `AuthContext` to all handlers
- `server.ts` passes null `AuthContext` in standalone mode
- 3 new tests for `StubCredentialsProvider` (236 total: 235 passed, 1 skipped)

## [3.8.0] - 2026-02-27

### Changed

**V1 → V2 Collection Migration & Code Switch**

- Collection naming switched to v2 dot-notation: `Memory_{SanitizedUserId}` → `Memory_users_{userId}`, `Memory_public` → `Memory_spaces_public`
- Drop `sanitizeUserId()` — collection names now use literal userId
- Property renames across all tool files: `type` → `content_type`, `trust` → `trust_score`, `relationships` → `relationship_ids`, `memory_ids` → `related_memory_ids`, `location_gps_lat/lng` → `location_lat/lon`
- `createMemoryCollection()` and `ensurePublicCollection()` now use v2 schema from `v2-collections.ts`
- `ALL_MEMORY_PROPERTIES` updated to include both v1 and v2 property names for backward compatibility

### Added

- `scripts/migrate-v1-to-v2.ts` — CLI migration script with `--dry-run`, `--skip-backup`, `--verify-only`, `--batch-size` flags and YAML state file for resumability
- Schema reconciliation: 25+ missing v1 properties added to `COMMON_MEMORY_PROPERTIES` in `v2-collections.ts` (superset strategy)
- Migration convenience scripts in `scripts/package.json`

### Fixed

- `RelevantMemory` interface now includes `content_type` property
- `search-space.spec.ts` filter expectations updated for v2 property names

---

## [3.7.1] - 2026-02-27

### Fixed

**v2 Schema Weaviate Cloud Compatibility**

- Remove reserved `id` property from `COMMON_MEMORY_PROPERTIES` — Weaviate reserves `id` for UUID primary key
- Change `vectorizer` to `vectorizers` (plural) in all schema creation functions — required by `client.collections.create()` v3 API
- Replace `'text' as any` data type casts with `configure.dataType.TEXT` (and corresponding typed variants) throughout schema definitions
- Update `jest.e2e.config.js` to ESM format matching unit test config

### Added

- `src/v2-smoke.e2e.ts` — E2E smoke test validating full v2 flow against live Weaviate (connect → create collections → publish → search → revise)

---

## [3.7.0] - 2026-02-27

### Changed

**remember_revise: Added Confirmation Flow**

`remember_revise` now uses the same two-phase confirmation flow as `remember_publish` and `remember_retract`.

- **Phase 1**: `remember_revise({ memory_id })` validates the request and returns a confirmation token
- **Phase 2**: `remember_confirm({ token })` executes the revision, syncing content to all published copies
- Revision logic moved from `revise.ts` to `executeReviseMemory()` in `confirm.ts`
- New action type: `revise_memory` handled by `remember_confirm`
- Token response includes destination summary (`space_ids`, `group_ids`, `total_locations`)
- All existing revision behavior preserved (revision_history, revised_at, partial success)

### Added

**Documentation (Task 173)**

- `agent/design/local.v2-api-reference.md` — Complete API docs for all 6 v2 tools
- `agent/design/local.v2-migration-guide.md` — v1 → v2 migration guide
- `agent/design/local.v2-usage-examples.md` — Real-world usage patterns and examples
- Updated `README.md` with v2 architecture, 18 tools, v2 tool listing
- Updated `agent/design/local.memory-collection-pattern-v2.md` status to Implemented

---

## [3.6.0] - 2026-02-27

### Added

**Memory Collection Pattern v2 - Tracking Array Initialization (Task 170)**

New memories now initialize `space_ids` and `group_ids` arrays, enabling publication tracking from the moment of creation.

- **`space_ids: []`** initialized on every new memory (managed by `remember_publish` / `remember_retract`)
- **`group_ids: []`** initialized on every new memory (managed by `remember_publish` / `remember_retract`)
- **`Memory` interface**: Added `space_ids?: string[]` and `group_ids?: string[]` fields to `src/types/memory.ts`
- **`remember_update_memory`**: Tracking arrays preserved via spread pattern; explicitly excluded from `UpdateMemoryArgs` to prevent direct modification
- **Unit Tests** ([`src/tools/create-memory.spec.ts`](src/tools/create-memory.spec.ts))
  - 19 new tests: `createMemoryTool` schema (8) + `updateMemoryTool` schema (11)
  - Asserts `space_ids`/`group_ids` are not user-settable via either tool's input schema
  - Total: 198 tests passing (197 passing, 1 skipped)

## [3.5.0] - 2026-02-27

### Changed

**Memory Collection Pattern v2 - remember_search_space Updated (Task 169)**

`remember_search_space` now targets the v2 collection architecture, adds group search support, and introduces `search_type` selection.

- **Collection target**: `Memory_public` → `Memory_spaces_public` (via `getCollectionName(CollectionType.SPACES)`)
- **Field filter**: `spaces` property → `space_ids.containsAny()` (matches v2 published memory schema)
- **`spaces` parameter**: No longer required — omit to search all public memories
- **`groups` parameter** (new): Array of group IDs — queries `Memory_groups_{groupId}` for each
- **`search_type` parameter** (new): `"hybrid"` (default) | `"bm25"` (keyword) | `"semantic"` (vector)
- **All-public search**: When neither `spaces` nor `groups` is provided, queries all of `Memory_spaces_public`
- **Multi-source merge**: Results from spaces + groups combined, deduplicated by UUID, sorted by score descending
- **Soft-delete aware**: Added `deleted_at isNull(true)` filter to all queries (requires `indexNullState: true`)
- **`buildBaseFilters()` helper**: Extracted as exported pure function for testability

### Added

- **Unit Tests** ([`src/tools/search-space.spec.ts`](src/tools/search-space.spec.ts))
  - 23 new tests: tool schema (9) + `buildBaseFilters` helper (14)
  - Total: 179 tests passing

---

## [3.4.0] - 2026-02-26

### Added

**Memory Collection Pattern v2 - remember_revise Tool (Task 168)**

Content synchronization for published memories — propagates source memory updates to all published copies.

- **`remember_revise` Tool** ([`src/tools/revise.ts`](src/tools/revise.ts))
  - Direct action tool (no confirmation flow — content sync is non-destructive)
  - Reads `space_ids` and `group_ids` tracking arrays from source memory
  - Updates content in `Memory_spaces_public` (one call for all spaces)
  - Updates content in each `Memory_groups_{groupId}` in sequence
  - Partial success: each location reported independently, failures don't block successes
  - Returns detailed `results` array with status per location

- **Revision History** ([`src/tools/revise.ts`](src/tools/revise.ts))
  - Old content saved to `revision_history` field (JSON string) before overwrite
  - Capped at 10 entries (`MAX_REVISION_HISTORY`)
  - `revised_at` timestamp set on each updated copy
  - `revision_count` incremented on each updated copy
  - `parseRevisionHistory()` and `buildRevisionHistory()` exported as pure helpers

- **Server Registration**
  - `remember_revise` tool registered in both `src/server.ts` and `src/server-factory.ts`

- **Unit Tests** ([`src/tools/revise.spec.ts`](src/tools/revise.spec.ts))
  - 19 new tests covering `parseRevisionHistory`, `buildRevisionHistory`, and tool definition
  - Total: 156 tests passing

---

## [3.3.0] - 2026-02-26

### Added

**Memory Collection Pattern v2 - remember_retract Tool (Task 167)**

Selective retraction of published memories from specific spaces and groups, with an orphan strategy that preserves historical data.

- **`remember_retract` Tool** ([`src/tools/retract.ts`](src/tools/retract.ts))
  - Retract a memory from specific spaces (e.g., `["cooking", "recipes"]`)
  - Retract a memory from specific groups (e.g., `["group-123"]`)
  - Selective retraction: retract from some destinations while remaining in others
  - Ownership validation: users can only retract their own memories
  - Publication validation: returns error if memory isn't published to the specified destination
  - Two-phase confirmation flow: generates token, user confirms to execute

- **Orphan Strategy** ([`src/tools/confirm.ts`](src/tools/confirm.ts) `executeRetractMemory()`)
  - Space memories: remain in `Memory_spaces_public` with `space_ids` array updated (orphaned if empty)
  - Group memories: remain in `Memory_groups_{groupId}` with `group_ids` array updated (orphaned if empty)
  - `retracted_at` timestamp set on orphaned memories
  - Source memory tracking arrays (`space_ids`, `group_ids`) updated on success
  - Partial success: failed retractions don't block successful ones

- **Server Registration**
  - `remember_retract` tool registered in both `src/server.ts` and `src/server-factory.ts`

---

## [3.2.0] - 2026-02-26

### Added

**Memory Collection Pattern v2 - remember_publish Tool (Task 166)**

Multi-space and multi-group publication with composite IDs and tracking arrays.

- **Multi-Space Publication** ([`src/tools/publish.ts`](src/tools/publish.ts), [`src/tools/confirm.ts`](src/tools/confirm.ts))
  - Publish memories to multiple spaces at once (e.g., `["cooking", "recipes"]`)
  - Publish memories to multiple groups at once (e.g., `["group-123", "group-456"]`)
  - Dual publication: publish to both spaces and groups simultaneously
  - Composite IDs (`{userId}.{memoryId}`) for published memories
  - Tracking arrays (`space_ids`, `group_ids`) on source and published memories
  - Partial success reporting with detailed results per destination
  - Error handling for each publication destination independently

- **Tool Schema Updates**
  - Added `groups` parameter to `remember_publish` tool
  - Validation for group IDs (no dots allowed)
  - Support for publishing to spaces only, groups only, or both

### Changed

- `executePublishMemory()` in confirm.ts completely rewritten for v2 architecture
- Publications now use composite IDs instead of random UUIDs
- Source memories updated with `space_ids` and `group_ids` tracking arrays

---

## [3.1.0] - 2026-02-26

### Added

**Memory Collection Pattern v2 - Core Infrastructure (Task 165)**

Foundation for multi-user social features including user profiles, friend systems, P2P conversations, and group conversations.

- **Dot Notation Collections** ([`src/collections/dot-notation.ts`](src/collections/dot-notation.ts))
  - `getCollectionName()` - Generate collection names (Memory_users_{userId}, Memory_spaces_public, Memory_groups_{groupId})
  - `parseCollectionName()` - Parse collection metadata from names
  - Collection type validation and ID validation (rejects dots in IDs)

- **Composite IDs** ([`src/collections/composite-ids.ts`](src/collections/composite-ids.ts))
  - `generateCompositeId()` - Create {userId}.{memoryId} format
  - `parseCompositeId()` - Extract components from composite IDs
  - `validateCompositeId()` - Validate and return true on success
  - `isCompositeId()`, `belongsToUser()` helper functions

- **Tracking Arrays** ([`src/collections/tracking-arrays.ts`](src/collections/tracking-arrays.ts))
  - Immutable array operations for `space_ids` and `group_ids`
  - `addToSpaceIds()`, `removeFromSpaceIds()`, `addToGroupIds()`, `removeFromGroupIds()`
  - Publication status checking (`isPublishedToSpace`, `isPublishedToGroup`, `getPublicationLocations`)
  - Batch operations for multiple spaces/groups

- **Weaviate Schema Definitions** ([`src/schema/v2-collections.ts`](src/schema/v2-collections.ts))
  - Schema creation for user, space, and group collections
  - Property lists and validation functions
  - Collection name validation and type detection

- **Unit Tests** ([`src/collections/core-infrastructure.spec.ts`](src/collections/core-infrastructure.spec.ts))
  - 44 tests covering all utilities
  - 79% coverage on new collections code
  - 97% coverage on tracking arrays

### Fixed

- Added ID validation to reject dots in user/group IDs in `getCollectionName()`
- Updated error message in `parseCompositeId()` to include "must be exactly 2 parts"
- Changed `validateCompositeId()` return type from `void` to `true`

---

## [3.0.1] - 2026-02-25

### Fixed

**CRITICAL: Fixed Weaviate Schema Configuration Bug**
- Added `indexNullState: true` to inverted index configuration in both schema files
- Enables filtering on null values (required for `deleted_at IS NULL` queries)
- Root cause: Soft delete system (v3.0.0) added `deleted_at` field but didn't configure null state indexing
- Impact: All memory searches were failing with gRPC error "Nullstate must be indexed to be filterable"
- Modified: [`src/weaviate/schema.ts`](src/weaviate/schema.ts) - Added `invertedIndex` config
- Modified: [`src/weaviate/space-schema.ts`](src/weaviate/space-schema.ts) - Added `invertedIndex` config

**Migration Required**:
- ⚠️ Existing Weaviate collections must be recreated to apply this fix
- Collections created before v3.0.1 will continue to fail on null filtering
- Delete old collections and restart server to create new collections with correct config
- Alternative: Export data, delete collections, restart, re-import data

**For Users**:
- If you encounter "Nullstate must be indexed" error, delete your collections and restart
- New collections will be created automatically with correct configuration
- Documents created before `deleted_at` field existed are handled correctly (missing field = null)

---

## [3.0.0] - 2026-02-25

### ⚠️ BREAKING CHANGES

**Soft Delete System with Confirmation Flow**

This release fundamentally changes how memory deletion works. All deletions now require explicit user confirmation and memories are soft-deleted (marked as deleted) rather than permanently removed.

**What Changed**:

1. **`remember_delete_memory` Behavior Change**
   - **OLD**: Immediately deletes memory from database
   - **NEW**: Creates confirmation token and returns preview
   - **Migration**: No code changes needed, but behavior is different

2. **Search Tools Default Behavior**
   - **OLD**: Searches include all memories
   - **NEW**: Searches exclude deleted memories by default
   - **Migration**: Use `deleted_filter: "include"` to see deleted memories

3. **Relationship Creation**
   - **OLD**: Can create relationships with any memory
   - **NEW**: Cannot create relationships with deleted memories
   - **Migration**: Restore deleted memories before creating relationships

4. **Memory Updates**
   - **OLD**: Can update any memory
   - **NEW**: Cannot update deleted memories
   - **Migration**: Deleted memories must be restored first (future feature)

### Added

**Soft Delete System**:
- Added 3 schema fields: `deleted_at` (timestamp), `deleted_by` (user ID), `deletion_reason` (text)
- Added confirmation flow for deletion (reuses existing token service)
- Added deletion preview showing content, type, relationship count, orphaned relationships
- Added `deleted_filter` parameter to all search tools: `remember_search_memory`, `remember_query_memory`, `remember_find_similar`, `remember_search_relationship`
- Added validation to prevent creating relationships with deleted memories
- Added validation to prevent updating deleted memories

**deleted_filter Parameter**:
- `"exclude"` (default) - Hide deleted memories from search results
- `"include"` - Show all memories (deleted + active)
- `"only"` - Show only deleted memories

### Changed

**Tool Behavior**:
- `remember_delete_memory` now returns confirmation token instead of immediately deleting
- `remember_confirm` now handles `delete_memory` action type
- All search tools now exclude deleted memories by default
- Error messages include deletion timestamps for better UX

**Data Model**:
- Memories are soft-deleted (remain in database with `deleted_at` set)
- Deleted memories can be searched with `deleted_filter: "include"` or `"only"`
- No data migration needed (missing `deleted_at` = not deleted)

### Migration Guide

**For Users**:
- Deletion now requires two steps: request → confirm
- Deleted memories are hidden by default in searches
- Use `deleted_filter: "include"` to search deleted memories

**For Developers**:
- No API changes required
- Behavior change is immediate (no feature flags)
- Version bump: v2.8.0 → v3.0.0 (major)

**Example Workflow**:
```typescript
// 1. Request deletion
const result = await remember_delete_memory({
  memory_id: "abc123",
  reason: "No longer needed"
});
// Returns: { token: "xyz789", preview: {...} }

// 2. User confirms
await remember_confirm({ token: "xyz789" });
// Returns: { success: true }

// 3. Memory is soft-deleted
await remember_search_memory({
  query: "test",
  deleted_filter: "only"
});
// Finds deleted memories
```

### Technical Details

**Implementation**:
- Modified: `src/weaviate/schema.ts` (added 3 fields to Memory schema)
- Modified: `src/weaviate/space-schema.ts` (added 3 fields to Memory_public)
- Modified: `src/types/memory.ts` (added DeletedFilter type, updated Memory interface)
- Modified: `src/types/space-memory.ts` (updated SpaceMemory interface)
- Modified: `src/weaviate/client.ts` (added fields to ALL_MEMORY_PROPERTIES)
- Modified: `src/tools/delete-memory.ts` (confirmation flow)
- Modified: `src/tools/confirm.ts` (delete_memory action handler)
- Modified: `src/tools/search-memory.ts` (deleted_filter parameter)
- Modified: `src/tools/query-memory.ts` (deleted_filter parameter)
- Modified: `src/tools/find-similar.ts` (deleted_filter parameter)
- Modified: `src/tools/search-relationship.ts` (deleted_filter parameter)
- Modified: `src/tools/create-relationship.ts` (deleted memory validation)
- Modified: `src/tools/update-memory.ts` (deleted memory validation)
- Modified: `src/utils/weaviate-filters.ts` (buildDeletedFilter helper)

**Tests**:
- 93 tests passing (1 skipped integration test)
- Test coverage: 33.12% overall
- All existing tests validate soft delete functionality

**Documentation**:
- Design: `agent/design/soft-delete-system.md`
- Clarification: `agent/clarifications/clarification-1-soft-delete-confirmation-flow.md`
- Milestone: `agent/milestones/milestone-13-soft-delete-system.md`
- Tasks: `agent/tasks/task-70-*.md` through `task-75-*.md`

### Future Enhancements

**Not in v3.0.0** (deferred to future releases):
- Memory restoration tool (`remember_restore_memory`)
- Permanent deletion (memories remain in database indefinitely)
- Auto-purge policies
- Shared space integration (`remember_retract` for unpublishing)

---

## [2.8.0] - 2026-02-25

### Added

- **Comprehensive Tool Debugging System**
  - Added `REMEMBER_MCP_DEBUG_LEVEL` environment variable for configurable debug logging
  - 6 debug levels: NONE (default), ERROR, WARN, INFO, DEBUG, TRACE
  - DebugLogger class with context propagation and performance timing
  - Parameter dumping at TRACE level for deep troubleshooting
  - Zero performance overhead when disabled (NONE level)
  - 12 unit tests with 100% coverage on debug utility

- **Debug Integration for Space Tools**
  - Integrated debug logging into `remember_publish` tool
  - Integrated debug logging into `remember_confirm` tool
  - Integrated debug logging into `remember_search_space` tool
  - Integrated debug logging into `remember_query_space` tool
  - Integrated debug logging into Weaviate client `fetchMemoryWithAllProperties()`

- **Debug Documentation**
  - Added debugging section to README.md with usage examples
  - Added `REMEMBER_MCP_DEBUG_LEVEL` to .env.example
  - Security warnings for TRACE level (may expose sensitive data)

### Fixed

- **CRITICAL: Fixed Published Memories Not Appearing in Search Results**
  - Added 8 missing space-related properties to `ALL_MEMORY_PROPERTIES` constant
  - Properties: `spaces`, `space_id`, `author_id`, `ghost_id`, `attribution`, `published_at`, `discovery_count`, `space_memory_id`
  - Root cause: Properties added to schema (v2.4.0) but not to fetch constant (v2.6.3)
  - Published memories now properly include all space fields
  - Search filtering by `spaces` array now works correctly
  - Memories now discoverable in The Void and other shared spaces

### Technical Details

**Debug System**:
- Created: `src/utils/debug.ts` (147 lines)
- Created: `src/utils/debug.spec.ts` (12 tests)
- Modified: `src/config.ts` (added DebugLevel enum and debugConfig)
- Modified: 5 tool files with debug logging integration

**Bug Fix**:
- Modified: `src/weaviate/client.ts` (lines 200-217)
- Added 8 properties to `ALL_MEMORY_PROPERTIES` constant
- Ensures complete property fetching during publish workflow

### Impact

**Debug System**:
- Developers can now enable detailed tracing for troubleshooting
- Performance profiling available via timing measurements
- Production-safe with configurable verbosity
- Helps diagnose database operation issues

**Bug Fix**:
- All published memories since v2.4.0 now discoverable
- Space functionality fully operational
- User-reported issue resolved

---

## [2.7.10] - 2026-02-17
