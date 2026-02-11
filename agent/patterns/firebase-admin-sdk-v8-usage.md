# Firebase Admin SDK v8 Usage Pattern

**Library**: @prmichaelsen/firebase-admin-sdk-v8  
**Version**: 2.2.0+  
**Created**: 2026-02-11  
**Status**: Reference Pattern

---

## Overview

The `@prmichaelsen/firebase-admin-sdk-v8` library provides Firebase Admin SDK functionality for Cloudflare Workers and edge runtimes using REST APIs instead of Node.js Admin SDK. This makes it compatible with environments that don't support Node.js.

**Key Features**:
- ✅ Zero dependencies (uses Web APIs: crypto.subtle, fetch)
- ✅ JWT token generation for service account authentication
- ✅ ID token verification (supports Firebase v9 and v10 formats)
- ✅ Firestore REST API with full CRUD operations
- ✅ Advanced queries (where, orderBy, limit, pagination)
- ✅ Field value operations (increment, arrayUnion, serverTimestamp, delete)
- ✅ Batch operations (atomic multi-document writes)
- ✅ TypeScript support with full type definitions

**Limitations**:
- ❌ No realtime listeners (REST API is stateless)
- ❌ No custom token creation yet
- ❌ No user management yet
- ❌ No transactions yet

---

## Installation

```bash
npm install @prmichaelsen/firebase-admin-sdk-v8
```

---

## Initialization

### Option 1: Explicit Initialization (Recommended for remember-mcp)

```typescript
import { initializeApp } from '@prmichaelsen/firebase-admin-sdk-v8';

// Initialize once at startup
initializeApp({
  serviceAccount: JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY!),
  projectId: process.env.FIREBASE_PROJECT_ID
});
```

### Option 2: Auto-Detection from process.env

If you don't call `initializeApp()`, the SDK automatically uses:
- `process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY` (JSON string)
- `process.env.FIREBASE_PROJECT_ID`

### Environment Variables

```env
FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
FIREBASE_PROJECT_ID=your-project-id
```

---

## Authentication

### Verify ID Tokens

```typescript
import { verifyIdToken, getUserFromToken } from '@prmichaelsen/firebase-admin-sdk-v8';

// Verify token and get decoded claims
const decodedToken = await verifyIdToken(idToken);
console.log('User ID:', decodedToken.uid);
console.log('Email:', decodedToken.email);

// Or get user object directly
const user = await getUserFromToken(idToken);
console.log('User:', user.email, user.displayName);
```

**Token Structure**:
```typescript
interface DecodedIdToken {
  uid: string;           // User ID
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  iss: string;          // Issuer
  aud: string;          // Audience (project ID)
  auth_time: number;    // Authentication time
  iat: number;          // Issued at
  exp: number;          // Expires at
  sub: string;          // Subject (same as uid)
}
```

---

## Firestore Operations

### Basic CRUD

#### Get Document

```typescript
import { getDocument } from '@prmichaelsen/firebase-admin-sdk-v8';

// Get a document
const user = await getDocument('users', 'user123');

// Get from subcollection
const message = await getDocument('users/user123/messages', 'msg456');

// Returns null if document doesn't exist
if (!user) {
  console.log('User not found');
}
```

#### Set Document (Create or Overwrite)

```typescript
import { setDocument } from '@prmichaelsen/firebase-admin-sdk-v8';

// Create or overwrite document
await setDocument('users', 'user123', {
  name: 'John Doe',
  email: 'john@example.com',
  createdAt: new Date().toISOString()
});

// Merge with existing data (don't overwrite)
await setDocument('users', 'user123', {
  lastLogin: new Date().toISOString()
}, { merge: true });
```

#### Add Document (Auto-Generated ID)

