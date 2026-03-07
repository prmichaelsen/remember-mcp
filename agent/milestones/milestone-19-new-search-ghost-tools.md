# Milestone 19: New Search Modes, Ghost Tools & Emotional Exposure

**Status**: Not Started
**Created**: 2026-03-07
**Estimated Duration**: 2-3 weeks
**Tasks**: 9
**Depends On**: remember-core service implementations

---

## Goal

Expand remember-mcp's MCP tool layer with new search modes, a dedicated ghost memory tool suite, emotional dimension exposure, and core mood introspection. All underlying service logic is built in remember-core; this milestone focuses on MCP tool definitions (descriptions, input schemas) and thin handler adapters.

## Key Deliverables

- `remember_search_by` tool with 8 modes (byTime, byDensity, byRating, byDiscovery, byProperty, bySignificance, byBroad, byRandom)
- 5 ghost memory tools (create, update, search, query, search_by) with hardcoded content_type and tags
- `remember_get_core` tool for mood + perception introspection
- `remember_search_space_by` tool for space-specific search modes
- Schema enhancements: 31 `feel_*` fields on create/update, new filters on search tools, emotional composites in results
- Tool count: 21 -> 29 tools

## Success Criteria

- [ ] All 8 new tools registered in server-factory.ts
- [ ] All tool handlers delegate to remember-core services (thin adapters, 10-20 lines each)
- [ ] Ghost tools hardcode content_type: 'ghost' and ghost-specific tags
- [ ] `feel_*` fields accepted on create_memory and update_memory
- [ ] Search results include emotional composites when available
- [ ] Existing tool schemas updated with new filters
- [ ] Unit tests for all new tools
- [ ] Build passing, TypeScript clean

## Design Document

- remember-core: `agent/design/local.new-search-tools.md` (authoritative source)

## Phases

1. **Phase 1**: `remember_search_by` + filter updates (tasks 203-204)
2. **Phase 2**: Emotional dimension exposure (tasks 205-207)
3. **Phase 3**: New core modes — byBroad, byRandom (task 208)
4. **Phase 4**: Ghost memory tool suite (task 209)
5. **Phase 5**: Core mood/perception introspection (task 210)
6. **Phase 6**: Space variant (task 211)
