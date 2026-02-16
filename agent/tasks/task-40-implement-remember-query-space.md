# Task 40: Implement remember_query_space Tool

**Milestone**: M10 - Shared Spaces & Confirmation Flow
**Estimated Time**: 3 hours
**Dependencies**: Task 35 (Space Types), M2 (Query Memory tool)
**Status**: Not Started

---

## Objective

Implement `remember_query_space` tool for RAG-optimized natural language queries on shared spaces. Similar to `remember_query_memory` but queries space collections.

---

## Steps

### 1. Create Tool File

Create `src/tools/query-space.ts` based on query-memory.ts.

**Actions**:
- Copy structure from `query-memory.ts`
- Import space schema utilities
- Define tool schema
- Create handler function
- Export tool definition and handler

**Expected Outcome**: Tool file structure created

### 2. Define Tool Schema

Create MCP tool definition for remember_query_space.

**Actions**:
- Set tool name: `remember_query_space`
- Write clear description for RAG queries on shared spaces
- Define input schema with properties:
  - `question` (required): Natural language question
  - `space` (required): Space ID (enum: ['the_void'])
  - All filter options from query_memory
  - `format`: 'detailed' or 'compact'
  - `limit` for result count
- Set default values

**Expected Outcome**: Tool schema complete

### 3. Implement Space Collection Access

Get the space collection to query.

**Actions**:
- Call `ensureSpaceCollection()` with space_id
- Get collection reference
- Handle collection creation if needed
- Verify collection exists

**Expected Outcome**: Space collection accessible

### 4. Implement RAG Query

Execute semantic query on space collection.

**Actions**:
- Use Weaviate nearText for semantic search
- Apply all filters (content_type, tags, weight, trust, dates)
- Filter by `space_id` (not `user_id`)
- Use same filter building logic as query_memory
- Return results with relevance scores
- Limit results appropriately

**Expected Outcome**: RAG query working

### 5. Format Query Results

Format results based on requested format.

**Actions**:
- **Detailed format**: Full SpaceMemory objects with all fields
- **Compact format**: Text summary optimized for LLM context
- Include relevance scores
- Include metadata (question, space, result count)
- Format as JSON string

**Expected Outcome**: Both formats working

### 6. Implement Error Handling

Handle error cases.

**Actions**:
- Invalid space ID error
- Collection not found error
- Weaviate query errors
- Use `handleToolError` utility
- Include context in errors

**Expected Outcome**: Error handling complete

### 7. Add Tool to Server

Register tool in both server files.

**Actions**:
- Import tool in `src/server.ts`
- Add to tools list
- Add to call handler
- Repeat for `src/server-factory.ts`

**Expected Outcome**: Tool available in MCP server

### 8. Create Unit Tests

Test the query_space tool.

**Actions**:
- Create `tests/unit/query-space.test.ts`
- Test successful query (detailed format)
- Test successful query (compact format)
- Test with various filters
- Test invalid space ID error
- Mock Weaviate client
- Verify result formats

**Expected Outcome**: All tests passing

---

## Verification

- [ ] `src/tools/query-space.ts` created
- [ ] Tool schema defined with all parameters
- [ ] Space collection access working
- [ ] RAG query implemented
- [ ] Filters working correctly
- [ ] Detailed format working
- [ ] Compact format working
- [ ] Error handling complete
- [ ] Tool registered in server.ts
- [ ] Tool registered in server-factory.ts
- [ ] Unit tests created and passing
- [ ] TypeScript compiles without errors

---

## Tool Schema

```typescript
export const querySpaceTool = {
  name: 'remember_query_space',
  description: 'Ask natural language questions about memories in shared spaces. Works like remember_query_memory but queries shared spaces.',
  inputSchema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'Natural language question'
      },
      space: {
        type: 'string',
        description: 'Which space to query',
        enum: ['the_void'],
        default: 'the_void'
      },
      // Same filters as remember_query_memory
      content_type: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      min_weight: { type: 'number', minimum: 0, maximum: 1 },
      date_from: { type: 'string' },
      date_to: { type: 'string' },
      limit: { type: 'number', default: 10 },
      format: { 
        type: 'string', 
        enum: ['detailed', 'compact'], 
        default: 'detailed' 
      }
    },
    required: ['question', 'space']
  }
};
```

---

## Related Files

- Design: [`agent/design/publish-tools-confirmation-flow.md`](../design/publish-tools-confirmation-flow.md)
- Query Memory: [`src/tools/query-memory.ts`](../../src/tools/query-memory.ts)
- Space Schema: [`src/weaviate/space-schema.ts`](../../src/weaviate/space-schema.ts)

---

**Next Task**: Task 41 - Configure Firestore TTL Policy
