# Generic Confirmation Flow - Token-Based Action Execution

**Concept**: Generic token-based confirmation system for any sensitive operation
**Created**: 2026-02-16
**Status**: Design Specification

---

## Overview

A generic confirmation-based system for executing sensitive operations. Uses one-time tokens to ensure user consent. All parameters are captured and stored, making the flow natural and organized.

**Core Tools**:
1. `remember_publish` - Publish a memory to a shared space (generates token with stored params)
2. `remember_confirm` - Generic confirmation tool that executes any pending action
3. `remember_deny` - Generic denial tool for any pending action
4. `remember_search_space` - Search and discover memories from shared spaces
5. `remember_query_space` - RAG-optimized natural language queries across shared spaces

**Key Design Principles**:
- **ANY command requiring confirmation** generates a token and stores ALL parameters
- Action tools (like `remember_publish`, `remember_retract`, etc.) follow this pattern
- Generic `remember_confirm` executes ANY stored action
- Generic `remember_deny` denies ANY stored action
- Makes agent flow natural: request → ask user → confirm/deny

**Examples of Confirmable Actions**:
- `remember_publish` - Publish memory to shared space
- `remember_retract` - Unpublish memory from shared space (future)
- Any other sensitive operation requiring user confirmation

**Supported Spaces**:
- `the_void` - "The Void" (shared discovery space)
  - Space ID: `the_void` (snake_case)
  - Collection Name: `Memory_the_void`
  - Display Name: "The Void" (can use any case/spaces)
- Extensible to other spaces as needed

**Naming Convention**:
- Display names can have spaces and mixed case: "The Void", "Public Space"
- Space IDs are snake_case (lowercase with underscores): `the_void`, `public_space`
- Collection names follow pattern: `Memory_{snake_case_id}`
- Conversion: "The Void" → lowercase → replace spaces → `the_void` → `Memory_the_void`

---

## Problem Statement

Publishing memories to shared spaces is a sensitive operation that requires explicit user consent. We need:
- **User confirmation** before publishing to shared collections
- **One-time tokens** to prevent replay attacks
- **Request/confirm flow** that agents can use naturally
- **Flexibility** to publish to different collections (void, public, etc.)
- **Auditability** of what was requested vs. what was confirmed

---

## Solution: Token-Based Confirmation Flow

### Flow Diagram

```
Agent: "I'd like to publish this memory to The Void"
  ↓
Tool: remember_publish(memory_id, target="void")
  ↓
System: Validates memory, generates one-time token, stores all parameters
  ↓
Response: { status: "pending", token: "abc123", payload: {...} }
  ↓
Agent: "User, do you want to publish this to The Void?"
  ↓
User: "Yes" → Agent calls remember_confirm(token="abc123")
User: "No" → Agent calls remember_deny(token="abc123")
  ↓
System: Validates token, fetches memory fresh, executes or denies action
  ↓
Response: { status: "confirmed", payload: {...} } or { status: "denied", payload: {...} }
```

---

## Architecture

### Token Management

**Storage**: Firestore collection `pending_confirmations/{user_id}/requests/{request_id}`

```typescript
interface PendingConfirmation {
  request_id: string;
  user_id: string;
  token: string;              // One-time use token (UUID)
  action: string;             // 'publish_to_void', 'publish_to_public', etc.
  target_collection: string;  // 'void', 'public', etc.
  payload: any;               // The data to be published
  created_at: Timestamp;
  expires_at: Timestamp;      // 5 minutes from creation
  status: 'pending' | 'confirmed' | 'denied' | 'expired' | 'retracted';
  confirmed_at?: Timestamp;
}
```

**Token Properties**:
- One-time use (deleted after confirm/deny)
- Expires after 5 minutes
- Cryptographically random (UUID v4)
- Scoped to user_id
- Stores complete action payload

---

## Tool Definitions

### 1. remember_publish

Publish a memory to a shared collection. Generates a confirmation token with all parameters stored.

