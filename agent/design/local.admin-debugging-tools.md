# Admin Debugging Tools

**Concept**: Read-only admin MCP tools gated by ADMIN_USER_IDS for debugging remember-mcp via the remote remember-mcp-oauth-server
**Created**: 2026-03-14
**Status**: Design Specification

---

## Overview

Admin debugging tools provide privileged read-only access to remember-mcp internals — Weaviate schemas, raw memory objects, Firestore user data, and cross-tenant search. These tools are gated by an `ADMIN_USER_IDS` env var on the server side, allowing designated users to debug production data through the standard MCP tool interface (via the OAuth-authenticated remember-mcp-oauth-server).

This replaces the current workflow of manually curling REST APIs with local secrets, which is fragile and error-prone.

---

## Problem Statement

- Debugging remember-mcp requires inspecting Weaviate collections, raw memory objects, and Firestore user data
- The current approach (local secrets + curl) is fragile and doesn't leverage the MCP tool interface
- No way to inspect data across user tenants without direct database access
- No schema drift detection tooling
- Claude Code agents working on remember-mcp need programmatic access to internals

---

## Solution

Add 9+ admin-only MCP tools with the `remember_admin_*` prefix, gated by a server-side `ADMIN_USER_IDS` env var. All tools are read-only in v1. Tools are hidden from non-admin users when possible (tool listing), with permission errors as fallback.

### V1 Tool Set (Read-Only)

| Tool | Description |
|---|---|
| `remember_admin_inspect_memory` | Fetch raw memory by composite ID (all fields, optional vector) |
| `remember_admin_get_weaviate_schema` | Inspect collection schema, property types, index config |
| `remember_admin_list_collections` | List all Weaviate collections (user, space, group) |
| `remember_admin_collection_stats` | Object count, vector dimensions, tenant info per collection |
| `remember_admin_inspect_user_preferences` | Firestore user preferences |
| `remember_admin_inspect_user_ghost_configs` | Firestore ghost configurations |
| `remember_admin_inspect_user_escalation_records` | Firestore escalation records |
| `remember_admin_inspect_user_api_tokens` | API token metadata (no hashes) |
| `remember_admin_search_across_users` | Cross-tenant memory search with user_id array |
| `remember_admin_health` | Deep health check (Weaviate + Firestore connectivity) |
| `remember_admin_detect_weaviate_drift` | Compare expected vs actual schema properties per collection |

### Deferred

| Tool | Reason |
|---|---|
| `remember_admin_reindex_memory` | Write operation, deferred to v2 |

### Not Included (Destructive)

These are excluded from the roadmap until destructive admin operations are warranted:
- `remember_admin_run_migration`
- `remember_admin_delete_collection`
- `remember_admin_purge_deleted`

---

## Implementation

### Admin Gate

```typescript
// Checked on every admin tool call (not cached at startup)
function isAdmin(userId: string): boolean {
  const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map(id => id.trim());
  return adminIds.includes(userId);
}
```

- `ADMIN_USER_IDS`: comma-separated env var set on the server (Cloud Run / remember-mcp-oauth-server)
- userId is resolved from JWT (server-verified via mcp-auth or OAuth token exchange) — never user-supplied
- Checked at request time (re-reads env on each call for hot-reload support)

### Tool Visibility

