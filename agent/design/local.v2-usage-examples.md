# Memory Collection Pattern v2 — Usage Examples

**Concept**: Real-world usage patterns and examples for v2 tools
**Created**: 2026-02-27
**Status**: Implemented

---

## Overview

This document provides practical usage examples for Memory Collection Pattern v2 tools. Each example demonstrates a real-world scenario with the complete tool call sequence.

---

## Example 1: Publishing a Recipe to Multiple Spaces

**Scenario**: A user creates a recipe and shares it to both the "cooking" and "recipes" spaces.

```
// 1. Create the memory
remember_create_memory({
  content: "Grandma's famous pasta: Cook 1lb spaghetti al dente. Sautee garlic in olive oil, add crushed tomatoes, basil, and a pinch of sugar. Simmer 20 min. Toss with pasta and fresh parmesan.",
  type: "recipe",
  title: "Grandma's Spaghetti",
  tags: ["pasta", "italian", "family"],
  weight: 0.9
})
// → { memory_id: "abc-123", ... }

// 2. Publish to multiple spaces (generates confirmation token)
remember_publish({
  memory_id: "abc-123",
  spaces: ["cooking", "recipes"],
  additional_tags: ["quick-meal"]
})
// → { success: true, token: "tok_xyz" }

// 3. Confirm publication
remember_confirm({ token: "tok_xyz" })
// Creates:
//   Memory_spaces_public/user123.abc-123 with space_ids=["cooking", "recipes"]
//   Source memory updated: space_ids=["cooking", "recipes"]
```

---

## Example 2: Publishing to a Group

**Scenario**: Share a meeting summary with your team's private group.

```
// 1. Create the meeting notes
remember_create_memory({
  content: "Sprint planning 2/27: Agreed on 3 stories for next sprint. John takes auth refactor, Sarah handles search optimization, Mike on mobile responsive fixes.",
  type: "note",
  title: "Sprint Planning 2/27",
  tags: ["meeting", "sprint"]
})
// → { memory_id: "meeting-456", ... }

// 2. Publish to group
remember_publish({
  memory_id: "meeting-456",
  spaces: [],
  groups: ["team-alpha"]
})
// → { success: true, token: "tok_abc" }

// 3. Confirm
remember_confirm({ token: "tok_abc" })
// Creates:
//   Memory_groups_team-alpha/user123.meeting-456
//   Source memory updated: group_ids=["team-alpha"]
```

---

## Example 3: Dual Publication (Space + Group)

**Scenario**: Publish a memory to both a public space and a private group simultaneously.

```
remember_publish({
  memory_id: "my-recipe",
  spaces: ["cooking"],
  groups: ["foodie-club"]
})
// → { success: true, token: "tok_dual" }

remember_confirm({ token: "tok_dual" })
// Creates two copies:
//   Memory_spaces_public/user123.my-recipe (space_ids=["cooking"])
//   Memory_groups_foodie-club/user123.my-recipe (group_ids=["foodie-club"])
// Source: space_ids=["cooking"], group_ids=["foodie-club"]
```

---

## Example 4: Revising Published Content

**Scenario**: User updates a recipe and syncs changes to all published locations.

```
// 1. Update the source memory
remember_update_memory({
  memory_id: "abc-123",
  content: "Updated: Grandma's pasta with NEW secret — add a splash of pasta water to the sauce before tossing."
})

// 2. Request revision (generates confirmation token)
remember_revise({ memory_id: "abc-123" })
// → { success: true, token: "tok_rev", destinations: "spaces: cooking, recipes; groups: foodie-club" }

// 3. Confirm the revision
remember_confirm({ token: "tok_rev" })
// → {
//   success: true,
//   summary: { total: 2, success: 2, failed: 0, skipped: 0 },
//   results: [
//     { location: "Memory_spaces_public", status: "success" },
//     { location: "Memory_groups_foodie-club", status: "success" }
//   ]
// }
// Previous content preserved in revision_history (max 10 entries)
```

