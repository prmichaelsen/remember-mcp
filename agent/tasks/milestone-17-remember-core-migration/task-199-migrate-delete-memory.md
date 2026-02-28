# Task 199: Migrate delete_memory Tool

**Milestone**: M17 — remember-core Migration
**Status**: not_started
**Dependencies**: Task 193 (Foundation setup), Task 197 (confirm.ts migration)
**Estimated Hours**: 2-3

---

## Objective

Migrate the delete_memory tool to use core services while preserving the two-phase confirmation flow.

## Tool to Migrate

| Tool | File | Core Methods |
|------|------|-------------|
| `remember_delete_memory` | `src/tools/delete-memory.ts` | `MemoryService` (fetch/validate) + `ConfirmationTokenService` (token) |

## Two-Phase Pattern

**Phase 1** (`handleDeleteMemory`):
1. Use `MemoryService` to fetch and validate the memory (ownership, doc_type, not-deleted checks)
2. Detect orphaned relationships (relationships that would be orphaned by deletion)
3. Use `ConfirmationTokenService` from core to create confirmation token
4. Return token preview to user

**Phase 2** (in `confirm.ts`, already migrated in Task 197):
- Use `MemoryService.delete()` for soft-delete when token is confirmed

## Key Requirement

- The confirmation token flow MUST be preserved — no direct deletion
- Orphan detection logic may need to stay in adapter if core doesn't provide it

## Acceptance Criteria

- [ ] Phase 1 uses core services for fetch/validate and token creation
- [ ] Phase 2 (in confirm.ts) uses MemoryService.delete()
- [ ] Orphan detection still works
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] Response JSON shapes match pre-migration output
