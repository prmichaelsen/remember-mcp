# Milestone 15: Moderation & Space Config

**Goal**: Implement content moderation lifecycle and per-space/group behavioral configuration
**Duration**: 2 weeks
**Dependencies**: M14 (Memory Collection Pattern v2), v3.9.0 (AuthContext foundations)
**Status**: Not Started

---

## Overview

Published memories currently appear immediately with no review step. This milestone adds a moderation status lifecycle (pending/approved/rejected/removed), a per-space/group configuration system in Firestore, and a moderator tool for content management. It builds on the AuthContext and GroupPermissions foundations from v3.9.0.

Key architectural principle: agentbase.me owns ACL ("who can moderate"), remember-mcp owns behavior ("what moderation means").

Design document: [local.moderation-and-space-config.md](../design/local.moderation-and-space-config.md)

---

## Deliverables

### 1. Moderation Schema
- `moderation_status`, `moderated_by`, `moderated_at` fields on published memories
- `can_moderate` permission in GroupPermissions type
- Null status treated as `approved` (backward compat)

### 2. SpaceConfig Service
- Firestore-backed per-space/group behavioral config
- `require_moderation: boolean`, `default_write_mode: WriteMode`
- Default fallback when no config document exists

### 3. Publish Flow Integration
- Publish sets `moderation_status` based on space/group config
- `require_moderation: true` -> `pending`; false -> `approved`

### 4. Search Moderation Filters
- `remember_search_space` and `remember_query_space` default to approved/null
- `moderation_filter` parameter for moderators
- Permission check via `authContext.credentials.can_moderate`

### 5. Moderator Tool
- `remember_moderate` tool for approve/reject/remove actions
- Permission-gated via AuthContext

### 6. Documentation
- CHANGELOG entry, README updates, design doc status update

---

## Success Criteria

- [ ] Published memories in moderated spaces start as `pending`
- [ ] Published memories in unmoderated spaces start as `approved`
- [ ] Default search only returns `approved` or `null` status memories
- [ ] Moderators can search for `pending`/`rejected`/`removed` content
- [ ] Non-moderators cannot access non-approved content via search
- [ ] `remember_moderate` tool approves/rejects/removes memories
- [ ] Existing published memories (null status) continue working
- [ ] All tests pass, build clean

---

## Key Files to Create

```
src/
├── services/
│   └── space-config.service.ts       # SpaceConfig Firestore service
│   └── space-config.service.spec.ts  # Tests
├── tools/
│   └── moderate.ts                   # remember_moderate tool
│   └── moderate.spec.ts              # Tests
```

## Key Files to Modify

```
src/
├── types/
│   └── auth.ts                       # Add can_moderate to GroupPermissions
├── schema/
│   └── v2-collections.ts             # Add moderation fields
├── tools/
│   ├── confirm.ts                    # Wire moderation into publish
│   ├── search-space.ts               # Add moderation_filter
│   └── query-space.ts                # Add moderation_filter
├── server.ts                         # Register remember_moderate
└── server-factory.ts                 # Register remember_moderate
```

---

## Tasks

1. [Task 174: Add moderation schema fields](../tasks/milestone-15-moderation-space-config/task-174-add-moderation-schema-fields.md) - Schema + type changes (2-3h)
2. [Task 175: Create SpaceConfig service](../tasks/milestone-15-moderation-space-config/task-175-create-space-config-service.md) - Firestore config service (3-4h)
3. [Task 176: Wire moderation into publish flow](../tasks/milestone-15-moderation-space-config/task-176-wire-moderation-publish-flow.md) - Publish sets moderation_status (3-4h)
4. [Task 177: Add moderation filters to search tools](../tasks/milestone-15-moderation-space-config/task-177-add-moderation-search-filters.md) - Search filtering + permission checks (4-6h)
5. [Task 178: Create remember_moderate tool](../tasks/milestone-15-moderation-space-config/task-178-create-remember-moderate-tool.md) - New MCP tool (4-6h)
6. [Task 179: Documentation and integration tests](../tasks/milestone-15-moderation-space-config/task-179-documentation-integration-tests.md) - Docs + tests (2-3h)

---

## Testing Requirements

- [ ] SpaceConfig service: default fallback, config override, missing doc handling
- [ ] Publish flow: moderation_status set correctly based on config
- [ ] Search filters: all moderation_filter values work correctly
- [ ] Permission checks: non-moderators blocked from non-approved content
- [ ] remember_moderate: approve/reject/remove actions
- [ ] Backward compat: null moderation_status treated as approved

---

## Risks and Mitigation

| Risk | Impact | Probability | Mitigation Strategy |
|------|--------|-------------|---------------------|
| Firestore read latency on publish | Medium | Low | Config rarely changes; cache in future if needed |
| Existing memories have null status | Medium | Low | Null treated as approved by design |
| Search filter complexity | Low | Medium | Well-tested filter combinations |

---

**Next Milestone**: M7 - Trust & Permissions
**Blockers**: None (v3.9.0 AuthContext foundations complete)
