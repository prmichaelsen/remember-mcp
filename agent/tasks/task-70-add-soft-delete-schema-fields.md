# Task 70: Add Soft Delete Schema Fields

**Milestone**: M13 (Soft Delete System)
**Estimated Time**: 2-3 hours
**Dependencies**: None
**Status**: Not Started

---

## Objective

Add three new fields to the Weaviate schema to support soft delete functionality: `deleted_at` (timestamp), `deleted_by` (user ID), and `deletion_reason` (optional text). These fields enable tracking when memories are deleted, who deleted them, and why, while keeping the data in the database for potential future recovery.

---

## Steps

### 1. Update Memory Schema ([`src/weaviate/schema.ts`](../../src/weaviate/schema.ts))

Add three new properties to the `createMemoryCollection` function:

```typescript
// After existing properties (around line 150)

// Soft delete fields
{
  name: 'deleted_at',
  dataType: 'date' as any,
  description: 'Timestamp when memory was soft-deleted (null = not deleted)',
},
{
  name: 'deleted_by',
  dataType: 'text' as any,
  description: 'User ID who deleted the memory',
},
{
  name: 'deletion_reason',
  dataType: 'text' as any,
  description: 'Optional reason for deletion',
},
```

**Note**: `deleted_at` is nullable. Missing or `null` value means memory is not deleted.

### 2. Update Public Collection Schema ([`src/weaviate/space-schema.ts`](../../src/weaviate/space-schema.ts))

Add the same three fields to `ensurePublicCollection` function:

```typescript
// After existing properties

// Soft delete fields
{
  name: 'deleted_at',
  dataType: 'date' as any,
  description: 'Timestamp when memory was soft-deleted (null = not deleted)',
},
{
  name: 'deleted_by',
  dataType: 'text' as any,
  description: 'User ID who deleted the memory',
},
{
  name: 'deletion_reason',
  dataType: 'text' as any,
  description: 'Optional reason for deletion',
},
```

### 3. Update Memory Type Definitions ([`src/types/memory.ts`](../../src/types/memory.ts))

Add fields to `Memory` interface:

```typescript
export interface Memory {
  // ... existing fields
  
  // Soft delete fields
  deleted_at?: Date | null;
  deleted_by?: string;
  deletion_reason?: string;
}
```

### 4. Update SpaceMemory Type ([`src/types/space-memory.ts`](../../src/types/space-memory.ts))

Add fields to `SpaceMemory` interface:

```typescript
export interface SpaceMemory {
  // ... existing fields
  
  // Soft delete fields
  deleted_at?: Date | null;
  deleted_by?: string;
  deletion_reason?: string;
}
```

### 5. Update ALL_MEMORY_PROPERTIES Constant ([`src/weaviate/client.ts`](../../src/weaviate/client.ts))

Add new fields to the properties array:

```typescript
const ALL_MEMORY_PROPERTIES = [
  // ... existing properties
  'deleted_at',
  'deleted_by',
  'deletion_reason',
];
```

### 6. Build and Test

```bash
npm run build
```

**Expected**: TypeScript compiles without errors

---

## Verification

- [ ] `deleted_at` field added to Memory schema (date, nullable)
- [ ] `deleted_by` field added to Memory schema (text)
- [ ] `deletion_reason` field added to Memory schema (text)
- [ ] Same 3 fields added to Memory_public schema
- [ ] Fields added to Memory interface in types
- [ ] Fields added to SpaceMemory interface in types
- [ ] Fields added to ALL_MEMORY_PROPERTIES constant
- [ ] TypeScript compiles without errors
- [ ] Build successful
- [ ] No breaking changes to existing code

---

## Files Modified

- [`src/weaviate/schema.ts`](../../src/weaviate/schema.ts) - Add 3 fields to Memory schema
- [`src/weaviate/space-schema.ts`](../../src/weaviate/space-schema.ts) - Add 3 fields to public collection
- [`src/types/memory.ts`](../../src/types/memory.ts) - Add fields to Memory interface
- [`src/types/space-memory.ts`](../../src/types/space-memory.ts) - Add fields to SpaceMemory interface
- [`src/weaviate/client.ts`](../../src/weaviate/client.ts) - Add fields to ALL_MEMORY_PROPERTIES

---

## Files Created

None

---

## Notes

- **Nullable Field**: `deleted_at` being nullable is critical. Missing or `null` = not deleted.
- **No Migration Needed**: Existing memories will implicitly have `deleted_at: null`
- **Weaviate Behavior**: `isNull(true)` filter correctly handles missing fields
- **Optional Fields**: `deleted_by` and `deletion_reason` are optional in TypeScript but will be set when memory is deleted

---

## Next Task

Task 71: Implement Delete Confirmation Flow
