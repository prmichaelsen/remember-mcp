# Task 202: Wire LLM Moderation Client to SpaceService

**Milestone**: M15 - Moderation & Space Config (follow-up)
**Status**: completed
**Estimated Hours**: 0.5
**Priority**: P1
**Dependencies**: M15 (completed), remember-core moderation.service.ts

---

## Objective

Connect the `createModerationClient` from `@prmichaelsen/remember-core` to the `SpaceService` in `remember-mcp`, so that content published to spaces is automatically screened by Claude Haiku before being stored.

Currently, all moderation infrastructure exists but is disconnected:
- `remember-core` exports `createModerationClient()` (calls Anthropic Messages API with Haiku)
- `SpaceService` accepts `{ moderationClient }` in its constructor options
- `SpaceService.checkModeration()` calls `moderationClient.moderate()` on publish/revise
- But `createCoreServices()` in `remember-mcp` never creates or passes a moderation client

## Context

- `remember-core/src/services/moderation.service.ts` — factory + types
- `remember-core/src/services/space.service.ts:237` — constructor accepts `options?.moderationClient`
- `remember-mcp/src/core-services.ts:50` — SpaceService created without moderation client
- `remember-mcp-server/.env` already has `ANTHROPIC_API_KEY` set

## Steps

### 1. Edit `src/core-services.ts`

- Import `createModerationClient` from `@prmichaelsen/remember-core`
- Create a singleton moderation client (only when `ANTHROPIC_API_KEY` env var is present)
- Pass `{ moderationClient }` as the 6th argument to `new SpaceService()`

### 2. Build and verify

- Run `npm run build` (or equivalent)
- Verify TypeScript compiles without errors

### 3. Run tests

- Run existing test suite to ensure no regressions
- Moderation client is optional, so existing tests should pass unaffected

### 4. Version bump

- Bump patch version in package.json
- Update CHANGELOG.md

## Verification

- [ ] `createModerationClient` imported from remember-core
- [ ] Moderation client created conditionally (only when `ANTHROPIC_API_KEY` is set)
- [ ] Moderation client passed to SpaceService constructor
- [ ] TypeScript compiles without errors
- [ ] Existing tests pass
- [ ] Version bumped

## Downstream

After this ships, `remember-mcp-server` just needs a dependency bump — no code changes required. `ANTHROPIC_API_KEY` is already configured in its `.env`.