Admin tools should be hidden from non-admin users in the MCP tool listing. When a tool cannot be hidden (client doesn't support conditional listing), return a permission error:

```typescript
{
  content: [{ type: 'text', text: 'Permission denied: admin access required' }],
  isError: true
}
```

### Tool Specifications

#### remember_admin_inspect_memory

```typescript
// Input
{
  memory_id: string;        // Composite ID (userId.memoryId) — resolved via index lookup
  include_vector?: boolean; // Default: false
}

// Output: raw Weaviate object with all fields
```

#### remember_admin_search_across_users

```typescript
// Input
{
  user_ids: string[];       // Required — explicit user list, no "all users"
  query: string;            // Search query
  limit?: number;           // Default: 10
  content_type?: string;    // Optional filter
}

// Output: results include user_id per memory
```

#### remember_admin_inspect_user_*

Split into granular tools per Firestore data type:
- `remember_admin_inspect_user_preferences` — `{ user_id: string }`
- `remember_admin_inspect_user_ghost_configs` — `{ user_id: string }`
- `remember_admin_inspect_user_escalation_records` — `{ user_id: string }`
- `remember_admin_inspect_user_api_tokens` — `{ user_id: string }` (metadata only, no hashes)

Note: `space_configs` is not user-scoped, excluded from inspect_user tools.

#### remember_admin_health

Simple connectivity check only:
- Weaviate: connection test
- Firestore: connection test
- No schema drift detection (separate tool)
- No per-user memory counts

#### remember_admin_detect_weaviate_drift

```typescript
// Input
{
  collection_ids?: string[]; // Optional — check specific collections, or all if omitted
}

// Output: expected vs actual property comparison per collection
```

### Code Organization

- One file per tool in `src/tools/` (follows existing pattern)
- File naming: `admin-inspect-memory.ts`, `admin-list-collections.ts`, etc.
- Use remember-core services (build new ones in remember-core if necessary)
- Shared admin gate utility in `src/utils/admin.ts` or similar

---

## Benefits

- **Debugging velocity**: Inspect production data through MCP tools instead of manual curl
- **Claude Code integration**: Agents working on remember-mcp can programmatically inspect internals
- **Safety**: Read-only v1 prevents accidental data modification
- **Composability**: Granular tools (separate inspect_user_* per data type) allow precise queries

---

## Trade-offs

- **Env var admin gate**: Changing admins requires redeployment; no runtime revocation or audit trail. Mitigated by v2 upgrade path (CredentialsProvider).
- **No destructive operations**: Can't fix data issues through admin tools in v1. Mitigated by direct DB access as fallback.
- **User ID array for cross-search**: Can't search all users at once. Mitigated by list_collections to discover user IDs first.

---

## Dependencies

- remember-core: may need new admin-specific services (schema inspection, cross-tenant search)
- Weaviate client: collection listing, schema introspection APIs
- Firestore: user data reads (preferences, ghost_configs, escalation_records, api_tokens)
- OAuth flow: admin users authenticate via remember-mcp-oauth-server (M21)

---

## Testing Strategy

- Unit tests for admin gate (isAdmin check, env parsing, edge cases)
- Unit tests per admin tool (mock remember-core services)
- Test non-admin rejection (permission error or tool hiding)
- Test with empty ADMIN_USER_IDS (all admin calls rejected)

---

## Migration Path

No migration needed — purely additive. New tools are registered in server.ts/server-factory.ts alongside existing tools.

---

## Key Design Decisions

### Authorization

| Decision | Choice | Rationale |
|---|---|---|
| Admin gate mechanism | `ADMIN_USER_IDS` env var | Simple, server-side only, userId from JWT is already server-verified |
| Check timing | Per-request (not cached) | Allows hot-reload if env changes without restart |
| Non-admin behavior | Hide tools if possible, permission error fallback | Clean UX — admins see admin tools, others don't |

### Tool Design

| Decision | Choice | Rationale |
|---|---|---|
| inspect_memory ID format | Composite ID (userId.memoryId) | Index lookup table resolves to collection; no separate user_id param needed |
| Vector inclusion | Excluded by default, `include_vector` flag | Vectors are large and rarely needed for debugging |
| inspect_user granularity | Separate tools per data type | Allows precise queries; avoids returning unnecessary data |
| space_configs in inspect_user | Excluded | Not user-scoped data |
| Schema drift | Separate `detect_weaviate_drift` tool | Health check stays simple; drift detection is a distinct concern |
| Cross-user search scope | Explicit user_id array required | "All users" is too expensive; admin discovers IDs via list_collections first |

### Scope

| Decision | Choice | Rationale |
|---|---|---|
| v1 scope | Read-only only | Safety — no accidental data destruction |
| Destructive tools | Not included (not even deferred) | No current need; direct DB access suffices |
| Audit logging | Not in v1 | Unnecessary overhead for read-only tools |
| OAuth scopes | Future — will gate admin tools via scopes | Aligns with existing OAuth architecture |

---

## Future Considerations

- **v2 admin gate**: Replace env var with CredentialsProvider-backed admin flag on user profile (queryable at runtime, revocable without redeploy, auditable). The codebase already has stubbed `CredentialsProvider` and group-based `can_moderate` permissions — admin would follow the same pattern.
- **OAuth scopes for admin**: Gate admin tools via OAuth scopes (e.g., `admin:read`, `admin:write`) in addition to ADMIN_USER_IDS
- **Write operations**: `remember_admin_reindex_memory` (deferred), destructive tools if needed
- **Audit logging**: Firestore audit trail for admin tool invocations (if write operations are added)

---

**Status**: Design Specification
**Recommendation**: Create milestone M22 and implement
**Related Documents**:
- [clarification-6-admin-debugging-tools.md](../clarifications/clarification-6-admin-debugging-tools.md)
- [local.api-token-oauth-access.md](local.api-token-oauth-access.md) (M21 — OAuth flow this depends on)
- [access-control-result-pattern.md](access-control-result-pattern.md) (existing permission patterns)
