# Task 44: Implement remember_retract Tool

**Milestone**: M11 - Shared Spaces Enhancements (Future)
**Estimated Time**: 3 hours
**Dependencies**: M10 (Shared Spaces complete)
**Status**: Not Started

---

## Objective

Implement the `remember_retract` tool that allows users to unpublish (remove) their memories from shared spaces. Uses the same token-based confirmation pattern as `remember_publish`.

---

## Steps

### 1. Create Tool File

Create `src/tools/retract.ts` with tool definition and handler.

**Actions**:
- Import required dependencies (token service, Weaviate client, types)
- Define tool schema with MCP Tool interface
- Create handler function signature
- Export both tool definition and handler

**Expected Outcome**: Tool file structure created

### 2. Define Tool Schema

Create MCP tool definition for remember_retract.

**Actions**:
- Set tool name: `remember_retract`
- Write clear description for LLM
- Define input schema with properties:
  - `space_memory_id` (required): ID of memory in shared space
  - `space` (required): Space ID (enum: ['the_void'])
- Add helpful descriptions

**Expected Outcome**: Tool schema complete

### 3. Implement Memory Validation

Verify the space memory exists and user is the author.

**Actions**:
- Get space Weaviate collection
- Fetch space memory by ID
- Check if memory exists
- Verify `author_id` matches userId (not space_id)
- Return detailed error if validation fails
- Include context in error response

**Expected Outcome**: Memory ownership verified

### 4. Create Confirmation Payload

Build the payload to store with the token.

**Actions**:
- Extract space_memory_id from args
- Extract space from args
- Store only IDs (not full content)
- Keep payload minimal

**Expected Outcome**: Payload structure defined

### 5. Generate Confirmation Token

Use token service to create confirmation request.

**Actions**:
- Call `confirmationTokenService.createRequest()`
- Pass userId, action='retract_memory', payload, space
- Receive requestId and token
- Handle any errors from token service

**Expected Outcome**: Token generated successfully

### 6. Format Success Response

Return token to agent (minimal response).

**Actions**:
- Create response object with success flag
- Include token
- Keep response minimal (agent already knows memory details)
- Format as JSON string

**Expected Outcome**: Clear response format

### 7. Update handleConfirm

Add retract action executor to confirm tool.

**Actions**:
- Open `src/tools/confirm.ts`
- Add `executeRetractMemory` function
- Validate token and fetch space memory
- Verify author_id matches userId
- Delete memory from space collection
- Return success with minimal response

**Expected Outcome**: Retract action can be executed

### 8. Implement Error Handling

Handle all error cases gracefully.

**Actions**:
- Memory not found error
- Permission denied error (not the author)
- Invalid space ID error
- Token service errors
- Weaviate connection errors
- Use `handleToolError` utility
- Include context in all errors

**Expected Outcome**: Comprehensive error handling

### 9. Add Tool to Server

Register tool in both server files.

**Actions**:
- Import tool in `src/server.ts`
- Add to tools list in ListToolsRequestSchema handler
- Add to CallToolRequestSchema handler
- Repeat for `src/server-factory.ts`
- Test tool registration

**Expected Outcome**: Tool available in MCP server

### 10. Create Unit Tests

Test the retract tool thoroughly.

**Actions**:
- Create `src/tools/retract.spec.ts`
- Test successful token generation
- Test memory not found error
- Test permission denied error (wrong author)
- Test invalid space ID
- Mock Weaviate and token service
- Verify response format

**Expected Outcome**: All tests passing

---

## Verification

- [ ] `src/tools/retract.ts` created
- [ ] Tool schema defined with correct parameters
- [ ] Memory validation implemented (checks author_id)
- [ ] Token generation working
- [ ] Success response formatted correctly
- [ ] executeRetractMemory added to confirm.ts
- [ ] Error handling comprehensive
- [ ] Tool registered in server.ts
- [ ] Tool registered in server-factory.ts
- [ ] Unit tests created and passing
- [ ] TypeScript compiles without errors
- [ ] Build successful

---

## Tool Schema

```typescript
export const retractTool = {
  name: 'remember_retract',
  description: 'Unpublish a memory from a shared space. The memory will be REMOVED from the shared collection. Generates a confirmation token. Use remember_confirm to execute.',
  inputSchema: {
    type: 'object',
    properties: {
      space_memory_id: {
        type: 'string',
        description: 'ID of the memory in the shared space to retract'
      },
      space: {
        type: 'string',
        description: 'Which space to retract from (snake_case ID)',
        enum: ['the_void'],
        default: 'the_void'
      }
    },
    required: ['space_memory_id', 'space']
  }
};
```

---

## Response Format

```json
{
  "success": true,
  "token": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## executeRetractMemory Implementation

```typescript
async function executeRetractMemory(
  request: ConfirmationRequest & { request_id: string },
  userId: string
): Promise<string> {
  // Fetch space memory
  const weaviateClient = getWeaviateClient();
  const spaceCollection = await ensureSpaceCollection(
    weaviateClient,
    request.target_collection || 'the_void'
  );

  const spaceMemory = await spaceCollection.query.fetchObjectById(
    request.payload.space_memory_id
  );

  if (!spaceMemory) {
    return JSON.stringify({
      success: false,
      error: 'Memory not found',
      message: `Space memory ${request.payload.space_memory_id} no longer exists`,
    }, null, 2);
  }

  // Verify user is the author
  if (spaceMemory.properties.author_id !== userId) {
    return JSON.stringify({
      success: false,
      error: 'Permission denied',
      message: 'You can only retract your own published memories',
    }, null, 2);
  }

  // Delete from space collection
  await spaceCollection.data.deleteById(request.payload.space_memory_id);

  return JSON.stringify({
    success: true,
  }, null, 2);
}
```

---

## Related Files

- Design: [`agent/design/publish-tools-confirmation-flow.md`](../design/publish-tools-confirmation-flow.md)
- Token Service: [`src/services/confirmation-token.service.ts`](../../src/services/confirmation-token.service.ts)
- Confirm Tool: [`src/tools/confirm.ts`](../../src/tools/confirm.ts)
- Space Schema: [`src/weaviate/space-schema.ts`](../../src/weaviate/space-schema.ts)

---

**Next Task**: TBD - Part of future milestone for shared spaces enhancements
