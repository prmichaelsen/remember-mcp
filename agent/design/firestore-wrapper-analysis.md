# Firestore Client Wrapper - Do We Need It?

**Question**: Should we create a Firestore client wrapper, or use firebase-admin-sdk-v8 directly?  
**Created**: 2026-02-11  
**Status**: Design Analysis

---

## The Question

The `@prmichaelsen/firebase-admin-sdk-v8` library already provides:
- `getDocument()`, `setDocument()`, `addDocument()`, `updateDocument()`, `deleteDocument()`
- `queryDocuments()` with filters, ordering, pagination
- `batchWrite()` for atomic operations
- `FieldValue` operations (increment, arrayUnion, etc.)
- `verifyIdToken()` for authentication

**Do we need a wrapper?** Or should we use it directly?

---

## Analysis

### Option 1: Use firebase-admin-sdk-v8 Directly (No Wrapper)

```typescript
// In tools or services
import { getDocument, setDocument } from '@prmichaelsen/firebase-admin-sdk-v8';

export async function getUserPreferences(userId: string) {
  return await getDocument('user_preferences', userId);
}

export async function updatePreferences(userId: string, updates: any) {
  await setDocument('user_preferences', userId, updates, { merge: true });
}
```

**Pros**:
- ✅ **Simpler** - No extra abstraction layer
- ✅ **Less code** - Fewer files to maintain
- ✅ **Direct access** - Use library features directly
- ✅ **Clear API** - Library API is already clean
- ✅ **No duplication** - Don't reimplement what library provides

**Cons**:
- ❌ **Scattered initialization** - `initializeApp()` called in multiple places
- ❌ **No centralized error handling** - Each call handles errors separately
- ❌ **No testing helpers** - No mock-friendly interface
- ❌ **No connection state** - Can't check if initialized

---

### Option 2: Minimal Wrapper (Initialization Only)

```typescript
// src/firestore/client.ts
import { initializeApp } from '@prmichaelsen/firebase-admin-sdk-v8';
import { config } from '../config.js';

let initialized = false;

export async function initFirestore(): Promise<void> {
  if (initialized) return;
  
  initializeApp({
    serviceAccount: JSON.parse(config.firebase.serviceAccount),
    projectId: config.firebase.projectId
  });
  
  initialized = true;
  console.log('[Firestore] Initialized');
}

export function isFirestoreInitialized(): boolean {
  return initialized;
}

// Re-export library functions for convenience
export {
  getDocument,
  setDocument,
  addDocument,
  updateDocument,
  deleteDocument,
  queryDocuments,
  batchWrite,
  FieldValue,
  verifyIdToken
} from '@prmichaelsen/firebase-admin-sdk-v8';
```

**Pros**:
- ✅ **Centralized initialization** - Single place to initialize
- ✅ **Connection state tracking** - Can check if initialized
- ✅ **Simple** - Just initialization + re-exports
- ✅ **Direct access** - Still use library functions directly
- ✅ **Easy testing** - Can mock initialization

**Cons**:
- ❌ **Minimal value** - Just wraps initialization
- ❌ **Extra import** - Need to import from wrapper instead of library

---

### Option 3: Service Layer (No Client Wrapper)

```typescript
// src/services/user-preferences.service.ts
import { getDocument, setDocument } from '@prmichaelsen/firebase-admin-sdk-v8';

export class UserPreferencesService {
  static async get(userId: string): Promise<UserPreferences> {
    const doc = await getDocument('user_preferences', userId);
    return doc || DEFAULT_PREFERENCES;
  }
  
  static async update(userId: string, updates: Partial<UserPreferences>): Promise<void> {
    await setDocument('user_preferences', userId, {
      ...updates,
      updated_at: new Date().toISOString()
    }, { merge: true });
  }
}

// src/services/permissions.service.ts
import { getDocument, setDocument, queryDocuments } from '@prmichaelsen/firebase-admin-sdk-v8';

export class PermissionsService {
  static async grant(ownerUserId: string, accessorUserId: string, trustLevel: number): Promise<void> {
    const path = `user_permissions/${ownerUserId}/allowed_accessors`;
    await setDocument(path, accessorUserId, {
      trust_level: trustLevel,
      granted_at: new Date().toISOString()
    });
  }
  
  static async check(ownerUserId: string, accessorUserId: string): Promise<UserPermission | null> {
    const path = `user_permissions/${ownerUserId}/allowed_accessors`;
    return await getDocument(path, accessorUserId);
  }
}
```

