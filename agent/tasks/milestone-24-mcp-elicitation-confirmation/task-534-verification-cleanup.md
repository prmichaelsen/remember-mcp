# Task 534: Verification and Cleanup

**Milestone**: [M24 - MCP Elicitation Confirmation Flow](../../milestones/milestone-24-mcp-elicitation-confirmation.md)
**Design Reference**: None
**Estimated Time**: 1-2 hours
**Dependencies**: Task 532, Task 533
**Status**: Not Started

---

## Objective

Verify the full build pipeline, run tests, and update tool descriptions to reflect that elicitation is used when available.

---

## Steps

### 1. Build and Typecheck

```bash
npm run typecheck
npm run build
```

### 2. Run Tests

```bash
npm test
```

Fix any failures.

### 3. Update Tool Descriptions

Update the `description` field in tool definitions for the 5 protected tools to mention that elicitation is used when available:

- Remove/simplify the "CRITICAL SAFETY" warnings about separate messages (no longer needed when elicitation is active)
- Add note: "Uses MCP elicitation for direct user confirmation when supported. Falls back to token+confirm/deny flow for clients without elicitation."

### 4. Update `confirm`/`deny` tool descriptions

Add context that these tools are used as fallback:

- "Used when the client does not support MCP elicitation. When elicitation is supported, confirmation happens inline during the original tool call."

---

## Verification

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npm test` passes
- [ ] Tool descriptions updated for publish, retract, revise, delete-memory, request-set-trust-level
- [ ] Confirm/deny tool descriptions updated with fallback context
- [ ] No lint errors

---

**Related Design Docs**: None