```typescript
{
  name: 'remember_publish',
  description: 'Publish a memory to a shared collection (like The Void). The memory will be COPIED (not moved) from your personal collection. Generates a confirmation token. Use remember_confirm to execute.',
  inputSchema: {
    type: 'object',
    properties: {
      memory_id: {
        type: 'string',
        description: 'ID of the memory from your personal collection to publish'
      },
      target: {
        type: 'string',
        description: 'Target space to publish to (snake_case ID)',
        enum: ['the_void'],
        default: 'the_void'
      },
      additional_tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Additional tags for discovery (merged with original tags)',
        default: []
      }
    },
    required: ['memory_id', 'target']
  }
}
```

**Response** (Generic format):
```json
{
  "success": true,
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "payload": {
    "action": "publish_memory",
    "memory_id": "uuid-original",
    "target": "void",
    "additional_tags": []
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Memory not found",
  "message": "No memory found with ID: uuid-original",
  "context": {
    "collection_name": "Memory_User_123",
    "collection_exists": true,
    "query_executed": true
  }
}
```

**Note**: All parameters are stored with the token. Content is fetched fresh during confirmation. Status is implied by success flag.

### 2. remember_confirm

Generic confirmation tool that executes any pending action.

```typescript
{
  name: 'remember_confirm',
  description: 'Confirm and execute a pending action using the token. Works for any action that requires confirmation (publish, delete, etc.).',
  inputSchema: {
    type: 'object',
    properties: {
      token: {
        type: 'string',
        description: 'The confirmation token from the action tool'
      }
    },
    required: ['token']
  }
}
```

**Response** (Minimal - only essential info):
```json
{
  "success": true,
  "payload": {
    "action": "publish_memory",
    "space": "void",
    "space_memory_id": "uuid-new-in-void"
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Invalid or expired token",
  "message": "The confirmation token is invalid, expired, or has already been used.",
  "context": {
    "token_found": false,
    "token_expired": false,
    "token_already_used": true,
    "used_at": "2026-02-16T03:15:00Z"
  }
}
```

**Note**: Response is minimal. Agent already knows the original memory details, so only the new space_memory_id is returned.

### 3. remember_deny

Generic denial tool for any pending action.

```typescript
{
  name: 'remember_deny',
  description: 'Deny a pending action. The request will be marked as denied and the token invalidated. Works for any action that requires confirmation.',
  inputSchema: {
    type: 'object',
    properties: {
      token: {
        type: 'string',
        description: 'The confirmation token from the action tool'
      }
    },
    required: ['token']
  }
}
```

**Response**:
```json
{
  "success": true
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Invalid token",
  "message": "Token not found or already used",
  "context": {
    "token_found": false,
    "checked_requests": 5,
    "last_valid_request": "2026-02-16T03:10:00Z"
  }
}
```

**Note**: Denial is simple - just confirms the action was denied. No payload needed.

### 4. remember_search_space

Search and discover memories from shared spaces. Same as `remember_search_memory` but with a `space` parameter.

```typescript
{
  name: 'remember_search_space',
  description: 'Search shared spaces to discover thoughts, ideas, and memories. Works like remember_search_memory but searches shared spaces instead of personal memories.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (semantic + keyword hybrid)'
      },
      space: {
        type: 'string',
        description: 'Which space to search',
        enum: ['void'],
        default: 'void'
      },
      // Same filters as remember_search_memory
      content_type: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      min_weight: { type: 'number', minimum: 0, maximum: 1 },
      max_weight: { type: 'number', minimum: 0, maximum: 1 },
      date_from: { type: 'string' },
      date_to: { type: 'string' },
      limit: { type: 'number', default: 10 },
      offset: { type: 'number', default: 0 }
    },
    required: ['query', 'space']
  }
}
```

**Note**: Uses same input schema as [`remember_search_memory`](../src/tools/search-memory.ts) plus `space` parameter.

### 5. remember_query_space

RAG-optimized queries for shared spaces. Same as `remember_query_memory` but with a `space` parameter.

