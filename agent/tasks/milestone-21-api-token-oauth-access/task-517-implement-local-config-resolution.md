# Task 517: Implement Local Config Resolution

**Milestone**: M21 — API Token & OAuth Access
**Status**: not_started
**Estimated Hours**: 2-3
**Dependencies**: Task 515

---

## Objective

Implement `.agentbase/config` file resolution so users can store API tokens and OAuth endpoints in local config files instead of (or in addition to) env vars.

## Context

Resolution order (first wins):
1. `./.agentbase/config` (project-level)
2. `~/.agentbase/config` (global)
3. `REMEMBER_API_TOKEN` / `REMEMBER_OAUTH_ENDPOINT` env vars

This allows per-project multi-tenancy (different projects → different platforms), similar to `.npmrc` precedence.

## Steps

1. Create `src/auth/config-resolver.ts`:
   ```typescript
   interface ResolvedAuthConfig {
     oauthEndpoint: string;
     apiToken: string;
   }

   function resolveAuthConfig(): ResolvedAuthConfig
   ```

2. Config file format (YAML):
   ```yaml
   oauth_endpoint: https://agentbase.me/api/oauth/token
   api_token: ab_live-sk_...
   ```

3. Resolution logic:
   - Check `process.cwd() + '/.agentbase/config'`
   - If not found, check `os.homedir() + '/.agentbase/config'`
   - If not found, fall back to env vars
   - Merge: file values fill in, env vars override

4. Parse YAML (use existing `yaml` dependency or simple key-value parsing)

5. Validate: after resolution, if scheme=oauth and either value is missing, throw descriptive error listing where it looked

## Verification

- [ ] Project-level config takes precedence over global
- [ ] Global config takes precedence over missing env vars
- [ ] Env vars override file values when both present
- [ ] Missing config file is handled gracefully (not an error)
- [ ] Missing required values after resolution throws descriptive error
- [ ] Config file with only `api_token` works (endpoint from env var)
- [ ] TypeScript compiles
