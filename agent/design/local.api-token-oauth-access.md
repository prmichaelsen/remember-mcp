# API Token & OAuth Access

**Concept**: Enable CLI and local access to remember data via API tokens exchanged through an OAuth flow
**Created**: 2026-03-14
**Status**: Design Specification

---

## Overview

Users currently access remember data through two paths: the agentbase.me web UI (Firebase Auth) and deployed MCP servers (JWT via mcp-auth). Neither supports local CLI access — there's no way to run remember-mcp locally in Claude Code or call remember-rest-service from a terminal without manually managing service credentials.

This design introduces API tokens as a first-class credential type. Users generate tokens on agentbase.me, configure them locally, and use them to authenticate via a standard OAuth token exchange. The entire downstream stack remains JWT-based.

---

## Problem Statement

- **No CLI access path**: Users cannot connect Claude Code (local) to their cloud remember data without fragile manual secret management and raw curl commands.
- **Platform coupling**: The only auth path is through agentbase.me's Firebase Auth, which requires a browser and doesn't support headless/CLI workflows.
- **Multi-tenant inflexibility**: Self-hosted platforms can't use the same auth infrastructure because credentials are hardcoded to agentbase.me.

---

## Solution

Introduce a three-layer auth architecture:

1. **API Token** (credential) — opaque, prefixed, short-lived (1 hour), stored as SHA-256 hash in Firestore
2. **OAuth Token Exchange** (flow) — API token is exchanged for a JWT via `REMEMBER_OAUTH_ENDPOINT`
3. **JWT** (access) — existing downstream code, unchanged

```
User generates token on agentbase.me
  → stored hashed in Firestore, raw shown once
  → user saves to .remember/config or REMEMBER_API_TOKEN env var

remember-mcp starts with REMEMBER_AUTH_SCHEME=oauth
  → reads REMEMBER_API_TOKEN + REMEMBER_OAUTH_ENDPOINT
  → exchanges API token for JWT via OAuth endpoint
  → proceeds with JWT as normal (userId extracted from claims)

All downstream code unchanged — same request.userId, same tool handlers
```

### Alternative Considered: Direct Token Validation in Auth Guard

Extending the remember-rest-service auth guard to validate API tokens directly (Firestore lookup per request). Rejected because:
- Mixes two auth strategies in one guard
- Doesn't work with mcp-auth's existing OAuth support
- Couples remember-rest-service to a specific token storage backend
- The OAuth exchange approach is standard and enables self-hosted platforms

---

## Implementation

### Token Format

Prefixed opaque tokens with secret/public key distinction:

```
ab_live-sk_<32 bytes hex>   # secret key (server-side, CLI)
ab_live-pk_<32 bytes hex>   # public key (client-side, future)
```

- Opaque: leaked token reveals nothing (no embedded userId)
- Prefix enables secret scanning (GitHub, GitGuardian)
- 32 bytes of entropy (256 bits)

### Firestore Schema

Collection: `api_tokens` (top-level, keyed by SHA-256 hash of raw token)

```typescript
interface ApiToken {
  user_id: string;
  name: string;              // human-readable label, e.g. "MacBook Pro"
  scopes: string[];          // ["*"] for full access, or specific scopes
  created_at: Timestamp;
  expires_at: Timestamp;     // created_at + 1 hour
  last_used_at: Timestamp;
  disabled: boolean;         // emergency kill switch
}
```

Lookup: `hash(raw_token)` → document → `user_id`

### Auth Scheme Configuration

remember-mcp supports two auth schemes via `REMEMBER_AUTH_SCHEME`:

| Env Var | Value | Behavior |
|---|---|---|
| `REMEMBER_AUTH_SCHEME` | `service` (default) | Current behavior — JWT via mcp-auth, deployed behind remember-mcp-server |
| `REMEMBER_AUTH_SCHEME` | `oauth` | Local mode — exchanges API token for JWT via OAuth endpoint |
| `REMEMBER_OAUTH_ENDPOINT` | URL | OAuth token exchange endpoint (required when scheme=oauth) |
| `REMEMBER_API_TOKEN` | token | API token for OAuth exchange (or read from `.remember/config`) |

### Local Configuration Resolution

Token and endpoint are resolved in order (first wins):

1. `./.remember/config` (project-level)
2. `~/.remember/config` (global)
3. `REMEMBER_API_TOKEN` / `REMEMBER_OAUTH_ENDPOINT` env vars (override)

Config file format:

```yaml
# .remember/config
oauth_endpoint: https://agentbase.me/api/oauth/token
api_token: ab_live-sk_...
```

This enables per-project multi-tenant support (different projects → different platforms).

### OAuth Token Exchange

The OAuth endpoint accepts an API token and returns a JWT:

```
POST {REMEMBER_OAUTH_ENDPOINT}
Content-Type: application/json

{
  "grant_type": "api_token",
  "api_token": "ab_live-sk_..."
}

→ 200 OK
{
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

The JWT contains the same claims as browser-issued tokens (`sub`, `iss`, `aud`), so downstream code is unaware of the auth method.

### Auth Method Observability

The auth guard sets `request.authMethod` alongside `request.userId`:

```typescript
request.userId = payload.sub;
request.authMethod = 'jwt' | 'api_token';
```

Downstream tool handlers ignore `authMethod`. Rate-limiting and logging can use it.

### Rate Limiting

| Tier | Rate | Purpose |
|---|---|---|
| Token hard limit | Higher than JWT default | API tokens get more headroom for programmatic access |
| Token emergency limit | Burst threshold | Auto-disable token on anomalous burst activity |

Rate limits are per-token (not per-user), enabling independent limits per credential.

### agentbase.me Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/tokens` | POST | Create token (returns raw token once) |
| `/api/tokens` | GET | List tokens (metadata only, no raw values) |
| `/api/tokens/:id` | DELETE | Revoke token |
| `/api/oauth/token` | POST | OAuth token exchange (API token → JWT) |