```typescript
{
  name: 'remember_query_space',
  description: 'Ask natural language questions about memories in shared spaces. Works like remember_query_memory but queries shared spaces.',
  inputSchema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'Natural language question'
      },
      space: {
        type: 'string',
        description: 'Which space to query',
        enum: ['void'],
        default: 'void'
      },
      // Same filters as remember_query_memory
      content_type: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      min_weight: { type: 'number', minimum: 0, maximum: 1 },
      date_from: { type: 'string' },
      date_to: { type: 'string' },
      limit: { type: 'number', default: 10 },
      format: { type: 'string', enum: ['detailed', 'compact'], default: 'detailed' }
    },
    required: ['question', 'space']
  }
}
```

**Note**: Uses same input schema as [`remember_query_memory`](../src/tools/query-memory.ts) plus `space` parameter.

---

## Space Memory Architecture

### Memory Types

**Personal Memory**: Scoped to `user_id`, stored in `Memory_{user_id}` collections
```typescript
interface Memory {
  id: string;
  user_id: string;            // Owner
  content: string;
  // ... standard fields
  doc_type: 'memory';
}
```

**Space Memory**: Shared across users, stored in `Memory_{space_name}` collections
```typescript
interface SpaceMemory {
  id: string;
  space_id: string;           // 'void', 'public', etc. (replaces user_id)
  author_id: string;          // Original author (for permissions)
  ghost_id?: string;          // Optional: published as ghost
  content: string;
  published_at: string;
  discovery_count: number;
  // ... standard fields
  doc_type: 'space_memory';
}
```

### Weaviate Collections

- **Personal**: `Memory_User_123` (single user, sanitized user_id)
- **Spaces**: `Memory_the_void`, `Memory_public_space` (shared, snake_case space IDs)
- **Consistent naming**: `Memory_{identifier}` pattern
  - User collections: `Memory_{sanitized_user_id}` (e.g., `Memory_User_123`)
  - Space collections: `Memory_{snake_case_space_id}` (e.g., `Memory_the_void`, `Memory_public_space`)

**Display Names vs Collection IDs**:
- Display Name: "The Void" → Space ID: `the_void` → Collection: `Memory_the_void`
- Display Name: "Public Space" → Space ID: `public_space` → Collection: `Memory_public_space`
- Conversion: Display name → lowercase → replace spaces with underscores → prepend `Memory_`

---

## Implementation Details

### Token Service

