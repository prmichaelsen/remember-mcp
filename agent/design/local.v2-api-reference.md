# Memory Collection Pattern v2 — API Reference

**Concept**: Complete API documentation for all v2 MCP tools
**Created**: 2026-02-27
**Status**: Implemented

---

## Overview

This document provides complete API reference for the 6 implemented tools and 2 proposed tools in Memory Collection Pattern v2. Each tool listing includes input schema, output format, error cases, and usage examples.

All tools operate on the three-tier collection structure:
- `Memory_users_{userId}` — Private user memories (simple IDs)
- `Memory_spaces_public` — All public space memories (composite IDs)
- `Memory_groups_{groupId}` — Group memories (composite IDs)

---

## Tools

### remember_create_memory

Creates a new memory in the user's personal collection.

**Input Schema**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `content` | string | Yes | — | Memory content (MUST be exact user-provided text) |
| `title` | string | No | — | Short title |
| `type` | string | No | `"note"` | Content type (note, event, person, recipe, etc.) |
| `weight` | number | No | `0.5` | Significance/priority (0-1) |
| `trust` | number | No | `0.5` | Access control level (0-1) |
| `tags` | string[] | No | `[]` | Tags for organization |
| `references` | string[] | No | `[]` | Source URLs |
| `template_id` | string | No | — | Template ID to use |
| `skip_template_suggestion` | boolean | No | `false` | Skip template suggestion |
| `parent_id` | string | No | `null` | Parent memory ID for threading |
| `thread_root_id` | string | No | `null` | Root memory ID for thread |
| `moderation_flags` | string[] | No | `[]` | Format: `"{space_id}:{flag_type}"` |

**v2 Behavior**: New memories are initialized with empty tracking arrays (`space_ids: []`, `group_ids: []`). These arrays are managed exclusively by `remember_publish` and `remember_retract`.

**Output**:
```json
{
  "memory_id": "generated-uuid",
  "created_at": "2026-02-27T12:34:56.000Z",
  "message": "Memory created successfully with ID: generated-uuid"
}
```

**Example**:
```
remember_create_memory({
  content: "Grandma's famous pasta recipe with secret ingredient",
  type: "recipe",
  tags: ["cooking", "family"],
  weight: 0.8
})
```

---

### remember_update_memory

Updates an existing memory with partial updates. Version incremented automatically.

**Input Schema**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `memory_id` | string | Yes | — | ID of memory to update |
| `content` | string | No | — | Updated content |
| `title` | string | No | — | Updated title |
| `type` | string | No | — | Updated content type |
| `weight` | number | No | — | Updated significance (0-1) |
| `trust` | number | No | — | Updated access level (0-1) |
| `tags` | string[] | No | — | Updated tags (replaces existing) |
| `references` | string[] | No | — | Updated URLs (replaces existing) |
| `structured_content` | object | No | — | Updated structured content |
| `parent_id` | string | No | — | Updated parent ID |
| `thread_root_id` | string | No | — | Updated thread root ID |
| `moderation_flags` | string[] | No | — | Updated moderation flags |

**v2 Behavior**: `space_ids` and `group_ids` are intentionally NOT exposed — managed exclusively by `remember_publish`/`remember_retract`. Existing tracking arrays are preserved on update via spread.

**Output**:
```json
{
  "memory_id": "memory-id",
  "updated_at": "2026-02-27T12:34:56.000Z",
  "version": 2,
  "updated_fields": ["content", "title"],
  "message": "Memory updated successfully. Updated fields: content, title"
}
```

**Validation**:
- Memory must exist and be owned by user
- Memory must not be soft-deleted
- At least one field must be provided
- Content type, weight, trust validated if provided

**Error Cases**:
- `Memory not found` — Invalid memory_id
- `Ownership verification failed` — User doesn't own this memory
- `Memory is soft-deleted` — Cannot update deleted memories
- `Invalid content type` — Unrecognized content type
- `No fields provided` — Must update at least one field

---

### remember_publish

Publishes a memory to one or more shared spaces and/or groups. Uses two-phase confirmation flow.

