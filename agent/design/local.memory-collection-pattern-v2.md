# Memory Collection Pattern v2

**Concept**: Breaking change to remember-mcp memory collections using dot notation and composite IDs for published memories
**Created**: 2026-02-25
**Status**: Design Specification

---

## Overview

This document describes the Memory Collection Pattern v2 for remember-mcp, a breaking change that introduces dot notation for memory collections (Memory.users, Memory.groups, Memory.spaces) and composite IDs for published memories. This redesign enables multi-user social features including user profiles, friend systems, P2P conversations, and group conversations.

The new pattern provides clear separation between private user memories, public space memories, and group memories, while maintaining referential integrity through composite IDs and tracking arrays.

---

## Problem Statement

The current memory collection pattern (Memory_{spaceId}) has several limitations:

1. **No User Distinction**: All memories in a space are mixed together with no clear ownership
2. **No Multi-Space Support**: Memories can't be published to multiple spaces simultaneously
3. **No Group Support**: No concept of private group memory spaces
4. **No Referential Integrity**: Published memories have new IDs, breaking references to source
5. **No Revision Tracking**: Can't update published memories without republishing with new ID

**Consequences**:
- Can't implement user profiles (need user-specific memories in public space)
- Can't implement friend systems (need relationship tracking)
- Can't implement P2P/group conversations (need shared private spaces)
- Can't revise published content (must retract and republish)
- Can't track where memories are published (no metadata)

---

## Solution

Introduce a three-tier memory collection structure with dot notation and composite IDs:

1. **Memory.users.{userId}** - Private user memories with simple IDs
2. **Memory.spaces.public** - All public space memories with composite IDs and space_ids array
3. **Memory.groups.{groupId}** - Group memories with composite IDs

**Key Innovations**:
- **Composite IDs**: {userId}.{memoryId} format preserves source reference
- **Tracking Arrays**: space_ids and group_ids track publication locations
- **Dual Publication**: Memories can exist in both spaces and groups
- **Revision Support**: remember_revise updates published memories in-place
- **Orphaned Memories**: Retracted memories remain for historical reference

---

## Implementation

### Collection Structure

**Memory.users.{userId}** - Private User Memories
```typescript
// Weaviate Collection
class: Memory_users_{userId}

// Document Structure
{
  id: string,  // Simple ID (auto-generated or user-chosen)
  content: string,
  content_type: string,  // "note", "profile", "person", etc.
  space_ids: string[],  // Where published: ["profiles", "the_void"]
  group_ids: string[],  // Where published: ["{groupId1}", "{groupId2}"]
  created_at: timestamp,
  updated_at: timestamp,
  // ... other fields
}
```

**Memory.spaces.public** - All Public Space Memories
```typescript
// Weaviate Collection (single collection for ALL spaces)
class: Memory_spaces_public

// Document Structure
{
  id: string,  // Composite ID: {userId}.{memoryId}
  content: string,
  content_type: string,
  space_ids: string[],  // Which spaces: ["the_void", "gaming"]
  group_ids: string[],  // Which groups (usually empty for space memories)
  published_at: timestamp,
  revised_at: timestamp | null,
  revision_history: string[],  // Previous content versions
  // ... other fields
}
```

**Memory.groups.{groupId}** - Group Memories
```typescript
// Weaviate Collection (separate collection per group)
class: Memory_groups_{groupId}

// Document Structure
{
  id: string,  // Composite ID: {userId}.{memoryId}
  content: string,
  content_type: string,
  space_ids: string[],  // Usually empty (unless also in spaces)
  group_ids: string[],  // Just this group: ["{groupId}"]
  published_at: timestamp,
  revised_at: timestamp | null,
  revision_history: string[],
  // ... other fields
}
```

### Composite ID Format

**Format**: `{userId}.{memoryId}`
- Separator: Dot (.)
- Example: `user123.my-recipe`, `user456.profile-abc123`
- Guarantees uniqueness across all users
- Preserves reference to source memory

**Generation**: Utility function in remember-mcp
```typescript
function generateCompositeId(userId: string, memoryId: string): string {
  return `${userId}.${memoryId}`
}
```

### Dual Publication Pattern

When memory is published to both spaces and groups:

```typescript
// Source
Memory.users.{userId}/my-recipe {
  content: "Recipe content",
  space_ids: ["cooking"],
  group_ids: ["{foodie-group}"]
}

// Published to space
Memory.spaces.public/{userId}.my-recipe {
  content: "Recipe content",
  space_ids: ["cooking"],
  group_ids: ["{foodie-group}"]
}

// Published to group
Memory.groups.{foodie-group}/{userId}.my-recipe {
  content: "Recipe content",
  space_ids: ["cooking"],  // Cross-reference
  group_ids: ["{foodie-group}"]
}
```

**Sync**: remember_revise updates all copies

### Tool Behavior

**remember_publish**:
```typescript
remember_publish({
  memory_id: "my-recipe",
  spaces: ["cooking", "recipes"],
  groups: ["{foodie-group}"]
})

// Creates/updates:
// 1. Memory.spaces.public/{userId}.my-recipe with space_ids=["cooking", "recipes"]
// 2. Memory.groups.{foodie-group}/{userId}.my-recipe
// 3. Updates Memory.users.{userId}/my-recipe with space_ids and group_ids
```

