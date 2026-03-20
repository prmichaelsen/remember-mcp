# Milestone 23: Trust Level Protection (Breaking)

**Goal**: Align remember-mcp with remember-core M80 trust level protection — remove direct trust setting, add confirmation-gated trust change flow, update trust scale to integer 1-5
**Duration**: 1 week
**Dependencies**: remember-core >= 0.72.0
**Status**: Not Started

---

## Overview

remember-core M80 removes trust from CreateMemoryInput/UpdateMemoryInput and introduces a two-phase confirmation flow for trust level changes (`requestSetTrustLevel` → token → `confirmSetTrustLevel`). Additionally, the ConfirmationGuardService adds optional HMAC secret token challenge on confirm/deny operations.

This is a **major breaking change** for remember-mcp consumers:
- `trust` parameter removed from 4 MCP tool schemas (create-memory, update-memory, create-internal-memory, update-internal-memory)
- Trust defaults to SECRET (5) on creation
- Trust can only be changed via a new dedicated confirmation flow
- Trust scale changes from 0-1 float to 1-5 integer

**Version**: 3.x → 4.0.0

---

## Deliverables

### 1. Schema Changes
- Remove `trust` parameter from create-memory, update-memory, create-internal-memory, update-internal-memory tool schemas
- Update all tool descriptions referencing trust scale (0-1 → 1-5)

### 2. New MCP Tool
- `remember_request_set_trust_level` — request a trust level change, returns confirmation token
- Reuses existing confirm/deny flow for the actual change

### 3. Confirm/Deny Updates
- `remember_confirm` and `remember_deny` support optional `secret_token` parameter
- Guard-aware error messages (cooldown, backoff)

### 4. Dependency & Version
- remember-core bumped to >= 0.72.0
- remember-mcp version bumped to 4.0.0
- CHANGELOG updated with breaking change documentation

---

## Success Criteria

- [ ] `trust` parameter absent from create/update tool schemas
- [ ] `remember_request_set_trust_level` tool registered and functional
- [ ] `remember_confirm` / `remember_deny` accept optional `secret_token`
- [ ] All trust scale references updated to 1-5 integer
- [ ] remember-core >= 0.72.0 installed
- [ ] All existing tests updated and passing
- [ ] Version 4.0.0 with CHANGELOG entry
- [ ] TypeScript compiles without errors
- [ ] Build successful

---

## Key Files to Create

```
src/
├── tools/
│   └── request-set-trust-level.ts        (new tool)
│   └── request-set-trust-level.spec.ts   (new tests)
```

## Key Files to Modify

```
src/
├── tools/
│   ├── create-memory.ts          (remove trust param)
│   ├── update-memory.ts          (remove trust param)
│   ├── create-internal-memory.ts (remove trust param)
│   ├── update-internal-memory.ts (remove trust param)
│   ├── confirm.ts                (add secret_token)
│   ├── deny.ts                   (add secret_token)
│   └── *.spec.ts                 (update tests)
├── server.ts                     (register new tool)
├── server-factory.ts             (register new tool)
├── services/trust-validator.ts   (update to 1-5 scale)
├── types/memory.ts               (remove trust from interfaces)
package.json                      (bump versions)
CHANGELOG.md                      (breaking change entry)
```

---

## Tasks

1. [Task 525: Remove trust from create/update tools](../tasks/milestone-23-trust-level-protection/task-525-remove-trust-from-create-update.md) — Remove trust parameter from 4 MCP tool schemas and handlers
2. [Task 526: Add remember_request_set_trust_level tool](../tasks/milestone-23-trust-level-protection/task-526-add-request-set-trust-level-tool.md) — New two-phase trust change MCP tool
3. [Task 527: Update confirm/deny for secret_token](../tasks/milestone-23-trust-level-protection/task-527-update-confirm-deny-secret-token.md) — Add optional secret_token to confirm/deny tools
4. [Task 528: Update trust scale references](../tasks/milestone-23-trust-level-protection/task-528-update-trust-scale-references.md) — 0-1 float → 1-5 integer across codebase
5. [Task 529: Version bump and release](../tasks/milestone-23-trust-level-protection/task-529-version-bump-and-release.md) — Bump remember-core, version 4.0.0, CHANGELOG, tests

---

## Testing Requirements

- [ ] Unit tests for new request-set-trust-level tool
- [ ] Updated tests for create/update tools (trust param removed)
- [ ] Updated tests for confirm/deny (secret_token param)
- [ ] Trust validator tests updated for 1-5 scale
- [ ] All existing tests passing

---

## Risks and Mitigation

| Risk | Impact | Probability | Mitigation Strategy |
|------|--------|-------------|---------------------|
| remember-core 0.72.0 not yet published to npm | High | Low | Check npm registry; if not published, install from local path |
| Downstream consumers break on trust removal | Medium | High | Major version bump (4.0.0) signals breaking change |
| ConfirmationGuardService optional — unclear when to wire | Low | Medium | Keep guard optional in remember-mcp, document when to enable |

---

**Next Milestone**: TBD
**Blockers**: remember-core >= 0.72.0 must be available
**Notes**: This milestone aligns remember-mcp with remember-core's trust philosophy: trust is a sensitive setting that should require explicit user confirmation to change, not be silently set during memory creation.
