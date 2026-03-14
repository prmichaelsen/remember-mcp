# Task 522: Memory Inspection Tools

**Milestone**: [M22 — Admin Debugging Tools](../../milestones/milestone-22-admin-debugging-tools.md)
**Design Reference**: [local.admin-debugging-tools.md](../../design/local.admin-debugging-tools.md)
**Status**: Not Started
**Estimated Time**: 3-4 hours
**Dependencies**: [Task 520](task-520-admin-gate-infrastructure.md)

---

## Objective

Implement two admin tools for inspecting memories across tenants: `remember_admin_inspect_memory` and `remember_admin_search_across_users`.

## Context

These tools allow admins to fetch raw memory objects and search across user tenants — critical for debugging user-reported issues, verifying data integrity, and investigating cross-tenant behavior. Memories use composite IDs (`userId.memoryId`) and an index lookup table in Firestore.

## Steps

### 1. Implement `remember_admin_inspect_memory`

Create `src/tools/admin-inspect-memory.ts`:

**Input**:
```typescript
{
  memory_id: string;        // Composite ID (userId.memoryId) — resolved via index lookup
  include_vector?: boolean; // Default: false
}
```

**Output**: Raw Weaviate object with all fields including:
- All standard memory fields (content, content_type, tags, weight, trust, etc.)
- Internal fields (deleted_at, deleted_by, moderation_status, space_ids, group_ids, etc.)
- Vector embedding (only if `include_vector: true`)
- Metadata (created_at, updated_at, version)

**Implementation**:
- Use remember-core's MemoryIndexService to resolve composite ID to collection + object ID
- Fetch raw Weaviate object with all properties
- Conditionally include vector based on `include_vector` flag
- Guard with `isAdmin(userId)` check
- Return error if memory not found in index

### 2. Implement `remember_admin_search_across_users`

Create `src/tools/admin-search-across-users.ts`:

**Input**:
```typescript
{
  user_ids: string[];       // Required — explicit user ID list (no "all users")
  query: string;            // Search query (hybrid search)
  limit?: number;           // Default: 10
  content_type?: string;    // Optional content type filter
}
```

**Output**: Array of results, each including:
- All memory fields
- `user_id` field identifying which user the memory belongs to

**Implementation**:
- Iterate over `user_ids` array
- For each user, search their `Memory_users_{userId}` collection using remember-core search services
- Merge results, annotate each with `user_id`
- Sort by relevance score
- Apply `limit` across merged results
- Guard with `isAdmin(userId)` check

**Edge cases**:
- User ID doesn't have a collection → skip with warning in response
- Empty `user_ids` array → return validation error
- Single user_id → works fine (equivalent to admin-scoped search of one user)

### 3. Add Unit Tests

Create spec files:
- `src/tools/admin-inspect-memory.spec.ts`
- `src/tools/admin-search-across-users.spec.ts`

Test cases for `inspect_memory`:
- Admin fetches memory by composite ID → returns raw object
- Admin fetches with `include_vector: true` → includes vector
- Admin fetches with `include_vector: false` (default) → excludes vector
- Non-admin → permission error
- Invalid composite ID → appropriate error
- Memory not found in index → appropriate error

Test cases for `search_across_users`:
- Admin searches across 2 users → merged results with user_id
- Results include user_id per memory
- Limit applies across merged results
- content_type filter works
- Non-existent user ID → skipped with warning
- Non-admin → permission error
- Empty user_ids array → validation error

---

## Verification

- [ ] `inspect_memory` resolves composite ID via index lookup
- [ ] `inspect_memory` returns all fields including internal ones
- [ ] `inspect_memory` excludes vector by default, includes with flag
- [ ] `search_across_users` requires explicit user_id array (no "all users")
- [ ] `search_across_users` results include user_id per memory
- [ ] `search_across_users` merges and sorts by relevance across users
- [ ] Both tools reject non-admin users
- [ ] Both tools registered conditionally (hidden from non-admins)
- [ ] Unit tests pass for both tools

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| inspect_memory ID format | Composite ID (userId.memoryId) | Index lookup table resolves to collection; no separate user_id param needed |
| Vector inclusion | Excluded by default, `include_vector` flag | Vectors are large and rarely needed for debugging |
| Cross-user search scope | Explicit user_id array required | "All users" is too expensive; admin discovers IDs via list_collections first |
