# Trust Escalation Prevention

**Concept**: Automatic trust reduction for repeated unauthorized access attempts  
**Created**: 2026-02-11  
**Status**: Design Specification

---

## Overview

To prevent trust escalation attacks, the system automatically reduces trust levels when users repeatedly attempt to access memories they don't have sufficient trust for. After 3 attempts, access to that specific memory is blocked.

**Important**: Trust levels only apply to **cross-user access**. Users always have full access to their own memories regardless of trust level.

---

## Rules

### 1. **Trust Reduction**
- Each failed access attempt: **-0.1 trust level**
- Applies only to cross-user access attempts
- Automatic and immediate
- Logged for audit

### 2. **Access Blocking**
- After **3 failed attempts**: Memory access blocked
- Block is memory-specific (not user-wide)
- Persists until owner manually resets
- All attempts logged

### 3. **Owner Access**
- **Users always have full access to their own memories**
- Trust levels do NOT apply to self-access
- Trust 0 memories are fully accessible by owner
- Trust only restricts cross-user access

---

## Implementation

### Access Check Logic

```typescript
async function checkMemoryAccess(
  memory_id: string,
  accessor_user_id: string,
  memory: Memory
): Promise<boolean> {
  // RULE: Users always have full access to their own memories
  if (accessor_user_id === memory.user_id) {
    return true; // ✅ Owner access - no trust check needed
  }
  
  // Cross-user access - check trust
  const permission = await getPermission(memory.user_id, accessor_user_id);
  
  if (!permission) {
    throw new Error('No permission granted');
  }
  
  // Check if memory is blocked for this accessor
  const blockKey = `${accessor_user_id}:${memory_id}`;
  if (await isMemoryBlocked(blockKey)) {
    await logAccessAttempt({
      accessor_user_id,
      memory_id,
      required_trust: memory.trust,
      actual_trust: permission.trust_level,
      blocked: true,
      reason: 'Memory blocked due to repeated unauthorized attempts'
    });
    
    throw new Error('Access blocked - contact memory owner to reset');
  }
  
  // Check trust level
  if (permission.trust_level < memory.trust) {
    // Insufficient trust - apply penalty
    await handleInsufficientTrust(
      memory.user_id,
      accessor_user_id,
      memory_id,
      permission.trust_level,
      memory.trust
    );
    
    return false;
  }
  
  // Access granted
  return true;
}
```

### Trust Reduction Handler

```typescript
async function handleInsufficientTrust(
  owner_user_id: string,
  accessor_user_id: string,
  memory_id: string,
  current_trust: number,
  required_trust: number
): Promise<void> {
  const blockKey = `${accessor_user_id}:${memory_id}`;
  
  // Increment attempt count
  const attemptCount = await incrementAttemptCount(blockKey);
  
  // Reduce trust by 0.1
  const new_trust = Math.max(0, current_trust - 0.1);
  await updateTrustLevel(
    owner_user_id,
    accessor_user_id,
    new_trust,
    `Automatic reduction: unauthorized access attempt to memory ${memory_id} (attempt ${attemptCount}/3)`
  );
  
  // Log attempt
  await logAccessAttempt({
    accessor_user_id,
    memory_id,
    required_trust,
    actual_trust: current_trust,
    new_trust,
    attempt_number: attemptCount,
    blocked: false,
    timestamp: new Date()
  });
  
  // After 3 attempts, block access
  if (attemptCount >= 3) {
    await blockMemoryAccess(blockKey);
    
    // Notify owner
    await notifyOwner(owner_user_id, {
      type: 'trust_violation',
      accessor: accessor_user_id,
      memory_id,
      attempts: attemptCount,
      action: 'blocked',
      message: `User ${accessor_user_id} made 3 unauthorized access attempts. Access to memory ${memory_id} has been blocked.`
    });
    
    // Log block
    await logAccessAttempt({
      accessor_user_id,
      memory_id,
      required_trust,
      actual_trust: new_trust,
      new_trust,
      attempt_number: attemptCount,
      blocked: true,
      timestamp: new Date()
    });
  }
  
  throw new Error(`Insufficient trust (${current_trust.toFixed(2)} < ${required_trust.toFixed(2)}). Trust reduced to ${new_trust.toFixed(2)}. ${3 - attemptCount} attempts remaining before block.`);
}
```

