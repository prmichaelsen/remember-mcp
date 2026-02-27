# Task 182: Trust Enforcement Service

**Milestone**: M7 — Trust & Permissions
**Status**: pending
**Dependencies**: Task 180 (types)
**Updated**: 2026-02-27 (aligned with ghost/persona design — 3 enforcement modes)

---

## Objective

Implement trust enforcement with three configurable modes: query-level filtering (default), prompt-based formatting, and hybrid. See `agent/design/local.ghost-persona-system.md` and `agent/design/trust-system-implementation.md`.

> **Design change (2026-02-27)**: The ghost/persona design specifies three enforcement modes.
> Query-level filtering is the default (memories above threshold never returned from Weaviate).
> Prompt-based formatting (`formatMemoryForPrompt`) is used only in prompt/hybrid modes.

## Deliverables

### 1. `src/services/trust-enforcement.ts`

**Query-level enforcement** (default mode):
- `buildTrustFilter(collection, accessorTrustLevel)` — returns Weaviate filter: `trust_score <= accessorTrustLevel`
- Used in `buildBaseFilters()` when ghost context is active

**Prompt-level enforcement** (prompt/hybrid modes):
- `formatMemoryForPrompt(memory, trustLevel)`:
  - **Trust 1.0 (Full Access)**: Full content, all details
  - **Trust 0.75 (Partial Access)**: Content with sensitive fields redacted
  - **Trust 0.5 (Summary Only)**: Title + summary only, no content
  - **Trust 0.25 (Metadata Only)**: Type, date, tags — no content or summary
  - **Trust 0.0 (Existence Only)**: "A memory exists about this topic" — hint only

**Shared utilities**:
- `getTrustLevelLabel(trust: number)` — human-readable label
- `getTrustInstructions(trust: number)` — LLM instruction text for each level
- `redactSensitiveFields(memory, trust)` — field-level redaction for partial access
- `isTrustSufficient(memoryTrust, accessorTrust)` — `accessorTrust >= memoryTrust`

Key rules:
- Trust is continuous 0-1, but behavior maps to nearest threshold
- Self-access ALWAYS returns full content (trust=1.0 equivalent)
- Enforcement mode is read from GhostConfig (default: 'query')
- Query mode: memories above threshold never returned
- Prompt mode: all memories returned, formatted by trust level
- Hybrid mode: query filter for trust 0.0, prompt filter for rest

### 2. `src/services/trust-validator.ts`

Validation for trust-sensitive operations:

- `validateTrustAssignment(trustLevel, content?)` — warn if trust < 0.25 (very private)
- `suggestTrustLevel(contentType, tags?)` — suggest appropriate trust based on content type

### 3. Tests

- `src/services/trust-enforcement.spec.ts` — test all 3 modes, 5 trust levels, edge cases, self-access
- `src/services/trust-validator.spec.ts` — test validation and suggestions

## Acceptance Criteria

- [ ] Query-level filter function works (buildTrustFilter)
- [ ] Prompt-level formatting works for all 5 levels
- [ ] Self-access always returns full content
- [ ] Enforcement mode branching (query/prompt/hybrid)
- [ ] Trust labels and instructions are clear
- [ ] Validator catches low-trust assignments
- [ ] All tests pass
