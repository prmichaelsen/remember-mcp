# Task 66: Support All Schema Fields in Create/Update Tools

**Milestone**: M12 (Comment System / Schema Completeness)
**Estimated Time**: 2 hours
**Dependencies**: Task 65 (migration script)
**Status**: Not Started
**Priority**: High

---

## Objective

Ensure all create and update tools (both personal and space tools) support ALL schema fields in their input schemas and properly initialize/update them. This includes comment fields and any other fields that may be missing from tool schemas.

---

## Context

**Current Problem**:
- New memories created via `remember_create_memory` don't have comment fields
- Space memories created via `remember_publish` may be missing fields
- Update tools may not support all schema fields
- After migration (Task 65), old memories will have these fields
- This creates inconsistency between old and new memories

**Missing Fields**:
- Comment fields: `parent_id`, `thread_root_id`, `moderation_flags`
- Potentially other fields not in tool schemas

**Affected Tools**:
- `remember_create_memory` - Personal memory creation
- `remember_update_memory` - Personal memory updates
- `remember_publish` / `remember_confirm` - Space memory creation (via executePublishMemory)

**Impact**:
- New memories missing fields
- Inconsistent schema across memories
- Potential query/filter issues
- Space memories may be incomplete

---

## Steps

### 1. Update remember_create_memory Tool Schema

Add comment fields to input schema:

```typescript
// src/tools/create-memory.ts

export const createMemoryTool: Tool = {
  name: 'remember_create_memory',
  description: '...',
  inputSchema: {
    type: 'object',
    properties: {
      // ... existing properties ...
      
      // Comment/threading fields (optional)
      parent_id: {
        type: 'string',
        description: 'ID of parent memory or comment (for threading). Leave null for top-level memories.',
      },
      thread_root_id: {
        type: 'string',
        description: 'Root memory ID for thread. Leave null for top-level memories.',
      },
      moderation_flags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Per-space moderation flags (format: "{space_id}:{flag_type}"). Usually empty.',
        default: [],
      },
    },
    required: ['type', 'content'], // parent_id, thread_root_id, moderation_flags are optional
  },
};
```

### 2. Initialize Comment Fields in handleCreateMemory

Ensure fields are always initialized:

```typescript
// src/tools/create-memory.ts - in handleCreateMemory function

const memory: Memory = {
  // ... existing fields ...
  
  // Comment/threading fields (initialize to defaults)
  parent_id: args.parent_id || null,
  thread_root_id: args.thread_root_id || null,
  moderation_flags: args.moderation_flags || [],
  
  // ... rest of fields ...
};
```

### 3. Update remember_update_memory Tool Schema

Add comment fields to update schema:

```typescript
// src/tools/update-memory.ts

export const updateMemoryTool: Tool = {
  name: 'remember_update_memory',
  description: '...',
  inputSchema: {
    type: 'object',
    properties: {
      // ... existing properties ...
      
      // Comment/threading fields (optional)
      parent_id: {
        type: 'string',
        description: 'Update parent ID (for threading)',
      },
      thread_root_id: {
        type: 'string',
        description: 'Update thread root ID',
      },
      moderation_flags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Update moderation flags',
      },
    },
    required: ['memory_id'],
  },
};
```

### 4. Support Comment Fields in handleUpdateMemory

Allow updating comment fields:

```typescript
// src/tools/update-memory.ts - in handleUpdateMemory function

const updates: Partial<Memory> = {};

// ... existing field updates ...

// Comment/threading fields
if (args.parent_id !== undefined) {
  updates.parent_id = args.parent_id;
}
if (args.thread_root_id !== undefined) {
  updates.thread_root_id = args.thread_root_id;
}
if (args.moderation_flags !== undefined) {
  updates.moderation_flags = args.moderation_flags;
}
```

### 5. Update Memory Type Interface

Ensure TypeScript types include comment fields:

```typescript
// src/types/memory.ts

export interface Memory {
  // ... existing fields ...
  
  // Comment/threading fields
  parent_id?: string | null;
  thread_root_id?: string | null;
  moderation_flags?: string[];
  
  // ... rest of fields ...
}
```

### 6. Test New Memory Creation

Verify new memories have comment fields:

```bash
# Create a regular memory
remember_create_memory({
  type: "note",
  content: "Test memory"
})

# Verify it has:
# - parent_id: null
# - thread_root_id: null
# - moderation_flags: []

# Create a comment
remember_create_memory({
  type: "comment",
  content: "Great post!",
  parent_id: "memory123",
  thread_root_id: "memory123"
})

# Verify it has the parent/thread IDs set
```

---

## Verification

- [ ] `remember_create_memory` input schema includes comment fields
- [ ] `handleCreateMemory` initializes comment fields to defaults
- [ ] `remember_update_memory` input schema includes comment fields
- [ ] `handleUpdateMemory` supports updating comment fields
- [ ] `Memory` type interface includes comment fields
- [ ] New memories created with `parent_id: null`
- [ ] New memories created with `thread_root_id: null`
- [ ] New memories created with `moderation_flags: []`
- [ ] Can create comments with parent_id set
- [ ] TypeScript compiles without errors
- [ ] Build successful
- [ ] All tests passing

---

## Expected Output

**New Regular Memory**:
```json
{
  "id": "new-memory-id",
  "type": "note",
  "content": "Test content",
  "parent_id": null,
  "thread_root_id": null,
  "moderation_flags": [],
  // ... other fields
}
```

**New Comment**:
```json
{
  "id": "comment-id",
  "type": "comment",
  "content": "Great post!",
  "parent_id": "memory123",
  "thread_root_id": "memory123",
  "moderation_flags": [],
  // ... other fields
}
```

---

## Common Issues and Solutions

### Issue 1: TypeScript errors about new fields

**Cause**: Memory type not updated
**Solution**: Add fields to Memory interface in src/types/memory.ts

### Issue 2: Fields not showing in created memories

**Cause**: Not initialized in handleCreateMemory
**Solution**: Ensure defaults are set (null for IDs, [] for flags)

### Issue 3: Can't update comment fields

**Cause**: handleUpdateMemory doesn't support them
**Solution**: Add field update logic

---

## Resources

- [Memory Type Definition](../src/types/memory.ts)
- [remember_create_memory Tool](../src/tools/create-memory.ts)
- [remember_update_memory Tool](../src/tools/update-memory.ts)
- [Comment System Design](../design/comment-memory-type.md)

---

## Notes

- This ensures consistency between old (migrated) and new memories
- Comment fields are optional in input schema
- Defaults: `parent_id: null`, `thread_root_id: null`, `moderation_flags: []`
- Only comments should have non-null parent_id/thread_root_id
- Regular memories always have null for these fields
- This completes the comment system foundation

---

**Status**: Not Started
**Recommendation**: Implement after Task 65 migration completes
**Priority**: High - Ensures schema consistency for all new memories