```typescript
import { addDocument } from '@prmichaelsen/firebase-admin-sdk-v8';

// Add document with auto-generated ID
const docRef = await addDocument('users/user123/messages', {
  content: 'Hello world',
  timestamp: new Date().toISOString()
});

console.log('Created document with ID:', docRef.id);

// Add with custom ID
const docRef2 = await addDocument('users/user123/messages', {
  content: 'Custom ID message'
}, 'custom-message-id');
```

#### Update Document

```typescript
import { updateDocument } from '@prmichaelsen/firebase-admin-sdk-v8';

// Update specific fields
await updateDocument('users', 'user123', {
  name: 'Jane Doe',
  updatedAt: new Date().toISOString()
});

// Note: updateDocument fails if document doesn't exist
// Use setDocument with merge: true if you want upsert behavior
```

#### Delete Document

```typescript
import { deleteDocument } from '@prmichaelsen/firebase-admin-sdk-v8';

// Delete a document
await deleteDocument('users', 'user123');

// Soft delete (recommended)
await setDocument('users', 'user123', {
  deleted: true,
  deletedAt: new Date().toISOString()
}, { merge: true });
```

---

## Field Value Operations

### Special Field Values

```typescript
import { FieldValue, setDocument, updateDocument } from '@prmichaelsen/firebase-admin-sdk-v8';

// Server timestamp
await setDocument('users', 'user123', {
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp()
});

// Increment/Decrement
await updateDocument('users', 'user123', {
  loginCount: FieldValue.increment(1),
  credits: FieldValue.increment(-10)  // Decrement
});

// Array operations
await updateDocument('users', 'user123', {
  tags: FieldValue.arrayUnion('premium', 'verified'),
  blockedUsers: FieldValue.arrayRemove('user456')
});

// Delete field
await updateDocument('users', 'user123', {
  temporaryField: FieldValue.delete()
});
```

---

## Queries

### Basic Query

```typescript
import { queryDocuments } from '@prmichaelsen/firebase-admin-sdk-v8';
import type { QueryOptions } from '@prmichaelsen/firebase-admin-sdk-v8';

const options: QueryOptions = {
  where: [
    { field: 'active', op: '==', value: true }
  ],
  orderBy: [{ field: 'createdAt', direction: 'DESCENDING' }],
  limit: 10
};

const results = await queryDocuments('users', options);

// Results format
results.forEach(doc => {
  console.log('ID:', doc.id);
  console.log('Data:', doc.data);
});
```

### Query Operators

```typescript
// Comparison operators
{ field: 'age', op: '==', value: 25 }
{ field: 'age', op: '!=', value: 25 }
{ field: 'age', op: '<', value: 25 }
{ field: 'age', op: '<=', value: 25 }
{ field: 'age', op: '>', value: 25 }
{ field: 'age', op: '>=', value: 25 }

// Array operators
{ field: 'tags', op: 'array-contains', value: 'premium' }
{ field: 'tags', op: 'array-contains-any', value: ['premium', 'verified'] }
{ field: 'roles', op: 'in', value: ['admin', 'moderator'] }
{ field: 'status', op: 'not-in', value: ['banned', 'suspended'] }
```

### Complex Queries

```typescript
// Multiple conditions (AND)
const activeAdults = await queryDocuments('users', {
  where: [
    { field: 'active', op: '==', value: true },
    { field: 'age', op: '>=', value: 18 },
    { field: 'verified', op: '==', value: true }
  ],
  orderBy: [{ field: 'createdAt', direction: 'DESCENDING' }],
  limit: 50
});

// Pagination with cursor
const firstPage = await queryDocuments('users', {
  orderBy: [{ field: 'createdAt', direction: 'DESCENDING' }],
  limit: 10
});

// Get next page
const secondPage = await queryDocuments('users', {
  orderBy: [{ field: 'createdAt', direction: 'DESCENDING' }],
  limit: 10,
  startAfter: [firstPage[firstPage.length - 1].data.createdAt]
});
```

---

## Batch Operations

### Atomic Writes