**Input Schema**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `memory_id` | string | Yes | — | ID of memory from personal collection |
| `spaces` | string[] | No | `["the_void"]` | Spaces to publish to (must be in SUPPORTED_SPACES) |
| `groups` | string[] | No | `[]` | Group IDs to publish to |
| `additional_tags` | string[] | No | `[]` | Extra tags for discovery |

**Confirmation Flow**: Returns a token that must be confirmed via `remember_confirm` before the publish executes.

**Output** (token generation):
```json
{
  "success": true,
  "token": "<confirmation_token>"
}
```

**What happens on confirmation**:
1. Memory is COPIED (not moved) from `Memory_users_{userId}` to target collections
2. Composite ID `{userId}.{memoryId}` is generated for published copies
3. Source memory's `space_ids` and `group_ids` arrays are updated
4. `published_at` timestamp is set on copies

**Validation**:
- At least one destination (space or group) required
- Space IDs must be in SUPPORTED_SPACES enum
- Group IDs must not contain dots or be empty
- Memory must exist and be owned by user
- Only memories (not relationships) can be published

**Error Cases**:
- `No destinations provided` — Both spaces and groups are empty
- `Invalid space IDs` — Not in SUPPORTED_SPACES
- `Invalid group IDs` — Contains dots or whitespace
- `Memory not found` — Invalid memory_id
- `Ownership verification failed` — User doesn't own this memory

**Example**:
```
remember_publish({
  memory_id: "my-recipe",
  spaces: ["cooking", "recipes"],
  groups: ["foodie-group"],
  additional_tags: ["pasta", "italian"]
})
```

---

### remember_retract

Retracts a memory from specific spaces and/or groups. Uses two-phase confirmation flow with orphan strategy.

**Input Schema**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `memory_id` | string | Yes | — | ID of memory to retract |
| `spaces` | string[] | No | `[]` | Spaces to retract from |
| `groups` | string[] | No | `[]` | Group IDs to retract from |

**Orphan Strategy**: Retracted memories remain in target collections with cleared tracking arrays. They are kept for historical reference (e.g., if other users commented on them).

**Output** (token generation):
```json
{
  "success": true,
  "message": "Retraction request created. Please confirm to proceed.",
  "action": "retract_memory",
  "memory_id": "my-recipe",
  "destinations": "spaces: cooking, recipes; groups: foodie-group",
  "retraction_details": {
    "spaces": {
      "action": "orphan",
      "description": "Memory will remain in Memory_spaces_public with updated tracking arrays",
      "spaces": ["cooking", "recipes"]
    },
    "groups": {
      "action": "orphan",
      "description": "Memory will remain in Memory_groups_{groupId} with updated tracking arrays",
      "groups": ["foodie-group"]
    }
  },
  "confirmation_required": true
}
```

**What happens on confirmation**:
1. Published copy's `space_ids`/`group_ids` arrays are updated (retracted spaces/groups removed)
2. Source memory's tracking arrays are updated
3. Published copies remain in collections (orphaned, not deleted)

**Validation**:
- At least one destination required
- Group IDs must not contain dots
- Memory must exist and be owned by user
- Memory must be currently published to specified destinations

**Example**:
```
remember_retract({
  memory_id: "my-recipe",
  spaces: ["cooking"]
})
```

---

### remember_revise

Syncs updated content from source memory to all published copies. Uses two-phase confirmation flow.

**Input Schema**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `memory_id` | string | Yes | — | ID of source memory to sync |

**Confirmation Flow**: Returns a token that must be confirmed via `remember_confirm` before the revision executes.

**Output** (token generation):
```json
{
  "success": true,
  "token": "<confirmation_token>",
  "message": "Revision request created. Please confirm to sync content to all published copies.",
  "action": "revise_memory",
  "memory_id": "my-recipe",
  "destinations": "spaces: cooking, recipes; groups: foodie-group",
  "revision_details": {
    "space_ids": ["cooking", "recipes"],
    "group_ids": ["foodie-group"],
    "total_locations": 2
  },
  "confirmation_required": true
}
```

**Output** (after confirmation):
```json
{
  "success": true,
  "composite_id": "user123.my-recipe",
  "revised_at": "2026-02-27T12:34:56.000Z",
  "summary": {
    "total": 2,
    "success": 2,
    "failed": 0,
    "skipped": 0
  },
  "results": [
    { "location": "Memory_spaces_public", "status": "success" },
    { "location": "Memory_groups_foodie-group", "status": "success" }
  ]
}
```

