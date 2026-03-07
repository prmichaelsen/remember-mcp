# Complete Remember-MCP Tool Set

**Project**: remember-mcp
**Created**: 2026-02-11
**Last Updated**: 2026-03-07
**Status**: Implemented (v3.15.4)

---

## Implemented Tool Set (21 Tools)

### Core Memory Operations (6 tools)

#### 1. `remember_create_memory`
Create a new memory with optional template

**Parameters**:
- `content` (required): Memory content
- `title`: Optional title
- `type`: Content type (45+ types)
- `weight`: Significance (0-1)
- `trust`: Access control (0-1)
- `tags`: Array of tags
- `references`: Array of source URLs
- `template_id`: Optional template
- `parent_id`: For comment threading
- `thread_root_id`: Thread root reference
- `moderation_flags`: Per-space moderation

**Returns**: CreateMemoryResult with memory_id, created_at, message

---

#### 2. `remember_update_memory`
Update an existing memory with partial updates

**Parameters**:
- `memory_id` (required): ID of memory to update
- `content`, `title`, `type`, `weight`, `trust`, `tags`, `references`, `parent_id`, `thread_root_id`: Fields to update

**Returns**: UpdateMemoryResult with updated_at, version, updated_fields

---

#### 3. `remember_delete_memory`
Request to delete a memory (two-phase: generates token, requires `remember_confirm`)

**Parameters**:
- `memory_id` (required): ID of memory to delete
- `reason`: Optional reason

**Returns**: Token for confirmation, expires_at (5 minutes)

---

#### 4. `remember_search_memory`
Hybrid semantic + keyword search for memories and relationships

**Parameters**:
- `query` (required): Search query
- `alpha`: Balance semantic (1.0) vs keyword (0.0), default 0.7
- `limit`, `offset`: Pagination
- `filters`: Content type, tags, weight, trust, date range
- `include_relationships`: Include relationships (default true)
- `deleted_filter`: "exclude" | "include" | "only" (default "exclude")

**Returns**: SearchResult with memories array, relationships array, total count

---

#### 5. `remember_find_similar`
Find memories similar to a given memory or text using vector similarity

**Parameters**:
- `memory_id` OR `text` (at least one required)
- `limit`: Default 10
- `min_similarity`: Default 0.7
- `include_relationships`: Default false
- `deleted_filter`: "exclude" | "include" | "only"

**Returns**: FindSimilarResult with similar_memories array, total count

---

#### 6. `remember_query_memory`
RAG-optimized natural language queries (pure semantic search)

**Parameters**:
- `query` (required): Natural language question
- `limit`: Default 5
- `min_relevance`: Default 0.6
- `filters`: Content type, tags, weight, trust, date
- `include_context`: Boolean
- `format`: 'detailed' | 'compact'
- `deleted_filter`: "exclude" | "include" | "only"

**Returns**: QueryMemoryResult with memories array, total count, context_summary

---

### Relationship Operations (4 tools)

#### 7. `remember_create_relationship`
Create a relationship connecting 2 or more memories

**Parameters**:
- `memory_ids` (required): Array of 2+ memory IDs
- `relationship_type` (required): Free-form string
- `observation` (required): Description of the connection
- `strength`: 0-1, default 0.5
- `confidence`: 0-1, default 0.8
- `tags`: Array of tags

**Returns**: CreateRelationshipResult with relationship_id, memory_ids, created_at

---

#### 8. `remember_update_relationship`
Update an existing relationship with partial updates

**Parameters**:
- `relationship_id` (required)
- `relationship_type`, `observation`, `strength`, `confidence`, `tags`: Fields to update

**Returns**: UpdateRelationshipResult with relationship_id, updated_at, version, updated_fields

---

#### 9. `remember_search_relationship`
Search relationships by observation text or type

**Parameters**:
- `query` (required): Searches observation text
- `relationship_types`: Filter by type(s)
- `strength_min`, `confidence_min`: Thresholds
- `tags`: Filter by tags
- `limit`: Default 10
- `offset`: Pagination
- `deleted_filter`: "exclude" | "include" | "only"

**Returns**: SearchRelationshipResult with relationships array, total, offset, limit

---

#### 10. `remember_delete_relationship`
Delete a relationship and clean up references in connected memories

**Parameters**:
- `relationship_id` (required)

**Returns**: DeleteRelationshipResult with relationship_id, deleted, memories_updated count

---

### Preference Management (2 tools)

#### 11. `remember_set_preference`
Update user preferences for system behavior

**Parameters**:
- `preferences` (required): Partial UserPreferences object (merged with existing)

**Returns**: SetPreferenceResult with success, updated_preferences, message

---

#### 12. `remember_get_preferences`
Get current user preferences (with defaults if not set)

