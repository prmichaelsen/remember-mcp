# Milestone 20: Unified Internal Memory Tools

**Goal**: Replace separate ghost/agent tool suites with 5 unified `remember_*_internal_memory` tools driven by HTTP headers, with ghost source isolation via `ghost_owner:{type}:{id}` tags

**Started**: -
**Status**: Not Started
**Estimated Duration**: 1-2 weeks

---

## Overview

Consolidate 5 standalone ghost tools + future agent tools into 5 unified internal memory tools. Behavior is determined by platform-sent HTTP headers (`X-Internal-Type`, `X-Ghost-Type`, etc.), not by which tool is called. Ghost source isolation tags (`ghost_owner:user:alice`, `ghost_owner:space:music-lovers`) replace the redundant `ghost:{accessor_user_id}` tag.

## Deliverables

1. `InternalContext` type added to `AuthContext`
2. `'agent'` content type added to remember-core
3. Tag builder utility (`buildInternalTags`)
4. Server factory header mapping for new `X-*` headers
5. 5 unified `remember_*_internal_memory` tools
6. Existing 5 ghost tools deleted
7. Default search filters updated to exclude `agent` content type
8. Unit + integration tests

## Success Criteria

- [ ] 5 unified tools registered and functional
- [ ] Ghost memories tagged with `ghost_type:{type}` + `ghost_owner:{type}:{id}`
- [ ] Agent memories tagged with `agent` and `content_type: 'agent'`
- [ ] Search auto-scopes to current ghost source (no cross-ghost leakage)
- [ ] Tools error when no `X-Internal-Type` header is present
- [ ] Default user searches exclude both `ghost` and `agent` content types
- [ ] Old ghost tools deleted (no aliases)
- [ ] All existing tests pass, new tests cover unified tools

## Tasks

| ID | Name | Est. Hours | Status |
|----|------|-----------|--------|
| task-212 | Add InternalContext type and agent content type | 2-3 | not_started |
| task-213 | Update server factory for internal context headers | 2-3 | not_started |
| task-214 | Create tag builder utility | 2-3 | not_started |
| task-215 | Create unified internal memory tools | 6-8 | not_started |
| task-216 | Update default search filters for agent exclusion | 2-3 | not_started |
| task-217 | Delete standalone ghost tools | 1-2 | not_started |
| task-218 | Add unit and integration tests | 4-6 | not_started |

## Dependencies

- remember-core: Add `'agent'` to `ContentType` enum (may need core PR)
- Platform (agentbase.me): Send new headers (non-blocking, parallel work)

## Design Reference

- [Unified Internal Memory Tools](../design/local.unified-internal-memory-tools.md)
- [Ghost Persona System](../design/local.ghost-persona-system.md)
- [Clarification 4](../clarifications/clarification-4-internal-memory-tool-suite.md)
