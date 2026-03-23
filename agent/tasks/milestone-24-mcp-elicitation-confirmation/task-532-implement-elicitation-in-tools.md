# Task 532: Implement Elicitation in Protected Tools

**Milestone**: [M24 - MCP Elicitation Confirmation Flow](../../milestones/milestone-24-mcp-elicitation-confirmation.md)
**Design Reference**: None
**Estimated Time**: 3-4 hours
**Dependencies**: Task 530, Task 531
**Status**: Not Started

---

## Objective

Wire elicitation logic into all 5 protected tool handlers so they confirm with the user via elicitation when supported, and fall back to the token flow otherwise.

---

## Context

Each protected tool currently:
1. Calls a core service to create a confirmation token
2. Returns the token to the agent
3. Expects the agent to call `remember_confirm` or `remember_deny`

With elicitation, the flow becomes:
1. Call core service to create a confirmation token
2. Call `elicitConfirmation()` to ask the user directly
3. If confirmed → execute the operation (call confirm internally) → return result
4. If declined → deny the token → return cancellation message
5. If unsupported → return token in legacy format (current behavior)

---

## Steps

### 1. Update `handlePublish` (src/tools/publish.ts)

After getting the token from `space.publish()`, call `elicitConfirmation()`:

```typescript
import { elicitConfirmation } from '../utils/elicitation.js';

// After getting result from space.publish():
const confirmation = await elicitConfirmation({
  server,
  message: `Publish memory "${args.memory_id}" to ${[...(args.spaces || []), ...(args.groups || [])].join(', ')}?`,
});

if (confirmation.type === 'confirmed') {
  const confirmResult = await space.confirm({ token: result.token });
  return JSON.stringify({ success: true, ...confirmResult }, null, 2);
}

if (confirmation.type === 'declined') {
  await space.deny({ token: result.token });
  return JSON.stringify({ success: false, message: 'Publication cancelled by user.' }, null, 2);
}

// Fallback: return token for legacy confirm/deny flow
return JSON.stringify({ success: true, token: result.token, ... }, null, 2);
```

### 2. Update `handleRetract` (src/tools/retract.ts)

Same pattern. Message: `Retract memory "${args.memory_id}" from ${destinations}?`

### 3. Update `handleRevise` (src/tools/revise.ts)

Same pattern. Message: `Revise all published copies of memory "${args.memory_id}"?`

### 4. Update `handleDeleteMemory` (src/tools/delete-memory.ts)

This tool uses `tokenService.createRequest()` directly instead of a core space service.

On confirmation, replicate the delete logic from `confirm.ts` (soft delete via Weaviate update).

On decline, call `tokenService.denyRequest()` or simply let the token expire.

Message: `Delete memory "${args.memory_id}"${args.reason ? ` (reason: ${args.reason})` : ''}?`

### 5. Update `handleRequestSetTrustLevel` (src/tools/request-set-trust-level.ts)

Uses `memory.requestSetTrustLevel()` which returns a token.

On confirmation, call `memory.confirmSetTrustLevel(token)`.

Message: `Change trust level for memory "${args.memory_id}" from ${current} to ${requested}?`

---

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Confirm execution path | Reuse core service confirm methods | Avoids duplicating business logic; the confirm handlers in core already handle all edge cases |
| Deny on decline | Call deny/let expire | Clean token cleanup; prevents orphaned pending tokens |
| Error handling | Wrap elicitation in try/catch, fall back to token flow on error | Resilient against elicitation failures |

---

## Verification

- [ ] `handlePublish` uses elicitation when available, falls back when not
- [ ] `handleRetract` uses elicitation when available, falls back when not
- [ ] `handleRevise` uses elicitation when available, falls back when not
- [ ] `handleDeleteMemory` uses elicitation when available, falls back when not
- [ ] `handleRequestSetTrustLevel` uses elicitation when available, falls back when not
- [ ] All tools still work with non-elicitation clients (token flow preserved)
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes

---

**Next Task**: [Task 533: Wire server instance through entry points](task-533-wire-server-instance.md)
