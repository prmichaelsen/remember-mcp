# Milestone 22: Admin Debugging Tools

**Status**: not_started
**Started**: —
**Estimated Weeks**: 1
**Tasks**: 5

---

## Goal

Add read-only admin MCP tools gated by `ADMIN_USER_IDS` env var, enabling privileged debugging of remember-mcp internals (Weaviate schemas, raw memories, Firestore user data, cross-tenant search) through the standard MCP tool interface via the OAuth-authenticated remember-mcp-oauth-server.

## Scope

11 new admin tools with `remember_admin_*` prefix. All read-only in v1. Admin gate checked per-request against server-side env var. Tools hidden from non-admin users when possible.

Tools:
- `remember_admin_inspect_memory`
- `remember_admin_get_weaviate_schema`
- `remember_admin_list_collections`
- `remember_admin_collection_stats`
- `remember_admin_inspect_user_preferences`
- `remember_admin_inspect_user_ghost_configs`
- `remember_admin_inspect_user_escalation_records`
- `remember_admin_inspect_user_api_tokens`
- `remember_admin_search_across_users`
- `remember_admin_health`
- `remember_admin_detect_weaviate_drift`

## Deliverables

- [ ] Admin gate utility (`isAdmin()`) with `ADMIN_USER_IDS` env var parsing
- [ ] Conditional tool registration (hide admin tools from non-admins)
- [ ] 11 admin tools registered in server.ts/server-factory.ts
- [ ] remember-core admin services (schema inspection, cross-tenant search) if needed
- [ ] Unit tests for admin gate + all admin tools
- [ ] CHANGELOG and README updated

## Success Criteria

- Non-admin users do not see admin tools in tool listing
- Non-admin calling admin tool gets permission error
- Empty `ADMIN_USER_IDS` rejects all admin calls
- All 11 tools return correct data from Weaviate/Firestore
- `detect_weaviate_drift` compares expected vs actual schema properties
- Build passes, all existing tests pass, new tests cover admin tools

## Dependencies

- Design: [local.admin-debugging-tools.md](../design/local.admin-debugging-tools.md)
- Clarification: [clarification-6-admin-debugging-tools.md](../clarifications/clarification-6-admin-debugging-tools.md)
- M21 (API Token & OAuth Access) — admin users authenticate via OAuth flow

## Tasks

- [Task 520: Admin gate infrastructure](../tasks/milestone-22-admin-debugging-tools/task-520-admin-gate-infrastructure.md)
- [Task 521: Schema and collection tools](../tasks/milestone-22-admin-debugging-tools/task-521-schema-and-collection-tools.md)
- [Task 522: Memory inspection tools](../tasks/milestone-22-admin-debugging-tools/task-522-memory-inspection-tools.md)
- [Task 523: User inspection tools](../tasks/milestone-22-admin-debugging-tools/task-523-user-inspection-tools.md)
- [Task 524: Health and drift tools](../tasks/milestone-22-admin-debugging-tools/task-524-health-and-drift-tools.md)