---

## Owner Controls

### Reset Block

```typescript
async function resetMemoryBlock(
  owner_user_id: string,
  accessor_user_id: string,
  memory_id: string,
  reason: string
): Promise<void> {
  const blockKey = `${accessor_user_id}:${memory_id}`;
  
  // Unblock access
  await unblockMemoryAccess(blockKey);
  await resetAttemptCount(blockKey);
  
  // Log reset
  await logBlockReset({
    owner_user_id,
    accessor_user_id,
    memory_id,
    reason,
    timestamp: new Date()
  });
  
  // Note: Trust restoration is a separate action
  // Owner must explicitly restore trust if desired
}
```

**Note**: Resetting the block only unblocks access to that specific memory. Trust level remains at the reduced level. Owner must separately restore trust if they want to increase it.

### View Access Attempts

```typescript
async function getAccessAttempts(
  owner_user_id: string,
  filters?: {
    accessor_user_id?: string;
    memory_id?: string;
    blocked_only?: boolean;
    since?: Date;
  }
): Promise<AccessAttemptLog[]> {
  return await queryAccessAttempts({
    owner_user_id,
    ...filters,
    order_by: 'timestamp DESC',
    limit: 100
  });
}
```

---

## Example Scenarios

### Scenario 1: Legitimate Mistake

```
User Bob tries to access Alice's trust 0.8 memory
Bob's trust level: 0.7

Attempt 1: Trust reduced to 0.6, "2 attempts remaining"
Bob realizes mistake, stops trying
Alice reviews logs, sees it was accidental
Alice manually increases Bob's trust back to 0.7
```

### Scenario 2: Malicious Attempts

```
User Eve tries to access Alice's trust 0.9 memory
Eve's trust level: 0.5

Attempt 1: Trust reduced to 0.4, "2 attempts remaining"
Attempt 2: Trust reduced to 0.3, "1 attempt remaining"
Attempt 3: Trust reduced to 0.2, ACCESS BLOCKED

Alice receives notification
Alice reviews logs, sees repeated attempts
Alice decides to revoke Eve's access entirely
```

### Scenario 3: Owner Access (No Restrictions)

```
Alice accesses her own trust 0.0 memory
✅ Full access granted immediately
No trust check performed
No logging of "attempts"
Trust levels don't apply to self-access
```

---

## Data Structures

### AccessAttemptLog

```typescript
interface AccessAttemptLog {
  id: uuid;
  owner_user_id: string;
  accessor_user_id: string;
  memory_id: string;
  
  // Trust levels
  required_trust: float;
  actual_trust: float;
  new_trust: float;
  
  // Attempt tracking
  attempt_number: int;
  blocked: boolean;
  reason: string;
  
  // Metadata
  timestamp: datetime;
  ip_address: string;
  user_agent: string;
}
```

### MemoryBlock

```typescript
interface MemoryBlock {
  block_key: string;           // "{accessor_user_id}:{memory_id}"
  owner_user_id: string;
  accessor_user_id: string;
  memory_id: string;
  
  // Block details
  blocked_at: datetime;
  attempt_count: int;
  final_trust_level: float;
  
  // Reset info
  reset_at: datetime | null;
  reset_by: string | null;
  reset_reason: string | null;
}
```

---

## Benefits

1. **Automatic Protection**: No owner intervention needed
2. **Graduated Response**: Warning before blocking
3. **Audit Trail**: All attempts logged
4. **Owner Control**: Can reset blocks and restore trust
5. **Deters Attacks**: Makes trust escalation costly
6. **Fair**: Allows for mistakes (3 attempts)

---

## Monitoring

### Metrics to Track

1. **Attempt Rate**: Failed access attempts per hour
2. **Block Rate**: Memories blocked per day
3. **Trust Reduction**: Average trust reduction per user
4. **Reset Rate**: How often owners reset blocks
5. **Repeat Offenders**: Users with multiple blocks

### Alerts

- Alert owner after 2 failed attempts
- Alert admin if user has >5 blocks
- Alert admin if trust reduction rate is high

---

**Status**: Design Specification  
**Key Rule**: Trust levels only apply to cross-user access, not self-access  
**Implementation**: Automatic trust reduction with owner override capability
