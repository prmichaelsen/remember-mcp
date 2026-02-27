# Task 174: Add Moderation Schema Fields

**Milestone**: M15 - Moderation & Space Config
**Estimated Hours**: 2-3
**Dependencies**: None (builds on v3.9.0 foundations)
**Status**: Not Started

---

## Objective

Add moderation-related fields to the Weaviate published memory schema and the `can_moderate` permission to the GroupPermissions type.

---

## Steps

### 1. Add schema fields to `src/schema/v2-collections.ts`

Add to `PUBLISHED_MEMORY_PROPERTIES`:

```typescript
// Moderation
{ name: 'moderation_status', dataType: configure.dataType.TEXT },
{ name: 'moderated_by', dataType: configure.dataType.TEXT },
{ name: 'moderated_at', dataType: configure.dataType.DATE },
```

Note: `moderation_flags` already exists in `COMMON_MEMORY_PROPERTIES` as TEXT_ARRAY.

### 2. Add `can_moderate` to GroupPermissions in `src/types/auth.ts`

```typescript
export interface GroupPermissions {
  // ... existing fields ...
  can_moderate: boolean;
}
```

### 3. Update StubCredentialsProvider if needed

Ensure the stub doesn't break with the new permission field (it returns empty memberships, so no change needed).

### 4. Add tests

- Verify `getPublishedCollectionProperties()` includes the new fields
- Verify GroupPermissions type includes `can_moderate`

---

## Verification

- [ ] `moderation_status`, `moderated_by`, `moderated_at` in PUBLISHED_MEMORY_PROPERTIES
- [ ] `can_moderate` in GroupPermissions interface
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] Existing tests unaffected
