# Unified Public Collection Architecture

**Concept**: Single `Memory_public` collection for all public spaces with multi-space support
**Created**: 2026-02-16
**Status**: Design Proposal

---

## Overview

This design proposes replacing per-space collections (`Memory_the_void`, `Memory_dogs`, etc.) with a unified `Memory_public` collection where memories can belong to multiple spaces simultaneously. This enables multi-space search, eliminates duplication, and provides a more flexible and scalable architecture.

---

## Problem Statement

### Current Architecture Limitations

**Per-Space Collections** (Current):
```
Memory_the_void     → Only "The Void" memories
Memory_dogs         → Only "Dogs" space memories  
Memory_cats         → Only "Cats" space memories
```

**Problems**:
1. **No Multi-Space Search**: Users can't search across multiple spaces in one query
   - "Search the void and dogs for cute dog pictures" requires two separate queries
   - Results must be merged manually
   - Poor user experience

2. **Memory Duplication**: Publishing to multiple spaces creates copies
   - Same memory stored multiple times
   - Wastes storage
   - Updates must be synchronized across copies
   - Inconsistency risk

3. **Collection Proliferation**: Each new space requires a new collection
   - Hundreds of collections for popular spaces
   - Management overhead
   - Weaviate resource usage

4. **Inflexible**: Can't easily add/remove spaces from a memory
   - Must delete and recreate
   - Loses discovery metrics
   - Complex workflow

---

## Solution: Unified Public Collection

### Architecture

**Single Public Collection**:
```
Memory_public       → ALL public space memories
  Properties:
    - spaces: ["the_void"]              ← Single space
    - spaces: ["dogs", "cats"]          ← Multiple spaces
    - spaces: ["the_void", "dogs"]      ← Cross-space
```

**Key Changes**:
1. `space_id: string` → `spaces: string[]` (array of space IDs)
2. Single collection `Memory_public` instead of per-space collections
3. Filter by spaces array for targeted search
4. Publish to multiple spaces in one operation

---

## Benefits

### 1. Multi-Space Search

**User Request**: "Search the void and dogs for cute dog pictures"

**Current** (Requires 2 queries):
```typescript
// Query 1
remember_search_space({ space: "the_void", query: "cute dog pictures" })
// Query 2  
remember_search_space({ space: "dogs", query: "cute dog pictures" })
// Merge results manually
```

**Proposed** (Single query):
```typescript
remember_search_space({ 
  spaces: ["the_void", "dogs"],  // ✅ Multiple spaces!
  query: "cute dog pictures" 
})
```

### 2. No Duplication

**Current**: Publish to 3 spaces = 3 copies
```
Memory_the_void/abc123   ← Copy 1
Memory_dogs/abc123       ← Copy 2
Memory_cats/abc123       ← Copy 3
```

**Proposed**: Publish to 3 spaces = 1 memory
```
Memory_public/abc123
  spaces: ["the_void", "dogs", "cats"]  ← One memory, three spaces!
```

### 3. Efficient Storage

- **Current**: N spaces × M memories = N×M documents
- **Proposed**: M memories (regardless of spaces)
- **Savings**: Up to N× reduction in storage

### 4. Flexible Space Management

**Add Space**:
```typescript
// Just update the spaces array
updateMemory({ 
  id: "abc123",
  spaces: [...existingSpaces, "new_space"]
})
```

**Remove Space**:
```typescript
// Just filter the spaces array
updateMemory({ 
  id: "abc123",
  spaces: existingSpaces.filter(s => s !== "old_space")
})
```

### 5. Simpler Architecture

- **Current**: Manage N collections
- **Proposed**: Manage 1 collection
- **Benefit**: Simpler code, easier maintenance

---

## Implementation

### Type Changes

**Before** (`src/types/space-memory.ts`):
```typescript
export interface SpaceMemory extends Omit<Memory, 'user_id' | 'doc_type'> {
  space_id: string;  // ❌ Single space
  author_id: string;
  // ...
}
```

**After**:
```typescript
export interface SpaceMemory extends Omit<Memory, 'user_id' | 'doc_type'> {
  spaces: string[];  // ✅ Multiple spaces!
  author_id: string;
  // ...
}
```

### Schema Changes

**Before** (`src/weaviate/space-schema.ts`):
```typescript
// Create separate collection for each space
export function getSpaceCollectionName(spaceId: string): string {
  return `Memory_${spaceId}`;  // Memory_the_void, Memory_dogs, etc.
}
```

