# Milestone 17: remember-core Migration

**Goal**: Migrate remember-mcp tool handlers from inline business logic to remember-core service calls
**Duration**: 2-3 weeks
**Dependencies**: M16 (Ghost System complete), remember-core v0.12.0 published
**Status**: Not Started

---

## Overview

remember-mcp has 21 tool handlers with 50-200 lines of inline business logic each (Weaviate queries, validation, CRUD operations). remember-core (`@prmichaelsen/remember-core` v0.12.0) extracts that logic into 5 DI services (MemoryService, RelationshipService, SpaceService, PreferencesDatabaseService, ConfirmationTokenService) with 120 passing tests.

This milestone migrates 18 of 21 tools to use remember-core as their business logic layer, reducing each tool handler to a thin 10-20 line adapter. 3 tools (search_memory, query_memory, ghost_config) are deferred — they depend on ghost/trust features not yet in remember-core.

Migration guide: `/home/prmichaelsen/.acp/projects/remember-core/docs/migration-guide.md`

---

## Deliverables

### 1. Foundation Layer
- Install `@prmichaelsen/remember-core` as dependency
- Create `src/core-services.ts` — service initialization bridge
- Wire core services into `server-factory.ts` and `server.ts`

### 2. Tool Handler Migration (18 tools)
- Relationship tools (4): create, update, search, delete → `RelationshipService`
- Preference tools (2): get, set → `PreferencesDatabaseService`
- Memory tools (3): create, update, find_similar → `MemoryService`
- Space confirmation tools (5): publish, retract, revise, confirm, deny → `SpaceService`
- Space search/moderate tools (3): search_space, query_space, moderate → `SpaceService`
- Delete memory (1): delete_memory → `MemoryService` + `ConfirmationTokenService`

### 3. Code Cleanup
- Remove duplicated source files now provided by remember-core
- Update imports across codebase
- Verify no broken references

### 4. Deferred (out of scope)
- `search_memory` — requires ghost/trust support in core
- `query_memory` — requires ghost/trust support in core
- `ghost_config` — no core equivalent

---

## Success Criteria

- [ ] 18 of 21 tool handlers delegate to remember-core services
- [ ] Each migrated handler is ≤30 lines (thin adapter pattern)
- [ ] All 454+ tests pass after migration
- [ ] Build succeeds with no TypeScript errors
- [ ] Response shapes unchanged (backwards compatible)
- [ ] Duplicated source files removed
- [ ] 3 deferred tools (search_memory, query_memory, ghost_config) still work unchanged

---

## Key Files to Create

```
src/
├── core-services.ts              # Service initialization bridge
```

## Key Files to Modify

```
src/
├── server-factory.ts             # Wire core services into registerHandlers
├── server.ts                     # Wire core services (standalone mode)
├── tools/
│   ├── create-memory.ts          # → MemoryService.create()
│   ├── update-memory.ts          # → MemoryService.update()
│   ├── find-similar.ts           # → MemoryService.findSimilar()
│   ├── delete-memory.ts          # → MemoryService.delete() + tokens
│   ├── create-relationship.ts    # → RelationshipService.create()
│   ├── update-relationship.ts    # → RelationshipService.update()
│   ├── search-relationship.ts    # → RelationshipService.search()
│   ├── delete-relationship.ts    # → RelationshipService.delete()
│   ├── get-preferences.ts        # → PreferencesDatabaseService
│   ├── set-preference.ts         # → PreferencesDatabaseService
│   ├── publish.ts                # → SpaceService.publish()
│   ├── retract.ts                # → SpaceService.retract()
│   ├── revise.ts                 # → SpaceService.revise()
│   ├── confirm.ts                # → SpaceService.confirm() + MemoryService.delete()
│   ├── deny.ts                   # → SpaceService.deny()
│   ├── moderate.ts               # → SpaceService.moderate()
│   ├── search-space.ts           # → SpaceService.search()
│   └── query-space.ts            # → SpaceService.query()
```

## Key Files to Remove (Phase 5)

```
src/
├── services/
│   ├── confirmation-token.service.ts    # → core ConfirmationTokenService
│   ├── preferences-database.service.ts  # → core PreferencesDatabaseService
│   ├── space-config.service.ts          # → core getSpaceConfig
│   └── credentials-provider.ts          # → core credentialsProvider
├── utils/
│   └── weaviate-filters.ts              # → core filter utilities
├── collections/
│   ├── dot-notation.ts                  # → core getCollectionName
│   ├── composite-ids.ts                 # → core generateCompositeId
│   └── tracking-arrays.ts              # → core tracking array utils
└── constants/
    └── content-types.ts                 # → core isValidContentType
```

---

## Tasks

1. [Task 193: Foundation setup](../tasks/milestone-17-remember-core-migration/task-193-foundation-setup.md) - Install core, create service init, wire server-factory (2-3h)
2. [Task 194: Migrate relationship tools](../tasks/milestone-17-remember-core-migration/task-194-migrate-relationship-tools.md) - 4 tools → RelationshipService (3-4h)
3. [Task 195: Migrate preference tools](../tasks/milestone-17-remember-core-migration/task-195-migrate-preference-tools.md) - 2 tools → PreferencesDatabaseService (2-3h)
4. [Task 196: Migrate memory tools](../tasks/milestone-17-remember-core-migration/task-196-migrate-memory-tools.md) - 3 tools → MemoryService (3-4h)
5. [Task 197: Migrate space confirmation tools](../tasks/milestone-17-remember-core-migration/task-197-migrate-space-confirmation-tools.md) - publish, retract, revise, confirm, deny → SpaceService (6-8h)
6. [Task 198: Migrate space search/moderate tools](../tasks/milestone-17-remember-core-migration/task-198-migrate-space-search-moderate.md) - search_space, query_space, moderate → SpaceService (4-6h)
7. [Task 199: Migrate delete_memory tool](../tasks/milestone-17-remember-core-migration/task-199-migrate-delete-memory.md) - delete_memory → MemoryService + ConfirmationTokenService (2-3h)
8. [Task 200: Code cleanup & verification](../tasks/milestone-17-remember-core-migration/task-200-code-cleanup-verification.md) - Remove duplicated files, full regression (3-4h)

---

## Risks and Mitigation

| Risk | Impact | Probability | Mitigation Strategy |
|------|--------|-------------|---------------------|
| Response shape changes break LLM behavior | High | Medium | Every adapter must match current JSON output exactly |
| Test mock breakage from refactor | Medium | High | Update mocks from inline Weaviate calls to core service methods |
| Double Firestore initialization | High | Low | Only use remember-mcp's existing initFirestore(), never core's |
| ensureMemoryCollection ordering | Medium | Medium | Call in createCoreServices() before constructing services |
| Singleton vs instance pattern mismatch | Medium | Medium | Create ConfirmationTokenService and PreferencesDatabaseService once in core-services.ts |

---

**Next Milestone**: Ghost/trust support in remember-core (enables deferred tools migration)
**Blockers**: None (remember-core v0.12.0 published and ready)
