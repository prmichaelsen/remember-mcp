# Task 198: Migrate Space Search/Moderate Tools

**Milestone**: M17 — remember-core Migration
**Status**: not_started
**Dependencies**: Task 193 (Foundation setup)
**Estimated Hours**: 4-6

---

## Objective

Migrate 3 space search and moderation tools to `SpaceService` adapters.

## Tools to Migrate

| Tool | File | Core Method |
|------|------|-------------|
| `remember_search_space` | `src/tools/search-space.ts` | `SpaceService.search()` |
| `remember_query_space` | `src/tools/query-space.ts` | `SpaceService.query()` |
| `remember_moderate` | `src/tools/moderate.ts` | `SpaceService.moderate()` |

## Key Details

### search_space
- Maps directly to `SpaceService.search(input, authContext)`
- No ghost dependency (ghost filtering only on personal collections)
- Moderator permission checks handled by core service

### query_space
- **Format gap**: MCP has `format: 'detailed'|'compact'` and `include_context` options not in core's `QuerySpaceInput`
- Core returns raw results; adapter applies formatting (compact text summary vs detailed objects)
- Formatting logic stays in adapter

### moderate
- Maps to `SpaceService.moderate(input, authContext)`
- Core's AuthContext (no ghostMode) is fine — moderate doesn't use ghostMode
- Permission checking (`canModerate`, `canModerateAny`) handled by core

## Acceptance Criteria

- [ ] All 3 tools delegate to SpaceService
- [ ] query_space format/include_context options handled in adapter
- [ ] Moderator permission checks work correctly via core
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] Response JSON shapes match pre-migration output
