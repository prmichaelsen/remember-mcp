# Task 528: Update Trust Scale References

**Milestone**: [M23 — Trust Level Protection](../../milestones/milestone-23-trust-level-protection.md)
**Status**: Not Started
**Estimated Time**: 2-3 hours
**Dependencies**: [Task 525](task-525-remove-trust-from-create-update.md)

---

## Objective

Update all references to the trust scale from the legacy 0-1 float to the new 1-5 integer scale across tool descriptions, validators, types, and tests.

## Context

remember-core migrated trust from a 0-1 float to a 1-5 integer enum:
- 1 = PUBLIC
- 2 = INTERNAL
- 3 = CONFIDENTIAL
- 4 = RESTRICTED
- 5 = SECRET

The old scale (0 = no trust, 1 = full trust) is inverted from the new scale (1 = most visible, 5 = most restricted). All MCP tool descriptions, local validators, and types must be updated.

## Steps

### 1. Update Tool Descriptions

Search all `src/tools/*.ts` for trust references in tool descriptions. Key files:
- `search-memory.ts` — trust filter descriptions
- `query-memory.ts` — trust filter descriptions
- `search-by.ts` — trust filter
- `search-internal-memory-by.ts` — trust filter
- `search-space-by.ts` — trust references
- `get-core.ts` — trust in output descriptions
- `ghost-config.ts` — trust level descriptions
- `set-preference.ts` — trust-related preferences

Update descriptions from "0-1" to "1-5 integer" with the level names.

### 2. Update `src/services/trust-validator.ts`

This local file may still reference the 0-1 scale. Check if it's still used or if remember-core's `validateTrustAssignment` / `suggestTrustLevel` have replaced it. If local, update to 1-5 scale. If duplicated from core, remove and import from core.

### 3. Update `src/services/trust-validator.spec.ts`

Update test expectations to match 1-5 scale.

### 4. Update `src/types/memory.ts`

- Update any `trust` field type annotations or comments from "0-1" to "1-5 integer"
- If there are local TrustLevel constants, replace with imports from remember-core

### 5. Update Search Filter Schemas

Any tool that accepts `min_trust` or `max_trust` filters:
- Update `minimum`/`maximum` from 0/1 to 1/5
- Update descriptions to reference integer scale

### 6. Update Tests

- Update any test assertions that use 0-1 trust values to use 1-5
- Update test data generators if they produce trust values

---

## Verification

- [ ] No references to "0-1" trust scale in tool descriptions
- [ ] All trust filter schemas use minimum: 1, maximum: 5
- [ ] Trust validator uses 1-5 scale
- [ ] All tests pass with updated trust values
- [ ] TypeScript compiles without errors
