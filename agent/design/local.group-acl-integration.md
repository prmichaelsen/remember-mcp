# Group ACL Integration for remember-mcp

**Concept**: Consume agentbase.me group permissions to enforce memory-level ACLs in remember-mcp
**Created**: 2026-02-27
**Status**: Design Specification
**Source**: [agentbase.me group-management-tools.md](../../../agentbase.me-e1/agent/design/local.group-management-tools.md), [group-credentials-for-remember-mcp.md](../../../agentbase.me-e1/agent/design/local.group-credentials-for-remember-mcp.md)

---

## Overview

This document specifies what remember-mcp (built on remember-core) needs to implement to consume and enforce the group permission model defined by agentbase.me. agentbase.me owns group definitions, membership, and permissions. remember-mcp owns memory-level ACL enforcement and space configuration.

agentbase.me stores **permission-level ACL flags** directly on group members (no named roles). The credentials endpoint returns these flags as-is. remember-mcp reads them and enforces memory operations accordingly.

---

## Problem Statement

remember-mcp currently has no group or space ACL support. The existing `User` type has a flat `role: 'admin' | 'member' | 'viewer'` field that applies system-wide, not per-group. To support group memory spaces, remember-mcp needs to:

1. Consume per-group permission objects from the agentbase.me credentials endpoint
2. Map permission flags to memory operations (publish, revise, retract, etc.)
3. Enforce `auth_level` hierarchy for moderation actions on memories
4. Store moderation action stamps on memories for hierarchy enforcement

Without this, users in a group could perform any memory operation regardless of their permissions.

---

## Solution

Add a credentials client, permission types, and an authorization layer to remember-core. The authorization layer sits between MCP tool handlers and the memory services, checking permissions before allowing operations.

### Ownership Split

| Concern | Owner |
|---------|-------|
| Group definitions, membership, ACL flags | agentbase.me |
| Credentials endpoint (`/api/credentials/agentbase`) | agentbase.me |
| Memory storage, space configuration | remember-mcp |
| Memory-level ACL enforcement | remember-mcp |
| Moderation action stamps on memories | remember-mcp |

---

## Implementation

### 1. Permission Types

remember-core needs types that mirror the agentbase.me permission model. These are **read-only** — remember-mcp never writes permissions, only reads them from the credentials endpoint.

```typescript
// src/types/permissions.types.ts

/**
 * Per-group permission flags as returned by the agentbase.me credentials endpoint.
 * remember-mcp reads these flags to gate memory operations.
 *
 * These flags are defined and stored by agentbase.me on each group member.
 * remember-mcp MUST NOT modify, cache long-term, or duplicate this data.
 */
export interface MemberPermissions {
  auth_level: number           // 0 = root/owner, increments up. Lower = more authority
  can_read: boolean
  can_publish: boolean
  can_revise: boolean          // Revise others' published content
  can_propose: boolean         // Propose changes for approval
  can_overwrite: boolean       // Force-replace content
  can_comment: boolean
  can_retract_own: boolean
  can_retract_any: boolean     // Retract any member's content
  can_manage_members: boolean  // Not used by remember-mcp (agentbase concern)
  can_update_properties: boolean // Not used by remember-mcp (agentbase concern)
  can_moderate: boolean        // Delete/edit messages, moderate memories
  can_kick: boolean            // Not used by remember-mcp (agentbase concern)
  can_mute: boolean            // Not used by remember-mcp (agentbase concern)
  can_ban: boolean             // Not used by remember-mcp (agentbase concern)
}

/**
 * A single group membership entry from the credentials endpoint.
 */
export interface GroupMembership {
  group_id: string
  permissions: MemberPermissions
}

/**
 * The relevant portion of the agentbase.me credentials response.
 */
export interface AgentbaseCredentials {
  access_token: string
  group_memberships: GroupMembership[]
}
```

### 2. Permission-to-Operation Mapping

Each remember-mcp memory operation maps to one or more permission flags:

| Memory Operation | Required Permission Flag | Notes |
|-----------------|------------------------|-------|
| `remember_search_memory` (in group space) | `can_read` | Read-only access to group memories |
| `remember_publish` (to group space) | `can_publish` | Create new memory in group space |
| `remember_revise` (own memory) | `can_publish` | Author can always revise their own |
| `remember_revise` (another's memory) | `can_revise` | Edit someone else's published content |
| `remember_propose` | `can_propose` | Suggest a change for approval |
| `remember_overwrite` | `can_overwrite` | Force-replace content without confirmation |
| `remember_comment` | `can_comment` | Add comments to group memories |
| `remember_retract` (own memory) | `can_retract_own` | Remove your own published memory |
| `remember_retract` (another's memory) | `can_retract_any` | Remove any member's memory |
| `remember_moderate` (delete/edit memory) | `can_moderate` | Moderation action on group memories |

**Flags NOT consumed by remember-mcp** (agentbase.me concerns only):
- `can_manage_members` — group membership management
- `can_update_properties` — group name, description, picture
- `can_kick` — remove members from group
- `can_mute` — prevent members from sending messages
- `can_ban` — permanently ban members

### 3. Credentials Client

A thin client to fetch permissions from the agentbase.me credentials endpoint. Called on every ACL-gated operation (no caching).

```typescript
// src/client/credentials.client.ts

export interface CredentialsClient {
  /**
   * Fetch the current user's group memberships and permissions.
   * Called on every ACL-gated operation — no caching.
   */
  getCredentials(jwt: string): Promise<AgentbaseCredentials>

  /**
   * Get permissions for a specific group.
   * Returns null if the user is not a member.
   */
  getGroupPermissions(
    jwt: string,
    groupId: string
  ): Promise<MemberPermissions | null>
}
```

### 4. Authorization Service

A service that sits between tool handlers and memory services, enforcing permissions.

```typescript
// src/services/authorization.service.ts

export class AuthorizationService extends BaseService {
  private credentialsClient: CredentialsClient

  /**
   * Check if a user can perform an operation on a group memory.
   * Returns Result<void, ForbiddenError> — Ok if allowed, Err if denied.
   */
  async checkPermission(
    jwt: string,
    groupId: string,
    requiredFlag: keyof MemberPermissions,
  ): Promise<Result<void, ForbiddenError>>

  /**
   * Check if a user can perform a moderation action, considering auth_level.
   * The user's auth_level must be <= the target action's acted_by_auth_level.
   */
  async checkModerationPermission(
    jwt: string,
    groupId: string,
    targetAction?: MemoryModerationAction,
  ): Promise<Result<void, ForbiddenError>>
}
```

### 5. auth_level Enforcement for Memory Moderation

When a user moderates a memory (delete, edit, retract via moderation), the action is **stamped** with the user's `auth_level`. A subsequent user can only reverse the action if their `auth_level <= acted_by_auth_level`.

```typescript
// src/types/moderation.types.ts

/**
 * Stamped moderation action on a memory.
 * Stored alongside the memory record.
 */
export interface MemoryModerationAction {
  action: 'memory_delete' | 'memory_edit' | 'memory_retract'
  memory_id: string
  acted_by_user_id: string
  acted_by_auth_level: number   // Snapshot of actor's auth_level at time of action
  created_at: string
  reversed_at?: string          // Set when action is undone
  reversed_by_user_id?: string
}
```

**Enforcement rule**: To reverse a `MemoryModerationAction`, the requesting user must have `auth_level <= acted_by_auth_level` in that group.

**Example**: An admin (`auth_level: 1`) deletes a memory. A moderator (`auth_level: 2`) with `can_moderate: true` cannot restore it — the deletion was performed at level 1. Only `auth_level` 0-1 users can reverse it.

### 6. Memory ACL Flow

```
User calls a memory tool (e.g., remember_revise)
  │
  ▼
Tool handler identifies target memory and group_id
  │
  ▼
AuthorizationService.checkPermission(jwt, groupId, 'can_revise')
  │
  ├─ Err(ForbiddenError) → return "Permission denied"
  │
  └─ Ok → determine if this is own memory or another's
       │
       ├─ Own memory → proceed (can_publish is sufficient)
       │
       └─ Another's memory → check can_revise flag
            │
            ├─ false → return "Permission denied"
            └─ true → proceed with revision
```

For moderation actions:

```
User calls remember_moderate (e.g., delete a memory)
  │
  ▼
AuthorizationService.checkPermission(jwt, groupId, 'can_moderate')
  │
  ├─ Err → return "Permission denied"
  │
  └─ Ok → check if reversing an existing moderation action?
       │
       ├─ No (new action) → execute, stamp with MemoryModerationAction
       │
       └─ Yes (reversing) → checkModerationPermission(jwt, groupId, existingAction)
            │
            ├─ user.auth_level > existingAction.acted_by_auth_level
            │   → "Cannot reverse: action performed by higher authority"
            │
            └─ user.auth_level <= existingAction.acted_by_auth_level
                → reverse action, stamp reversed_at + reversed_by_user_id
```

### 7. Space Configuration

Group memory spaces need configuration that maps to permission enforcement. This is owned by remember-mcp.

```typescript
// src/types/space.types.ts (extension)

export interface SpaceConfig {
  space_id: string
  group_id: string              // Links to agentbase.me group
  write_mode: 'owner_only' | 'group_editors' | 'anyone'
  created_at: string
  updated_at: string
}
```

`write_mode` determines how permissions are checked:
- `owner_only` — only the memory author can modify (no credentials call needed)
- `group_editors` — check `can_revise` / `can_overwrite` via credentials endpoint
- `anyone` — no permission check (open space)

---

## Benefits

- **No permission duplication**: remember-mcp reads ACL flags from agentbase.me, never stores or maps them
- **Always fresh**: Fetched per-operation, no stale caches
- **auth_level hierarchy**: Moderation actions respect authority levels, preventing lower-authority users from reversing higher-authority actions
- **Extensible**: New permission flags can be added to agentbase.me without remember-mcp code changes (only flag consumption needs updating)
- **Clean ownership**: agentbase.me owns permissions, remember-mcp owns enforcement

---

## Trade-offs

- **Network overhead**: Every ACL-gated operation requires a credentials fetch (~50-100ms). Acceptable for current scale; can add short-TTL cache later if needed
- **Credential endpoint dependency**: remember-mcp cannot function for group operations if agentbase.me is down (mitigate: graceful error handling, fall back to denying access)
- **Moderation stamp storage**: `MemoryModerationAction` records accumulate over time (mitigate: only stored for active moderation actions, cleaned up when memories are permanently deleted)
- **Unused flags**: remember-mcp receives flags it doesn't use (`can_kick`, `can_mute`, etc.) — small payload overhead, no functional impact

---

## Dependencies

- **agentbase.me credentials endpoint** (`/api/credentials/agentbase`) — must return `MemberPermissions` per group
- **agentbase.me group management tools** — defines the permission model and ACL flags
- **remember-core BaseService** — authorization service extends existing pattern
- **remember-core Result<T,E>** — permission checks return Result types
- **remember-core ForbiddenError** — used for permission denied responses

---

## Testing Strategy

**Unit Tests**:
- AuthorizationService: each permission flag correctly gates its operation
- AuthorizationService: `auth_level` comparison logic (lower = more authority)
- MemoryModerationAction: stamps capture correct `acted_by_auth_level`
- MemoryModerationAction: reversal blocked when user `auth_level > acted_by_auth_level`
- MemoryModerationAction: reversal allowed when user `auth_level <= acted_by_auth_level`
- CredentialsClient: parses `MemberPermissions` from endpoint response
- CredentialsClient: returns null for non-member

**Integration Tests**:
- End-to-end: user with `can_publish` can publish to group space
- End-to-end: user without `can_revise` cannot revise another's memory
- End-to-end: moderation stamp prevents lower-authority reversal
- End-to-end: credentials endpoint returns fresh data (no stale cache)

---

## Future Considerations

- **Short-TTL cache**: If credentials fetch latency becomes a concern, add a 30-second in-memory cache with invalidation on membership changes
- **Per-memory permission overrides**: Allow specific memories to have custom permission overrides beyond group-level flags
- **Audit log**: Record all permission-gated operations for compliance and debugging
- **Batch permission checks**: Optimize for operations touching multiple memories in one request
- **REST API exposure**: When remember-core builds its REST adapter, the authorization service can be reused for HTTP endpoints

---

**Status**: Design Specification
**Recommendation**: Implement after agentbase.me credentials endpoint returns `MemberPermissions` (agentbase task-188). The types and interfaces can be built now; the credentials client integration depends on the endpoint being ready.
**Related Documents**:
- [core-sdk.architecture.md](core-sdk.architecture.md) — remember-core architecture patterns
- [agentbase group-management-tools.md](../../../agentbase.me-e1/agent/design/local.group-management-tools.md) — ACL flag definitions and presets
- [agentbase credentials endpoint](../../../agentbase.me-e1/agent/design/local.group-acl-credentials-endpoint.md) — credentials endpoint design
- [agentbase group-credentials-for-remember-mcp.md](../../../agentbase.me-e1/agent/design/local.group-credentials-for-remember-mcp.md) — credentials response extension
