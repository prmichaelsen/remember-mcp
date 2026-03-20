# Task 529: Version Bump and Release

**Milestone**: [M23 — Trust Level Protection](../../milestones/milestone-23-trust-level-protection.md)
**Status**: Not Started
**Estimated Time**: 2-3 hours
**Dependencies**: [Task 525](task-525-remove-trust-from-create-update.md), [Task 526](task-526-add-request-set-trust-level-tool.md), [Task 527](task-527-update-confirm-deny-secret-token.md), [Task 528](task-528-update-trust-scale-references.md)

---

## Objective

Update remember-core dependency to >= 0.72.0, bump remember-mcp to 4.0.0 (major breaking), update CHANGELOG, ensure all tests pass.

## Context

This is a major version bump because:
- `trust` parameter removed from create/update tools (breaking for any consumer passing trust)
- Trust scale changed from 0-1 to 1-5 (breaking for any consumer interpreting trust values)
- New tool added (non-breaking but part of the release)

## Steps

### 1. Update remember-core Dependency

```bash
npm i @prmichaelsen/remember-core@latest
```

Verify the installed version is >= 0.72.0.

### 2. Version Bump

Update `package.json` version from current to `4.0.0`.

### 3. Update CHANGELOG.md

Add entry:

```markdown
## [4.0.0] - 2026-03-20

### BREAKING CHANGES
- **Trust removed from create/update**: `trust` parameter removed from `remember_create_memory`, `remember_update_memory`, `remember_create_internal_memory`, `remember_update_internal_memory`. Trust now defaults to SECRET (5) on creation.
- **Trust scale changed**: All trust references updated from 0-1 float to 1-5 integer scale (1=PUBLIC, 2=INTERNAL, 3=CONFIDENTIAL, 4=RESTRICTED, 5=SECRET).

### Added
- `remember_request_set_trust_level` tool — two-phase confirmation flow to change a memory's trust level
- `secret_token` optional parameter on `remember_confirm` and `remember_deny` for ConfirmationGuardService support

### Changed
- Updated `@prmichaelsen/remember-core` to >= 0.72.0
- Trust filter schemas updated to integer 1-5 range
```

### 4. Update README.md

- Update tool count if changed
- Update tool listing to include `remember_request_set_trust_level`
- Update any trust-related documentation

### 5. Run Full Test Suite

```bash
npm test
```

Fix any remaining test failures.

### 6. Build Verification

```bash
npm run build
```

Ensure clean build with no TypeScript errors.

---

## Verification

- [ ] remember-core >= 0.72.0 installed
- [ ] package.json version is 4.0.0
- [ ] CHANGELOG.md has 4.0.0 entry with breaking changes documented
- [ ] README.md updated
- [ ] All tests pass
- [ ] Build succeeds
- [ ] TypeScript compiles without errors
