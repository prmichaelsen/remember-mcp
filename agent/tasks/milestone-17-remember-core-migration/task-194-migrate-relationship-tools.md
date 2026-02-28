# Task 194: Migrate Relationship Tools

**Milestone**: M17 — remember-core Migration
**Status**: not_started
**Dependencies**: Task 193 (Foundation setup)
**Estimated Hours**: 3-4

---

## Objective

Migrate 4 relationship tool handlers from inline Weaviate logic to `RelationshipService` adapters.

## Tools to Migrate

| Tool | File | Core Method |
|------|------|-------------|
| `remember_create_relationship` | `src/tools/create-relationship.ts` | `RelationshipService.create()` |
| `remember_update_relationship` | `src/tools/update-relationship.ts` | `RelationshipService.update()` |
| `remember_search_relationship` | `src/tools/search-relationship.ts` | `RelationshipService.search()` |
| `remember_delete_relationship` | `src/tools/delete-relationship.ts` | `RelationshipService.delete()` |

## Adapter Pattern

Each handler becomes ~15-20 lines:
1. Create debug logger (stays in adapter)
2. Get `relationship` service from `services` param or `createCoreServices(userId)`
3. Map MCP args to core input type
4. Call core service method
5. Add supplementary response fields (`message`, etc.) to match current JSON shape
6. Wrap in `handleToolError()` catch

## Key Requirements

- **Response shape preservation**: JSON output must be identical to current output
- **Debug logging**: `createDebugLogger()` stays in adapter layer
- **Tool definitions**: `createRelationshipTool` etc. unchanged (MCP schemas stay)
- **Error handling**: `handleToolError()` wrapper stays in adapter

## Acceptance Criteria

- [ ] All 4 relationship tool handlers delegate to RelationshipService
- [ ] Each handler is ≤25 lines
- [ ] Existing relationship tests pass without mock changes (or mocks updated)
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] Response JSON shapes match pre-migration output