**Revision History**: Previous content is preserved in `revision_history` (max 10 entries). Each entry contains `{ content: string, revised_at: string }`.

**What happens on confirmation**:
1. Fetches source memory from `Memory_users_{userId}`
2. For each space in `space_ids` → updates `Memory_spaces_public`
3. For each group in `group_ids` → updates `Memory_groups_{groupId}`
4. Each update: old content → `revision_history`, `revision_count++`, `revised_at` set

**Validation**:
- Source memory must exist and be owned by user
- Memory must be published to at least one location

**Supports partial success** — some locations may fail while others succeed.

**Example** (typical workflow):
```
// 1. Update source memory
remember_update_memory({
  memory_id: "my-recipe",
  content: "Updated recipe with new secret ingredient"
})

// 2. Request revision (generates token)
remember_revise({ memory_id: "my-recipe" })
// → { success: true, token: "tok_xyz", ... }

// 3. Confirm revision
remember_confirm({ token: "tok_xyz" })
// → { success: true, summary: { total: 2, success: 2, ... } }
```

---

### remember_search_space

Searches shared spaces and/or groups to discover memories from other users.

**Input Schema**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search query |
| `spaces` | string[] | No | — | Spaces to search (omit for all-public) |
| `groups` | string[] | No | — | Group IDs to search |
| `search_type` | enum | No | `"hybrid"` | `"hybrid"`, `"bm25"`, or `"semantic"` |
| `content_type` | string | No | — | Filter by content type |
| `tags` | string[] | No | — | Filter by tags (AND semantics) |
| `min_weight` | number | No | — | Minimum significance (0-1) |
| `max_weight` | number | No | — | Maximum significance (0-1) |
| `date_from` | string | No | — | ISO 8601 minimum date |
| `date_to` | string | No | — | ISO 8601 maximum date |
| `include_comments` | boolean | No | `false` | Include comments in results |
| `limit` | number | No | `10` | Max results |
| `offset` | number | No | `0` | Pagination offset |

**Search Behavior**:
- If `spaces` provided → searches `Memory_spaces_public` filtered by `space_ids.containsAny()`
- If `groups` provided → searches each `Memory_groups_{groupId}` separately
- If neither → searches all of `Memory_spaces_public` (all-public fallback)
- Results are merged, deduplicated by UUID, and sorted by relevance score

**Search Types**:
- `hybrid` — Combined BM25 keyword + semantic vector search (default, recommended)
- `bm25` — Keyword-only search
- `semantic` — Vector-only search via `nearText()`

**Base Filters** (always applied):
- Excludes soft-deleted memories (`deleted_at IS NULL`)
- Only returns memories (`doc_type = 'memory'`)
- Excludes comments unless `include_comments: true`

**Output**:
```json
{
  "spaces_searched": ["cooking", "recipes"],
  "groups_searched": ["foodie-group"],
  "query": "pasta recipe",
  "search_type": "hybrid",
  "memories": [
    {
      "id": "user123.my-recipe",
      "content": "Grandma's famous pasta recipe...",
      "title": "Secret Pasta",
      "weight": 0.8,
      "_score": 0.95
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 10
}
```

**Example**:
```
// Search specific space
remember_search_space({
  query: "pasta recipe",
  spaces: ["cooking"],
  search_type: "hybrid",
  tags: ["italian"],
  limit: 20
})

// Search group
remember_search_space({
  query: "meeting notes",
  groups: ["team-alpha"]
})

// Search all public memories
remember_search_space({
  query: "hiking trails"
})
```

---

### remember_sync *(Proposed)*

Detects conflicts between a source memory and its published copies. Call before `remember_revise` in shared-editing contexts to check for divergent content.

**Status**: Proposal — depends on shared write permission system (M7 Trust & Permissions)

**Input Schema**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `memory_id` | string | Yes | — | Source memory ID from personal collection |
| `location` | string | No | — | Specific location to sync (omit for all published locations) |

**Output — Clean** (no conflicts):
```json
{
  "status": "clean",
  "message": "Published copies are in sync. Safe to remember_revise.",
  "locations_checked": 3
}
```

