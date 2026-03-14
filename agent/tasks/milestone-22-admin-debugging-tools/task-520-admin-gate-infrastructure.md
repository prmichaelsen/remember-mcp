# Task 520: Admin Gate Infrastructure

**Milestone**: [M22 — Admin Debugging Tools](../../milestones/milestone-22-admin-debugging-tools.md)
**Design Reference**: [local.admin-debugging-tools.md](../../design/local.admin-debugging-tools.md)
**Status**: Not Started
**Estimated Time**: 3-4 hours
**Dependencies**: None

---

## Objective

Create the shared admin gate utility and conditional tool registration mechanism so admin tools are hidden from non-admin users and reject unauthorized calls.

## Context

Admin tools are gated by `ADMIN_USER_IDS`, a comma-separated env var set on the server side. The userId is already server-verified (resolved from JWT via mcp-auth or OAuth token exchange). The admin check must happen per-request (not cached at startup) to support hot-reload.

## Steps

### 1. Create Admin Gate Utility

Create `src/utils/admin.ts`:

```typescript
/**
 * Check if a userId is in the ADMIN_USER_IDS env var.
 * Re-reads env on each call (not cached) for hot-reload support.
 */
export function isAdmin(userId: string): boolean {
  const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
  return adminIds.includes(userId);
}
```

Edge cases:
- Empty `ADMIN_USER_IDS` → no admins (all calls rejected)
- Whitespace around IDs → trimmed
- Undefined env var → treated as empty string

### 2. Create Admin Permission Error Helper

In `src/utils/admin.ts`, add a helper for consistent error responses:

```typescript
export function adminPermissionError() {
  return {
    content: [{ type: 'text' as const, text: 'Permission denied: admin access required' }],
    isError: true,
  };
}
```

### 3. Implement Conditional Tool Registration

Modify `server.ts` and `server-factory.ts` to conditionally register admin tools based on the userId:

- When listing tools (`tools/list`), only include `remember_admin_*` tools if `isAdmin(userId)` is true
- This means admin tools are invisible to non-admin users
- If a non-admin somehow calls an admin tool (e.g., cached tool list), return `adminPermissionError()`

Implementation approach:
- Create a separate function `registerAdminTools(server, userId)` that checks `isAdmin(userId)` before registering
- Or filter tools at list-time based on the requesting user's admin status
- Follow the existing tool registration pattern in server.ts

### 4. Add Unit Tests

Create `src/utils/admin.spec.ts`:

- Test `isAdmin()` with matching userId → true
- Test `isAdmin()` with non-matching userId → false
- Test `isAdmin()` with empty `ADMIN_USER_IDS` → false
- Test `isAdmin()` with undefined `ADMIN_USER_IDS` → false
- Test `isAdmin()` with whitespace around IDs → trimmed and matched
- Test `isAdmin()` with multiple IDs → matches any
- Test `adminPermissionError()` returns correct structure

---

## Verification

- [ ] `isAdmin()` correctly parses comma-separated env var
- [ ] Empty/undefined `ADMIN_USER_IDS` rejects all admin calls
- [ ] Whitespace around IDs is trimmed
- [ ] Admin tools are hidden from non-admin tool listings
- [ ] Non-admin calling admin tool gets permission error with `isError: true`
- [ ] Env var is re-read on each call (not cached at module load)
- [ ] All unit tests pass
- [ ] Existing tests unaffected (no regression)

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Admin gate mechanism | `ADMIN_USER_IDS` env var | Simple, server-side only, userId from JWT is already server-verified |
| Check timing | Per-request (not cached) | Allows hot-reload if env changes without restart |
| Non-admin behavior | Hide tools if possible, permission error fallback | Clean UX — admins see admin tools, others don't |
| v2 upgrade path | CredentialsProvider-backed admin flag | Existing stubbed CredentialsProvider + group-based can_moderate permissions provide the pattern |
