# Task 49: Update remember_publish for Multi-Space

**Milestone**: M11 - Unified Public Collection
**Estimated Time**: 2 hours
**Dependencies**: Task 48
**Status**: Not Started

---

## Objective

Update the `remember_publish` tool to accept a `spaces` array parameter, enabling users to publish memories to multiple spaces in a single operation.

---

## Steps

### 1. Update Tool Input Schema

**File**: `src/tools/publish.ts`

**Change**:
```typescript
// Before
target: {
  type: 'string',
  enum: SUPPORTED_SPACES,
  default: 'the_void',
}

// After
spaces: {
  type: 'array',
  items: {
    type: 'string',
    enum: SUPPORTED_SPACES
  },
  description: 'Spaces to publish to (e.g., ["the_void", "dogs"])',
  minItems: 1,
  default: ['the_void']
}
```

### 2. Update Tool Description

**File**: `src/tools/publish.ts`

```typescript
description: 'Publish a memory to one or more shared spaces. The memory will be COPIED (not moved) from your personal collection. Generates a confirmation token. Use remember_confirm to execute.',
```

### 3. Update handlePublish Function

**File**: `src/tools/publish.ts`

**Changes**:
- Accept `spaces: string[]` instead of `target: string`
- Validate all spaces in array
- Store `spaces` array in confirmation token payload

```typescript
interface PublishArgs {
  memory_id: string;
  spaces: string[];  // ✅ Changed from target: string
  additional_tags?: string[];
}

export async function handlePublish(
  args: PublishArgs,
  userId: string
): Promise<string> {
  // Validate all spaces
  const invalidSpaces = args.spaces.filter(s => !isValidSpaceId(s));
  if (invalidSpaces.length > 0) {
    return JSON.stringify({
      success: false,
      error: 'Invalid space IDs',
      message: `Invalid spaces: ${invalidSpaces.join(', ')}`,
      context: {
        invalid_spaces: invalidSpaces,
        supported_spaces: SUPPORTED_SPACES
      }
    }, null, 2);
  }
  
  // ... rest of validation
  
  // Store spaces array in payload
  const payload = {
    memory_id: args.memory_id,
    spaces: args.spaces,  // ✅ Array
    additional_tags: args.additional_tags || [],
  };
  
  const { requestId, token } = await confirmationTokenService.createRequest(
    userId,
    'publish_memory',
    payload,
    undefined  // No single target_collection anymore
  );
  
  return JSON.stringify({
    success: true,
    token,
  }, null, 2);
}
```

### 4. Add Backward Compatibility (Optional)

Support both `target` and `spaces` during migration:
```typescript
// Accept both formats
const spaces = args.spaces || (args.target ? [args.target] : ['the_void']);
```

### 5. Update Tests

**File**: `tests/unit/publish.test.ts` (create if doesn't exist)

**Add tests**:
- Publish to single space
- Publish to multiple spaces
- Invalid space validation
- Empty spaces array error

---

## Verification

- [ ] Tool accepts `spaces` array parameter
- [ ] Can publish to single space: `spaces: ["the_void"]`
- [ ] Can publish to multiple spaces: `spaces: ["the_void", "dogs"]`
- [ ] Invalid spaces rejected with clear error
- [ ] Empty spaces array rejected
- [ ] Token payload includes `spaces` array
- [ ] Tests passing
- [ ] TypeScript compiles without errors
- [ ] Build successful

---

## Files Modified

- `src/tools/publish.ts` - Update to accept spaces array

## Files Created

- `tests/unit/publish.test.ts` - Add multi-space tests (if doesn't exist)

---

**Next Task**: Task 50 - Update remember_confirm for Multi-Space
