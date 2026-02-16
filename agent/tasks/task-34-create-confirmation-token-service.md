# Task 34: Create Confirmation Token Service

**Milestone**: M10 - Shared Spaces & Confirmation Flow
**Estimated Time**: 3 hours
**Dependencies**: M1 (Firestore setup)
**Status**: Not Started

---

## Objective

Create a service for managing confirmation tokens used in the publish workflow. Handles token generation, validation, expiry, and status tracking.

---

## Steps

### 1. Create Token Service File

Create `src/services/confirmation-token.service.ts` with the ConfirmationTokenService class.

**Actions**:
- Import required dependencies (uuid, Firestore, Timestamp)
- Define ConfirmationRequest interface
- Create ConfirmationTokenService class
- Set EXPIRY_MINUTES constant to 5

**Expected Outcome**: Service file structure created

### 2. Implement createRequest Method

Generate new confirmation tokens with stored parameters.

**Actions**:
- Generate UUID v4 token
- Calculate expiry timestamp (5 minutes from now)
- Create ConfirmationRequest object with all fields
- Store in Firestore: `pending_confirmations/{user_id}/requests/{auto_id}`
- Return request_id and token

**Expected Outcome**: Tokens can be created and stored

### 3. Implement validateToken Method

Validate tokens and check expiry.

**Actions**:
- Query Firestore for token with status='pending'
- Check if token exists
- Verify expiry timestamp
- Update status to 'expired' if needed
- Return request or null

**Expected Outcome**: Tokens can be validated

### 4. Implement confirmRequest Method

Mark a request as confirmed.

**Actions**:
- Call validateToken to get request
- Return null if invalid/expired
- Update status to 'confirmed'
- Set confirmed_at timestamp
- Return confirmed request

**Expected Outcome**: Requests can be confirmed

### 5. Implement denyRequest Method

Mark a request as denied.

**Actions**:
- Call validateToken to get request
- Return false if invalid/expired
- Update status to 'denied'
- Return true

**Expected Outcome**: Requests can be denied

### 6. Implement retractRequest Method

Allow users to retract their own requests.

**Actions**:
- Call validateToken to get request
- Return false if invalid/expired
- Update status to 'retracted'
- Return true

**Expected Outcome**: Requests can be retracted

### 7. Implement updateStatus Helper

Private method to update request status.

**Actions**:
- Accept userId, requestId, status parameters
- Update Firestore document
- Set confirmed_at if status is 'confirmed'
- Handle errors gracefully

**Expected Outcome**: Status updates work correctly

### 8. Implement cleanupExpired Method

Optional cleanup for expired tokens (Firestore TTL handles this automatically).

**Actions**:
- Query collection group 'requests' for expired pending tokens
- Use batch delete for efficiency
- Return count of deleted requests
- Add documentation about Firestore TTL

**Expected Outcome**: Manual cleanup available if needed

### 9. Export Service Instance

Create singleton instance for use across tools.

**Actions**:
- Export `confirmationTokenService` instance
- Add JSDoc comments
- Document all methods

**Expected Outcome**: Service ready for import

### 10. Create Unit Tests

Test all service methods.

**Actions**:
- Create `tests/unit/confirmation-token.service.test.ts`
- Test token creation
- Test token validation
- Test expiry handling
- Test confirm/deny/retract flows
- Test cleanup method
- Mock Firestore calls

**Expected Outcome**: All tests passing

---

## Verification

- [ ] `src/services/confirmation-token.service.ts` created
- [ ] ConfirmationRequest interface defined
- [ ] createRequest generates valid tokens
- [ ] validateToken checks expiry correctly
- [ ] confirmRequest updates status
- [ ] denyRequest updates status
- [ ] retractRequest updates status
- [ ] cleanupExpired removes old tokens
- [ ] Unit tests created and passing
- [ ] TypeScript compiles without errors
- [ ] Service exports singleton instance

---

## Code Example

```typescript
// Usage in tools
import { confirmationTokenService } from '../services/confirmation-token.service.js';

// Create token
const { requestId, token } = await confirmationTokenService.createRequest(
  userId,
  'publish_memory',
  { memory_id: 'abc123', additional_tags: [] },
  'void'
);

// Validate and confirm
const request = await confirmationTokenService.confirmRequest(userId, token);
if (request) {
  // Execute action with request.payload
}
```

---

## Related Files

- Design: [`agent/design/publish-tools-confirmation-flow.md`](../design/publish-tools-confirmation-flow.md)
- Firestore paths: [`src/firestore/paths.ts`](../../src/firestore/paths.ts)

---

**Next Task**: Task 35 - Create Space Memory Types and Schema