**Output — Conflict detected**:
```json
{
  "status": "conflict",
  "message": "Published copy has been modified since your last revision.",
  "conflicts": [
    {
      "location": "Memory_spaces_public",
      "local_content": "Your version...",
      "remote_content": "Published version (modified by user456)...",
      "local_updated_at": "2026-02-27T10:00:00Z",
      "remote_revised_at": "2026-02-27T11:30:00Z",
      "remote_revised_by": "user456"
    }
  ],
  "merge_options": ["keep_local", "keep_remote", "manual"]
}
```

**Conflict Detection Logic**:
- If published `revised_at` > source `updated_at` → **CONFLICT** (someone else revised the published copy)
- If source content === published content → **CLEAN** (already in sync)
- If source `updated_at` > published `revised_at` and content differs → **CLEAN** (user's own changes pending)

**Merge Strategies**:
- `keep_local` — Use source memory content, discard remote changes, then call `remember_revise`
- `keep_remote` — Update source memory from published copy content (no revise needed)
- `manual` — User edits source memory to reconcile, then calls `remember_revise`

**Validation**:
- Source memory must exist and be owned by user
- Memory must be published to at least one location

**Error Cases**:
- `Memory not found` — Invalid memory_id
- `Ownership verification failed` — User doesn't own this memory
- `Not published` — Memory has no published copies to sync

**Example**:
```
// Check for conflicts before revising
remember_sync({ memory_id: "my-recipe" })
// → { status: "clean", locations_checked: 2 }

// Safe to revise
remember_revise({ memory_id: "my-recipe" })

// Or if conflict detected:
remember_sync({ memory_id: "my-recipe" })
// → { status: "conflict", conflicts: [...], merge_options: [...] }
// User resolves conflict, then revises
```

---

### remember_overwrite *(Proposed)*

Force-replaces published copies with source memory content, bypassing conflict detection. Requires overwrite permission on the target document. Uses two-phase confirmation flow.

**Status**: Proposal — depends on shared write permission system (M7 Trust & Permissions)

**Input Schema**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `memory_id` | string | Yes | — | Source memory ID from personal collection |
| `locations` | object | No | — | Specific locations to overwrite (omit for all) |
| `locations.spaces` | string[] | No | — | Spaces to overwrite |
| `locations.groups` | string[] | No | — | Groups to overwrite |

**Confirmation Flow**: Returns a token that must be confirmed via `remember_confirm` before the overwrite executes.

**Output** (token generation):
```json
{
  "success": true,
  "token": "<confirmation_token>",
  "message": "Overwrite request created. This will replace published content unconditionally.",
  "action": "overwrite_memory",
  "memory_id": "my-recipe",
  "warning": "This will discard any remote changes made by other users.",
  "confirmation_required": true
}
```

**What happens on confirmation**:
1. Source memory content replaces published copy content unconditionally
2. Old published content preserved in `revision_history` (max 10 entries)
3. `revision_count` incremented, `revised_at` updated
4. `last_revised_by` set to overwriting user's ID

**Permission Model**: Overwrite permission is a document-level flag. Only the original author or users with explicit overwrite access can use this tool.

**Validation**:
- Source memory must exist and be owned by user
- Memory must be published to at least one location
- User must have overwrite permission on the target document

**Error Cases**:
- `Memory not found` — Invalid memory_id
- `Ownership verification failed` — User doesn't own this memory
- `Not published` — Memory has no published copies
- `Permission denied` — User lacks overwrite permission on target

**Example**:
```
// Force-replace all published copies
remember_overwrite({ memory_id: "my-recipe" })
// → { success: true, token: "tok_xyz", warning: "..." }

remember_confirm({ token: "tok_xyz" })
// → Published copies replaced unconditionally

// Overwrite specific locations only
remember_overwrite({
  memory_id: "my-recipe",
  locations: { spaces: ["cooking"] }
})
```

---

## Utility Modules

### Composite IDs (`src/collections/composite-ids.ts`)

Format: `{userId}.{memoryId}` (e.g., `user123.my-recipe`)

| Function | Signature | Description |
|----------|-----------|-------------|
| `generateCompositeId` | `(userId, memoryId) → string` | Creates composite ID |
| `parseCompositeId` | `(compositeId) → { userId, memoryId }` | Splits into components |
| `isCompositeId` | `(id) → boolean` | Checks format validity |
| `belongsToUser` | `(compositeId, userId) → boolean` | Ownership check |
| `getUserIdFromComposite` | `(compositeId) → string` | Extracts userId |
| `getMemoryIdFromComposite` | `(compositeId) → string` | Extracts memoryId |

Constraints: No dots allowed in userId or memoryId components.

### Tracking Arrays (`src/collections/tracking-arrays.ts`)

All functions are immutable (return new objects).

| Function | Signature | Description |
|----------|-----------|-------------|
| `addToSpaceIds` | `(memory, spaceId) → memory` | Add space (deduped) |
| `removeFromSpaceIds` | `(memory, spaceId) → memory` | Remove space |
| `addToGroupIds` | `(memory, groupId) → memory` | Add group (deduped) |
| `removeFromGroupIds` | `(memory, groupId) → memory` | Remove group |
| `addMultipleSpaceIds` | `(memory, spaceIds[]) → memory` | Bulk add (O(n+m) Set) |
| `addMultipleGroupIds` | `(memory, groupIds[]) → memory` | Bulk add (O(n+m) Set) |
| `isPublished` | `(memory) → boolean` | Any publications? |
| `isPublishedToSpace` | `(memory, spaceId) → boolean` | Published to space? |
| `isPublishedToGroup` | `(memory, groupId) → boolean` | Published to group? |
| `getPublishedLocations` | `(memory) → { spaces, groups }` | All locations |
| `getPublishedCount` | `(memory) → number` | Total count |
| `initializeTracking` | `(memory) → memory` | Ensure arrays exist |

### Dot Notation (`src/collections/dot-notation.ts`)

| Function | Signature | Description |
|----------|-----------|-------------|
| `getCollectionName` | `(type, id?) → string` | Build collection name |
| `parseCollectionName` | `(name) → { type, id, name }` | Parse collection name |
| `validateCollectionName` | `(name) → boolean` | Validate format |
| `isUserCollection` | `(name) → boolean` | Is `Memory_users_*`? |
| `isSpacesCollection` | `(name) → boolean` | Is `Memory_spaces_public`? |
| `isGroupCollection` | `(name) → boolean` | Is `Memory_groups_*`? |

Collection types: `USERS`, `SPACES`, `GROUPS`

---

---

## Upcoming: Memory-Level ACL Fields

Four new fields will be added to `PUBLISHED_MEMORY_PROPERTIES` to support collaborative editing and group-based permissions:

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `write_mode` | text | `null` (→ `"owner_only"`) | Controls who can revise: `"owner_only"` / `"group_editors"` / `"anyone"` |
| `overwrite_allowed_ids` | text[] | `[]` | Per-memory explicit overwrite grants (user IDs) |
| `last_revised_by` | text | `null` | User ID of last reviser — enables conflict detection |
| `owner_id` | text | `null` (→ `author_id`) | Supports ownership transfer |

All fields are nullable with zero-migration deployment. Existing memories continue to work unchanged (`write_mode: null` → `"owner_only"` semantics).

**Impact on existing tools**:
- `remember_publish` — can optionally set `write_mode` and `owner_id`
- `remember_revise` — sets `last_revised_by`, checks write permissions
- `remember_overwrite` — checks overwrite permissions via `overwrite_allowed_ids` and group credentials
- `remember_sync` — uses `last_revised_by` for conflict detection

See [Memory ACL Schema](local.memory-acl-schema.md) for full specification.

---

**Status**: Implemented (v3.1.0–v3.7.0), with 2 proposed tools (remember_sync, remember_overwrite)
**Recommendation**: Reference this document when integrating with remember-mcp v2 tools
**Related Documents**:
- [Memory Collection Pattern v2](local.memory-collection-pattern-v2.md) — Architecture and design rationale
- [Collaborative Memory Sync](local.collaborative-memory-sync.md) — Design proposal for remember_sync and remember_overwrite
- [Memory ACL Schema](local.memory-acl-schema.md) — Memory-level access control fields and permission resolution