**Pros**:
- ✅ **Domain-focused** - Services organized by business logic
- ✅ **Type-safe** - Each service has typed methods
- ✅ **Testable** - Can mock services easily
- ✅ **Clear responsibilities** - Each service handles one domain
- ✅ **No wrapper needed** - Use library directly in services
- ✅ **Follows agentbase.me pattern** - Proven approach

**Cons**:
- ❌ **More files** - One service per domain
- ❌ **Initialization scattered** - Each service might call initializeApp

---

## Recommendation: Service Layer Pattern (Option 3)

### Why Service Layer is Better

**1. Firebase Admin SDK is Already a "Client"**
- The library provides clean functions: `getDocument()`, `setDocument()`, etc.
- No need to wrap what's already well-designed
- Adding a wrapper just adds indirection

**2. Security Rules Don't Apply to Admin SDK**
- Admin SDK **bypasses** Firestore security rules
- Security rules only apply to client SDKs (web, mobile)
- Admin SDK has full access to all data
- Security must be enforced in **application logic**, not database rules

**3. Service Layer Provides Better Organization**
- Groups related operations by domain
- Type-safe interfaces per service
- Clear business logic separation
- Easier to test and maintain

**4. Proven Pattern from agentbase.me**
- agentbase.me uses service classes successfully
- No Firestore client wrapper needed
- Services use firebase-admin-sdk-v8 directly
- Clean, maintainable code

---

## Proposed Architecture

### Initialization (Minimal Wrapper)

```typescript
// src/firestore/init.ts
import { initializeApp } from '@prmichaelsen/firebase-admin-sdk-v8';
import { config } from '../config.js';

let initialized = false;

export function initFirestore(): void {
  if (initialized) return;
  
  try {
    initializeApp({
      serviceAccount: JSON.parse(config.firebase.serviceAccount),
      projectId: config.firebase.projectId
    });
    
    initialized = true;
    console.log('[Firestore] Initialized');
  } catch (error) {
    console.error('[Firestore] Initialization failed:', error);
    throw error;
  }
}

export function isFirestoreInitialized(): boolean {
  return initialized;
}
```

### Service Classes

```typescript
// src/services/user-preferences.service.ts
import { getDocument, setDocument } from '@prmichaelsen/firebase-admin-sdk-v8';
import type { UserPreferences } from '../types/preferences.js';

export class UserPreferencesService {
  static async get(userId: string): Promise<UserPreferences> {
    const doc = await getDocument('user_preferences', userId);
    return doc || DEFAULT_PREFERENCES;
  }
  
  static async update(userId: string, updates: Partial<UserPreferences>): Promise<void> {
    await setDocument('user_preferences', userId, {
      ...updates,
      updated_at: new Date().toISOString()
    }, { merge: true });
  }
}

// src/services/permissions.service.ts
import { getDocument, setDocument, queryDocuments } from '@prmichaelsen/firebase-admin-sdk-v8';
import type { UserPermission } from '../types/permissions.js';

export class PermissionsService {
  static async grant(ownerUserId: string, accessorUserId: string, permission: UserPermission): Promise<void> {
    const path = `user_permissions/${ownerUserId}/allowed_accessors`;
    await setDocument(path, accessorUserId, permission);
  }
  
  static async check(ownerUserId: string, accessorUserId: string): Promise<UserPermission | null> {
    const path = `user_permissions/${ownerUserId}/allowed_accessors`;
    return await getDocument(path, accessorUserId);
  }
  
  static async list(ownerUserId: string): Promise<UserPermission[]> {
    const path = `user_permissions/${ownerUserId}/allowed_accessors`;
    const results = await queryDocuments(path, {
      where: [{ field: 'revoked', op: '!=', value: true }],
      orderBy: [{ field: 'trust_level', direction: 'DESCENDING' }]
    });
    return results.map(doc => ({ id: doc.id, ...doc.data }));
  }
}

// src/services/templates.service.ts
import { getDocument, setDocument, queryDocuments } from '@prmichaelsen/firebase-admin-sdk-v8';
import type { Template } from '../types/template.js';

export class TemplatesService {
  static async getDefault(): Promise<Template[]> {
    const results = await queryDocuments('templates/default', {
      where: [{ field: 'is_default', op: '==', value: true }]
    });
    return results.map(doc => ({ id: doc.id, ...doc.data }));
  }
  
  static async getUserTemplates(userId: string): Promise<Template[]> {
    const path = `users/${userId}/templates`;
    const results = await queryDocuments(path, {
      orderBy: [{ field: 'created_at', direction: 'DESCENDING' }]
    });
    return results.map(doc => ({ id: doc.id, ...doc.data }));
  }
}
```

