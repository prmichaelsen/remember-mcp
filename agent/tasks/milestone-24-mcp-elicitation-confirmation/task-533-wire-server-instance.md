# Task 533: Wire Server Instance Through Entry Points

**Milestone**: [M24 - MCP Elicitation Confirmation Flow](../../milestones/milestone-24-mcp-elicitation-confirmation.md)
**Design Reference**: None
**Estimated Time**: 1-2 hours
**Dependencies**: Task 531
**Status**: Not Started

---

## Objective

Pass the `Server` instance to protected tool handlers in both `server.ts` and `server-factory.ts` so they can issue elicitation requests.

---

## Context

The `CallToolRequestSchema` handler has access to the `server` instance (it's in the closure of `registerHandlers()`). The handler just needs to pass it as the 4th argument to the 5 protected tool handlers.

---

## Steps

### 1. Update `server.ts` — `registerHandlers()`

In the switch statement, pass `server` to the 5 protected tool calls:

```typescript
case 'remember_publish':
  result = await handlePublish(args as any, userId, authContext, server);
  break;
case 'remember_retract':
  result = await handleRetract(args as any, userId, authContext, server);
  break;
case 'remember_revise':
  result = await handleRevise(args as any, userId, authContext, server);
  break;
case 'remember_delete_memory':
  result = await handleDeleteMemory(args as any, userId, authContext, server);
  break;
case 'remember_request_set_trust_level':
  result = await handleRequestSetTrustLevel(args as any, userId, authContext, server);
  break;
```

### 2. Update `server-factory.ts` — `registerHandlers()`

Same changes as `server.ts`. The `server` parameter is already passed to `registerHandlers()`.

---

## Verification

- [ ] `server.ts` passes server to all 5 protected handlers
- [ ] `server-factory.ts` passes server to all 5 protected handlers
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

---

**Next Task**: [Task 534: Verification and cleanup](task-534-verification-cleanup.md)
