# Task 527: Update Confirm/Deny for Secret Token

**Milestone**: [M23 — Trust Level Protection](../../milestones/milestone-23-trust-level-protection.md)
**Status**: Not Started
**Estimated Time**: 2-3 hours
**Dependencies**: None

---

## Objective

Add optional `secret_token` parameter to `remember_confirm` and `remember_deny` MCP tools to support the ConfirmationGuardService's HMAC challenge when enabled.

## Context

remember-core 0.72.0 adds `ConfirmationGuardService` — a two-layer protection preventing agents from auto-confirming sensitive operations. When enabled:

1. `ConfirmInput` and `DenyInput` accept optional `secret_token`
2. If guard is configured on SpaceService, `secret_token` is required
3. Invalid secret triggers exponential backoff (cooldown)
4. After 5 failures, token is permanently expired

The guard is optional — when not configured, confirm/deny work as before. The MCP tools should accept `secret_token` but not require it.

## Steps

### 1. Update `src/tools/confirm.ts`

- Add `secret_token` to inputSchema properties:
  ```typescript
  secret_token: {
    type: 'string',
    description: 'HMAC secret token for guard-protected operations. Required when confirmation guard is enabled.',
  }
  ```
- Pass `secret_token` to `spaceService.confirm({ token, secret_token })`
- Update tool description to mention secret_token is optional and only needed when guard is enabled
- Handle guard-specific errors: cooldown messages, backoff info, max attempts exceeded

### 2. Update `src/tools/deny.ts`

- Same changes as confirm: add `secret_token` to schema and pass through
- Pass `secret_token` to `spaceService.deny({ token, secret_token })`

### 3. Update Tests

- `src/tools/confirm.spec.ts` — add test for passing secret_token through
- `src/tools/deny.spec.ts` — add test for passing secret_token through
- Test that missing secret_token still works (guard not configured scenario)

---

## Verification

- [ ] `remember_confirm` accepts optional `secret_token` parameter
- [ ] `remember_deny` accepts optional `secret_token` parameter
- [ ] secret_token passed through to core service calls
- [ ] Existing confirm/deny behavior unchanged when secret_token not provided
- [ ] Tests passing
- [ ] TypeScript compiles without errors
