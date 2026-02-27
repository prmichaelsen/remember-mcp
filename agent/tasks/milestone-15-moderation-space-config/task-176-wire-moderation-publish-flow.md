# Task 176: Wire Moderation into Publish Flow

**Milestone**: M15 - Moderation & Space Config
**Estimated Hours**: 3-4
**Dependencies**: Task 174, Task 175
**Status**: Not Started

---

## Objective

Update the publish confirmation flow to set `moderation_status` on published memories based on space/group config.

---

## Steps

### 1. Update `executePublishMemory()` in `src/tools/confirm.ts`

In the publish execution handler:

1. For each target space/group, read config via `getSpaceConfig()`
2. If `require_moderation: true` -> set `moderation_status: 'pending'`
3. If `require_moderation: false` (or no config) -> set `moderation_status: 'approved'`
4. Set `moderated_by: null`, `moderated_at: null` (will be set by moderator later)

### 2. Update the published memory properties written to Weaviate

Ensure `moderation_status` is included in the properties object when creating the published copy.

### 3. Update existing publish tests

- Test publish to unmoderated space -> `moderation_status: 'approved'`
- Test publish to moderated space -> `moderation_status: 'pending'`
- Test publish to group with config -> correct status

---

## Verification

- [ ] Unmoderated spaces: published memories get `moderation_status: 'approved'`
- [ ] Moderated spaces: published memories get `moderation_status: 'pending'`
- [ ] Default (no config): treated as unmoderated
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
