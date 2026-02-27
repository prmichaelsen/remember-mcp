# Task 177: Add Moderation Filters to Search Tools

**Milestone**: M15 - Moderation & Space Config
**Estimated Hours**: 4-6
**Dependencies**: Task 174
**Status**: Not Started

---

## Objective

Update `remember_search_space` and `remember_query_space` to filter by moderation_status, defaulting to approved/null for regular users and allowing moderators to see all statuses.

---

## Steps

### 1. Update `src/tools/search-space.ts`

Add `moderation_filter` parameter to tool definition:
- Type: `'approved' | 'pending' | 'rejected' | 'removed' | 'all'`
- Default: `'approved'`

Build Weaviate filter:
```typescript
// Default: approved OR null (backward compat)
const moderationFilter = Filters.or(
  collection.filter.byProperty('moderation_status').equal('approved'),
  collection.filter.byProperty('moderation_status').isNull(true)
);
```

For non-approved filters, check `authContext` for `can_moderate` permission on the target group. Return error if not authorized.

### 2. Update `src/tools/query-space.ts`

Same logic as search-space — add `moderation_filter` parameter and permission check.

### 3. Create permission check helper

Create a helper function (possibly in `src/utils/` or inline) that checks if the user has `can_moderate` for a given group:

```typescript
function canModerate(authContext: AuthContext, groupId: string): boolean {
  if (!authContext?.credentials) return false;
  const membership = authContext.credentials.group_memberships
    .find(m => m.group_id === groupId);
  return membership?.permissions.can_moderate ?? false;
}
```

### 4. Add tests

- Default search returns only approved/null memories
- `moderation_filter: 'pending'` with moderator returns pending
- `moderation_filter: 'pending'` without moderator returns error
- `moderation_filter: 'all'` with moderator returns all statuses
- Null moderation_status treated as approved

---

## Verification

- [ ] Default search excludes pending/rejected/removed memories
- [ ] Null moderation_status memories visible in default search
- [ ] Moderators can filter by any status
- [ ] Non-moderators blocked from non-approved filters
- [ ] Tool definitions include moderation_filter parameter
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
