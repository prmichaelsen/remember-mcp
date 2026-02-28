# Task 196: Migrate Memory Tools

**Milestone**: M17 — remember-core Migration
**Status**: not_started
**Dependencies**: Task 193 (Foundation setup)
**Estimated Hours**: 3-4

---

## Objective

Migrate 3 non-ghost memory tool handlers to `MemoryService` adapters.

## Tools to Migrate

| Tool | File | Core Method |
|------|------|-------------|
| `remember_create_memory` | `src/tools/create-memory.ts` | `MemoryService.create()` |
| `remember_update_memory` | `src/tools/update-memory.ts` | `MemoryService.update()` |
| `remember_find_similar` | `src/tools/find-similar.ts` | `MemoryService.findSimilar()` |

## NOT Migrated (deferred — ghost-dependent)

- `remember_search_memory` — uses `buildTrustFilter()`, ghost exclusion
- `remember_query_memory` — uses `buildTrustFilter()`, ghost exclusion

## Key Gaps

### create_memory
- `structured_content` and `skip_template_suggestion` args exist in MCP but NOT in core's `CreateMemoryInput`. Handle in adapter layer (pass through to response, not to core).
- `context_summary` default differs: MCP uses `'Memory created via MCP'`, core uses `'Memory created'`. Set explicitly in adapter.

### find_similar
- **Ghost exclusion**: MCP applies `content_type != 'ghost'` filter. Core doesn't exclude ghosts. Post-filter ghost results in adapter.

### update_memory
- `structured_content` may exist in MCP args but not core input. Handle in adapter.

## Acceptance Criteria

- [ ] All 3 memory tool handlers delegate to MemoryService
- [ ] Ghost exclusion in find_similar handled via post-filtering
- [ ] `structured_content` and `skip_template_suggestion` handled in adapter
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] Response JSON shapes match pre-migration output
