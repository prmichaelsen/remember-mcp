# Milestone 24: MCP Elicitation Confirmation Flow

**Goal**: Replace the two-phase token+confirm/deny confirmation pattern with MCP elicitation for protected operations, while keeping confirm/deny as fallback for non-elicitation clients.
**Duration**: 1 week
**Dependencies**: M23 (Trust Level Protection)
**Status**: Not Started

---

## Overview

Protected operations (publish, retract, revise, delete, set-trust-level) currently use a two-phase token pattern: the tool returns a `{ token }`, then the agent calls `remember_confirm` or `remember_deny`. The problem is that an autonomous agent can call confirm immediately in the same tool loop — auto-confirming without any user involvement.

MCP elicitation (`server.elicitInput()`) is the spec-native solution. It allows the server to pause a tool call and request user confirmation directly through the client, bypassing the agent entirely. The MCP SDK v1.27.1 (installed) fully supports this.

For clients that don't support elicitation, the existing token+confirm/deny flow is preserved as a fallback.

---

## Deliverables

### 1. Elicitation Helper Utility
- `src/utils/elicitation.ts` — shared helper that checks client capabilities and issues confirmation prompts or returns fallback

### 2. Updated Protected Tool Handlers
- All 5 protected tools (publish, retract, revise, delete-memory, request-set-trust-level) use elicitation when available
- Fallback to token flow when elicitation not supported

### 3. Server Wiring
- `server.ts` and `server-factory.ts` pass `Server` instance to protected tool handlers

---

## Success Criteria

- [ ] `npm run build` completes without errors
- [ ] `npm run typecheck` passes
- [ ] `npm test` — all existing tests pass
- [ ] Protected tools use elicitation when client supports it
- [ ] Protected tools fall back to token+confirm/deny when client doesn't support elicitation
- [ ] `remember_confirm` and `remember_deny` tools still work for fallback clients

---

## Key Files to Create

```
src/
└── utils/
    └── elicitation.ts
```

## Key Files to Modify

```
src/
├── tools/
│   ├── publish.ts
│   ├── retract.ts
│   ├── revise.ts
│   ├── delete-memory.ts
│   └── request-set-trust-level.ts
├── server.ts
└── server-factory.ts
```

---

## Tasks

1. [Task 530: Create elicitation helper utility](../tasks/milestone-24-mcp-elicitation-confirmation/task-530-create-elicitation-helper.md) - Shared helper for elicitation with fallback detection
2. [Task 531: Update protected tool handler signatures](../tasks/milestone-24-mcp-elicitation-confirmation/task-531-update-handler-signatures.md) - Add optional `server` parameter to protected tool handlers
3. [Task 532: Implement elicitation in protected tools](../tasks/milestone-24-mcp-elicitation-confirmation/task-532-implement-elicitation-in-tools.md) - Wire elicitation logic into publish, retract, revise, delete, set-trust-level
4. [Task 533: Wire server instance through entry points](../tasks/milestone-24-mcp-elicitation-confirmation/task-533-wire-server-instance.md) - Pass server to protected tool handlers in server.ts and server-factory.ts
5. [Task 534: Verification and cleanup](../tasks/milestone-24-mcp-elicitation-confirmation/task-534-verification-cleanup.md) - Build, typecheck, test, update tool descriptions

---

## Testing Requirements

- [ ] Existing unit tests pass without modification
- [ ] Build succeeds
- [ ] Typecheck passes

---

## Risks and Mitigation

| Risk | Impact | Probability | Mitigation Strategy |
|------|--------|-------------|---------------------|
| Client doesn't support elicitation | Medium | High | Fallback to existing token+confirm/deny flow |
| Elicitation throws on unsupported clients | High | Low | Capability check before calling elicitInput |
| Confirm handler logic duplication | Medium | Medium | Reuse existing confirm handler code path internally |

---

**Next Milestone**: TBD
**Blockers**: None
**Notes**: Start with a spike on `remember_publish` to verify elicitation works end-to-end before migrating all protected operations.
