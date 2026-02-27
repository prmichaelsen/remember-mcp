# Collaborative Memory Sync

**Concept**: Conflict resolution for shared-editing memories via `remember_sync` and `remember_overwrite` tools
**Created**: 2026-02-27
**Status**: Proposal

---

## Overview

This document describes a collaborative editing conflict resolution system for remember-mcp. When multiple users have write access to a published memory, concurrent edits create divergent versions. `remember_sync` provides a merge workflow that lets users resolve conflicts before calling `remember_revise`, while `remember_overwrite` provides a force-push escape hatch for users with overwrite permissions.

This is a prerequisite for safe collaborative memory editing in shared spaces and groups.

---

## Problem Statement

Currently, `remember_revise` syncs content from a source memory to all published copies. But when a memory has shared write access (e.g., in a group), multiple users may edit the published copy independently. If User A edits the published copy and then User B calls `remember_revise` from their source, User A's changes are silently overwritten.

**Challenges**:
- No mechanism to detect that the published copy has been modified by another user since last sync
- No merge strategy for reconciling divergent content
- No way to preview what will change before revising
- `remember_revise` blindly overwrites without conflict detection

**Consequences**:
- Data loss when collaborative edits are overwritten
- Users lose trust in the system's ability to preserve their contributions
- No way to safely enable shared write access on published memories

---

## Solution

Introduce two new tools that sit in front of `remember_revise` in the collaborative editing workflow:

### `remember_sync`

A conflict detection and resolution tool. Before revising, the user calls `remember_sync` to compare their local source memory with the published copies.

**Behavior**:
1. Fetches the source memory from `Memory_users_{userId}`
2. Fetches the published copy from `Memory_spaces_public` or `Memory_groups_{groupId}`
3. Compares content to detect divergence
4. If no conflict (published copy unchanged since last sync): returns "clean" status, user can proceed with `remember_revise`
5. If conflict detected: returns both versions and offers merge strategies

**Merge Strategies**:
- `keep_local` — Use source memory content (discard remote changes)
- `keep_remote` — Use published copy content (discard local changes)
- `manual` — Present both versions for manual merge (user edits source, then revises)

### `remember_overwrite`

A force-revise tool for users with overwrite permission. Bypasses conflict detection entirely — the source memory content replaces the published copy unconditionally.

**Behavior**:
1. Validates user has overwrite permission on the target document
2. Replaces published content with source content (no merge, no conflict check)
3. Preserves old content in `revision_history` (same as `remember_revise`)
4. Uses confirmation flow (generates token, requires user confirmation)

**Permission Model**: Overwrite permission is a document-level flag. Only the original author or users granted explicit overwrite access can use this tool.

---

## Implementation

### remember_sync Tool

```typescript
// Input Schema
{
  memory_id: string,       // Source memory ID
  location?: string,       // Specific location to sync (optional, defaults to all)
}

// Output — Clean (no conflicts)
{
  status: "clean",
  message: "Published copies are in sync. Safe to remember_revise.",
  locations_checked: 3,
}

// Output — Conflict detected
{
  status: "conflict",
  message: "Published copy has been modified since your last revision.",
  conflicts: [
    {
      location: "Memory_spaces_public",
      local_content: "Your version...",
      remote_content: "Published version (modified by user456)...",
      local_updated_at: "2026-02-27T10:00:00Z",
      remote_revised_at: "2026-02-27T11:30:00Z",
      remote_revised_by: "user456",
    }
  ],
  merge_options: ["keep_local", "keep_remote", "manual"],
}
```

### Conflict Detection Logic

```
Source memory: { content: "A", updated_at: T1 }
Published copy: { content: "B", revised_at: T2, revision_history: [...] }

If T2 > T1:
  → Published copy was revised AFTER source was last updated
  → Someone else revised the published copy
  → CONFLICT

If content(source) === content(published):
  → No conflict (already in sync)
  → CLEAN

If T1 > T2 and content differs:
  → Source was updated after last revision
  → Normal case for remember_revise
  → CLEAN (user's own changes pending)
```

