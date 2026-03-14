# Milestone 21: API Token & OAuth Access

**Status**: not_started
**Started**: —
**Estimated Weeks**: 1
**Tasks**: 5

---

## Goal

Enable remember-mcp to run locally (e.g. in Claude Code) by supporting an OAuth auth scheme where an API token is exchanged for a JWT via a configurable endpoint. This is the remember-mcp slice of the cross-project API Token feature.

## Scope

This milestone covers **remember-mcp changes only**. Other projects (agentbase.me, remember-core, remember-rest-service) have their own milestones for the remaining pieces.

Changes:
- `REMEMBER_AUTH_SCHEME` config (`service` | `oauth`)
- OAuth token exchange client
- Local config file resolution (`.remember/config`)
- Wiring into server-factory startup
- Tests and documentation

## Deliverables

- [ ] Config module supports `REMEMBER_AUTH_SCHEME`, `REMEMBER_OAUTH_ENDPOINT`, `REMEMBER_API_TOKEN`
- [ ] OAuth token exchange client exchanges API token for JWT
- [ ] `.remember/config` resolution (project > global > env var)
- [ ] server-factory uses OAuth flow when `REMEMBER_AUTH_SCHEME=oauth`
- [ ] Unit tests for config, exchange client, config resolution
- [ ] CHANGELOG and README updated

## Success Criteria

- `REMEMBER_AUTH_SCHEME=service` behaves exactly as today (no regression)
- `REMEMBER_AUTH_SCHEME=oauth` exchanges token and starts server with resolved userId
- Config resolution order: `./.remember/config` > `~/.remember/config` > env vars
- Build passes, all existing tests pass, new tests cover oauth flow

## Dependencies

- Design: [local.api-token-oauth-access.md](../design/local.api-token-oauth-access.md)
- Clarification: [clarification-5-api-token-cli-access.md](../clarifications/clarification-5-api-token-cli-access.md)
- External: agentbase.me must have `/api/oauth/token` endpoint for end-to-end testing (can be mocked for unit tests)

## Tasks

- [Task 515: Add auth scheme config](../tasks/milestone-21-api-token-oauth-access/task-515-add-auth-scheme-config.md)
- [Task 516: Implement OAuth token exchange client](../tasks/milestone-21-api-token-oauth-access/task-516-implement-oauth-token-exchange.md)
- [Task 517: Implement local config resolution](../tasks/milestone-21-api-token-oauth-access/task-517-implement-local-config-resolution.md)
- [Task 518: Wire OAuth into server-factory](../tasks/milestone-21-api-token-oauth-access/task-518-wire-oauth-into-server-factory.md)
- [Task 519: Tests and documentation](../tasks/milestone-21-api-token-oauth-access/task-519-tests-and-documentation.md)
