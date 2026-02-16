# Task 48: Create Memory_public Collection

**Milestone**: M11 - Unified Public Collection
**Estimated Time**: 1 hour
**Dependencies**: Task 47
**Status**: Not Started

---

## Objective

Create the unified `Memory_public` Weaviate collection that will store all public space memories with the new `spaces` array field.

---

## Steps

### 1. Update Collection Creation Logic

**File**: `src/weaviate/space-schema.ts`

**Modify `createSpaceCollection`**:
```typescript
async function createSpaceCollection(
  client: WeaviateClient,
  spaceId: string
): Promise<void> {
  // Handle 'public' as special case
  const collectionName = spaceId === 'public' 
    ? PUBLIC_COLLECTION_NAME 
    : getSpaceCollectionName(spaceId);
  
  console.log(`[Weaviate] Creating space collection ${collectionName}...`);
  
  // ... rest of schema creation
}
```

### 2. Test Collection Creation

**File**: `src/weaviate/space-schema.spec.ts`

**Add test**:
```typescript
it('should create Memory_public collection', async () => {
  const collection = await ensurePublicCollection(mockClient);
  
  expect(mockClient.collections.exists).toHaveBeenCalledWith('Memory_public');
  expect(mockClient.collections.create).toHaveBeenCalled();
  expect(collection.name).toBe('Memory_public');
});
```

### 3. Verify Schema Properties

Ensure `Memory_public` has all required fields:
- `spaces` array (new)
- `space_id` (deprecated, for migration)
- `author_id`
- `attribution`
- `published_at`
- `discovery_count`
- All standard memory fields

### 4. Test with Actual Weaviate (Optional)

If Weaviate instance available:
```typescript
// Manual test
const client = getWeaviateClient();
const collection = await ensurePublicCollection(client);
console.log('Collection created:', collection.name);
```

---

## Verification

- [ ] `Memory_public` collection can be created
- [ ] Collection has `spaces` array field
- [ ] Collection has all required properties
- [ ] `ensurePublicCollection()` works correctly
- [ ] Tests passing
- [ ] TypeScript compiles without errors
- [ ] Build successful

---

## Files Modified

- `src/weaviate/space-schema.ts` - Update collection creation
- `src/weaviate/space-schema.spec.ts` - Add tests

---

**Next Task**: Task 49 - Update remember_publish for Multi-Space