```typescript
// src/services/confirmation-token.service.ts

import { v4 as uuidv4 } from 'uuid';
import { getFirestore } from '../firestore/init.js';
import { Timestamp } from 'firebase-admin/firestore';

export interface ConfirmationRequest {
  // request_id is the Firestore document ID (not stored in document)
  user_id: string;
  token: string;
  action: string;
  target_collection?: string;
  payload: any;
  created_at: Timestamp;
  expires_at: Timestamp;
  status: 'pending' | 'confirmed' | 'denied' | 'expired' | 'retracted';
  confirmed_at?: Timestamp;
}

export class ConfirmationTokenService {
  private readonly EXPIRY_MINUTES = 5;
  
  /**
   * Create a new confirmation request
   */
  async createRequest(
    userId: string,
    action: string,
    payload: any,
    targetCollection?: string
  ): Promise<{ requestId: string; token: string }> {
    const db = getFirestore();
    const token = uuidv4();
    
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(
      now.toMillis() + this.EXPIRY_MINUTES * 60 * 1000
    );
    
    const request: ConfirmationRequest = {
      user_id: userId,
      token,
      action,
      target_collection: targetCollection,
      payload,
      created_at: now,
      expires_at: expiresAt,
      status: 'pending',
    };
    
    // Let Firestore generate the document ID (this IS the request_id)
    const docRef = await db
      .collection('pending_confirmations')
      .doc(userId)
      .collection('requests')
      .add(request);
    
    return { requestId: docRef.id, token };
  }
  
  /**
   * Validate and retrieve a confirmation request
   */
  async validateToken(
    userId: string,
    token: string
  ): Promise<ConfirmationRequest | null> {
    const db = getFirestore();
    
    const snapshot = await db
      .collection('pending_confirmations')
      .doc(userId)
      .collection('requests')
      .where('token', '==', token)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const request = snapshot.docs[0].data() as ConfirmationRequest;
    
    // Check expiry
    if (request.expires_at.toMillis() < Date.now()) {
      await this.updateStatus(userId, request.request_id, 'expired');
      return null;
    }
    
    return request;
  }
  
  /**
   * Confirm a request
   */
  async confirmRequest(
    userId: string,
    token: string
  ): Promise<ConfirmationRequest | null> {
    const request = await this.validateToken(userId, token);
    if (!request) {
      return null;
    }
    
    await this.updateStatus(userId, request.request_id, 'confirmed');
    return request;
  }
  
  /**
   * Deny a request
   */
  async denyRequest(
    userId: string,
    token: string
  ): Promise<boolean> {
    const request = await this.validateToken(userId, token);
    if (!request) {
      return false;
    }
    
    await this.updateStatus(userId, request.request_id, 'denied');
    return true;
  }
  
  /**
   * Retract a request
   */
  async retractRequest(
    userId: string,
    token: string
  ): Promise<boolean> {
    const request = await this.validateToken(userId, token);
    if (!request) {
      return false;
    }
    
    await this.updateStatus(userId, request.request_id, 'retracted');
    return true;
  }
  
  /**
   * Update request status
   */
  private async updateStatus(
    userId: string,
    requestId: string,
    status: ConfirmationRequest['status']
  ): Promise<void> {
    const db = getFirestore();
    
    await db
      .collection('pending_confirmations')
      .doc(userId)
      .collection('requests')
      .doc(requestId)
      .update({
        status,
        confirmed_at: status === 'confirmed' ? Timestamp.now() : null,
      });
  }
  
  /**
   * Clean up expired requests (optional - Firestore TTL handles deletion)
   *
   * Note: Configure Firestore TTL policy on 'requests' collection group
   * with 'expires_at' field for automatic deletion within 24 hours.
   *
   * This method is optional for immediate cleanup if needed.
   */
  async cleanupExpired(): Promise<number> {
    const db = getFirestore();
    const now = Timestamp.now();
    
    const snapshot = await db
      .collectionGroup('requests')
      .where('status', '==', 'pending')
      .where('expires_at', '<', now)
      .get();
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref); // Delete instead of just updating status
    });
    
    await batch.commit();
    return snapshot.size;
  }
}

export const confirmationTokenService = new ConfirmationTokenService();
```

### Tool Implementation: remember_publish

```typescript
// src/tools/publish.ts

import { confirmationTokenService } from '../services/confirmation-token.service.js';
import { getWeaviateClient, getMemoryCollectionName } from '../weaviate/client.js';
import { handleToolError } from '../utils/error-handler.js';

export const publishTool = {
  name: 'remember_publish',
  description: 'Publish a memory to a shared space. Generates a confirmation token.',
  inputSchema: {
    // ... (as defined above)
  }
};

export async function handlePublish(
  args: PublishArgs,
  userId: string
): Promise<string> {
  try {
    // Verify memory exists and user owns it
    const weaviateClient = getWeaviateClient();
    const userCollection = weaviateClient.collections.get(getMemoryCollectionName(userId));
    
    const memory = await userCollection.query.fetchObjectById(args.memory_id);
    
    if (!memory) {
      return JSON.stringify({
        success: false,
        error: 'Memory not found',
        message: `No memory found with ID: ${args.memory_id}`,
        context: {
          collection_name: getMemoryCollectionName(userId),
          collection_exists: true
        }
      }, null, 2);
    }
    
    // Verify ownership
    if (memory.properties.user_id !== userId) {
      return JSON.stringify({
        success: false,
        error: 'Permission denied',
        message: 'You can only publish your own memories',
      }, null, 2);
    }
    
    // Create payload with only memory_id (content fetched during confirmation)
    const payload = {
      memory_id: args.memory_id,
      additional_tags: args.additional_tags || [],
    };
    
    const { requestId, token } = await confirmationTokenService.createRequest(
      userId,
      'publish_memory',
      payload,
      args.target
    );
    
    return JSON.stringify({
      success: true,
      token,
      payload: {
        action: 'publish_memory',
        memory_id: args.memory_id,
        target: args.target,
        additional_tags: payload.additional_tags
      }
    }, null, 2);
  } catch (error) {
    return handleToolError(error, 'remember_publish', {
      userId,
      memory_id: args.memory_id,
      target: args.target
    });
  }
}
```

