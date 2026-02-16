# Task 41: Configure Firestore TTL Policy

**Milestone**: M10 - Shared Spaces & Confirmation Flow
**Estimated Time**: 1 hour
**Dependencies**: Task 34 (Token Service)
**Status**: Not Started

---

## Objective

Configure Firestore Time-to-Live (TTL) policy to automatically delete expired confirmation tokens. This prevents accumulation of stale data and ensures cleanup without manual intervention.

---

## Steps

### 1. Understand Firestore TTL

Research Firestore TTL configuration.

**Actions**:
- Read Firestore TTL documentation
- Understand collection group policies
- Learn about TTL field requirements
- Note deletion timing (within 24 hours of expiry)

**Expected Outcome**: TTL concept understood

### 2. Access GCP Console

Navigate to Firestore TTL configuration.

**Actions**:
- Open Google Cloud Console
- Navigate to Firestore
- Find "Time-to-live" section
- Verify project access

**Expected Outcome**: TTL configuration page accessed

### 3. Create TTL Policy

Configure automatic deletion for confirmation tokens.

**Actions**:
- Click "Create Policy"
- Select collection group: `requests`
- Set TTL field: `expires_at`
- Confirm policy creation
- Wait for policy to activate

**Expected Outcome**: TTL policy created

### 4. Verify Policy Configuration

Ensure policy is active and correct.

**Actions**:
- Check policy status (should be "Active")
- Verify collection group: `requests`
- Verify TTL field: `expires_at`
- Note policy ID for documentation

**Expected Outcome**: Policy verified

### 5. Test Token Expiry

Create test token and verify automatic deletion.

**Actions**:
- Create test confirmation request with short expiry (1 minute)
- Wait for expiry time to pass
- Wait up to 24 hours for deletion
- Verify token document is deleted
- Document deletion timing

**Expected Outcome**: Automatic deletion confirmed

### 6. Document Configuration

Create documentation for TTL setup.

**Actions**:
- Document steps in README or setup guide
- Include screenshots if helpful
- Note timing expectations (within 24 hours)
- Add troubleshooting tips
- Document policy ID

**Expected Outcome**: Configuration documented

### 7. Update Code Comments

Add comments about TTL in token service.

**Actions**:
- Update `confirmation-token.service.ts` comments
- Note that Firestore TTL handles deletion
- Explain `cleanupExpired()` is optional
- Document timing expectations

**Expected Outcome**: Code comments updated

### 8. Create Monitoring Alert (Optional)

Set up alert for TTL policy issues.

**Actions**:
- Create Cloud Monitoring alert
- Monitor for TTL policy errors
- Set notification channels
- Document alert configuration

**Expected Outcome**: Monitoring in place

---

## Verification

- [ ] Firestore TTL policy created
- [ ] Collection group set to `requests`
- [ ] TTL field set to `expires_at`
- [ ] Policy status is "Active"
- [ ] Test token automatically deleted
- [ ] Configuration documented
- [ ] Code comments updated
- [ ] Optional: Monitoring alert created

---

## Configuration Details

**Policy Settings**:
- **Collection Group**: `requests`
- **TTL Field**: `expires_at`
- **Deletion Timing**: Within 24 hours after expiry
- **Scope**: All documents in `pending_confirmations/{user_id}/requests/` collections

**Important Notes**:
- Deletion is not immediate (up to 24 hours)
- TTL field must be a Timestamp type
- Policy applies to collection group (all matching collections)
- No cost for TTL deletions

---

## Documentation Template

```markdown
## Firestore TTL Configuration

Confirmation tokens are automatically deleted after expiry using Firestore TTL.

### Setup

1. Go to [Firestore Console](https://console.cloud.google.com/firestore)
2. Navigate to "Time-to-live" section
3. Click "Create Policy"
4. Configure:
   - Collection Group: `requests`
   - TTL Field: `expires_at`
5. Save and wait for activation

### Behavior

- Tokens expire after 5 minutes
- Firestore deletes expired tokens within 24 hours
- No manual cleanup required
- Optional: Use `cleanupExpired()` for immediate cleanup

### Troubleshooting

- **Policy not active**: Wait a few minutes after creation
- **Tokens not deleted**: Check TTL field is Timestamp type
- **Errors**: Verify collection group name is correct
```

---

## Related Files

- Design: [`agent/design/publish-tools-confirmation-flow.md`](../design/publish-tools-confirmation-flow.md)
- Token Service: [`src/services/confirmation-token.service.ts`](../../src/services/confirmation-token.service.ts)

---

**Next Task**: Task 42 - Create Tests for Shared Spaces
