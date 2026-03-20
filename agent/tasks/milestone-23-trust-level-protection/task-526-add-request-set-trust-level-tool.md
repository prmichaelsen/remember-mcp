# Task 526: Add remember_request_set_trust_level Tool

**Milestone**: [M23 — Trust Level Protection](../../milestones/milestone-23-trust-level-protection.md)
**Status**: Not Started
**Estimated Time**: 3-4 hours
**Dependencies**: [Task 525](task-525-remove-trust-from-create-update.md)

---

## Objective

Create a new MCP tool `remember_request_set_trust_level` that initiates a two-phase confirmation flow for changing a memory's trust level. This replaces the removed direct trust setting on create/update.

## Context

remember-core M80 added `MemoryService.requestSetTrustLevel()` and `MemoryService.confirmSetTrustLevel()`. The request phase creates a confirmation token; the confirm phase (via existing `remember_confirm`) applies the trust change.

**API from remember-core:**
```typescript
// Phase 1: Request
interface SetTrustLevelInput {
  memory_id: string;
  trust_level: number; // 1-5 integer (TrustLevel enum)
}
interface SetTrustLevelRequestResult {
  token: string;
  memory_id: string;
  requested_trust_level: number;
  current_trust_level: number;
  expires_at: string;
}

// Phase 2: Confirm (via existing MemoryService.confirmSetTrustLevel(token))
interface SetTrustLevelConfirmResult {
  memory_id: string;
  previous_trust_level: number;
  new_trust_level: number;
  updated_at: string;
  version: number;
}
```

## Steps

### 1. Create `src/tools/request-set-trust-level.ts`

**Tool schema:**
```typescript
{
  name: 'remember_request_set_trust_level',
  description: `Request a trust level change for a memory. Returns a confirmation token.

Trust levels (1-5):
  1 = PUBLIC — anyone can see
  2 = INTERNAL — friends/known users
  3 = CONFIDENTIAL — trusted friends
  4 = RESTRICTED — close/intimate contacts
  5 = SECRET — owner only (default for new memories)

After requesting, use remember_confirm with the returned token to apply the change.
Lowering trust (e.g. 5→1) makes the memory MORE visible. Raising trust makes it LESS visible.`,
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: { type: 'string', description: 'ID of the memory to change trust level for' },
      trust_level: { type: 'integer', description: 'New trust level (1-5)', minimum: 1, maximum: 5 },
    },
    required: ['memory_id', 'trust_level'],
  },
}
```

**Handler:**
- Call `memoryService.requestSetTrustLevel({ memory_id, trust_level })`
- Return the `SetTrustLevelRequestResult` as JSON
- Include user-friendly message: "Trust level change requested. Current: {current}, Requested: {requested}. Confirm with token: {token}"

### 2. Register Tool in `src/server.ts` and `src/server-factory.ts`

- Import the handler
- Add to tool list and tool call handler switch

### 3. Handle Confirmation in Existing Flow

The `remember_confirm` tool already handles confirmation tokens. When the confirmed request has `action: 'set_trust_level'`, the core service calls `confirmSetTrustLevel(token)` internally. Verify this works end-to-end:

- Check if SpaceService.confirm() or MemoryService handles this action type
- If the existing confirm flow doesn't route to `confirmSetTrustLevel`, we need to add routing logic in the confirm handler

### 4. Create Tests `src/tools/request-set-trust-level.spec.ts`

Test cases:
- Successful trust level change request (returns token)
- Invalid trust level (0, 6, 1.5) returns error
- Missing memory_id returns error
- Missing trust_level returns error
- Mock memoryService.requestSetTrustLevel behavior

---

## Verification

- [ ] `remember_request_set_trust_level` tool registered and visible in tool list
- [ ] Returns confirmation token on valid request
- [ ] Rejects invalid trust levels
- [ ] Confirmation via `remember_confirm` applies the trust change
- [ ] Tests passing
- [ ] TypeScript compiles without errors
