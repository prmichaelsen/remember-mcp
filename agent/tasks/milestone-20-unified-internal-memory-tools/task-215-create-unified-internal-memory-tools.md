# Task 215: Create Unified Internal Memory Tools

**Milestone**: M20 — Unified Internal Memory Tools
**Status**: Not Started
**Estimated Hours**: 6-8
**Dependencies**: task-212, task-213, task-214

---

## Objective

Create 5 unified `remember_*_internal_memory` tools that replace the 5 standalone ghost tools. Behavior is driven by `AuthContext.internalContext` (populated from HTTP headers).

## Context

The existing ghost tools (`create-ghost-memory.ts`, `update-ghost-memory.ts`, `search-ghost-memory.ts`, `query-ghost-memory.ts`, `search-ghost-memory-by.ts`) hardcode ghost-specific behavior. The unified tools generalize this pattern so both ghost and agent memories use the same tool implementations, with behavior determined by the `InternalContext`.

## Design Reference

- [Unified Internal Memory Tools — Full Implementation section](../design/local.unified-internal-memory-tools.md)
- Existing ghost tools in `src/tools/` for reference patterns

## Steps

1. Create `src/tools/create-internal-memory.ts`:
   - Accept same params as `create-ghost-memory` but without ghost-specific hardcoding
   - Read `internalContext` from `authContext` to determine `content_type` (`'ghost'` or `'agent'`)
   - Use `buildInternalTags(authContext)` for auto-tags
   - Error if no `internalContext` present: "Internal context required. X-Internal-Type header must be set."
   - Write to accessor's collection (same as current ghost behavior)

2. Create `src/tools/update-internal-memory.ts`:
   - Same pattern: derive content_type and tags from `internalContext`
   - Error without internal context

3. Create `src/tools/search-internal-memory.ts`:
   - Auto-scope search to current ghost source via `buildInternalTags` scope tags
   - Filter by `content_type` matching `internalContext.type`
   - No override allowed for scope tags

4. Create `src/tools/query-internal-memory.ts`:
   - Same auto-scoping as search
   - RAG query within scoped ghost/agent memories

5. Create `src/tools/search-internal-memory-by.ts`:
   - Same auto-scoping
   - Support all modes: byTime, byRating, byProperty, byBroad, byRandom, byDensity, byMood, bySignificance
   - Copy mode definitions from existing `search-ghost-memory-by.ts`

6. Register all 5 tools in `src/server-factory.ts` tool registration

7. Use descriptive tool descriptions that explain the unified behavior:
   - "Creates an internal memory (ghost observation or agent note) based on the current session context."
   - Make clear these tools are for platform-internal use only

## Verification

- [ ] All 5 tools created and registered
- [ ] Tools error when `internalContext` is missing
- [ ] Ghost mode: creates memories with `content_type: 'ghost'` and source-specific tags
- [ ] Agent mode: creates memories with `content_type: 'agent'` and `agent` tag
- [ ] Search tools auto-scope to current ghost source
- [ ] Search tools filter by correct content_type
- [ ] All search modes (byTime, byRating, etc.) work for internal memories
- [ ] TypeScript compiles without errors
