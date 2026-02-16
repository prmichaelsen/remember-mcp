# Task 39: Implement remember_search_space Tool

**Milestone**: M10 - Shared Spaces & Confirmation Flow
**Estimated Time**: 3 hours
**Dependencies**: Task 35 (Space Types), M2 (Search Memory tool)
**Status**: Not Started

---

## Objective

Implement `remember_search_space` tool for searching shared spaces. This is similar to `remember_search_memory` but searches space collections instead of personal collections.

---

## Steps

### 1. Create Tool File

Create `src/tools/search-space.ts` based on search-memory.ts.

**Actions**:
- Copy structure from `search-memory.ts`
- Import space schema utilities
- Define tool schema
- Create handler function
- Export tool definition and handler

**Expected Outcome**: Tool file structure created

### 2. Define Tool Schema

Create MCP tool definition for remember_search_space.

**Actions**:
- Set tool name: `remember_search_space`
- Write clear description for searching shared spaces
- Define input schema with properties:
  - `query` (required): Search query
  - `space` (required): Space ID (enum: ['the_void'])
  - All filter options from search_memory (content_type, tags, weight, trust, dates)
  - `limit` and `offset` for pagination
- Set default values

**Expected Outcome**: Tool schema complete

### 3. Implement Space Collection Access

Get the space collection to search.

**Actions**:
- Call `ensureSpaceCollection()` with space_id
- Get collection reference
- Handle collection creation if needed
- Verify collection exists

**Expected Outcome**: Space collection accessible

### 4. Implement Hybrid Search

Execute hybrid search on space collection.

**Actions**:
- Use Weaviate hybrid search (semantic + keyword)
- Apply all filters (content_type, tags, weight, trust, dates)
- Filter by `space_id` (not `user_id`)
- Use same filter building logic as search_memory
- Handle pagination with offset/limit
- Return results with scores

**Expected Outcome**: Search working correctly

### 5. Format Search Results

Format results for agent consumption.

**Actions**:
- Extract memory properties
- Include relevance scores
- Format as array of SpaceMemory objects
- Include metadata (total results, offset, limit)
- Format as JSON string

**Expected Outcome**: Clear result format

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

Test the search_space tool.

**Actions**:
- Create `tests/unit/search-space.test.ts`
- Test successful search
- Test with various filters
- Test pagination
- Test invalid space ID error
- Mock Weaviate client
- Verify result format

**Expected Outcome**: All tests passing

---

## Verification

- [ ] `src/tools/search-space.ts` created
- [ ] Tool schema defined with all parameters
- [ ] Space collection access working
- [ ] Hybrid search implemented
- [ ] Filters working correctly
- [ ] Results formatted properly
- [ ] Error handling complete
- [ ] Tool registered in server.ts
- [ ] Tool registered in server-factory.ts
- [ ] Unit tests created and passing
- [ ] TypeScript compiles without errors

---

## Tool Schema

```typescript
export const searchSpaceTool = {
  name: 'remember_search_space',
  description: 'Search shared spaces to discover thoughts, ideas, and memories. Works like remember_search_memory but searches shared spaces instead of personal memories.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (semantic + keyword hybrid)'
      },
      space: {
        type: 'string',
        description: 'Which space to search',
        enum: ['the_void'],
        default: 'the_void'
      },
      // Same filters as remember_search_memory
      content_type: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      min_weight: { type: 'number', minimum: 0, maximum: 1 },
      max_weight: { type: 'number', minimum: 0, maximum: 1 },
      date_from: { type: 'string' },
      date_to: { type: 'string' },
      limit: { type: 'number', default: 10 },
      offset: { type: 'number', default: 0 }
    },
    required: ['query', 'space']
  }
};
```

---

## Related Files

- Design: [`agent/design/publish-tools-confirmation-flow.md`](../design/publish-tools-confirmation-flow.md)
- Search Memory: [`src/tools/search-memory.ts`](../../src/tools/search-memory.ts)
- Space Schema: [`src/weaviate/space-schema.ts`](../../src/weaviate/space-schema.ts)

---

**Next Task**: Task 40 - Implement remember_query_space Tool