**After**:
```typescript
// Single public collection
export const PUBLIC_COLLECTION_NAME = 'Memory_public';

export function ensurePublicCollection(client: WeaviateClient): Promise<Collection> {
  return ensureCollection(client, PUBLIC_COLLECTION_NAME);
}
```

**Schema Properties**:
```typescript
{
  name: 'spaces',
  dataType: 'text[]' as any,  // ✅ Array of space IDs
  description: 'Spaces this memory is published to (e.g., ["the_void", "dogs"])',
}
```

### Tool Changes

#### remember_publish

**Before**:
```typescript
{
  target: {
    type: 'string',
    enum: ['the_void'],  // Single space
  }
}
```

**After**:
```typescript
{
  spaces: {
    type: 'array',
    items: { 
      type: 'string',
      enum: SUPPORTED_SPACES  // Multiple spaces!
    },
    description: 'Spaces to publish to (e.g., ["the_void", "dogs"])',
    minItems: 1,
  }
}
```

#### remember_search_space

**Before**:
```typescript
{
  space: {
    type: 'string',
    enum: ['the_void'],  // Single space
  }
}
```

**After**:
```typescript
{
  spaces: {
    type: 'array',
    items: { 
      type: 'string',
      enum: SUPPORTED_SPACES
    },
    description: 'Spaces to search (e.g., ["the_void", "dogs"])',
    minItems: 1,
  }
}
```

**Filter Logic**:
```typescript
// Weaviate filter: memory.spaces contains ANY of the requested spaces
collection.filter
  .byProperty('spaces')
  .containsAny(requestedSpaces)
```

#### remember_query_space

Same changes as `remember_search_space`.

### Confirmation Flow Changes

**Before** (`src/tools/confirm.ts`):
```typescript
const targetCollection = await ensureSpaceCollection(
  weaviateClient,
  request.target_collection || 'the_void'
);

const publishedMemory = {
  ...originalMemory.properties,
  space_id: request.target_collection || 'the_void',
  // ...
};
```

**After**:
```typescript
const publicCollection = await ensurePublicCollection(weaviateClient);

const publishedMemory = {
  ...originalMemory.properties,
  spaces: request.spaces || ['the_void'],  // ✅ Array!
  // ...
};
```

---

## Migration Strategy

### Phase 1: Add Support (Backward Compatible)

1. **Add `spaces` field** to SpaceMemory type (keep `space_id` for now)
2. **Support both** `space` and `spaces` parameters in tools
3. **Create `Memory_public`** collection alongside existing collections
4. **Dual-write**: Publish to both old and new collections

### Phase 2: Migrate Data

1. **Copy existing memories** from per-space collections to `Memory_public`
2. **Set `spaces` array** based on source collection
3. **Verify data integrity**

### Phase 3: Deprecate Old Collections

1. **Update tools** to use only `spaces` parameter
2. **Remove `space_id` field** from types
3. **Delete old collections**: `Memory_the_void`, etc.
4. **Update documentation**

---

## Trade-offs

### Pros

✅ **Multi-space search**: Single query across multiple spaces
✅ **No duplication**: One memory, multiple spaces
✅ **Efficient storage**: N× reduction in documents
✅ **Flexible**: Easy to add/remove spaces
✅ **Simpler**: One collection vs. many
✅ **Scalable**: Handles thousands of spaces
✅ **Better UX**: Natural multi-space queries

### Cons

❌ **Migration complexity**: Must migrate existing data
❌ **Breaking change**: API changes required
❌ **Lost isolation**: All public spaces share collection
❌ **Security considerations**: Can't have per-space access control at collection level
❌ **Schema constraints**: All spaces must use same schema

---

## Security Considerations

### Access Control

**Current**: Per-space collections enable collection-level access control
```
Memory_the_void   → Public read access
Memory_private    → Restricted access
```

**Proposed**: Document-level access control via `spaces` field
```
Memory_public
  - spaces: ["the_void"]     → Public
  - spaces: ["private_123"]  → Restricted (filter by user)
```

**Solution**: Separate collections for different access levels
```
Memory_public    → Public spaces (the_void, dogs, cats)
Memory_shared    → User-shared spaces (family, work)
Memory_private   → Private spaces (personal)
```

### Space Validation