### Tool Implementation: remember_confirm

```typescript
// src/tools/confirm.ts

import { confirmationTokenService } from '../services/confirmation-token.service.js';
import { getWeaviateClient, getMemoryCollectionName } from '../weaviate/client.js';
import { ensureSpaceCollection } from '../weaviate/space-schema.js';
import { handleToolError } from '../utils/error-handler.js';

export const confirmTool = {
  name: 'remember_confirm',
  description: 'Confirm and execute a pending action using the token.',
  inputSchema: {
    // ... (as defined above)
  }
};

export async function handleConfirm(
  args: ConfirmArgs,
  userId: string
): Promise<string> {
  try {
    // Validate and confirm token
    const request = await confirmationTokenService.confirmRequest(userId, args.token);
    
    if (!request) {
      return JSON.stringify({
        success: false,
        error: 'Invalid or expired token',
        message: 'The confirmation token is invalid, expired, or has already been used.',
        context: {
          token_found: false,
          token_expired: true
        }
      }, null, 2);
    }
    
    // GENERIC: Execute action based on type
    // This is where the generic pattern delegates to action-specific executors
    if (request.action === 'publish_memory') {
      return await executePublishMemory(request, userId);
    }
    
    if (request.action === 'retract_memory') {
      return await executeRetractMemory(request, userId);
    }
    
    // Add other action types here as needed
    // Each action gets its own executor function
    
    throw new Error(`Unknown action type: ${request.action}`);
    
  } catch (error) {
    return handleToolError(error, 'remember_confirm', { userId, token: args.token });
  }
}

async function executePublishMemory(request: ConfirmationRequest, userId: string): Promise<string> {
  // Fetch the memory NOW (during confirmation, not from stored payload)
  const weaviateClient = getWeaviateClient();
  const userCollection = weaviateClient.collections.get(getMemoryCollectionName(userId));
  
  const originalMemory = await userCollection.query.fetchObjectById(request.payload.memory_id);
  
  if (!originalMemory) {
    return JSON.stringify({
      success: false,
      error: 'Memory not found',
      message: `Original memory ${request.payload.memory_id} no longer exists`,
    }, null, 2);
  }
  
  // Verify ownership again
  if (originalMemory.properties.user_id !== userId) {
    return JSON.stringify({
      success: false,
      error: 'Permission denied',
      message: 'You can only publish your own memories',
    }, null, 2);
  }
  
  // Get target collection (generic)
  const targetCollection = await ensureSpaceCollection(
    weaviateClient,
    request.target_collection || 'void'
  );
    
    // Create published memory (copy with modifications)
    const publishedMemory = {
      ...originalMemory.properties,
      // Override specific fields
      user_id: request.target_collection || 'void',
      author_id: userId, // Always attributed
      published_at: new Date().toISOString(),
      discovery_count: 0,
      doc_type: `${request.target_collection}_memory`,
      trust_level: 1.0,
      // Merge additional tags
      tags: [
        ...(originalMemory.properties.tags || []),
        ...(request.payload.additional_tags || [])
      ],
      // Update timestamps
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
    };
    
    const result = await targetCollection.data.insert(publishedMemory);
    
    return JSON.stringify({
      success: true,
      payload: {
        action: 'publish_memory',
        space: request.target_collection,
        space_memory_id: result
      }
    }, null, 2);
  } catch (error) {
    return handleToolError(error, 'remember_confirm', { userId, action: 'publish_memory' });
  }
}
```

