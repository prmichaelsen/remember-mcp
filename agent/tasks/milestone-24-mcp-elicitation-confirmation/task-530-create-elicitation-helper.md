# Task 530: Create Elicitation Helper Utility

**Milestone**: [M24 - MCP Elicitation Confirmation Flow](../../milestones/milestone-24-mcp-elicitation-confirmation.md)
**Design Reference**: None
**Estimated Time**: 1-2 hours
**Dependencies**: None
**Status**: Not Started

---

## Objective

Create `src/utils/elicitation.ts` — a shared helper that checks if the connected MCP client supports elicitation, issues a confirmation-only prompt via `server.elicitInput()`, and returns a discriminated result type.

---

## Context

MCP elicitation (`elicitation/create`) allows the server to pause a tool call and ask the user directly through the client. The MCP SDK v1.27.1 exposes `server.elicitInput()` on the `Server` class. Clients declare elicitation support via `ClientCapabilities.elicitation`.

This helper centralizes the elicitation logic so all 5 protected tools can share it without duplication.

---

## Steps

### 1. Create `src/utils/elicitation.ts`

```typescript
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

interface ElicitConfirmParams {
  server?: Server;
  message: string;
}

type ElicitConfirmResult =
  | { type: 'confirmed' }
  | { type: 'declined'; reason: string }
  | { type: 'unsupported' };

export async function elicitConfirmation(params: ElicitConfirmParams): Promise<ElicitConfirmResult> {
  const { server, message } = params;
  if (!server) return { type: 'unsupported' };

  const caps = server.getClientCapabilities();
  if (!caps?.elicitation) return { type: 'unsupported' };

  const result = await server.elicitInput({
    message,
    requestedSchema: { type: 'object', properties: {} },
  });

  if (result.action === 'accept') return { type: 'confirmed' };
  return { type: 'declined', reason: result.action };
}
```

Key design decisions:
- Returns `{ type: 'unsupported' }` when server is undefined or client lacks elicitation capability — callers fall back to token flow
- Uses empty `requestedSchema` for confirmation-only (no data fields)
- Maps both `decline` and `cancel` actions to `declined`

---

## Verification

- [ ] File `src/utils/elicitation.ts` exists
- [ ] Exports `elicitConfirmation` function and `ElicitConfirmResult` type
- [ ] Returns `unsupported` when server is undefined
- [ ] Returns `unsupported` when client lacks elicitation capability
- [ ] Returns `confirmed` on accept
- [ ] Returns `declined` on decline or cancel
- [ ] `npm run typecheck` passes

---

**Next Task**: [Task 531: Update protected tool handler signatures](task-531-update-handler-signatures.md)