```typescript
import { batchWrite } from '@prmichaelsen/firebase-admin-sdk-v8';

await batchWrite([
  {
    type: 'set',
    collection: 'users',
    documentId: 'user123',
    data: { name: 'John' }
  },
  {
    type: 'update',
    collection: 'users',
    documentId: 'user456',
    data: { loginCount: FieldValue.increment(1) }
  },
  {
    type: 'delete',
    collection: 'users',
    documentId: 'user789'
  }
]);

// All operations succeed or all fail (atomic)
```

---

## Collection Path Patterns

### User-Scoped Collections

Following agentbase.me pattern:

```typescript
// Helper functions for collection paths
export function getUserCollection(userId: string): string {
  return `users/${userId}`;
}

export function getUserSubcollection(userId: string, subcollection: string): string {
  return `users/${userId}/${subcollection}`;
}

// Usage
const conversationsPath = getUserSubcollection(userId, 'conversations');
const messagesPath = `users/${userId}/conversations/${conversationId}/messages`;
```

### remember-mcp Collection Patterns

Based on design documents:

```typescript
// User preferences
export function getUserPreferencesPath(userId: string): string {
  return `user_preferences/${userId}`;
}

// User permissions (who can access user's memories)
export function getUserPermissionsPath(userId: string): string {
  return `user_permissions/${userId}/allowed_accessors`;
}

// Trust history
export function getTrustHistoryPath(userId: string): string {
  return `trust_history/${userId}/history`;
}

// Templates
export function getDefaultTemplatesPath(): string {
  return 'templates/default';
}

export function getUserTemplatesPath(userId: string): string {
  return `users/${userId}/templates`;
}
```

---

## Service Class Pattern

### Recommended Pattern (from agentbase.me)

```typescript
import { getDocument, setDocument, queryDocuments, addDocument } from '@prmichaelsen/firebase-admin-sdk-v8';
import type { QueryOptions } from '@prmichaelsen/firebase-admin-sdk-v8';

export class UserPreferencesService {
  /**
   * Get user preferences
   */
  static async getPreferences(userId: string): Promise<UserPreferences | null> {
    const doc = await getDocument('user_preferences', userId);
    
    if (!doc) {
      // Return defaults if not found
      return DEFAULT_PREFERENCES;
    }
    
    return doc as UserPreferences;
  }

  /**
   * Update user preferences
   */
  static async updatePreferences(
    userId: string,
    updates: Partial<UserPreferences>
  ): Promise<void> {
    await setDocument('user_preferences', userId, {
      ...updates,
      updated_at: new Date().toISOString()
    }, { merge: true });
  }

  /**
   * Create user preferences with defaults
   */
  static async createPreferences(userId: string): Promise<UserPreferences> {
    const preferences: UserPreferences = {
      ...DEFAULT_PREFERENCES,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await setDocument('user_preferences', userId, preferences);
    return preferences;
  }
}
```

---

## Multi-Tenant Patterns

### Per-User Collections

```typescript
// Pattern 1: User as document ID
// Collection: user_preferences/{userId}
await setDocument('user_preferences', userId, preferences);

// Pattern 2: User as subcollection
// Collection: users/{userId}/preferences
await setDocument(`users/${userId}/preferences`, 'settings', preferences);

// Pattern 3: User-scoped subcollections
// Collection: users/{userId}/conversations/{conversationId}
const conversationPath = `users/${userId}/conversations`;
await addDocument(conversationPath, conversation);
```

### Query User-Scoped Data

```typescript
// Get all conversations for a user
const conversations = await queryDocuments(`users/${userId}/conversations`, {
  orderBy: [{ field: 'updated_at', direction: 'DESCENDING' }],
  limit: 50
});

// Get user's memories with filters
const memories = await queryDocuments(`users/${userId}/memories`, {
  where: [
    { field: 'type', op: '==', value: 'note' },
    { field: 'weight', op: '>=', value: 0.5 }
  ],
  orderBy: [{ field: 'created_at', direction: 'DESCENDING' }],
  limit: 20
});
```

---

## Common Patterns from agentbase.me

