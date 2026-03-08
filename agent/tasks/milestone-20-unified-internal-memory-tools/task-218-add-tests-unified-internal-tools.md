# Task 218: Add Unit and Integration Tests

**Milestone**: M20 — Unified Internal Memory Tools
**Status**: Not Started
**Estimated Hours**: 4-6
**Dependencies**: task-214, task-215, task-216, task-217

---

## Objective

Add comprehensive unit and integration tests for the unified internal memory tool suite, covering tag building, search auto-scoping, context validation, and ghost source isolation.

## Context

Tests must verify the core guarantees of the unified tool architecture: correct tagging per ghost/agent type, auto-scoping that prevents cross-ghost leakage, error behavior without internal context, and agent exclusion from default searches.

## Design Reference

- [Unified Internal Memory Tools — Testing Strategy](../design/local.unified-internal-memory-tools.md)

## Steps

### Unit Tests

1. `src/utils/internal-tags.spec.ts` — Tag builder:
   - Returns `['agent']` for agent context
   - Returns correct tags for user ghost (ghost, ghost_type:user, ghost_owner:user:{id})
   - Returns correct tags for space ghost (ghost, ghost_type:space, ghost_owner:space:{id})
   - Returns correct tags for group ghost (ghost, ghost_type:group, ghost_owner:group:{id})
   - Returns `[]` for no internal context

2. `src/tools/internal-tools.spec.ts` — Unified tools:
   - Create tool errors without internalContext
   - Create tool sets content_type from internalContext.type
   - Create tool applies buildInternalTags for auto-tags
   - Search tool auto-scopes to current ghost source tags
   - Search tool filters by correct content_type
   - Update tool only updates matching content_type memories
   - Query tool auto-scopes like search

3. `src/tools/search-by.spec.ts` — Updated default filter tests:
   - Verify `agent` content type excluded from default searches
   - Verify existing `ghost` exclusion unchanged

### Integration Tests (e2e)

4. Ghost source isolation test:
   - Create memory as alice's ghost → verify ghost_owner:user:alice tag
   - Create memory as carol's ghost → verify ghost_owner:user:carol tag
   - Search as alice's ghost → only sees alice's ghost memories
   - Search as carol's ghost → only sees carol's ghost memories

5. Agent isolation test:
   - Create agent memory → verify content_type: 'agent' and agent tag
   - Default search → does not return agent memories
   - Internal search with agent context → returns agent memories

## Verification

- [ ] Tag builder unit tests pass for all permutations
- [ ] Tool error behavior tested (no context → error)
- [ ] Ghost source isolation verified (no cross-ghost leakage)
- [ ] Agent exclusion from default search verified
- [ ] All existing tests still pass
- [ ] Test coverage adequate for new code
