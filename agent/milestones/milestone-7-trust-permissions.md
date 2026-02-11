# Milestone 7: Trust & Permissions

**Goal**: Implement trust system and cross-user access control  
**Duration**: 2 weeks  
**Dependencies**: M6 (Auth & Multi-Tenancy)  
**Status**: Not Started

---

## Overview

Implement the prompt-based trust system, cross-user permissions, trust escalation prevention, and access logging.

---

## Deliverables

### 1. Trust Enforcement
- Prompt-based trust filtering
- Format memories by trust level (continuous 0-1)
- Validation for trust < 0.25
- Trust context in LLM prompts

### 2. Permission Storage
- Firestore schema: user_permissions/{owner}/allowed_accessors/{accessor}
- Permission CRUD operations
- Trust relationship tracking
- Access scope (allowed/excluded tags)

### 3. Trust Escalation Prevention
- Track access attempts
- -0.1 trust reduction per unauthorized attempt
- Block after 3 attempts
- Reset block functionality

### 4. Access Control Result Pattern
- Discriminated union types
- checkMemoryAccess() returns Result
- Type-safe error handling
- No exceptions for expected failures

### 5. Permission Tools (5 tools)
- remember_grant_access
- remember_revoke_access
- remember_list_accessors
- remember_reset_block
- remember_get_access_logs

---

## Success Criteria

- [ ] Trust levels enforced via prompts (continuous 0-1)
- [ ] Users always access own memories (trust doesn't apply to self)
- [ ] Cross-user access controlled by permissions
- [ ] Trust escalation prevention active
- [ ] Access attempts logged
- [ ] Validation catches trust violations
- [ ] Result pattern used (no exceptions)
- [ ] Block reset works correctly

---

## Key Files to Create

```
src/
├── types/
│   ├── access-result.ts    # Discriminated union
│   └── permission.ts       # Permission interfaces
├── services/
│   ├── trust-enforcement.ts
│   ├── trust-validator.ts
│   └── access-control.ts
├── firestore/
│   ├── permissions.ts
│   └── access-logs.ts
└── tools/
    ├── grant-access.ts
    ├── revoke-access.ts
    ├── list-accessors.ts
    ├── reset-block.ts
    └── get-access-logs.ts
```

---

## Trust Enforcement Example

```typescript
// Trust 0.0 - Intimate details only
formatMemoryForPrompt(memory, trust: 0.0):
  "Memory (Trust: 0.0 - Intimate Details Only):
   Context: Significant personal incident
   Type: personal_event
   
   CRITICAL: Hint at existence only, NO specifics."

// Trust 0.5 - Summary only
formatMemoryForPrompt(memory, trust: 0.5):
  "Memory (Trust: 0.5 - Summary Only):
   Title: Doctor Visit
   Summary: Had medical checkup, discussed health metrics
   
   Summary only - no specific medical details."

// Trust 1.0 - Full access
formatMemoryForPrompt(memory, trust: 1.0):
  "Memory (Trust: 1.0 - Full Access):
   Title: Camping Trip
   Content: [full content]
   
   You have full access to this memory."
```

---

## Testing

- [ ] Trust enforcement test (all levels 0-1)
- [ ] Self-access test (trust doesn't apply)
- [ ] Cross-user access test
- [ ] Permission grant/revoke test
- [ ] Trust escalation test (-0.1 per attempt)
- [ ] Block after 3 attempts test
- [ ] Reset block test
- [ ] Access logging test
- [ ] Validation test (trust < 0.25)

---

**Next Milestone**: M8 - Testing & Quality  
**Blockers**: M6 must be complete
