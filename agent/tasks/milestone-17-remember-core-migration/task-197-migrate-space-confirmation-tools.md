# Task 197: Migrate Space Confirmation Tools

**Milestone**: M17 — remember-core Migration
**Status**: not_started
**Dependencies**: Task 193 (Foundation setup)
**Estimated Hours**: 6-8

---

## Objective

Migrate 5 space confirmation-flow tools to `SpaceService` adapters. This is the most complex task — `confirm.ts` is 1180 lines with 4 action branches.

## Tools to Migrate

| Tool | File | Core Method |
|------|------|-------------|
| `remember_publish` | `src/tools/publish.ts` | `SpaceService.publish()` |
| `remember_retract` | `src/tools/retract.ts` | `SpaceService.retract()` |
| `remember_revise` | `src/tools/revise.ts` | `SpaceService.revise()` |
| `remember_confirm` | `src/tools/confirm.ts` | `SpaceService.confirm()` + `MemoryService.delete()` |
| `remember_deny` | `src/tools/deny.ts` | `SpaceService.deny()` |

## Key Complexity: confirm.ts

`confirm.ts` dispatches to 4 action executors:
- `executePublishMemory` → `SpaceService.confirm()` (action: publish_memory)
- `executeDeleteMemory` → `MemoryService.delete()` (core does direct soft-delete)
- `executeRetractMemory` → `SpaceService.confirm()` (action: retract_memory)
- `executeReviseMemory` → `SpaceService.confirm()` (action: revise_memory)

**Critical**: Core's `SpaceService.confirm()` handles publish/retract/revise. For delete_memory, use `MemoryService.delete()` since confirmation token was already validated.

## Error Handling

- MCP tools return verbose JSON error responses (`{ success: false, error: '...', message: '...' }`)
- Core throws errors
- Adapters must catch core errors and format into expected JSON responses

## Acceptance Criteria

- [ ] publish, retract, revise generate tokens via SpaceService
- [ ] confirm delegates to SpaceService.confirm() for publish/retract/revise
- [ ] confirm delegates to MemoryService.delete() for delete_memory action
- [ ] deny delegates to SpaceService.deny()
- [ ] Error responses match current JSON format
- [ ] `npm run build` passes
- [ ] `npm test` passes (especially confirm-publish-moderation tests)
- [ ] Response JSON shapes match pre-migration output
