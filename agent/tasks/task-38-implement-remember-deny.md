# Task 38: Implement remember_deny Tool

**Milestone**: M10 - Shared Spaces & Confirmation Flow
**Estimated Time**: 2 hours
**Dependencies**: Task 34 (Token Service)
**Status**: Not Started

---

## Objective

Implement the generic `remember_deny` tool that cancels any pending action. This allows users to reject confirmation requests.

---

## Steps

### 1. Create Tool File

Create `src/tools/deny.ts` with denial logic.

**Actions**:
- Import token service
- Define tool schema
- Create handler function
- Export tool definition and handler

**Expected Outcome**: Tool file structure created

### 2. Define Tool Schema

Create MCP tool definition for remember_deny.

**Actions**:
- Set tool name: `remember_deny`
- Write clear description emphasizing generic nature
- Define input schema with single parameter:
  - `token` (required): Confirmation token to deny
- Add helpful description

**Expected Outcome**: Tool schema complete

### 3. Implement Token Denial

Use token service to deny the request.

**Actions**:
- Call `confirmationTokenService.denyRequest()`
- Pass userId and token
- Check if denial was successful
- Handle invalid token error
- Return appropriate response

**Expected Outcome**: Token denial working

### 4. Format Success Response

Return simple success response.

**Actions**:
- Create response with success flag
- Keep response minimal (just confirmation of denial)
- Format as JSON string
- No payload needed for denial

**Expected Outcome**: Clear response format

### 5. Implement Error Handling

Handle error cases.

**Actions**:
- Invalid token error
- Token already used error
- Token not found error
- Use `handleToolError` utility
- Include context in errors

**Expected Outcome**: Error handling complete

### 6. Add Tool to Server

Register tool in both server files.

**Actions**:
- Import tool in `src/server.ts`
- Add to tools list
- Add to call handler
- Repeat for `src/server-factory.ts`

**Expected Outcome**: Tool available in MCP server

### 7. Create Unit Tests

Test the deny tool.

**Actions**:
- Create `tests/unit/deny.test.ts`
- Test successful denial
- Test invalid token error
- Test token already used error
- Mock token service
- Verify response format

**Expected Outcome**: All tests passing

---

## Verification

- [ ] `src/tools/deny.ts` created
- [ ] Tool schema defined
- [ ] Token denial implemented
- [ ] Success response formatted correctly
- [ ] Error handling complete
- [ ] Tool registered in server.ts
- [ ] Tool registered in server-factory.ts
- [ ] Unit tests created and passing
- [ ] TypeScript compiles without errors

---

## Tool Schema

```typescript
export const denyTool = {
  name: 'remember_deny',
  description: 'Deny a pending action. The request will be marked as denied and the token invalidated. Works for any action that requires confirmation.',
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
  "success": true
}
```

---

## Related Files

- Design: [`agent/design/publish-tools-confirmation-flow.md`](../design/publish-tools-confirmation-flow.md)
- Token Service: [`src/services/confirmation-token.service.ts`](../../src/services/confirmation-token.service.ts)

---

**Next Task**: Task 39 - Implement remember_search_space Tool
