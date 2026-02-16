# Task 50: Update remember_confirm for Multi-Space

**Milestone**: M11 - Unified Public Collection
**Estimated Time**: 2 hours
**Dependencies**: Task 49
**Status**: Not Started

---

## Objective

Update the `remember_confirm` tool to handle multi-space publishing, storing memories in the unified `Memory_public` collection with the `spaces` array field.

---

## Steps

### 1. Update executePublishMemory Function

**File**: `src/tools/confirm.ts`

**Key Changes**:
```typescript
async function executePublishMemory(
  request: ConfirmationRequest & { request_id: string },
  userId: string
): Promise<string> {
  // ... fetch original memory
  
  // Use unified public collection instead of per-space
  const publicCollection = await ensurePublicCollection(weaviateClient);
  
  // Create published memory with spaces array
  const publishedMemory = {
    ...originalMemory.properties,
    spaces: request.payload.spaces,  // ✅ Array from payload
    author_id: userId,
    published_at: new Date().toISOString(),
    discovery_count: 0,
    doc_type: 'space_memory',
    attribution: 'user' as const,
    tags: [...originalTags, ...additionalTags],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  };
  
  // Insert into Memory_public
  const result = await publicCollection.data.insert(publishedMemory as any);
  
  return JSON.stringify({
    success: true,
    space_memory_id: result,
    spaces: request.payload.spaces  // ✅ Return spaces array
  }, null, 2);
}
```

### 2. Update Logging

**File**: `src/tools/confirm.ts`

```typescript
console.log('[executePublishMemory] Inserting into Memory_public:', {
  spaces: request.payload.spaces,  // ✅ Log array
  memoryId: request.payload.memory_id,
  spaceCount: request.payload.spaces.length,
});
```

### 3. Handle Migration (Optional)

Support old `target_collection` format during transition:
```typescript
const spaces = request.payload.spaces || 
               (request.target_collection ? [request.target_collection] : ['the_void']);
```

### 4. Update Response Format

Return spaces array in success response:
```typescript
{
  "success": true,
  "space_memory_id": "new-id",
  "spaces": ["the_void", "dogs"]  // ✅ Show which spaces
}
```

---

## Verification

- [ ] Uses `ensurePublicCollection()` instead of `ensureSpaceCollection()`
- [ ] Stores `spaces` array in published memory
- [ ] Memory inserted into `Memory_public` collection
- [ ] Response includes `spaces` array
- [ ] Logging shows multi-space publishing
- [ ] Tests passing
- [ ] TypeScript compiles without errors
- [ ] Build successful

---

## Files Modified

- `src/tools/confirm.ts` - Update executePublishMemory

---

**Next Task**: Task 51 - Update remember_search_space for Multi-Space