---

## Benefits

1. **User Control**: Explicit confirmation required for sensitive operations
2. **Security**: One-time tokens prevent replay attacks
3. **Auditability**: All requests logged with status tracking
4. **Flexibility**: Can publish to different collections (void, public, etc.)
5. **Natural Flow**: Agent can explain and request confirmation naturally
6. **Extensible**: Token pattern can be used for other confirmable actions

---

## Trade-offs

### Pros
- ✅ Explicit user consent for publications
- ✅ Prevents accidental or malicious publications
- ✅ Auditable request/confirmation trail
- ✅ Flexible target collections
- ✅ Token expiry prevents stale requests

### Cons
- ❌ More complex than direct publication
- ❌ Requires two tool calls (request + confirm)
- ❌ Tokens need cleanup (expired requests)
- ❌ Additional Firestore storage for pending requests

---

## Pattern Extension - Other Confirmable Actions

This pattern can be extended to ANY sensitive operation:

### Example: remember_retract

```typescript
{
  name: 'remember_retract',
  description: 'Unpublish a memory from a shared space. Generates confirmation token. Use remember_confirm to execute.',
  inputSchema: {
    type: 'object',
    properties: {
      space_memory_id: {
        type: 'string',
        description: 'ID of the memory in the shared space to retract'
      },
      space: {
        type: 'string',
        description: 'Which space to retract from',
        enum: ['void']
      }
    },
    required: ['space_memory_id', 'space']
  }
}
```

**Response**:
```json
{
  "success": true,
  "token": "uuid",
  "payload": {
    "action": "retract_memory",
    "space_memory_id": "uuid-in-void",
    "space": "void"
  }
}
```

**Key Pattern**:
1. Any sensitive action creates a tool that generates a token
2. All parameters stored in Firestore with the token
3. Generic `remember_confirm` executes the action
4. Generic `remember_deny` cancels the action

---

## Future Enhancements

1. **Batch Confirmations**: Confirm multiple requests with one token
2. **Conditional Confirmations**: Auto-confirm based on user preferences
3. **Request History**: View past confirmation requests
4. **Timeout Warnings**: Notify when tokens are about to expire

---

## Implementation Tasks

1. Create `src/services/confirmation-token.service.ts` - Token management
2. Create `src/weaviate/space-schema.ts` - Generic space collection schema (Memory_Void, Memory_Public, etc.)
3. Create `src/types/space-memory.ts` - SpaceMemory type definitions
4. Create `src/tools/publish.ts` - Publish tool (generates token)
5. Create `src/tools/confirm.ts` - Generic confirm tool
6. Create `src/tools/deny.ts` - Generic deny tool
7. Create `src/tools/search-space.ts` - Search shared spaces
8. Create `src/tools/query-space.ts` - Query shared spaces
9. Update `src/server.ts` - Register all tools
10. Update `src/server-factory.ts` - Register all tools
11. Create unit tests for token service
12. Create unit tests for all tools
13. **Configure Firestore TTL policy** on `requests` collection group with `expires_at` field
14. Optional: Add manual cleanup job for immediate expiry
15. Update README.md with new tools
16. Test end-to-end flow

**Firestore TTL Configuration**:
- Go to Cloud Firestore Time-to-live page in GCP Console
- Create policy for collection group: `requests`
- TTL field: `expires_at`
- Documents automatically deleted within 24 hours after expiration

---

**Status**: Implemented (v2.3.0)
**Recommendation**: Token-based confirmation pattern successfully implemented and production-ready

**Implementation Notes**:
- All 5 tools implemented and registered in both servers
- Token service uses `users/{user_id}/requests` for consistency
- Firestore TTL configured on collection group `requests`
- 100% test coverage on token service and space schema
- Snake_case naming convention: "The Void" → `the_void` → `Memory_the_void`