---

## Security Considerations

### Admin SDK Bypasses Security Rules

**Important**: Firebase Admin SDK has **full access** to all data, regardless of security rules.

```javascript
// Firestore security rules (these DON'T apply to Admin SDK)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /user_preferences/{userId} {
      allow read, write: if request.auth.uid == userId;  // ❌ Admin SDK bypasses this
    }
  }
}
```

**Security must be enforced in application code**:

```typescript
export class UserPreferencesService {
  static async get(userId: string, requestingUserId: string): Promise<UserPreferences> {
    // ✅ Enforce security in code
    if (userId !== requestingUserId) {
      throw new Error('Unauthorized: Cannot access another user\'s preferences');
    }
    
    return await getDocument('user_preferences', userId);
  }
}
```

### When Security Rules Matter

Security rules **do matter** for:
- ✅ Firebase Client SDK (web, mobile apps)
- ✅ Direct Firestore REST API calls from clients
- ✅ Protection against compromised client apps

Security rules **don't matter** for:
- ❌ Firebase Admin SDK (full access)
- ❌ Server-side code with service account
- ❌ Our MCP server (uses Admin SDK)

**For remember-mcp**:
- We use Admin SDK on server → Security rules don't apply
- We must enforce security in **application logic**
- Trust system enforced in **code**, not database rules

---

## Comparison with Weaviate

### Why We Have Weaviate Wrapper

```typescript
// Weaviate needs wrapper because:
export function getMemoryCollectionName(userId: string): string {
  return `Memory_${sanitizeUserId(userId)}`;  // ✅ Multi-tenant logic
}

export function sanitizeUserId(userId: string): string {
  // ✅ Weaviate-specific naming rules
  return userId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
}
```

**Weaviate wrapper provides**:
- ✅ Multi-tenant collection naming
- ✅ User ID sanitization (Weaviate naming rules)
- ✅ Collection existence checking
- ✅ Connection state management

### Why Firestore Doesn't Need Wrapper

```typescript
// Firestore paths are simple strings
const path = `user_preferences/${userId}`;  // ✅ No sanitization needed
await getDocument(path, documentId);         // ✅ Library API is clean
```

**Firestore doesn't need wrapper because**:
- ❌ No special naming rules (paths are just strings)
- ❌ No sanitization needed (Firebase handles all characters)
- ❌ Library API is already clean and simple
- ❌ Service layer provides better organization

---

## Final Recommendation

### ✅ DO: Use Service Layer Pattern

**Create domain-specific services**:
- `src/services/user-preferences.service.ts`
- `src/services/permissions.service.ts`
- `src/services/templates.service.ts`
- `src/services/trust-history.service.ts`

**Each service**:
- Uses firebase-admin-sdk-v8 functions directly
- Provides type-safe methods
- Handles domain-specific logic
- Enforces security in code

### ✅ DO: Minimal Initialization Helper

**Create simple init helper**:
- `src/firestore/init.ts` - Just initialization + state tracking
- Re-exports library functions for convenience
- No complex wrapper logic

### ❌ DON'T: Create Full Client Wrapper

**Don't create**:
- `FirestoreClientWrapper` class
- Methods that just proxy to library functions
- Unnecessary abstraction layer

---

## Updated Task 4 Approach

### What to Create

1. **src/firestore/init.ts** (minimal)
   - `initFirestore()` - Initialize once
   - `isFirestoreInitialized()` - Check state
   - Re-export library functions

