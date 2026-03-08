# Task 214: Create Tag Builder Utility

**Milestone**: M20 — Unified Internal Memory Tools
**Status**: Not Started
**Estimated Hours**: 2-3
**Dependencies**: task-212

---

## Objective

Create a `buildInternalTags` utility that produces the correct tags for ghost/agent memories based on `AuthContext`, implementing the ghost source isolation tag scheme.

## Context

Ghost source isolation requires different tag sets for different ghost types:
- User ghost (alice): `['ghost', 'ghost_type:user', 'ghost_owner:user:alice']`
- Space ghost (music-lovers): `['ghost', 'ghost_type:space', 'ghost_owner:space:music-lovers']`
- Group ghost (band-mates): `['ghost', 'ghost_type:group', 'ghost_owner:group:band-mates']`
- Agent: `['agent']`

## Design Reference

- [Unified Internal Memory Tools — Section 3: Tag Builder](../design/local.unified-internal-memory-tools.md)

## Steps

1. Create `src/utils/internal-tags.ts` with `buildInternalTags(authContext: AuthContext): string[]`

2. Implement the tag builder per the design spec:
   - If `internalContext.type === 'agent'`, return `['agent']`
   - If `internalContext.type === 'ghost'`, return `['ghost']` + type-specific tags
   - If no `internalContext`, return `[]`

3. For ghost type tags (all fields now on `internalContext`):
   - `'user'` → `ghost_type:user` + `ghost_owner:user:{internalContext.owner_user_id}`
   - `'space'` → `ghost_type:space` + `ghost_owner:space:{internalContext.ghost_space}`
   - `'group'` → `ghost_type:group` + `ghost_owner:group:{internalContext.ghost_group}`

4. Export from utils module

## Verification

- [ ] `buildInternalTags` returns correct tags for each ghost type
- [ ] `buildInternalTags` returns `['agent']` for agent context
- [ ] `buildInternalTags` returns `[]` for no internal context
- [ ] User ghost uses `internalContext.owner_user_id` for owner tag
- [ ] Space ghost uses `internalContext.ghost_space` for owner tag
- [ ] Group ghost uses `internalContext.ghost_group` for owner tag
- [ ] Unit tests cover all tag permutations
