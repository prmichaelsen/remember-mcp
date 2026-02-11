# Access Control Result Pattern

**Concept**: Use discriminated unions instead of exceptions for access control  
**Created**: 2026-02-11  
**Status**: Design Specification

---

## Problem with Throwing Errors

**Bad Pattern**:
```typescript
// ❌ Using exceptions for control flow
async function checkMemoryAccess(memory_id, accessor_user_id) {
  if (blocked) {
    throw new Error('Access blocked');
  }
  if (insufficient_trust) {
    throw new Error('Insufficient trust');
  }
  return memory;
}

// Caller has to catch and parse error messages
try {
  const memory = await checkMemoryAccess(id, user);
} catch (error) {
  // Hard to distinguish between different failure types
  if (error.message.includes('blocked')) {
    // Handle block
  } else if (error.message.includes('trust')) {
    // Handle trust failure
  }
}
```

**Problems**:
- Exceptions for expected cases (not exceptional)
- Hard to distinguish failure types
- Error message parsing is brittle
- No type safety
- Poor developer experience

---

## Solution: Discriminated Union (Result Type)

**Good Pattern**:
```typescript
// ✅ Using discriminated union
type AccessResult = 
  | { status: 'granted'; memory: Memory }
  | { status: 'insufficient_trust'; required: number; actual: number; attempts_remaining: number }
  | { status: 'blocked'; reason: string; blocked_at: Date }
  | { status: 'no_permission'; owner_user_id: string }
  | { status: 'not_found'; memory_id: string };

async function checkMemoryAccess(
  memory_id: string,
  accessor_user_id: string
): Promise<AccessResult> {
  // Implementation returns appropriate result
}

// Caller has type-safe handling
const result = await checkMemoryAccess(id, user);

switch (result.status) {
  case 'granted':
    // TypeScript knows result.memory exists
    return result.memory;
    
  case 'insufficient_trust':
    // TypeScript knows these fields exist
    console.log(`Need ${result.required}, have ${result.actual}`);
    console.log(`${result.attempts_remaining} attempts remaining`);
    return null;
    
  case 'blocked':
    console.log(`Blocked: ${result.reason} at ${result.blocked_at}`);
    return null;
    
  case 'no_permission':
    console.log(`No permission to access ${result.owner_user_id}'s memories`);
    return null;
    
  case 'not_found':
    console.log(`Memory ${result.memory_id} not found`);
    return null;
}
```

**Benefits**:
- ✅ Type-safe
- ✅ Exhaustive checking (TypeScript ensures all cases handled)
- ✅ Clear failure reasons
- ✅ Rich context for each failure type
- ✅ Better developer experience
- ✅ No exception handling needed

---

## Complete Implementation

### Access Result Types

```typescript
// Success case
interface AccessGranted {
  status: 'granted';
  memory: Memory;
  access_level: 'owner' | 'trusted';  // Was this owner or cross-user access?
}

// Trust insufficient (but not blocked yet)
interface AccessInsufficientTrust {
  status: 'insufficient_trust';
  memory_id: string;
  required_trust: number;
  actual_trust: number;
  trust_deficit: number;  // How much more trust needed
  attempts_made: number;
  attempts_remaining: number;
  new_trust_level: number;  // After penalty applied
}

// Access blocked (after 3 attempts)
interface AccessBlocked {
  status: 'blocked';
  memory_id: string;
  reason: string;
  blocked_at: Date;
  attempt_count: number;
  contact_owner: boolean;  // Should user contact owner?
}

// No permission granted at all
interface AccessNoPermission {
  status: 'no_permission';
  owner_user_id: string;
  accessor_user_id: string;
  message: string;
}

// Memory doesn't exist
interface AccessNotFound {
  status: 'not_found';
  memory_id: string;
}

// Memory was deleted
interface AccessDeleted {
  status: 'deleted';
  memory_id: string;
  deleted_at: Date;
}

// Union type
type AccessResult = 
  | AccessGranted
  | AccessInsufficientTrust
  | AccessBlocked
  | AccessNoPermission
  | AccessNotFound
  | AccessDeleted;