### 1. Service Class Pattern

```typescript
export class ConversationDatabaseService {
  static async createConversation(userId: string, title: string): Promise<Conversation> {
    const now = new Date().toISOString();
    
    const conversation = {
      title,
      created_at: now,
      updated_at: now
    };

    const conversationsPath = getUserConversations(userId);
    const docRef = await addDocument(conversationsPath, conversation);
    
    return {
      id: docRef.id,
      user_id: userId,
      ...conversation
    };
  }

  static async getConversation(userId: string, conversationId: string): Promise<Conversation | null> {
    const conversationsPath = getUserConversations(userId);
    return await getDocument(conversationsPath, conversationId);
  }

  static async getUserConversations(userId: string, limit = 50): Promise<Conversation[]> {
    const conversationsPath = getUserConversations(userId);
    const results = await queryDocuments(conversationsPath, {
      orderBy: [{ field: 'updated_at', direction: 'DESCENDING' }],
      limit
    });
    
    return results.map(doc => ({ id: doc.id, ...doc.data }));
  }
}
```

### 2. Collection Path Helpers

```typescript
// From agentbase.me/src/constant/collections.ts
const BASE = process.env.NODE_ENV === 'development' ? 'e0.agentbase' : 'agentbase';

export function getUserConversations(userId: string): string {
  return `${BASE}.users/${userId}/conversations`;
}

export function getUserConversationMessages(userId: string, conversationId: string): string {
  return `${BASE}.users/${userId}/conversations/${conversationId}/messages`;
}

export function getUserCredentialsCollection(userId: string): string {
  return `${BASE}.users/${userId}/credentials`;
}
```

### 3. Soft Delete Pattern

```typescript
// Instead of deleting, mark as deleted
await setDocument('users', userId, {
  deleted: true,
  deleted_at: new Date().toISOString()
}, { merge: true });

// Query non-deleted documents
const activeUsers = await queryDocuments('users', {
  where: [
    { field: 'deleted', op: '!=', value: true }
  ]
});
```

### 4. Timestamp Pattern

```typescript
// Use ISO strings for timestamps (not Firestore Timestamp objects)
const now = new Date().toISOString();

await setDocument('users', userId, {
  created_at: now,
  updated_at: now
});

// Or use FieldValue.serverTimestamp() for server-side timestamp
await setDocument('users', userId, {
  created_at: FieldValue.serverTimestamp(),
  updated_at: FieldValue.serverTimestamp()
});
```

---

## remember-mcp Specific Patterns

### User Preferences

```typescript
import { getDocument, setDocument } from '@prmichaelsen/firebase-admin-sdk-v8';

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const doc = await getDocument('user_preferences', userId);
  
  if (!doc) {
    // Create with defaults
    const defaults = DEFAULT_PREFERENCES;
    await setDocument('user_preferences', userId, defaults);
    return defaults;
  }
  
  return doc as UserPreferences;
}

export async function updateUserPreferences(
  userId: string,
  updates: Partial<UserPreferences>
): Promise<void> {
  await setDocument('user_preferences', userId, {
    ...updates,
    updated_at: new Date().toISOString()
  }, { merge: true });
}
```

### User Permissions (Trust System)

```typescript
import { getDocument, setDocument, queryDocuments } from '@prmichaelsen/firebase-admin-sdk-v8';

export async function grantPermission(
  ownerUserId: string,
  accessorUserId: string,
  trustLevel: number,
  options: PermissionOptions
): Promise<void> {
  const permission: UserPermission = {
    owner_user_id: ownerUserId,
    accessor_user_id: accessorUserId,
    can_access: true,
    trust_level: trustLevel,
    granted_at: new Date().toISOString(),
    ...options
  };

  const permissionsPath = `user_permissions/${ownerUserId}/allowed_accessors`;
  await setDocument(permissionsPath, accessorUserId, permission);
}

export async function checkPermission(
  ownerUserId: string,
  accessorUserId: string
): Promise<UserPermission | null> {
  const permissionsPath = `user_permissions/${ownerUserId}/allowed_accessors`;
  return await getDocument(permissionsPath, accessorUserId);
}

export async function listAccessors(ownerUserId: string): Promise<UserPermission[]> {
  const permissionsPath = `user_permissions/${ownerUserId}/allowed_accessors`;
  const results = await queryDocuments(permissionsPath, {
    where: [{ field: 'revoked', op: '!=', value: true }],
    orderBy: [{ field: 'trust_level', direction: 'DESCENDING' }]
  });
  
  return results.map(doc => ({ id: doc.id, ...doc.data }));
}
```