**Parameters**:
- `category`: Optional filter (templates, search, location, privacy, notifications, display)

**Returns**: GetPreferencesResult with preferences object, is_default flag, message

---

### Space/Sharing Tools (7 tools) — Two-Phase Confirmation Workflow

#### 13. `remember_publish`
Publish a memory to shared spaces and/or groups (phase 1 - generates token)

**Parameters**:
- `memory_id` (required)
- `spaces`: Array of space names (default ['the_void'])
- `groups`: Array of group IDs
- `additional_tags`: Extra tags for published copy

**Returns**: Token for `remember_confirm`

---

#### 14. `remember_retract`
Retract a memory from specific shared spaces and/or groups (phase 1)

**Parameters**:
- `memory_id` (required)
- `spaces`: Array of space names
- `groups`: Array of group IDs

**Returns**: Token for confirmation

---

#### 15. `remember_revise`
Sync updated content from source memory to all published copies (phase 1)

**Parameters**:
- `memory_id` (required)

**Returns**: Token for confirmation (preserves revision history, up to 10 versions)

---

#### 16. `remember_confirm`
Confirm and execute a pending action using the token (phase 2)

**Parameters**:
- `token` (required)

**Returns**: Action-specific response (publish/retract/revise/delete_memory)

**Critical**: Must be called AFTER explicit user confirmation in a separate message

---

#### 17. `remember_deny`
Deny a pending action (invalidates token)

**Parameters**:
- `token` (required)

**Returns**: success flag

---

#### 18. `remember_search_space`
Search shared spaces and/or groups to discover memories from other users

**Parameters**:
- `query` (required)
- `spaces`: Array of space names
- `groups`: Array of group IDs
- `search_type`: 'hybrid' | 'bm25' | 'semantic' (default 'hybrid')
- `content_type`, `tags`, `min_weight`, `max_weight`, `date_from`, `date_to`: Filters
- `moderation_filter`: Filter by moderation status
- `include_comments`: Include comment memories (default false)
- `limit`: Default 10
- `offset`: Pagination

**Returns**: SearchSpaceResult with spaces_searched, groups_searched, memories, total

---

#### 19. `remember_query_space`
RAG queries against shared spaces (semantic search)

**Parameters**:
- `query` (required)
- `spaces`: Array of space names
- `groups`: Array of group IDs
- `limit`, filters, `include_comments`

**Returns**: QuerySpaceResult with memories and context

---

### Moderation & Configuration (2 tools)

#### 20. `remember_moderate`
Approve, reject, or remove published memories (requires can_moderate permission)

**Parameters**:
- `memory_id` (required)
- `space_id` OR `group_id` (one required)
- `action` (required): 'approve' | 'reject' | 'remove'
- `reason`: Optional

**Returns**: Moderation result with success, action, moderation_status, moderated_by, moderated_at

---

#### 21. `remember_ghost_config`
Manage ghost/persona configuration (who can interact with your ghost, at what trust level)

**Parameters**:
- `action` (required): 'get' | 'set' | 'set_trust' | 'remove_trust' | 'block' | 'unblock'
- `enabled`, `public_ghost_enabled`: Ghost toggles
- `default_friend_trust`, `default_public_trust`: Default trust levels
- `enforcement_mode`: 'query_filter' | 'prompt_filter' | 'hybrid'
- `target_user_id`, `trust_level`: Per-user trust overrides

**Trust Levels**: 0.0 (existence only), 0.25 (metadata), 0.5 (summary), 0.75 (partial), 1.0 (full)

**Returns**: Action-specific responses (config object, success flags)

---

## Tool Organization by Implementation Phase

### Phase 1: MVP (12 tools) - Completed (M1-M4)
- 6 memory operations
- 4 relationship operations
- 2 preference management

### Phase 2: Shared Spaces & Confirmation (7 tools) - Completed (M10-M11)
- publish, retract, revise, confirm, deny, search_space, query_space

### Phase 3: Moderation & Ghost (2 tools) - Completed (M15-M16)
- moderate, ghost_config

### Future Phases (Not Yet Implemented)
- Template management tools (create, list, get, update, delete)
- Additional permission tools (grant_access, revoke_access, list_accessors)

---

## Tool Count Summary

| Phase | Tools | Total |
|-------|-------|-------|
| Phase 1 (MVP) | 12 | 12 |
| Phase 2 (Spaces) | +7 | 19 |
| Phase 3 (Moderation/Ghost) | +2 | 21 |
| Future (Templates) | +5 | 26 |
| Future (Permissions) | +3 | 29 |

---

**Status**: Implemented (21 tools active)
**Version**: 3.15.4
**All tools support natural conversation interface**
