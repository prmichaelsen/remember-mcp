# Task 36: Implement remember_publish Tool

**Milestone**: M10 - Shared Spaces & Confirmation Flow
**Estimated Time**: 4 hours
**Dependencies**: Task 34 (Token Service), Task 35 (Space Types)
**Status**: Not Started

---

## Objective

Implement the `remember_publish` tool that generates a confirmation token for publishing a memory to a shared space. This is the first step in the two-phase publish workflow.

---

## Steps

### 1. Create Tool File

Create `src/tools/publish.ts` with tool definition and handler.

**Actions**:
- Import required dependencies (token service, Weaviate client, types)
- Define tool schema with MCP Tool interface
- Create handler function signature
- Export both tool definition and handler

**Expected Outcome**: Tool file structure created

### 2. Define Tool Schema

Create MCP tool definition for remember_publish.

**Actions**:
- Set tool name: `remember_publish`
- Write clear description for LLM
- Define input schema with properties:
  - `memory_id` (required): ID of memory to publish
  - `target` (required): Space ID (enum: ['the_void'])
  - `additional_tags` (optional): Extra tags for discovery
- Set default values
- Add helpful descriptions

**Expected Outcome**: Tool schema complete

### 3. Implement Memory Validation

Verify the memory exists and user owns it.

**Actions**:
- Get user's Weaviate collection
- Fetch memory by ID
- Check if memory exists
- Verify `user_id` matches
- Return detailed error if validation fails
- Include context in error response

**Expected Outcome**: Memory ownership verified

### 4. Create Confirmation Payload

Build the payload to store with the token.

**Actions**:
- Extract memory_id from args
- Include additional_tags
- Store only IDs (not full content)
- Content will be fetched fresh during confirmation
- Keep payload minimal

**Expected Outcome**: Payload structure defined

### 5. Generate Confirmation Token

Use token service to create confirmation request.

**Actions**:
- Call `confirmationTokenService.createRequest()`
- Pass userId, action='publish_memory', payload, target
- Receive requestId and token
- Handle any errors from token service

**Expected Outcome**: Token generated successfully

### 6. Format Success Response

Return token and payload to agent.

**Actions**:
- Create response object with success flag
- Include token
- Include payload summary (action, memory_id, target, tags)
- Format as JSON string
- Use pretty printing for readability

**Expected Outcome**: Clear response format

### 7. Implement Error Handling

Handle all error cases gracefully.

**Actions**:
- Memory not found error
- Permission denied error
- Token service errors
- Weaviate connection errors
- Use `handleToolError` utility
- Include context in all errors

**Expected Outcome**: Comprehensive error handling

### 8. Add Tool to Server

Register tool in both server files.

**Actions**:
- Import tool in `src/server.ts`
- Add to tools list in ListToolsRequestSchema handler
- Add to CallToolRequestSchema handler
- Repeat for `src/server-factory.ts`
- Test tool registration

**Expected Outcome**: Tool available in MCP server

### 9. Create Unit Tests

Test the publish tool thoroughly.

**Actions**:
- Create `tests/unit/publish.test.ts`
- Test successful token generation
- Test memory not found error
- Test permission denied error
- Test invalid space ID
- Mock Weaviate and token service
- Verify response format

**Expected Outcome**: All tests passing

### 10. Update Tool Count

Update documentation with new tool count.

**Actions**:
- Update README.md (13 tools now)
- Update progress.yaml
- Note in milestone documentation

**Expected Outcome**: Documentation current

---

## Verification

- [ ] `src/tools/publish.ts` created
- [ ] Tool schema defined with correct parameters
- [ ] Memory validation implemented
- [ ] Token generation working
- [ ] Success response formatted correctly
- [ ] Error handling comprehensive
- [ ] Tool registered in server.ts
- [ ] Tool registered in server-factory.ts
- [ ] Unit tests created and passing
- [ ] TypeScript compiles without errors
- [ ] Build successful

---

## Tool Schema

```typescript
export const publishTool = {
  name: 'remember_publish',
  description: 'Publish a memory to a shared space (like "The Void"). The memory will be COPIED (not moved) from your personal collection. Generates a confirmation token. Use remember_confirm to execute.',
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: {
        type: 'string',
        description: 'ID of the memory from your personal collection to publish'
      },
      target: {
        type: 'string',
        description: 'Target space to publish to (snake_case ID)',
        enum: ['the_void'],
        default: 'the_void'
      },
      additional_tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Additional tags for discovery (merged with original tags)',
        default: []
      }
    },
    required: ['memory_id', 'target']
  }
};
```

---

## Response Format

```json
{
  "success": true,
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "payload": {
    "action": "publish_memory",
    "memory_id": "uuid-original",
    "target": "the_void",
    "additional_tags": []
  }
}
```

---

## Related Files

- Design: [`agent/design/publish-tools-confirmation-flow.md`](../design/publish-tools-confirmation-flow.md)
- Token Service: [`src/services/confirmation-token.service.ts`](../../src/services/confirmation-token.service.ts)
- Space Types: [`src/types/space-memory.ts`](../../src/types/space-memory.ts)

---

**Next Task**: Task 37 - Implement remember_confirm Tool
