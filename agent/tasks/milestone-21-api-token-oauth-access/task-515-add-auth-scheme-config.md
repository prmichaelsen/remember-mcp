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

1. Add discriminated union types (no Zod — manual validation, typed config pattern):
   ```typescript
   type ServiceAuthConfig = { scheme: 'service' };
   type OAuthAuthConfig = {
     scheme: 'oauth';
     oauthEndpoint: string;
     apiToken: string;
   };
   type AuthSchemeConfig = ServiceAuthConfig | OAuthAuthConfig;
   ```
   TypeScript narrows automatically: `if (config.scheme === 'oauth')` guarantees `oauthEndpoint` and `apiToken` are present.

2. Add `loadAuthSchemeConfig()` — validates at startup, fails fast:
   ```typescript
   function loadAuthSchemeConfig(): AuthSchemeConfig {
     const scheme = process.env.REMEMBER_AUTH_SCHEME ?? 'service';
     if (scheme === 'service') return { scheme };
     if (scheme !== 'oauth') throw new Error(`Invalid REMEMBER_AUTH_SCHEME: ${scheme}`);
     const oauthEndpoint = process.env.REMEMBER_OAUTH_ENDPOINT;
     if (!oauthEndpoint) throw new Error('REMEMBER_OAUTH_ENDPOINT required when REMEMBER_AUTH_SCHEME=oauth');
     const apiToken = process.env.REMEMBER_API_TOKEN ?? '';
     return { scheme, oauthEndpoint, apiToken };
   }
   ```
   `apiToken` may be empty here — T517 (config resolver) fills it from `.remember/config` if not set via env var.

3. Export `loadAuthSchemeConfig` from config module

4. Keep types in config module (no separate types file needed for this small addition)

## Verification

- [ ] `REMEMBER_AUTH_SCHEME=service` loads without errors (default behavior)
- [ ] `REMEMBER_AUTH_SCHEME=oauth` with valid endpoint loads without errors
- [ ] `REMEMBER_AUTH_SCHEME=oauth` without endpoint throws descriptive error
- [ ] Config values accessible from `authSchemeConfig`
- [ ] TypeScript compiles
