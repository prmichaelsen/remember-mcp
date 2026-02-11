# Permissions & Trust Storage Architecture

**Concept**: Storage strategy for user permissions and trust relationships  
**Created**: 2026-02-11  
**Status**: Design Specification

---

## Overview

We need to store:
1. **User Permissions**: Which user_id can access which user's persona/memories
2. **Trust Relationships**: Trust levels between users
3. **Trust Context**: Why trust was granted, history, etc.

---

## Storage Options Analysis

### Option 1: Separate Database (e.g., Firestore)

**Pros**:
- ✅ Optimized for relational queries
- ✅ Real-time updates and subscriptions
- ✅ Built-in security rules
- ✅ Easy to query "who can access my memories?"
- ✅ Separate concerns (permissions vs memories)
- ✅ Better for complex permission logic
- ✅ Easier to audit and manage
- ✅ Can use Firebase Auth integration

**Cons**:
- ❌ Additional database to manage
- ❌ Cross-database queries more complex
- ❌ Potential consistency issues
- ❌ Extra network hop for permission checks

**Best For**: Complex permission scenarios, frequent permission queries, real-time updates

---

### Option 2: Weaviate Database (Structured)

**Pros**:
- ✅ Single database for everything
- ✅ No cross-database queries
- ✅ Simpler architecture
- ✅ Consistent data model
- ✅ Can leverage vector search for trust patterns

**Cons**:
- ❌ Weaviate not optimized for relational queries
- ❌ No built-in security rules
- ❌ Harder to query complex permission graphs
- ❌ Less flexible for permission logic
- ❌ Mixing concerns (permissions + memories)

**Best For**: Simple permission scenarios, minimal permission queries

---

## Recommended Approach: Hybrid Strategy

**Use Firestore for permissions, Weaviate for memories**

### Why Hybrid?

1. **Separation of Concerns**
   - Firestore: User relationships, permissions, trust
   - Weaviate: Memories, content, semantic search

2. **Optimized for Use Case**
   - Firestore excels at relational data
   - Weaviate excels at vector search

3. **Scalability**
   - Permission checks are fast (Firestore)
   - Memory search is fast (Weaviate)
   - Each database does what it's best at

4. **Security**
   - Firestore security rules for permissions
   - Weaviate collection isolation for memories

---

## Architecture Design

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│  agentbase.me Platform                                       │
│  - Firebase Auth (user authentication)                      │
│  - Firestore (permissions & trust relationships)            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ MCP Request with auth token
                 │
┌────────────────▼────────────────────────────────────────────┐
│  remember-mcp Server                                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Permission Layer                                    │   │
│  │  1. Validate Firebase token → user_id               │   │
│  │  2. Check Firestore for permissions                 │   │
│  │  3. Get trust relationships                         │   │
│  └────────────────┬─────────────────────────────────────┘   │
│                   │                                          │
│  ┌────────────────▼─────────────────────────────────────┐   │
│  │  Memory Layer                                        │   │
│  │  1. Query Weaviate with user_id scope              │   │
│  │  2. Apply trust filtering                          │   │
│  │  3. Format with trust context                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Firestore Schema

### Collection: `user_permissions`

```typescript
// Document path: user_permissions/{owner_user_id}/allowed_accessors/{accessor_user_id}
interface UserPermission {
  // Identity
  owner_user_id: string;      // User whose memories can be accessed
  accessor_user_id: string;   // User who can access
  
  // Permission
  can_access: boolean;         // Is access allowed?
  access_level: string;        // "read", "read_write", "admin"
  
  // Trust
  trust_level: number;         // 0-1, continuous trust score
  trust_summary: string;       // Brief explanation of trust
  trust_reason: string;        // Detailed reason for trust level
  
  // Scope
  allowed_memory_types: string[];  // Which memory types can be accessed
  allowed_tags: string[];          // Which tags can be accessed
  excluded_tags: string[];         // Which tags are forbidden
  
  // Temporal
  granted_at: Timestamp;
  expires_at: Timestamp | null;    // Optional expiration
  last_accessed: Timestamp;
  access_count: number;
  
  // Metadata
  granted_by: string;          // Who granted this permission
  revoked: boolean;
  revoked_at: Timestamp | null;
  revoked_reason: string | null;
}
```

