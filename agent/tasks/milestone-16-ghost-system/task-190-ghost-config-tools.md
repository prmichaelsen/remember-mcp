# Task 190: Ghost Configuration MCP Tools

**Milestone**: M16 — Ghost System
**Status**: not_started
**Dependencies**: Task 187 (GhostConfig Firestore)

---

## Objective

Create MCP tools for users to manage their ghost configuration (enable/disable, set trust, block users).

## Deliverables

### 1. `remember_ghost_config` tool

- **get**: Returns current ghost config for the user
- **set**: Update ghost config fields (enabled, public_ghost_enabled, enforcement_mode, default_friend_trust, default_public_trust)
- Validation: trust levels 0-1, enforcement_mode enum

### 2. `remember_ghost_trust` tool

- **set_trust**: Set per-user trust level (`per_user_trust[targetUserId] = level`)
- **block**: Add user to blocked_users
- **unblock**: Remove user from blocked_users
- **list**: List per-user trust overrides and blocked users

### 3. Integration

- Register tools in server.ts and server-factory.ts
- Add tool descriptions with LLM-friendly documentation

### 4. Tests

- Config get/set operations
- Trust management operations
- Validation (bounds, enum values)

## Acceptance Criteria

- [ ] Users can enable/disable ghost via MCP tool
- [ ] Users can set per-user trust levels
- [ ] Users can block/unblock users
- [ ] Tool descriptions guide LLM usage
- [ ] Tests pass
