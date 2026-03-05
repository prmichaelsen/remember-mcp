# Task 201: Auto-bump remember-core via GitHub Actions

**Milestone**: Unassigned
**Estimated Time**: 1-2 hours
**Dependencies**: None
**Status**: Not Started

---

## Objective

Set up GitHub Actions CI/CD so that when remember-core publishes a new version to npm, remember-mcp automatically bumps the dependency, patches its own version, and publishes to npm.

---

## Context

Currently, bumping remember-core in remember-mcp is a manual process: update package.json, commit, tag, publish. This happens frequently (almost every remember-core release). Automating this eliminates toil and reduces lag between core changes and MCP availability.

The approach uses `repository_dispatch` events: remember-core's publish workflow notifies remember-mcp after a successful npm publish, and remember-mcp's workflow handles the bump + publish.

---

## Steps

### 1. Configure GitHub Secrets

Add required secrets to both repositories:

- **remember-core**: `REPO_DISPATCH_TOKEN` - a GitHub PAT with `repo` scope (to trigger dispatches on remember-mcp)
- **remember-mcp**: `NPM_TOKEN` - an npm access token for publishing

### 2. Add dispatch step to remember-core publish workflow

File: `remember-core/.github/workflows/publish.yml`

A "Notify remember-mcp" step has been drafted that sends a `repository_dispatch` event after successful npm publish. Review and merge.

### 3. Add bump workflow to remember-mcp

File: `remember-mcp/.github/workflows/bump-remember-core.yml`

A workflow has been drafted that:
- Triggers on `repository_dispatch` with `dependency-update` type
- Filters to `@prmichaelsen/remember-core` events
- Installs the new version
- Patch-bumps remember-mcp version
- Commits (`bump: remember core` then `{version}`)
- Tags and pushes
- Publishes to npm

### 4. Fix remember-mcp git remote

The remember-mcp git remote currently points to `remember-core.git` instead of `remember-mcp.git`. Fix with:

```bash
git remote set-url origin git@github.com:prmichaelsen/remember-mcp.git
```

### 5. Test end-to-end

- Push a version bump to remember-core main
- Verify remember-core publishes to npm
- Verify dispatch fires
- Verify remember-mcp bumps, commits, tags, publishes

---

## Verification

- [ ] `REPO_DISPATCH_TOKEN` secret set in remember-core
- [ ] `NPM_TOKEN` secret set in remember-mcp
- [ ] remember-core publish.yml includes dispatch step
- [ ] remember-mcp bump-remember-core.yml exists
- [ ] remember-mcp git remote points to correct repo
- [ ] End-to-end test: remember-core publish triggers remember-mcp bump + publish

---

## Notes

- Draft workflow files already created in both repos (not yet committed)
- remember-core publish.yml already has NPM_TOKEN configured
- The bump workflow commits in the existing pattern: `bump: remember core` then `{version}`
- Consider adding error notifications (GitHub Actions failure emails are on by default)
