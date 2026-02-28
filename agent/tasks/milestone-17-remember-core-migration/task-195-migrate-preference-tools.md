# Task 195: Migrate Preference Tools

**Milestone**: M17 — remember-core Migration
**Status**: not_started
**Dependencies**: Task 193 (Foundation setup)
**Estimated Hours**: 2-3

---

## Objective

Migrate 2 preference tool handlers from static method calls to `PreferencesDatabaseService` instance methods.

## Tools to Migrate

| Tool | File | Core Method |
|------|------|-------------|
| `remember_get_preferences` | `src/tools/get-preferences.ts` | `PreferencesDatabaseService.getPreferences()` |
| `remember_set_preference` | `src/tools/set-preference.ts` | `PreferencesDatabaseService.updatePreferences()` |

## Key Differences

- **Static → Instance**: remember-mcp uses `PreferencesDatabaseService.getPreferences(userId)` (static). Core uses `preferencesService.getPreferences(userId)` (instance method).
- **Category filtering**: `get_preferences` does category filtering in the tool handler. This presentation logic stays in the adapter.
- **formatPreferenceChangeMessage()**: MCP-specific helper stays in adapter.

## Acceptance Criteria

- [ ] Both preference tool handlers delegate to core PreferencesDatabaseService
- [ ] Category filtering preserved in get_preferences adapter
- [ ] `formatPreferenceChangeMessage()` still used in set_preference
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] Response JSON shapes match pre-migration output
