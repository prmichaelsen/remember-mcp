# Task 200: Code Cleanup & Verification

**Milestone**: M17 — remember-core Migration
**Status**: not_started
**Dependencies**: Tasks 194-199 (all tool migrations complete)
**Estimated Hours**: 3-4

---

## Objective

Remove duplicated source files that are now provided by remember-core. Update all imports. Run full regression.

## Files to Remove

| File | Replaced by (core) |
|------|-------------------|
| `src/services/confirmation-token.service.ts` | `ConfirmationTokenService` |
| `src/services/preferences-database.service.ts` | `PreferencesDatabaseService` |
| `src/services/space-config.service.ts` | `getSpaceConfig` |
| `src/services/credentials-provider.ts` | `credentialsProvider` |
| `src/utils/weaviate-filters.ts` | `buildCombinedSearchFilters` etc. |
| `src/collections/dot-notation.ts` | `getCollectionName` etc. |
| `src/collections/composite-ids.ts` | `generateCompositeId` etc. |
| `src/collections/tracking-arrays.ts` | tracking array utils |
| `src/constants/content-types.ts` | `isValidContentType` etc. |

## Files to KEEP (ghost system, not in core)

- `src/types/auth.ts` — has `GhostModeContext`
- `src/types/ghost-config.ts`, `access-result.ts`
- `src/services/ghost-config.service.ts`, `trust-enforcement.ts`, `access-control.ts`, `escalation.service.ts`, `trust-validator.ts`
- `src/tools/ghost-config.ts`, `search-memory.ts`, `query-memory.ts`
- `src/utils/debug.ts`, `logger.ts`

## Process

1. Remove one file at a time
2. Update all imports that referenced the removed file to use core imports
3. `npm run build` after each removal
4. After all removals: `npm test` full regression

## Acceptance Criteria

- [ ] All listed files removed
- [ ] All imports updated to use `@prmichaelsen/remember-core`
- [ ] Ghost system files untouched and working
- [ ] `npm run build` passes with no errors
- [ ] `npm test` — all 454+ tests pass
- [ ] No unused imports or dead code remaining
- [ ] CHANGELOG updated
- [ ] Version bumped
