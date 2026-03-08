# Task 216: Update Default Search Filters for Agent Exclusion

**Milestone**: M20 — Unified Internal Memory Tools
**Status**: Not Started
**Estimated Hours**: 2-3
**Dependencies**: task-212

---

## Objective

Update default search/query tools (`remember_search_memory`, `remember_query_memory`, `remember_search_by`) to exclude `agent` content type from results, matching the existing `ghost` exclusion pattern.

## Context

Default user searches already exclude `content_type: 'ghost'` so ghost memories don't appear in normal memory browsing. The same pattern must be applied to `content_type: 'agent'` so agent observations don't pollute user search results.

## Design Reference

- [Unified Internal Memory Tools — Section 5: Content Type](../design/local.unified-internal-memory-tools.md)

## Steps

1. Locate the existing ghost content_type exclusion filter in search tools (likely in `src/tools/search-memory.ts`, `query-memory.ts`, `search-by.ts`)

2. Add `'agent'` to the exclusion list alongside `'ghost'`:
   ```typescript
   // Before: filter out ghost
   types: excludeTypes(['ghost', 'comment', ...])
   // After: filter out ghost AND agent
   types: excludeTypes(['ghost', 'agent', 'comment', ...])
   ```

3. Also check `remember_search_space` and `remember_query_space` — agent memories should not appear in space searches either

4. Verify that the internal memory tools (task-215) do NOT apply this exclusion (they explicitly filter FOR their content type)

## Verification

- [ ] `remember_search_memory` excludes `agent` content type
- [ ] `remember_query_memory` excludes `agent` content type
- [ ] `remember_search_by` excludes `agent` content type
- [ ] Space search tools exclude `agent` content type
- [ ] Internal memory tools still return `agent`/`ghost` results correctly
- [ ] Existing ghost exclusion unchanged
- [ ] Existing tests updated/pass
