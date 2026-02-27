# Task 188: Trust Filter Integration into Search/Query Tools

**Milestone**: M16 — Ghost System
**Status**: not_started
**Dependencies**: Task 187 (GhostConfig Firestore), Task 182 (trust enforcement — done)

---

## Objective

Wire trust enforcement into search and query tools so ghost conversations get trust-filtered results.

## Deliverables

### 1. Add `ghostContext` parameter to search/query handlers

- `search-memory.ts` — accept optional `ghostContext: { ownerUserId, accessorUserId, accessorTrustLevel }`
- `query-memory.ts` — same ghostContext parameter
- When ghostContext present: apply `buildTrustFilter` to Weaviate query
- When ghostContext absent: current self-access behavior (no change)

### 2. Wire into server-factory.ts

- Ghost context passed from agentbase.me via the tool call arguments
- server-factory resolves ghost config and computes accessor trust level
- Passes ghostContext to tool handlers

### 3. Format results by trust level

- When ghostContext present, run results through `formatMemoryForPrompt`
- Self-access (no ghostContext) returns full content as before

### 4. Tests

- Trust-filtered search returns only accessible memories
- Self-access unchanged
- Format tiers work correctly

## Acceptance Criteria

- [ ] Ghost searches filter by trust_score <= accessorTrustLevel
- [ ] Self-access unchanged (no regression)
- [ ] Results formatted by trust tier
- [ ] Tests pass
