# Task 519: Tests and Documentation

**Milestone**: M21 — API Token & OAuth Access
**Status**: not_started
**Estimated Hours**: 2-3
**Dependencies**: Task 515, Task 516, Task 517, Task 518

---

## Objective

Add unit tests for all new auth modules and update documentation (CHANGELOG, README).

## Steps

1. **Unit tests** — create `src/auth/*.spec.ts`:
   - `config-resolver.spec.ts`:
     - Project config overrides global config
     - Global config overrides env vars
     - Env vars override file values when both present
     - Missing file handled gracefully
     - Missing required values throws descriptive error
   - `oauth-exchange.spec.ts`:
     - Successful exchange returns JWT
     - Invalid token → descriptive error
     - Network failure → descriptive error
     - `extractUserId` extracts `sub` claim
     - Missing `sub` throws
   - `oauth-bootstrap.spec.ts`:
     - Full flow: resolve → exchange → extract
     - Config resolution failure → clear error
     - Exchange failure → clear error
   - Mock `fetch` for exchange tests (no real network calls)

2. **Existing tests** — verify all pass unchanged (service mode regression)

3. **CHANGELOG.md** — add entry for OAuth auth scheme support

4. **README.md** — add section:
   - New env vars (`REMEMBER_AUTH_SCHEME`, `REMEMBER_OAUTH_ENDPOINT`, `REMEMBER_API_TOKEN`)
   - `.agentbase/config` file format and resolution order
   - Example: running locally with Claude Code

5. **Version bump** — minor version (feature addition, no breaking changes)

## Verification

- [ ] All new tests pass
- [ ] All existing tests pass (no regression)
- [ ] CHANGELOG updated
- [ ] README documents new auth scheme
- [ ] Version bumped
- [ ] Build passes
- [ ] TypeScript compiles