### remember_overwrite Tool

```typescript
// Input Schema
{
  memory_id: string,       // Source memory ID
  locations?: {            // Optional: specific locations to overwrite
    spaces?: string[],
    groups?: string[],
  }
}

// Output (confirmation token)
{
  success: true,
  token: "<confirmation_token>",
  message: "Overwrite request created. This will replace published content unconditionally.",
  action: "overwrite_memory",
  warning: "This will discard any remote changes made by other users.",
  confirmation_required: true,
}
```

### Workflow Diagram

```
User edits source memory
         │
         ▼
  remember_sync()
         │
    ┌────┴────┐
    │         │
  CLEAN    CONFLICT
    │         │
    ▼         ▼
remember_   Choose strategy:
revise()    ├── keep_local → update source → remember_revise()
            ├── keep_remote → update source from published → done
            └── manual → user edits source → remember_revise()

Alternative (with permission):
  remember_overwrite() → confirm → force replace published copies
```

### Schema Additions

Published memories need additional fields for conflict tracking:

```typescript
{
  // Existing fields
  revised_at: date,
  revision_count: number,
  revision_history: string,  // JSON

  // New fields for collaborative sync
  last_revised_by: string,   // userId of last reviser
}
```

---

## Benefits

- **Data Safety**: No silent overwrites of collaborative edits
- **User Trust**: Users see conflicts before they cause data loss
- **Flexibility**: Multiple merge strategies for different situations
- **Escape Hatch**: `remember_overwrite` for when force-push is intentional
- **Audit Trail**: `last_revised_by` tracks who made changes

---

## Trade-offs

- **Extra Step**: Users must call `remember_sync` before `remember_revise` in shared-editing contexts (mitigated: `remember_revise` could auto-detect and warn)
- **Complexity**: Merge conflict UI is inherently complex for AI agents to present (mitigated: simple strategy options rather than line-by-line merge)
- **Permission Model**: Overwrite permission adds another access control dimension (mitigated: simple boolean flag per document)
- **Performance**: Extra round-trip to fetch and compare published copies (mitigated: only needed for shared-editing memories)

---

## Dependencies

- Memory Collection Pattern v2 (M14) — composite IDs, tracking arrays, revision history
- `remember_revise` confirmation flow (v3.7.0)
- Shared write permission system (not yet implemented — requires trust/permissions milestone)
- `last_revised_by` schema field addition

---

## Testing Strategy

**Unit Tests**:
- Conflict detection logic (clean vs conflict scenarios)
- Merge strategy application (keep_local, keep_remote)
- Overwrite permission validation
- Edge cases: deleted published copies, orphaned memories

**Integration Tests**:
- Two users editing same published memory → sync detects conflict
- User syncs clean memory → proceeds to revise
- User with overwrite permission → force replaces
- User without overwrite permission → denied

---

## Migration Path

1. Add `last_revised_by` field to published memory schema (`v2-collections.ts`)
2. Update `executeReviseMemory` in `confirm.ts` to set `last_revised_by`
3. Implement `remember_sync` tool
4. Implement `remember_overwrite` tool
5. Optionally: add conflict warning to `remember_revise` when shared-editing is detected

---

## Future Considerations

- **Auto-merge**: For structured content, attempt automatic merge (e.g., combining tag additions)
- **Operational Transform**: For real-time collaborative editing (likely overkill for memory use case)
- **Change notifications**: Notify users when their published memories are modified by others
- **Diff view**: Show line-by-line diff between local and remote versions
- **Lock mechanism**: Optional pessimistic locking for critical memories

---

**Status**: Proposal
**Recommendation**: Implement after shared write permissions are available (M7 Trust & Permissions or later)
**Related Documents**:
- [Memory Collection Pattern v2](local.memory-collection-pattern-v2.md) — Foundation architecture
- [v2 API Reference](local.v2-api-reference.md) — Current tool documentation
- [Trust System Implementation](trust-system-implementation.md) — Permission model
