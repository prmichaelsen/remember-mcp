# Task 525: Remove Trust from Create/Update Tools

**Milestone**: [M23 — Trust Level Protection](../../milestones/milestone-23-trust-level-protection.md)
**Status**: Not Started
**Estimated Time**: 2-3 hours
**Dependencies**: None

---

## Objective

Remove the `trust` parameter from all MCP tool schemas and handler interfaces that currently allow direct trust assignment on memory creation or update. Trust now defaults to SECRET (5) in remember-core and can only be changed via the confirmation flow.

## Context

remember-core M80 removed trust from `CreateMemoryInput` and `UpdateMemoryInput`. The MemoryService now hardcodes `trust_score: TrustLevel.SECRET` (5) on creation. Passing trust to core will either be ignored or error. We must remove it from the MCP layer to avoid confusion.

## Steps

### 1. Update `src/tools/create-memory.ts`

- Remove `trust` from the `inputSchema.properties` object (the JSON schema exposed to MCP clients)
- Remove `trust` from the `CreateMemoryArgs` interface
- Remove `trust: args.trust` from the object passed to `memoryService.create()`
- Update the tool description: remove mention of "trust level (access control 0-1)"
- Add note in description: "Trust defaults to SECRET (level 5). Use `remember_request_set_trust_level` to change trust after creation."

### 2. Update `src/tools/update-memory.ts`

- Remove `trust` from `inputSchema.properties`
- Remove `trust` from the `UpdateMemoryArgs` interface
- Remove `trust: args.trust` from the object passed to `memoryService.update()`
- Update the tool description: remove mention of trust

### 3. Update `src/tools/create-internal-memory.ts`

- Remove `trust` from `inputSchema.properties`
- Remove `trust` from the `CreateInternalMemoryArgs` interface
- Remove `trust: args.trust` from the object passed to `memoryService.create()`

### 4. Update `src/tools/update-internal-memory.ts`

- Remove `trust` from `inputSchema.properties`
- Remove `trust` from the `UpdateInternalMemoryArgs` interface
- Remove `trust: args.trust` from the object passed to `memoryService.update()`

### 5. Update `src/types/memory.ts`

- If there's a local `Memory` interface with a `trust` field, keep it (read-only, memories still have trust) but ensure it's typed as `number` (1-5 integer)
- Remove any local input types that include `trust` for creation/update

### 6. Update Tests

- `src/tools/create-memory.spec.ts` — remove any test cases that pass `trust` to create
- `src/tools/update-memory.spec.ts` — remove test cases that pass `trust` to update
- `src/tools/internal-tools.spec.ts` — update if trust is tested there
- Verify no test regressions

---

## Verification

- [ ] `trust` not present in create-memory tool schema
- [ ] `trust` not present in update-memory tool schema
- [ ] `trust` not present in create-internal-memory tool schema
- [ ] `trust` not present in update-internal-memory tool schema
- [ ] Tool descriptions updated to reference new trust flow
- [ ] All tests pass
- [ ] TypeScript compiles without errors