**Example Document**:
```javascript
// user_permissions/alice_123/allowed_accessors/bob_456
{
  owner_user_id: "alice_123",
  accessor_user_id: "bob_456",
  can_access: true,
  access_level: "read",
  trust_level: 0.7,
  trust_summary: "Close friend, can see most memories",
  trust_reason: "Bob is a trusted friend. We've known each other for 5 years...",
  allowed_memory_types: ["note", "event", "location"],
  allowed_tags: ["travel", "food", "movies"],
  excluded_tags: ["medical", "financial", "private"],
  granted_at: Timestamp.now(),
  expires_at: null,
  last_accessed: Timestamp.now(),
  access_count: 42,
  granted_by: "alice_123",
  revoked: false
}
```

### Collection: `trust_history`

```typescript
// Document path: trust_history/{owner_user_id}/history/{history_id}
interface TrustHistoryEntry {
  owner_user_id: string;
  accessor_user_id: string;
  
  // Change
  previous_trust: number;
  new_trust: number;
  change_reason: string;
  
  // Context
  changed_at: Timestamp;
  changed_by: string;
  conversation_id: string | null;
  
  // Evidence
  evidence: {
    type: string;              // "positive_interaction", "violation", "manual_adjustment"
    description: string;
    severity: number;          // 0-1
  }[];
}
```

### Collection: `persona_access`

```typescript
// Document path: persona_access/{persona_id}/allowed_users/{user_id}
interface PersonaAccess {
  persona_id: string;          // Which persona/agent
  user_id: string;             // Which user can talk to it
  
  // Access
  can_interact: boolean;
  interaction_level: string;   // "basic", "full", "admin"
  
  // Limits
  rate_limit: number;          // Requests per hour
  daily_limit: number;         // Requests per day
  
  // Temporal
  granted_at: Timestamp;
  expires_at: Timestamp | null;
  last_interaction: Timestamp;
  interaction_count: number;
}
```

---

## Weaviate Schema

### Collection: `Memory_{user_id}`

```yaml
Memory:
  # Core fields (as defined in requirements)
  id: uuid
  user_id: string
  content: text
  # ... other memory fields ...
  
  # Trust metadata (stored but not used for filtering)
  default_trust: float         # Default trust for this memory
  trust_override: object       # Per-user trust overrides
    user_id: string
    trust: float
    reason: string
```

**Note**: Trust relationships are primarily in Firestore, but memories can have default trust levels and per-user overrides stored in Weaviate for performance.

---

## Permission Check Flow

### 1. Request Arrives

```typescript
async function handleMCPRequest(
  tool: string,
  args: any,
  context: RequestContext
): Promise<any> {
  // 1. Validate Firebase token
  const authResult = await firebaseAuth.verifyToken(context.auth_token);
  const accessor_user_id = authResult.uid;
  
  // 2. Determine target user
  const target_user_id = args.user_id || accessor_user_id;
  
  // 3. Check permissions (if accessing another user's memories)
  if (accessor_user_id !== target_user_id) {
    const permission = await checkPermission(target_user_id, accessor_user_id);
    
    if (!permission.can_access) {
      throw new Error('Access denied');
    }
    
    // Store permission context for trust filtering
    context.permission = permission;
  }
  
  // 4. Execute tool with permission context
  return await executeTool(tool, args, context);
}
```

### 2. Check Permission (Firestore)

```typescript
async function checkPermission(
  owner_user_id: string,
  accessor_user_id: string
): Promise<UserPermission | null> {
  // Query Firestore
  const doc = await firestore
    .collection('user_permissions')
    .doc(owner_user_id)
    .collection('allowed_accessors')
    .doc(accessor_user_id)
    .get();
  
  if (!doc.exists) {
    return null; // No permission granted
  }
  
  const permission = doc.data() as UserPermission;
  
  // Check if revoked
  if (permission.revoked) {
    return null;
  }
  
  // Check if expired
  if (permission.expires_at && permission.expires_at < Timestamp.now()) {
    return null;
  }
  
  // Update last accessed
  await doc.ref.update({
    last_accessed: Timestamp.now(),
    access_count: FieldValue.increment(1)
  });
  
  return permission;
}
```

