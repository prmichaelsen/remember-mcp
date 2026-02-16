# Milestone 10: Shared Spaces & Confirmation Flow

**Goal**: Implement shared memory spaces with token-based confirmation for publishing
**Duration**: 2-3 weeks
**Dependencies**: M1-M4 (Foundation, Memory, Relationships, Preferences)
**Status**: Not Started

---

## Overview

Implement a secure, user-controlled system for publishing memories to shared spaces (like "The Void"). Uses token-based confirmation to ensure explicit user consent before any sensitive operation. Includes discovery tools for searching shared spaces.

This milestone introduces:
- **Token-based confirmation pattern** for sensitive operations
- **Shared space collections** (Memory_Void, Memory_Public, etc.)
- **Publishing workflow** with explicit user confirmation
- **Discovery tools** for searching shared spaces
- **Generic confirmation system** extensible to other actions

---

## Deliverables

### 1. Confirmation Token Service
- Token generation and validation
- Firestore storage for pending confirmations
- Token expiry (5 minutes)
- Status tracking (pending, confirmed, denied, expired)
- Cleanup for expired tokens

### 2. Space Memory Architecture
- Space collection schema (Memory_{space_name})
- SpaceMemory type definitions
- Author attribution
- Discovery metadata

### 3. Publishing Tools (5 tools)
- `remember_publish` - Generate confirmation token
- `remember_confirm` - Execute any pending action
- `remember_deny` - Cancel any pending action
- `remember_search_space` - Search shared spaces
- `remember_query_space` - RAG queries on shared spaces

### 4. Testing & Documentation
- Unit tests for token service
- Unit tests for all 5 tools
- End-to-end publishing flow test
- README updates
- Firestore TTL configuration guide

---

## Success Criteria

- [ ] Token service creates and validates tokens correctly
- [ ] Tokens expire after 5 minutes
- [ ] `remember_publish` generates tokens with stored parameters
- [ ] `remember_confirm` executes publish action successfully
- [ ] `remember_deny` cancels pending actions
- [ ] Published memories appear in shared space collections
- [ ] `remember_search_space` finds published memories
- [ ] `remember_query_space` answers questions about shared memories
- [ ] All 5 tools integrated into server.ts and server-factory.ts
- [ ] TypeScript compiles without errors
- [ ] All tests passing
- [ ] Build successful
- [ ] Firestore TTL policy configured

---

## Key Files to Create

```
src/
├── services/
│   └── confirmation-token.service.ts    # Token management
├── types/
│   └── space-memory.ts                  # SpaceMemory types
├── weaviate/
│   └── space-schema.ts                  # Space collection schemas
└── tools/
    ├── publish.ts                       # remember_publish
    ├── confirm.ts                       # remember_confirm
    ├── deny.ts                          # remember_deny
    ├── search-space.ts                  # remember_search_space
    └── query-space.ts                   # remember_query_space

tests/
└── unit/
    ├── confirmation-token.service.test.ts
    ├── publish.test.ts
    ├── confirm.test.ts
    ├── deny.test.ts
    ├── search-space.test.ts
    └── query-space.test.ts
```

---

## Implementation Tasks

See individual task documents:
- Task 34: Create Confirmation Token Service
- Task 35: Create Space Memory Types and Schema
- Task 36: Implement remember_publish Tool
- Task 37: Implement remember_confirm Tool
- Task 38: Implement remember_deny Tool
- Task 39: Implement remember_search_space Tool
- Task 40: Implement remember_query_space Tool
- Task 41: Configure Firestore TTL Policy
- Task 42: Create Tests for Shared Spaces
- Task 43: Update Documentation

---

## Architecture Notes

### Token Flow
```
1. Agent calls remember_publish(memory_id, target="the_void")
2. System validates memory, generates token, stores params
3. Agent asks user for confirmation
4. User confirms → Agent calls remember_confirm(token)
5. System validates token, fetches memory fresh, publishes
6. Memory copied to Memory_the_void collection
```

### Space Collections
- **Personal**: `Memory_User_123` (single user, sanitized user_id)
- **Shared**: `Memory_the_void`, `Memory_public_space` (multi-user, snake_case space IDs)
- **Consistent naming**: `Memory_{snake_case_id}` pattern

**Naming Convention**:
- Space IDs are **snake_case** (lowercase with underscores): `the_void`, `public_space`
- Collection names use snake_case IDs: `Memory_the_void`, `Memory_public_space`
- Display names can use any case/spaces: "The Void", "Public Space"
- Conversion: Display name → lowercase → replace spaces with underscores
- Example: "The Void" → `the_void` → `Memory_the_void` collection

### Security
- One-time use tokens (deleted after use)
- 5-minute expiry
- User ownership verification
- Fresh data fetch during confirmation

---

## Testing Strategy

1. **Unit Tests**: Token service, each tool independently
2. **Integration Tests**: Full publish flow (request → confirm → verify)
3. **E2E Tests**: Multi-user discovery scenarios
4. **Security Tests**: Token expiry, replay attacks, ownership

---

## Future Extensions

This pattern can be extended to other confirmable actions:
- `remember_retract` - Unpublish from shared space
- `remember_delete_permanent` - Permanent deletion with confirmation
- `remember_share_with_user` - Share with specific user
- Any other sensitive operation requiring explicit consent

---

**Next Milestone**: M11 - Ghost Profiles & Pseudonymous Identity
**Blockers**: None (builds on M1-M4)
