# Task 189: Ghost Memory Content Type Filtering

**Milestone**: M16 — Ghost System
**Status**: not_started
**Dependencies**: None (content_type: 'ghost' already added in Task 180)

---

## Objective

Filter ghost memories out of normal search results by default, matching the existing comment filtering pattern. Allow ghost memories to be explicitly searched.

## Deliverables

### 1. Update default search filters

- `src/utils/weaviate-filters.ts` — add `content_type != 'ghost'` to default memory-only filters (same pattern as comment filtering)
- Ghost memories should NOT appear in normal `remember_search_memory` results
- Ghost memories should NOT appear in normal `remember_query_memory` results

### 2. Add explicit ghost search

- `remember_search_memory` — accept `content_type: 'ghost'` filter to explicitly find ghost memories
- Tag convention: `ghost:{conversing_user_id}` to identify ghost-user pairs

### 3. Ghost memory creation constraints

- In ghost mode: `remember_create_memory` only allows `content_type: 'ghost'`
- In ghost mode: `remember_update_memory` only allows updating ghost memories
- Normal mode: no restrictions (users can manage their own ghost memories)

### 4. Tests

- Default search excludes ghost memories
- Explicit ghost filter includes them
- Ghost mode constraints enforced

## Acceptance Criteria

- [ ] Ghost memories excluded from default search
- [ ] Ghost memories findable via explicit content_type filter
- [ ] Ghost mode creation/update constraints work
- [ ] Tests pass
