# Task 217: Delete Standalone Ghost Tools

**Milestone**: M20 — Unified Internal Memory Tools
**Status**: Not Started
**Estimated Hours**: 1-2
**Dependencies**: task-215

---

## Objective

Delete the 5 standalone ghost memory tools, their test files, and all references in the server registration. Clean break — no aliases or backwards compatibility shims.

## Context

The unified internal memory tools (task-215) replace these entirely. Per design decision, existing ghost memories are acceptable to lose (no backfill). The ghost-config tool is NOT deleted — it's a separate concern.

## Steps

1. Delete tool files:
   - `src/tools/create-ghost-memory.ts`
   - `src/tools/update-ghost-memory.ts`
   - `src/tools/search-ghost-memory.ts`
   - `src/tools/query-ghost-memory.ts`
   - `src/tools/search-ghost-memory-by.ts`

2. Delete test files:
   - `src/tools/ghost-tools.spec.ts`

3. Remove ghost tool registrations from `src/server-factory.ts`:
   - Remove imports
   - Remove tool handler registrations

4. Keep `src/tools/ghost-config.ts` and `src/tools/ghost-config.spec.ts` (separate concern)

5. Update `agent/design/complete-tool-set.md` to remove ghost tools and add unified internal tools

## Verification

- [ ] 5 ghost tool files deleted
- [ ] Ghost tool test file deleted
- [ ] Ghost tool registrations removed from server-factory
- [ ] `ghost-config.ts` preserved
- [ ] No remaining imports of deleted ghost tool files
- [ ] TypeScript compiles without errors
- [ ] No dead code referencing deleted tools
