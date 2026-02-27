# Task 185: Wire Trust into Search & Query Tools

**Milestone**: M7 — Trust & Permissions
**Status**: deferred
**Deferred Reason**: Ghost/persona system will handle trust-filtered responses, not search tools directly. See clarification-2-cross-user-access-model.md.
**Dependencies**: Task 182 (trust enforcement), Task 183 (access control)

---

## Objective

Integrate trust enforcement into existing search and query tools so cross-user access respects trust levels.

## Deliverables

### 1. Update `src/tools/search-memory.ts`

- After retrieving results, run each through `checkMemoryAccess`
- For self-access: return full content (no change to current behavior)
- For cross-user results: format via `formatMemoryForPrompt(memory, trustLevel)`
- Filter out `no_permission` and `blocked` results silently
- Include trust level info in response metadata

### 2. Update `src/tools/query-memory.ts`

- Same trust enforcement as search-memory
- Format results based on accessor's trust level

### 3. Update `src/tools/search-space.ts` and `src/tools/query-space.ts`

- Space/group searches show published memories from multiple users
- Each result formatted based on viewer's trust level with the author
- If no permission relationship exists, use memory's default visibility
- Published memories in spaces default to trust 1.0 (publicly shared)

### 4. Tests

- `src/tools/search-memory-trust.spec.ts` — self-access full, cross-user filtered
- Update existing search/query specs with trust-aware test cases

## Key Design Decisions

- **Self-access**: No trust filtering ever applied
- **Space memories**: Published memories are inherently shared → trust 1.0 default
- **Private searches**: Cross-user access checks permission + trust level
- **No permission = hidden**: Don't show "access denied", just omit from results
- **Performance**: Batch permission checks, not one-by-one

## Acceptance Criteria

- [ ] Self-access returns full content unchanged
- [ ] Cross-user access formats by trust level
- [ ] No-permission results silently filtered
- [ ] Space memories default to full access
- [ ] Tests pass
