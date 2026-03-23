# Task 531: Update Protected Tool Handler Signatures

**Milestone**: [M24 - MCP Elicitation Confirmation Flow](../../milestones/milestone-24-mcp-elicitation-confirmation.md)
**Design Reference**: None
**Estimated Time**: 1 hour
**Dependencies**: Task 530
**Status**: Not Started

---

## Objective

Add an optional `server?: Server` parameter to all 5 protected tool handler functions so they can issue elicitation requests.

---

## Context

Currently, protected tool handlers have the signature `(args, userId, authContext?)`. To call `server.elicitInput()`, they need access to the `Server` instance. Adding `server` as an optional 4th parameter maintains backward compatibility.

---

## Steps

### 1. Update handler signatures

Add `server?: Server` as the 4th parameter to:

| File | Function |
|------|----------|
| `src/tools/publish.ts` | `handlePublish` |
| `src/tools/retract.ts` | `handleRetract` |
| `src/tools/revise.ts` | `handleRevise` |
| `src/tools/delete-memory.ts` | `handleDeleteMemory` |
| `src/tools/request-set-trust-level.ts` | `handleRequestSetTrustLevel` |

Add the import:
```typescript
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
```

Update each function signature, e.g.:
```typescript
export async function handlePublish(
  args: PublishArgs,
  userId: string,
  authContext?: AuthContext,
  server?: Server
): Promise<string> {
```

---

## Verification

- [ ] All 5 handlers accept optional `server` parameter
- [ ] `npm run typecheck` passes
- [ ] No existing callers break (parameter is optional)

---

**Next Task**: [Task 532: Implement elicitation in protected tools](task-532-implement-elicitation-in-tools.md)