### 3. Query Memories with Trust Context

```typescript
async function searchMemories(
  query: string,
  owner_user_id: string,
  context: RequestContext
): Promise<Memory[]> {
  // 1. Query Weaviate (user's collection)
  const memories = await weaviateClient.searchDocuments(
    query,
    {}, // filters
    10, // limit
    owner_user_id // collection scope
  );
  
  // 2. Apply trust filtering
  const permission = context.permission;
  
  if (permission) {
    // Accessing another user's memories
    return memories
      .filter(m => isMemoryAllowed(m, permission))
      .map(m => applyTrustLevel(m, permission.trust_level));
  }
  
  // Accessing own memories - full access
  return memories;
}
```

### 4. Filter by Permission Scope

```typescript
function isMemoryAllowed(
  memory: Memory,
  permission: UserPermission
): boolean {
  // Check memory type
  if (permission.allowed_memory_types.length > 0) {
    if (!permission.allowed_memory_types.includes(memory.type)) {
      return false;
    }
  }
  
  // Check excluded tags
  if (permission.excluded_tags.length > 0) {
    const hasExcludedTag = memory.tags.some(tag => 
      permission.excluded_tags.includes(tag)
    );
    if (hasExcludedTag) {
      return false;
    }
  }
  
  // Check allowed tags (if specified)
  if (permission.allowed_tags.length > 0) {
    const hasAllowedTag = memory.tags.some(tag =>
      permission.allowed_tags.includes(tag)
    );
    if (!hasAllowedTag) {
      return false;
    }
  }
  
  return true;
}
```

---

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // User permissions
    match /user_permissions/{owner_user_id}/allowed_accessors/{accessor_user_id} {
      // Owner can read/write their own permissions
      allow read, write: if request.auth.uid == owner_user_id;
      
      // Accessor can read their permission (but not write)
      allow read: if request.auth.uid == accessor_user_id;
      
      // Prevent self-permission escalation
      allow write: if request.auth.uid == owner_user_id 
                   && accessor_user_id != owner_user_id;
    }
    
    // Trust history
    match /trust_history/{owner_user_id}/history/{history_id} {
      // Owner can read their trust history
      allow read: if request.auth.uid == owner_user_id;
      
      // System can write (via admin SDK)
      allow write: if false; // Only via admin SDK
    }
    
    // Persona access
    match /persona_access/{persona_id}/allowed_users/{user_id} {
      // User can read their own access
      allow read: if request.auth.uid == user_id;
      
      // Persona owner can manage access
      allow write: if request.auth.uid == getPersonaOwner(persona_id);
    }
  }
}
```

---

## API Examples

### Grant Permission

```typescript
// User Alice grants Bob access to her memories
async function grantPermission(
  owner_user_id: string,
  accessor_user_id: string,
  trust_level: number,
  options: PermissionOptions
): Promise<void> {
  const permission: UserPermission = {
    owner_user_id,
    accessor_user_id,
    can_access: true,
    access_level: options.access_level || "read",
    trust_level,
    trust_summary: options.trust_summary,
    trust_reason: options.trust_reason,
    allowed_memory_types: options.allowed_memory_types || [],
    allowed_tags: options.allowed_tags || [],
    excluded_tags: options.excluded_tags || [],
    granted_at: Timestamp.now(),
    expires_at: options.expires_at || null,
    last_accessed: Timestamp.now(),
    access_count: 0,
    granted_by: owner_user_id,
    revoked: false,
    revoked_at: null,
    revoked_reason: null
  };
  
  await firestore
    .collection('user_permissions')
    .doc(owner_user_id)
    .collection('allowed_accessors')
    .doc(accessor_user_id)
    .set(permission);
}
```

### Update Trust Level

```typescript
async function updateTrustLevel(
  owner_user_id: string,
  accessor_user_id: string,
  new_trust: number,
  reason: string
): Promise<void> {
  const permissionRef = firestore
    .collection('user_permissions')
    .doc(owner_user_id)
    .collection('allowed_accessors')
    .doc(accessor_user_id);
  
  const doc = await permissionRef.get();
  const current = doc.data() as UserPermission;
  
  // Update permission
  await permissionRef.update({
    trust_level: new_trust,
    trust_reason: reason
  });
  
  // Log history
  await firestore
    .collection('trust_history')
    .doc(owner_user_id)
    .collection('history')
    .add({
      owner_user_id,
      accessor_user_id,
      previous_trust: current.trust_level,
      new_trust,
      change_reason: reason,
      changed_at: Timestamp.now(),
      changed_by: owner_user_id,
      conversation_id: null,
      evidence: []
    });
}
```

### Revoke Permission

```typescript
async function revokePermission(
  owner_user_id: string,
  accessor_user_id: string,
  reason: string
): Promise<void> {
  await firestore
    .collection('user_permissions')
    .doc(owner_user_id)
    .collection('allowed_accessors')
    .doc(accessor_user_id)
    .update({
      revoked: true,
      revoked_at: Timestamp.now(),
      revoked_reason: reason
    });
}
```

### List Who Can Access My Memories

```typescript
async function listAccessors(owner_user_id: string): Promise<UserPermission[]> {
  const snapshot = await firestore
    .collection('user_permissions')
    .doc(owner_user_id)
    .collection('allowed_accessors')
    .where('revoked', '==', false)
    .orderBy('trust_level', 'desc')
    .get();
  
  return snapshot.docs.map(doc => doc.data() as UserPermission);
}
```

---

## Performance Optimization

### 1. Cache Permissions

```typescript
// In-memory cache for frequently checked permissions
const permissionCache = new Map<string, UserPermission>();

