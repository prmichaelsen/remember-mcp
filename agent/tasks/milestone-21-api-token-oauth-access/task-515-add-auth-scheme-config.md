# Task 515: Add Auth Scheme Config

**Milestone**: M21 — API Token & OAuth Access
**Status**: not_started
**Estimated Hours**: 2
**Dependencies**: None

---

## Objective

Extend the remember-mcp config module to support `REMEMBER_AUTH_SCHEME`, `REMEMBER_OAUTH_ENDPOINT`, and `REMEMBER_API_TOKEN` environment variables.

## Context

remember-mcp currently reads Weaviate, Firestore, and embeddings config from env vars via `src/config.ts`. We need to add a new `auth` config section that determines how the server authenticates at startup.

## Steps

1. Add `AuthSchemeConfig` interface to config types:
   ```typescript
   interface AuthSchemeConfig {
     scheme: 'service' | 'oauth';
     oauthEndpoint?: string;  // required when scheme=oauth
     apiToken?: string;       // required when scheme=oauth (or resolved from .remember/config)
   }
   ```

2. Read from env vars in config module:
   - `REMEMBER_AUTH_SCHEME` → defaults to `'service'`
   - `REMEMBER_OAUTH_ENDPOINT` → required when scheme=oauth
   - `REMEMBER_API_TOKEN` → optional (can come from .remember/config instead)

3. Add validation: if `scheme=oauth` and `oauthEndpoint` is missing, throw a clear error at startup

4. Export `authSchemeConfig` from config module

## Verification

- [ ] `REMEMBER_AUTH_SCHEME=service` loads without errors (default behavior)
- [ ] `REMEMBER_AUTH_SCHEME=oauth` with valid endpoint loads without errors
- [ ] `REMEMBER_AUTH_SCHEME=oauth` without endpoint throws descriptive error
- [ ] Config values accessible from `authSchemeConfig`
- [ ] TypeScript compiles
