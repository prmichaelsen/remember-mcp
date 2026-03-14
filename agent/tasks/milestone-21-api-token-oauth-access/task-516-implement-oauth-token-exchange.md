# Task 516: Implement OAuth Token Exchange Client

**Milestone**: M21 — API Token & OAuth Access
**Status**: not_started
**Estimated Hours**: 3
**Dependencies**: Task 515

---

## Objective

Create a client that exchanges an API token for a JWT by calling the configured OAuth endpoint.

## Context

When `REMEMBER_AUTH_SCHEME=oauth`, remember-mcp needs to POST the API token to `REMEMBER_OAUTH_ENDPOINT` and receive a JWT back. The JWT contains `sub` (userId), `iss`, and `aud` claims — same as browser-issued tokens.

## Steps

1. Create `src/auth/oauth-exchange.ts`:
   ```typescript
   interface OAuthTokenResponse {
     access_token: string;
     token_type: 'Bearer';
     expires_in: number;
   }

   async function exchangeApiToken(
     oauthEndpoint: string,
     apiToken: string
   ): Promise<OAuthTokenResponse>
   ```

2. Implementation:
   - POST to `oauthEndpoint` with `{ grant_type: 'api_token', api_token: apiToken }`
   - Parse response, validate shape
   - Throw descriptive errors for: network failure, 401 (invalid token), 403 (disabled token), unexpected response

3. Extract userId from JWT:
   ```typescript
   function extractUserId(jwt: string): string
   ```
   - Decode JWT payload (no verification needed — the OAuth endpoint already validated)
   - Extract `sub` claim
   - Throw if missing

4. Use native `fetch` (Node 18+) — no new dependencies

## Verification

- [ ] Successful exchange returns `{ access_token, token_type, expires_in }`
- [ ] Invalid token returns descriptive error (not raw 401)
- [ ] Network failure returns descriptive error
- [ ] `extractUserId` correctly pulls `sub` from JWT payload
- [ ] No new dependencies added
- [ ] TypeScript compiles
