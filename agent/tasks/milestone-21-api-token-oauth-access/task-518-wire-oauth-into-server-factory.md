# Task 518: Wire OAuth into Server Factory

**Milestone**: M21 — API Token & OAuth Access
**Status**: not_started
**Estimated Hours**: 2-3
**Dependencies**: Task 515, Task 516, Task 517

---

## Objective

Wire the OAuth token exchange into the server-factory startup path so that when `REMEMBER_AUTH_SCHEME=oauth`, remember-mcp authenticates via API token before creating the server.

## Context

Currently `createServer(accessToken, userId, options)` receives these values from mcp-auth. In oauth mode, remember-mcp needs to resolve them itself:
1. Resolve config (T517)
2. Exchange API token for JWT (T516)
3. Extract userId from JWT
4. Call `createServer(jwt, userId, options)` as normal

## Steps

1. Create `src/auth/oauth-bootstrap.ts`:
   ```typescript
   interface OAuthBootstrapResult {
     accessToken: string;  // JWT
     userId: string;
   }

   async function bootstrapOAuth(): Promise<OAuthBootstrapResult>
   ```
   - Calls `resolveAuthConfig()` → `exchangeApiToken()` → `extractUserId()`
   - Single entry point for the oauth flow

2. Update `src/server.ts` (stdio entrypoint):
   - Read `REMEMBER_AUTH_SCHEME` from config
   - If `service`: current behavior (stdio transport, no auth — used behind mcp-auth)
   - If `oauth`: call `bootstrapOAuth()`, then `createServer(jwt, userId)`, connect transport

3. Ensure `createServer` in server-factory.ts needs no changes — it already accepts `accessToken` and `userId` from any source

4. Add startup logging:
   - `Auth scheme: oauth`
   - `OAuth endpoint: https://...`
   - `Authenticated as userId: abc123`
   - Never log the raw API token

## Verification

- [ ] `REMEMBER_AUTH_SCHEME=service` — no behavior change, existing tests pass
- [ ] `REMEMBER_AUTH_SCHEME=oauth` — bootstraps via token exchange, server starts
- [ ] Raw API token never appears in logs
- [ ] OAuth failure at startup produces clear error message
- [ ] server-factory.ts unchanged
- [ ] TypeScript compiles, build passes
