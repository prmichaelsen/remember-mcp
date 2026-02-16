# Task 35: Create Space Memory Types and Schema

**Milestone**: M10 - Shared Spaces & Confirmation Flow
**Estimated Time**: 3 hours
**Dependencies**: Task 34 (Token Service), M2 (Memory types)
**Status**: Not Started

---

## Objective

Create TypeScript types for space memories and Weaviate schema for shared space collections. Space memories are similar to personal memories but stored in shared collections with additional metadata for discovery and attribution.

---

## Steps

### 1. Create SpaceMemory Type Definitions

Create `src/types/space-memory.ts` with space-specific types.

**Actions**:
- Import base Memory type from `memory.ts`
- Define SpaceMemory interface extending Memory
- Add space-specific fields: `space_id`, `author_id`, `ghost_id`, `published_at`, `discovery_count`
- Define SpaceSearchOptions and SpaceSearchResult types
- Add JSDoc comments

**Expected Outcome**: SpaceMemory types defined

### 2. Create Space Schema File

Create `src/weaviate/space-schema.ts` for space collection management.

**Actions**:
- Import Weaviate client utilities
- Create `ensureSpaceCollection` function
- Define space collection schema (similar to Memory schema)
- Handle collection creation if doesn't exist
- Export helper functions

**Expected Outcome**: Space schema utilities created

### 3. Implement ensureSpaceCollection Function

Ensure a space collection exists, creating it if needed.

**Actions**:
- Accept space_id parameter (e.g., "the_void")
- Generate collection name: `Memory_{space_id}`
- Check if collection exists
- If not, create with schema
- Return collection reference
- Handle errors gracefully

**Expected Outcome**: Collections can be created on-demand

### 4. Define Space Collection Schema

Create Weaviate schema for space collections.

**Actions**:
- Use same properties as Memory collection
- Add space-specific properties: `space_id`, `author_id`, `ghost_id`, `published_at`, `discovery_count`
- Configure OpenAI vectorizer
- Set vectorization properties
- Add indexes for common queries

**Expected Outcome**: Space collections have proper schema

### 5. Create Collection Name Utilities

Helper functions for space collection naming.

**Actions**:
- `getSpaceCollectionName(space_id)` - Returns `Memory_{space_id}`
- `sanitizeSpaceId(display_name)` - Converts "The Void" → "the_void"
- `getSpaceDisplayName(space_id)` - Maps IDs to display names
- Add validation for space IDs

**Expected Outcome**: Naming utilities available

### 6. Add Space ID Constants

Define supported space IDs as constants.

**Actions**:
- Create `SUPPORTED_SPACES` constant
- Map space IDs to display names
- Export for use in tools
- Add type for space IDs

**Expected Outcome**: Space IDs centralized

### 7. Create Unit Tests

Test space schema and utilities.

**Actions**:
- Create `tests/unit/space-schema.test.ts`
- Test `ensureSpaceCollection` function
- Test collection name generation
- Test space ID sanitization
- Test display name mapping
- Mock Weaviate client

**Expected Outcome**: All tests passing

### 8. Update Type Exports

Export new types from main types file.

**Actions**:
- Add exports to `src/types/memory.ts` or create index
- Ensure SpaceMemory types are accessible
- Update any type documentation

**Expected Outcome**: Types properly exported

---

## Verification

- [ ] `src/types/space-memory.ts` created with SpaceMemory interface
- [ ] `src/weaviate/space-schema.ts` created
- [ ] `ensureSpaceCollection` function implemented
- [ ] Space collection schema defined
- [ ] Collection naming utilities created
- [ ] Space ID constants defined
- [ ] Unit tests created and passing
- [ ] TypeScript compiles without errors
- [ ] Types properly exported

---

## Code Example

```typescript
// src/types/space-memory.ts
export interface SpaceMemory extends Memory {
  space_id: string;           // "the_void", "public_space"
  author_id: string;          // Original user_id (for permissions)
  ghost_id?: string;          // Optional ghost profile
  published_at: string;       // ISO 8601 timestamp
  discovery_count: number;    // How many times discovered
  attribution: 'user' | 'ghost';
}

// src/weaviate/space-schema.ts
export async function ensureSpaceCollection(
  client: WeaviateClient,
  spaceId: string
): Promise<Collection> {
  const collectionName = getSpaceCollectionName(spaceId);
  
  const exists = await client.collections.exists(collectionName);
  if (!exists) {
    await createSpaceCollection(client, spaceId);
  }
  
  return client.collections.get(collectionName);
}

export function getSpaceCollectionName(spaceId: string): string {
  return `Memory_${spaceId}`;
}

export function sanitizeSpaceId(displayName: string): string {
  return displayName.toLowerCase().replace(/\s+/g, '_');
}
```

---

## Related Files

- Design: [`agent/design/publish-tools-confirmation-flow.md`](../design/publish-tools-confirmation-flow.md)
- Memory types: [`src/types/memory.ts`](../../src/types/memory.ts)
- Memory schema: [`src/weaviate/schema.ts`](../../src/weaviate/schema.ts)

---

**Next Task**: Task 36 - Implement remember_publish Tool