### Templates

```typescript
export async function getDefaultTemplates(): Promise<Template[]> {
  const results = await queryDocuments('templates/default', {
    where: [{ field: 'is_default', op: '==', value: true }],
    orderBy: [{ field: 'usage_count', direction: 'DESCENDING' }]
  });
  
  return results.map(doc => ({ id: doc.id, ...doc.data }));
}

export async function getUserTemplates(userId: string): Promise<Template[]> {
  const templatesPath = `users/${userId}/templates`;
  const results = await queryDocuments(templatesPath, {
    orderBy: [{ field: 'created_at', direction: 'DESCENDING' }]
  });
  
  return results.map(doc => ({ id: doc.id, ...doc.data }));
}
```

---

## Best Practices

### 1. Use Service Classes

Organize Firestore operations into service classes:
- `UserPreferencesService`
- `PermissionsService`
- `TemplateService`
- `TrustHistoryService`

### 2. Use Collection Path Helpers

Create helper functions for collection paths:
```typescript
export function getUserPreferencesPath(userId: string): string {
  return `user_preferences/${userId}`;
}
```

### 3. Use Merge for Updates

Prefer `setDocument` with `merge: true` over `updateDocument`:
```typescript
// ✅ Good: Creates if doesn't exist
await setDocument('users', userId, { name: 'John' }, { merge: true });

// ❌ Risky: Fails if document doesn't exist
await updateDocument('users', userId, { name: 'John' });
```

### 4. Use ISO Timestamps

Use ISO string timestamps for consistency:
```typescript
const now = new Date().toISOString();
await setDocument('users', userId, {
  created_at: now,
  updated_at: now
});
```

### 5. Handle Null Returns

Always check for null when getting documents:
```typescript
const doc = await getDocument('users', userId);
if (!doc) {
  // Handle missing document
  return DEFAULT_VALUE;
}
```

### 6. Use Soft Deletes

Mark documents as deleted instead of deleting:
```typescript
await setDocument('users', userId, {
  deleted: true,
  deleted_at: new Date().toISOString()
}, { merge: true });
```

---

## Error Handling

```typescript
try {
  const doc = await getDocument('users', userId);
} catch (error) {
  if (error instanceof Error) {
    console.error('Firestore error:', error.message);
  }
  throw new Error('Failed to get user document');
}
```

---

## Testing

### Unit Tests (Mock)

```typescript
import { jest } from '@jest/globals';

// Mock the firebase-admin-sdk-v8 module
jest.mock('@prmichaelsen/firebase-admin-sdk-v8', () => ({
  getDocument: jest.fn(),
  setDocument: jest.fn(),
  queryDocuments: jest.fn()
}));

// In tests
import { getDocument } from '@prmichaelsen/firebase-admin-sdk-v8';
(getDocument as jest.Mock).mockResolvedValue({ name: 'John' });
```

### Integration Tests (Real Firestore)

```typescript
import { initializeApp, getDocument, setDocument } from '@prmichaelsen/firebase-admin-sdk-v8';

beforeAll(() => {
  initializeApp({
    serviceAccount: JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY!),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
});

it('should create and retrieve document', async () => {
  const testId = `test_${Date.now()}`;
  
  await setDocument('test_collection', testId, { value: 'test' });
  const doc = await getDocument('test_collection', testId);
  
  expect(doc).toEqual({ value: 'test' });
  
  // Cleanup
  await deleteDocument('test_collection', testId);
});
```