async function checkPermissionCached(
  owner_user_id: string,
  accessor_user_id: string
): Promise<UserPermission | null> {
  const cacheKey = `${owner_user_id}:${accessor_user_id}`;
  
  // Check cache
  if (permissionCache.has(cacheKey)) {
    const cached = permissionCache.get(cacheKey)!;
    
    // Validate cache (5 minute TTL)
    if (Date.now() - cached.last_accessed.toMillis() < 300000) {
      return cached;
    }
  }
  
  // Fetch from Firestore
  const permission = await checkPermission(owner_user_id, accessor_user_id);
  
  if (permission) {
    permissionCache.set(cacheKey, permission);
  }
  
  return permission;
}
```

### 2. Batch Permission Checks

```typescript
async function checkPermissionsBatch(
  owner_user_id: string,
  accessor_user_ids: string[]
): Promise<Map<string, UserPermission>> {
  const results = new Map();
  
  // Batch read from Firestore
  const refs = accessor_user_ids.map(id =>
    firestore
      .collection('user_permissions')
      .doc(owner_user_id)
      .collection('allowed_accessors')
      .doc(id)
  );
  
  const docs = await firestore.getAll(...refs);
  
  docs.forEach((doc, index) => {
    if (doc.exists) {
      results.set(accessor_user_ids[index], doc.data() as UserPermission);
    }
  });
  
  return results;
}
```

---

## Migration Strategy

### Phase 1: Firestore Setup
1. Create Firestore collections
2. Define security rules
3. Set up indexes
4. Create admin tools for permission management

### Phase 2: Integration
1. Add Firestore client to remember-mcp
2. Implement permission check layer
3. Add caching
4. Test with sample permissions

### Phase 3: UI
1. Add permission management UI to agentbase.me
2. Allow users to grant/revoke access
3. Show trust history
4. Display who can access memories

---

## Recommendation

**Use Firestore for permissions** because:

1. ✅ **Optimized for relational queries** - "Who can access my memories?"
2. ✅ **Real-time updates** - Permission changes take effect immediately
3. ✅ **Security rules** - Built-in access control
4. ✅ **Firebase integration** - Works seamlessly with Firebase Auth
5. ✅ **Scalable** - Handles millions of permission records
6. ✅ **Auditable** - Easy to track permission changes
7. ✅ **Flexible** - Can add complex permission logic without affecting Weaviate

**Cost**: Minimal - permission checks are infrequent and can be cached

---

**Status**: Design Specification  
**Recommendation**: Hybrid approach - Firestore for permissions, Weaviate for memories  
**Next Step**: Implement Firestore schema and permission check layer
