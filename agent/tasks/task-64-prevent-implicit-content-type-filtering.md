# Task 64: Update Search/Query Tool Descriptions - No Implicit Content Type Filtering

**Milestone**: M12 (Bug Fixes / UX Improvements)
**Estimated Time**: 1 hour
**Dependencies**: None
**Status**: Not Started
**Priority**: High

---

## Objective

Update all search and query tool descriptions to explicitly instruct agents to NEVER add content_type filters unless the user explicitly requests filtering by content type. This prevents agents from over-filtering results and missing relevant memories.

---

## Context

**Current Problem**:
Agents are adding `content_type` filters to search queries even when users don't request them. This causes:
- Missed results (memories with different content types excluded)
- Poor search experience (user searches for "hiking" but agent filters to only "note" type)
- Confusion (user doesn't understand why results are limited)

**Example Bad Behavior**:
```
User: "Search for memories about hiking"
Agent: remember_search_memory({ query: "hiking", content_type: "note" })
Result: Misses "event", "activity", "location" memories about hiking
```

**Expected Behavior**:
```
User: "Search for memories about hiking"
Agent: remember_search_memory({ query: "hiking" })
Result: Returns ALL memories about hiking regardless of type
```

**When to Filter**:
```
User: "Search for note memories about hiking"
Agent: remember_search_memory({ query: "hiking", content_type: "note" })
Result: Correctly filters to only notes
```

---

## Steps

### 1. Update remember_search_memory Description

Add explicit instruction to tool description:

```typescript
// src/tools/search-memory.ts

export const searchMemoryTool: Tool = {
  name: 'remember_search_memory',
  description: `Search your personal memories using hybrid search (semantic + keyword).

⚠️ IMPORTANT: Do NOT add content_type filter unless the user explicitly requests filtering by type.
- ✅ CORRECT: User says "search for hiking" → { query: "hiking" }
- ❌ WRONG: User says "search for hiking" → { query: "hiking", content_type: "note" }
- ✅ CORRECT: User says "search for note memories about hiking" → { query: "hiking", content_type: "note" }

Let the search algorithm find ALL relevant memories regardless of type unless explicitly requested.`,
  // ... rest of tool definition
};
```

### 2. Update remember_query_memory Description

Add same instruction:

```typescript
// src/tools/query-memory.ts

export const queryMemoryTool: Tool = {
  name: 'remember_query_memory',
  description: `Query your personal memories using natural language (RAG-optimized).

⚠️ IMPORTANT: Do NOT add content_type filter unless the user explicitly requests filtering by type.
- ✅ CORRECT: User says "what do I know about hiking?" → { query: "hiking" }
- ❌ WRONG: User says "what do I know about hiking?" → { query: "hiking", content_type: "note" }
- ✅ CORRECT: User says "what notes do I have about hiking?" → { query: "hiking", content_type: "note" }

Let the query algorithm find ALL relevant memories regardless of type unless explicitly requested.`,
  // ... rest of tool definition
};
```

### 3. Update remember_search_space Description

Add same instruction:

```typescript
// src/tools/search-space.ts

export const searchSpaceTool: Tool = {
  name: 'remember_search_space',
  description: `Search shared spaces for published memories.

⚠️ IMPORTANT: Do NOT add content_type filter unless the user explicitly requests filtering by type.
- ✅ CORRECT: User says "search The Void for hiking" → { spaces: ["the_void"], query: "hiking" }
- ❌ WRONG: User says "search The Void for hiking" → { spaces: ["the_void"], query: "hiking", content_type: "note" }
- ✅ CORRECT: User says "search The Void for note memories about hiking" → { spaces: ["the_void"], query: "hiking", content_type: "note" }

Let the search algorithm find ALL relevant memories regardless of type unless explicitly requested.`,
  // ... rest of tool definition
};
```

### 4. Update remember_query_space Description

Add same instruction:

```typescript
// src/tools/query-space.ts

export const querySpaceTool: Tool = {
  name: 'remember_query_space',
  description: `Query shared spaces using natural language (RAG-optimized).

⚠️ IMPORTANT: Do NOT add content_type filter unless the user explicitly requests filtering by type.
- ✅ CORRECT: User says "what's in The Void about hiking?" → { spaces: ["the_void"], query: "hiking" }
- ❌ WRONG: User says "what's in The Void about hiking?" → { spaces: ["the_void"], query: "hiking", content_type: "note" }
- ✅ CORRECT: User says "what notes are in The Void about hiking?" → { spaces: ["the_void"], query: "hiking", content_type: "note" }

Let the query algorithm find ALL relevant memories regardless of type unless explicitly requested.`,
  // ... rest of tool definition
};
```

### 5. Update remember_search_relationship Description (Optional)

Consider adding similar guidance:

```typescript
// src/tools/search-relationship.ts

export const searchRelationshipTool: Tool = {
  name: 'remember_search_relationship',
  description: `Search for relationships between memories.

⚠️ IMPORTANT: Do NOT add relationship_type filter unless the user explicitly requests filtering by type.
- ✅ CORRECT: User says "find relationships about hiking" → { query: "hiking" }
- ❌ WRONG: User says "find relationships about hiking" → { query: "hiking", relationship_type: "inspired_by" }

Let the search algorithm find ALL relevant relationships regardless of type unless explicitly requested.`,
  // ... rest of tool definition
};
```

### 6. Test Agent Behavior

Manual testing to verify agents follow instructions:

```bash
# Test 1: Generic search (should NOT add content_type)
User: "Search for memories about hiking"
Expected: { query: "hiking" }
Wrong: { query: "hiking", content_type: "note" }

# Test 2: Explicit type request (should add content_type)
User: "Search for note memories about hiking"
Expected: { query: "hiking", content_type: "note" }

# Test 3: Space search (should NOT add content_type)
User: "Search The Void for hiking trails"
Expected: { spaces: ["the_void"], query: "hiking trails" }
Wrong: { spaces: ["the_void"], query: "hiking trails", content_type: "location" }

# Test 4: Explicit type in space (should add content_type)
User: "Search The Void for location memories about hiking"
Expected: { spaces: ["the_void"], query: "hiking", content_type: "location" }
```

---

## Verification

- [ ] `remember_search_memory` description includes "Do NOT add content_type filter" warning
- [ ] `remember_query_memory` description includes same warning
- [ ] `remember_search_space` description includes same warning
- [ ] `remember_query_space` description includes same warning
- [ ] Each tool has ✅ CORRECT and ❌ WRONG examples
- [ ] TypeScript compiles without errors
- [ ] Build successful
- [ ] Manual test: Agent doesn't add content_type for generic searches
- [ ] Manual test: Agent adds content_type when explicitly requested

---

## Expected Output

**Tool Descriptions Before**:
```
Search your personal memories using hybrid search (semantic + keyword).
```

**Tool Descriptions After**:
```
Search your personal memories using hybrid search (semantic + keyword).

⚠️ IMPORTANT: Do NOT add content_type filter unless the user explicitly requests filtering by type.
- ✅ CORRECT: User says "search for hiking" → { query: "hiking" }
- ❌ WRONG: User says "search for hiking" → { query: "hiking", content_type: "note" }
- ✅ CORRECT: User says "search for note memories about hiking" → { query: "hiking", content_type: "note" }

Let the search algorithm find ALL relevant memories regardless of type unless explicitly requested.
```

---

## Impact Analysis

**Severity**: High (affects search quality and user experience)

**Affected Tools**: 4-5 tools
- `remember_search_memory`
- `remember_query_memory`
- `remember_search_space`
- `remember_query_space`
- `remember_search_relationship` (optional)

**User Impact**:
- Better search results (no over-filtering)
- More relevant memories returned
- Clearer agent behavior
- Improved user experience

**Agent Impact**:
- Clear guidance on when to filter
- Reduces confusion about content_type parameter
- Better alignment with user intent

---

## Common Issues and Solutions

### Issue 1: Agent still adds content_type filters

**Cause**: Agent's base model behavior overrides tool description
**Solution**: Make warning more prominent with ⚠️ emoji and examples

### Issue 2: Agent never adds content_type even when requested

**Cause**: Warning too strong, agent avoids parameter entirely
**Solution**: Include ✅ CORRECT examples showing when to use it

### Issue 3: Unclear when "explicit request" means

**Cause**: Ambiguous language in user query
**Solution**: Provide clear examples in tool description

---

## Resources

- [Tool Descriptions Best Practices](https://modelcontextprotocol.io/docs/concepts/tools)
- [remember_search_memory Tool](../src/tools/search-memory.ts)
- [remember_query_memory Tool](../src/tools/query-memory.ts)
- [remember_search_space Tool](../src/tools/search-space.ts)
- [remember_query_space Tool](../src/tools/query-space.ts)

---

## Notes

- This is a documentation-only change (no code logic changes)
- Affects agent behavior through tool description guidance
- May need iteration based on observed agent behavior
- Consider adding to system prompt if tool descriptions aren't sufficient
- Could be extended to other optional filter parameters (tags, weight, etc.)

---

## Related Tasks

- **Task 63**: Fix empty published memories (completed)
- **Task 62**: Fix confirmation response storage (pending)
- **Task 58**: Add comment unit tests (pending)
- **Task 59**: Update documentation (pending)

---

**Status**: Not Started
**Recommendation**: Implement after Task 62 to improve search UX
**Priority**: High - Directly impacts user experience and search quality