---

## Migration from firebase-admin

### Old (firebase-admin)

```typescript
import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Get document
const doc = await db.collection('users').doc('user123').get();
const data = doc.data();

// Set document
await db.collection('users').doc('user123').set({ name: 'John' });

// Query
const snapshot = await db.collection('users')
  .where('active', '==', true)
  .orderBy('createdAt', 'desc')
  .limit(10)
  .get();

const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

### New (firebase-admin-sdk-v8)

```typescript
import { initializeApp, getDocument, setDocument, queryDocuments } from '@prmichaelsen/firebase-admin-sdk-v8';

initializeApp({
  serviceAccount: JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY!),
  projectId: process.env.FIREBASE_PROJECT_ID
});

// Get document
const data = await getDocument('users', 'user123');

// Set document
await setDocument('users', 'user123', { name: 'John' });

// Query
const users = await queryDocuments('users', {
  where: [{ field: 'active', op: '==', value: true }],
  orderBy: [{ field: 'createdAt', direction: 'DESCENDING' }],
  limit: 10
});
```

---

## Key Differences from firebase-admin

### Advantages
- ✅ Works in Cloudflare Workers and edge runtimes
- ✅ Zero dependencies (uses Web APIs)
- ✅ Simpler API (flat functions vs nested objects)
- ✅ REST-based (no gRPC dependencies)

### Limitations
- ❌ No realtime listeners (use polling or client SDK)
- ❌ No transactions yet
- ❌ No custom token creation yet
- ❌ Slightly higher latency (REST vs gRPC)

---

## remember-mcp Integration

### Update package.json

```json
{
  "dependencies": {
    "@prmichaelsen/firebase-admin-sdk-v8": "^2.2.0"
  }
}
```

### Remove firebase-admin

Since we're using firebase-admin-sdk-v8, we should remove the standard firebase-admin:

```bash
npm uninstall firebase-admin
npm install @prmichaelsen/firebase-admin-sdk-v8
```

### Update config.ts

```typescript
export const config = {
  firebase: {
    serviceAccount: process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
  }
};
```

### Update .env.example

```env
# Firebase Configuration (using firebase-admin-sdk-v8)
FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
FIREBASE_PROJECT_ID=remember-mcp-dev
```

---

## Reference Examples

### From agentbase.me

- **Auth**: [`src/lib/auth/session.ts`](/home/prmichaelsen/agentbase.me/src/lib/auth/session.ts)
- **Conversations**: [`src/services/conversation-database.service.ts`](/home/prmichaelsen/agentbase.me/src/services/conversation-database.service.ts)
- **Credentials**: [`src/services/credentials-database.service.ts`](/home/prmichaelsen/agentbase.me/src/services/credentials-database.service.ts)
- **Collection Paths**: [`src/constant/collections.ts`](/home/prmichaelsen/agentbase.me/src/constant/collections.ts)

---

## Summary

The `@prmichaelsen/firebase-admin-sdk-v8` library provides a REST-based Firebase Admin SDK that:

1. **Works in edge runtimes** (Cloudflare Workers, Vercel Edge)
2. **Simple API** with flat functions (getDocument, setDocument, etc.)
3. **Zero dependencies** (uses Web APIs)
4. **Full Firestore CRUD** with advanced queries
5. **Field value operations** (increment, arrayUnion, serverTimestamp)
6. **Batch operations** for atomic writes

**For remember-mcp**, we should:
- ✅ Use this library instead of firebase-admin
- ✅ Follow the service class pattern from agentbase.me
- ✅ Use collection path helpers for multi-tenancy
- ✅ Use ISO timestamps and soft deletes
- ✅ Handle null returns and errors properly

---

**Status**: Reference Pattern  
**Library Version**: 2.2.0+  
**Recommended For**: remember-mcp Firestore integration
