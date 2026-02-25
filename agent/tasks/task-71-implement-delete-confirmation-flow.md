# Task 71: Implement Delete Confirmation Flow

**Milestone**: M13 (Soft Delete System)
**Estimated Time**: 4-5 hours
**Dependencies**: Task 70 (Schema fields must exist)
**Status**: Not Started

---

## Objective

Modify `remember_delete_memory` to create a confirmation token instead of immediately deleting the memory, and enhance `remember_confirm` to handle the `delete_memory` action. Include a preview of what will be deleted (content, relationship count, orphaned relationships).

---

## Steps

### 1. Update Delete Memory Tool ([`src/tools/delete-memory.ts`](../../src/tools/delete-memory.ts))

**Current Behavior**: Immediately deletes memory from Weaviate

**New Behavior**: Creates confirmation token and returns preview

```typescript
import { ConfirmationTokenService } from '../services/confirmation-token.service.js';

export const deleteMemoryTool: Tool = {
  name: 'remember_delete_memory',
  description: `Request to delete a memory. Requires confirmation via remember_confirm.
  
⚠️ **IMPORTANT**: This is a two-step process:
1. Call remember_delete_memory to request deletion (returns token)
2. User must confirm via remember_confirm with the token

The memory will be soft-deleted (marked as deleted but not removed from database).`,
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: {
        type: 'string',
        description: 'ID of memory to delete',
      },
      reason: {
        type: 'string',
        description: 'Optional reason for deletion',
      },
    },
    required: ['memory_id'],
  },
};

export async function handleDeleteMemory(
  args: { memory_id: string; reason?: string },
  userId: string
): Promise<any> {
  try {
    const { memory_id, reason } = args;
    const client = getWeaviateClient();
    const collectionName = `Memory_${sanitizeUserId(userId)}`;
    
    // Fetch memory to verify ownership and get preview
    const memory = await client.collections
      .get(collectionName)
      .query.fetchObjectById(memory_id, {
        includeVector: false,
      });
    
    if (!memory) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Memory not found: ${memory_id}`
      );
    }
    
    // Verify ownership
    if (memory.properties.user_id !== userId) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Cannot delete memory: not owned by user ${userId}`
      );
    }
    
    // Check if already deleted
    if (memory.properties.deleted_at) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Memory ${memory_id} is already deleted`
      );
    }
    
    // Find relationships that will be orphaned
    const relationships = await client.collections
      .get(collectionName)
      .query.fetchObjects({
        filters: Filters.and(
          collection.filter.byProperty('doc_type').equal('relationship'),
          collection.filter.byProperty('memory_ids').containsAny([memory_id])
        ),
        limit: 100,
      });
    
    const orphanedRelationships = relationships.objects.map(r => r.uuid);
    
    // Create confirmation token
    const tokenService = new ConfirmationTokenService();
    const { token, expiresAt } = await tokenService.createRequest(
      userId,
      'delete_memory',
      {
        memory_id,
        reason,
      }
    );
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            token,
            expires_at: expiresAt.toISOString(),
            preview: {
              memory_id,
              content: memory.properties.content?.substring(0, 200) + '...',
              type: memory.properties.type,
              relationships_count: orphanedRelationships.length,
              will_orphan: orphanedRelationships,
            },
            message: `Deletion requested. Use remember_confirm with token to complete deletion. Token expires in 5 minutes.`,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return handleToolError('remember_delete_memory', error, { userId, memory_id: args.memory_id });
  }
}
```

### 2. Enhance Confirm Tool ([`src/tools/confirm.ts`](../../src/tools/confirm.ts))

Add handling for `delete_memory` action:

```typescript
// In handleConfirm function, add new case

if (request.action === 'delete_memory') {
  const { memory_id, reason } = request.payload;
  
  // Soft delete the memory
  const client = getWeaviateClient();
  const collectionName = `Memory_${sanitizeUserId(userId)}`;
  
  await client.collections
    .get(collectionName)
    .data.update({
      id: memory_id,
      properties: {
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        deletion_reason: reason || null,
      },
    });
  
  // Mark request as confirmed
  await tokenService.confirmRequest(userId, token);
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          memory_id,
          message: 'Memory deleted successfully',
        }, null, 2),
      },
    ],
  };
}
```

### 3. Update Confirmation Token Service Types

Ensure `delete_memory` is a valid action type in [`src/services/confirmation-token.service.ts`](../../src/services/confirmation-token.service.ts):

```typescript
type ConfirmationAction = 'publish_memory' | 'delete_memory';
```

### 4. Build and Test

```bash
npm run build
npm test
```

**Expected**: 
- TypeScript compiles without errors
- All existing tests pass
- Build successful

---

## Verification

- [ ] `remember_delete_memory` creates confirmation token (not immediate delete)
- [ ] Token includes preview with content, type, relationship count
- [ ] Preview shows which relationships will be orphaned
- [ ] `remember_confirm` handles `delete_memory` action
- [ ] Confirmation sets `deleted_at`, `deleted_by`, `deletion_reason`
- [ ] Cannot delete already-deleted memory (returns error)
- [ ] Cannot delete memory owned by another user (returns error)
- [ ] Token expires after 5 minutes
- [ ] TypeScript compiles without errors
- [ ] Build successful
- [ ] All existing tests still passing

---

## Files Modified

- [`src/tools/delete-memory.ts`](../../src/tools/delete-memory.ts) - Change to confirmation flow
- [`src/tools/confirm.ts`](../../src/tools/confirm.ts) - Add delete_memory action handling
- [`src/services/confirmation-token.service.ts`](../../src/services/confirmation-token.service.ts) - Add delete_memory to action types

---

## Files Created

None

---

## Testing Notes

**Manual Testing**:
```typescript
// 1. Request deletion
remember_delete_memory({ memory_id: "abc123", reason: "No longer needed" })
// Returns: { token: "xyz789", preview: {...} }

// 2. Confirm deletion
remember_confirm({ token: "xyz789" })
// Returns: { success: true, memory_id: "abc123" }

// 3. Verify memory is soft-deleted
remember_search_memory({ query: "test", deleted_filter: "only" })
// Should find the deleted memory
```

---

## Next Task

Task 72: Add deleted_filter to Search Tools