---

## Example 5: Retracting from Specific Spaces

**Scenario**: Remove a recipe from "cooking" space but keep it in "recipes".

```
// Memory is currently in spaces: ["cooking", "recipes"]

remember_retract({
  memory_id: "abc-123",
  spaces: ["cooking"]
})
// → { success: true, token: "tok_retract", retraction_details: { spaces: { action: "orphan", ... } } }

remember_confirm({ token: "tok_retract" })
// Result:
//   Memory_spaces_public/user123.abc-123: space_ids=["recipes"] (removed "cooking")
//   Source memory: space_ids=["recipes"]
//   Memory remains in Memory_spaces_public (orphan strategy — not deleted)
```

---

## Example 6: Searching Shared Spaces

**Scenario**: Discover recipes from other users.

```
// Search specific space
remember_search_space({
  query: "pasta recipe",
  spaces: ["cooking"],
  tags: ["italian"],
  search_type: "hybrid",
  limit: 20
})
// → { memories: [...], total: 5, spaces_searched: ["cooking"] }

// Search a group
remember_search_space({
  query: "sprint planning",
  groups: ["team-alpha"]
})
// → { memories: [...], total: 3, groups_searched: ["team-alpha"] }

// Search all public memories (no spaces/groups filter)
remember_search_space({
  query: "hiking trails near Portland"
})
// → Searches all of Memory_spaces_public
```

---

## Example 7: Full Lifecycle

**Scenario**: Complete lifecycle from creation through revision and retraction.

```
// 1. CREATE
remember_create_memory({
  content: "Best coffee shops in Portland: Heart, Coava, Sterling",
  type: "recommendation",
  tags: ["coffee", "portland"]
})
// → { memory_id: "coffee-list" }

// 2. PUBLISH to two spaces
remember_publish({
  memory_id: "coffee-list",
  spaces: ["the_void", "portland"]
})
// → token → confirm → published

// 3. UPDATE source
remember_update_memory({
  memory_id: "coffee-list",
  content: "Best coffee shops in Portland: Heart, Coava, Sterling, Good Coffee"
})

// 4. REVISE all published copies
remember_revise({ memory_id: "coffee-list" })
// → token → confirm → All copies updated, old content in revision_history

// 5. RETRACT from one space
remember_retract({
  memory_id: "coffee-list",
  spaces: ["portland"]
})
// → token → confirm → retracted from portland, still in the_void

// 6. SEARCH to verify
remember_search_space({
  query: "coffee portland",
  spaces: ["the_void"]
})
// → Returns coffee-list (still published to the_void)
```

---

## Common Patterns

### Pattern: Check Before Publish
```
// Search first to avoid duplicates
remember_search_space({ query: "my unique topic", spaces: ["target-space"] })
// If no results → safe to publish
remember_publish({ memory_id: "...", spaces: ["target-space"] })
```

### Pattern: Bulk Revision After Edit
```
// Update content once, sync everywhere
remember_update_memory({ memory_id: "...", content: "new content" })
remember_revise({ memory_id: "..." })
// → { token: "tok_xyz", ... }
remember_confirm({ token: "tok_xyz" })
// One confirm syncs to ALL published locations (spaces + groups)
```

### Pattern: Gradual Retraction
```
// Retract from spaces one at a time
remember_retract({ memory_id: "...", spaces: ["space-a"] })
// Later...
remember_retract({ memory_id: "...", spaces: ["space-b"] })
// Memory remains in source collection regardless
```

---

**Status**: Implemented
**Recommendation**: Use these examples as reference when building integrations
**Related Documents**:
- [v2 API Reference](local.v2-api-reference.md) — Complete tool schemas
- [Memory Collection Pattern v2](local.memory-collection-pattern-v2.md) — Architecture
- [v2 Migration Guide](local.v2-migration-guide.md) — Migration steps
