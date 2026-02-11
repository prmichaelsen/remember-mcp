# Task 4: Set Up Firestore Client

**Milestone**: M1 - Project Foundation  
**Estimated Time**: 2 hours  
**Dependencies**: Task 2  
**Status**: Not Started

---

## Objective

Create Firestore client wrapper with Firebase Admin SDK initialization and helper functions.

---

## Steps

### 1. Create Firestore Client Wrapper

**src/firestore/client.ts**:
```typescript
import admin from 'firebase-admin';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { config } from '../config.js';
import { readFileSync } from 'fs';

let firestore: Firestore | null = null;

/**
 * Initialize Firebase Admin and Firestore
 */
export async function initFirestore(): Promise<Firestore> {
  if (firestore) {
    return firestore;
  }

  try {
    // Read service account key
    const serviceAccount = JSON.parse(
      readFileSync(config.firebase.credentialsPath, 'utf8')
    );

    // Initialize Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: config.firebase.projectId,
    });

    firestore = admin.firestore();

    // Configure Firestore settings
    firestore.settings({
      ignoreUndefinedProperties: true,
    });

    console.log('[Firestore] Client initialized');
    return firestore;
  } catch (error) {
    console.error('[Firestore] Initialization failed:', error);
    throw error;
  }
}

/**
 * Get Firestore instance
 */
export function getFirestore(): Firestore {
  if (!firestore) {
    throw new Error('Firestore not initialized. Call initFirestore() first.');
  }
  return firestore;
}

/**
 * Test Firestore connection
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const db = getFirestore();
    // Try to read a document (will fail gracefully if doesn't exist)
    await db.collection('_health_check').doc('test').get();
    console.log('[Firestore] Connection successful');
    return true;
  } catch (error) {
    console.error('[Firestore] Connection failed:', error);
    return false;
  }
}

/**
 * Get document from Firestore
 */
export async function getDocument<T = any>(
  collection: string,
  docId: string
): Promise<T | null> {
  try {
    const db = getFirestore();
    const doc = await db.collection(collection).doc(docId).get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as T;
  } catch (error) {
    console.error(`[Firestore] Error getting document ${collection}/${docId}:`, error);
    throw error;
  }
}

/**
 * Set document in Firestore
 */
export async function setDocument<T = any>(
  collection: string,
  docId: string,
  data: T
): Promise<void> {
  try {
    const db = getFirestore();
    await db.collection(collection).doc(docId).set(data);
  } catch (error) {
    console.error(`[Firestore] Error setting document ${collection}/${docId}:`, error);
    throw error;
  }
}

/**
 * Update document in Firestore
 */
export async function updateDocument<T = any>(
  collection: string,
  docId: string,
  data: Partial<T>
): Promise<void> {
  try {
    const db = getFirestore();
    await db.collection(collection).doc(docId).update(data as any);
  } catch (error) {
    console.error(`[Firestore] Error updating document ${collection}/${docId}:`, error);
    throw error;
  }
}

/**
 * Delete document from Firestore
 */
export async function deleteDocument(collection: string, docId: string): Promise<void> {
  try {
    const db = getFirestore();
    await db.collection(collection).doc(docId).delete();
  } catch (error) {
    console.error(`[Firestore] Error deleting document ${collection}/${docId}:`, error);
    throw error;
  }
}

/**
 * Query documents from Firestore
 */
export async function queryDocuments<T = any>(
  collection: string,
  filters?: Array<{ field: string; operator: FirebaseFirestore.WhereFilterOp; value: any }>
): Promise<T[]> {
  try {
    const db = getFirestore();
    let query: FirebaseFirestore.Query = db.collection(collection);

    if (filters) {
      for (const filter of filters) {
        query = query.where(filter.field, filter.operator, filter.value);
      }
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => doc.data() as T);
  } catch (error) {
    console.error(`[Firestore] Error querying collection ${collection}:`, error);
    throw error;
  }
}

/**
 * Export Timestamp for use in other modules
 */
export { Timestamp };
```

### 2. Create Firestore Path Helpers

**src/firestore/paths.ts**:
```typescript
/**
 * Firestore path helpers following users/{user_id}/ pattern
 */

/**
 * Get path to user's preferences document
 */
export function getUserPreferencesPath(userId: string): string {
  return `users/${userId}/preferences`;
}

/**
 * Get path to user's templates collection
 */
export function getUserTemplatesPath(userId: string): string {
  return `users/${userId}/templates`;
}

/**
 * Get path to specific user template
 */
export function getUserTemplatePath(userId: string, templateId: string): string {
  return `users/${userId}/templates/${templateId}`;
}

/**
 * Get path to user's access logs collection
 */
export function getUserAccessLogsPath(userId: string): string {
  return `users/${userId}/access_logs`;
}

/**
 * Get path to user's trust relationships collection
 */
export function getUserTrustRelationshipsPath(userId: string): string {
  return `users/${userId}/trust_relationships`;
}

/**
 * Get path to default templates collection
 */
export function getDefaultTemplatesPath(): string {
  return 'templates/default';
}

/**
 * Get path to specific default template
 */
export function getDefaultTemplatePath(templateId: string): string {
  return `templates/default/${templateId}`;
}

/**
 * Get path to user permissions (cross-user)
 */
export function getUserPermissionsPath(ownerUserId: string, accessorUserId: string): string {
  return `user_permissions/${ownerUserId}/allowed_accessors/${accessorUserId}`;
}
```

### 3. Create Test File

**tests/unit/firestore-client.test.ts**:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import {
  initFirestore,
  testFirestoreConnection,
  setDocument,
  getDocument,
  deleteDocument,
} from '../../src/firestore/client.js';

describe('Firestore Client', () => {
  beforeAll(async () => {
    await initFirestore();
  });

  it('should initialize client', async () => {
    const result = await testFirestoreConnection();
    expect(result).toBe(true);
  });

  it('should set and get document', async () => {
    const testData = { test: 'value', timestamp: new Date().toISOString() };
    
    await setDocument('_test', 'test-doc', testData);
    const retrieved = await getDocument('_test', 'test-doc');
    
    expect(retrieved).toEqual(testData);
    
    // Cleanup
    await deleteDocument('_test', 'test-doc');
  });

  it('should return null for non-existent document', async () => {
    const result = await getDocument('_test', 'non-existent');
    expect(result).toBeNull();
  });
});
```

---

## Verification

- [ ] src/firestore/client.ts created
- [ ] src/firestore/paths.ts created
- [ ] Tests created
- [ ] Can initialize Firestore
- [ ] Connection test passes
- [ ] Can set/get/delete documents
- [ ] Path helpers work correctly

---

## Testing

```bash
# Run tests
npm test

# Test connection manually
npm run dev
# Should see: [Firestore] Client initialized
# Should see: [Firestore] Connection successful
```

---

## Next Task

Task 5: Create Basic MCP Server
