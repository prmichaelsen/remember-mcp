# Task 178: Create remember_moderate Tool

**Milestone**: M15 - Moderation & Space Config
**Estimated Hours**: 4-6
**Dependencies**: Task 174, Task 177
**Status**: Not Started

---

## Objective

Create a new MCP tool (`remember_moderate`) that allows moderators to approve, reject, or remove published memories.

---

## Steps

### 1. Create `src/tools/moderate.ts`

Tool definition:
```typescript
export const moderateTool = {
  name: 'remember_moderate',
  description: 'Approve, reject, or remove a published memory (requires can_moderate permission)',
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: { type: 'string', description: 'UUID of published memory' },
      space_id: { type: 'string', description: 'Space containing the memory (optional)' },
      group_id: { type: 'string', description: 'Group containing the memory (optional)' },
      action: { type: 'string', enum: ['approve', 'reject', 'remove'], description: 'Moderation action' },
      reason: { type: 'string', description: 'Optional reason for the action' },
    },
    required: ['memory_id', 'action'],
  },
};
```

Handler:
1. Check `authContext` for `can_moderate` permission on target group
2. Look up the memory in the target collection
3. Update `moderation_status`, `moderated_by` (userId), `moderated_at` (now)
4. Return confirmation message

### 2. Register in `src/server.ts` and `src/server-factory.ts`

Add import, tool definition to ListTools, and case in switch statement (20th tool).

### 3. Create `src/tools/moderate.spec.ts`

Tests:
- Approve sets status to `approved`
- Reject sets status to `rejected`
- Remove sets status to `removed`
- Non-moderator gets permission error
- Missing memory returns error
- Sets `moderated_by` and `moderated_at` correctly

---

## Verification

- [ ] `remember_moderate` registered in both servers
- [ ] approve/reject/remove actions work correctly
- [ ] Permission check enforced via authContext
- [ ] `moderated_by` and `moderated_at` set on action
- [ ] Error handling for missing memory, bad permissions
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