### CLI Login Flow

```
$ agentbase login
Opening browser for authentication...
  → Browser opens agentbase.me/cli-auth
  → User authenticates via Firebase Auth
  → agentbase.me generates API token
  → Token sent back to CLI via localhost callback
Authenticated! Token saved to ~/.remember/config
```

### agentbase.me UI

Settings page: "API Tokens"
- Create token (name field, shown-once raw value)
- List tokens (name, created date, last used, revoke button)
- Token scopes display (v1: always "Full access")

---

## Benefits

- **CLI access**: Claude Code and terminal workflows can access cloud remember data
- **Platform agnostic**: `REMEMBER_OAUTH_ENDPOINT` can point to any compatible platform, not just agentbase.me
- **Zero downstream changes**: All existing tool handlers, services, and auth context work unchanged
- **Security**: Opaque tokens, SHA-256 hashing, 1-hour expiry, emergency disable
- **Multi-tenant**: Per-project `.remember/config` supports different accounts/platforms

---

## Trade-offs

- **Firestore read per exchange**: Each OAuth token exchange requires a Firestore lookup by token hash. Mitigated by 1-hour JWT TTL (one lookup per hour, not per request).
- **Token management complexity**: Users must manage tokens (generate, store, revoke). Mitigated by `agentbase login` CLI flow.
- **Cross-project coordination**: Changes span 4-5 codebases. Mitigated by breaking into per-project milestones.

---

## Dependencies

- **agentbase.me**: Token CRUD API, OAuth endpoint, CLI auth page, settings UI
- **remember-core**: Firestore paths for `api_tokens` collection, optional token validation helpers
- **remember-rest-service**: Auth guard extension for `authMethod` observability
- **remember-mcp**: `REMEMBER_AUTH_SCHEME` config, OAuth token exchange at startup
- **agentbase-mcp-server** (new): Dedicated codebase wrapping remember-mcp with agentbase.me OAuth

---

## Testing Strategy

- **Unit**: Token generation (format, entropy), hashing, config resolution order, auth scheme switching
- **Integration**: Full OAuth flow (create token → exchange → JWT → tool call), token expiry, revocation
- **Security**: Verify raw tokens never stored, hash collisions, prefix scanning, disabled token rejection
- **E2E**: `agentbase login` flow, Claude Code local session with cloud data

---

## Migration Path

1. **agentbase.me**: Add `/api/tokens` CRUD + `/api/oauth/token` exchange endpoint + settings UI
2. **remember-core**: Add `api_tokens` Firestore paths, optional validation helpers
3. **remember-mcp**: Add `REMEMBER_AUTH_SCHEME=oauth` mode with token exchange
4. **remember-rest-service**: Add `request.authMethod` to auth guard
5. **CLI**: Build `agentbase login` command (or npm package)

No breaking changes — `REMEMBER_AUTH_SCHEME` defaults to `service` (current behavior).

---

## Key Design Decisions

### Token Format & Security

| Decision | Choice | Rationale |
|---|---|---|
| Token opacity | Opaque (random bytes) | Leaked token reveals nothing; userId requires API lookup which is rate-limitable and revocable |
| Token prefix | `ab_live-sk_` / `ab_live-pk_` | Enables secret scanning tools (GitHub, GitGuardian) |
| Storage | SHA-256 hash only | Raw token never persisted; shown once at creation |
| Expiry | 1 hour | Matches Google OAuth convention; limits blast radius of leaked tokens |
| Scopes | Supported but v1 = full access | Schema includes `scopes` array; v1 always `["*"]` |

### Architecture

| Decision | Choice | Rationale |
|---|---|---|
| Auth integration | OAuth token exchange (not direct guard validation) | Clean separation; works with mcp-auth; enables self-hosted platforms |
| Auth scheme env var | `REMEMBER_AUTH_SCHEME=service\|oauth` | remember-mcp stays platform-agnostic; no agentbase.me coupling in core code |
| Config naming | `REMEMBER_*` (not `AGENTBASE_*`) | Core code must be platform-agnostic; any OAuth endpoint should work |
| Config resolution | `./.remember/config` > `~/.remember/config` > env var | Per-project multi-tenancy; similar to `.npmrc` precedence |

### Observability

| Decision | Choice | Rationale |
|---|---|---|
| `request.authMethod` | `'jwt' \| 'api_token'` alongside `request.userId` | Zero downstream changes; rate-limiting and logging can differentiate |
| Rate limiting | Per-token with hard + emergency limits | Protects against abuse per credential; emergency auto-disable on burst |

---

## Future Considerations

- **Multiple tokens per user**: Schema supports array; v1 limited to single active token
- **Scoped tokens**: Read-only, per-tool, per-space scoping
- **Fully local mode**: Local Weaviate + Firestore emulator for offline/air-gapped use
- **Token rotation**: Automatic refresh before expiry
- **CLI package**: `@prmichaelsen/agentbase-cli` npm package with `agentbase login`, `agentbase status`, etc.
- **`remember_login` MCP tool**: In-session authentication for remember-mcp

---

**Status**: Design Specification
**Recommendation**: Break into per-project milestones and begin with agentbase.me token CRUD + OAuth endpoint
**Related Documents**:
- [Clarification 5: API Token & CLI Access](../clarifications/clarification-5-api-token-cli-access.md)
- [REST API Architecture](../../remember-rest-service/agent/design/local.rest-api-architecture.md)
- [Group ACL Integration](local.group-acl-integration.md)
