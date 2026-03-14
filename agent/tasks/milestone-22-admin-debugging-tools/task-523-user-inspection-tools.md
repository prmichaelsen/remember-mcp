# Task 523: User Inspection Tools

**Milestone**: [M22 — Admin Debugging Tools](../../milestones/milestone-22-admin-debugging-tools.md)
**Design Reference**: [local.admin-debugging-tools.md](../../design/local.admin-debugging-tools.md)
**Status**: Not Started
**Estimated Time**: 2-3 hours
**Dependencies**: [Task 520](task-520-admin-gate-infrastructure.md)

---

## Objective

Implement four granular admin tools for inspecting Firestore user data: `remember_admin_inspect_user_preferences`, `remember_admin_inspect_user_ghost_configs`, `remember_admin_inspect_user_escalation_records`, and `remember_admin_inspect_user_api_tokens`.

## Context

User data is spread across multiple Firestore collections. Rather than a single monolithic inspect tool, these are split into granular tools per data type — allowing precise queries and avoiding returning unnecessary data. Note: `space_configs` is excluded because it is not user-scoped.

## Steps

### 1. Implement `remember_admin_inspect_user_preferences`

Create `src/tools/admin-inspect-user-preferences.ts`:

**Input**:
```typescript
{ user_id: string }
```

**Output**: Full user preferences document from Firestore, including all categories (templates, search, location, privacy, notifications, display).

**Implementation**:
- Use remember-core preference service to fetch user preferences
- Guard with `isAdmin(userId)` check
- Return default preferences if none set (same as `remember_get_preferences` behavior, but for any user)

### 2. Implement `remember_admin_inspect_user_ghost_configs`

Create `src/tools/admin-inspect-user-ghost-configs.ts`:

**Input**:
```typescript
{ user_id: string }
```

**Output**: All ghost configurations for the user — trust mode, content type filters, blocked users, etc.

**Implementation**:
- Use remember-core ghost config service to fetch all configs for user
- Guard with `isAdmin(userId)` check
- Return empty array if no ghost configs exist

### 3. Implement `remember_admin_inspect_user_escalation_records`

Create `src/tools/admin-inspect-user-escalation-records.ts`:

**Input**:
```typescript
{ user_id: string }
```

**Output**: All escalation records for the user — trust escalation attempts, blocked interactions, timestamps.

**Implementation**:
- Use remember-core escalation service to fetch records for user
- Guard with `isAdmin(userId)` check
- Return empty array if no records exist

### 4. Implement `remember_admin_inspect_user_api_tokens`

Create `src/tools/admin-inspect-user-api-tokens.ts`:

**Input**:
```typescript
{ user_id: string }
```

**Output**: API token metadata (no hashes, no raw tokens):
- Token name/label
- Created date
- Last used date
- Scopes
- Disabled status

**Implementation**:
- Query Firestore `api_tokens` collection where `user_id` matches
- Exclude `token_hash` field from response — only return metadata
- Guard with `isAdmin(userId)` check
- Return empty array if no tokens exist

### 5. Add Unit Tests

Create spec files for each tool:
- `src/tools/admin-inspect-user-preferences.spec.ts`
- `src/tools/admin-inspect-user-ghost-configs.spec.ts`
- `src/tools/admin-inspect-user-escalation-records.spec.ts`
- `src/tools/admin-inspect-user-api-tokens.spec.ts`

Test cases per tool:
- Admin fetches data for existing user → returns data
- Admin fetches data for user with no data → returns defaults/empty
- Non-admin → permission error
- Invalid user_id → appropriate error

Additional for api_tokens:
- Token hash is never included in response

---

## Verification

- [ ] Each tool returns correct Firestore data for the specified user
- [ ] Each tool returns defaults/empty for users with no data
- [ ] `inspect_user_api_tokens` never returns token hashes
- [ ] All four tools reject non-admin users
- [ ] All four tools registered conditionally (hidden from non-admins)
- [ ] Unit tests pass for all four tools
- [ ] Uses remember-core services (not direct Firestore calls from tool handlers)

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| inspect_user granularity | Separate tools per data type | Allows precise queries; avoids returning unnecessary data |
| space_configs | Excluded | Not user-scoped data |
| api_tokens | Metadata only, no hashes | Security — token hashes must never be exposed |