2. **src/services/** (domain services)
   - `user-preferences.service.ts`
   - `permissions.service.ts`
   - `templates.service.ts`

3. **src/types/** (type definitions)
   - `preferences.ts`
   - `permissions.ts`
   - `template.ts`

4. **tests/unit/** (service tests)
   - `user-preferences.service.test.ts`
   - `permissions.service.test.ts`

### What NOT to Create

- ❌ `src/firestore/client.ts` with full wrapper class
- ❌ Methods that just proxy library functions
- ❌ Complex abstraction layer

---

## Code Examples

### Minimal Init (Recommended)

```typescript
// src/firestore/init.ts
import { initializeApp } from '@prmichaelsen/firebase-admin-sdk-v8';
import { config } from '../config.js';

let initialized = false;

export function initFirestore(): void {
  if (initialized) return;
  
  initializeApp({
    serviceAccount: JSON.parse(config.firebase.serviceAccount),
    projectId: config.firebase.projectId
  });
  
  initialized = true;
  console.log('[Firestore] Initialized');
}

export function isFirestoreInitialized(): boolean {
  return initialized;
}

// Re-export for convenience
export {
  getDocument,
  setDocument,
  addDocument,
  updateDocument,
  deleteDocument,
  queryDocuments,
  batchWrite,
  FieldValue,
  verifyIdToken,
  type QueryOptions
} from '@prmichaelsen/firebase-admin-sdk-v8';
```

### Service Layer (Recommended)

```typescript
// src/services/user-preferences.service.ts
import { getDocument, setDocument } from '@prmichaelsen/firebase-admin-sdk-v8';
import type { UserPreferences } from '../types/preferences.js';
import { DEFAULT_PREFERENCES } from '../constants/defaults.js';

export class UserPreferencesService {
  /**
   * Get user preferences (returns defaults if not found)
   */
  static async get(userId: string): Promise<UserPreferences> {
    const doc = await getDocument('user_preferences', userId);
    
    if (!doc) {
      // Create with defaults
      await this.create(userId);
      return DEFAULT_PREFERENCES;
    }
    
    return doc as UserPreferences;
  }
  
  /**
   * Update user preferences
   */
  static async update(userId: string, updates: Partial<UserPreferences>): Promise<void> {
    await setDocument('user_preferences', userId, {
      ...updates,
      updated_at: new Date().toISOString()
    }, { merge: true });
  }
  
  /**
   * Create user preferences with defaults
   */
  static async create(userId: string): Promise<void> {
    await setDocument('user_preferences', userId, {
      ...DEFAULT_PREFERENCES,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
}
```

---

## Comparison with agentbase.me

### agentbase.me Pattern (What They Do)

```typescript
// They use services directly, no wrapper
import { getDocument, setDocument } from '@prmichaelsen/firebase-admin-sdk-v8';

export class ConversationDatabaseService {
  static async createConversation(userId: string, title: string) {
    const path = getUserConversations(userId);
    const docRef = await addDocument(path, { title, created_at: now });
    return { id: docRef.id, ...conversation };
  }
}
```

**They DON'T have**:
- ❌ Firestore client wrapper
- ❌ Abstraction layer over firebase-admin-sdk-v8

**They DO have**:
- ✅ Service classes for each domain
- ✅ Collection path helpers
- ✅ Direct use of library functions

---

## Conclusion

### ✅ Recommended Approach

**Use firebase-admin-sdk-v8 directly through service layer**:

1. **Minimal init helper** (`src/firestore/init.ts`)
   - Just initialization + state tracking
   - Re-export library functions

2. **Service classes** (`src/services/*.service.ts`)
   - Domain-specific logic
   - Type-safe methods
   - Direct use of library functions

3. **No client wrapper**
   - Library API is already clean
   - Wrapper adds no value
   - Service layer provides better organization

### Why This is Better

- ✅ **Simpler** - Less code, less complexity
- ✅ **Proven** - agentbase.me uses this pattern successfully
- ✅ **Maintainable** - Clear separation of concerns
- ✅ **Flexible** - Easy to add new services
- ✅ **Testable** - Mock services, not wrappers
- ✅ **Direct** - Use library features without indirection

### Security Note

**Admin SDK bypasses security rules** - we must enforce security in code:
- Check user permissions in service methods
- Validate user_id matches requesting user
- Enforce trust levels in application logic
- Use PermissionsService to check access rights

---

**Status**: Design Recommendation  
**Decision**: Use service layer pattern, no client wrapper  
**Rationale**: Library API is clean, service layer provides better organization  
**Next**: Update Task 4 to create services instead of wrapper