**remember_retract**:
```typescript
remember_retract({
  memory_id: "my-recipe",
  spaces: ["cooking"]
})

// Updates:
// 1. Memory.spaces.public/{userId}.my-recipe: space_ids=["recipes"] (removed "cooking")
// 2. Memory.users.{userId}/my-recipe: space_ids=["recipes"]
// If space_ids becomes empty, memory remains (orphaned)
```

**remember_revise**:
```typescript
// User updates source
remember_update_memory({ id: "my-recipe", content: "Updated recipe" })

// Revise all published versions
remember_revise({ memory_id: "my-recipe" })

// Updates:
// 1. Memory.spaces.public/{userId}.my-recipe: content updated, old added to revision_history
// 2. Memory.groups.{foodie-group}/{userId}.my-recipe: content updated
// 3. Both get revised_at timestamp
```

**remember_search_space**:
```typescript
// Search specific space
remember_search_space({
  query: "recipe",
  spaces: ["cooking"]
})
// Queries: Memory.spaces.public WHERE space_ids contains "cooking"

// Search specific group
remember_search_space({
  query: "recipe",
  groups: ["{foodie-group}"]
})
// Queries: Memory.groups.{foodie-group}

// Search all public
remember_search_space({
  query: "recipe"
})
// Queries: Memory.spaces.public (all memories)
```

---

## Benefits

- **User Ownership**: Composite IDs clearly indicate memory ownership
- **Multi-Space Publishing**: Single memory can be in multiple spaces via space_ids array
- **Referential Integrity**: Composite IDs maintain link to source memory
- **Revision Support**: remember_revise updates published memories in-place
- **Historical Preservation**: Orphaned memories remain accessible by reference
- **Group Privacy**: Separate Memory.groups.{groupId} collections for access control
- **Efficient Search**: Single Memory.spaces.public collection for all public spaces
- **Clear Semantics**: Dot notation makes collection purpose explicit

---

## Trade-offs

- **Breaking Change**: Requires migration of all existing memories
- **Storage Duplication**: Dual publication means 2x storage for space+group memories
- **Sync Complexity**: Must keep source and published copies in sync
- **Migration Complexity**: All-or-nothing migration with 11 separate steps
- **Orphaned Memories**: Retracted memories remain in database (storage cost)
- **Query Complexity**: remember_search_space must query multiple collections

**Mitigations**:
- Migration script with dry-run and backups
- Accept storage cost for query performance
- remember_revise handles sync automatically
- Orphaned memories are edge case (rare)
- Weaviate handles multi-collection queries efficiently

---

## Dependencies

- **Weaviate**: Vector database for memory storage and search
- **remember-mcp**: Memory management MCP server
- **agentbase.me**: Platform for user/group management
- **Migration Script**: remember-mcp/scripts/migrations/migrate-to-v2.ts

---

## Testing Strategy

**Unit Tests**:
- Composite ID generation
- space_ids and group_ids array manipulation
- remember_revise updates all copies
- remember_retract removes from arrays correctly

**Integration Tests**:
- Publish to multiple spaces
- Publish to spaces + groups (dual publication)
- Revise updates all published versions
- Retract from specific spaces/groups
- Search across spaces and groups

**Migration Tests**:
- Dry-run produces correct preview
- Migration creates backups
- All 11 migrations complete successfully
- Idempotency (safe to run twice)
- Rollback restores from backup

---

## Migration Path

### Pre-Migration

1. Create backup in Weaviate (Backup_ prefix for all collections)
2. Run dry-run to preview changes
3. Verify backup completeness
4. Schedule maintenance window

### Migration Steps (11 total)

1. **Rename User Collections**: Memory_{userId} → Memory.users.{userId}
2. **Rename Space Collections**: Memory_{spaceId} → Memory.spaces.public (add space_ids)
3. **Create Group Collections**: Memory.groups.{groupId} (new)
4. **Convert Published IDs**: Simple IDs → Composite {userId}.{memoryId}
5. **Keep Private IDs**: User memory IDs remain simple
6. **Add space_ids**: To user memories (track where published)
7. **Add group_ids**: To user memories (track where published)
8. **Add space_ids**: To Memory.spaces.public memories
9. **Add revision_history**: To published memories (empty array initially)
10. **Migrate Memory_public**: → Memory.spaces.public (if exists)
11. **Migrate Memory.spaces.profiles**: → Memory.spaces.public with space_ids=["profiles"]

### Post-Migration

1. Verify all collections renamed correctly
2. Verify composite IDs generated correctly
3. Verify space_ids and group_ids populated
4. Run smoke tests on remember-mcp tools
5. Update migrations.yaml status
6. Delete backups after 30-day retention

### Rollback

If migration fails:
1. Stop migration immediately
2. Restore from Backup_ collections
3. Investigate failure
4. Fix migration script
5. Retry after fixes

---

## Future Considerations

- **Performance Monitoring**: Track query performance on Memory.spaces.public
- **Storage Optimization**: Consider cleanup job for orphaned memories (after 1 year?)
- **Multi-Region**: Replicate Memory.groups.{groupId} across regions for global groups
- **Caching**: Consider caching frequently accessed published memories
- **Compression**: Consider compressing revision_history for large memories

---

**Status**: Implemented (v3.1.0–v3.6.0)
**Recommendation**: See API reference and migration guide for integration details
**Related Documents**:
- [v2 API Reference](local.v2-api-reference.md) — Complete tool documentation
- [v2 Migration Guide](local.v2-migration-guide.md) — Migration from v1 to v2
- [v2 Usage Examples](local.v2-usage-examples.md) — Real-world usage patterns
- agent/clarifications/ARCHITECTURE_SUMMARY.md