**Prevent unauthorized space access**:
```typescript
// Validate user can publish to requested spaces
const allowedSpaces = await getAuthorizedSpaces(userId);
const requestedSpaces = args.spaces;

if (!requestedSpaces.every(s => allowedSpaces.includes(s))) {
  throw new Error('Unauthorized space access');
}
```

---

## Examples

### Example 1: Publish to Multiple Spaces

**Request**:
```typescript
remember_publish({
  memory_id: "abc123",
  spaces: ["the_void", "dogs", "cute_animals"]
})
```

**Result**:
```json
{
  "success": true,
  "token": "xyz789"
}
```

**After Confirmation**:
```typescript
// Memory in Memory_public collection
{
  "id": "new-id",
  "spaces": ["the_void", "dogs", "cute_animals"],
  "author_id": "user123",
  "content": "My dog is so cute!",
  "doc_type": "space_memory"
}
```

### Example 2: Multi-Space Search

**Request**:
```typescript
remember_search_space({
  spaces: ["the_void", "dogs"],
  query: "cute dog pictures",
  limit: 10
})
```

**Weaviate Query**:
```typescript
collection
  .query
  .hybrid(query, { alpha: 0.5 })
  .filter(
    Filters.or(
      collection.filter.byProperty('spaces').containsAny(['the_void', 'dogs'])
    )
  )
  .limit(10)
```

**Result**: Memories from both "The Void" and "Dogs" spaces

### Example 3: Add Space to Existing Memory

**Request**:
```typescript
remember_update_memory({
  memory_id: "abc123",
  spaces: [...existingSpaces, "new_space"]
})
```

**Result**: Memory now appears in additional space

---

## Alternatives Considered

### Alternative 1: Keep Per-Space Collections

**Pros**: Isolation, per-space schemas
**Cons**: All the problems listed above
**Verdict**: ❌ Doesn't solve multi-space search

### Alternative 2: Hybrid Approach

**Architecture**:
```
Memory_public       → General public spaces
Memory_private_123  → User's private spaces
Memory_the_void     → Special "The Void" space (isolated)
```

**Pros**: Flexibility, isolation where needed
**Cons**: Complexity, inconsistent architecture
**Verdict**: ⚠️ Consider if security requires it

### Alternative 3: Space as Tag

**Architecture**: Use `tags` array instead of dedicated `spaces` field

**Pros**: Reuses existing field
**Cons**: Conflates spaces with tags, less clear semantics
**Verdict**: ❌ Spaces are not tags

---

## Recommendations

### Immediate Actions

1. ✅ **Approve this design** before implementing
2. ✅ **Create migration plan** for existing data
3. ✅ **Update M10 tasks** to reflect new architecture
4. ✅ **Document breaking changes** in CHANGELOG

### Implementation Order

1. **Phase 1**: Update types and schema (backward compatible)
2. **Phase 2**: Update tools to support `spaces` array
3. **Phase 3**: Create `Memory_public` collection
4. **Phase 4**: Migrate existing data
5. **Phase 5**: Deprecate old collections
6. **Phase 6**: Update documentation

### Version Planning

- **v2.4.0**: Add `spaces` support (backward compatible)
- **v2.5.0**: Migrate to `Memory_public` (deprecate old)
- **v3.0.0**: Remove per-space collections (breaking change)

---

## Open Questions

1. **Should we support both `space` and `spaces` parameters during migration?**
   - Recommendation: Yes, for backward compatibility

2. **How do we handle private vs. public spaces?**
   - Recommendation: Separate collections (`Memory_public`, `Memory_shared`)

3. **Should spaces be ordered or unordered?**
   - Recommendation: Unordered (set semantics)

4. **Maximum number of spaces per memory?**
   - Recommendation: 10 spaces (prevent abuse)

5. **Can users create custom spaces?**
   - Recommendation: Yes, but with validation

---

## Success Criteria

- [ ] Multi-space search works in single query
- [ ] No memory duplication across spaces
- [ ] Storage reduced by N× (where N = avg spaces per memory)
- [ ] Add/remove spaces without recreating memory
- [ ] All existing functionality preserved
- [ ] Migration completes without data loss
- [ ] Performance equal or better than current
- [ ] Documentation updated
- [ ] Tests passing

---

**Status**: Design Proposal - Awaiting Approval
**Recommendation**: Implement in v2.4.0 with backward compatibility, full migration in v3.0.0

**Next Steps**:
1. Review and approve design
2. Update M10 milestone with new architecture
3. Create migration tasks
4. Begin implementation