```

### Implementation

```typescript
async function checkMemoryAccess(
  memory_id: string,
  accessor_user_id: string
): Promise<AccessResult> {
  // Get memory
  const memory = await getMemory(memory_id);
  
  if (!memory) {
    return {
      status: 'not_found',
      memory_id
    };
  }
  
  if (memory.deleted) {
    return {
      status: 'deleted',
      memory_id,
      deleted_at: memory.deleted_at
    };
  }
  
  // Owner always has access
  if (accessor_user_id === memory.user_id) {
    return {
      status: 'granted',
      memory,
      access_level: 'owner'
    };
  }
  
  // Cross-user access - check permission
  const permission = await getPermission(memory.user_id, accessor_user_id);
  
  if (!permission || !permission.can_access) {
    return {
      status: 'no_permission',
      owner_user_id: memory.user_id,
      accessor_user_id,
      message: 'No permission granted to access this user\'s memories'
    };
  }
  
  // Check if blocked
  const blockKey = `${accessor_user_id}:${memory_id}`;
  const block = await getBlock(blockKey);
  
  if (block) {
    return {
      status: 'blocked',
      memory_id,
      reason: 'Access blocked due to repeated unauthorized attempts',
      blocked_at: block.blocked_at,
      attempt_count: block.attempt_count,
      contact_owner: true
    };
  }
  
  // Check trust level
  if (permission.trust_level < memory.trust) {
    // Apply penalty
    const attemptCount = await incrementAttemptCount(blockKey);
    const newTrust = Math.max(0, permission.trust_level - 0.1);
    
    await updateTrustLevel(
      memory.user_id,
      accessor_user_id,
      newTrust,
      `Unauthorized access attempt to memory ${memory_id}`
    );
    
    // Block after 3 attempts
    if (attemptCount >= 3) {
      await blockMemoryAccess(blockKey, attemptCount);
      
      return {
        status: 'blocked',
        memory_id,
        reason: 'Access blocked after 3 unauthorized attempts',
        blocked_at: new Date(),
        attempt_count: attemptCount,
        contact_owner: true
      };
    }
    
    return {
      status: 'insufficient_trust',
      memory_id,
      required_trust: memory.trust,
      actual_trust: permission.trust_level,
      trust_deficit: memory.trust - permission.trust_level,
      attempts_made: attemptCount,
      attempts_remaining: 3 - attemptCount,
      new_trust_level: newTrust
    };
  }
  
  // Access granted
  return {
    status: 'granted',
    memory,
    access_level: 'trusted'
  };
}
```

### Usage in Tools

```typescript
// remember_search_memory tool
async function searchMemory(args: SearchArgs, context: RequestContext) {
  const memories = await weaviate.search(args.query);
  
  // Filter by access
  const accessible = [];
  const access_denied = [];
  
  for (const memory of memories) {
    const result = await checkMemoryAccess(memory.id, context.user_id);
    
    switch (result.status) {
      case 'granted':
        accessible.push(result.memory);
        break;
        
      case 'insufficient_trust':
        access_denied.push({
          memory_id: memory.id,
          reason: 'insufficient_trust',
          details: `Need trust ${result.required_trust.toFixed(2)}, have ${result.actual_trust.toFixed(2)}`
        });
        break;
        
      case 'blocked':
        access_denied.push({
          memory_id: memory.id,
          reason: 'blocked',
          details: result.reason
        });
        break;
        
      // Other cases...
    }
  }
  
  return {
    results: accessible,
    access_denied: access_denied,
    total: accessible.length
  };
}
```

### User-Friendly Messages

```typescript
function formatAccessResult(result: AccessResult): string {
  switch (result.status) {
    case 'granted':
      return 'Access granted';
      
    case 'insufficient_trust':
      return `Insufficient trust level. You need ${result.required_trust.toFixed(2)} but have ${result.actual_trust.toFixed(2)}. Your trust has been reduced to ${result.new_trust_level.toFixed(2)}. ${result.attempts_remaining} attempts remaining before access is blocked.`;
      
    case 'blocked':
      return `Access to this memory has been blocked due to ${result.attempt_count} unauthorized access attempts. Please contact the memory owner to reset access.`;
      
    case 'no_permission':
      return `You don't have permission to access this user's memories. Please request access from the owner.`;
      
    case 'not_found':
      return `Memory not found.`;
      
    case 'deleted':
      return `This memory was deleted on ${result.deleted_at.toLocaleDateString()}.`;
  }
}
```

---

## Benefits Summary

### 1. **Type Safety**
```typescript
const result = await checkMemoryAccess(id, user);

if (result.status === 'granted') {
  // TypeScript knows result.memory exists
  console.log(result.memory.content);
  
  // TypeScript error: Property 'required_trust' does not exist
  // console.log(result.required_trust);  ❌
}
```

### 2. **Exhaustive Checking**
```typescript
function handleAccess(result: AccessResult) {
  switch (result.status) {
    case 'granted':
      return result.memory;
    case 'insufficient_trust':
      return null;
    case 'blocked':
      return null;
    // TypeScript error if we forget a case!
  }
}
```

### 3. **Rich Context**
```typescript
// Each failure type has specific, relevant information
if (result.status === 'insufficient_trust') {
  console.log(`Need ${result.trust_deficit.toFixed(2)} more trust`);
  console.log(`${result.attempts_remaining} attempts left`);
}
```

### 4. **Better Error Handling**
```typescript
// No try/catch needed for expected failures
const result = await checkMemoryAccess(id, user);

// Handle each case appropriately
if (result.status !== 'granted') {
  logAccessDenied(result);
  return null;
}

// Continue with granted access
processMemory(result.memory);
```

---

## Comparison

### Exceptions (Bad)
```typescript
try {
  const memory = await checkMemoryAccess(id, user);
  return memory;
} catch (error) {
  // String parsing, no type safety
  if (error.message.includes('blocked')) {
    // How many attempts? When blocked? Unknown!
    return null;
  }
}
```

### Result Type (Good)
```typescript
const result = await checkMemoryAccess(id, user);

if (result.status === 'blocked') {
  // All info available, type-safe
  console.log(`Blocked at ${result.blocked_at}`);
  console.log(`After ${result.attempt_count} attempts`);
  return null;
}
```

---

## Recommendation

**Use discriminated unions (Result types) for all access control operations**:

✅ `checkMemoryAccess()` → `AccessResult`  
✅ `checkPermission()` → `PermissionResult`  
✅ `validateTrust()` → `TrustResult`  
✅ `createMemory()` → `CreateResult`  
✅ `updateMemory()` → `UpdateResult`

**Reserve exceptions for truly exceptional cases**:
- Database connection failures
- Network errors
- Programming errors (bugs)
- System failures

---

**Status**: Design Specification  
**Pattern**: Discriminated Union (Result Type)  
**Benefit**: Type-safe, exhaustive, rich context for each failure case
