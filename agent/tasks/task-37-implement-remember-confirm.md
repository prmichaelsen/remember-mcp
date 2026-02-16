# Task 37: Implement remember_confirm Tool

**Milestone**: M10 - Shared Spaces & Confirmation Flow
**Estimated Time**: 5 hours
**Dependencies**: Task 34 (Token Service), Task 35 (Space Types), Task 36 (Publish Tool)
**Status**: Not Started

---

## Objective

Implement the generic `remember_confirm` tool that executes any pending action using a confirmation token. This is the second phase of the confirmation workflow and is designed to be extensible to other confirmable actions.

---

## Steps

### 1. Create Tool File

Create `src/tools/confirm.ts` with generic confirmation logic.

**Actions**:
- Import required dependencies
- Define tool schema
- Create main handler function
- Create action-specific executor functions
- Export tool definition and handler

**Expected Outcome**: Tool file structure created

### 2. Define Tool Schema

Create MCP tool definition for remember_confirm.

**Actions**:
- Set tool name: `remember_confirm`
- Write clear description emphasizing generic nature
- Define input schema with single parameter:
  - `token` (required): Confirmation token from action tool
- Add helpful description

**Expected Outcome**: Tool schema complete

### 3. Implement Token Validation

Validate and confirm the token.

**Actions**:
- Call `confirmationTokenService.confirmRequest()`
- Pass userId and token
- Check if request is valid (not null)
- Handle invalid/expired token error
- Return detailed error with context

**Expected Outcome**: Token validation working

### 4. Create Action Dispatcher

Route to appropriate executor based on action type.

**Actions**:
- Check `request.action` field
- If 'publish_memory': call `executePublishMemory()`
- If 'retract_memory': call `executeRetractMemory()` (future)
- Add other action types as needed
- Throw error for unknown action types
- Make extensible for future actions

**Expected Outcome**: Generic dispatch pattern established

### 5. Implement executePublishMemory Function

Execute the publish action.

**Actions**:
- Fetch original memory from user collection (fresh, not from payload)
- Verify memory still exists
- Verify user still owns it
- Get target space collection via `ensureSpaceCollection()`
- Create published memory object (copy with modifications)
- Set space-specific fields: `space_id`, `author_id`, `published_at`, `discovery_count`
- Merge additional_tags
- Insert into space collection
- Return space_memory_id

**Expected Outcome**: Publish action executes successfully

### 6. Format Success Response

Return minimal success response.

**Actions**:
- Create response with success flag
- Include payload with:
  - action: 'publish_memory'
  - space: target space ID
  - space_memory_id: new ID in space collection
- Keep response minimal (agent already knows original memory)
- Format as JSON string

**Expected Outcome**: Clear, minimal response

### 7. Implement Error Handling

Handle all error cases.

**Actions**:
- Invalid/expired token error
- Memory no longer exists error
- Permission denied error
- Space collection creation error
- Weaviate insertion error
- Use `handleToolError` utility
- Include detailed context

**Expected Outcome**: Comprehensive error handling

### 8. Add Tool to Server

Register tool in both server files.

**Actions**:
- Import tool in `src/server.ts`
- Add to tools list
- Add to call handler
- Repeat for `src/server-factory.ts`
- Test tool registration

**Expected Outcome**: Tool available in MCP server

### 9. Create Unit Tests

Test the confirm tool thoroughly.

**Actions**:
- Create `tests/unit/confirm.test.ts`
- Test successful publish execution
- Test invalid token error
- Test memory no longer exists error
- Test permission denied error
- Test unknown action type error
- Mock Weaviate, Firestore, token service
- Verify response format

**Expected Outcome**: All tests passing

### 10. Test End-to-End Flow

Test complete publish workflow.

**Actions**:
- Call remember_publish to get token
- Call remember_confirm with token
- Verify memory appears in space collection
- Verify original memory unchanged
- Test with actual Weaviate instance if available

**Expected Outcome**: Full workflow verified

---

## Verification

- [ ] `src/tools/confirm.ts` created
- [ ] Tool schema defined
- [ ] Token validation implemented
- [ ] Action dispatcher created
- [ ] executePublishMemory function working
- [ ] Success response formatted correctly
- [ ] Error handling comprehensive
- [ ] Tool registered in server.ts
- [ ] Tool registered in server-factory.ts
- [ ] Unit tests created and passing
- [ ] End-to-end flow tested
- [ ] TypeScript compiles without errors
- [ ] Build successful

---

## Tool Schema

```typescript
export const confirmTool = {
  name: 'remember_confirm',
  description: 'Confirm and execute a pending action using the token. Works for any action that requires confirmation (publish, delete, etc.).',
  inputSchema: {
    type: 'object',
    properties: {
      token: {
        type: 'string',
        description: 'The confirmation token from the action tool'
      }
    },
    required: ['token']
  }
};
```

---

## Response Format

```json
{
  "success": true,
  "payload": {
    "action": "publish_memory",
    "space": "the_void",
    "space_memory_id": "uuid-new-in-space"
  }
}
```

---

## Related Files

- Design: [`agent/design/publish-tools-confirmation-flow.md`](../design/publish-tools-confirmation-flow.md)
- Token Service: [`src/services/confirmation-token.service.ts`](../../src/services/confirmation-token.service.ts)
- Space Schema: [`src/weaviate/space-schema.ts`](../../src/weaviate/space-schema.ts)
- Publish Tool: [`src/tools/publish.ts`](../../src/tools/publish.ts)

---

**Next Task**: Task 38 - Implement remember_deny Tool
