# Task 514: remember-mcp — Consume Synthetic Core Space

**Milestone**: M76 — Synthetic Core Space
**Status**: not_started
**Estimated Hours**: 2
**Dependencies**: T511, T512, T513 (remember-core synthetic space implementation)
**Repo**: remember-mcp (tracked here for planning, implemented in remember-mcp)

---

## Objective

Update remember-mcp to include the `'core'` synthetic space in tool descriptions and wire the ghost to automatically retrieve its mood/perception state via `spaces: ['core']` searches.

## Context

Once remember-core ships M76 (T511-T513), `spaces: ['core']` will return synthetic memory-shaped results (mood, perception) from SpaceService. remember-mcp needs to:
1. Include `'core'` in the `remember_search_memory` tool description so the ghost knows it exists
2. Optionally auto-inject `'core'` into ghost searches so mood is retrieved transparently

remember-core exports `SYNTHETIC_SPACES`, `SYNTHETIC_SPACE_DESCRIPTIONS`, and `SYNTHETIC_SPACE_DISPLAY_NAMES` from `src/types/index.ts`.

## Steps

### 1. Update tool description generation

In the `remember_search_memory` tool definition, import and include synthetic space descriptions alongside real space descriptions:

```typescript
import { SPACE_DESCRIPTIONS, SYNTHETIC_SPACE_DESCRIPTIONS } from '@prmichaelsen/remember-core/types';

// In tool description:
// Available spaces: the_void (public), profiles (user profiles), core (internal state — mood, perception)
```

Append synthetic spaces to the space list in the tool's `description` field so the LLM knows `'core'` is a valid option.

### 2. Ghost system prompt — mention core space

In the ghost system prompt construction, add a line like:

```
You can search the 'core' space to check your current mood and internal state.
```

This primes the ghost to use `spaces: ['core']` when it wants to introspect.

### 3. (Optional) Auto-inject core into ghost searches

If the ghost should always have mood context, the handler could auto-inject `'core'` into every ghost search:

```typescript
if (isGhostContext && !spaces.includes('core')) {
  spaces = ['core', ...spaces];
}
```

This ensures mood is always present without the ghost needing to explicitly request it. Consider making this configurable via ghost config.

### 4. Handle missing synthetic registry gracefully

If remember-core is at a version without synthetic space support, the `'core'` space will be silently stripped (no registry = no results). Tool descriptions should still include it — it just returns nothing until the consumer upgrades remember-core.

## Verification

- [ ] `remember_search_memory` tool description lists `'core'` as an available space
- [ ] Ghost system prompt mentions core space for introspection
- [ ] Ghost can search `spaces: ['core']` and receive mood/perception results
- [ ] `spaces: ['core', 'the_void']` returns both mood + real memories
- [ ] Graceful degradation if remember-core doesn't have synthetic support yet
- [ ] No changes needed to `remember_create_memory` — `'core'` is read-only (publish guard in remember-core)
