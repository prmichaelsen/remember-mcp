# Task 184: Permission Tools (5 tools)

**Milestone**: M7 — Trust & Permissions
**Status**: deferred
**Deferred Reason**: Cross-user access will use ghost/persona model instead of direct permission tools. See clarification-2-cross-user-access-model.md.
**Dependencies**: Task 181 (Firestore), Task 183 (access control)

---

## Objective

Implement 5 new MCP tools for managing cross-user permissions. Register in both server.ts and server-factory.ts.

## Deliverables

### 1. `src/tools/grant-access.ts` — `remember_grant_access`

Grant another user access to your memories:
- **Required**: `accessor_user_id`, `trust_level` (0-1)
- **Optional**: `access_scope` ('all' | 'tagged'), `allowed_tags`, `excluded_tags`, `expires_at`
- Validates trust level range
- Creates/updates permission in Firestore
- Logs grant action

### 2. `src/tools/revoke-access.ts` — `remember_revoke_access`

Revoke access from a user:
- **Required**: `accessor_user_id`
- **Optional**: `reason`
- Soft-revokes permission (sets revoked: true, keeps record)
- Also clears any active blocks for this accessor
- Logs revoke action

### 3. `src/tools/list-accessors.ts` — `remember_list_accessors`

List who has access to your memories:
- **Optional**: `include_revoked` (default: false)
- Returns list of permissions with trust levels
- Shows access counts and last accessed

### 4. `src/tools/reset-block.ts` — `remember_reset_block`

Reset a memory-specific block (after escalation prevention triggered):
- **Required**: `accessor_user_id`, `memory_id`
- Removes block from Firestore
- Optionally adjusts trust level back
- Logs reset action

### 5. `src/tools/get-access-logs.ts` — `remember_get_access_logs`

View access attempt history:
- **Optional**: `accessor_user_id`, `date_from`, `date_to`, `limit` (default: 50)
- Returns chronological log entries
- Includes granted, denied, and blocked attempts

### 6. Registration

Add all 5 tools to:
- `src/server.ts` — switch statement (tools 21-25)
- `src/server-factory.ts` — switch statement (tools 21-25)

### 7. Tests

- `src/tools/grant-access.spec.ts` — grant, update existing, validation
- `src/tools/revoke-access.spec.ts` — revoke, already revoked
- `src/tools/list-accessors.spec.ts` — list, filter revoked
- `src/tools/reset-block.spec.ts` — reset, not blocked
- `src/tools/get-access-logs.spec.ts` — query with filters

## Acceptance Criteria

- [ ] All 5 tools registered and functional
- [ ] Grant creates/updates permissions
- [ ] Revoke soft-deletes permissions
- [ ] List shows current accessors
- [ ] Reset clears blocks
- [ ] Logs queryable with filters
- [ ] All tools pass authContext through
- [ ] All tests pass
