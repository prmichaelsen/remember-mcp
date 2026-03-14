# Task 521: Schema and Collection Tools

**Milestone**: [M22 — Admin Debugging Tools](../../milestones/milestone-22-admin-debugging-tools.md)
**Design Reference**: [local.admin-debugging-tools.md](../../design/local.admin-debugging-tools.md)
**Status**: Not Started
**Estimated Time**: 3-4 hours
**Dependencies**: [Task 520](task-520-admin-gate-infrastructure.md)

---

## Objective

Implement three admin tools for inspecting Weaviate schema and collections: `remember_admin_get_weaviate_schema`, `remember_admin_list_collections`, and `remember_admin_collection_stats`.

## Context

These tools provide visibility into the Weaviate database structure — what collections exist, their schemas, and basic stats. This is essential for debugging schema drift, verifying collection creation, and understanding tenant distribution. All three tools use remember-core services (build new ones if necessary).

## Steps

### 1. Implement `remember_admin_get_weaviate_schema`

Create `src/tools/admin-get-weaviate-schema.ts`:

**Input**:
```typescript
{
  collection_name: string; // e.g. "Memory_users_abc123", "Memory_spaces_public"
}
```

**Output**: Collection schema including:
- Property names, types, and index configuration
- Vectorizer configuration
- Multi-tenancy settings

**Implementation**:
- Use Weaviate client's schema inspection API via remember-core
- Guard with `isAdmin(userId)` check; return `adminPermissionError()` if not admin
- Register in server.ts/server-factory.ts (conditional on admin status per Task 520)

### 2. Implement `remember_admin_list_collections`

Create `src/tools/admin-list-collections.ts`:

**Input**:
```typescript
{
  filter?: string; // Optional — filter by prefix (e.g. "Memory_users_", "Memory_spaces_")
}
```

**Output**: List of all Weaviate collections with:
- Collection name
- Type (user/space/group — inferred from naming convention)
- Object count (if available without expensive query)

**Implementation**:
- Use Weaviate client to list all collections
- Categorize by naming convention: `Memory_users_*` → user, `Memory_spaces_*` → space, `Memory_groups_*` → group
- Optional filter to narrow results

### 3. Implement `remember_admin_collection_stats`

Create `src/tools/admin-collection-stats.ts`:

**Input**:
```typescript
{
  collection_name: string; // Specific collection to get stats for
}
```

**Output**:
- Object count
- Vector dimensions
- Tenant info (if multi-tenant)
- Property count

**Implementation**:
- Use Weaviate aggregate/meta queries via remember-core
- Return structured stats object

### 4. Add Unit Tests

Create spec files for each tool:
- `src/tools/admin-get-weaviate-schema.spec.ts`
- `src/tools/admin-list-collections.spec.ts`
- `src/tools/admin-collection-stats.spec.ts`

Test cases per tool:
- Admin user gets correct results (mock remember-core service)
- Non-admin user gets permission error
- Empty/missing collection returns appropriate error
- Filter parameter works correctly (list_collections)

---

## Verification

- [ ] `get_weaviate_schema` returns full schema for a given collection
- [ ] `list_collections` returns all collections with type categorization
- [ ] `list_collections` filter parameter narrows results correctly
- [ ] `collection_stats` returns object count, vector dimensions, tenant info
- [ ] All three tools reject non-admin users
- [ ] All three tools registered conditionally (hidden from non-admins)
- [ ] Unit tests pass for all three tools
- [ ] Uses remember-core services (not direct Weaviate client calls from tool handlers)
