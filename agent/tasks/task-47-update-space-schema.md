# Task 47: Update Space Schema with Spaces Array

**Milestone**: M11 - Unified Public Collection
**Estimated Time**: 2 hours
**Dependencies**: Task 46
**Status**: Not Started

---

## Objective

Update the Weaviate space collection schema to include a `spaces` array field and prepare for the unified `Memory_public` collection.

---

## Steps

### 1. Add Spaces Field to Schema

**File**: `src/weaviate/space-schema.ts`

**Add property**:
```typescript
{
  name: 'spaces',
  dataType: 'text[]' as any,
  description: 'Spaces this memory is published to (e.g., ["the_void", "dogs"])',
}
```

### 2. Update Collection Name Constant

**File**: `src/weaviate/space-schema.ts`

**Add**:
```typescript
export const PUBLIC_COLLECTION_NAME = 'Memory_public';
```

### 3. Create ensurePublicCollection Function

**File**: `src/weaviate/space-schema.ts`

**Add**:
```typescript
/**
 * Ensure the unified public collection exists
 */
export async function ensurePublicCollection(
  client: WeaviateClient
): Promise<Collection<any>> {
  const collectionName = PUBLIC_COLLECTION_NAME;
  
  const exists = await client.collections.exists(collectionName);
  
  if (!exists) {
    await createSpaceCollection(client, 'public');
  }
  
  return client.collections.get(collectionName);
}
```

### 4. Keep Backward Compatibility

**File**: `src/weaviate/space-schema.ts`

- Keep `ensureSpaceCollection()` function for now
- Keep `getSpaceCollectionName()` function for now
- Add deprecation comments

### 5. Update Schema Tests

**File**: `src/weaviate/space-schema.spec.ts`

**Add tests**:
- Test `ensurePublicCollection()` creates `Memory_public`
- Test `spaces` field is in schema
- Test backward compatibility functions still work

---

## Verification

- [ ] `spaces` field added to schema as `text[]`
- [ ] `PUBLIC_COLLECTION_NAME` constant defined
- [ ] `ensurePublicCollection()` function created
- [ ] Backward compatibility maintained
- [ ] Schema tests updated and passing
- [ ] TypeScript compiles without errors
- [ ] Build successful

---

## Files Modified

- `src/weaviate/space-schema.ts` - Add spaces field, public collection
- `src/weaviate/space-schema.spec.ts` - Add tests

---

**Next Task**: Task 48 - Create Memory_public Collection
